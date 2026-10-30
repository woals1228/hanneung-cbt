// 오답노트: 오늘 복습 / 전체 / 완료, 시대별 필터, 해설 보기, 삭제
import * as data from '../data.js';
import * as store from '../store.js';
import { todayStr, formatShort, daysBetween } from '../dates.js';
import { esc, questionHTML, confirmModal, toast, installInfo } from '../ui.js';

// 다른 화면에 다녀와도 고른 탭과 시대가 그대로 남아 있어요.
// 탭을 고르기 전에는 오늘 복습할 문제가 있으면 '오늘 복습', 없으면 '전체'를 보여 줘요.
let chosenTab = null;
let eraFilter = '전체';

export function render(el) {
  const today = todayStr();
  const open = new Set();
  let tab;

  function draw() {
    const items = store.notebookItems().filter(i => data.getQuestion(i.id));
    const groups = {
      due: items.filter(i => !i.mastered && i.due <= today),
      all: items.filter(i => !i.mastered),
      done: items.filter(i => i.mastered),
      fav: store.favoriteIds().filter(id => data.getQuestion(id)).map(id => ({ id, fav: true, ...(store.getState().notebook[id] ?? {}) })),
    };
    tab = chosenTab ?? (groups.due.length ? 'due' : 'all');
    let list = groups[tab];
    if (eraFilter !== '전체') list = list.filter(i => data.getQuestion(i.id).era === eraFilter);
    list = tab === 'fav' ? list : tab === 'done'
      ? list.sort((a, b) => b.last.localeCompare(a.last))
      : list.sort((a, b) => a.due.localeCompare(b.due));

    const tabs = [['due', `오늘 복습 ${groups.due.length}`], ['all', `전체 ${groups.all.length}`], ['done', `완료 ${groups.done.length}`], ['fav', `★ ${groups.fav.length}`]];
    el.innerHTML = `
      <header class="page-head"><h1>오답노트</h1></header>
      <section class="card">
        <p class="muted small">틀린 문제는 <b>1일 → 3일 → 7일</b> 뒤에 다시 나와요. 복습 날짜에 세 번 연달아 맞히면 완료!</p>
        ${installInfo().ios && !installInfo().standalone ? '<p class="small mt">⚠️ 아이폰 사파리는 홈 화면에 추가하지 않고 7일 넘게 안 들어오면 기록이 지워질 수 있어요.</p>' : ''}
        <div class="row mt">
          ${groups.due.length
            ? `<a class="btn btn-primary grow" href="#/quiz?mode=review">오늘 복습 ${groups.due.length}문제 시작</a>`
            : '<span class="grow muted">오늘 복습할 문제가 없어요 👍</span>'}
          ${groups.all.length ? '<a class="btn btn-ghost" href="#/quiz?mode=wrong">전체 다시 풀기</a>' : ''}
          ${tab === 'fav' && groups.fav.length ? '<a class="btn btn-ghost" href="#/quiz?mode=fav">★ 즐겨찾기 풀기</a>' : ''}
        </div>
      </section>
      <div class="segmented" role="tablist">
        ${tabs.map(([key, label]) => `<button type="button" role="tab" aria-selected="${tab === key}" class="${tab === key ? 'is-active' : ''}" data-tab="${key}">${label}</button>`).join('')}
      </div>
      <div class="chips mt">
        ${['전체', ...data.ERAS].map(era => `<button type="button" class="chip ${eraFilter === era ? 'is-active' : ''}" data-era="${esc(era)}">${esc(era)}</button>`).join('')}
      </div>
      <div class="mt">${list.length ? list.map(itemHTML).join('') : `<div class="card empty">${emptyText(items.length)}</div>`}</div>`;
  }

  function emptyText(total) {
    if (tab === 'fav') return '문제를 풀 때 위쪽 ☆을 누르면 여기에 모여요.';
    if (!total) return '아직 틀린 문제가 없어요.<br>문제를 풀다 틀리면 여기에 모여요.';
    if (tab === 'due') return '오늘 복습할 문제가 없어요 👍';
    if (tab === 'done') return '아직 완료한 문제가 없어요.';
    return '이 시대에는 틀린 문제가 없어요.';
  }

  function itemHTML(item) {
    const q = data.getQuestion(item.id);
    if (item.fav && item.due == null) return favHTML(item, q);
    const dots = Array.from({ length: store.REVIEW_STEPS }, (_, i) => `<span class="dot ${i < item.stage ? 'is-on' : ''}"></span>`).join('');
    let when;
    if (item.mastered) when = '<span class="ok-text">완료 ✓</span>';
    else if (item.due <= today) when = '<span class="due-today">오늘 복습</span>';
    else when = `다음 복습 ${formatShort(item.due)} · ${daysBetween(today, item.due)}일 뒤`;
    const isOpen = open.has(item.id);
    return `<article class="card note">
      <div class="note-top">
        <div class="tags"><span class="tag">${esc(q.era)}</span><span class="tag tag-soft">${esc(q.topic)}</span></div>
        <span class="muted small">틀린 횟수 ${item.wrong}회</span>
      </div>
      <p class="note-q">${esc(q.question)}</p>
      <div class="note-meta"><span class="dots" role="img" aria-label="복습 ${item.stage}/${store.REVIEW_STEPS}단계">${dots}</span>${when}</div>
      ${isOpen ? `<div class="note-detail">${questionHTML(q, { revealed: true, hideHead: true })}</div>` : ''}
      <div class="note-actions">
        <a class="btn btn-primary btn-sm" href="#/quiz?mode=one&id=${encodeURIComponent(item.id)}">다시 풀기</a>
        <button type="button" class="btn btn-ghost btn-sm" data-toggle="${esc(item.id)}" aria-expanded="${isOpen}">${isOpen ? '해설 닫기' : '해설 보기'}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-remove="${esc(item.id)}">삭제</button>
      </div>
    </article>`;
  }

  function favHTML(item, q) {
    const isOpen = open.has(item.id);
    return `<article class="card note">
      <div class="tags"><span class="tag">${esc(q.era)}</span>${q.past ? `<span class="tag tag-soft">${esc(q.source)}</span>` : ''}</div>
      <p class="note-q">${esc(q.question)}</p>
      ${isOpen ? `<div class="note-detail">${questionHTML(q, { revealed: true, hideHead: true })}</div>` : ''}
      <div class="note-actions">
        <a class="btn btn-primary btn-sm" href="#/quiz?mode=one&id=${encodeURIComponent(item.id)}">다시 풀기</a>
        <button type="button" class="btn btn-ghost btn-sm" data-toggle="${esc(item.id)}" aria-expanded="${isOpen}">${isOpen ? '해설 닫기' : '해설 보기'}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-unfav="${esc(item.id)}">★ 빼기</button>
      </div>
    </article>`;
  }

  el.addEventListener('click', async e => {
    const target = e.target.closest('[data-tab], [data-era], [data-toggle], [data-remove], [data-unfav]');
    if (!target) return;
    const { dataset } = target;
    if (dataset.tab) chosenTab = dataset.tab;
    else if (dataset.era) eraFilter = dataset.era;
    else if (dataset.toggle) {
      if (open.has(dataset.toggle)) open.delete(dataset.toggle);
      else open.add(dataset.toggle);
    } else if (dataset.unfav) {
      store.toggleFavorite(dataset.unfav);
      toast('즐겨찾기에서 뺐어요');
    } else if (dataset.remove) {
      const ok = await confirmModal({ title: '오답노트에서 뺄까요?', message: '이 문제의 복습 기록이 지워져요.', ok: '빼기', danger: true });
      if (!ok) return;
      store.removeFromNotebook(dataset.remove);
      toast('오답노트에서 뺐어요');
    }
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  });

  draw();
}
