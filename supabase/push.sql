-- 매일 알림 구독. Supabase SQL Editor에서 한 번 실행해요(여러 번 실행해도 괜찮아요).
-- 표는 아무도 직접 읽거나 쓸 수 없고, 앱은 save_push·delete_push 함수로만 써요.
-- 보내기는 GitHub Actions(.github/workflows/push.yml)가 secret 키로 해요.
create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  hour int not null check (hour between 0 and 23),
  last_sent date,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

-- 고른 시각이 오늘 이미 지났으면 last_sent를 오늘로 둬서, 구독하자마자 알림이 가지 않게 해요.
create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_hour int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subs (endpoint, p256dh, auth, hour, last_sent)
  values (p_endpoint, p_p256dh, p_auth, p_hour,
          case when p_hour <= extract(hour from now() at time zone 'Asia/Seoul') then (now() at time zone 'Asia/Seoul')::date end)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, hour = excluded.hour, last_sent = excluded.last_sent;
$$;

create or replace function public.delete_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subs where endpoint = p_endpoint;
$$;

revoke all on function public.save_push(text, text, text, int) from public;
revoke all on function public.delete_push(text) from public;
grant execute on function public.save_push(text, text, text, int) to anon, authenticated;
grant execute on function public.delete_push(text) to anon, authenticated;
notify pgrst, 'reload schema';
