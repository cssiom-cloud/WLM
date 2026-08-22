-- Preferred command UI: vanilla HTML or the React (JSX) skin.

alter table public.user_settings
  add column if not exists ui_skin text not null default 'html';

alter table public.user_settings
  drop constraint if exists user_settings_ui_skin_check;

alter table public.user_settings
  add constraint user_settings_ui_skin_check
  check (ui_skin in ('html', 'jsx'));
