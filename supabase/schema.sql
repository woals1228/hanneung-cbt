-- 한국사 CBT 수요 시험 기록. Supabase SQL Editor에서 한 번 실행해요.
-- 표는 아무도 직접 읽거나 쓸 수 없고, log_event 함수로만 한 줄씩 넣을 수 있어요.

create table if not exists public.events (
  anon_id uuid not null,
  day date not null,
  kind text not null check (kind in (
    'visit', 'standalone', 'answer', 'explain_open', 'more', 'anniv', 'outlink', 'video_open',
    'eve_start', 'eve_submit', 'fav', 'push_sub', 'push_open',
    'survey_next_yes', 'survey_next_no', 'survey_cbt_yes', 'survey_cbt_no'
  )),
  platform text not null check (platform in ('android', 'ios', 'inapp', 'other')),
  created_at timestamptz not null default now(),
  primary key (anon_id, day, kind)
);

alter table public.events enable row level security; -- 정책을 두지 않아서 직접 접근은 모두 막혀요.
revoke all on public.events from anon, authenticated;

-- 날짜는 폰이 아니라 서버가 한국 날짜로 정해요. 같은 사람·날짜·종류는 한 줄만 남아요.
create or replace function public.log_event(p_anon uuid, p_kind text, p_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.events (anon_id, day, kind, platform)
  values (p_anon, (now() at time zone 'Asia/Seoul')::date, p_kind, p_platform)
  on conflict do nothing;
$$;

revoke all on function public.log_event(uuid, text, text) from public;
grant execute on function public.log_event(uuid, text, text) to anon, authenticated;
