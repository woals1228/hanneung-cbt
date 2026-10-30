-- 81회 수요 시험 판단 지표 (12월 초 SQL Editor에서 실행)
-- 대상: 앱 안 브라우저를 뺀 기록 중, 첫 방문이 11/3~11/21이고 문제를 1번 이상 채점한 사람
-- 재방문: 첫 방문 다음 날부터 7일 안에, 서로 다른 날 3일 이상 채점한 사람
-- 기준(대상 100명 이상일 때): 15% 이상 계속 / 5~15% 종료 설문 보고 판단 / 5% 미만 중단
with ev as (
  select * from public.events where platform <> 'inapp'
), firsts as (
  select anon_id, min(day) as first_day from ev where kind = 'visit' group by anon_id
), cohort as (
  select f.* from firsts f
  where f.first_day between date '2026-11-03' and date '2026-11-21'
    and exists (select 1 from ev a where a.anon_id = f.anon_id and a.kind = 'answer')
), returns as (
  select c.anon_id, count(distinct a.day) as return_days
  from cohort c
  left join ev a on a.anon_id = c.anon_id and a.kind = 'answer'
    and a.day between c.first_day + 1 and c.first_day + 7
  group by c.anon_id
)
select
  count(*) as cohort,
  count(*) filter (where return_days >= 3) as retained,
  round(100.0 * count(*) filter (where return_days >= 3) / nullif(count(*), 0), 1) as retained_pct
from returns;
