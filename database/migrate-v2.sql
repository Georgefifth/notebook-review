-- Existing installations only: additive migration; retains all feedback and RLS.
begin;
alter table public.review_comments add column if not exists reviewed_revision_version integer;
create or replace function public.review_comment_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.review_projects; anchor_found boolean;
begin
  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid() then raise exception 'Invalid author'; end if;
    new.author_email := lower(auth.jwt()->>'email');
    new.resolved := false;
    new.reviewed_revision_version := null;
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
  else
    if new.id is distinct from old.id or new.project_id is distinct from old.project_id or new.author_id is distinct from old.author_id or new.author_email is distinct from old.author_email or new.cell_key is distinct from old.cell_key or new.snapshot_id is distinct from old.snapshot_id or new.created_at is distinct from old.created_at then
      raise exception 'Comment identity and anchor are immutable';
    end if;
    if auth.uid() is distinct from old.author_id and new.body is distinct from old.body then raise exception 'Only the author can edit comment text'; end if;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  select * into p from public.review_projects where id = new.project_id;
  if p.id is null or new.snapshot_id is distinct from p.snapshot_id then raise exception 'Wrong review snapshot'; end if;
  if not new.resolved then new.reviewed_revision_version := null; end if;
  if tg_op = 'UPDATE' and new.reviewed_revision_version is distinct from old.reviewed_revision_version and new.reviewed_revision_version is not null then
    if p.revision_notebook is null or new.reviewed_revision_version is distinct from p.version then raise exception 'Only the current revision can be acknowledged'; end if;
  end if;
  select exists(
    select 1 from jsonb_array_elements(p.base_notebook->'cells') with ordinality as c(value, n)
    where case when jsonb_typeof(c.value->'id') = 'string' then 'id:' || (c.value->>'id') else 'legacy:' || (c.n - 1)::text end = new.cell_key
  ) into anchor_found;
  if not anchor_found then raise exception 'Unknown notebook cell'; end if;
  return new;
end; $$;
revoke all on function public.review_comment_guard() from public;
commit;
