-- Public pages (after sign-out) SELECT oc_personnel.
-- RLS calls private.is_command_dev(), which anon could not execute.

grant usage on schema private to anon, authenticated;

grant execute on function private.is_command_dev() to anon, authenticated;
grant execute on function private.is_command_admin() to anon, authenticated;
grant execute on function private.active_personnel_id() to anon, authenticated;
grant execute on function private.owns_personnel(uuid) to anon, authenticated;
grant execute on function private.is_self_id(uuid) to anon, authenticated;
grant execute on function private.is_unit_leader() to anon, authenticated;
grant execute on function private.is_unit_head(uuid) to anon, authenticated;
grant execute on function private.can_manage_unit(uuid) to anon, authenticated;
grant execute on function private.can_plan_operations() to anon, authenticated;
grant execute on function private.can_edit_operation(uuid) to anon, authenticated;
grant execute on function private.can_access_doc_folder(text) to anon, authenticated;
