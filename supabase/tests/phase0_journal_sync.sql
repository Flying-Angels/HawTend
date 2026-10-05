-- Run only through an authorized SQL connection. All synthetic records are rolled back.
-- These simulate authenticated DB roles; they do not test OAuth or real JWT issuance.
begin;
set constraints all deferred;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd296293f-8664-42fa-a464-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d296293f-8664-42fa-a464-000000000001","role":"authenticated"}', true);

do $$
declare
  original jsonb := '{"schemaVersion":1,"theme":"paper","moments":[],"goals":[],"funds":[]}';
  changed jsonb := '{"schemaVersion":1,"theme":"forest","moments":[],"goals":[],"funds":[]}';
  first_id uuid := '61000500-0000-4000-8000-000000000001';
  second_id uuid := '61000500-0000-4000-8000-000000000002';
  stale_id uuid := '61000500-0000-4000-8000-000000000003';
  first_time timestamptz;
  result record;
begin
  select * into result from public.save_journal(original, 0, first_id);
  if result.status <> 'saved' or result.version <> 1 or result.journal <> original then raise exception 'Initial save failed'; end if;
  first_time := result.updated_at;
  select * into result from public.save_journal(original, 0, first_id);
  if result.version <> 1 or result.updated_at <> first_time then raise exception 'Retry created another revision'; end if;
  if (select count(*) from public.user_journals) <> 1 then raise exception 'Owner cannot see exactly one snapshot'; end if;

  select * into result from public.save_journal(changed, 1, second_id);
  if result.status <> 'saved' or result.version <> 2 or result.journal <> changed then raise exception 'Update failed'; end if;
  select * into result from public.save_journal(original, 1, stale_id);
  if result.status <> 'conflict' or result.version <> 2 or result.journal <> changed then raise exception 'Stale version overwrote current data'; end if;
  select * into result from public.save_journal(original, 0, first_id);
  if result.status <> 'conflict' or result.version <> 2 then raise exception 'Old retry overwrote a later save'; end if;

  begin
    perform public.save_journal(original, 2, second_id);
    raise exception 'Reused operation ID accepted different content';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_journal(original, -1, stale_id);
    raise exception 'Negative revision accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_journal('{}', 2, stale_id);
    raise exception 'Missing payload keys accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_journal(jsonb_set(original, '{moments}', jsonb_build_array(repeat('x', 1048576))), 2, stale_id);
    raise exception 'Oversize snapshot accepted';
  exception when check_violation then null; end;
  begin
    update public.user_journals set version = 99;
    raise exception 'Client can change server revision';
  exception when insufficient_privilege then null; end;
  perform set_config('hawtend.expected_version', '', true);
  begin
    update public.user_journals set journal = original;
    raise exception 'Direct write bypassed compare-and-save';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', 'd296293f-8664-42fa-a464-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"d296293f-8664-42fa-a464-000000000002","role":"authenticated"}', true);
do $$
declare
  payload jsonb := '{"schemaVersion":1,"theme":"dusk","moments":[],"goals":[],"funds":[]}';
  result record;
  affected integer;
begin
  if (select count(*) from public.user_journals) <> 0 then raise exception 'Another user can read the first owner'; end if;
  update public.user_journals set journal = payload where user_id = 'd296293f-8664-42fa-a464-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user can update the first owner'; end if;
  perform set_config('hawtend.expected_version', '0', true);
  begin
    insert into public.user_journals (user_id, journal, last_request_id)
      values ('d296293f-8664-42fa-a464-000000000001', payload, '61000500-0000-4000-8000-000000000004');
    raise exception 'Another user can insert for the first owner';
  exception when insufficient_privilege then null; end;
  select * into result from public.save_journal(payload, 5, '61000500-0000-4000-8000-000000000005');
  if result.status <> 'conflict' or result.version <> 0 or result.journal is not null then raise exception 'Missing cloud snapshot conflict incorrect'; end if;
  select * into result from public.save_journal(payload, 0, '61000500-0000-4000-8000-000000000005');
  if result.status <> 'saved' or result.version <> 1 then raise exception 'Second owner cannot save own snapshot'; end if;
  if (select count(*) from public.user_journals) <> 1 then raise exception 'Snapshots are not isolated'; end if;
  begin
    delete from public.user_journals;
    raise exception 'Unversioned delete allowed';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if (select count(*) from public.user_journals) <> 0 then raise exception 'Missing user identity can read snapshots'; end if;
  begin
    perform public.save_journal('{}', 0, '61000500-0000-4000-8000-000000000006');
    raise exception 'Missing user identity can save';
  exception when invalid_authorization_specification then null; end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform journal from public.user_journals;
    raise exception 'Anonymous reads allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_journal('{}', 0, '61000500-0000-4000-8000-000000000007');
    raise exception 'Anonymous RPC execution allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'PASS: ownership, anonymous access, server revisions, idempotent retry, stale-write conflicts, payload limits; all fixtures rolled back.' as result;
