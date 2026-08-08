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
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
`;
  /* RiC-O 가 owl:inverseOf 로 짝지어 둔 속성들(프로파일 §4 에서 검증한 9쌍).
     들어오는 관계를 "…인 것" 같은 말을 지어내지 않고 표준이 준 이름으로 부르기 위해 쓴다. */
  const INVERSE = Object.fromEntries([
    ['hasCreator', 'isCreatorOf'], ['hasAuthor', 'isAuthorOf'],
    ['hasOrHadSubject', 'isOrWasSubjectOf'], ['occupiesOrOccupied', 'isOrWasOccupiedBy'],
    ['hasOrHadPosition', 'existsOrExistedIn'], ['isOrWasMemberOf', 'hasOrHadMember'],
    ['includesOrIncluded', 'isOrWasIncludedIn'],
    ['hasOrHadInstantiation', 'isOrWasInstantiationOf'],
    ['isOrWasParticipantIn', 'hasOrHadParticipant'],
  ].flatMap(([a, b]) => [[a, b], [b, a]]));
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

    // 기록 탭이 쓰는 나머지 — 설명·분류·식별자·외부 연결·도판.
    // 2부 산출물에는 거의 없고 오후 백엔드가 낸 TTL 에는 있다. 있으면 쓰고 없으면 만다.
    P3.ents.forEach(e => { e.deg = 0; e.same = []; e.ids = []; });
    P3.rels.forEach(r => { P3.byId.get(r.s).deg++; P3.byId.get(r.o).deg++; });
    rows(`SELECT ?s ?desc ?sc ?cm ?id ?same ?img ?isrc WHERE {
  ?s a [] .
  { ?s rico:generalDescription ?desc } UNION { ?s rico:scopeAndContent ?sc }
  UNION { ?s rdfs:comment ?cm } UNION { ?s rico:identifier ?id }
  UNION { ?s owl:sameAs ?same } UNION { ?s foaf:depiction ?img }
  UNION { ?s rdfs:label ?isrc }
}`).forEach(r => {
      const e = P3.byId.get(r.s);
      if (!e) return;
      if (r.desc || r.sc) e.desc = r.desc || r.sc;
      if (r.cm) e.kind = r.cm;
      if (r.img) e.img = r.img;
      if (r.isrc) e.imgSrc = r.isrc;
      if (r.same) e.same.push(r.same);
      if (r.id) {
        // urn:uuid: 로 시작하는 식별자는 따로 세운다 — 화면에서 다르게 다루기 때문이다
        if (String(r.id).startsWith('urn:uuid:')) e.uuid = String(r.id).slice(9);
        else e.ids.push(r.id);
      }
    });
    P3.ents.forEach(e => { e.same = [...new Set(e.same)]; e.ids = [...new Set(e.ids)]; });
  }

  /* ══════════ 뼈대 ══════════ */
  const TABS = [
    ['rec', '기록 찾아보기'], ['time', '연표'], ['net', '관계망'],
    ['sparql', 'SPARQL · 자연어 질의'], ['lang', '구술의 언어'], ['cmp', '같은 질문을 둘에게'],
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
    if (P3.tab === 'rec') { b.innerHTML = REC.open ? viewItem(REC.open) : viewRecords(); }
    else if (P3.tab === 'time') { b.innerHTML = viewTime(); lastW = -1; layoutTime(); }
    else if (P3.tab === 'net') { b.innerHTML = viewNet(); startNet(); }
    else if (P3.tab === 'sparql') { b.innerHTML = viewSparql(); }
    else if (P3.tab === 'lang') { b.innerHTML = viewLang(); drawLang(); }
    else { b.innerHTML = viewCmp(); }
  }

  /* ══════════ 화면 ⓪ 기록 찾아보기 ══════════
     검색 서버를 두지 않는다. 이미 브라우저에 올라와 있는 그래프를 그대로 색인 삼아 훑는다.
     수천 건까지는 이걸로 충분하다 — 스타터킷의 기록 페이지와 같은 생각이다. */
  const ORDER = ['Record', 'RecordSet', 'Person', 'CorporateBody', 'Position',
    'Event', 'Activity', 'Place', 'Rule', 'Date', 'Agent', 'Group', 'Instantiation'];
  const REC = { q: '', off: new Set(), more: new Set(), open: null };
  const PAGE = 24;

  const hay = e => [e.label, e.desc, e.kind, e.d, e.uuid,
    ...P3.rels.filter(r => r.s === e.id || r.o === e.id)
      .map(r => P3.byId.get(r.s === e.id ? r.o : r.s)?.label || '')].join(' ').toLowerCase();

  function recHit(e) {
    return !REC.off.has(e.cls) && (!REC.q || hay(e).includes(REC.q));
  }
  function mark(s) {
    const t = String(s ?? '');
    if (!REC.q) return esc(t);
    const i = t.toLowerCase().indexOf(REC.q);
    if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + REC.q.length)) + '</mark>' + esc(t.slice(i + REC.q.length));
  }
  const kinds = () => ORDER.filter(c => P3.ents.some(e => e.cls === c))
    .concat([...new Set(P3.ents.map(e => e.cls))].filter(c => !ORDER.includes(c)));

  function viewRecords() {
    const found = P3.ents.filter(recHit);
    const used = kinds();
    return `<div class="wb"><div class="wbhead"><span class="no">⓪</span><h3>기록 찾아보기</h3>
      <span class="hint">${found.length} / ${P3.ents.length}건</span></div>
    <p class="note">검색 서버가 없습니다. 이미 브라우저에 올라와 있는 그래프를 그대로 훑습니다 —
      이름뿐 아니라 <b>이어져 있는 개체의 이름까지</b> 걸립니다.
      카드를 누르면 그 개체가 무엇과 <b>어떤 관계로</b> 이어져 있는지 봅니다.</p>
    <input id="recQ" placeholder="이름 · 설명 · 이어진 개체로 찾기" value="${esc(REC.q)}"
      oninput="p3.recSearch(this.value)">
    <div class="p3facets">${used.map(c => `<button class="chip" aria-current="${!REC.off.has(c)}"
      onclick="p3.recFacet('${c}')"><i style="background:${colorOf(c)}"></i>${CLSKO[c] || c}
      <b>${P3.ents.filter(e => e.cls === c).length}</b></button>`).join('')}</div>
    ${!found.length ? `<div class="result fail">찾은 것이 없습니다. 검색어를 줄이거나 위 유형을 더 켜 보세요.</div>`
        : used.filter(c => found.some(e => e.cls === c)).map(c => {
          const ns = found.filter(e => e.cls === c).sort((a, b) => b.deg - a.deg || a.label.localeCompare(b.label));
          const lim = REC.more.has(c) ? ns.length : PAGE;
          return `<div class="p3grp"><h4><i style="background:${colorOf(c)}"></i>${CLSKO[c] || c}
            <span>${ns.length}</span></h4>
          <div class="p3cards">${ns.slice(0, lim).map(recCard).join('')}</div>
          ${ns.length > lim ? `<button class="btn sm" onclick="p3.recMore('${c}')">${CLSKO[c] || c} ${ns.length - lim}건 더 보기</button>` : ''}
        </div>`;
        }).join('')}</div>`;
  }

  const recCard = e => `<button class="p3card" style="--c:${colorOf(e.cls)}" onclick="p3.item('${esc(e.id)}')">
    ${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : ''}
    <span class="c">${CLSKO[e.cls] || e.cls}</span><b>${mark(e.label)}</b>
    ${e.d ? `<time>${esc(e.d)}${e.e ? ' ~ ' + esc(e.e) : ''}</time>` : ''}
    ${e.desc ? `<p>${mark(String(e.desc).slice(0, 70))}</p>` : ''}
    <i>연결 ${e.deg}${e.same.length ? ` · 외부 ${e.same.length}` : ''}</i></button>`;

  /* 외부 URI 를 사람이 읽는 이름으로. 어디로 가는 링크인지 안 보이면 소용이 없다. */
  const EXT = [
    [/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/, '위키데이터', m => m[1]],
    [/viaf\.org\/viaf\/(\d+)/, 'VIAF', m => m[1]],
    [/ko\.wikipedia\.org\/wiki\/(.+)/, '한국어 위키백과', m => decodeURIComponent(m[1]).replace(/_/g, ' ')],
  ];
  const extName = u => {
    for (const [re, ko, f] of EXT) { const m = String(u).match(re); if (m) return [ko, f(m)]; }
    return ['외부 링크', String(u).replace(/^https?:\/\//, '').slice(0, 40)];
  };

  function viewItem(id) {
    const n = P3.byId.get(id);
    if (!n) return `<div class="wb"><button class="btn sm" onclick="p3.recBack()">← 기록 찾아보기</button>
      <div class="result fail">그런 개체가 없습니다.</div></div>`;

    // 나가는 관계와 들어오는 관계를 나눠 모은다. 방향이 곧 뜻이기 때문이다.
    const out = {}, inn = {};
    P3.rels.forEach(r => {
      if (r.s === id) (out[r.p] ||= []).push(P3.byId.get(r.o));
      if (r.o === id) (inn[r.p] ||= []).push(P3.byId.get(r.s));
    });
    const list = [];
    for (const [p, l] of Object.entries(out)) list.push({ dir: '→', p, l: l.filter(Boolean) });
    for (const [p, l] of Object.entries(inn)) {
      const inv = INVERSE[p];
      list.push({ dir: '←', p: inv || p, l: l.filter(Boolean), made: !inv, from: p });
    }
    const total = list.reduce((s, r) => s + r.l.length, 0);

    const facts = [
      ['유형', `${CLSKO[n.cls] || n.cls} <code>rico:${esc(n.cls)}</code>`],
      n.d && ['날짜', esc(n.d) + (n.e ? ` ~ ${esc(n.e)}` : '')],
      n.kind && ['분류', esc(n.kind)],
      ['식별자', `<code>${esc(short(n.id))}</code>`],
      n.uuid && ['UUID', `<code>${esc(n.uuid)}</code>`],
      n.ids.length && ['그 밖의 식별자', n.ids.map(x => `<code>${esc(x)}</code>`).join(' ')],
      n.same.length && ['동일 개체', n.same.map(u => {
        const [ko, x] = extName(u);
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(ko)} <b>${esc(x)}</b> ↗</a>`;
      }).join(' · ') + `<div class="vdef">owl:sameAs — 다른 데이터셋의 같은 개체.
        대칭·이행 관계라 한 건만 틀려도 멀리 번집니다. 확인한 것만 붙입니다.</div>`],
    ].filter(Boolean);

    return `<div class="wb"><button class="btn sm" onclick="p3.recBack()">← 기록 찾아보기</button>
    <div class="p3item">
      ${n.img ? `<figure><img src="${esc(n.img)}" alt="${esc(n.label)}">
        ${n.imgSrc ? `<figcaption>${esc(n.imgSrc)}</figcaption>` : ''}</figure>` : ''}
      <div><span class="pill c-${n.cls}">${CLSKO[n.cls] || n.cls}</span>
        <h3>${esc(n.label)}</h3>
        ${n.desc ? `<p class="lede">${esc(n.desc)}</p>` : ''}</div>
    </div>
    <table>${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>

    <h4 style="margin-top:1.4rem">연결된 개체 <span class="mut">${total}</span></h4>
    ${total ? list.map(r => `<div class="p3link">
        <div class="rel">${r.dir} ${esc(REL_KO[r.p] || r.p)} <code>rico:${esc(r.p)}</code>
          ${r.made ? `<span class="vdef">— 역속성이 정의돼 있지 않아 <code>rico:${esc(r.from)}</code> 를 뒤집어 읽었습니다</span>` : ''}</div>
        <div class="p3chips">${r.l.map(o => `<button class="p3chip" onclick="p3.item('${esc(o.id)}')">
          <i style="background:${colorOf(o.cls)}"></i>${esc(o.label)}<span>${CLSKO[o.cls] || o.cls}</span></button>`).join('')}</div>
      </div>`).join('')
        : `<div class="result fail">이 개체에는 아직 연결이 없습니다.
             ⑤ 트리플 잇기에서 관계를 넣으면 여기에 쌓입니다 — 그게 이 실습의 목표입니다.</div>`}

    <div class="p3btns" style="margin-top:1.2rem">
      <button class="btn sm" onclick="p3.focus('${esc(n.id)}')">관계망에서 보기 →</button>
      ${yearOf(n.d) ? `<button class="btn sm" onclick="p3.tab('time')">연표에서 보기 →</button>` : ''}
    </div></div>`;
  }

  /* 속성 이름의 한글 — 2부가 쓰는 목록을 그대로 빌려 온다(같은 프로파일이므로) */
  const REL_KO = Object.fromEntries((D.objectProps || []).map(p => [p.t, p.ko]));

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
    // 색은 프레임마다 한 번만 읽는다 — getComputedStyle 을 노드마다 부르면 60fps 가 안 나온다
    const COL = {}, fg = css('--fg');
    n.forEach(a => {
      const v = CLSVAR[a.cls] || '--cls-other';
      const c = COL[v] || (COL[v] = css(v));
      const r = a === NET.hub ? 9 : 4 + Math.min(4, a.d);
      cx.globalAlpha = dim(a.id) ? .18 : 1;
      cx.fillStyle = c;
      cx.beginPath(); cx.arc(a.x, a.y, r, 0, 6.284); cx.fill();
      if (a.d === 0) { cx.strokeStyle = c; cx.lineWidth = 1; cx.beginPath(); cx.arc(a.x, a.y, r + 4, 0, 6.284); cx.stroke(); }
      if (a === NET.hover || a === NET.hub || a.id === NET.focus || a.d >= 4) {
        cx.fillStyle = fg;
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
    return `<div class="wb"><div class="wbhead"><span class="no">③</span><h3>자연어로 묻기</h3>
      <span class="hint">AI 가 SPARQL 을 만들고, 엔진이 실행합니다</span></div>
    <p class="note">묻고 싶은 것을 한국어로 적으면 <b>AI 가 이 그래프의 어휘만 써서 SPARQL 을 만들고</b>,
      그 질의문을 브라우저 안 엔진이 실행합니다. AI 가 답을 지어내는 것이 아니라
      <b>질의 결과만 근거로</b> 정리합니다 — 결과가 0행이면 "없다"고 답합니다.
      만들어진 질의문은 접어 둔 곳에서 그대로 볼 수 있고, 아래 편집기로 가져와 고칠 수 있습니다.</p>
    <div class="p3ask">
      <input id="p3nl" placeholder="예: 정세균이 속한 단체는 어디인가?" value="${esc(P3.nlq || '')}"
        onkeydown="if(event.key==='Enter')p3.askNL(document.querySelector('#p3nlBtn'))">
      <button class="btn sm primary" id="p3nlBtn" onclick="p3.askNL(this)">묻기</button>
    </div>
    <div class="p3btns">${NLQ.map((q, i) =>
      `<button class="btn sm" onclick="p3.askPreset(${i})">${esc(q)}</button>`).join('')}</div>
    ${savedKey() ? '' : `<p class="note"><b>API 키가 없습니다.</b> 2부 ② 단계에서 키를 저장하면 여기서도 씁니다
      (${esc(PROVIDERS[provider()].label)} 기준). 키 없이도 아래 플레이그라운드는 그대로 동작합니다.</p>`}
    <div id="p3nlOut"></div>
    </div>

    <div class="wb"><div class="wbhead"><span class="no">③′</span><h3>SPARQL 플레이그라운드</h3>
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

  /* ══════════ 자연어 질의 ══════════
     스키마를 고정해 두지 않고 **지금 올라와 있는 그래프에서 실제로 쓰인 것만** 뽑아 준다.
     쓰지도 않는 속성을 목록에 넣으면 AI 가 그쪽으로 질의를 만들고 0행이 나온다. */
  const NLQ = ['어떤 인물들이 있나?', '가장 많이 이어진 개체는?', '연도가 있는 것을 순서대로'];

  function liveSchema() {
    const cls = [...new Set(P3.ents.map(e => e.cls))];
    const preds = [...new Set(P3.rels.map(r => r.p))];
    const dp = rows(`SELECT DISTINCT ?p WHERE { ?s ?p ?o . FILTER(isLiteral(?o)) }`)
      .map(r => clsOf(r.p));
    const names = P3.ents.slice(0, 60).map(e => e.label).join(', ');
    return `이 그래프에 실제로 있는 것만 쓴다. 아래에 없는 클래스·속성은 쓰지 마라.
클래스: ${cls.map(c => 'rico:' + c).join(', ')}
객체 속성: ${preds.map(p => 'rico:' + p).join(', ') || '(없음)'}
데이터 속성: ${dp.map(p => (p.includes(':') ? p : 'rico:' + p)).join(', ')}
개체 이름 예시: ${names}`;
  }

  /* 자유 서술을 받는 호출. 2부가 저장해 둔 제공자·키·모델을 그대로 쓴다. */
  async function askText(question, text, sysOverride, maxTok) {
    const p = provider(), key = savedKey(p), model = savedModel(p);
    if (!key) throw new Error('API 키가 없습니다.');
    const sys = sysOverride || '너는 한국 기록학 자료를 읽는 조수다. 주어진 원문만 근거로 간결하게 답하라. 5문장 이내.';
    const user = text ? `[원문]\n${text}\n\n[질문]\n${question}` : question;
    const max = maxTok || 900;
    if (p === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-api-key': key,
          'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: max, system: sys, messages: [{ role: 'user', content: user }] }),
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

  async function runNL(question, out) {
    out.innerHTML = `<p class="note">SPARQL 을 만드는 중…</p>`;
    let sparql = await askText(question, '', `너는 SPARQL 1.1 생성기다. SELECT 질의 하나만 출력한다.
${liveSchema()}
규칙:
- PREFIX 선언은 쓰지 마라(자동으로 붙는다).
- IRI 를 추측하지 마라. 사람·단체·사건은 rico:name 이나 rico:title 로 맞춰라.
  정확한 이름을 모르면 FILTER(CONTAINS(?이름, "키워드")) 를 써라.
- 결과에 사람이 읽을 이름 변수를 반드시 넣어라. 변수명은 한국어로 써도 된다.
- LIMIT 50 을 붙여라. 설명·마크다운 없이 질의문만 출력.`, 700);
    sparql = sparql.replace(/```[a-z]*|```/g, '').trim();

    let res;
    try { res = rows(sparql); } catch (e) {
      out.innerHTML = `<div class="result fail"><b>만들어진 질의문이 실행되지 않았습니다.</b><br>${esc(e.message || e)}</div>
        <pre>${esc(sparql)}</pre>
        <button class="btn sm" onclick="p3.toEditor()">편집기로 가져와 고치기</button>`;
      P3.lastSparql = sparql;
      return;
    }
    P3.lastSparql = sparql;
    out.innerHTML = `<p class="note">답을 정리하는 중… <span class="mut">(질의 결과 ${res.length}행)</span></p>`;
    const answer = res.length
      ? await askText(`질문: ${question}\n\n질의 결과(JSON):\n${JSON.stringify(res.slice(0, 40), null, 1)}`, '',
        '너는 기록연구사다. 주어진 질의 결과만 근거로 한국어로 간결히 답하라. 결과에 없는 내용은 절대 덧붙이지 마라.', 700)
      : '이 그래프에는 해당 정보가 없습니다.';
    out.innerHTML = `<div class="result ${res.length ? 'pass' : 'fail'}" style="margin-top:.8rem">
        ${esc(answer).replace(/\n/g, '<br>')}
        <div class="vdef" style="margin-top:.5rem">근거 트리플 ${res.length}행 · 질의는 브라우저 안 엔진이 실행</div></div>
      <details class="p3det"><summary>만들어진 SPARQL 과 원시 결과</summary>
        <pre>${esc(sparql)}</pre>
        <button class="btn sm" onclick="p3.toEditor()">편집기로 가져오기</button>
        ${resultTable(sparql)}</details>`;
  }

  /* ══════════ 화면 ⑤ 구술의 언어 ══════════
     그래프가 아니라 **원문**을 본다. 그래프는 내가 골라 넣은 것만 담고 있지만,
     원문에는 내가 안 고른 것까지 다 있다. 둘을 나란히 놓는 것이 이 화면의 쓸모다.

     형태소 분석기가 없으므로 조사를 뒤에서 한 번만 떼고, 남는 글자가 2자 이상일 때만 뗀다.
     '종이 → 종' 같은 오작동은 이 길이 조건이 막는다. */
  const STOP = new Set(['그리고', '그런데', '그래서', '하지만', '그러니까', '그러면', '그런', '이런', '저런',
    '것이', '것을', '것은', '그것', '이것', '저것', '무엇', '어떤', '이렇게', '그렇게', '아주', '많이',
    '조금', '지금', '나중', '다시', '거기', '여기', '우리', '자기', '자신', '때문', '경우', '정도',
    '생각', '사람', '이제', '그때', '있다', '없다', '싶은', '싶다', '주는', '주고', '전혀', '중에',
    '이야기', '얘기', '말씀', '그거', '이거', '저는', '제가', '내가', '당시', '이후', '이전', '아니',
    // 한 글자 낱말에 조사가 붙은 꼴. 아래 STRIP 규칙이 못 잡는 것만 손으로 적어 둔다
    // (그 규칙은 여러 조사를 달고 나오는 말만 잡는데, 이것들은 조사 하나만 달고 나온다)
    '술을', '잔도', '질을', '때는', '하나', '그대', '달라', '높이', '먹어', '조금씩', '일하랴',
    '년에', '년도', '말할', '일이', '받는', '있고', '없고', '초선']);
  /* 활용형 꼬리. 명사에는 거의 붙지 않는 것만 골랐다 — '제도·태도' 같은 말을 지우지 않기 위해.
     '어'·'아' 하나만으로 자르면 '언어·용어·단어'가 날아가므로 두 글자 이상만 본다. */
  const VERB_TAIL = /(면서|았는데|었는데|는데|해서|했고|했지|했다|하고|하면|하는|한다|어요|아요|겠다|었다|았다|잖아|거예|거야|보면|보니|으면|했으면|니다|습니|더라|었$|였$|겠$)/;
  const JOSA = ['으로써', '으로서', '에서는', '에게는', '이라는', '이라고', '까지도', '부터는',
    '에서', '에게', '으로', '까지', '부터', '이나', '라도', '한테', '보다', '처럼', '마다', '조차',
    '이란', '이든', '만큼', '이라', '에는', '에도', '와의', '과의',
    '은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '와', '과', '만', '요'];
  /* 한 글자 명사에 조사가 붙은 2글자 토큰('술을')이 문제다. 길이 조건만 두면 안 떨어지고,
     무조건 떼면 '회의 → 회'가 된다. 그래서 손으로 목록을 만드는 대신 말뭉치에게 물어본다 —
     같은 앞글자가 서로 다른 조사를 둘 이상 달고 나타나는지 센다.

     결과를 재 보니 임계값에 걸리는 것은 '술'이 아니라 '것·있·많·년'이었다. 뜻을 담은 낱말은
     짧은 말뭉치에서 조사 하나만 달고 나오고, 형식명사와 어간이 여러 조사를 달고 나오기 때문이다.
     그래서 이 규칙은 떼어 쓰는 규칙이 아니라 **버리는** 규칙으로 쓴다 —
     한 글자로 줄어든 것은 아래 tok 이 길이 조건으로 걸러 낸다. */
  const J1 = ['은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '와', '과', '만', '요'];
  let STRIP = new Set();
  function learnStrip(paras) {
    const seen = {};
    paras.forEach(p => (String(p.text).match(/(?<![가-힣])[가-힣]{2}(?![가-힣])/g) || [])
      .forEach(w => { if (J1.includes(w[1])) (seen[w[0]] ||= new Set()).add(w[1]); }));
    STRIP = new Set(Object.entries(seen).filter(([, s]) => s.size >= 2).map(([k]) => k));
  }
  const stem = w => {
    if (w.length === 2 && J1.includes(w[1]) && STRIP.has(w[0])) return w[0];
    for (const j of JOSA) if (w.length - j.length >= 2 && w.endsWith(j)) return w.slice(0, -j.length);
    return w;
  };
  const tok = t => (String(t).match(/[가-힣]{2,}/g) || [])
    .map(stem).filter(w => w.length >= 2 && !STOP.has(w) && !VERB_TAIL.test(w));

  const LANG = { mode: 'network', built: null, words: [], byPara: [], co: [], paras: [], src: '' };

  /* 원문은 어디서 오는가 — 2부를 돌렸으면 그 단락들, 아니면 실습 원문 8단락 */
  function corpus() {
    const done = srcParas();
    if (done.length) return { paras: done, src: `2부에서 다룬 ${done.length}단락` };
    return { paras: D.paragraphs, src: `실습 원문 ${D.paragraphs.length}단락 (이 그래프의 원문이 아닙니다)` };
  }

  function buildLang() {
    const { paras, src } = corpus();
    const key = paras.map(p => p.id).join('|');
    if (LANG.built === key) return;
    LANG.built = key; LANG.paras = paras; LANG.src = src;
    learnStrip(paras);                 // 토큰을 세기 전에 이 말뭉치의 조사 습관을 먼저 배운다
    const freq = {};
    paras.forEach(p => tok(p.text).forEach(w => freq[w] = (freq[w] || 0) + 1));
    LANG.words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 70).map(([w, n]) => ({ w, n }));
    const keep = new Set(LANG.words.map(x => x.w));
    LANG.byPara = paras.map((p, i) => {
      const f = {}; const ws = tok(p.text); ws.forEach(w => f[w] = (f[w] || 0) + 1);
      return { i, label: p.title ? `${i + 1}. ${p.title}` : `${i + 1}단락`, short: `${i + 1}`, freq: f, total: ws.length, text: p.text };
    });
    const co = new Map();
    paras.forEach(p => String(p.text).split(/(?<=[.!?])\s+/).forEach(sent => {
      const ws = [...new Set(tok(sent))].filter(w => keep.has(w));
      for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++)
        { const k = [ws[i], ws[j]].sort().join(''); co.set(k, (co.get(k) || 0) + 1); }
    }));
    LANG.co = [...co.entries()].map(([k, n]) => { const [a, b] = k.split(''); return { a, b, n }; })
      .sort((x, y) => y.n - x.n).slice(0, 120);
  }

  const LMODES = [
    ['network', '어휘 관계망', '같은 문장에 함께 나온 어휘를 선으로 이었습니다. 원 크기는 빈도. 누르면 그 말이 나온 대목이 뜹니다.'],
    ['flow', '시간대별 흐름', '단락 순서를 가로축으로, 어휘 비중을 쌓아 그렸습니다. 관심사가 어디로 옮겨 가는지 보입니다.'],
    ['print', '문서 지문', '단락 × 어휘 히트맵. 칸을 누르면 그 단락에서 그 말이 나온 문장을 그대로 보여 줍니다.'],
    ['tfidf', '단락별 특징어', '빈도가 아니라 **그 단락에만 유난히 몰린 말**을 뽑습니다. 무엇에 대한 대목인지가 드러납니다.'],
  ];

  function viewLang() {
    buildLang();
    const m = LMODES.find(x => x[0] === LANG.mode);
    return `<div class="wb"><div class="wbhead"><span class="no">⑤</span><h3>구술의 언어</h3>
      <span class="hint">${esc(LANG.src)}</span></div>
    <p class="note">여기는 그래프가 아니라 <b>원문</b>을 봅니다. 그래프에는 내가 고른 것만 들어 있지만
      원문에는 <b>안 고른 것까지</b> 다 있습니다. 자주 나오는데 그래프에 없는 말이 보이면, 그게 다음에 넣을 것입니다.</p>
    <div class="p3btns">${LMODES.map(([k, t]) =>
      `<button class="btn sm ${k === LANG.mode ? 'primary' : ''}" onclick="p3.lang('${k}')">${t}</button>`).join('')}</div>
    <p class="note">${m[2].replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
    <div class="p3stage" id="p3stage"></div>
    <div class="p3src2" id="p3wordsrc"></div></div>`;
  }

  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const PAL = ['--cls-agent', '--cls-record', '--cls-event', '--cls-place', '--cls-other', '--accent'];

  function drawLang() {
    const stage = $('#p3stage');
    if (!stage) return;
    stage.innerHTML = '';
    if (!LANG.words.length) { stage.innerHTML = `<p class="note">원문에서 쓸 만한 어휘를 못 찾았습니다.</p>`; return; }
    ({ network: lNetwork, flow: lFlow, print: lPrint, tfidf: lTfidf })[LANG.mode](stage);
  }
  function svgEl(stage, w, h) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    stage.appendChild(s); return s;
  }
  const bindWords = s => s.querySelectorAll('[data-w]').forEach(g =>
    g.onclick = () => wordSource(g.dataset.w, g.dataset.p ? +g.dataset.p : null));

  function lNetwork(stage) {
    const W = 1000, H = 470, s = svgEl(stage, W, H);
    const idx = new Map(LANG.words.map((w, i) => [w.w, i]));
    const N = LANG.words.map((w, i) => ({
      ...w, x: W / 2 + Math.cos(i * 2.4) * (120 + (i % 9) * 32),
      y: H / 2 + Math.sin(i * 2.4) * (90 + (i % 7) * 26), vx: 0, vy: 0,
    }));
    const E = LANG.co.filter(e => idx.has(e.a) && idx.has(e.b))
      .map(e => ({ a: N[idx.get(e.a)], b: N[idx.get(e.b)], n: e.n }));
    for (let it = 0; it < 220; it++) {
      E.forEach(e => {
        const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - 70) * .006 * Math.min(e.n, 3);
        e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f;
      });
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
        const dx = N[j].x - N[i].x, dy = N[j].y - N[i].y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2);
        const f = 900 / d2;
        N[i].vx -= dx / d * f; N[i].vy -= dy / d * f; N[j].vx += dx / d * f; N[j].vy += dy / d * f;
      }
      N.forEach(n => {
        n.vx += (W / 2 - n.x) * .0016; n.vy += (H / 2 - n.y) * .0016;
        n.x += n.vx *= .82; n.y += n.vy *= .82;
        n.x = Math.max(46, Math.min(W - 46, n.x)); n.y = Math.max(26, Math.min(H - 26, n.y));
      });
    }
    const max = LANG.words[0].n;
    s.innerHTML = E.map(e => `<line x1="${e.a.x}" y1="${e.a.y}" x2="${e.b.x}" y2="${e.b.y}"
        stroke="${css('--line')}" stroke-width="${Math.min(e.n, 3)}" opacity=".6"/>`).join('')
      + N.map((n, i) => {
        const r = 5 + (n.n / max) * 20, col = css(PAL[i % PAL.length]);
        return `<g data-w="${esc(n.w)}" style="cursor:pointer">
          <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${col}" opacity=".22"/>
          <circle cx="${n.x}" cy="${n.y}" r="${r * .45}" fill="${col}"/>
          <text x="${n.x}" y="${n.y - r - 4}" text-anchor="middle" font-size="${11 + (n.n / max) * 9}"
            fill="${css('--fg')}">${esc(n.w)}</text></g>`;
      }).join('');
    bindWords(s);
  }

  /* 시간대별 흐름 — 띠 이름이 서로 겹치던 문제를 고쳤다.
     ① 이름을 가운데 칸이 아니라 **그 띠가 가장 두꺼운 칸**에 놓는다
     ② 글자가 들어갈 만큼 두껍지 않은 띠는 아예 안 적고 아래 범례로 보낸다
     ③ 그래도 가까이 붙은 것끼리는 세로로 밀어 떼어 놓는다 */
  function lFlow(stage) {
    const W = 1000, H = 470, s = svgEl(stage, W, H);
    const top = LANG.words.slice(0, 12), ch = LANG.byPara;
    const series = top.map(w => ch.map(c => (c.freq[w.w] || 0) / Math.max(c.total, 1)));
    const nx = i => 70 + (i / Math.max(ch.length - 1, 1)) * (W - 130);
    const stackTop = ch.map((_, ci) => series.reduce((a, sv) => a + sv[ci], 0));
    const maxStack = Math.max(...stackTop, .001);
    const HH = H - 96;
    const acc = ch.map(() => 0);
    const bands = series.map((sv, si) => {
      const up = [], dn = [], thick = [];
      sv.forEach((v, ci) => {
        const y0 = H - 46 - (acc[ci] / maxStack) * HH;
        const y1 = H - 46 - ((acc[ci] + v) / maxStack) * HH;
        up.push([nx(ci), y1]); dn.unshift([nx(ci), y0]); thick.push({ ci, t: y0 - y1, mid: (y0 + y1) / 2 });
        acc[ci] += v;
      });
      const line = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join('');
      const best = thick.reduce((a, b) => b.t > a.t ? b : a, thick[0]);
      return { d: line(up) + line(dn).replace('M', 'L') + 'Z', col: css(PAL[si % PAL.length]),
        w: top[si].w, x: nx(best.ci), y: best.mid, t: best.t };
    });
    // ② 12px 보다 얇으면 글자를 얹지 않는다 — 얹어 봐야 띠 밖으로 삐져나온다
    const shown = bands.filter(b => b.t >= 12).sort((a, b) => a.y - b.y);
    const hidden = bands.filter(b => b.t < 12);
    // ③ 가로로 100px 안에 있으면서 세로로 16px 안에 붙은 것은 밀어 떼어 놓는다
    for (let i = 1; i < shown.length; i++) {
      const a = shown[i - 1], b = shown[i];
      if (Math.abs(b.x - a.x) < 100 && b.y - a.y < 16) b.y = a.y + 16;
    }
    s.innerHTML = bands.map(b => `<path d="${b.d}" fill="${b.col}" opacity=".55"/>`).join('')
      + ch.map((c, i) => `<text x="${nx(i)}" y="${H - 22}" text-anchor="middle" font-size="11"
          fill="${css('--muted')}">${esc(c.short)}</text>`).join('')
      + `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="${css('--muted')}">단락 순서 →</text>`
      + shown.map(b => `<text x="${b.x}" y="${b.y + 4}" text-anchor="middle" font-size="12.5"
          fill="${css('--fg')}" stroke="${css('--bg')}" stroke-width="3.2" paint-order="stroke"
          style="cursor:pointer" data-w="${esc(b.w)}">${esc(b.w)}</text>`).join('');
    bindWords(s);
    if (hidden.length) {
      const box = document.createElement('div');
      box.className = 'p3legend';
      box.innerHTML = `<span class="mut">띠가 얇아 이름을 못 적은 어휘</span> ` + hidden.map(b =>
        `<button data-w="${esc(b.w)}"><i style="background:${b.col}"></i>${esc(b.w)}</button>`).join('');
      stage.appendChild(box);
      bindWords(box);
    }
  }

  /* 문서 지문 — 칸을 누르면 그 단락에서 그 말이 나온 문장을 그대로 보여 준다.
     예전에는 왼쪽 어휘 이름만 눌렸고 칸에는 툴팁뿐이었다. 정작 궁금한 것은 '이 칸이 왜 진한가'다. */
  function lPrint(stage) {
    const top = LANG.words.slice(0, 22), ch = LANG.byPara;
    const W = 1000, H = 470, s = svgEl(stage, W, H);
    const cw = (W - 170) / ch.length, rh = Math.min(17, (H - 80) / top.length);
    const max = Math.max(...top.map(w => Math.max(...ch.map(c => c.freq[w.w] || 0))), 1);
    s.innerHTML = top.map((w, ri) => ch.map((c, ci) => {
      const n = c.freq[w.w] || 0;
      return `<rect x="${150 + ci * cw}" y="${34 + ri * rh}" width="${cw - 2}" height="${rh - 2}" rx="2"
        fill="${css('--accent')}" opacity="${.06 + (n / max) * .9}" style="cursor:pointer"
        data-w="${esc(w.w)}" data-p="${ci}"><title>${esc(w.w)} · ${esc(c.label)} · ${n}회 (눌러 보기)</title></rect>`;
    }).join('')).join('')
      + top.map((w, ri) => `<text x="142" y="${34 + ri * rh + rh * .72}" text-anchor="end" font-size="11"
          fill="${css('--fg')}" style="cursor:pointer" data-w="${esc(w.w)}">${esc(w.w)}</text>`).join('')
      + ch.map((c, ci) => `<text x="${150 + ci * cw + cw / 2}" y="24" text-anchor="middle" font-size="10.5"
          fill="${css('--muted')}">${esc(c.short)}</text>`).join('');
    bindWords(s);
  }

  /* 단락별 특징어 — 빈도가 아니라 tf-idf. 빈도만 보면 어느 단락이든 '국회'가 1등이라
     단락끼리 구별이 안 된다. 그 단락에만 몰린 말을 뽑아야 무엇에 대한 대목인지 드러난다. */
  function lTfidf(stage) {
    const ch = LANG.byPara, N = ch.length;
    const df = {};
    ch.forEach(c => Object.keys(c.freq).forEach(w => df[w] = (df[w] || 0) + 1));
    // 단락이 하나뿐이면 idf 가 상수라 tf-idf 가 뜻을 잃는다 — 그때는 빈도순이라고 밝히고 빈도로 보인다
    const one = N === 1;
    const cols = ch.map(c => {
      const sc = Object.entries(c.freq)
        .filter(([, n]) => n >= 2)
        .map(([w, n]) => ({ w, n, s: one ? n : (n / Math.max(c.total, 1)) * Math.log((N + 1) / (df[w] || 1)) }))
        .sort((a, b) => b.s - a.s).slice(0, 7);
      return { c, sc };
    });
    const maxS = Math.max(...cols.flatMap(x => x.sc.map(y => y.s)), 1e-9);
    stage.innerHTML = `<div class="p3tfidf">${cols.map(({ c, sc }) => `<div>
      <h5>${esc(c.label)}${one ? ' <span class="mut">· 빈도순</span>' : ''}</h5>
      ${sc.length ? sc.map(x => `<button data-w="${esc(x.w)}" data-p="${c.i}"
        style="--v:${(x.s / maxS).toFixed(3)}">${esc(x.w)}<i>${x.n}</i></button>`).join('')
        : `<span class="mut">두 번 이상 나온 말이 없습니다</span>`}
    </div>`).join('')}</div>`;
    bindWords(stage);
  }

  /* 어휘 하나를 누르면 — 원문의 그 문장을 그대로 보여 준다.
     단락을 지정하면 그 단락만, 아니면 나온 단락을 모두 훑는다. */
  function wordSource(w, pi) {
    const box = $('#p3wordsrc');
    if (!box) return;
    const src = (pi == null ? LANG.byPara : [LANG.byPara[pi]]).filter(Boolean);
    const out = [];
    src.forEach(c => {
      String(c.text).split(/(?<=[.!?])\s+|\n+/).forEach(sent => {
        if (sent.includes(w) && out.length < 6) out.push({ c, sent: sent.trim() });
      });
    });
    // 조사가 붙은 꼴(정세균이·정세균은)도 잡히므로 원형만으로 못 찾을 때가 있다
    if (!out.length) src.forEach(c => {
      if (String(c.text).includes(w) && out.length < 3) out.push({ c, sent: String(c.text).slice(0, 160) + '…' });
    });
    const hl = t => esc(t).replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<mark>${esc(w)}</mark>`);
    const inGraph = P3.ents.filter(e => e.label.includes(w));
    box.innerHTML = out.length
      ? `<h5>“${esc(w)}”가 나온 대목 <span class="mut">${pi == null ? '전체' : LANG.byPara[pi].label}</span></h5>
         ${out.map(o => `<p><b>${esc(o.c.short)}</b> ${hl(o.sent.slice(0, 220))}</p>`).join('')}
         ${inGraph.length
        ? `<p class="ok2">그래프에 있습니다 — ${inGraph.slice(0, 4).map(e =>
          `<button class="p3chip" onclick="p3.item('${esc(e.id)}')"><i style="background:${colorOf(e.cls)}"></i>${esc(e.label)}<span>${CLSKO[e.cls] || e.cls}</span></button>`).join('')}</p>`
        : `<p class="bad2"><b>이 말은 그래프에 없습니다.</b> 원문에 이만큼 나오는데 개체로 안 뽑았다면,
             빠뜨린 것인지 뽑지 않기로 한 것인지 판단할 자리입니다.</p>`}`
      : `<p class="mut">“${esc(w)}” 원문을 찾지 못했습니다.</p>`;
    box.scrollIntoView({ block: 'nearest' });
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

  /* ══════════ 바깥에서 부르는 것들 ══════════ */
  window.p3 = {
    tab(k) { P3.tab = k; if (k !== 'rec') REC.open = null; cancelAnimationFrame(NET.raf); render(); },
    togglePaste() { P3.paste = !P3.paste; render(); },

    /* 기록 */
    recSearch(v) { REC.q = v.trim().toLowerCase(); REC.more.clear(); paint(); $('#recQ')?.focus(); },
    recFacet(c) { REC.off.has(c) ? REC.off.delete(c) : REC.off.add(c); REC.more.clear(); paint(); },
    recMore(c) { REC.more.add(c); paint(); },
    item(id) { P3.tab = 'rec'; REC.open = id; render(); scrollTo({ top: 0, behavior: 'smooth' }); },
    recBack() { REC.open = null; render(); },

    /* 언어 */
    lang(k) { LANG.mode = k; paint(); },

    /* 자연어 질의 */
    async askNL(b) {
      const q = ($('#p3nl').value || '').trim();
      if (!q) return;
      P3.nlq = q;
      const out = $('#p3nlOut');
      if (!savedKey()) {
        out.innerHTML = `<div class="result fail">API 키가 없어 물을 수 없습니다.
          2부 ② 단계에서 키를 저장하면 여기서도 씁니다.</div>`;
        return;
      }
      b.disabled = true;
      try { await runNL(q, out); }
      catch (e) { out.innerHTML = `<div class="result fail">${esc(e.message || e)}</div>`; }
      b.disabled = false;
    },
    askPreset(i) { $('#p3nl').value = NLQ[i]; p3.askNL($('#p3nlBtn')); },
    toEditor() {
      if (!P3.lastSparql) return;
      const t = $('#p3q');
      t.value = P3.lastSparql;
      t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
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
