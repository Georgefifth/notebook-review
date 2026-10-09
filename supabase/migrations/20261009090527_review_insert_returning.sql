-- INSERT ... RETURNING needs the SELECT policy to admit the newly inserted row.
-- A STABLE lookup helper sees the pre-statement snapshot, so check ownership
-- directly before the invitation lookup. Existing collaborator access is kept.
begin;
alter policy projects_read on public.review_projects using (owner_id = (select auth.uid()) or review_private.review_can_access(id));
notify pgrst, 'reload schema';
commit;
