// 주제 개념 카드(박사 작성): 흐름 한 줄, 키워드, 헷갈리는 짝, 함정 → 이 주제 문제 풀기
import * as data from '../data.js';
import { esc } from '../ui.js';

function listHTML(only) {
  const all = data.concepts();
  const rows = data.ERAS.filter(era => !only || era === only).map(era => {
    // 한 시대만 볼 때는 시작 연도 순서(흐름), 전체일 때는 출제 많은 순서
    const start = c => Number((c.years ?? '').match(/\d+/)?.[0] ?? 9999) * (/기원전/.test(c.years ?? '') ? -1 : 1);
    const list = all.filter(c => c.era === era).sort((a, b) => (only ? start(a) - start(b) : 0));
    return list.length ? `<h2 class="section-title">${esc(era)}</h2><section class="card"><ul class="list">${list.map(c => {
      const f = data.frequency().find(x => x.topic === c.topic);
      return `<li><a class="list-row link-row" href="#/concept?t=${encodeURIComponent(c.topic)}"><div class="grow"><b>📘 ${esc(c.topic)}</b>
        <p class="muted small">${esc(c.years ?? '')}${f ? ` · 24회 중 ${f.all}회` : ''}</p>${only ? `<p class="small mt">${esc(c.flow)}</p>` : ''}</div></a></li>`;
    }).join('')}</ul></section>` : '';
  }).join('');
  // 시대를 고르면 그 시대 카드의 흐름 한 줄이 이어져서 '시대 흐름 한 장'이 돼요.
  const chips = `<div class="chips">${['', ...data.ERAS].map(e => `<a class="chip ${e === (only ?? '') ? 'is-active' : ''}" href="#/concept${e ? `?era=${encodeURIComponent(e)}` : ''}">${e || '전체'}</a>`).join('')}</div>`;
  return `<header class="page-head"><h1>개념 카드</h1><a class="btn btn-ghost btn-sm" href="#/hot">공부</a></header>
    ${chips}<p class="muted small mt">전 주제 ${all.length}개 · 시대를 고르면 흐름까지 한 번에 읽어요.</p>${rows ||'<section class="card empty"><p>아직 카드가 없어요.</p></section>'}`;
}

function cardHTML(c) {
  const f = data.frequency().find(x => x.topic === c.topic);
  const kw = (c.keywords ?? []).map(k => {
    const [cue, ...rest] = k.split('→');
    return `<li>${rest.length ? `<b>${esc(cue.trim())}</b> → ${esc(rest.join('→').trim())}` : esc(k)}</li>`;
  }).join('');
  // 헷갈리는 상대가 카드로 있으면 바로 넘어가요.
  const pairs = (c.pairs ?? []).map(p => {
    const name = data.concept(p.with) ? `<a href="#/concept?t=${encodeURIComponent(p.with)}">vs ${esc(p.with)} 📘</a>` : `vs ${esc(p.with)}`;
    return `<li><b>${name}</b> ${esc(p.tip)}</li>`;
  }).join('');
  const refs = (c.refs ?? []).filter(u => u.startsWith('https://')).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">근거 ${i + 1}</a>`).join(' · ');
  return `<header class="page-head"><h1>${esc(c.topic)}</h1><button type="button" class="btn btn-ghost btn-sm" data-act="back">뒤로</button></header>
    <p class="muted small">${esc(c.era)}${c.years ? ` · ${esc(c.years)}` : ''}${f ? ` · 최근 24회 중 <b>${f.all}회</b> 출제` : ''}</p>
    <section class="card mt"><p class="eyebrow">흐름</p><p>${esc(c.flow)}</p></section>
    <section class="card mt"><p class="eyebrow">꼭 외울 키워드</p><ul class="concept-list">${kw}</ul></section>
    ${pairs ? `<section class="card mt"><p class="eyebrow">헷갈리는 짝</p><ul class="concept-list">${pairs}</ul></section>` : ''}
    ${c.trap ? `<p class="keypoint mt"><b>함정</b> ${esc(c.trap)}</p>` : ''}
    ${f ? `<a class="btn btn-primary btn-block mt" href="#/quiz?mode=topic&t=${encodeURIComponent(c.topic)}">이 주제 문제 풀기</a>` : ''}
    <a class="btn btn-ghost btn-block mt" href="#/order">사건 순서 훈련</a>
    ${refs ? `<p class="muted small mt">${refs}</p>` : ''}`;
}

export function render(el, route) {
  const c = data.concept(route.params.get('t') ?? '');
  el.innerHTML = c ? cardHTML(c) : listHTML(route.params.get('era'));
  el.addEventListener('click', e => {
    if (e.target.closest('[data-act="back"]')) history.length > 1 ? history.back() : (location.hash = '#/concept');
  });
}
