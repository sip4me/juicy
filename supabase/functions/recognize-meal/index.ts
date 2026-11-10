// recognize-meal: photo → dish → flavor scores → Juicy score.
//
// Called by the app right after the photo is uploaded to Storage:
//   supabase.functions.invoke('recognize-meal', { body: { photo_path, kind } })
//
// Steps (Product Spec, "Flavor engine"):
//   1. Gemini vision names the dish (never asked for flavor scores)
//   2. The name is matched to our dish catalog with embeddings (pgvector)
//   3. Known dish → reuse its stored flavor vector, score and tips (no extra AI call)
//      Unknown dish → one text-only call seeds it on the anchored scales, cached for everyone
//   4. Visible extras (chili, lime…) nudge this meal's flavors
//   5. Save the meal + flavors; the app shows the result on the Edit screen
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const VISION_MODEL = Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-3.5-flash-lite";
const EMBED_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const DIMS = ["sweet", "sour", "salty", "bitter", "umami", "spicy", "richness"] as const;

// Visible extras shift only this meal (Product Spec step 5).
const MODIFIERS: Record<string, Partial<Record<(typeof DIMS)[number], number>>> = {
  "chili": { spicy: 1.5 }, "chili oil": { spicy: 1.5, richness: 0.5 }, "jalapeño": { spicy: 1 },
  "sriracha": { spicy: 1, sweet: 0.3 }, "lime": { sour: 1 }, "lemon": { sour: 1 },
  "pickles": { sour: 0.8, salty: 0.3 }, "cheese": { richness: 0.8, salty: 0.4, umami: 0.4 },
  "bacon": { salty: 0.8, richness: 0.8, umami: 0.5 }, "honey": { sweet: 1 },
  "soy sauce": { salty: 1, umami: 0.6 }, "parmesan": { umami: 0.8, salty: 0.5 },
  "whipped cream": { sweet: 0.8, richness: 0.8 }, "espresso shot": { bitter: 1 },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function gemini(model: string, body: unknown) {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY! },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${API}/${EMBED_MODEL}:embedContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY! },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  return (await res.json()).embedding.values;
}

const RECOGNIZE_SCHEMA = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    kind: { type: "string", enum: ["eat", "drink"] },
    dish_name: { type: "string" },
    cuisine: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    extras: { type: "array", items: { type: "string" } },
    method: { type: "string" },
    textures: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["is_food", "kind", "dish_name", "cuisine", "ingredients", "extras", "confidence"],
};

const SEED_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(DIMS.map((d) => [d, { type: "number" }])),
    base_score: { type: "integer" },
    verdict: { type: "string" },
    tips: {
      type: "array",
      items: {
        type: "object",
        properties: { ingredient: { type: "string" }, why: { type: "string" }, delta: { type: "integer" } },
        required: ["ingredient", "why", "delta"],
      },
    },
  },
  required: [...DIMS, "base_score", "verdict", "tips"],
};

