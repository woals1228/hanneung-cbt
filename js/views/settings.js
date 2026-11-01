// 설정: 앱 설치, 알림(2단계 예정), 테스트용 날짜, 문제 데이터, 기록 초기화
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, toDateStr, dateOverride, setDateOverride, addDays, formatLong, formatShort } from '../dates.js';
import { esc, installInfo, promptInstall, confirmModal, toast, refresh } from '../ui.js';
import { pushReady, savedHour, currentSubscription, subscribe, unsubscribe } from '../push.js';
import { track } from '../track.js';

const VERSION = '0.2.0';

// 매일 알림: 오늘의 문제·기념일·전야제 중 하나를 하루 한 번, 고른 시각에 보내요.
function pushIntroHTML() {
  return '<p class="muted small">알림 상태를 확인하는 중…</p>';
}

async function drawPush(box) {
  const { ios, standalone } = installInfo();
  if (!pushReady()) {
    box.innerHTML = '<b>매일 알림</b><p class="muted small">오늘의 문제·기념일·전야제 알림을 곧 켤 수 있어요.</p>';
    return;
  }
  if (ios && !standalone) {
    box.innerHTML = '<b>매일 알림</b><p class="muted small">아이폰은 <b>홈 화면에 추가</b>한 앱에서만 알림을 받을 수 있어요. 위 ‘앱 설치’를 먼저 해 주세요.</p>';
    return;
  }
  const on = Boolean(await currentSubscription().catch(() => null));
  const hour = savedHour();
  const hours = Array.from({ length: 17 }, (_, i) => i + 7);
  box.innerHTML = `<div class="setting-row">
      <div class="grow"><b>매일 알림 ${on ? '<span class="ok-text">켜짐</span>' : ''}</b>
        <p class="muted small">하루 한 번: 오늘의 문제, 기념일 퀴즈, 시험 전날 전야제</p></div>
    </div>
    <div class="row mt">
      <select id="push-hour" aria-label="알림 시각">${hours.map(h => `<option value="${h}" ${h === hour ? 'selected' : ''}>${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시</option>`).join('')}</select>
      <button type="button" class="btn btn-primary grow" data-push="on">${on ? '시각 바꾸기' : '알림 켜기'}</button>
      ${on ? '<button type="button" class="btn btn-ghost" data-push="off">끄기</button>' : ''}
    </div>`;
}

export function render(el) {
  const today = todayStr();
  const override = dateOverride();
  // 테스트용 날짜는 내 컴퓨터, ?debug, 이미 테스트 중일 때만 보여요(아무나 전야제를 미리 열지 않게).
  const DEV = Boolean(override) || location.hostname !== 'woals1228.github.io' || new URLSearchParams(location.search).has('debug');

  // 미리보기 버튼은 실제 오늘 날짜를 기준으로 만들어요.
  const realToday = toDateStr(new Date());
  const presets = [];
  const exam = data.nextExam(realToday);
  if (exam) presets.push({ label: `제${exam.round}회 시험 전날`, date: addDays(exam.date, -1) });
  const soon = data.upcomingAnniversaries(realToday, 1)[0];
  if (soon) {
    presets.push({ label: `${soon.name} 당일`, date: soon.on });
    presets.push({ label: `${soon.name} 3일 전`, date: addDays(soon.on, -3) });
  }
  presets.push({ label: '개천절', date: `${realToday.slice(0, 4)}-10-03` });

  el.innerHTML = `
    <header class="page-head"><h1>설정</h1></header>

    <h2 class="section-title">앱 설치</h2>
    <section class="card" id="install">${installSectionHTML()}</section>

    <h2 class="section-title">알림</h2>
    <section class="card" id="push">${pushIntroHTML()}</section>

    ${DEV ? `<h2 class="section-title">테스트용 날짜</h2>
    <section class="card">
      <p>앱이 쓰는 날짜: <b>${formatLong(today)}</b> ${override ? '<span class="test-badge">테스트 중</span>' : '<span class="muted">(오늘)</span>'}</p>
      <p class="muted small">날짜를 바꾸면 기념일·전야제 화면을 미리 볼 수 있어요. 앱을 닫으면 원래 날짜로 돌아가요.</p>
      <div class="chips mt">${presets.map(p => `<button type="button" class="chip" data-date="${p.date}">${esc(p.label)} · ${formatShort(p.date)}</button>`).join('')}</div>
      <div class="row mt">
        <input type="date" id="date-input" value="${today}" aria-label="테스트 날짜">
        <button type="button" class="btn btn-primary" data-act="apply-date">적용</button>
        ${override ? '<button type="button" class="btn btn-ghost" data-act="clear-date">원래대로</button>' : ''}
      </div>
    </section>` : ''}

    <h2 class="section-title">문제 데이터</h2>
    <section class="card">
      <p>문제 <b>${data.allQuestions().length}개</b> · 기념일 ${data.allAnniversaries().length}개</p>
      <div class="tags mt">${data.ERAS.map(era => `<span class="tag tag-soft">${esc(era)} ${data.questionsByEra(era).length}</span>`).join('')}</div>
    </section>

    <h2 class="section-title">학습 기록</h2>
    <section class="card">
      <div class="setting-row">
        <div class="grow"><b>기록 옮기기 (백업 코드)</b><p class="muted small">아이폰은 사파리와 홈 화면 앱의 기록이 따로예요. 폰을 바꿀 때도 써요.</p></div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="backup-copy">코드 복사</button>
      </div>
      <ol class="muted small mt">
        <li>[코드 복사]를 누르고 <b>메모 앱에 붙여 두세요</b>(잃어버리지 않게).</li>
        <li>옮길 곳(홈 화면 앱·새 폰)의 이 화면에서 아래 칸을 <b>길게 눌러 붙여 넣기</b>해요.</li>
        <li>[기록 옮기기]를 누르면 끝이에요.</li>
      </ol>
      <textarea id="backup-input" class="mt" rows="3" placeholder="여기를 길게 눌러 백업 코드(HCBT…)를 붙여 넣으세요" aria-label="백업 코드" style="width:100%;font:inherit;font-size:13px"></textarea>
      <button type="button" class="btn btn-ghost btn-block mt" data-act="backup-restore">붙여 넣은 코드로 기록 옮기기</button>
    </section>
    <section class="card">
      <div class="setting-row">
        <div class="grow"><b>기록 초기화</b><p class="muted small">푼 문제, 오답노트, 모의고사 기록이 모두 지워져요.</p></div>
        <button type="button" class="btn btn-danger btn-sm" data-act="reset">초기화</button>
      </div>
    </section>

    <p class="center muted small mt">한국사 CBT v${VERSION} · <a href="privacy.html">개인정보 처리방침</a></p>`;

  function applyDate(value) {
    setDateOverride(value);
    // 주소에 ?today= 가 남아 있으면 새로고침할 때 다시 적용되니까 지워요.
    history.replaceState(null, '', `${location.pathname}#/`);
    refresh();
  }

  drawPush(el.querySelector('#push'));

  el.addEventListener('click', async e => {
    const pushAct = e.target.closest('[data-push]')?.dataset.push;
    if (pushAct) {
      const box = el.querySelector('#push');
      try {
        if (pushAct === 'on') {
          await subscribe(Number(box.querySelector('#push-hour').value));
          track('push_sub');
          toast('매일 알림을 켰어요');
        } else {
          await unsubscribe();
          toast('알림을 껐어요');
        }
      } catch (err) {
        toast(err.message === 'denied' ? '알림이 막혀 있어요. 아이폰 설정 → 알림에서 허용해 주세요' : '알림 설정에 실패했어요. 잠시 뒤 다시 해 주세요');
      }
      drawPush(box);
      return;
    }
    const preset = e.target.closest('[data-date]');
    if (preset) {
      applyDate(preset.dataset.date);
      toast(`${formatShort(preset.dataset.date)}로 바꿨어요`);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'apply-date') {
      const value = el.querySelector('#date-input').value;
      if (value) applyDate(value);
    } else if (act === 'clear-date') {
      setDateOverride(null);
      history.replaceState(null, '', `${location.pathname}#/settings`);
      refresh();
      toast('오늘 날짜로 돌아왔어요');
    } else if (act === 'install') {
      if (await promptInstall()) toast('홈 화면에 설치했어요!');
      el.querySelector('#install').innerHTML = installSectionHTML();
    } else if (act === 'backup-copy') {
      const code = await store.exportBackup();
      try {
        await navigator.clipboard.writeText(code);
        toast('백업 코드를 복사했어요. 메모 앱에 먼저 붙여 두세요');
      } catch {
        // 복사가 막히면 칸에 넣고 전체 선택해 둬요(길게 눌러 복사).
        const box = el.querySelector('#backup-input');
        box.value = code;
        box.select();
        toast('자동 복사가 안 돼요. 칸의 코드를 길게 눌러 복사해 주세요');
      }
    } else if (act === 'backup-restore') {
      let parsed;
      try {
        parsed = await store.readBackup(el.querySelector('#backup-input').value);
      } catch (err) {
        toast(err.message);
        return;
      }
      const when = parsed.at ? formatShort(toDateStr(new Date(parsed.at))) : '';
      const ok = await confirmModal({
        title: '이 기록으로 바꿀까요?',
        message: `${when ? `${when}에 만든 코드 · ` : ''}푼 문제 ${parsed.attempts}개 · 모의고사 ${parsed.exams}회. 지금 이 기기의 기록은 지워지고 코드의 기록으로 바뀌어요.`,
        ok: '옮기기',
        danger: true,
      });
      if (!ok) return;
      try {
        store.restoreBackup(parsed);
      } catch (err) {
        toast(err.message);
        return;
      }
      location.reload();
    } else if (act === 'reset') {
      const ok = await confirmModal({ title: '기록을 모두 지울까요?', message: '지운 기록은 되돌릴 수 없어요.', ok: '모두 지우기', danger: true });
      if (!ok) return;
      store.resetAll();
      toast('기록을 모두 지웠어요');
      refresh();
    }
  });

  const onInstallable = () => { el.querySelector('#install').innerHTML = installSectionHTML(); };
  document.addEventListener('installable', onInstallable);
  return () => document.removeEventListener('installable', onInstallable);
}

function installSectionHTML() {
  const info = installInfo();
  if (info.standalone) return '<p>✅ 앱으로 설치돼 있어요.</p>';
  if (info.canPrompt) {
    return `<div class="setting-row">
      <div class="grow"><b>홈 화면에 설치</b><p class="muted small">아이콘을 눌러 바로 열고, 인터넷이 없어도 풀 수 있어요.</p></div>
      <button type="button" class="btn btn-primary btn-sm" data-act="install">설치</button>
    </div>`;
  }
  if (info.ios) {
    return `<b>아이폰·아이패드에 설치하기</b>
      <ol class="steps"><li>Safari로 이 페이지를 열어요.</li><li>공유 버튼(□↑)을 눌러요. 안 보이면 주소창 옆 ⋯를 먼저 눌러요.</li><li>"홈 화면에 추가"를 눌러요.</li></ol>`;
  }
  return '<p class="muted small">브라우저 메뉴(⋮)에서 "앱 설치" 또는 "홈 화면에 추가"를 눌러 주세요. 배포한 주소(https)에서 설치할 수 있어요.</p>';
}
