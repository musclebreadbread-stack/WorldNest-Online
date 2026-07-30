-- WorldNest Online - Initial Database Schema
-- Creates profiles, player_state, and worlds tables with RLS policies.

-- Enable Row Level Security
create extension if not exists "uuid-ossp";

-- Profiles table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar text default 'default',
  created_at timestamptz default now() not null
);

-- Player state table (stores last known position and inventory)
create table public.player_state (
  player_id uuid references public.profiles(id) on delete cascade primary key,
  x real default 0 not null,
  y real default 0 not null,
  chunk text default '0,0' not null,
  last_online timestamptz default now() not null,
  inventory jsonb default '{}' not null
);

-- Worlds table
create table public.worlds (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  seed integer not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.worlds enable row level security;

-- Profiles policies
create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Player state policies
create policy "Users can view their own player state"
  on public.player_state for select
  using (auth.uid() = player_id);

create policy "Users can update their own player state"
  on public.player_state for update
  using (auth.uid() = player_id);

create policy "Users can insert their own player state"
  on public.player_state for insert
  with check (auth.uid() = player_id);

-- Worlds policies (readable by all, writable only by authenticated users)
create policy "Anyone can view worlds"
  on public.worlds for select
  using (true);

create policy "Authenticated users can create worlds"
  on public.worlds for insert
  with check (auth.role() = 'authenticated');

-- Insert default world
insert into public.worlds (name, seed) values ('Default World', 42);