const ANCHORS = `Score each 0–10 using these anchors (2 / 5 / 9):
sweet: carrot / ketchup / caramel
sour: tomato / vinaigrette / lemon wedge
salty: plain bread / potato chips / soy sauce
bitter: green tea / 70% dark chocolate / espresso
umami: plain rice / tomato sauce / aged parmesan
spicy: black pepper / jalapeño / habanero
richness: steamed vegetables / buttered pasta / pork belly`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY is not set on this project" }, 500);

  // Who is calling? (verify_jwt already rejected anonymous calls)
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: "juicy" },
  });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return json({ error: "not signed in" }, 401);

  const { photo_path, kind: hintKind } = await req.json();
  if (typeof photo_path !== "string" || !photo_path.startsWith(`${user.id}/`)) {
    return json({ error: "photo_path must be in your own folder" }, 400);
  }

  // Daily cap (Product Spec: cost control)
  const { count } = await db.from("meals").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", new Date(Date.now() - 864e5).toISOString());
  if ((count ?? 0) >= 40) return json({ error: "daily limit reached" }, 429);

  const { data: meal, error: mealErr } = await db.from("meals")
    .insert({ user_id: user.id, photo_path, kind: hintKind === "drink" ? "drink" : "eat" })
    .select().single();
  if (mealErr) return json({ error: mealErr.message }, 500);

  try {
    // 1. Recognize
    const { data: file, error: dlErr } = await db.storage.from("meals").download(photo_path);
    if (dlErr) throw dlErr;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

    const seen = await gemini(VISION_MODEL, {
      contents: [{
        parts: [
          { inline_data: { mime_type: file.type || "image/jpeg", data: btoa(bin) } },
          { text: `Identify the food or drink in this photo. Use the common dish name (e.g. "Tonkotsu ramen", "Iced oat latte"). "extras" = visible add-ons or garnishes (chili, lime wedge, cheese…). If this is not food or drink, set is_food false.` },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RECOGNIZE_SCHEMA, temperature: 0.2 },
    });

    if (!seen.is_food) {
      await db.from("meals").update({ status: "not_food" }).eq("id", meal.id);
      return json({ meal_id: meal.id, status: "not_food" });
    }

    // 2. Match to catalog
    const alias = seen.dish_name.trim().toLowerCase();
    const vec = await embed(alias);
    const { data: hit } = await db.rpc("match_dish", { p_embedding: vec });
    let dish = hit?.[0]
      ? (await db.from("dishes").select().eq("id", hit[0].dish_id).single()).data
      : null;

    // 3. Unknown dish → seed once, cached for everyone after
    if (!dish) {
      const s = await gemini(VISION_MODEL, {
        contents: [{ parts: [{ text:
          `Dish: ${seen.dish_name} (${seen.cuisine}). Typical ingredients: ${seen.ingredients.join(", ")}.\n${ANCHORS}\n` +
          `Also give base_score 0–100 for how craveable and balanced a typical version is, a one-sentence verdict ` +
          `(friendly, no health or weight language), and 3 tips: ingredients that would make it juicier, ` +
          `each with a short why (under 6 words) and delta (+1 to +8).` }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SEED_SCHEMA, temperature: 0.2 },
      });
      const { data: created, error } = await db.from("dishes").upsert({
        name: seen.dish_name, cuisine: seen.cuisine, kind: seen.kind,
        flavor: `[${DIMS.map((d) => clamp(s[d])).join(",")}]`,
        base_score: Math.round(clamp(s.base_score, 0, 100)), verdict: s.verdict, tips: s.tips.slice(0, 3),
      }, { onConflict: "name" }).select().single();
      if (error) throw error;
      dish = created;
    }
    await db.from("dish_aliases").upsert({ alias, dish_id: dish.id, embedding: `[${vec.join(",")}]` });

    // 4. Meal-level modifiers
    const flavor: number[] = JSON.parse(dish.flavor);
    for (const extra of seen.extras ?? []) {
      const mod = MODIFIERS[extra.toLowerCase()];
      if (mod) DIMS.forEach((d, i) => { flavor[i] = clamp(flavor[i] + (mod[d] ?? 0)); });
    }

    // 5. Save
    const juicy = Math.round(clamp(dish.base_score + (seen.extras?.length ? 2 : 0), 0, 100));
    await db.from("meal_flavors").insert({ meal_id: meal.id, flavor: `[${flavor.join(",")}]` });
    const { data: done } = await db.from("meals").update({
      status: "ready", dish_id: dish.id, dish_name: dish.name, cuisine: seen.cuisine, kind: seen.kind,
      ingredients: seen.ingredients, method: seen.method ?? null, textures: seen.textures ?? [],
      confidence: seen.confidence, juicy_score: juicy, verdict: dish.verdict, tips: dish.tips,
    }).eq("id", meal.id).select().single();

    return json({ meal: done, flavor: Object.fromEntries(DIMS.map((d, i) => [d, flavor[i]])) });
  } catch (e) {
    console.error(e);
    await db.from("meals").update({ status: "failed" }).eq("id", meal.id);
    return json({ meal_id: meal.id, status: "failed", error: String(e) }, 502);
  }
});

function clamp(n: number, lo = 0, hi = 10) {
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
}
