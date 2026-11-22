-- Profile detail columns: the app collects first name, last name, and country
-- at signup and writes them via UserProvider.updateProfile, but the columns
-- were missing from the profiles table. Every profile fetch that selected them
-- failed (42703), so tapping a leaderboard profile fell back to limited data.
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists country text not null default '';
