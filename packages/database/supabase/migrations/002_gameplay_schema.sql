-- WorldNest Online - Gameplay Schema
-- Adds the new-user provisioning trigger plus the tables that persist a shared
-- world: terrain modifications, structures, crops and chat.
-- Run this after 001_initial_schema.sql.

-- ---------------------------------------------------------------------------
-- New user provisioning
-- ---------------------------------------------------------------------------
-- Nothing ever created a profiles row, which made player_state's foreign key
-- unusable. Provision both rows from the auth.users insert instead, so a player
-- can save state on their very first session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1),
      'Player'
    )
  )
  on conflict (id) do nothing;

  insert into public.player_state (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Terrain modification overlay
-- ---------------------------------------------------------------------------
-- One row per changed tile. Terrain generation stays deterministic from the
-- world seed; this table is only the diff on top of it.
create table public.world_modifications (
  world_id uuid references public.worlds(id) on delete cascade not null,
  tile_x integer not null,
  tile_y integer not null,
  tile_type smallint not null,
  modified_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now() not null,
  primary key (world_id, tile_x, tile_y)
);

-- ---------------------------------------------------------------------------
-- Placed structures
-- ---------------------------------------------------------------------------
create table public.structures (
  id uuid default uuid_generate_v4() primary key,
  world_id uuid references public.worlds(id) on delete cascade not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  item_id text not null,
  tile_x integer not null,
  tile_y integer not null,
  created_at timestamptz default now() not null,
  unique (world_id, tile_x, tile_y)
);

-- ---------------------------------------------------------------------------
-- Planted crops
-- ---------------------------------------------------------------------------
-- item_id is the *seed* id; the produce comes from the client's crop catalogue.
-- planted_at_minute is in world-clock game minutes, so growth resumes correctly
-- across sessions.
create table public.crops (
  id uuid default uuid_generate_v4() primary key,
  world_id uuid references public.worlds(id) on delete cascade not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  item_id text not null,
  tile_x integer not null,
  tile_y integer not null,
  planted_at_minute integer not null,
  created_at timestamptz default now() not null,
  unique (world_id, tile_x, tile_y)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  world_id uuid references public.worlds(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  username text not null,
  body text not null,
  created_at timestamptz default now() not null
);

create index chat_messages_world_created_idx
  on public.chat_messages (world_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- The world is shared, so every authenticated player may read everything, but
-- may only write rows they own.
alter table public.world_modifications enable row level security;
alter table public.structures enable row level security;
alter table public.crops enable row level security;
alter table public.chat_messages enable row level security;

-- World modification policies
create policy "Authenticated users can view world modifications"
  on public.world_modifications for select
  to authenticated
  using (true);

create policy "Users can insert their own world modifications"
  on public.world_modifications for insert
  to authenticated
  with check (auth.uid() = modified_by);

create policy "Users can update their own world modifications"
  on public.world_modifications for update
  to authenticated
  using (auth.uid() = modified_by)
  with check (auth.uid() = modified_by);

create policy "Users can delete their own world modifications"
  on public.world_modifications for delete
  to authenticated
  using (auth.uid() = modified_by);

-- Structure policies
create policy "Authenticated users can view structures"
  on public.structures for select
  to authenticated
  using (true);

create policy "Users can insert their own structures"
  on public.structures for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update their own structures"
  on public.structures for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own structures"
  on public.structures for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Crop policies
create policy "Authenticated users can view crops"
  on public.crops for select
  to authenticated
  using (true);

create policy "Users can insert their own crops"
  on public.crops for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update their own crops"
  on public.crops for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own crops"
  on public.crops for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Chat policies (history is readable by everyone in the world, append-only)
create policy "Authenticated users can view chat messages"
  on public.chat_messages for select
  to authenticated
  using (true);

create policy "Users can send their own chat messages"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

create policy "Users can delete their own chat messages"
  on public.chat_messages for delete
  to authenticated
  using (auth.uid() = sender_id);
