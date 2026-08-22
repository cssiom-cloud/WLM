-- Per-personnel UI preferences so theme/language/effects do not leak across accounts.

alter table public.user_settings
  add column if not exists locale text not null default 'en',
  add column if not exists color_theme text not null default 'light',
  add column if not exists rain boolean not null default true,
  add column if not exists glass_visible boolean not null default true,
  add column if not exists glass_motion boolean not null default true,
  add column if not exists prefs_synced boolean not null default false;

alter table public.user_settings
  drop constraint if exists user_settings_locale_check;

alter table public.user_settings
  add constraint user_settings_locale_check
  check (locale in ('en', 'th'));

alter table public.user_settings
  drop constraint if exists user_settings_color_theme_check;

alter table public.user_settings
  add constraint user_settings_color_theme_check
  check (color_theme in ('light', 'dark'));
