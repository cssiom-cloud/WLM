drop policy if exists support_tickets_delete on public.support_tickets;
create policy support_tickets_delete
  on public.support_tickets for delete to authenticated
  using (private.is_self_id(user_id) or private.is_command_admin());

grant delete on public.support_tickets to authenticated;
