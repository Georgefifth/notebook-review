-- Apply once to a NEW Supabase project in its SQL editor.
-- auth.uid(), auth.jwt(), auth.users and authenticated/anon roles are supplied by Supabase.
begin;
create table public.review_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 160),
  base_notebook jsonb not null check (jsonb_typeof(base_notebook) = 'object' and base_notebook->>'nbformat' = '4' and jsonb_typeof(base_notebook->'cells') = 'array' and octet_length(base_notebook::text) <= 6291456),
  snapshot_id text not null check (snapshot_id ~ '^[a-f0-9]{64}$'),
  revision_notebook jsonb check (revision_notebook is null or (jsonb_typeof(revision_notebook) = 'object' and revision_notebook->>'nbformat' = '4' and jsonb_typeof(revision_notebook->'cells') = 'array' and octet_length(revision_notebook::text) <= 6291456)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create table public.review_members (
  project_id uuid not null references public.review_projects(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  invited_at timestamptz not null default now(),
  primary key (project_id, email)
);
create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.review_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_email text not null default '',
  cell_key text not null check (char_length(cell_key) between 1 and 100),
  snapshot_id text not null,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create index review_members_email_idx on public.review_members(email);
create index review_comments_project_idx on public.review_comments(project_id, created_at);
create function public.review_is_owner(pid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.review_projects p where p.id = pid and p.owner_id = auth.uid()); $$;
create function public.review_can_access(pid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.review_projects p where p.id = pid and (p.owner_id = auth.uid() or exists(select 1 from public.review_members m where m.project_id = p.id and m.email = lower(auth.jwt()->>'email')))); $$;
revoke all on function public.review_is_owner(uuid), public.review_can_access(uuid) from public;
grant execute on function public.review_is_owner(uuid), public.review_can_access(uuid) to authenticated;
alter table public.review_projects enable row level security;
alter table public.review_members enable row level security;
alter table public.review_comments enable row level security;
create policy projects_read on public.review_projects for select to authenticated using (public.review_can_access(id));
create policy projects_create on public.review_projects for insert to authenticated with check (owner_id = auth.uid());
create policy projects_update on public.review_projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete on public.review_projects for delete to authenticated using (owner_id = auth.uid());
create policy members_read on public.review_members for select to authenticated using (public.review_is_owner(project_id) or email = lower(auth.jwt()->>'email'));
create policy members_create on public.review_members for insert to authenticated with check (public.review_is_owner(project_id));
create policy members_delete on public.review_members for delete to authenticated using (public.review_is_owner(project_id));
create policy comments_read on public.review_comments for select to authenticated using (public.review_can_access(project_id));
create policy comments_create on public.review_comments for insert to authenticated with check (public.review_can_access(project_id) and author_id = auth.uid());
create policy comments_update on public.review_comments for update to authenticated using (public.review_can_access(project_id) and (author_id = auth.uid() or public.review_is_owner(project_id))) with check (public.review_can_access(project_id) and (author_id = auth.uid() or public.review_is_owner(project_id)));
revoke all on public.review_projects, public.review_members, public.review_comments from anon, authenticated;
grant select, insert, update, delete on public.review_projects to authenticated;
grant select, insert, delete on public.review_members to authenticated;
grant select, insert, update on public.review_comments to authenticated;
create function public.review_project_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id or new.base_notebook is distinct from old.base_notebook or new.snapshot_id is distinct from old.snapshot_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Review base and ownership are immutable. Start a new review round.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end; $$;
create trigger review_project_guard before update on public.review_projects for each row execute function public.review_project_guard();
create function public.review_comment_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.review_projects; anchor_found boolean;
begin
  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid() then raise exception 'Invalid author'; end if;
    new.author_email := lower(auth.jwt()->>'email');
    new.resolved := false;
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
  select exists(
    select 1 from jsonb_array_elements(p.base_notebook->'cells') with ordinality as c(value, n)
    where case when jsonb_typeof(c.value->'id') = 'string' then 'id:' || (c.value->>'id') else 'legacy:' || (c.n - 1)::text end = new.cell_key
  ) into anchor_found;
  if not anchor_found then raise exception 'Unknown notebook cell'; end if;
  return new;
end; $$;
create trigger review_comment_guard before insert or update on public.review_comments for each row execute function public.review_comment_guard();
revoke all on function public.review_project_guard(), public.review_comment_guard() from public;
commit;
