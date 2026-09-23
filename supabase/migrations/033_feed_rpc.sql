-- get_feed(): one page of friends' activity in a single query.
--
-- The feed used to select activity ordered by created_at with RLS filtering
-- friends row by row — cost grew with ALL activity on the platform — then
-- fetched actor profiles in a second round-trip. This filters to the caller's
-- friends up front (served by activity_actor_created_idx) and joins profiles,
-- recipes and cookbooks in the same statement.
--
-- SECURITY INVOKER: the recipe/cookbook joins run under the caller's RLS, so a
-- private subject comes back null and the app drops that item, as before.
create or replace function get_feed(p_cursor timestamptz default null, p_limit int default 20)
returns table (
  id               uuid,
  type             text,
  created_at       timestamptz,
  actor_id         uuid,
  username         citext,
  display_name     text,
  avatar_url       text,
  recipe_id        uuid,
  recipe_name      text,
  recipe_image_url text,
  recipe_cuisine   text,
  cookbook_id      uuid,
  cookbook_name    text
)
language sql stable security invoker set search_path = public as $$
  select a.id, a.type, a.created_at, a.actor_id,
         p.username, p.display_name, p.avatar_url,
         r.id, r.name, r.image_url, r.cuisine,
         c.id, c.name
  from activity a
  left join public_profiles p on p.id = a.actor_id
  left join recipes   r on r.id = a.recipe_id
  left join cookbooks c on c.id = a.cookbook_id
  where a.actor_id in (select my_friend_ids())
    and (p_cursor is null or a.created_at < p_cursor)
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;
grant execute on function get_feed(timestamptz, int) to authenticated;

-- (An earlier revision of this file added a lower(username) prefix index; the
-- app's citext ilike filter can't use it, so it's dropped again.)
drop index if exists profiles_username_prefix_idx;
