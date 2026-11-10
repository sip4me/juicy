-- Juicy core schema: profiles, social graph, dish catalog, meals, posts, engagement.
-- Feeds are read with RPCs in 20261110000002_juicy_feeds.sql.

-- Juicy lives in its own schema so it can share this project with other apps' tables.
-- Expose it to the API: Dashboard → Project Settings → Data API → Exposed schemas → add "juicy".
create extension if not exists vector with schema extensions;
create schema if not exists juicy;
grant usage on schema juicy to anon, authenticated, service_role;
alter default privileges in schema juicy grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema juicy grant all on tables to service_role;
alter default privileges in schema juicy grant usage, select on sequences to authenticated, service_role;

-- ───────────────────────── Profiles ─────────────────────────
create table juicy.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name      text check (char_length(display_name) <= 40),
  flavor            text,                       -- onboarding "what flavor are you?"
  avatar_character  text,                       -- e.g. 'watermelon_cooler'
  is_chef           boolean not null default false,
  juicy_score       smallint not null default 0,
  bites             integer  not null default 0,
  sips              integer  not null default 0,
  -- live status shown next to the avatar
  status            text check (status in ('eating', 'drinking')),
  status_icon       text,                       -- 'silver_plate' | drink icon
  status_expires_at timestamptz,
  -- user's pick for the drinking badge, and whether status is set automatically
  drink_icon        text not null default 'wine_glass'
                    check (drink_icon in ('wine_glass', 'milk_glass', 'water_bottle', 'soda_can')),
  auto_status       boolean not null default true,
  created_at        timestamptz not null default now()
);

create function juicy.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into juicy.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', null));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function juicy.handle_new_user();

-- ───────────────────────── Social graph ─────────────────────────
-- One row per pair, stored with user_a < user_b so a friendship is never duplicated.
create table juicy.friendships (
  user_a       uuid not null references juicy.profiles (id) on delete cascade,
  user_b       uuid not null references juicy.profiles (id) on delete cascade,
  requested_by uuid not null references juicy.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_b_idx on juicy.friendships (user_b) where status = 'accepted';
create index friendships_req_idx on juicy.friendships (requested_by);

create table juicy.follows (
  follower_id uuid not null references juicy.profiles (id) on delete cascade,
  chef_id     uuid not null references juicy.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, chef_id),
  check (follower_id <> chef_id)
);
create index follows_chef_idx on juicy.follows (chef_id);

-- ───────────────────────── Dish catalog (flavor engine) ─────────────────────────
-- flavor = [sweet, sour, salty, bitter, umami, spicy, richness], each 0–10 on the anchored scales.
create table juicy.dishes (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  cuisine       text,
  kind          text not null default 'eat' check (kind in ('eat', 'drink')),
  flavor        extensions.vector(7) not null,
  source        text not null default 'llm_seed' check (source in ('llm_seed', 'curated', 'crowd')),
  confidence    real not null default 0.3,
  sample_count  integer not null default 0,
  -- cached monocle content, computed once per dish (not per photo)
  base_score    smallint not null default 70,
  verdict       text,
  tips          jsonb not null default '[]',   -- [{ingredient, why, delta}]
  created_at    timestamptz not null default now()
);

create table juicy.dish_aliases (
  alias      text primary key,                 -- lowercased name variant
  dish_id    bigint not null references juicy.dishes (id) on delete cascade,
  embedding  extensions.vector(768) not null
);
create index dish_aliases_embedding_idx on juicy.dish_aliases
  using hnsw (embedding extensions.vector_cosine_ops);
create index dish_aliases_dish_idx on juicy.dish_aliases (dish_id);

-- ───────────────────────── Meals (private log) ─────────────────────────
create table juicy.meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references juicy.profiles (id) on delete cascade,
  photo_path   text not null,                  -- storage: meals/{user_id}/{uuid}.jpg
  kind         text not null default 'eat' check (kind in ('eat', 'drink')),
  status       text not null default 'analyzing'
               check (status in ('analyzing', 'ready', 'not_food', 'failed')),
  dish_id      bigint references juicy.dishes (id),
  dish_name    text,
  cuisine      text,
  ingredients  text[] not null default '{}',
  method       text,
  textures     text[] not null default '{}',
  confidence   real,
  juicy_score  smallint,
  verdict      text,
  tips         jsonb not null default '[]',
  rating       text check (rating in ('loved', 'fine', 'not_for_me')),
  created_at   timestamptz not null default now()
);
create index meals_user_idx on juicy.meals (user_id, created_at desc);
create index meals_dish_idx on juicy.meals (dish_id);

