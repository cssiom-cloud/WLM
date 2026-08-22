-- Per-personnel display scale: auto (device) or one of five manual levels.

alter table public.user_settings
  add column if not exists ui_scale text not null default 'auto';

alter table public.user_settings
  drop constraint if exists user_settings_ui_scale_check;

alter table public.user_settings
  add constraint user_settings_ui_scale_check
  check (ui_scale in ('auto', '1', '2', '3', '4', '5'));
