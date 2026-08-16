/* 3부 · 트리플이 화면이 될 때
   2부가 낸 TTL 을 브라우저 안 SPARQL 엔진에 올려 연표·관계망·질의를 띄운다.
   여기서는 코딩을 하지 않는다 — 그래프에 있는 것만 그리고, 없는 것은 없는 대로 둔다.
   "안 보이는 것"이 이 부의 교재다.

   엔진은 스타터킷과 같은 Oxigraph(브라우저 안에서 도는 SPARQL 1.1)다.
   다만 이 사이트는 오프라인에서도 돌아야 하므로 CDN 이 아니라 vendor/ 에 동봉한 것을 쓴다. */
(function () {
  'use strict';

  const RICO = 'https://www.ica.org/standards/RiC/ontology#';
  const RIC = 'http://archives.nanet.go.kr/id/';
  const SKOS = 'http://www.w3.org/2004/02/skos/core#';
  const PFX = `PREFIX rico: <${RICO}>
PREFIX ric:  <${RIC}>
PREFIX skos: <${SKOS}>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
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
  /* 클래스마다 다른 색 — 범례에서 항목이 서로 구분되어야 한다.
     인물·단체·직위가 모두 같은 파랑이면 범례가 있으나 마나다.
     1부의 .c-* 색을 그대로 따르고(사이트 전체가 같은 색을 쓰도록),
     1부에서도 색을 나눠 쓰던 기록집합·구현체·활동·규칙만 전용 색을 새로 얻는다. */
  const CLSVAR = {
    Person: '--cls-agent', Agent: '--cls-agent',
    CorporateBody: '--cls-group', Group: '--cls-group',
    Position: '--cls-position',
    Record: '--cls-record', RecordSet: '--cls-recordset', Instantiation: '--cls-instantiation',
    Event: '--cls-event', Activity: '--cls-activity',
    Place: '--cls-place',
    Rule: '--cls-rule', Date: '--cls-other',
  };
  const CLSKO = {
    Person: '인물', CorporateBody: '단체', Position: '직위', Event: '사건', Activity: '활동',
    Place: '장소', Record: '기록', RecordSet: '기록집합', Rule: '규칙', Date: '날짜',
    Agent: '행위자', Group: '집단', Instantiation: '구현체',
    // 2부 ⑤ 시소러스 매핑이 낸 skos:Concept/ConceptScheme — RiC-O 밖 어휘라 clsOf() 가
    // 프리픽스를 벗기지 않고 'skos:…' 형태로 넘기므로 키도 그 형태로 맞춘다.
    'skos:Concept': '개념', 'skos:ConceptScheme': '개념체계',
  };
  const short = u => String(u).startsWith(RICO) ? 'rico:' + u.slice(RICO.length)
    : String(u).startsWith(RIC) ? 'ric:' + u.slice(RIC.length)
    : String(u).startsWith(SKOS) ? 'skos:' + u.slice(SKOS.length) : String(u);
  const clsOf = u => String(u).startsWith(RICO) ? u.slice(RICO.length) : short(u);
  /* 화면에 클래스·서술어를 코드로 다시 보여줄 때 쓴다. clsOf() 는 RICO 는 접두사를 벗겨
     돌려주고(그래서 아래서 "rico:"를 도로 붙여야 했다) SKOS 등은 short() 가 이미
     "skos:" 를 붙여 돌려준다 — 이미 붙어 있으면 또 붙이지 않는다. */
  const qname = c => String(c).includes(':') ? c : 'rico:' + c;
  const colorOf = c => `var(${CLSVAR[c] || '--cls-other'})`;
  const yearOf = d => { const m = /(\d{4})/.exec(String(d || '')); return m ? +m[1] : null; };
  const monthOf = d => { const m = /^\d{4}-(\d{2})/.exec(String(d || '')); return m ? +m[1] : 1; };

  /* ══════════ 상태 ══════════ */
  const P3 = {
    Store: null, store: null,          // 엔진 · 적재된 그래프
    srcName: '', srcText: '',          // 어느 TTL 을 올렸는지
    ents: [], rels: [], byId: new Map(),
    prov: new Map(),                   // 개체 → 2부의 어느 단락에서 왔는가
    tab: 'rec',
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

  /* 출처는 TTL 에 주석(# 출처: …)으로만 적히므로 파서를 지나면 사라진다.
     그렇다고 표준에 없는 술어를 지어내 그래프에 넣을 수는 없다 —
     이 사이트는 확인한 RiC-O 어휘만 쓰기로 했다.
     그래서 2부에서 올릴 때만 DONE 에서 곁표를 따로 만들어 화면에서 쓴다.
     붙여넣은 TTL·예시에는 출처가 없으므로 비워 둔다(없으면 없다고 말한다). */
  function buildProv() {
    P3.prov = new Map();
    if (typeof DONE === 'undefined') return;
    for (const v of DONE.values()) {
      (v.ents || []).forEach(e => {
        const k = idOf(e.surface);
        if (!P3.prov.has(k)) P3.prov.set(k, {
          paraId: v.para.id, title: v.para.title,
          label: srcLabel(v.para), page: v.para.page,
        });
      });
    }
  }
  const provOf = id => P3.prov && P3.prov.get(short(id));

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
      P3.prov = new Map();             // 앞서 올린 그래프의 출처가 남지 않게 비운다(2부에서 올리면 곧 다시 채운다)
      /* 그래프를 올리면 '기록 찾아보기'에서 시작한다 — 무엇이 들어왔는지 목록으로 먼저 보고,
         거기서 연표·관계망으로 건너가는 것이 순서다. 연표부터 열면 날짜가 없을 때 빈 화면을 먼저 만난다. */
      P3.tab = 'rec'; REC.open = null;
      scan();
      say(`${name} — 개체 ${P3.ents.length} · 관계 ${P3.rels.length} · 트리플 ${st.size} 을 올렸습니다.`, 'ok');
      render();          // render() 가 상자를 새로 만들므로 문구는 P3.msg 에서 다시 그려진다
      if (window.syncHash) syncHash();   // 주소도 지금 탭(#3-rec)에 맞춘다
    } catch (e) {
      // Turtle 문법 오류는 엔진이 몇 줄인지까지 말해 준다 — 붙여넣기가 깨지는 가장 흔한 이유다
      say('TTL 을 읽지 못했습니다 — ' + (e && e.message ? e.message : e), 'bad');
    }
  }

  function scan() {
    // skos:prefLabel 은 rico:name/title 이 없는 개체(2부 ⑤ 시소러스 매핑이 낸 skos:Concept)일 때만
    // 쓰는 마지막 대안이다 — 기존 RiC-O 개체의 라벨 우선순위는 그대로 둔다.
    P3.ents = rows(`SELECT ?s ?c ?nm ?ti ?pref ?d ?e WHERE {
  ?s a ?c .
  OPTIONAL { ?s rico:name ?nm }
  OPTIONAL { ?s rico:title ?ti }
  OPTIONAL { ?s skos:prefLabel ?pref }
  OPTIONAL { ?s rico:beginningDate ?d }
  OPTIONAL { ?s rico:endDate ?e }
}`).map(r => ({
      id: r.s, cls: clsOf(r.c), label: r.nm || r.ti || r.pref || short(r.s),
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
    // 2부 산출물에는 거의 없고 아카이브시스템 백엔드가 낸 TTL 에는 있다. 있으면 쓰고 없으면 만다.
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
    ${/* 아직 올린 그래프가 없으면 올릴 수 있는 길을 모두 깜빡인다 —
          2부 ①에서 원문을 고르는 자리와 같은 성격이라 표시도 같게 준다.
          2부를 아직 안 했으면 그 단추는 꺼져 있으므로 예시만 깜빡인다. */''}
    <div class="p3btns">
      <button class="btn sm ${st ? 'primary' : ''} ${!P3.store && st ? 'next' : ''}" onclick="p3.loadWB(this)" ${st ? '' : 'disabled title="2부에서 ⑧ 산출까지 한 단락을 마치면 켜집니다"'}>
        2부에서 만든 내 그래프${st ? ` (${st.p}단락 · 트리플 ${st.t})` : ''}</button>
      <button class="btn sm ${P3.store ? '' : 'next'}" onclick="p3.loadSample(this)">예시 — 역대 국회의장 전거</button>
      <button class="btn sm" onclick="p3.togglePaste()">TTL 붙여넣기 / 파일 열기</button>
    </div>
    ${P3.paste ? pastePanel() : ''}
    <p class="impmsg ${P3.msg ? P3.msg.kind : ''}" id="p3msg">${P3.msg ? esc(P3.msg.text) : ''}</p></div>`;
  }

  function pastePanel() {
    return `<div class="p3paste">
      <p class="note" style="margin-top:.6rem">아카이브시스템 백엔드(<code>localhost:3100</code>)의
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

    const pv = provOf(n.id);
    const facts = [
      ['유형', `${CLSKO[n.cls] || n.cls} <code>${esc(qname(n.cls))}</code>`],
      /* 이 개체가 어느 원문에서 나왔는지. 눌러서 2부의 그 단락으로 되돌아갈 수 있다 —
         "근거를 대라"는 이 사이트의 원칙을 화면에서도 지킨다. */
      pv && ['출처', `${esc(pv.label)}
        <button class="lnk" onclick="p3.toSource('${esc(pv.paraId)}')">2부에서 이 단락 보기 →</button>`],
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
        <div class="rel">${r.dir} ${esc(REL_KO[r.p] || r.p)} <code>${esc(qname(r.p))}</code>
          ${r.made ? `<span class="vdef">— 역속성이 정의돼 있지 않아 <code>${esc(qname(r.from))}</code> 를 뒤집어 읽었습니다</span>` : ''}</div>
        <div class="p3chips">${r.l.map(o => `<button class="p3chip" onclick="p3.item('${esc(o.id)}')">
          <i style="background:${colorOf(o.cls)}"></i>${esc(o.label)}<span>${CLSKO[o.cls] || o.cls}</span></button>`).join('')}</div>
      </div>`).join('')
        : `<div class="result fail">이 개체에는 아직 연결이 없습니다.
             ⑥ 트리플 잇기에서 관계를 넣으면 여기에 쌓입니다 — 그게 이 실습의 목표입니다.</div>`}

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
      <p class="note">2부 ⑥ 은 <b>개체를 잇는 속성</b>만 다뤘습니다. 날짜 같은 데이터 속성은 거기서 안 붙였으니
        여기가 비는 것이 정상입니다. 아래에서 달아 보면 같은 그래프가 연표가 됩니다.</p>
      ${dateEditor()}</div>`;
    }
    const y0 = yearOf(has[0].d), y1 = Math.max(...has.map(e => yearOf(e.e) || yearOf(e.d)));
    return `<div class="wb"><div class="wbhead"><span class="no">①</span><h3>연표</h3>
      <span class="hint">${y0}–${y1} · ${has.length}건</span></div>
    <p class="note"><code>rico:beginningDate</code> 가 있는 개체만 올라옵니다.
      ${miss > 0 ? `날짜를 안 단 <b>${miss}개</b>는 여기 없습니다 — 없는 것이 아니라 <b>안 보이는 것</b>입니다.` : '이 그래프는 모든 개체에 날짜가 있습니다.'}
      막대를 누르면 그 개체의 기록으로 갑니다 — 거기서 출처와 관계망으로 이어집니다.</p>
    <div class="p3time" id="p3time">${has.map((e, i) => {
      const pv = provOf(e.id);
      return `<button class="p3ev" data-i="${i}" style="color:${colorOf(e.cls)}" onclick="p3.go('${esc(e.id)}')"
        title="${esc(e.label)} · ${esc(e.d)}${e.e ? ' ~ ' + esc(e.e) : ''}${pv ? ' · 출처 ' + esc(pv.label) : ''}">
        <i>${esc(String(e.d).slice(0, 4))}</i>${esc(e.label)}</button>`;
    }).join('')}
      <div class="p3axis" id="p3axis"></div></div>
    ${miss > 0 ? dateEditor() : ''}</div>`;
  }

  /* 날짜를 달아 보는 자리 — 넣으면 곧바로 위 연표가 다시 그려진다.
     "빠진 것이 보인다 → 고친다 → 화면이 달라진다"가 이 부의 한 바퀴다. */
  function dateEditor() {
    const no = P3.ents.filter(e => !yearOf(e.d)).slice(0, 40);
    if (!no.length) return '';
    return `<details class="p3det"><summary>날짜를 달아 보기 (${no.length}개)</summary>
      <p class="note">연도만 적어도 됩니다(예: <code>1996</code>). 적은 값은 <code>rico:beginningDate</code> 트리플로
        이 그래프에 들어갑니다 — 파일은 건드리지 않습니다.
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
  const NET = { n: [], e: [], raf: 0, cv: null, cx: null, W: 0, H: 0, hover: null, focus: null, t: 0, ro: null, hub: null, named: new Set() };

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
    // 연결이 많은 개체는 호버하지 않아도 이름을 보인다. 예전의 절대 기준(d>=4)은
    // 트리플이 몇 개뿐인 실습 그래프에서 아무것도 걸리지 않아 이름이 하나도 안 떴다 —
    // 순위로 골라 그래프가 성글든 빽빽하든 늘 주요 노드에 이름이 붙게 한다.
    NET.named = new Set([...NET.n].filter(n => n.d > 0)
      .sort((a, b) => b.d - a.d).slice(0, 10).map(n => n.id));
    fitNet();
    cv.onmousemove = ev => {
      const r = cv.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      NET.hover = NET.n.find(n => Math.hypot(n.x - mx, n.y - my) < 14) || null;
      const tip = $('#p3tip');
      if (NET.hover) {
        tip.style.display = 'block'; tip.style.left = (mx + 12) + 'px'; tip.style.top = (my + 10) + 'px';
        const pv = provOf(NET.hover.id);
        tip.innerHTML = `<b>${esc(NET.hover.label)}</b><br><span class="pill c-${NET.hover.cls}">${CLSKO[NET.hover.cls] || NET.hover.cls}</span> · 관계 ${NET.hover.d}`
          + (pv ? `<br><span class="p3src">출처 ${esc(pv.label)}</span>` : '')
          + `<br><span class="vdef">누르면 골라내고, 한 번 더 누르면 기록으로</span>`;
      } else tip.style.display = 'none';
    };
    cv.onmouseleave = () => { NET.hover = null; const t = $('#p3tip'); if (t) t.style.display = 'none'; };
    /* 한 번 누르면 그 개체만 남기고(맥락을 보고), 이미 골라 둔 점을 다시 누르면
       기록 상세로 넘어간다 — 관계망에서 본 것을 근거까지 따라갈 수 있도록. */
    cv.onclick = () => {
      if (!NET.hover) { NET.focus = null; return; }
      if (NET.focus === NET.hover.id) p3.go(NET.hover.id);
      else NET.focus = NET.hover.id;
    };
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
    // 크기가 그대로면 아무것도 하지 않는다. cv.width 를 다시 넣는 순간 캔버스가 지워지는데,
    // 이 함수는 ResizeObserver 가 부르므로 폭이 같아도 여러 번 불릴 수 있다 —
    // 그때마다 지우면 그리는 중간에 화면이 비어 점과 선이 깜빡인다. (연표의 lastW 와 같은 장치)
    if (Math.abs(r.width - NET.W) < .5 && Math.abs(r.height - NET.H) < .5) return;
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
        // 완전히 겹친 두 점(같은 해시로 같은 자리에서 출발했거나 가운데로 몰린 경우).
        // 여기서 매 프레임 새 난수를 뽑으면 방향이 계속 바뀌어 점이 영영 안정되지 못하고
        // 제자리에서 떨리는 것처럼 보인다 — 짝마다 고정된 방향으로 밀어 한 번에 떼어 놓는다.
        if (d2 < 1) { d2 = 1; const t = (i * 31 + j) % 628 / 100; dx = Math.cos(t); dy = Math.sin(t); }
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
      /* 한 틱에 움직일 수 있는 거리를 묶는다.
         가까이서 출발한 점들은 반발력이 520/거리² 라 첫 프레임에 100px 넘게 튄다 —
         점과 선이 화면을 가로질러 순간이동하니 눈에는 깜빡이는 것으로 보인다.
         (특히 관계망을 처음 열었을 때 가운데 몰린 점들에서 두드러졌다)
         속도만 묶어 두면 같은 자리로 수렴하되 튀지 않고 밀려 나간다. */
      const sp = Math.hypot(a.vx, a.vy);
      if (sp > 6) { a.vx = a.vx / sp * 6; a.vy = a.vy / sp * 6; }
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
      if (a === NET.hover || a === NET.hub || a.id === NET.focus || NET.named.has(a.id)) {
        cx.font = '11px -apple-system,sans-serif';
        // 이름이 여러 개 뜨면 선·점 위에 겹쳐 읽기 어렵다 — 배경색으로 한 번 두르고 글자를 얹는다
        cx.lineWidth = 3; cx.strokeStyle = css('--bg'); cx.lineJoin = 'round';
        cx.strokeText(a.label.slice(0, 12), a.x + r + 3, a.y + 4);
        cx.fillStyle = fg;
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

  /* 어휘 목록과 문법 예제는 **지금 올라와 있는 그래프**에서 뽑는다.
     고정 예제를 박아 두면 2부 산출물처럼 어휘가 다른 그래프에서는 전부 0행이 나오고,
     "내가 틀렸나" 하고 붙들리게 된다. 예제가 늘 걸리려면 예제도 데이터를 따라가야 한다. */
  function probe() {
    const p = {};
    // 이름이 실제로 붙어 있고 관계도 걸린 개체를 고른다.
    // 외톨이나 이름 없는 개체를 고르면 그 개체를 쓰는 예제가 통째로 0행이 된다.
    const named = new Set(rows(`SELECT ?s WHERE { ?s rico:name ?n }`).map(r => r.s));
    const from = new Set(P3.rels.map(r => r.s));
    // ⑦ 다단계가 정말 2홉이 되려면, 목적어가 다시 어딘가로 뻗는 관계에서 출발해야 한다.
    // 막다른 관계를 고르면 ⑦ 이 1홉으로 주저앉아 "이어 가기"를 못 보여 준다.
    const rel = P3.rels.find(r => named.has(r.s) && from.has(r.o))
      || P3.rels.find(r => named.has(r.s)) || P3.rels[0] || null;
    p.e1 = rel ? P3.byId.get(rel.s) : P3.ents.find(e => named.has(e.id)) || P3.ents[0] || null;
    p.r1 = rel ? qname(rel.p) : '?서술어';
    p.o1 = rel ? short(rel.o) : '?대상';
    const rel2 = rel ? P3.rels.find(r => r.s === rel.o) : null;
    p.r2 = rel2 ? qname(rel2.p) : null;
    p.cls = p.e1 ? p.e1.cls : 'Person';
    p.s1 = p.e1 ? short(p.e1.id) : '?s';
    p.n1 = p.e1 && named.has(p.e1.id) ? p.e1.label : '';
    // FILTER 예제가 반드시 한 행은 잡도록 실제 이름에서 두 글자를 떼어 온다
    p.frag = p.n1.slice(0, Math.min(2, p.n1.length));
    // rico:name 말고 실제로 쓰인 데이터 속성 하나
    const dps = rows(`SELECT DISTINCT ?p WHERE { ?s ?p ?o . FILTER(isLiteral(?o)) }`)
      .map(r => clsOf(r.p)).filter(x => x !== 'name');
    p.dp = dps.find(x => /Date/i.test(x)) || dps[0] || null;
    return p;
  }

  function cheatHTML() {
    const cls = [...new Set(P3.ents.map(e => e.cls))].sort();
    const preds = [...new Set(P3.rels.map(r => r.p))].sort();
    const dps = [...new Set(rows(`SELECT DISTINCT ?p WHERE { ?s ?p ?o . FILTER(isLiteral(?o)) }`)
      .map(r => clsOf(r.p)))].sort();
    const eg = P3.ents.slice(0, 5).map(e => `<code>${esc(short(e.id))}</code> <span class="mut">${esc(e.label)}</span>`);
    const line = (k, v) => `<div class="p3cx"><b>${k}</b><span>${v || '<span class="mut">(없음)</span>'}</span></div>`;
    return `<div class="p3cheat">
      ${line('접두사', ['rico:', 'ric:', 'rdf:', 'rdfs:', 'owl:', 'foaf:', 'xsd:'].map(p => `<code>${p}</code>`).join(' · ')
        + ' <span class="mut">— 자동으로 붙습니다</span>')}
      ${line('클래스', cls.map(c => `<code>${esc(qname(c))}</code>`).join(' · '))}
      ${line('관계(서술어)', preds.map(p => `<code>${esc(qname(p))}</code>`).join(' · '))}
      ${line('속성(값)', dps.map(p => `<code>${esc(qname(p))}</code>`).join(' · '))}
      ${line('개체 예', eg.join(' · '))}
      <p class="note" style="margin:.6rem 0 .8rem">개체의 IRI 는 <code>ric:agent-071</code> 처럼 번호입니다.
        이름으로 찾으려면 <code>rico:name</code> 을 함께 걸어야 합니다 — 아래 도움말 ③ 을 보세요.</p></div>`;
  }

  /* 난이도 순으로 아홉 개. 설명 → 질의 → "편집창에 넣기" 한 벌씩. */
  function helpEx() {
    const p = probe();
    const L = [
      [`<b>①</b> 어떤 종류를 전부 찾기 — <code>a</code> 는 “~의 종류다”(<code>rdf:type</code>)`,
        `SELECT ?이름 WHERE {\n  ?s a ${qname(p.cls)} ; rico:name ?이름 .\n}`],
      [`<b>②</b> 한 개체에 달린 모든 것 — 서술어와 목적어를 변수로 비워 둔다`,
        `SELECT ?서술어 ?대상 WHERE {\n  ${p.s1} ?서술어 ?대상 .\n}`],
      [`<b>③</b> <b>이름으로</b> 찾아 들어가기 — IRI 가 번호라서, 사람 이름은 <code>rico:name</code> 에 건다`,
        `SELECT ?서술어 ?대상 WHERE {\n  ?s rico:name "${p.n1}" ;\n     ?서술어 ?대상 .\n}`],
      [`<b>④</b> 특정 관계만 — 서술어를 못 박고 목적어를 묻는다`,
        `SELECT ?이름 ?대상 WHERE {\n  ?s rico:name ?이름 ;\n     ${p.r1} ?대상 .\n}`],
      [`<b>⑤</b> 방향을 뒤집어 — 목적어 자리를 못 박으면 “그것을 향한 주어”가 나온다`,
        `SELECT ?주어 WHERE {\n  ?주어 ${p.r1} ${p.o1} .\n}`],
      [`<b>⑥</b> 조건 두 개를 함께 — <code>;</code> 은 “주어가 같다”는 축약. 둘 다 만족하는 것만 남는다`,
        `SELECT ?이름 WHERE {\n  ?s a ${qname(p.cls)} ;\n     rico:name ?이름 ;\n     ${p.r1} ?o .\n}`],
      [`<b>⑦</b> 관계를 이어 가기(다단계) — 앞 줄에서 받은 <code>?b</code> 를 다음 줄의 주어로 쓴다`,
        p.r2
          ? `SELECT ?처음 ?b ?c WHERE {\n  ?a rico:name ?처음 ;\n     ${p.r1} ?b .\n  ?b ${p.r2} ?c .\n}`
          : `SELECT ?처음 ?b WHERE {\n  ?a rico:name ?처음 ;\n     ${p.r1} ?b .\n}`],
      [`<b>⑧</b> 세고 묶고 줄 세우기 — <code>COUNT · GROUP BY · ORDER BY · LIMIT</code>`,
        `SELECT ?서술어 (COUNT(*) AS ?개수) WHERE {\n  ?s ?서술어 ?o .\n  FILTER(isIRI(?o))\n}\nGROUP BY ?서술어 ORDER BY DESC(?개수) LIMIT 5`],
      [`<b>⑨</b> 조건 걸기 — <code>FILTER</code>. 글자가 들었는지는 <code>CONTAINS</code>`,
        `SELECT ?이름 WHERE {\n  ?s rico:name ?이름 .\n  FILTER(CONTAINS(?이름, "${p.frag}"))\n}`],
    ];
    if (p.dp) L.push([`<b>⑩</b> 있으면 채우고 없으면 비워 두기 — <code>OPTIONAL</code>`,
      `SELECT ?이름 ?값 WHERE {\n  ?s rico:name ?이름 .\n  OPTIONAL { ?s ${qname(p.dp)} ?값 }\n}`]);
    return L;
  }

  function helpHTML() {
    const rowsHelp = [
      ['?이름', '알고 싶은 빈칸(변수) — 한글도 됩니다'],
      ['a', '~의 종류다 (<code>rdf:type</code> 의 축약)'],
      ['.', '조건 하나 끝 — 여러 개면 모두 만족(AND)'],
      [';', '주어가 같음 (주어를 다시 안 씀)'],
      ['FILTER(…)', '조건 걸기'],
      ['COUNT · GROUP BY · ORDER BY · LIMIT', '세기 · 묶기 · 정렬 · 개수 제한'],
    ];
    return `<div class="p3help">
      <p class="note">SPARQL 은 <b>빈칸 채우기</b>입니다. 아는 것은 그대로 쓰고, 알고 싶은 것은 <code>?변수</code> 로 둡니다.<br>
        예: <code>?s rico:name ?이름 .</code> → “이름이 붙은 것을 모두 찾고, 그 이름을 <b>?이름</b> 에 담아라.”</p>
      <table class="p3syn"><tbody>${rowsHelp.map(([a, b]) =>
        `<tr><td><code>${esc(a)}</code></td><td>${b}</td></tr>`).join('')}</tbody></table>
      ${helpEx().map(([d, q], i) => `<div class="p3hx"><div class="p3hd">${d}</div>
        <pre>${esc(q)}</pre>
        <button class="btn sm" onclick="p3.putHelp(${i})">편집창에 넣기 ↓</button></div>`).join('')}</div>`;
  }

  /* 세 칸 → 질의문. 미리보기와 "편집창에 넣기" 가 같은 글자를 내도록 한 군데서만 만든다. */
  function built(s, p, o) {
    const vars = [s, p, o].filter(x => x.startsWith('?'));
    return `SELECT ${vars.length ? vars.join(' ') : '*'} WHERE {\n  ${s} ${p} ${o} .\n} LIMIT 50`;
  }

  function viewSparql() {
    const preds = [...new Set(P3.rels.map(r => r.p))].sort();
    const top = [...P3.ents].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 200);
    const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
    // 개체는 클래스별로 묶어 둔다 — 200개를 한 줄로 늘어놓으면 고를 수가 없다
    const byCls = {};
    top.forEach(e => (byCls[e.cls] = byCls[e.cls] || []).push(e));
    const entGroups = Object.keys(byCls).sort().map(c =>
      `<optgroup label="${esc(CLSKO[c] || c)}">${byCls[c].map(e => opt(short(e.id), e.label)).join('')}</optgroup>`).join('');
    // 클래스는 목적어 칸에만 둔다 — 서술어 a 와 짝지어야 뜻이 서는 자리라서.
    // 주어 칸에 넣으면 rico:Person 자체를 주어로 삼는 질의가 되어 늘 0행이다.
    const clsGroup = `<optgroup label="클래스(종류) — 서술어를 a 로">${Object.keys(byCls).sort().map(c =>
      opt(qname(c), `${qname(c)} (${CLSKO[c] || c})`)).join('')}</optgroup>`;
    return `<div class="wb"><div class="wbhead"><span class="no">③</span><h3>자연어로 묻기</h3>
      <span class="hint">AI 가 SPARQL 을 만들고, 엔진이 실행합니다</span></div>
    <p class="note">한국어로 적으면 <b>AI 가 이 그래프의 어휘만 써서 SPARQL 을 만들고</b> 브라우저 안 엔진이 실행합니다.
      답은 <b>질의 결과만 근거로</b> 정리하며, 0행이면 "없다"고 답합니다.
      만들어진 질의문은 접어 둔 곳에서 볼 수 있고, 아래 편집기로 가져와 고칠 수 있습니다.</p>
    ${/* 보기 질문과 직접 묻기는 '무엇을 물을까'라는 같은 물음의 두 답이다.
          보기를 아래에 따로 두면 다음 단계처럼 보이므로, 한 묶음 안에 나란히 둔다. */''}
    <div class="p3qpick">
      <div class="p3qpick-t">무엇을 물을까요 — 아래 보기를 누르거나, 직접 적어 물어보세요</div>
      <div class="p3btns">${NLQ.map((q, i) =>
      `<button class="btn sm" onclick="p3.askPreset(${i})">${esc(q)}</button>`).join('')}</div>
      <div class="p3ask">
        <input id="p3nl" placeholder="예: 정세균이 속한 단체는 어디인가?" value="${esc(P3.nlq || '')}"
          oninput="p3.nlToggle()"
          onkeydown="if(event.key==='Enter'&&this.value.trim())p3.askNL(document.querySelector('#p3nlBtn'))">
        <button class="btn sm primary" id="p3nlBtn" onclick="p3.askNL(this)"
          ${(P3.nlq || '').trim() ? '' : 'disabled title="물어볼 내용을 먼저 적어 주세요"'}>묻기</button>
      </div>
    </div>
    ${savedKey() ? '' : `<p class="note"><b>API 키가 없습니다.</b> 2부 ② 단계에서 키를 저장하면 여기서도 씁니다
      (${esc(PROVIDERS[provider()].label)} 기준). 키 없이도 아래 플레이그라운드는 그대로 동작합니다.</p>`}
    <div id="p3nlOut"></div>
    </div>

    <div class="wb"><div class="wbhead"><span class="no">③′</span><h3>SPARQL 플레이그라운드</h3>
      <span class="hint">진짜 엔진에서 실행됩니다</span></div>
    <p class="note">직접 SPARQL 을 써서 물어보세요. 접두사(<code>rico:</code> <code>ric:</code> <code>xsd:</code> …)는 자동으로 붙습니다.
      2부에서 넣은 트리플이 정말 걸리는지가 여기서 판가름 납니다.</p>

    <div class="p3blk">
      <div class="p3blk-t">빈칸 채우기 — 세 칸을 고르면 SPARQL 이 완성됩니다 (모르는 칸은 <code>?변수</code> 로 두세요)</div>
      <div class="p3fill">
        <label>주어<select id="p3s" onchange="p3.bprev()">${opt('?s', '?s — 아무거나', true)}
          ${entGroups}</select></label>
        <label>서술어<select id="p3p" onchange="p3.bprev()">${opt('?p', '?p — 아무거나', true)}
          ${opt('a', 'a — ~의 종류다')}
          ${preds.map(p => opt(qname(p), qname(p))).join('')}</select></label>
        <label>목적어<select id="p3o" onchange="p3.bprev()">${opt('?o', '?o — 아무거나', true)}
          ${clsGroup}${entGroups}</select></label>
      </div>
      <div class="p3out"><code id="p3bPrev">${esc(built('?s', '?p', '?o'))}</code>
        <button class="btn sm" onclick="p3.toEd(p3.built())">편집창에 넣기 ↓</button></div>
    </div>

    <div class="p3blk">
      <div class="p3blk-t">예제 질의 — 골라서 편집창에 넣어 보세요</div>
      <div class="p3fill"><label>예제<select id="p3ex" onchange="p3.exprev()">
        ${PRESETS.map((p, i) => opt(String(i), p[0])).join('')}</select></label></div>
      <div class="p3out"><code id="p3exPrev">${esc(PRESETS[0][1])}</code>
        <button class="btn sm" onclick="p3.putEx()">편집창에 넣기 ↓</button></div>
    </div>

    <div class="p3blk">
      <div class="p3blk-t">직접 묻기 — SPARQL 을 직접 쓰거나, 위에서 넣은 질의를 실행하세요</div>
      <textarea id="p3q" rows="8" spellcheck="false"
        onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();p3.run(document.querySelector('#p3run'))}"
        >SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o .\n} LIMIT 50</textarea>
      <div class="p3out"><span class="hint">Ctrl+Enter 로도 실행됩니다</span>
        <button class="btn sm primary" id="p3run" onclick="p3.run(this)">실행 (Ctrl+Enter)</button></div>
      <details class="p3det"><summary>사용 가능한 어휘 보기</summary>${cheatHTML()}</details>
    </div>

    <div id="p3res"></div>
    <details class="p3det"><summary>SPARQL 이 처음이신가요? — 문법 도움말 · 예시</summary>${helpHTML()}</details>
    </div>`;
  }

  const PFXLINES = PFX.split('\n').length - 1;
  /* IRI 는 번호라서 그것만 보면 뭔지 모른다 — 아는 개체면 이름을 앞에 세운다. */
  /* 질의 결과의 개체는 눌러서 그 기록으로 건너갈 수 있어야 한다 —
     표를 읽다 말고 이름을 다시 찾아 헤매지 않도록. 출처가 있으면 함께 적는다. */
  const termCell = t => {
    if (!t) return '<span class="mut">—</span>';
    if (t.termType === 'NamedNode') {
      const e = P3.byId.get(t.value);
      if (!e) return `<code>${esc(short(t.value))}</code>`;
      const pv = provOf(t.value);
      return `<button class="p3go" onclick="p3.go('${esc(t.value)}')"
          title="이 개체의 기록으로 이동">${esc(e.label)}</button>
        <code class="mut">${esc(short(t.value))}</code>
        ${pv ? `<span class="p3src">${esc(pv.label)}</span>` : ''}`;
    }
    return esc(t.value);
  };

  function resultTable(sparql) {
    let r;
    try { r = raw(sparql); } catch (e) {
      // 엔진은 접두사까지 붙인 문자열을 세므로 줄 번호가 앞으로 밀려 있다.
      // 화면에 보이는 질의문 기준으로 되돌려 준다 — 안 그러면 없는 줄을 가리킨다.
      const msg = String(e && e.message ? e.message : e)
        .replace(/at (\d+):(\d+)/g, (m, l, c) => `${Math.max(1, +l - PFXLINES)}번째 줄 ${c}칸`);
      return `<div class="result fail"><b>질의문에 문제가 있습니다</b><br>${esc(msg)}</div>`;
    }
    if (typeof r === 'boolean') return `<div class="result ${r ? 'pass' : 'fail'}">ASK 결과 — ${r ? '참(true)' : '거짓(false)'}</div>`;
    if (!r.length) return `<div class="result fail"><b>0행.</b> 이 그래프에는 그런 트리플이 없습니다.
      질의문이 틀렸을 수도 있고, <b>정말 안 넣었을 수도</b> 있습니다 — 관계망에서 확인해 보세요.</div>`;
    // CONSTRUCT · DESCRIBE 는 해답표가 아니라 트리플을 낸다 — 주어·서술어·목적어 3열로 편다
    if (r[0] && r[0].subject) {
      const tb = r.slice(0, 200).map(q =>
        `<tr><td>${termCell(q.subject)}</td><td>${termCell(q.predicate)}</td><td>${termCell(q.object)}</td></tr>`).join('');
      return `<p class="note" style="margin-top:.8rem"><b>${r.length} 트리플</b>${r.length > 200 ? ' (앞 200개만 표시)' : ''}</p>
        <div class="scroll"><table><thead><tr><th>주어</th><th>서술어</th><th>목적어</th></tr></thead><tbody>${tb}</tbody></table></div>`;
    }
    const vars = new Set();
    r.forEach(b => { for (const k of b.keys()) vars.add(k); });
    const V = [...vars];
    const body = r.slice(0, 200).map(b => `<tr>${V.map(v => `<td>${termCell(b.get(v))}</td>`).join('')}</tr>`).join('');
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
클래스: ${cls.map(c => qname(c)).join(', ')}
객체 속성: ${preds.map(p => qname(p)).join(', ') || '(없음)'}
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

  /* 모델이 질의문만 내도록 일렀어도 앞뒤에 설명을 붙이는 일이 잦다.
     그대로 엔진에 넣으면 그 문장에서 파서가 걸려 "실행되지 않았습니다"가 뜬다.
     ``` 울타리를 걷고, 질의가 시작되는 자리부터 잘라 낸 뒤,
     본문 중괄호가 닫히고 수식어(GROUP BY·ORDER BY·LIMIT …)까지 끝난 지점에서 멈춘다. */
  function cleanSparql(s) {
    s = String(s || '').replace(/```[a-z]*|```/g, '').trim();
    const i = s.search(/\b(PREFIX|BASE|SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i);
    if (i > 0) s = s.slice(i);
    const lines = s.split('\n');
    let depth = 0, opened = false, end = lines.length;
    for (let k = 0; k < lines.length && !(opened && depth <= 0); k++) {
      for (const ch of lines[k]) {
        if (ch === '{') { depth++; opened = true; }
        else if (ch === '}') depth--;
      }
      if (opened && depth <= 0) {
        let j = k + 1;
        for (; j < lines.length; j++) {
          const t = lines[j].trim();
          if (!t || /^#/.test(t)) continue;
          if (/^(GROUP|HAVING|ORDER|LIMIT|OFFSET|VALUES)\b/i.test(t)) continue;
          break;                       // 여기부터는 질의가 아니라 설명이다
        }
        end = j;
      }
    }
    return lines.slice(0, end).join('\n').trim();
  }

  async function runNL(question, out) {
    const SYS = `너는 SPARQL 1.1 생성기다. SELECT 질의 하나만 출력한다.
${liveSchema()}
규칙:
- PREFIX 선언은 쓰지 마라(자동으로 붙는다).
- IRI 를 추측하지 마라. 사람·단체·사건은 rico:name 이나 rico:title 로 맞춰라.
  정확한 이름을 모르면 FILTER(CONTAINS(?이름, "키워드")) 를 써라.
- 결과에 사람이 읽을 이름 변수를 반드시 넣어라. 변수명은 한국어로 써도 된다.
- 집계를 쓰면 SELECT 에 넣은 비집계 변수를 GROUP BY 에 빠짐없이 적어라.
- LIMIT 50 을 붙여라. 설명·마크다운 없이 질의문만 출력.`;
    out.innerHTML = `<p class="note p3running">AI 가 SPARQL 을 만드는 중… <span class="mut">${esc(PROVIDERS[provider()].label)}</span></p>`;
    let sparql = cleanSparql(await askText(question, '', SYS, 700));

    let res, err = null;
    const tryRun = q => { try { const r = rows(q); err = null; return r; } catch (e) { err = e; return null; } };

    out.innerHTML = `<p class="note p3running">브라우저 안 SPARQL 엔진이 질의를 실행하는 중…</p>`;
    await new Promise(r => setTimeout(r, 16));      // 표시가 한 번 그려질 틈을 준다
    res = tryRun(sparql);
    /* 한 번은 스스로 고쳐 보게 한다 — 파서가 짚어 준 자리를 그대로 모델에 돌려준다.
       사람이 SPARQL 을 몰라도 여기서 대개 풀린다. */
    if (res === null) {
      out.innerHTML = `<p class="note p3running">문법 오류가 있어 AI 가 고치는 중…</p>`;
      const fixed = cleanSparql(await askText(
        `아래 SPARQL 이 파서 오류로 실행되지 않았다. 오류를 고쳐 실행 가능한 SELECT 질의 하나만 출력하라.\n\n[오류]\n${err.message || err}\n\n[질의문]\n${sparql}`,
        '', SYS, 700));
      const again = tryRun(fixed);
      if (again !== null) { sparql = fixed; res = again; }
    }
    if (res === null) {
      out.innerHTML = `<div class="result fail"><b>만들어진 질의문이 실행되지 않았습니다.</b>
          <div class="vdef" style="margin-top:.35rem">한 번 고쳐 봤지만 여전히 문법 오류입니다. 아래에서 직접 손볼 수 있습니다.</div>
          <br>${esc(err.message || err)}</div>
        <pre>${esc(sparql)}</pre>
        <button class="btn sm" onclick="p3.toEditor()">편집기로 가져와 고치기</button>`;
      P3.lastSparql = sparql;
      return;
    }
    P3.lastSparql = sparql;
    out.innerHTML = `<p class="note p3running">AI 가 답을 정리하는 중… <span class="mut">(질의 결과 ${res.length}행)</span></p>`;
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
  /* 의미 지도의 상태. LANG 과 따로 두는 까닭은 말뭉치가 같아도 지도는 다시 셈해야 할 때가 있고
     (2부에서 개체를 더 넣고 오면 그래프 여부가 바뀐다), 고른 말·군집 필터는 탭을 옮겨도 남기고 싶어서다. */
  const MAP = { built: null, words: [], cl: [], on: null, pick: null };

  /* 원문은 어디서 오는가 — 2부를 돌렸으면 그 단락들, 아니면 실습 원문 8단락.
     own 은 「지금 올라와 있는 그래프가 이 원문에서 나온 것인가」다. 예시 그래프를 올려 놓고
     실습 원문을 보고 있으면 둘은 남남이라, 원문과 그래프를 견주는 말을 해서는 안 된다. */
  function corpus() {
    const done = srcParas();
    if (done.length) return { paras: done, src: `2부에서 다룬 ${done.length}단락`, own: true };
    return { paras: D.paragraphs, src: `실습 원문 ${D.paragraphs.length}단락 (이 그래프의 원문이 아닙니다)`, own: false };
  }

  function buildLang() {
    const { paras, src, own } = corpus();
    const key = paras.map(p => p.id).join('|');
    if (LANG.built === key) return;
    LANG.built = key; LANG.paras = paras; LANG.src = src; LANG.own = own;
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
    ['map', '의미 지도', '같은 자리에 쓰인 말끼리 모입니다 — **가까울수록 비슷한 맥락**입니다. 채운 원은 그래프에 개체로 들어온 말, **빈 원은 원문에만 있는 말**입니다.'],
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

  /* 색을 넣는 방식이 둘인데, 가르는 기준은 「누가 다시 읽어 주는가」다.

     SVG 로 그리는 화면(이 아래 다섯 개)은 색을 풀지 말고 var() 를 그대로 적는다.
     이 사이트는 테마를 바꿔도 3부를 다시 그리지 않아서, 값을 구워 넣으면 어두운 모드에서
     그린 화면이 밝은 모드로 돌아와도 어두운 색 그대로 남는다 — 검은 글씨가 검은 배경에
     깔려 아예 안 보였다(실측). var() 로 두면 브라우저가 테마가 바뀔 때 다시 푼다.
     단, var() 는 fill="…" 같은 표현 속성에서는 안 먹으므로 style="fill:…" 로 적어야 한다.

     캔버스로 그리는 관계망은 var() 를 쓸 수 없어 아래 css() 로 푼다. 그쪽은 rAF 루프가
     프레임마다 다시 읽으므로 테마를 따라간다 — 그래서 굽되 매번 굽는다.

     css() 는 없는 변수에 #888 을 돌려준다. 스타터킷에서 코드를 옮겨 올 때
     그쪽에만 있는 이름(--panel)이 딸려 와 글자마다 회색 덩어리가 앉은 적이 있다.
     아래 PAL 을 포함해, 여기 적는 이름은 index.html 에 정의된 것이어야 한다. */
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const PAL = ['--cls-agent', '--cls-record', '--cls-event', '--cls-place', '--cls-other', '--accent'];

  function drawLang() {
    const stage = $('#p3stage');
    if (!stage) return;
    stage.innerHTML = '';
    if (!LANG.words.length) { stage.innerHTML = `<p class="note">원문에서 쓸 만한 어휘를 못 찾았습니다.</p>`; return; }
    ({ network: lNetwork, flow: lFlow, print: lPrint, tfidf: lTfidf, map: lMap })[LANG.mode](stage);
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
        style="stroke:var(--line)" stroke-width="${Math.min(e.n, 3)}" opacity=".6"/>`).join('')
      + N.map((n, i) => {
        const r = 5 + (n.n / max) * 20, col = `var(${PAL[i % PAL.length]})`;
        return `<g data-w="${esc(n.w)}" style="cursor:pointer">
          <circle cx="${n.x}" cy="${n.y}" r="${r}" style="fill:${col}" opacity=".22"/>
          <circle cx="${n.x}" cy="${n.y}" r="${r * .45}" style="fill:${col}"/>
          <text x="${n.x}" y="${n.y - r - 4}" text-anchor="middle" font-size="${11 + (n.n / max) * 9}"
            style="fill:var(--fg)">${esc(n.w)}</text></g>`;
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
      return { d: line(up) + line(dn).replace('M', 'L') + 'Z', col: `var(${PAL[si % PAL.length]})`,
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
    s.innerHTML = bands.map(b => `<path d="${b.d}" style="fill:${b.col}" opacity=".55"/>`).join('')
      + ch.map((c, i) => `<text x="${nx(i)}" y="${H - 22}" text-anchor="middle" font-size="11"
          style="fill:var(--muted)">${esc(c.short)}</text>`).join('')
      + `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">단락 순서 →</text>`
      + shown.map(b => `<text x="${b.x}" y="${b.y + 4}" text-anchor="middle" font-size="12.5"
          stroke-width="3.2" paint-order="stroke"
          style="cursor:pointer;fill:var(--fg);stroke:var(--bg)" data-w="${esc(b.w)}">${esc(b.w)}</text>`).join('');
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
        opacity="${.06 + (n / max) * .9}" style="cursor:pointer;fill:var(--accent)"
        data-w="${esc(w.w)}" data-p="${ci}"><title>${esc(w.w)} · ${esc(c.label)} · ${n}회 (눌러 보기)</title></rect>`;
    }).join('')).join('')
      + top.map((w, ri) => `<text x="142" y="${34 + ri * rh + rh * .72}" text-anchor="end" font-size="11"
          style="cursor:pointer;fill:var(--fg)" data-w="${esc(w.w)}">${esc(w.w)}</text>`).join('')
      + ch.map((c, ci) => `<text x="${150 + ci * cw + cw / 2}" y="24" text-anchor="middle" font-size="10.5"
          style="fill:var(--muted)">${esc(c.short)}</text>`).join('');
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

  /* ══════════ 의미 지도 ══════════
     앞의 네 화면은 「무엇이 몇 번 나왔나」를 센다. 이 화면은 「어느 말과 어느 말이 같은 자리에 쓰이나」를 본다.
     같은 문맥에 나온 말끼리 가까워지므로, 원문이 무엇을 무엇과 묶어 이야기하는지가 자리로 드러난다.

     셈법은 오후 스타터킷과 같다 — 공기행렬 → PPMI → 고유분해로 좌표를 얻고 k-means 로 덩어리를 낸다.
     학습 데이터도 외부 모델도 쓰지 않는다. 이 원문 안에서만 센 것이라 브라우저에서 즉시 돈다. */

  /** 대칭 행렬의 고유분해(야코비 회전). 값이 큰 순으로 정렬해 돌려준다. */
  function jacobiEigen(A, n, sweeps = 12) {
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let s = 0; s < sweeps; s++) {
      let off = 0;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-9) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-12) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(tt * tt + 1), sn = tt * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk;
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - sn * vkq; V[k][q] = sn * vkp + c * vkq;
        }
      }
    }
    const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return { val: ord.map(i => A[i][i]), vec: ord.map(i => V.map(r => r[i])) };
  }

  const MAP_MAX = 150;   // 지도에 올릴 낱말 상한 — 이보다 많으면 글자가 서로 먹는다
  const MAP_MIN = 12;    // 이보다 적으면 좌표가 뜻을 잃는다 — 그리지 않고 까닭을 적는다

  /** 원문에서 의미 지도를 만든다 — 어휘·좌표·군집·이웃.
     스타터킷과 다른 점이 둘 있다.

     ① **최소 빈도를 말뭉치가 정한다.** 스타터킷은 3회로 박아 두었는데, 그 말뭉치는 15만 자다.
        여기 실습 원문은 3천 자(문장 61·토큰 413)라 3회로 자르면 낱말이 13개만 남아 지도가 무너진다(실측).
        그래서 2회에서 시작해 낱말이 상한을 넘을 때만 올린다 — 실습 원문은 2회로 43개,
        수강생이 긴 녹취문을 붙이면 알아서 3·4회로 올라가 스타터킷과 같은 밀도가 된다.

     ② **그래프 개체명으로 미리 거르지 않는다.** 스타터킷은 그래프에 있는 말만 지도에 올리는데,
        그러면 실습 원문에서는 2개만 남는다. 게다가 이 화면이 보이려는 것은 그 교집합이 아니라
        **어긋남**이다 — 원문에 잦은데 그래프에 없는 말이 다음에 넣을 것이므로.
        그래서 원문 어휘를 다 올리고, 그래프에 있는지는 그릴 때 표시로만 가른다. */
  function buildMap() {
    if (MAP.built === LANG.built) return;
    MAP.built = LANG.built; MAP.words = []; MAP.cl = []; MAP.on = null; MAP.pick = null;
    if (!LANG.paras.length) return;

    const sents = [];
    LANG.paras.forEach(p => String(p.text).split(/(?<=[.!?])\s+|\n+/)
      .forEach(s => { if (s.trim().length > 10) sents.push(s); }));
    const freq = new Map();
    sents.forEach(s => tok(s).forEach(w => freq.set(w, (freq.get(w) || 0) + 1)));

    let minf = 2;
    const atLeast = m => [...freq.values()].filter(n => n >= m).length;
    while (minf < 6 && atLeast(minf) > MAP_MAX) minf++;
    const V = [...freq.entries()].filter(([, n]) => n >= minf)
      .sort((a, b) => b[1] - a[1]).slice(0, MAP_MAX).map(([w]) => w);
    if (V.length < MAP_MIN) return;

    const ix = new Map(V.map((w, i) => [w, i])), n = V.length;
    const C = Array.from({ length: n }, () => new Float64Array(n));
    sents.forEach(s => {
      const ws = tok(s).filter(w => ix.has(w));
      ws.forEach((a, i) => ws.slice(Math.max(0, i - 6), i + 7).forEach(b => {
        if (a !== b) C[ix.get(a)][ix.get(b)] += 1;
      }));
    });
    let tot = 0; const rs = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { tot += C[i][j]; rs[i] += C[i][j]; }
    if (!tot) return;
    // PPMI — 함께 나온 횟수를 각자 나온 횟수로 나눈다. 흔한 말끼리 붙는 착시를 걷어 낸다
    const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
      const v = Math.log((C[i][j] * tot) / (rs[i] * rs[j] || 1));
      return Number.isFinite(v) && v > 0 ? v : 0;
    }));
    const { val, vec } = jacobiEigen(P.map(r => [...r]), n);
    const dim = Math.min(24, n);
    const emb = Array.from({ length: n }, (_, i) => {
      const v = [];
      for (let d = 0; d < dim; d++) v.push(vec[d][i] * Math.sqrt(Math.max(0, val[d])));
      const len = Math.hypot(...v) || 1;
      return v.map(x => x / len);
    });
    // k-means(코사인) — 사안 덩어리. 낱말이 적으면 덩어리도 적게 잡는다
    const K = Math.max(2, Math.min(5, Math.floor(n / 6) || 1));
    let cent = Array.from({ length: K }, (_, k) => emb[Math.floor(k * n / K)].slice());
    let lab = new Array(n).fill(0);
    for (let it = 0; it < 40; it++) {
      lab = emb.map(e => {
        let best = 0, bs = -2;
        cent.forEach((c, k) => { const s = e.reduce((a, x, d) => a + x * c[d], 0); if (s > bs) { bs = s; best = k; } });
        return best;
      });
      cent = cent.map((_, k) => {
        const m = emb.filter((_, i) => lab[i] === k);
        if (!m.length) return cent[k];
        const s = m[0].map((_, d) => m.reduce((a, e) => a + e[d], 0) / m.length);
        const len = Math.hypot(...s) || 1;
        return s.map(x => x / len);
      });
    }
    const nb = emb.map((e, i) => emb.map((o, j) => [j, e.reduce((a, x, d) => a + x * o[d], 0)])
      .filter(([j]) => j !== i).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([j]) => V[j]));
    /* 좌표 — 고유벡터를 그대로 쓰지 않고 **출발점으로만** 쓴다.
       고유벡터 두 개를 min-max 로 펴서 찍었더니 낱말이 왼쪽 아래 한 덩어리로 뭉쳤다
       (실측: 이웃 간격 중앙값 0.005, 고르게 퍼졌을 때의 0.024 대비 4.5배 조밀).
       짧은 원문에서는 첫 두 축이 몇몇 고빈도 낱말에 끌려가 나머지를 다 눌러 버리기 때문이다.
       스타터킷은 낱말이 150개라 이 문제가 가려져 있었다.

       순위로 펴면 고르게 흩어지지만 그러면 화면상 거리가 뜻과 무관해진다 —
       「가까울수록 비슷한 맥락」이라고 적어 놓고 거짓말을 하는 셈이다.
       그래서 임베딩의 코사인 거리를 목표 거리로 삼아 2D 에서 이완시킨다(스트레스 완화).
       고유벡터가 잡아 준 큰 얼개는 남고, 뭉친 곳은 서로 밀어내며 풀린다. */
    const ax = [0, 1].map(d => vec[d].map((v, i) => v * Math.sqrt(Math.max(0, val[d]))));
    const nz = a => { const mn = Math.min(...a), mx = Math.max(...a); return a.map(v => (v - mn) / (mx - mn || 1)); };
    const [X0, Y0] = ax.map(nz);
    const pos = X0.map((x, i) => [x, Y0[i]]);
    // 목표 거리 — 코사인이 1 이면 0, -1 이면 1. 0.12 를 바닥에 둬 완전히 겹치지 않게 한다
    const D = emb.map((e, i) => emb.map((o, j) => i === j ? 0
      : 0.12 + 0.88 * (1 - e.reduce((a, x, d) => a + x * o[d], 0)) / 2));
    for (let it = 0; it < 300; it++) {
      const rate = 0.1 * (1 - it / 300);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pos[j][0] - pos[i][0], dy = pos[j][1] - pos[i][1];
        const d = Math.hypot(dx, dy) || 1e-6;
        const f = ((d - D[i][j]) / d) * rate;
        pos[i][0] += dx * f; pos[i][1] += dy * f;
        pos[j][0] -= dx * f; pos[j][1] -= dy * f;
      }
    }
    const [X, Y] = [nz(pos.map(p => p[0])), nz(pos.map(p => p[1]))];
    MAP.words = V.map((w, i) => ({ w, n: freq.get(w), x: X[i], y: Y[i], k: lab[i], nb: nb[i] }));
    /* 군집 이름은 **데이터가 짓는다** — 그 덩어리에서 가장 많이 나온 두 말.
       사람이 이름을 붙이면 수강생이 자기 원문으로 갈아끼웠을 때 거짓말이 된다. */
    MAP.cl = Array.from({ length: K }, (_, k) => {
      const ws = MAP.words.filter(x => x.k === k).sort((a, b) => b.n - a.n);
      return { k, n: ws.length, name: ws.slice(0, 2).map(x => x.w).join('·') || `덩어리 ${k + 1}` };
    }).filter(c => c.n);
  }

  /** 이 말이 그래프에 개체로 들어와 있는가 — wordSource() 와 같은 규칙으로 판정한다.
      2부에서 개체를 더 넣고 오면 빈 원이 채운 원으로 바뀐다. 그것이 이 화면의 쓸모다. */
  const inGraph = w => P3.ents.some(e => e.label.includes(w));

  /** 지금 보이는 말들 — 덩어리 필터를 지나온 것. 고른 말과 그 이웃은 필터와 무관하게 남는다. */
  const mapVisible = () => {
    if (MAP.on == null) return MAP.words;
    const keep = MAP.pick ? new Set([MAP.pick, ...(MAP.words.find(x => x.w === MAP.pick)?.nb || [])]) : null;
    return MAP.words.filter(d => d.k === MAP.on || (keep && keep.has(d.w)));
  };

  function lMap(stage) {
    buildMap();
    if (!MAP.words.length) {
      stage.innerHTML = `<p class="note"><b>원문이 짧아 지도를 그릴 수 없습니다.</b>
        같은 자리에 쓰인 말을 세려면 두 번 이상 나온 낱말이 적어도 ${MAP_MIN}개는 있어야 합니다.
        2부에서 단락을 더 다루거나 <b>내 원문</b>을 붙이면 나타납니다.</p>`;
      return;
    }
    const chips = document.createElement('div');
    chips.className = 'p3btns';
    chips.innerHTML = `<button class="btn sm ${MAP.on == null ? 'primary' : ''}"
        onclick="p3.mapK(null)">전체 ${MAP.words.length}</button>`
      + MAP.cl.map(c => `<button class="btn sm ${MAP.on === c.k ? 'primary' : ''}" onclick="p3.mapK(${c.k})">
          ${esc(c.name)} <b>${c.n}</b></button>`).join('');
    stage.appendChild(chips);
    mapDraw2d(stage);
    const tip = document.createElement('p');
    tip.className = 'note';
    tip.innerHTML = mapInsight();
    stage.appendChild(tip);
  }

  /* 덩어리 한 줄 풀이 — 전부 지금 지도에서 센 값이다(이름도 데이터가 지었다).
     지도를 눈으로만 보면 덩어리가 무엇을 뜻하는지 알 수 없어, 실습에서 늘 같은 질문이 나왔다.
     여기에 「그래프에 든 것 / 안 든 것」을 함께 적어, 다음에 무엇을 넣을지가 숫자로 보이게 한다. */
  function mapInsight() {
    const cl = MAP.on == null ? null : MAP.cl.find(c => c.k === MAP.on);
    const ws = MAP.on == null ? MAP.words : MAP.words.filter(d => d.k === MAP.on);
    if (!ws.length) return '';
    const inn = ws.filter(d => inGraph(d.w)).length;
    const head = cl ? `<b>${esc(cl.name)}</b> — 낱말 ${ws.length}개`
      : `<b>전체</b> — 낱말 ${ws.length}개 · 덩어리 ${MAP.cl.length}개`;
    const top = [...ws].sort((a, b) => b.n - a.n).slice(0, 3)
      .map(d => `${esc(d.w)} ${d.n}`).join(' · ');
    /* 그래프가 이 원문에서 나온 것이 아니면 채움·빈 원의 대조는 뜻이 없다 —
       예시 그래프를 올려 둔 채 「이 42개를 다음에 넣으세요」라고 하면 틀린 권유가 된다. */
    const gap = !LANG.own
      ? ` 지금 올라와 있는 그래프는 <b>이 원문에서 나온 것이 아니어서</b> 채운 원이 거의 없습니다 —
         원문과 그래프를 견주려면 2부에서 이 원문으로 그래프를 만들고 오세요.`
      : inn === ws.length
        ? ' 모두 그래프에 있습니다.'
        : ` 그래프에 든 것 <b>${inn}개</b> · 원문에만 있는 것 <b>${ws.length - inn}개</b>(빈 원) — 그 빈 원들이 다음에 넣을지 판단할 말입니다.`;
    return `${head}. 가장 잦은 말 ${top}.${gap}`;
  }

  /* 지도 그리기. 좌표는 PPMI 가 정한 것이라 밀집 구역에서는 글자가 서로 먹는다 —
     자주 나온 말부터 이름을 얻고, 이미 놓인 이름과 부딪히면 점만 남긴다.
     고른 말과 그 이웃은 언제나 이름을 단다(지금 보려는 것이므로).
     글자 뒤 후광은 무대 배경색(--bg)이라야 글자만 도드라진다. */
  function mapDraw2d(stage) {
    const W = 1000, H = 470, PADX = 54, PADY = 34;
    const s = svgEl(stage, W, H);
    const vis = mapVisible(), byW = new Map(MAP.words.map(d => [d.w, d]));
    const px = d => PADX + d.x * (W - PADX * 2), py = d => PADY + (1 - d.y) * (H - PADY * 2);
    const near = MAP.pick ? new Set([MAP.pick, ...(byW.get(MAP.pick)?.nb || [])]) : null;
    const parts = [];
    if (near && byW.has(MAP.pick)) {
      const c = byW.get(MAP.pick);
      byW.get(MAP.pick).nb.forEach(nw => {
        const o = byW.get(nw); if (!o) return;
        parts.push(`<line x1="${px(c)}" y1="${py(c)}" x2="${px(o)}" y2="${py(o)}"
          style="stroke:var(--accent)" stroke-width="1.2" opacity=".5"/>`);
      });
    }
    const boxes = [];
    const fits = d => {
      const w = d.w.length * 9.5, h = 11, r = 3.4 + Math.sqrt(d.n) / 2.6;
      const b = { x: px(d) - w / 2, y: py(d) - r - 3.5 - h, w, h };
      if (boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)) return false;
      boxes.push(b); return true;
    };
    [...vis].sort((a, b) => b.n - a.n).forEach(d => { d.lb = (near && near.has(d.w)) || fits(d); });
    vis.forEach(d => {
      const on = !near || near.has(d.w);
      const r = 3.4 + Math.sqrt(d.n) / 2.6, col = `var(${PAL[d.k % PAL.length]})`;
      // 채운 원 = 그래프에 개체로 있는 말 · 빈 원(점선) = 원문에만 있는 말
      const dot = inGraph(d.w)
        ? `<circle cx="${px(d)}" cy="${py(d)}" r="${r}" style="fill:${col}" fill-opacity=".85"/>`
        : `<circle cx="${px(d)}" cy="${py(d)}" r="${r}" style="fill:none;stroke:${col}"
             stroke-width="1.4" stroke-dasharray="2.5 2"/>`;
      parts.push(`<g data-w="${esc(d.w)}" style="cursor:pointer" opacity="${on ? 1 : .18}">${dot}
        ${d.lb ? `<text x="${px(d)}" y="${py(d) - r - 3.5}" text-anchor="middle" font-size="9.5"
          style="fill:var(--fg);stroke:var(--bg)" stroke-width="2.5"
          paint-order="stroke">${esc(d.w)}</text>` : ''}</g>`);
    });
    s.innerHTML = parts.join('');
    s.querySelectorAll('[data-w]').forEach(g => g.onclick = () => p3.mapPick(g.dataset.w));
    if (MAP.pick && byW.has(MAP.pick)) {
      const d = byW.get(MAP.pick);
      const p = document.createElement('p');
      p.className = 'note';
      p.innerHTML = `<b>${esc(d.w)}</b> (${d.n}회) — 가장 가까운 말 ${d.nb.map(esc).join(' · ')}`;
      stage.appendChild(p);
    }
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
      <p class="note">2부로 가서 단락 하나를 ⑧까지 마친 뒤 다시 오세요.
        예시 그래프(역대 국회의장)는 원문이 아니라 부록 표에서 온 것이라 짝이 없습니다.</p></div>`;
    }
    const has = savedKey();
    return `<div class="wb"><div class="wbhead"><span class="no">④</span><h3>같은 질문을 둘에게</h3>
      <span class="hint">원문 ${paras.length}단락</span></div>
    <p class="note">왼쪽은 <b>내 그래프에 SPARQL로</b> 묻고, 오른쪽은 <b>같은 원문을 그냥 읽은 AI</b>에게 묻습니다.
      어느 쪽이 더 그럴듯한지가 아니라, <b>어느 쪽이 근거를 댈 수 있는지</b>를 보세요.</p>
    <input id="p3ask" placeholder="예: 정세균은 어느 단체에 속했나?" value="이 원문에 나오는 인물과 그들이 속한 단체를 모두 알려 주세요.">
    <button class="btn sm primary" onclick="p3.ask(this)">둘에게 묻기</button>
    ${has
      ? `<p class="note">오른쪽(AI)은 <b>2부에서 저장한 API 키</b>로 <b>실제로 묻습니다</b>
          (${esc(PROVIDERS[provider()].label)}). 원문 ${paras.length}단락 전문과 질문만 보내고, 그래프도 TTL 도 보내지 않습니다 —
          그것이 이 화면의 대조점입니다. 물을 때마다 답이 조금씩 달라집니다.</p>`
      : `<p class="note"><b>API 키가 없습니다.</b> 2부 ② 단계에서 키를 저장하면 오른쪽에서 <b>실제로</b> 묻습니다.
          지금은 대신 <b>미리 받아 둔 예시 대조</b>를 보여 드립니다.</p>`}
    <div class="p3cmp">
      <div class="p3col"><h4>그래프에 물은 답</h4><div id="p3ansG"><p class="note">아직 묻지 않았습니다.</p></div></div>
      <div class="p3col"><h4>원문만 읽은 AI</h4><div id="p3ansA">${
      has ? '<p class="note">아직 묻지 않았습니다.</p>' : sampleHTML()}</div></div>
    </div></div>`;
  }

  /* ── 키가 없을 때 오른쪽에 세우는 예시 대조 ──
     키가 없으면 오른쪽이 통째로 비어 대조 자체가 성립하지 않았다.
     그래서 **미리 받아 둔 답** 하나를 둔다. 지금 친 질문에 대한 답이 아니므로 그렇게 밝혀 적는다.
     답은 2부 실습 2단락 원문만 주고 사이트의 시스템 프롬프트와 같은 조건으로
     Claude(Opus 5)에게 물어 받은 것이다 — 손으로 지어낸 문장이 아니다. */
  const AI_SAMPLE = {
    para: 'p2', label: '실습 2단락 「정계 입문 — 김대중과의 만남」 (정세균 구술, 1차 구술, 46쪽)',
    when: '2026-08-11', model: 'Claude Opus 5',
    q: '이 원문에 나오는 인물과 그들이 속한 단체를 모두 알려 주세요.',
    answer: [
      '이 대목에 이름이 나오는 인물은 권노갑 고문과 김대중 총재 두 사람이고, 말하는 사람 자신은 “저”라고만 되어 있어 이름이 나오지 않습니다.',
      '권노갑은 “고문”, 김대중은 “총재”로 불리지만 어느 조직의 고문·총재인지는 이 대목에 적혀 있지 않습니다.',
      '단체로는 쌍용USA가 한 번 나오는데, 화자가 그 회사 사장과 잘 아는 사이였다는 것이지 화자가 그곳에 속했다는 말은 아닙니다.',
      '화자는 “고대 총학생회장”을 지냈고 해외 주재원 출신이라고 밝히고 있어, 고려대학교와의 관계는 확인됩니다.',
      '마지막의 “영입됐지요”가 가리키는 조직은 이 대목만으로는 특정되지 않습니다.',
    ].join(' '),
    gaps: [
      ['AI 는 화자의 이름을 댈 수 없다',
        '원문에는 “저”뿐이다. 그래프는 화자를 <b>정세균</b>으로 못 박는데, 그것은 원문이 아니라 <b>출처</b>(정세균 구술 1차 46쪽)에서 온 정보다. 출처를 함께 들고 다니는 쪽만 할 수 있는 일이다.'],
      ['같은 사실이라도 되짚을 수 있느냐가 다르다',
        '그래프는 <code>정세균 → 총학생회장 → 고대</code> 로 3-홉을 세워 두어 “어느 학교의 무슨 직위였나”를 질의 한 번으로 되짚는다. AI 답에도 같은 사실이 들어 있지만 문장 속에 녹아 있어 다시 쓰려면 사람이 읽어야 한다.'],
      ['틀린 것을 <b>걸러 낼 수 있느냐</b>가 갈린다',
        'AI 는 이 단락에서 <code>정세균 isOrWasParticipantIn 김대중</code> 도 뽑았다 — “만났다”를 참여 관계로 옮긴 <b>레인지 위반</b>이다. 왼쪽에 2건만 남은 것은 ⑦ 검증이 그것을 <b>떨어뜨렸기</b> 때문이다. 문장으로 받은 답에는 이렇게 걸러 낼 자리가 없다.'],
    ],
  };

  function sampleHTML(note) {
    return `${note ? `<p class="note">${note}</p>` : ''}
      <div class="p3pre"><b>미리 받아 둔 예시입니다</b> — 지금 친 질문에 대한 답이 아닙니다.
        ${esc(AI_SAMPLE.label)} 원문만 주고 ${esc(AI_SAMPLE.model)} 에게 물어
        ${esc(AI_SAMPLE.when)} 에 받아 둔 답입니다.</div>
      <p class="note" style="margin:.5rem 0 .2rem">물은 것 — “${esc(AI_SAMPLE.q)}”</p>
      <div class="p3ai">${esc(AI_SAMPLE.answer)}</div>
      <p class="note" style="margin-top:.7rem"><b>그래프 쪽과 견주면</b></p>
      <ul class="p3ev2">${AI_SAMPLE.gaps.map(([h, d]) =>
      `<li><b>${esc(h)}</b><br><span class="mut">${d}</span></li>`).join('')}</ul>
      <p class="note">키를 저장하면 이 자리에서 <b>지금 친 질문</b>을 실제로 묻습니다.</p>`;
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
    tab(k) { P3.tab = k; if (k !== 'rec') REC.open = null; cancelAnimationFrame(NET.raf); render();
      if (window.syncHash) syncHash(); },
    now: () => P3.tab,          // 주소(#3-net)에 지금 탭을 적기 위해 app.js 가 읽는다
    /* 3부에서 본 개체의 근거를 2부의 원문 단락에서 확인한다.
       단락을 고르면 ②부터 다시 열리므로, 이미 해 둔 산출(DONE)은 건드리지 않는다. */
    toSource(paraId) {
      if (typeof showView !== 'function' || typeof pickPara !== 'function') return;
      showView(2);
      pickPara(paraId);
      const el = document.querySelector('#wbhost .wb');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    },
    /* 다른 화면에서 같은 개체로 건너뛴다 — 질의 결과·연표에서 기록 상세로. */
    go(id) { REC.open = id; P3.tab = 'rec'; render(); if (window.syncHash) syncHash(); },
    togglePaste() { P3.paste = !P3.paste; render(); },

    /* 기록 */
    recSearch(v) { REC.q = v.trim().toLowerCase(); REC.more.clear(); paint(); $('#recQ')?.focus(); },
    recFacet(c) { REC.off.has(c) ? REC.off.delete(c) : REC.off.add(c); REC.more.clear(); paint(); },
    recMore(c) { REC.more.add(c); paint(); },
    item(id) { P3.tab = 'rec'; REC.open = id; render(); scrollTo({ top: 0, behavior: 'smooth' }); },
    recBack() { REC.open = null; render(); },

    /* 언어 */
    lang(k) { LANG.mode = k; paint(); },
    /* 의미 지도 — 덩어리로 거르기, 말 하나 고르기.
       고른 말은 지도에 이웃 선을 긋고, 원문 상자는 다른 화면과 똑같이 wordSource 가 채운다.
       paint() 가 먼저다 — 상자를 다시 그린 뒤에 채워야 한다. */
    mapK(k) { MAP.on = k; MAP.pick = null; paint(); },
    mapPick(w) { MAP.pick = MAP.pick === w ? null : w; paint(); wordSource(w); },

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
    askPreset(i) { $('#p3nl').value = NLQ[i]; p3.nlToggle(); p3.askNL($('#p3nlBtn')); },
    /* 빈 칸으로는 물을 수 없다 — 눌러도 아무 일이 없는 버튼을 켜 두지 않는다 */
    nlToggle() {
      const t = $('#p3nl'), b = $('#p3nlBtn');
      if (t && b) b.disabled = !t.value.trim();
    },
    toEditor() {
      if (!P3.lastSparql) return;
      const t = $('#p3q');
      t.value = P3.lastSparql;
      t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    async loadWB(b) {
      b.disabled = true;
      await load(wbTTL(), `2부에서 만든 내 그래프 (${DONE.size}단락)`);
      buildProv(); render();           // 2부에서 온 것만 출처를 되짚을 수 있다
      b.disabled = false;
    },
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
    /* 빈칸 채우기 — 고른 즉시 편집창을 덮어쓰지 않는다.
       손으로 고쳐 둔 질의문이 드롭다운 한 번에 날아가면 실습이 끊긴다.
       미리보기로 먼저 보여 주고, 넣는 것은 사람이 정한다. */
    built() { return built($('#p3s').value, $('#p3p').value, $('#p3o').value); },
    bprev() { $('#p3bPrev').textContent = p3.built(); },
    exprev() { $('#p3exPrev').textContent = PRESETS[+$('#p3ex').value][1]; },
    putEx() { p3.toEd(PRESETS[+$('#p3ex').value][1]); },
    putHelp(i) { p3.toEd(helpEx()[i][1]); },
    toEd(q) {
      const t = $('#p3q');
      t.value = q;
      t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // 넣기만 하고 실행은 사람이 — 어디를 눌러야 하는지 실행 버튼을 한 번 깜빡여 알린다
      const b = $('#p3run');
      if (b) { b.classList.remove('p3flash'); void b.offsetWidth; b.classList.add('p3flash'); }
    },
    /* 질의는 동기로 돈다 — 그대로 두면 '실행 중'이 한 프레임도 그려지지 않고 결과만 툭 바뀐다.
       엔진이 실제로 돌고 있다는 것을 보이려고, 표시를 먼저 그린 뒤 한 틱 양보하고 실행한다.
       끝나면 결과 상자를 한 번 물들여 '방금 이게 새로 왔다'를 알린다. */
    run(b) {
      if (!b) return;
      const out = $('#p3res'), old = b.textContent;
      b.disabled = true; b.textContent = '실행 중…';
      out.innerHTML = `<p class="note p3running">브라우저 안 SPARQL 엔진이 질의를 실행하는 중…</p>`;
      setTimeout(() => {
        out.innerHTML = resultTable($('#p3q').value);
        out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash');
        b.disabled = false; b.textContent = old;
        out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 16);
    },
    async ask(b) {
      const qs = ($('#p3ask').value || '').trim();
      if (!qs) return;
      $('#p3ansG').innerHTML = graphAnswer();
      const box = $('#p3ansA');
      if (!savedKey()) {
        box.innerHTML = sampleHTML('<b>키가 없어 이 질문은 실제로 묻지 못했습니다.</b>');
        return;
      }
      const oldLabel = b.textContent;
      b.disabled = true; b.textContent = '묻는 중…';
      box.innerHTML = `<p class="note p3running">${esc(PROVIDERS[provider()].label)} 에 묻는 중… <span class="mut">${esc(savedModel(provider()))}</span></p>`;
      try {
        const text = srcParas().map(p => p.text).join('\n\n');
        const a = await askText(qs, text);
        box.innerHTML = `<div class="p3pre live"><b>방금 실제로 받은 답입니다</b> —
            ${esc(PROVIDERS[provider()].label)} · <code>${esc(savedModel(provider()))}</code>.
            원문 ${srcParas().length}단락만 보냈습니다.</div>
          <div class="p3ai">${esc(a).replace(/\n/g, '<br>')}</div>
          <p class="note">근거 트리플이 없습니다. 맞는지 틀린지는 <b>사람이 원문을 다시 읽어야</b> 압니다.</p>`;
      } catch (e) {
        box.innerHTML = `<div class="result fail">${esc(e.message || e)}</div>`;
      }
      box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
      b.disabled = false; b.textContent = oldLabel;
    },
  };
  window.renderPart3 = render;

  addEventListener('resize', () => {
    if (P3.tab === 'time') layoutTime();
    if (P3.tab === 'net' && NET.cv) fitNet();
  });
})();
