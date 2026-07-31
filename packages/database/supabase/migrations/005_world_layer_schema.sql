-- WorldNest Online - World Layer Schema
-- Persists terrain changes on both deterministic world layers and reserves the
-- quest baseline used to count only structures placed after quest acceptance.
-- Run this after 004_authority_schema.sql.
--
-- This migration is RE-RUNNABLE. Existing terrain rows remain surface rows
-- because `layer` defaults to 0, and the primary-key replacement only runs when
-- the current key does not already contain the layer column.

alter table public.world_modifications
  add column if not exists layer smallint default 0 not null;

do $$
declare
  current_primary_key name;
begin
  select constraint_name into current_primary_key
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'world_modifications'
    and constraint_type = 'PRIMARY KEY';

  if not exists (
    select 1
    from information_schema.key_column_usage
    where table_schema = 'public'
      and table_name = 'world_modifications'
      and constraint_name = current_primary_key
      and column_name = 'layer'
  ) then
    execute format(
      'alter table public.world_modifications drop constraint %I',
      current_primary_key
    );
    alter table public.world_modifications
      add primary key (world_id, layer, tile_x, tile_y);
  end if;
end;
$$;

alter table public.player_quests
  add column if not exists baseline integer default 0 not null;

-- Progress and its objective baseline are both client-owned. Quest state stays
-- absent from these grants and can only be changed by the authority function.
grant insert (baseline) on public.player_quests to authenticated;
grant update (baseline) on public.player_quests to authenticated;
