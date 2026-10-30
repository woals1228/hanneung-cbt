-- 유입 채널 기록(10/30 결정). Supabase SQL Editor에서 한 번 실행해요. 여러 번 실행해도 괜찮아요.
-- 홍보 링크에 ?s=et 처럼 붙인 값을 첫 방문 때 기억해 두었다가 기록과 함께 보내요. 정해 둔 코드만 받아요.
alter table public.events add column if not exists src text;

drop function if exists public.log_event(uuid, text, text);
create or replace function public.log_event(p_anon uuid, p_kind text, p_platform text, p_src text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.events (anon_id, day, kind, platform, src)
  values (p_anon, (now() at time zone 'Asia/Seoul')::date, p_kind, p_platform,
          case when p_src in ('et', 'cafe', 'kakao', 'blog', 'orbi', 'insta', 'etc') then p_src end)
  on conflict do nothing;
$$;

revoke all on function public.log_event(uuid, text, text, text) from public;
grant execute on function public.log_event(uuid, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
