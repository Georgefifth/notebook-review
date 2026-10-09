-- Supabase explicitly grants function EXECUTE to anon/authenticated by default.
-- Preserve function OIDs, policies, triggers and existing review data.
begin;
create schema if not exists review_private;
revoke all on schema review_private from public, anon, authenticated;
grant usage on schema review_private to authenticated;
do $migration$
begin
  if to_regprocedure('public.review_is_owner(uuid)') is not null then
    alter function public.review_is_owner(uuid) set schema review_private;
  end if;
  if to_regprocedure('public.review_can_access(uuid)') is not null then
    alter function public.review_can_access(uuid) set schema review_private;
  end if;
  if to_regprocedure('public.review_comment_guard()') is not null then
    alter function public.review_comment_guard() set schema review_private;
  end if;
  if to_regprocedure('public.review_project_guard()') is not null then
    alter function public.review_project_guard() set schema review_private;
  end if;
end;
$migration$;
revoke all on function review_private.review_is_owner(uuid), review_private.review_can_access(uuid), review_private.review_comment_guard(), review_private.review_project_guard() from public, anon, authenticated;
grant execute on function review_private.review_is_owner(uuid), review_private.review_can_access(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
