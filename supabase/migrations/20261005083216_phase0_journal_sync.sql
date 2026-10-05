-- Phase-0 feasibility bridge: one snapshot per user, not the phase-1 record/outbox schema.
create table public.user_journals (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially immediate,
  journal jsonb not null,
  version integer not null default 1 check (version > 0),
  last_request_id uuid not null,
  updated_at timestamptz not null default now(),
  constraint journal_shape check (coalesce(
    jsonb_typeof(journal) = 'object'
    and journal ->> 'schemaVersion' = '1'
    and journal ->> 'theme' in ('paper', 'forest', 'dusk')
    and jsonb_typeof(journal -> 'moments') = 'array'
    and jsonb_typeof(journal -> 'goals') = 'array'
    and jsonb_typeof(journal -> 'funds') = 'array', false)),
  constraint journal_size check (octet_length(journal::text) <= 1048576),
  constraint journal_record_count check (
    case when jsonb_typeof(journal -> 'moments') = 'array' then jsonb_array_length(journal -> 'moments') <= 2000 else false end
    and case when jsonb_typeof(journal -> 'goals') = 'array' then jsonb_array_length(journal -> 'goals') <= 2000 else false end
    and case when jsonb_typeof(journal -> 'funds') = 'array' then jsonb_array_length(journal -> 'funds') <= 2000 else false end)
);

alter table public.user_journals enable row level security;
revoke all on table public.user_journals from public, anon, authenticated;
grant select on table public.user_journals to authenticated;
grant insert (user_id, journal, last_request_id) on public.user_journals to authenticated;
grant update (journal, last_request_id) on public.user_journals to authenticated;

create policy journal_owner_select on public.user_journals for select to authenticated
  using (user_id = (select auth.uid()));
create policy journal_owner_insert on public.user_journals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy journal_owner_update on public.user_journals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Require the invoker RPC's transaction-local version check even for direct REST writes.
-- The function has no elevated privileges and cannot bypass the owner's RLS policies.
create function public.guard_journal_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  expected text := current_setting('hawtend.expected_version', true);
begin
  if expected is null or expected = '' then
    raise exception 'Write through save_journal.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if expected::integer <> 0 then
      raise exception 'Initial journal version must be zero.' using errcode = '40001';
    end if;
    new.version := 1;
  else
    if expected::integer <> old.version then
      raise exception 'Journal version conflict.' using errcode = '40001';
    end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke execute on function public.guard_journal_write() from public, anon, authenticated;
create trigger guard_journal_write before insert or update on public.user_journals
  for each row execute function public.guard_journal_write();

create function public.save_journal(p_journal jsonb, p_expected_version integer, p_request_id uuid)
returns table (status text, version integer, journal jsonb, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := (select auth.uid());
  current_row public.user_journals%rowtype;
begin
  if owner_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if p_expected_version is null or p_expected_version < 0 or p_request_id is null or p_journal is null then
    raise exception 'Invalid save parameters.' using errcode = '22023';
  end if;

  select j.* into current_row from public.user_journals j where j.user_id = owner_id for update;
  if not found then
    if p_expected_version <> 0 then
      return query select 'conflict'::text, 0, null::jsonb, null::timestamptz;
      return;
    end if;
    perform set_config('hawtend.expected_version', '0', true);
    insert into public.user_journals (user_id, journal, last_request_id)
      values (owner_id, p_journal, p_request_id) on conflict (user_id) do nothing;
    -- A concurrent first upload may have inserted while this transaction waited.
    select j.* into current_row from public.user_journals j where j.user_id = owner_id for update;
  end if;

  if current_row.last_request_id = p_request_id then
    if current_row.journal <> p_journal then
      raise exception 'Request ID reused with different content.' using errcode = '22023';
    end if;
    return query select 'saved'::text, current_row.version, current_row.journal, current_row.updated_at;
    return;
  end if;
  if current_row.version <> p_expected_version then
    return query select 'conflict'::text, current_row.version, current_row.journal, current_row.updated_at;
    return;
  end if;

  perform set_config('hawtend.expected_version', p_expected_version::text, true);
  update public.user_journals j set journal = p_journal, last_request_id = p_request_id
    where j.user_id = owner_id and j.version = p_expected_version returning j.* into current_row;
  return query select 'saved'::text, current_row.version, current_row.journal, current_row.updated_at;
end;
$$;
revoke execute on function public.save_journal(jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.save_journal(jsonb, integer, uuid) to authenticated;

comment on table public.user_journals is 'Phase-0 private snapshot bridge. Replace with per-record sync in phase 1.';
comment on function public.save_journal(jsonb, integer, uuid) is 'Owner-only optimistic save; reuse a request ID only with identical content.';
