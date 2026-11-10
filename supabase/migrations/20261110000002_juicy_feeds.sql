-- Juicy write path (create_post, rate_meal), feeds, ranking cron.

-- ───────────────────────── Dish matching (edge function only) ─────────────────────────
create function juicy.match_dish(p_embedding extensions.vector(768), p_min_similarity real default 0.86)
returns table (dish_id bigint, alias text, similarity real)
language sql stable security definer set search_path = '' as $$
  select a.dish_id, a.alias, (1 - (a.embedding operator(extensions.<=>) p_embedding))::real
  from juicy.dish_aliases a
  where 1 - (a.embedding operator(extensions.<=>) p_embedding) >= p_min_similarity
  order by a.embedding operator(extensions.<=>) p_embedding
  limit 1
$$;
revoke execute on function juicy.match_dish from public, anon, authenticated;
grant execute on function juicy.match_dish to service_role;

-- ───────────────────────── Post a meal ─────────────────────────
-- One transaction: post + audiences + bites/sips + eating/drinking status.
create function juicy.create_post(
  p_meal_id    uuid,
  p_audiences  text[],
  p_note       text default null,
  p_place_id   text default null,
  p_place_name text default null,
  p_lat        double precision default null,
  p_lng        double precision default null
) returns juicy.posts
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := (select auth.uid());
  m    juicy.meals;
  prof juicy.profiles;
  p    juicy.posts;
  aud  text[];
begin
  if uid is null then raise exception 'not signed in'; end if;

  select * into m from juicy.meals where id = p_meal_id and user_id = uid;
  if not found then raise exception 'meal not found'; end if;
  if m.status <> 'ready' then raise exception 'meal is still %', m.status; end if;

  select array_agg(distinct a) into aud
  from unnest(p_audiences) a where a in ('plate', 'table', 'chef');
  if aud is null then raise exception 'pick at least one place to share'; end if;

  insert into juicy.posts (author_id, meal_id, kind, photo_path, note, place_id, place_name, lat, lng, cuisine)
  values (uid, m.id, m.kind, m.photo_path, nullif(trim(p_note), ''), p_place_id, p_place_name,
          round(p_lat::numeric, 3)::double precision, round(p_lng::numeric, 3)::double precision,  -- ~100 m
          lower(m.cuisine))
  returning * into p;

  insert into juicy.post_audiences (post_id, audience)
  select p.id, a from unnest(aud) a;

  select * into prof from juicy.profiles where id = uid;
  update juicy.profiles set
    bites = bites + (m.kind = 'eat')::int,
    sips  = sips  + (m.kind = 'drink')::int,
    -- posting to Plate (friends) sets "eating"/"drinking" for 90 minutes
    status = case when 'plate' = any(aud) and prof.auto_status
                  then case m.kind when 'eat' then 'eating' else 'drinking' end else status end,
    status_icon = case when 'plate' = any(aud) and prof.auto_status
                  then case m.kind when 'eat' then 'silver_plate' else prof.drink_icon end else status_icon end,
    status_expires_at = case when 'plate' = any(aud) and prof.auto_status
                  then now() + interval '90 minutes' else status_expires_at end
  where id = uid;

  return p;
end $$;
revoke execute on function juicy.create_post from public, anon;
grant execute on function juicy.create_post to authenticated;

