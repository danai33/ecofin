-- =====================================================================
-- EcoFin — database
-- Each signed-in person keeps private documents (credit offers, accounting
-- months, monthly plan, jars, challenge, rewards, settings, AI access).
-- Row Level Security: a person can only read and change their own rows.
-- =====================================================================

-- new projects no longer grant table access automatically: every grant below is explicit
grant usage on schema public to authenticated, service_role;

-- ---------- private documents, one row per (person, document) ----------
create table if not exists public.user_docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint user_docs_key_ok  check (key ~ '^([0-9]{4}-[0-9]{2}|goals-[0-9]{4}|credite|plan|borcane|provocare|premii|joc|setari|ai-acces)$'),
  constraint user_docs_size_ok check (pg_column_size(data) <= 524288)
);

alter table public.user_docs enable row level security;

drop policy if exists user_docs_select_own on public.user_docs;
drop policy if exists user_docs_insert_own on public.user_docs;
drop policy if exists user_docs_update_own on public.user_docs;
drop policy if exists user_docs_delete_own on public.user_docs;
create policy user_docs_select_own on public.user_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy user_docs_insert_own on public.user_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_docs_update_own on public.user_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_docs_delete_own on public.user_docs for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_docs from anon;
grant select, insert, update, delete on public.user_docs to authenticated;

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_docs_touch on public.user_docs;
create trigger user_docs_touch before update on public.user_docs
for each row execute function public.touch_updated_at();

-- a person can't fill the database: at most 400 documents each (about 30 years of months)
create or replace function public.user_docs_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.user_docs where user_id = new.user_id) >= 400 then
    raise exception 'too_many_documents' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists user_docs_limit on public.user_docs;
create trigger user_docs_limit before insert on public.user_docs
for each row execute function public.user_docs_limit();

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.user_docs_limit()  from public, anon, authenticated;

-- ---------- AI assistant: requests, tokens and cost per person per day ----------
-- The server function reserves the most a request can cost before calling Claude and settles the
-- real cost afterwards, so neither one person nor the whole site can go past its daily budget.
create table if not exists public.ai_usage (
  user_id       uuid    not null references auth.users(id) on delete cascade,
  day           date    not null,
  requests      integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  cost_micros   bigint  not null default 0,   -- millionths of a US dollar
  primary key (user_id, day)
);
alter table public.ai_usage add column if not exists cost_micros bigint not null default 0;
create index if not exists ai_usage_day on public.ai_usage (day);

alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
-- no insert/update/delete policies: only the server function (service role) writes here
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;

drop function if exists public.ai_take(uuid);
drop function if exists public.ai_add_tokens(uuid, bigint, bigint);

-- before a request: checks today's limits and, if allowed, counts the request and reserves its
-- largest possible cost (atomic per person). Returns {ok, used, day} or {ok:false, code, reason, used}.
--   p_max          requests per person per day
--   p_reserve      the most this request can cost (micro-dollars)
--   p_user_budget  cost per person per day (0 = no cost limit)
--   p_site_budget  cost for the whole site per day (0 = no limit)
create or replace function public.ai_take(p_user uuid, p_max integer, p_reserve bigint, p_user_budget bigint, p_site_budget bigint)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d    date := (now() at time zone 'utc')::date;
  r    public.ai_usage;
  site bigint;
begin
  insert into public.ai_usage (user_id, day) values (p_user, d) on conflict (user_id, day) do nothing;
  select * into r from public.ai_usage where user_id = p_user and day = d for update;
  if r.requests >= p_max then
    return jsonb_build_object('ok', false, 'code', 'daily_limit', 'reason', 'requests', 'used', r.requests, 'day', d);
  end if;
  -- the first request of the day always fits, so one large (but allowed) request is never impossible
  if p_user_budget > 0 and r.requests > 0 and r.cost_micros + p_reserve > p_user_budget then
    return jsonb_build_object('ok', false, 'code', 'daily_limit', 'reason', 'budget', 'used', r.requests, 'day', d);
  end if;
  if p_site_budget > 0 then
    select coalesce(sum(cost_micros), 0) into site from public.ai_usage where day = d;
    if site + p_reserve > p_site_budget then
      return jsonb_build_object('ok', false, 'code', 'site_limit', 'used', r.requests, 'day', d);
    end if;
  end if;
  update public.ai_usage
     set requests = requests + 1, cost_micros = cost_micros + greatest(coalesce(p_reserve, 0), 0)
   where user_id = p_user and day = d;
  return jsonb_build_object('ok', true, 'used', r.requests + 1, 'day', d);
end $$;

-- after a request: replaces the reservation with the real tokens and cost. p_refund gives the
-- request back when Claude never answered (nothing was billed).
create or replace function public.ai_settle(p_user uuid, p_day date, p_in bigint, p_out bigint, p_cost bigint, p_reserved bigint, p_refund boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_usage
     set input_tokens  = input_tokens  + greatest(coalesce(p_in, 0), 0),
         output_tokens = output_tokens + greatest(coalesce(p_out, 0), 0),
         cost_micros   = greatest(cost_micros + greatest(coalesce(p_cost, 0), 0) - greatest(coalesce(p_reserved, 0), 0), 0),
         requests      = case when p_refund then greatest(requests - 1, 0) else requests end
   where user_id = p_user and day = p_day;
end $$;

revoke all on function public.ai_take(uuid, integer, bigint, bigint, bigint)                    from public, anon, authenticated;
revoke all on function public.ai_settle(uuid, date, bigint, bigint, bigint, bigint, boolean)  from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer, bigint, bigint, bigint)                   to service_role;
grant execute on function public.ai_settle(uuid, date, bigint, bigint, bigint, bigint, boolean) to service_role;

-- ---------- live sync between a person's devices ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_docs') then
    execute 'alter publication supabase_realtime add table public.user_docs';
  end if;
end $$;