create table juicy.meal_flavors (
  meal_id  uuid primary key references juicy.meals (id) on delete cascade,
  flavor   extensions.vector(7) not null,
  adjusted boolean not null default false      -- true once the user overrides a score
);

create table juicy.taste_profiles (
  user_id    uuid primary key references juicy.profiles (id) on delete cascade,
  flavor     extensions.vector(7),             -- preference vector, used for "taste match"
  meal_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Posts ─────────────────────────
create table juicy.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references juicy.profiles (id) on delete cascade,
  meal_id       uuid not null unique references juicy.meals (id) on delete cascade,
  kind          text not null check (kind in ('eat', 'drink')),
  photo_path    text not null,
  note          text check (char_length(note) <= 80),
  place_id      text,
  place_name    text check (char_length(place_name) <= 80),
  lat           double precision,              -- rounded to ~100 m before storing
  lng           double precision,
  cuisine       text,
  save_count    integer not null default 0,
  comment_count integer not null default 0,
  share_count   integer not null default 0,
  hot           real not null default 0.3536,  -- = 1 / 2^1.5, a brand-new post; refreshed every 5 min by cron
  created_at    timestamptz not null default now()
);
create index posts_author_idx  on juicy.posts (author_id, created_at desc, id);
create index posts_table_idx   on juicy.posts (cuisine, hot desc);
create index posts_recent_idx  on juicy.posts (created_at desc);
create index posts_photo_idx   on juicy.posts (photo_path);

create table juicy.post_audiences (
  post_id  uuid not null references juicy.posts (id) on delete cascade,
  audience text not null check (audience in ('plate', 'table', 'chef')),
  primary key (post_id, audience)
);
create index post_audiences_aud_idx on juicy.post_audiences (audience, post_id);

-- ───────────────────────── Engagement ─────────────────────────
create table juicy.saves (
  user_id    uuid not null references juicy.profiles (id) on delete cascade,
  post_id    uuid not null references juicy.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index saves_post_idx on juicy.saves (post_id);

create table juicy.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references juicy.posts (id) on delete cascade,
  author_id  uuid not null references juicy.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_idx on juicy.comments (post_id, created_at);
create index comments_author_idx on juicy.comments (author_id);

-- "Eat with" shares
create table juicy.eat_invites (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references juicy.posts (id) on delete cascade,
  from_id    uuid not null references juicy.profiles (id) on delete cascade,
  to_id      uuid not null references juicy.profiles (id) on delete cascade,
  seen_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, from_id, to_id)
);
create index eat_invites_to_idx on juicy.eat_invites (to_id, created_at desc);
create index eat_invites_from_idx on juicy.eat_invites (from_id);

-- Append-only interaction log for ranking and analytics.
create table juicy.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references juicy.profiles (id) on delete set null,
  post_id    uuid references juicy.posts (id) on delete cascade,
  type       text not null check (type in ('view', 'monocle', 'save', 'comment', 'share')),
  created_at timestamptz not null default now()
);
create index events_recent_idx on juicy.events (created_at);
create index events_post_idx on juicy.events (post_id);
create index events_user_idx on juicy.events (user_id);

-- ───────────────────────── Visibility helpers ─────────────────────────
-- security definer so RLS policies can call them without recursing into each other.
create function juicy.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from juicy.friendships f
    where f.user_a = least(a, b) and f.user_b = greatest(a, b) and f.status = 'accepted'
  )
$$;

create function juicy.can_see_post(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from juicy.posts p
    join juicy.post_audiences pa on pa.post_id = p.id
    where p.id = p_post
      and (
        p.author_id = (select auth.uid())
        or pa.audience = 'table'
        or (pa.audience = 'plate' and juicy.are_friends((select auth.uid()), p.author_id))
        or (pa.audience = 'chef'  and exists (
              select 1 from juicy.follows fo
              where fo.follower_id = (select auth.uid()) and fo.chef_id = p.author_id))
      )
  )
$$;

-- ───────────────────────── Row-level security ─────────────────────────
alter table juicy.profiles       enable row level security;
alter table juicy.friendships    enable row level security;
alter table juicy.follows        enable row level security;
alter table juicy.dishes         enable row level security;
alter table juicy.dish_aliases   enable row level security;
alter table juicy.meals          enable row level security;
alter table juicy.meal_flavors   enable row level security;
alter table juicy.taste_profiles enable row level security;
alter table juicy.posts          enable row level security;
alter table juicy.post_audiences enable row level security;
alter table juicy.saves          enable row level security;
alter table juicy.comments       enable row level security;
alter table juicy.eat_invites    enable row level security;
alter table juicy.events         enable row level security;

