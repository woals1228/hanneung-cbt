-- 풀이 기록과 문항별 전체 정답률(10/31 결정). Supabase SQL Editor에서 한 번 실행해요. 여러 번 실행해도 괜찮아요.
-- 앱은 채점할 때 익명 ID·문항·고른 보기·맞음·시대·분야만 보내요. 이름·연락처는 받지 않아요.
create table if not exists public.answers (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  qid text not null,
  pick smallint not null,           -- 0 = 안 풂
  ok boolean not null,
  viewed boolean not null default false, -- 해설을 보고 푼 문제(정답률에서 빼요)
  mode text,
  era text,
  field text,
  at timestamptz not null default now()
);
create index if not exists answers_qid on public.answers (qid);
create index if not exists answers_anon on public.answers (anon_id);
alter table public.answers enable row level security; -- 정책 없음: 아래 함수로만 쓰고 읽어요.

-- 한 번에 60문항까지 받아요(모의고사 50문항 + 여유).
create or replace function public.log_answers(p_anon uuid, p_mode text, p_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.answers (anon_id, qid, pick, ok, viewed, mode, era, field)
  select p_anon, left(r.qid, 20), r.pick, r.ok, coalesce(r.viewed, false), left(p_mode, 10), left(r.era, 10), left(r.field, 10)
  from jsonb_to_recordset(case when jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) <= 60 then p_rows else '[]'::jsonb end)
    as r(qid text, pick smallint, ok boolean, viewed boolean, era text, field text)
  where r.qid is not null and r.pick between 0 and 5 and r.ok is not null;
$$;

-- 문항 하나의 전체 정답률: 해설을 보지 않고 푼 기록만, 사람마다 처음 푼 것만 세요. 20명 미만이면 n=0.
create or replace function public.question_stats(p_qid text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with firsts as (
    select distinct on (anon_id) pick, ok
    from public.answers
    where qid = p_qid and not viewed
    order by anon_id, at
  ), agg as (
    select count(*) as n, count(*) filter (where ok) as ok,
           json_build_array(count(*) filter (where pick = 1), count(*) filter (where pick = 2), count(*) filter (where pick = 3),
                            count(*) filter (where pick = 4), count(*) filter (where pick = 5)) as picks
    from firsts
  )
  select case when n >= 20 then json_build_object('n', n, 'ok', ok, 'picks', picks) else json_build_object('n', 0) end from agg;
$$;

-- 운영용(대시보드에서 직접 실행): 전체 사용자가 많이 틀리는 시대·분야
-- select era, field, count(*) n, round(avg(ok::int) * 100) rate from answers where not viewed group by 1, 2 having count(*) >= 30 order by rate;

revoke all on function public.log_answers(uuid, text, jsonb) from public;
revoke all on function public.question_stats(text) from public;
grant execute on function public.log_answers(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.question_stats(text) to anon, authenticated;
notify pgrst, 'reload schema';