-- ───────────────────────── Rate a meal → taste profile ─────────────────────────
create function juicy.refresh_taste_profile(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  insert into juicy.taste_profiles (user_id, flavor, meal_count, updated_at)
  select p_user,
         coalesce(
           (select extensions.avg(mf.flavor) from juicy.meals m join juicy.meal_flavors mf on mf.meal_id = m.id
             where m.user_id = p_user and m.rating = 'loved' and m.created_at > now() - interval '180 days'),
           (select extensions.avg(mf.flavor) from juicy.meals m join juicy.meal_flavors mf on mf.meal_id = m.id
             where m.user_id = p_user and m.rating = 'fine')),
         (select count(*) from juicy.meals m where m.user_id = p_user and m.rating is not null),
         now()
  on conflict (user_id) do update
    set flavor = excluded.flavor, meal_count = excluded.meal_count, updated_at = excluded.updated_at;

  update juicy.profiles set juicy_score = coalesce((
    select round(avg(juicy_score))::smallint from juicy.meals
    where user_id = p_user and juicy_score is not null and created_at > now() - interval '30 days'), 0)
  where id = p_user;
$$;
revoke execute on function juicy.refresh_taste_profile from public, anon, authenticated;

create function juicy.rate_meal(p_meal_id uuid, p_rating text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if p_rating not in ('loved', 'fine', 'not_for_me') then raise exception 'bad rating'; end if;
  update juicy.meals set rating = p_rating where id = p_meal_id and user_id = uid;
  if not found then raise exception 'meal not found'; end if;
  perform juicy.refresh_taste_profile(uid);
end $$;
revoke execute on function juicy.rate_meal from public, anon;
grant execute on function juicy.rate_meal to authenticated;

-- ───────────────────────── Feeds ─────────────────────────
-- All three return the same row shape so the app renders one <PostCard>.
create type juicy.feed_post as (
  id               uuid,
  author_id        uuid,
  username         text,
  display_name     text,
  avatar_character text,
  author_status    text,          -- 'eating' | 'drinking' | null (already checked for expiry)
  kind             text,
  photo_path       text,
  note             text,
  place_name       text,
  cuisine          text,
  juicy_score      smallint,
  save_count       integer,
  comment_count    integer,
  share_count      integer,
  saved_by_me      boolean,
  created_at       timestamptz,
  rank             real           -- cursor value for the next page
);

-- Plate: you and your friends, newest first. Cursor = (created_at, id) of the last row.
create function juicy.feed_plate(
  p_before_time timestamptz default null, p_before_id uuid default null, p_limit int default 20
) returns setof juicy.feed_post
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  circle as (
    select uid as id from me
    union all
    select case when f.user_a = me.uid then f.user_b else f.user_a end
    from juicy.friendships f, me
    where f.status = 'accepted' and me.uid in (f.user_a, f.user_b)
  )
  select p.id, p.author_id, pr.username, pr.display_name, pr.avatar_character,
         case when pr.status_expires_at > now() then pr.status end,
         p.kind, p.photo_path, p.note, p.place_name, p.cuisine, m.juicy_score,
         p.save_count, p.comment_count, p.share_count,
         exists (select 1 from juicy.saves s, me where s.post_id = p.id and s.user_id = me.uid),
         p.created_at, extract(epoch from p.created_at)::real
  from juicy.posts p
  join circle c on c.id = p.author_id
  join juicy.post_audiences pa on pa.post_id = p.id and pa.audience = 'plate'
  join juicy.profiles pr on pr.id = p.author_id
  join juicy.meals m on m.id = p.meal_id
  where p_before_time is null or (p.created_at, p.id) < (p_before_time, p_before_id)
  order by p.created_at desc, p.id desc
  limit least(p_limit, 50)
$$;

-- Chef page: chefs you follow, newest first.
create function juicy.feed_chef(
  p_before_time timestamptz default null, p_before_id uuid default null, p_limit int default 20
) returns setof juicy.feed_post
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name, pr.avatar_character,
         case when pr.status_expires_at > now() then pr.status end,
         p.kind, p.photo_path, p.note, p.place_name, p.cuisine, m.juicy_score,
         p.save_count, p.comment_count, p.share_count,
         exists (select 1 from juicy.saves s where s.post_id = p.id and s.user_id = (select auth.uid())),
         p.created_at, extract(epoch from p.created_at)::real
  from juicy.follows fo
  join juicy.posts p on p.author_id = fo.chef_id
  join juicy.post_audiences pa on pa.post_id = p.id and pa.audience = 'chef'
  join juicy.profiles pr on pr.id = p.author_id
  join juicy.meals m on m.id = p.meal_id
  where fo.follower_id = (select auth.uid())
    and (p_before_time is null or (p.created_at, p.id) < (p_before_time, p_before_id))
  order by p.created_at desc, p.id desc
  limit least(p_limit, 50)
$$;

-- Table: everyone, optionally one cuisine. Two stages:
--   1. candidates: the 300 hottest posts from the last 7 days (index on cuisine, hot)
--   2. re-rank by hot × taste match (cosine similarity of the dish to what you love)
-- Cursor = (rank, id) of the last row.
create function juicy.feed_table(
  p_cuisine text default null, p_after_rank real default null, p_after_id uuid default null, p_limit int default 20
) returns setof juicy.feed_post
language sql stable security definer set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid,
           (select flavor from juicy.taste_profiles where user_id = (select auth.uid())) as taste
  ),
  candidates as (
    select p.*
    from juicy.posts p
    join juicy.post_audiences pa on pa.post_id = p.id and pa.audience = 'table'
    where p.created_at > now() - interval '7 days'
      and (p_cuisine is null or p.cuisine = lower(p_cuisine))
    order by p.hot desc
    limit 300
  ),
  ranked as (
    select c.*,
           (c.hot * (0.5 + coalesce(1 - (mf.flavor operator(extensions.<=>) me.taste), 0.5)))::real as rank
    from candidates c
    cross join me
    left join juicy.meal_flavors mf on mf.meal_id = c.meal_id
  )
  select r.id, r.author_id, pr.username, pr.display_name, pr.avatar_character,
         case when pr.status_expires_at > now() then pr.status end,
         r.kind, r.photo_path, r.note, r.place_name, r.cuisine, m.juicy_score,
         r.save_count, r.comment_count, r.share_count,
         exists (select 1 from juicy.saves s, me where s.post_id = r.id and s.user_id = me.uid),
         r.created_at, r.rank
  from ranked r
  join juicy.profiles pr on pr.id = r.author_id
  join juicy.meals m on m.id = r.meal_id
  where p_after_rank is null or (r.rank, r.id) < (p_after_rank, p_after_id)
  order by r.rank desc, r.id desc
  limit least(p_limit, 50)
$$;

revoke execute on function juicy.feed_plate, juicy.feed_chef, juicy.feed_table from public, anon;
grant execute on function juicy.feed_plate, juicy.feed_chef, juicy.feed_table to authenticated;

-- Monocle sheet: Juicy score, verdict and tips for one visible post.
create function juicy.post_juicy(p_post uuid)
returns table (juicy_score smallint, dish_name text, verdict text, tips jsonb)
language sql stable security definer set search_path = '' as $$
  select m.juicy_score, m.dish_name, m.verdict, m.tips
  from juicy.posts p join juicy.meals m on m.id = p.meal_id
  where p.id = p_post and juicy.can_see_post(p.id)
$$;
revoke execute on function juicy.post_juicy from public, anon;
grant execute on function juicy.post_juicy to authenticated;

-- ───────────────────────── Ranking job ─────────────────────────
create function juicy.refresh_hot_scores() returns void
language sql security definer set search_path = '' as $$
  update juicy.posts set hot = (
      (3 * save_count + 4 * share_count + 2 * comment_count + 1)
      / power(extract(epoch from now() - created_at) / 3600 + 2, 1.5)
    )::real
  where created_at > now() - interval '7 days';
  -- events older than 90 days aren't used for ranking
  delete from juicy.events where created_at < now() - interval '90 days';
$$;
revoke execute on function juicy.refresh_hot_scores from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('juicy-hot-scores', '*/5 * * * *', $$select juicy.refresh_hot_scores()$$);
