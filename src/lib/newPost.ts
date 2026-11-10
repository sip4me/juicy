// The new-post pipeline: camera photo → filter + shrink on the phone → upload → recognize → post.
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { supabase, type Audience, type FeedPost, type Meal } from './supabase';
import { filterById, type FilterId } from './filters';

const MAX_EDGE = 1600; // plenty for a 358pt-wide card at 3×, and keeps uploads ~250 KB
const JPEG_QUALITY = 82;

/** Apply the chosen filter and shrink the photo, all on the phone. Returns JPEG bytes ready to upload. */
export async function exportPhoto(uri: string, filter: FilterId): Promise<Uint8Array> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Could not read photo');

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width(), image.height()));
  const w = Math.round(image.width() * scale);
  const h = Math.round(image.height() * scale);

  const surface = Skia.Surface.MakeOffscreen(w, h) ?? Skia.Surface.Make(w, h);
  if (!surface) throw new Error('Could not create drawing surface');
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(filterById(filter)));
  surface.getCanvas().drawImageRect(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, w, h),
    paint,
  );
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
}

/** Upload straight to Storage (never through a function), then ask the backend what the food is. */
export async function uploadAndRecognize(jpeg: Uint8Array, kind: 'eat' | 'drink' = 'eat'): Promise<Meal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first');

  const path = `${user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('meals')
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase.functions.invoke('recognize-meal', { body: { photo_path: path, kind } });
  if (error) throw error;
  if (data.status === 'not_food') throw new NotFoodError();
  return data.meal as Meal;
}

export class NotFoodError extends Error {
  constructor() {
    super("That doesn't look like food. Try another shot?");
  }
}

/** One call writes the post, its audiences, bites/sips and the eating/drinking status. */
export async function publish(opts: {
  mealId: string;
  audiences: Audience[];
  note?: string;
  place?: { id: string; name: string; lat: number; lng: number };
}) {
  const { data, error } = await supabase.rpc('create_post', {
    p_meal_id: opts.mealId,
    p_audiences: opts.audiences,
    p_note: opts.note ?? null,
    p_place_id: opts.place?.id ?? null,
    p_place_name: opts.place?.name ?? null,
    p_lat: opts.place?.lat ?? null,
    p_lng: opts.place?.lng ?? null,
  });
  if (error) throw error;
  return data;
}

export const rateMeal = (mealId: string, rating: 'loved' | 'fine' | 'not_for_me') =>
  supabase.rpc('rate_meal', { p_meal_id: mealId, p_rating: rating });

// ───────── Feeds ─────────
// Pass the last row of the previous page to get the next one (keyset pagination).

export async function loadPlate(last?: FeedPost) {
  const { data, error } = await supabase.rpc('feed_plate', {
    p_before_time: last?.created_at ?? null,
    p_before_id: last?.id ?? null,
  });
  if (error) throw error;
  return withPhotoUrls(data as FeedPost[]);
}

export async function loadTable(cuisine?: string, last?: FeedPost) {
  const { data, error } = await supabase.rpc('feed_table', {
    p_cuisine: cuisine ?? null,
    p_after_rank: last?.rank ?? null,
    p_after_id: last?.id ?? null,
  });
  if (error) throw error;
  return withPhotoUrls(data as FeedPost[]);
}

export async function loadChef(last?: FeedPost) {
  const { data, error } = await supabase.rpc('feed_chef', {
    p_before_time: last?.created_at ?? null,
    p_before_id: last?.id ?? null,
  });
  if (error) throw error;
  return withPhotoUrls(data as FeedPost[]);
}

/** One request signs every photo on the page, resized for the feed card. */
async function withPhotoUrls(posts: FeedPost[]) {
  if (!posts.length) return [];
  const { data } = await supabase.storage
    .from('meals')
    .createSignedUrls(posts.map((p) => p.photo_path), 60 * 60);
  const urls = new Map(data?.map((d) => [d.path, d.signedUrl]));
  return posts.map((p) => ({ ...p, photoUrl: urls.get(p.photo_path) ?? null }));
}
