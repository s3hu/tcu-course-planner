create table if not exists public.course_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id text not null,
  state jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, dataset_id),
  constraint plan_state_object check (jsonb_typeof(state) = 'object'),
  constraint plan_dataset_matches check (state->>'datasetId' = dataset_id),
  constraint plan_size check (octet_length(state::text) <= 262144)
);
alter table public.course_plans enable row level security;
revoke all on public.course_plans from anon;
grant select, insert, update, delete on public.course_plans to authenticated;
create policy "Read own plan" on public.course_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own plan" on public.course_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own plan" on public.course_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own plan" on public.course_plans for delete to authenticated using ((select auth.uid()) = user_id);
create function public.set_course_plan_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger course_plans_updated_at before update on public.course_plans for each row execute function public.set_course_plan_updated_at();
