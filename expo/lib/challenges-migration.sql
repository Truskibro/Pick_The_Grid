-- ============================================================
-- CHALLENGES: head-to-head invites between league rivals
--
-- A challenge is an invite. The challenger picks a rival they
-- share a league with; the rival accepts or declines. Only an
-- accepted challenge unlocks the head-to-head screen.
-- ============================================================

create table if not exists challenges (
  id uuid default gen_random_uuid() primary key,
  challenger_id uuid not null references profiles(id) on delete cascade,
  challenged_id uuid not null references profiles(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  series_id text not null default 'f1',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (challenger_id <> challenged_id)
);

alter table challenges enable row level security;

drop policy if exists "challenges_select" on challenges;
create policy "challenges_select" on challenges for select
  using (auth.uid() = challenger_id or auth.uid() = challenged_id);

-- Only the challenger can send, and only to someone else.
drop policy if exists "challenges_insert" on challenges;
create policy "challenges_insert" on challenges for insert
  with check (auth.uid() = challenger_id and challenged_id <> auth.uid());

-- Only the challenged player can respond.
drop policy if exists "challenges_update" on challenges;
create policy "challenges_update" on challenges for update
  using (auth.uid() = challenged_id)
  with check (auth.uid() = challenged_id);

-- The challenger can withdraw a pending invite.
drop policy if exists "challenges_delete" on challenges;
create policy "challenges_delete" on challenges for delete
  using (auth.uid() = challenger_id);

create index if not exists challenges_challenged_idx on challenges (challenged_id, status);
create index if not exists challenges_challenger_idx on challenges (challenger_id, status);
create index if not exists challenges_series_idx on challenges (series_id);
