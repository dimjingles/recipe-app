alter table profiles
  add column if not exists primary_goals text[] default '{}';

update profiles
set primary_goals = array[primary_goal]
where primary_goal is not null
  and (primary_goals is null or cardinality(primary_goals) = 0);
