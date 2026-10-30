// Supabase 프로젝트 주소와 publishable 키(sb_publishable_…, 공개돼도 되는 키)를 넣어요.
// 비어 있으면 기록을 보내지 않아요. secret 키는 절대 여기에 넣지 마세요.
export const SUPABASE_URL = 'https://renfrrvnnfxizqvkpngy.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_jUQSxxux_navnAvTfIl4ZQ_K0afEkPY';

// 기출(57~80회) 화면을 보여 줄지. 국사편찬위원회가 중단을 요청하면 false로 바꾸고 data/past*도 지워요.
export const SHOW_PAST = true;

// 매일 알림용 VAPID 공개 키(공개돼도 되는 키). 비어 있으면 알림 켜기가 안 보여요.
// 개인 키는 절대 여기에 넣지 말고 GitHub Secrets(VAPID_PRIVATE_KEY)에만 넣어요.
export const VAPID_PUBLIC_KEY = '';
