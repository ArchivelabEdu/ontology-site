/* 3부 · 트리플이 화면이 될 때
   2부가 낸 TTL 을 브라우저 안 SPARQL 엔진에 올려 연표·관계망·질의를 띄운다.
   여기서는 코딩을 하지 않는다 — 그래프에 있는 것만 그리고, 없는 것은 없는 대로 둔다.
   "안 보이는 것"이 이 부의 교재다.

   엔진은 오후 스타터킷과 같은 Oxigraph(브라우저 안에서 도는 SPARQL 1.1)다.
   다만 이 사이트는 오프라인에서도 돌아야 하므로 CDN 이 아니라 vendor/ 에 동봉한 것을 쓴다. */
(function () {
  'use strict';

  const RICO = 'https://www.ica.org/standards/RiC/ontology#';
  const RIC = 'http://archives.nanet.go.kr/id/';
  const PFX = `PREFIX rico: <${RICO}>
PREFIX ric:  <${RIC}>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;
  const CLSVAR = {
    Person: '--cls-agent', Agent: '--cls-agent', CorporateBody: '--cls-agent',
    Position: '--cls-agent', Group: '--cls-agent',
    Record: '--cls-record', RecordSet: '--cls-record', Instantiation: '--cls-record',
    Event: '--cls-event', Activity: '--cls-event',
    Place: '--cls-place',
  };
  const CLSKO = {
    Person: '인물', CorporateBody: '단체', Position: '직위', Event: '사건', Activity: '활동',
    Place: '장소', Record: '기록', RecordSet: '기록집합', Rule: '규칙', Date: '날짜',
    Agent: '행위자', Group: '집단', Instantiation: '구현체',
  };
  const short = u => String(u).startsWith(RICO) ? 'rico:' + u.slice(RICO.length)
    : String(u).startsWith(RIC) ? 'ric:' + u.slice(RIC.length) : String(u);
  const clsOf = u => String(u).startsWith(RICO) ? u.slice(RICO.length) : short(u);
  const colorOf = c => `var(${CLSVAR[c] || '--cls-other'})`;
  const yearOf = d => { const m = /(\d{4})/.exec(String(d || '')); return m ? +m[1] : null; };
  const monthOf = d => { const m = /^\d{4}-(\d{2})/.exec(String(d || '')); return m ? +m[1] : 1; };

  /* ══════════ 상태 ══════════ */
  const P3 = {
    Store: null, store: null,          // 엔진 · 적재된 그래프
    srcName: '', srcText: '',          // 어느 TTL 을 올렸는지
    ents: [], rels: [], byId: new Map(),
    tab: 'time',
    paste: false,
    msg: null,                         // {ok, text} — render() 가 화면을 다시 그려도 남아야 한다
  };

  /* ══════════ 엔진 ══════════ */
  async function engine() {
    if (P3.Store) return P3.Store;
    // 3부를 열 때만 받는다 — 1·2부만 쓰는 사람에게 3.5MB 를 지우지 않기 위해
    const m = await import('./vendor/oxigraph/web.js');
    await m.default();
    P3.Store = m.Store;
    return P3.Store;
  }
  const raw = sparql => P3.store ? P3.store.query(PFX + sparql) : [];
  /* OPTIONAL 때문에 행마다 바인딩된 변수가 다르다. 첫 행의 키만 쓰면
     첫 행에 없는 변수가 통째로 사라진다 — 전 행의 합집합을 쓴다. */
  function rows(sparql) {
    const r = raw(sparql);
    if (!r.length) return [];
    const vars = new Set();
    r.forEach(b => { for (const k of b.keys()) vars.add(k); });
    return r.map(b => {
      const o = {};
      for (const v of vars) { const t = b.get(v); o[v] = t ? t.value : ''; }
      return o;
    });
  }

  /* ══════════ TTL 소스 ══════════ */
  /* ① 2부에서 만든 것 — 워크벤치가 세션에 쌓아 둔 단락들 */
  const wbReady = () => typeof DONE !== 'undefined' && DONE.size > 0;
  const wbTTL = () => mergedTTL();

  /* ② 예시 — 총서 부록의 역대 국회의장 전거를 그대로 그래프로 세운다.
     1부에서 배운 3-홉(인물 → 직위 → 단체)이 실제 데이터로 어떻게 생겼는지 보는 자리다.
     날짜가 붙어 있어 연표가 채워진다 — 2부 산출물과 견줘 보라고 둔 것이다.

     부의장 82건은 뺐다. 직위가 전부 '대한민국 국회' 하나에 매달리는 별 모양이라,
     125개를 다 그리면 가운데에 점이 겹쳐 아무것도 안 보인다. 43개면 읽힌다. */
  function sampleTTL() {
    const L = [`@prefix rico: <${RICO}> .`, `@prefix ric:  <${RIC}> .`, '',
      '# 역대 국회의장 전거 — 『대한민국 국회를 말하다』 부록에서 파싱 (부의장 제외)', '',
      'ric:org-na\n    a rico:CorporateBody ;\n    rico:name "대한민국 국회" .', ''];
    let n = 0, who = 0;
    D.authority.forEach(a => {
      const ps = a.positions.filter(p => p.role === '의장');
      if (!ps.length) return;
      who++;
      L.push(`ric:${a.id}\n    a rico:Person ;\n    rico:name "${a.name}" .`);
      ps.forEach((p, i) => {
        const pid = `${a.id}-pos${i + 1}`;
        const nm = `${p.assembly} ${p.half} ${p.role}`;
        L.push(`ric:${pid}\n    a rico:Position ;\n    rico:name "${nm}" ;` +
          `\n    rico:beginningDate "${p.start}" ;\n    rico:endDate "${p.end}" .`);
        L.push(`ric:${a.id}  rico:occupiesOrOccupied  ric:${pid} .`);
        L.push(`ric:${pid}  rico:existsOrExistedIn  ric:org-na .`);
        n++;
      });
      L.push('');
    });
    L.push(`# 인물 ${who}명 · 재임 ${n}건`);
    return L.join('\n');
  }

  /* ══════════ 적재 ══════════ */
  function say(text, kind) {
    P3.msg = { text, kind };
    const box = $('#p3msg');
    if (box) { box.className = 'impmsg ' + (kind || ''); box.textContent = text; }
  }

  async function load(ttl, name) {
    say('엔진을 켜는 중… (처음 한 번만 조금 걸립니다)', '');
    try {
      const S = await engine();
      const st = new S();
      st.load(ttl, { format: 'text/turtle', base_iri: RIC });
      P3.store = st; P3.srcText = ttl; P3.srcName = name;
      scan();
      say(`${name} — 개체 ${P3.ents.length} · 관계 ${P3.rels.length} · 트리플 ${st.size} 을 올렸습니다.`, 'ok');
      render();          // render() 가 상자를 새로 만들므로 문구는 P3.msg 에서 다시 그려진다
    } catch (e) {
      // Turtle 문법 오류는 엔진이 몇 줄인지까지 말해 준다 — 붙여넣기가 깨지는 가장 흔한 이유다
      say('TTL 을 읽지 못했습니다 — ' + (e && e.message ? e.message : e), 'bad');
    }
  }

  function scan() {
    P3.ents = rows(`SELECT ?s ?c ?nm ?ti ?d ?e WHERE {
  ?s a ?c .
  OPTIONAL { ?s rico:name ?nm }
  OPTIONAL { ?s rico:title ?ti }
  OPTIONAL { ?s rico:beginningDate ?d }
  OPTIONAL { ?s rico:endDate ?e }
}`).map(r => ({
      id: r.s, cls: clsOf(r.c), label: r.nm || r.ti || short(r.s),
      d: r.d || '', e: r.e || '',
    }));
    // 같은 개체가 클래스 여러 개를 가지면 행이 여러 번 나온다 — 첫 것만 남긴다
    const seen = new Map();
    P3.ents = P3.ents.filter(x => seen.has(x.id) ? false : (seen.set(x.id, 1), true));
    P3.byId = new Map(P3.ents.map(e => [e.id, e]));

    P3.rels = rows(`SELECT ?s ?p ?o WHERE {
  ?s ?p ?o .
  FILTER(isIRI(?o) && ?p != rdf:type)
}`).map(r => ({ s: r.s, p: clsOf(r.p), o: r.o }))
      .filter(r => P3.byId.has(r.s) && P3.byId.has(r.o));
  }

  /* ══════════ 뼈대 ══════════ */
  const TABS = [
    ['time', '연표'], ['net', '관계망'], ['sparql', 'SPARQL 플레이그라운드'], ['cmp', '같은 질문을 둘에게'],
  ];

  function render() {
    const host = $('#p3host');
    if (!host) return;
    host.innerHTML = sourceBar() + (P3.store ? tabBar() + `<div id="p3body"></div>` : intro());
    if (P3.store) paint();
  }

  function intro() {
    return `<div class="wb"><div class="wbhead"><span class="no">?</span><h3>아직 올린 그래프가 없습니다</h3></div>
    <p class="note">위에서 하나를 골라 <b>올리기</b>를 누르세요. 2부를 아직 안 했다면 예시로 먼저 봐도 됩니다.</p>
    <p class="note">여기서 하는 일은 <b>만드는 것이 아니라 확인하는 것</b>입니다 —
      내가 넣은 트리플이 화면에서 어떻게 보이는지, 그리고 <b>무엇을 빼먹었는지</b>를 봅니다.</p></div>`;
  }

  function sourceBar() {
    const st = wbReady() ? (() => { let n = 0; for (const v of DONE.values()) n += v.triples.length; return { p: DONE.size, t: n }; })() : null;
    return `<div class="wb p3src"><div class="wbhead"><span class="no">§</span><h3>어느 그래프를 볼까요</h3>
      <span class="hint">${P3.srcName ? '지금 올린 것 — ' + esc(P3.srcName) : '하나를 고르세요'}</span></div>
    <div class="p3btns">
      <button class="btn sm ${st ? 'primary' : ''}" onclick="p3.loadWB(this)" ${st ? '' : 'disabled title="2부에서 ⑦ 산출까지 한 단락을 마치면 켜집니다"'}>
        2부에서 만든 내 그래프${st ? ` (${st.p}단락 · 트리플 ${st.t})` : ''}</button>
      <button class="btn sm" onclick="p3.loadSample(this)">예시 — 역대 국회의장 전거</button>
      <button class="btn sm" onclick="p3.togglePaste()">TTL 붙여넣기 / 파일 열기</button>
    </div>
    ${P3.paste ? pastePanel() : ''}
    <p class="impmsg ${P3.msg ? P3.msg.kind : ''}" id="p3msg">${P3.msg ? esc(P3.msg.text) : ''}</p></div>`;
  }

  function pastePanel() {
    return `<div class="p3paste">
      <p class="note" style="margin-top:.6rem">오후에 아카이브시스템 백엔드(<code>localhost:3100</code>)의
        <b>지식그래프 추출</b> 화면에서 받은 <code>graph.ttl</code> 도 여기에 그대로 넣어 볼 수 있습니다.
        올린 파일은 <b>이 브라우저 밖으로 나가지 않습니다.</b></p>
      <input type="file" accept=".ttl,.turtle,.n3,.nt,text/turtle" onchange="p3.pickFile(this)">
      <textarea id="p3ttl" rows="7" placeholder="@prefix rico: &lt;...&gt; .&#10;ric:agent-071 a rico:Person ; rico:name &quot;정세균&quot; ."></textarea>
      <button class="btn sm primary" onclick="p3.loadPaste(this)">이 TTL 올리기</button>
    </div>`;
  }

  function tabBar() {
    return `<div class="cardnav p3tabs">${TABS.map(([k, t]) =>
      `<button class="chip" aria-current="${P3.tab === k}" onclick="p3.tab('${k}')">${t}</button>`).join('')}</div>`;
  }

  function paint() {
    const b = $('#p3body');
    if (!b) return;
    if (P3.tab === 'time') { b.innerHTML = viewTime(); lastW = -1; layoutTime(); }
    else if (P3.tab === 'net') { b.innerHTML = viewNet(); startNet(); }
    else if (P3.tab === 'sparql') { b.innerHTML = viewSparql(); }
    else { b.innerHTML = viewCmp(); }
  }

  /* ══════════ 화면 ① 연표 ══════════ */
  const dated = () => P3.ents.filter(e => yearOf(e.d)).sort((a, b) => (a.d || '').localeCompare(b.d || ''));

  function viewTime() {
    const has = dated();
    const miss = P3.ents.length - has.length;
    if (!has.length) {
      return `<div class="wb"><div class="wbhead"><span class="no">①</span><h3>연표</h3>
        <span class="hint">${P3.ents.length}개 중 0개</span></div>
      <div class="result fail"><b>이 그래프에는 <code>rico:beginningDate</code> 가 하나도 없습니다.</b>
        연표는 지어내지 않습니다 — 날짜를 안 단 개체는 자리를 얻지 못합니다.
        <b>빈 화면이 곧 리포트입니다.</b></div>
      <p class="note">2부 ⑤ 트리플 잇기는 <b>개체와 개체를 잇는 속성</b>만 다뤘습니다.
        날짜처럼 값을 적는 속성(데이터 속성)은 거기서 붙이지 않았으니 여기가 비는 것이 정상입니다.
        아래에서 직접 달아 보면 같은 그래프가 곧바로 연표가 됩니다.</p>
      ${dateEditor()}</div>`;
    }
    const y0 = yearOf(has[0].d), y1 = Math.max(...has.map(e => yearOf(e.e) || yearOf(e.d)));
    return `<div class="wb"><div class="wbhead"><span class="no">①</span><h3>연표</h3>
      <span class="hint">${y0}–${y1} · ${has.length}건</span></div>
    <p class="note"><code>rico:beginningDate</code> 가 있는 개체만 올라옵니다.
      ${miss > 0 ? `날짜를 안 단 <b>${miss}개</b>는 여기 없습니다 — 없는 것이 아니라 <b>안 보이는 것</b>입니다.` : '이 그래프는 모든 개체에 날짜가 있습니다.'}
      막대를 누르면 관계망에서 그 개체를 찾아 줍니다.</p>
    <div class="p3time" id="p3time">${has.map((e, i) =>
      `<button class="p3ev" data-i="${i}" style="color:${colorOf(e.cls)}" onclick="p3.focus('${esc(e.id)}')"
        title="${esc(e.label)} · ${esc(e.d)}${e.e ? ' ~ ' + esc(e.e) : ''}">
        <i>${esc(String(e.d).slice(0, 4))}</i>${esc(e.label)}</button>`).join('')}
      <div class="p3axis" id="p3axis"></div></div>
    ${miss > 0 ? dateEditor() : ''}</div>`;
  }

  /* 날짜를 달아 보는 자리 — 넣으면 곧바로 위 연표가 다시 그려진다.
     "빠진 것이 보인다 → 고친다 → 화면이 달라진다"가 이 부의 한 바퀴다. */
  function dateEditor() {
    const no = P3.ents.filter(e => !yearOf(e.d)).slice(0, 40);
    if (!no.length) return '';
    return `<details class="p3det"><summary>날짜를 달아 보기 (${no.length}개)</summary>
      <p class="note">연도만 적어도 됩니다(예: <code>1996</code> 또는 <code>1996-05</code>).
        적은 값은 <code>rico:beginningDate</code> 트리플로 이 그래프에 들어갑니다 — 파일은 건드리지 않습니다.
        <span class="vdef">인물의 생년은 <code>rico:birthDate</code> 가 더 정확하지만,
        여기서는 연표에 올리는 것이 목적이라 한 속성으로 통일했습니다.</span></p>
      <div class="p3dates">${no.map(e =>
      `<label><span class="pill c-${e.cls}">${CLSKO[e.cls] || e.cls}</span>
         <b>${esc(e.label)}</b><input data-id="${esc(e.id)}" placeholder="YYYY" size="8"></label>`).join('')}</div>
      <button class="btn sm primary" onclick="p3.addDates(this)">그래프에 넣기</button></details>`;
  }

  /* 겹치지 않게 층을 쌓는다. 연도 축은 선형이라 같은 해가 몰리면 글자가 포개진다 —
     칸을 실제 픽셀로 재서 부딪히면 아래층으로 내린다. */
  /* 폭이 잡히기 전에 계산하면 모든 칸이 부딪혀 층이 개체 수만큼 쌓인다.
     탭 전환·창 크기 변경·늦게 잡히는 첫 렌더를 한꺼번에 처리하려고 ResizeObserver 를 쓴다.
     같은 폭에서 다시 돌지 않게 막아 둔다 — 높이를 바꾸면 관찰자가 또 불리기 때문이다. */
  let lastW = -1, timeRO = null;
  function layoutTime() {
    const box = $('#p3time');
    if (!box) return;
    if (!timeRO) { timeRO = new ResizeObserver(() => layoutTime()); }
    timeRO.disconnect(); timeRO.observe(box);
    const items = [...box.querySelectorAll('.p3ev')];
    if (!items.length) return;
    const has = dated();
    const W = box.clientWidth - 24;
    if (W < 120 || W === lastW) return;
    lastW = W;
    const frac = e => { const y = yearOf(e.d); return y + (monthOf(e.d) - 1) / 12; };
    const lo = frac(has[0]), hi = Math.max(...has.map(frac));
    const span = Math.max(1, hi - lo);
    const lanes = [];
    items.forEach((el, i) => {
      const w = el.offsetWidth;
      // 오른쪽 끝 항목은 글자가 상자 밖으로 나간다 — 안으로 당겨 넣는다
      const x = Math.min(12 + (frac(has[i]) - lo) / span * W, 12 + W - w);
      let ln = lanes.findIndex(right => right + 8 < x);
      if (ln < 0) { lanes.push(0); ln = lanes.length - 1; }
      lanes[ln] = x + w;
      el.style.left = x + 'px';
      el.style.top = (ln * 30 + 4) + 'px';
    });
    box.style.height = (lanes.length * 30 + 40) + 'px';
    // 눈금 — 너무 촘촘하면 건너뛴다
    const ax = $('#p3axis');
    if (ax) {
      const step = span > 60 ? 20 : span > 24 ? 10 : span > 8 ? 5 : 1;
      const t = [];
      for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) {
        const x = 12 + (y - lo) / span * W;
        t.push(`<i style="left:${x}px">${y}</i>`);
      }
      ax.innerHTML = t.join('');
      ax.style.top = (lanes.length * 30 + 8) + 'px';
    }
  }

  /* ══════════ 화면 ② 관계망 ══════════ */
  const NET = { n: [], e: [], raf: 0, cv: null, cx: null, W: 0, H: 0, hover: null, focus: null, t: 0, ro: null, hub: null };

  function viewNet() {
    const iso = P3.ents.length - new Set([...P3.rels.flatMap(r => [r.s, r.o])]).size;
    const kinds = {};
    P3.ents.forEach(e => kinds[e.cls] = (kinds[e.cls] || 0) + 1);
    return `<div class="wb"><div class="wbhead"><span class="no">②</span><h3>관계망</h3>
      <span class="hint">개체 ${P3.ents.length} · 관계 ${P3.rels.length}</span></div>
    <p class="note">클래스마다 색이 다릅니다. <b>혼자 떨어져 있는 점</b>은 관계를 하나도 안 이은 개체입니다 —
      ${iso > 0 ? `지금 <b>${iso}개</b> 있습니다. 개체만 뽑고 트리플로 잇지 않으면 이렇게 됩니다.`
        : '지금은 하나도 없습니다. 모든 개체가 무언가와 이어져 있습니다.'}</p>
    <div class="p3net"><canvas id="p3cv"></canvas><div class="p3tip" id="p3tip"></div></div>
    <div class="p3leg">${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([c, n]) =>
      `<span><i style="background:${colorOf(c)}"></i>${CLSKO[c] || c} ${n}</span>`).join('')}</div></div>`;
  }

  function startNet() {
    const cv = $('#p3cv');
    if (!cv) return;
    NET.cv = cv; NET.cx = cv.getContext('2d'); NET.W = 0; NET.H = 0;
    // 처음에는 가운데를 기준으로 한 '치우침'만 담는다. 폭이 잡히는 순간 fitNet 이 한 번만 옮긴다.
    NET.n = P3.ents.map(e => ({
      id: e.id, label: e.label, cls: e.cls, d: 0,
      x: Math.cos(hash(e.id)) * 180, y: Math.sin(hash(e.id) * 1.7) * 140, vx: 0, vy: 0,
    }));
    const byId = new Map(NET.n.map(n => [n.id, n]));
    NET.e = P3.rels.map(r => ({ a: byId.get(r.s), b: byId.get(r.o), p: r.p })).filter(x => x.a && x.b);
    NET.e.forEach(x => { x.a.d++; x.b.d++; });
    NET.hub = [...NET.n].sort((a, b) => b.d - a.d)[0] || null;
    fitNet();
    cv.onmousemove = ev => {
      const r = cv.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      NET.hover = NET.n.find(n => Math.hypot(n.x - mx, n.y - my) < 14) || null;
      const tip = $('#p3tip');
      if (NET.hover) {
        tip.style.display = 'block'; tip.style.left = (mx + 12) + 'px'; tip.style.top = (my + 10) + 'px';
        tip.innerHTML = `<b>${esc(NET.hover.label)}</b><br><span class="pill c-${NET.hover.cls}">${CLSKO[NET.hover.cls] || NET.hover.cls}</span> · 관계 ${NET.hover.d}`;
      } else tip.style.display = 'none';
    };
    cv.onmouseleave = () => { NET.hover = null; const t = $('#p3tip'); if (t) t.style.display = 'none'; };
    cv.onclick = () => { NET.focus = NET.hover ? NET.hover.id : null; };
    // 상자 폭은 탭이 펼쳐진 뒤에야 잡힌다. 잡히는 때를 관찰자에게 맡긴다.
    if (NET.ro) NET.ro.disconnect();
    NET.ro = new ResizeObserver(fitNet);
    NET.ro.observe(cv.parentElement);
    cancelAnimationFrame(NET.raf);
    loopNet();
  }
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h % 628 / 100; };

  function fitNet() {
    const cv = NET.cv;
    if (!cv || !cv.isConnected) return;
    const r = cv.parentElement.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;         // 아직 자리를 못 잡았다
    const first = !NET.W;
    const dpr = window.devicePixelRatio || 1;
    NET.W = r.width; NET.H = r.height;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    NET.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 첫 번째만 가운데로 옮긴다. 다시 옮기면 좌표가 이미 절대값이라 화면 밖으로 밀린다.
    if (first) NET.n.forEach(n => { n.x += NET.W / 2; n.y += NET.H / 2; });
    else NET.n.forEach(n => {
      n.x = Math.max(16, Math.min(NET.W - 16, n.x));
      n.y = Math.max(16, Math.min(NET.H - 16, n.y));
    });
  }

  /* 힘을 아주 약하게 준다 — 멈춰 있는 그림이 아니라 천천히 숨 쉬는 그림이 되도록.
     개체 수가 300 남짓이라 서로 다 밀어도(O(n²)) 한 틱이 1ms 안에 끝난다. */
  function loopNet() {
    const n = NET.n, e = NET.e, cx = NET.cx;
    if (!cx || !NET.cv || !NET.cv.isConnected) return;
    // 폭이 잡히기 전에 물리를 돌리면 모든 점이 0 근처로 눌린다 — 기다렸다 시작한다
    if (!NET.W) { NET.raf = requestAnimationFrame(loopNet); return; }
    NET.t += 0.006;
    for (let i = 0; i < n.length; i++) {
      const a = n[i];
      for (let j = i + 1; j < n.length; j++) {
        const b = n[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = Math.random() - .5; dy = Math.random() - .5; }
        if (d2 > 22500) continue;               // 150px 밖은 서로 못 본다 — 계산도 줄고 뭉침도 준다
        const f = 520 / d2;
        a.vx += dx * f * .01; a.vy += dy * f * .01;
        b.vx -= dx * f * .01; b.vy -= dy * f * .01;
      }
    }
    e.forEach(x => {
      const dx = x.b.x - x.a.x, dy = x.b.y - x.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - 62) * .0016;
      x.a.vx += dx * f; x.a.vy += dy * f;
      x.b.vx -= dx * f; x.b.vy -= dy * f;
    });
    n.forEach((a, i) => {
      // 가운데로 당기는 힘 + 아주 약한 흔들림(멈춰 있는 그림이 아니라 숨 쉬는 그림이 되도록)
      a.vx += (NET.W / 2 - a.x) * .0022 + Math.cos(NET.t + i) * .012;
      a.vy += (NET.H / 2 - a.y) * .0022 + Math.sin(NET.t * 1.3 + i) * .012;
      a.vx *= .86; a.vy *= .86;
      a.x += a.vx; a.y += a.vy;
      // 벽에 닿으면 눌어붙는다 — 되튕겨 안쪽으로 보낸다
      if (a.x < 18) { a.x = 18; a.vx = Math.abs(a.vx) * .5; }
      if (a.x > NET.W - 18) { a.x = NET.W - 18; a.vx = -Math.abs(a.vx) * .5; }
      if (a.y < 18) { a.y = 18; a.vy = Math.abs(a.vy) * .5; }
      if (a.y > NET.H - 18) { a.y = NET.H - 18; a.vy = -Math.abs(a.vy) * .5; }
    });
    // 가장 많이 이어진 개체는 가운데에 못을 박는다. 다 배치한 뒤 통째로 옮기면
    // 나머지가 화면 밖으로 밀려 가장자리에 눌어붙는다.
    if (NET.hub) { NET.hub.x = NET.W / 2; NET.hub.y = NET.H / 2; NET.hub.vx = NET.hub.vy = 0; }

    cx.clearRect(0, 0, NET.W, NET.H);
    const near = NET.focus ? new Set(e.filter(x => x.a.id === NET.focus || x.b.id === NET.focus)
      .flatMap(x => [x.a.id, x.b.id])) : null;
    const dim = id => near && !near.has(id);
    cx.lineWidth = 1;
    e.forEach(x => {
      cx.strokeStyle = dim(x.a.id) && dim(x.b.id) ? 'rgba(128,128,128,.10)' : 'rgba(128,128,128,.34)';
      cx.beginPath(); cx.moveTo(x.a.x, x.a.y); cx.lineTo(x.b.x, x.b.y); cx.stroke();
    });
    const css = getComputedStyle(document.documentElement);
    n.forEach(a => {
      const c = css.getPropertyValue(CLSVAR[a.cls] || '--cls-other').trim() || '#888';
      const r = a === NET.hub ? 9 : 4 + Math.min(4, a.d);
      cx.globalAlpha = dim(a.id) ? .18 : 1;
      cx.fillStyle = c;
      cx.beginPath(); cx.arc(a.x, a.y, r, 0, 6.284); cx.fill();
      if (a.d === 0) { cx.strokeStyle = c; cx.lineWidth = 1; cx.beginPath(); cx.arc(a.x, a.y, r + 4, 0, 6.284); cx.stroke(); }
      if (a === NET.hover || a === NET.hub || a.id === NET.focus || a.d >= 4) {
        cx.fillStyle = css.getPropertyValue('--fg').trim() || '#222';
        cx.font = '11px -apple-system,sans-serif';
        cx.fillText(a.label.slice(0, 12), a.x + r + 3, a.y + 4);
      }
      cx.globalAlpha = 1;
    });
    NET.raf = requestAnimationFrame(loopNet);
  }

  /* ══════════ 화면 ③ SPARQL 플레이그라운드 ══════════ */
  const PRESETS = [
    ['개체와 클래스 전부', `SELECT ?개체 ?클래스 WHERE {\n  ?s a ?클래스 ; rico:name ?개체 .\n} LIMIT 50`],
    ['인물만', `SELECT ?이름 WHERE {\n  ?p a rico:Person ; rico:name ?이름 .\n} ORDER BY ?이름`],
    ['3-홉 (인물 → 직위 → 단체)', `SELECT ?사람 ?직위 ?단체 WHERE {\n  ?p rico:name ?사람 ; rico:occupiesOrOccupied ?pos .\n  ?pos rico:name ?직위 ; rico:existsOrExistedIn ?org .\n  ?org rico:name ?단체 .\n} LIMIT 30`],
    ['날짜가 있는 것', `SELECT ?이름 ?시작 WHERE {\n  ?s rico:name ?이름 ; rico:beginningDate ?시작 .\n} ORDER BY ?시작`],
    ['관계를 하나도 안 이은 개체', `SELECT ?외톨이 WHERE {\n  ?s rico:name ?외톨이 .\n  FILTER NOT EXISTS { ?s ?p ?o . FILTER(isIRI(?o) && ?p != rdf:type) }\n  FILTER NOT EXISTS { ?x ?q ?s . FILTER(?q != rdf:type) }\n}`],
  ];

  function viewSparql() {
    const preds = [...new Set(P3.rels.map(r => r.p))].sort();
    const top = [...P3.ents].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 200);
    const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
    return `<div class="wb"><div class="wbhead"><span class="no">③</span><h3>SPARQL 플레이그라운드</h3>
      <span class="hint">진짜 엔진에서 실행됩니다</span></div>
    <p class="note">먼저 <b>빈칸을 채워</b> 어떤 질의문이 만들어지는지 보고, 그다음 <b>직접 고쳐</b> 보세요.
      내가 2부에서 넣은 트리플이 정말 걸리는지가 여기서 판가름 납니다.</p>

    <div class="p3fill">
      <label>주어<select id="p3s" onchange="p3.fill()">${opt('?s', '?s — 아무거나', true)}
        ${top.map(e => opt(short(e.id), e.label)).join('')}</select></label>
      <label>서술어<select id="p3p" onchange="p3.fill()">${opt('?p', '?p — 아무거나', true)}
        ${preds.map(p => opt('rico:' + p, 'rico:' + p)).join('')}</select></label>
      <label>목적어<select id="p3o" onchange="p3.fill()">${opt('?o', '?o — 아무거나', true)}
        ${top.map(e => opt(short(e.id), e.label)).join('')}</select></label>
    </div>
    <div class="p3btns">${PRESETS.map((p, i) =>
      `<button class="btn sm" onclick="p3.preset(${i})">${esc(p[0])}</button>`).join('')}</div>

    <textarea id="p3q" rows="8" spellcheck="false">SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o .\n} LIMIT 50</textarea>
    <button class="btn sm primary" onclick="p3.run(this)">실행</button>
    <span class="hint" style="margin-left:.5rem">접두사(<code>rico:</code> <code>ric:</code>)는 자동으로 붙습니다</span>
    <div id="p3res"></div></div>`;
  }

  const PFXLINES = PFX.split('\n').length - 1;
  function resultTable(sparql) {
    let r;
    try { r = raw(sparql); } catch (e) {
      // 엔진은 접두사까지 붙인 문자열을 세므로 줄 번호가 앞으로 밀려 있다.
      // 화면에 보이는 질의문 기준으로 되돌려 준다 — 안 그러면 없는 줄을 가리킨다.
      const msg = String(e && e.message ? e.message : e)
        .replace(/at (\d+):(\d+)/g, (m, l, c) => `${Math.max(1, +l - PFXLINES)}번째 줄 ${c}칸`);
      return `<div class="result fail"><b>질의문에 문제가 있습니다</b><br>${esc(msg)}</div>`;
    }
    if (typeof r === 'boolean') return `<div class="result ${r ? 'pass' : 'fail'}">${r ? '참(true)' : '거짓(false)'}</div>`;
    if (!r.length) return `<div class="result fail"><b>0행.</b> 이 그래프에는 그런 트리플이 없습니다.
      질의문이 틀렸을 수도 있고, <b>정말 안 넣었을 수도</b> 있습니다 — 관계망에서 확인해 보세요.</div>`;
    const vars = new Set();
    r.forEach(b => { for (const k of b.keys()) vars.add(k); });
    const V = [...vars];
    const cell = t => {
      if (!t) return '<span class="mut">—</span>';
      if (t.termType === 'NamedNode') {
        const e = P3.byId.get(t.value);
        return e ? `<b>${esc(e.label)}</b> <code class="mut">${esc(short(t.value))}</code>` : `<code>${esc(short(t.value))}</code>`;
      }
      return esc(t.value);
    };
    const body = r.slice(0, 200).map(b => `<tr>${V.map(v => `<td>${cell(b.get(v))}</td>`).join('')}</tr>`).join('');
    return `<p class="note" style="margin-top:.8rem"><b>${r.length}행</b>${r.length > 200 ? ' (앞 200행만 표시)' : ''}</p>
      <div class="scroll"><table><thead><tr>${V.map(v => `<th>?${esc(v)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /* ══════════ 화면 ④ 같은 질문을 둘에게 ══════════ */
  function srcParas() {
    if (!wbReady()) return [];
    return [...DONE.values()].map(v => v.para);
  }

  function viewCmp() {
    const paras = srcParas();
    if (!paras.length) {
      return `<div class="wb"><div class="wbhead"><span class="no">④</span><h3>같은 질문을 둘에게</h3></div>
      <div class="result fail"><b>이 화면은 2부에서 만든 그래프에서만 열립니다.</b>
        비교하려면 <b>같은 원문</b>이 양쪽에 있어야 하기 때문입니다 —
        한쪽은 그 원문에서 뽑은 그래프에 묻고, 다른 쪽은 그 원문을 그냥 읽습니다.</div>
      <p class="note">2부로 가서 단락 하나를 ⑦까지 마친 뒤 다시 오세요.
        예시 그래프(역대 국회의장)는 원문이 아니라 부록 표에서 온 것이라 짝이 없습니다.</p></div>`;
    }
    const has = savedKey();
    return `<div class="wb"><div class="wbhead"><span class="no">④</span><h3>같은 질문을 둘에게</h3>
      <span class="hint">원문 ${paras.length}단락</span></div>
    <p class="note">왼쪽은 <b>내 그래프에 SPARQL로</b> 묻고, 오른쪽은 <b>같은 원문을 그냥 읽은 AI</b>에게 묻습니다.
      어느 쪽이 더 그럴듯한지가 아니라, <b>어느 쪽이 근거를 댈 수 있는지</b>를 보세요.</p>
    <input id="p3ask" placeholder="예: 정세균은 어느 단체에 속했나?" value="이 원문에 나오는 인물과 그들이 속한 단체를 모두 알려 주세요.">
    <button class="btn sm primary" onclick="p3.ask(this)">둘에게 묻기</button>
    ${has ? '' : `<p class="note">오른쪽(AI)은 <b>2부에서 저장한 API 키</b>를 씁니다. 키가 없으면 왼쪽만 답합니다.</p>`}
    <div class="p3cmp">
      <div class="p3col"><h4>그래프에 물은 답</h4><div id="p3ansG"><p class="note">아직 묻지 않았습니다.</p></div></div>
      <div class="p3col"><h4>원문만 읽은 AI</h4><div id="p3ansA"><p class="note">아직 묻지 않았습니다.</p></div></div>
    </div></div>`;
  }

  /* 그래프 쪽 답 — 자연어를 SPARQL로 바꾸지 않는다. 이 사이트에는 그럴 모델이 없고,
     있어도 이 화면의 요점이 아니다. 요점은 "근거가 붙는가"이므로
     그래프가 가진 것을 전부 근거 트리플과 함께 펼쳐 보인다. */
  function graphAnswer() {
    const rs = P3.rels.map(r => {
      const a = P3.byId.get(r.s), b = P3.byId.get(r.o);
      return { a, b, p: r.p };
    });
    if (!rs.length) return `<div class="result fail">이 그래프에는 관계 트리플이 없습니다. <b>모른다고 답합니다</b> — 지어내지 않습니다.</div>`;
    // srcLabel 은 2부가 쓰는 것과 같은 것 — 쪽수가 source 에 이미 들어 있으면 겹쳐 적지 않는다
    const src = srcParas().map(srcLabel).join(' · ');
    return `<div class="result pass"><b>${rs.length}건을 찾았습니다.</b> 전부 근거가 있습니다.</div>
      <ul class="p3ev2">${rs.slice(0, 40).map(r =>
      `<li><b>${esc(r.a.label)}</b> <code>${esc(r.p)}</code> <b>${esc(r.b.label)}</b></li>`).join('')}</ul>
      <p class="note">출처 — ${esc(src)}. 트리플마다 어느 쪽에서 왔는지가 적혀 있어
        <b>틀렸을 때 어디를 고칠지</b> 알 수 있습니다.</p>`;
  }

  /* AI 쪽 — 2부에서 저장한 키·모델을 그대로 쓴다. 여기서는 도구 호출을 강제하지 않는다(자유 서술) */
  async function askText(question, text) {
    const p = provider(), key = savedKey(p), model = savedModel(p);
    if (!key) throw new Error('API 키가 없습니다.');
    const sys = '너는 한국 기록학 자료를 읽는 조수다. 주어진 원문만 근거로 간결하게 답하라. 5문장 이내.';
    const user = `[원문]\n${text}\n\n[질문]\n${question}`;
    if (p === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-api-key': key,
          'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 900, system: sys, messages: [{ role: 'user', content: user }] }),
      });
      if (!r.ok) await httpFail(r);
      const j = await r.json();
      return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    }
    if (p === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
      });
      if (!r.ok) await httpFail(r);
      const j = await r.json();
      return ((j.choices || [])[0] || {}).message?.content || '';
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
    });
    if (!r.ok) await httpFail(r);
    const j = await r.json();
    return (((j.candidates || [])[0] || {}).content?.parts || []).map(x => x.text || '').join('');
  }

  /* ══════════ 바깥에서 부르는 것들 ══════════ */
  window.p3 = {
    tab(k) { P3.tab = k; cancelAnimationFrame(NET.raf); render(); },
    togglePaste() { P3.paste = !P3.paste; render(); },
    async loadWB(b) { b.disabled = true; await load(wbTTL(), `2부에서 만든 내 그래프 (${DONE.size}단락)`); b.disabled = false; },
    async loadSample(b) { b.disabled = true; await load(sampleTTL(), '예시 — 역대 국회의장 전거'); b.disabled = false; },
    async loadPaste(b) {
      const t = ($('#p3ttl').value || '').trim();
      if (!t) { $('#p3msg').className = 'impmsg bad'; $('#p3msg').textContent = 'TTL 을 넣어 주세요.'; return; }
      b.disabled = true; await load(t, '붙여넣은 TTL'); b.disabled = false;
    },
    pickFile(el) {
      const f = el.files && el.files[0];
      if (!f) return;
      f.text().then(t => { $('#p3ttl').value = t; load(t, f.name); });
    },
    focus(id) { P3.tab = 'net'; render(); NET.focus = id; },
    addDates(b) {
      const rowsIn = [...document.querySelectorAll('.p3dates input')]
        .map(i => [i.dataset.id, (i.value || '').trim()]).filter(x => x[1] && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(x[1]));
      if (!rowsIn.length) { alert('연도를 YYYY 또는 YYYY-MM 형식으로 적어 주세요.'); return; }
      const ttl = `@prefix rico: <${RICO}> .\n` +
        rowsIn.map(([id, d]) => `<${id}> rico:beginningDate "${d}" .`).join('\n');
      P3.store.load(ttl, { format: 'text/turtle', base_iri: RIC });
      scan(); b.disabled = true; render();
    },
    fill() {
      const s = $('#p3s').value, p = $('#p3p').value, o = $('#p3o').value;
      const vars = [s, p, o].filter(x => x.startsWith('?'));
      const sel = vars.length ? vars.join(' ') : '*';
      $('#p3q').value = `SELECT ${sel} WHERE {\n  ${s} ${p} ${o} .\n} LIMIT 50`;
    },
    preset(i) { $('#p3q').value = PRESETS[i][1]; },
    run(b) {
      b.disabled = true;
      $('#p3res').innerHTML = resultTable($('#p3q').value);
      b.disabled = false;
    },
    async ask(b) {
      const qs = ($('#p3ask').value || '').trim();
      if (!qs) return;
      $('#p3ansG').innerHTML = graphAnswer();
      const box = $('#p3ansA');
      if (!savedKey()) { box.innerHTML = `<div class="result fail">API 키가 없어 물을 수 없습니다. 2부 ② 단계에서 키를 저장하면 여기서도 씁니다.</div>`; return; }
      b.disabled = true; box.innerHTML = `<p class="note">${esc(PROVIDERS[provider()].label)} 에 묻는 중…</p>`;
      try {
        const text = srcParas().map(p => p.text).join('\n\n');
        const a = await askText(qs, text);
        box.innerHTML = `<div class="p3ai">${esc(a).replace(/\n/g, '<br>')}</div>
          <p class="note">근거 트리플이 없습니다. 맞는지 틀린지는 <b>사람이 원문을 다시 읽어야</b> 압니다.</p>`;
      } catch (e) {
        box.innerHTML = `<div class="result fail">${esc(e.message || e)}</div>`;
      }
      b.disabled = false;
    },
  };
  window.renderPart3 = render;

  addEventListener('resize', () => {
    if (P3.tab === 'time') layoutTime();
    if (P3.tab === 'net' && NET.cv) fitNet();
  });
})();