create policy "profiles are public" on juicy.profiles
  for select to authenticated using (true);
create policy "edit own profile" on juicy.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "see own friendships" on juicy.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "request friendship" on juicy.friendships
  for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending' and (select auth.uid()) in (user_a, user_b));
create policy "accept friendship" on juicy.friendships
  for update to authenticated
  using ((select auth.uid()) in (user_a, user_b) and requested_by <> (select auth.uid()))
  with check (status = 'accepted');
create policy "remove friendship" on juicy.friendships
  for delete to authenticated using ((select auth.uid()) in (user_a, user_b));

create policy "follows are public" on juicy.follows
  for select to authenticated using (true);
create policy "follow" on juicy.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "unfollow" on juicy.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

create policy "dish catalog is readable" on juicy.dishes
  for select to authenticated using (true);
-- dish_aliases: no client policies; only the edge function (service role) reads/writes.

create policy "own meals" on juicy.meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own meal flavors" on juicy.meal_flavors
  for select to authenticated using (exists (
    select 1 from juicy.meals m where m.id = meal_id and m.user_id = (select auth.uid())));
create policy "own taste profile" on juicy.taste_profiles
  for select to authenticated using (user_id = (select auth.uid()));

create policy "visible posts" on juicy.posts
  for select to authenticated using (juicy.can_see_post(id));
create policy "delete own posts" on juicy.posts
  for delete to authenticated using (author_id = (select auth.uid()));
create policy "visible audiences" on juicy.post_audiences
  for select to authenticated using (juicy.can_see_post(post_id));

create policy "own saves" on juicy.saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "save visible posts" on juicy.saves
  for insert to authenticated with check (user_id = (select auth.uid()) and juicy.can_see_post(post_id));
create policy "unsave" on juicy.saves
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "comments on visible posts" on juicy.comments
  for select to authenticated using (juicy.can_see_post(post_id));
create policy "comment on visible posts" on juicy.comments
  for insert to authenticated with check (author_id = (select auth.uid()) and juicy.can_see_post(post_id));
create policy "delete own comments" on juicy.comments
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "see own invites" on juicy.eat_invites
  for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy "invite friends to eat" on juicy.eat_invites
  for insert to authenticated
  with check (from_id = (select auth.uid()) and juicy.are_friends(from_id, to_id) and juicy.can_see_post(post_id));
create policy "mark invite seen" on juicy.eat_invites
  for update to authenticated using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()));

create policy "log own events" on juicy.events
  for insert to authenticated with check (user_id = (select auth.uid()) and juicy.can_see_post(post_id));

-- ───────────────────────── Counters (kept current by triggers) ─────────────────────────
create function juicy.bump_post_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d int := case when tg_op = 'INSERT' then 1 else -1 end;
  r record;
  ev text;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  if tg_table_name = 'saves' then
    update juicy.posts set save_count = greatest(save_count + d, 0) where id = r.post_id; ev := 'save';
  elsif tg_table_name = 'comments' then
    update juicy.posts set comment_count = greatest(comment_count + d, 0) where id = r.post_id; ev := 'comment';
  elsif tg_table_name = 'eat_invites' then
    update juicy.posts set share_count = greatest(share_count + d, 0) where id = r.post_id; ev := 'share';
  end if;
  if tg_op = 'INSERT' then
    insert into juicy.events (user_id, post_id, type)
    values ((select auth.uid()), r.post_id, ev);
  end if;
  return null;
end $$;

create trigger saves_count     after insert or delete on juicy.saves       for each row execute function juicy.bump_post_counter();
create trigger comments_count  after insert or delete on juicy.comments    for each row execute function juicy.bump_post_counter();
create trigger invites_count   after insert or delete on juicy.eat_invites for each row execute function juicy.bump_post_counter();

revoke execute on function juicy.handle_new_user, juicy.bump_post_counter from public, anon, authenticated;

-- ───────────────────────── Storage ─────────────────────────
-- Private bucket; files live at {user_id}/{uuid}.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meals', 'meals', false, 5242880, array['image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "juicy: upload own meal photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meals' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "juicy: read own or visible meal photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meals' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from juicy.posts p where p.photo_path = name and juicy.can_see_post(p.id))
    )
  );

create policy "juicy: delete own meal photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meals' and (storage.foldername(name))[1] = (select auth.uid())::text);
