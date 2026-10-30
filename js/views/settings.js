// 설정: 앱 설치, 알림(2단계 예정), 테스트용 날짜, 문제 데이터, 기록 초기화
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, toDateStr, dateOverride, setDateOverride, addDays, formatLong, formatShort } from '../dates.js';
import { esc, installInfo, promptInstall, confirmModal, toast, refresh } from '../ui.js';

const VERSION = '0.2.0';

export function render(el) {
  const today = todayStr();
  const override = dateOverride();

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
    <section class="card">
      <div class="setting-row">
        <div class="grow"><b>기념일·시험 전날 알림</b><p class="muted small">푸시 알림은 2단계에서 추가될 예정이에요.</p></div>
        <span class="switch" aria-hidden="true"></span>
      </div>
    </section>

    <h2 class="section-title">테스트용 날짜</h2>
    <section class="card">
      <p>앱이 쓰는 날짜: <b>${formatLong(today)}</b> ${override ? '<span class="test-badge">테스트 중</span>' : '<span class="muted">(오늘)</span>'}</p>
      <p class="muted small">날짜를 바꾸면 기념일·전야제 화면을 미리 볼 수 있어요. 앱을 닫으면 원래 날짜로 돌아가요.</p>
      <div class="chips mt">${presets.map(p => `<button type="button" class="chip" data-date="${p.date}">${esc(p.label)} · ${formatShort(p.date)}</button>`).join('')}</div>
      <div class="row mt">
        <input type="date" id="date-input" value="${today}" aria-label="테스트 날짜">
        <button type="button" class="btn btn-primary" data-act="apply-date">적용</button>
        ${override ? '<button type="button" class="btn btn-ghost" data-act="clear-date">원래대로</button>' : ''}
      </div>
    </section>

    <h2 class="section-title">문제 데이터</h2>
    <section class="card">
      <p>문제 <b>${data.allQuestions().length}개</b> · 기념일 ${data.allAnniversaries().length}개</p>
      <div class="tags mt">${data.ERAS.map(era => `<span class="tag tag-soft">${esc(era)} ${data.questionsByEra(era).length}</span>`).join('')}</div>
      <p class="muted small mt">지금 문제는 직접 만든 샘플이에요. 배포 전에 내용을 꼭 검수해 주세요.</p>
    </section>

    <h2 class="section-title">학습 기록</h2>
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

  el.addEventListener('click', async e => {
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
      <ol class="steps"><li>Safari로 이 페이지를 열어요.</li><li>아래쪽 공유 버튼(□↑)을 눌러요.</li><li>"홈 화면에 추가"를 눌러요.</li></ol>`;
  }
  return '<p class="muted small">브라우저 메뉴(⋮)에서 "앱 설치" 또는 "홈 화면에 추가"를 눌러 주세요. 배포한 주소(https)에서 설치할 수 있어요.</p>';
}
