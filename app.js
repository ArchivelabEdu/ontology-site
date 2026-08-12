/* 온톨로지와 RiC-O — 구술기록으로 배우기
   1부 개념카드 12장(장마다 드래그 연습) + 2부 그라운딩 워크벤치 */
const D = window.NARA;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clsPill = c => `<span class="pill c-${c}">rico:${c}</span>`;

const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

/* ══════════ 테마 ══════════ */
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark'
    : (matchMedia('(prefers-color-scheme:dark)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('nara-theme', next); } catch (e) { }
}
try {
  const t = localStorage.getItem('nara-theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) { }

/* ══════════ 1부 · 개념 카드 ══════════ */
const tripleSVG = (s, sc, p, o, oc) => `
<div class="triple">
  <span class="node c-${sc}">${esc(s)}</span>
  <span class="arrow"><span class="p">rico:${p}</span><span class="line"></span></span>
  <span class="node c-${oc}">${esc(o)}</span>
</div>`;

/* 1장 그림 — 위 트리플 세 줄을 그래프 하나로.
   요점은 병합이다: 세 줄에 두 번씩 나온 정세균·한보사태가 여기서는 노드 하나다.
   노드마다 클래스와 식별자를 달아 1.2 표의 세 가지가 그림에서 보이게 한다. */
function graph1SVG() {
  const node = (x, y, w, color, tag, name, id) => `
    <rect x="${x}" y="${y}" width="${w}" height="66" rx="10"
      fill="var(--card)" stroke="var(${color})" stroke-width="1.6"/>
    <text x="${x + 12}" y="${y + 17}" fill="var(${color})" font-family="var(--sans)" font-size="10">${tag}</text>
    <text x="${x + 12}" y="${y + 38}" fill="var(--fg)" font-family="var(--sans)" font-size="13.5" font-weight="700">${name}</text>
    <text x="${x + 12}" y="${y + 56}" fill="var(--muted)" font-family="var(--mono)" font-size="9.5">${id}</text>`;
  const edge = (x1, y1, x2, y2, lx, ly, p) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sv-l" marker-end="url(#ah1)"/>
    <text x="${lx}" y="${ly}" class="sv-p" text-anchor="middle">rico:${p}</text>`;
  return `<figure class="svgfig"><svg viewBox="0 0 720 296" role="img"
   aria-label="트리플 세 줄을 그래프 하나로 합친 그림. 정세균에서 총학생회장으로, 총학생회장에서 고대로 선이 이어지고, 정세균 1차 구술에서 정세균으로 주제 선이 나간다. 노드마다 클래스와 식별자가 붙어 있다">
  <defs><marker id="ah1" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7"
    orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" class="sv-ah"/></marker></defs>
  ${node(30, 112, 172, '--cls-agent', '인물 · Person', '정세균', 'ric:agent-071')}
  ${node(508, 16, 190, '--cls-agent', '직위 · Position', '총학생회장', 'ric:local-총학생회장')}
  ${node(508, 152, 190, '--cls-agent', '단체 · CorporateBody', '고대', 'ric:local-고대')}
  ${node(30, 216, 196, '--cls-record', '기록 · Record', '정세균 1차 구술', 'ric:local-정세균1차구술')}
  ${edge(202, 128, 505, 54, 348, 72, 'occupiesOrOccupied')}
  ${edge(560, 85, 560, 148, 648, 122, 'existsOrExistedIn')}
  ${edge(112, 213, 112, 181, 224, 202, 'hasOrHadSubject')}
</svg><figcaption>트리플 세 줄이 지식그래프 하나로 <b>병합됩니다</b>.
식별자가 같은 정세균·총학생회장은 <b>하나의 노드</b>로 모입니다.</figcaption></figure>`;
}

/* 4장 — 지식그래프 구축 5단계 */
const STAGES = [
  ['필드 정규화',
   '흩어진 목록·엑셀의 표기와 형식을 하나로 맞춘다. 날짜는 한 가지 형식으로, 이름은 표준 표기로, 빈 칸과 중복은 정리.',
   '아직 표입니다. 그러나 여기가 어긋나면 뒤가 전부 어긋납니다'],
  ['전거 URI 연결',
   '정규화한 이름을 실재하는 행위자에 대조해 IRI를 붙인다. 전거에 없는 이름은 버리지 않고 신규 후보로 격리한다.',
   '글자가 개체가 되는 지점 · 5·8장, 2부 ④단계'],
  ['AP 설계',
   '응용 프로파일(Application Profile). 표준 어휘 가운데 우리 기관이 실제로 쓸 클래스·속성만 고르고 도메인·레인지를 확정한다.',
   '구술 프로파일의 12클래스·30속성이 그 결과물 · 6·11장'],
  ['RDF 및 SPARQL 구현',
   '데이터를 트리플로 변환해 트리플스토어에 적재하고, 표준 질의어로 검색할 수 있게 한다.',
   '표가 아니라 질의할 수 있는 그래프가 된다 · 12장, 2부 ⑦단계'],
  ['추론 · 추천 · AI 활용',
   '아무도 적지 않은 사실이 규칙에서 저절로 나온다 — “정세균이 국회의장을 맡았다” 한 줄만 넣어도 ' +
   '“국회의장의 재임자는 정세균”이 성립한다(7장 역방향). AI 의 답도 그래프의 트리플로 근거를 짚을 수 있다.',
   '이것이 그라운딩 · 3부 「같은 질문을 둘에게」'],
];
/* 번호 붙은 계단 목록 — 4장 구축 단계, 8장 전거 작업의 변화가 함께 쓴다 */
const stairHTML = items => `<ol class="stair">${items.map(([t, d, w], i) => `
  <li><span class="sn">${i + 1}</span><div><b>${t}</b><p>${d}</p><span class="sw">${w}</span></div></li>`).join('')}
</ol>`;
const stagesHTML = () => stairHTML(STAGES);

/* 8장 — ISAAR(CPF) 방식에서 RiC-O 방식으로 올 때 손에 잡히는 변화 */
const AUTH_SHIFT = [
  ['폼을 채우는 일에서, 이을 것을 먼저 세우는 일로',
   'ISAAR 방식은 전거레코드 한 건의 폼을 다 채우면 끝납니다. RiC에서는 인물을 기술하려면 ' +
   '<b>직위·단체·사건이 이미 개체로 존재해야</b> 합니다.',
   '작업 순서가 뒤집힙니다 — 이을 대상부터 세웁니다'],
  ['잘 쓴 이력 문단이 부채가 됩니다',
   '<code>rico:history</code>로 문단을 그대로 옮길 수는 있습니다. 그러나 그건 이행이 아니라 보관입니다. ' +
   '“1997년 재경위 간사, 2016년 국회의장”을 <b>트리플로 꺼내야</b> 비로소 이행입니다.',
   '서술이 데이터가 되는 지점 · 2부 워크벤치가 이것을 손으로 겪게 합니다'],
  ['직위에도 전거가 생깁니다',
   'ISAAR에서 ‘국회의장’은 이력 문단 속의 말이거나 관계에 붙는 설명이었습니다. 기술 대상은 사람뿐이었습니다. ' +
   'RiC-O에서 <code>Position</code>은 <code>Agent</code>의 <b>하위 클래스</b>라, 인물과 똑같이 ' +
   '자기 이름·존속기간·소속을 갖는 <b>독립 개체</b>가 됩니다.',
   '전거의 대상이 사람만이 아니게 됩니다 — 바로 위 3-홉에서 직위가 주어 자리에 설 수 있는 이유'],
  ['관계가 레코드 밖으로 나옵니다',
   'ISAAR에서는 A–B 관계를 A의 레코드에도 B의 레코드에도 적어야 했고, 둘이 어긋날 수 있었습니다. ' +
   'RiC에서 관계는 <b>어느 쪽 레코드에도 속하지 않습니다.</b>',
   '한 번만 적으면 양쪽에서 보입니다 — Omeka S의 Linked Resources 탭이 그 결과입니다'],
];

/* 11장 그림 — 트리플 한 줄 vs 관계를 개체로 편 n-ary */
function narySVG() {
  const box = (x, y, w, h, t, sz) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="sv-box"/>
     <text x="${x + w / 2}" y="${y + h / 2 + 4}" class="sv-t"${sz ? ` font-size="${sz}"` : ''} text-anchor="middle">${t}</text>`;
  const leg = (x, y, prop, val) => `
    <rect x="${x}" y="${y}" width="164" height="34" rx="7" class="sv-box"/>
    <text x="${x + 82}" y="${y + 14}" class="sv-p" font-size="8.5" text-anchor="middle">rico:${prop}</text>
    <text x="${x + 82}" y="${y + 26}" class="sv-t" font-size="10" text-anchor="middle">${val}</text>`;
  return `<figure class="svgfig"><svg viewBox="0 0 720 330" role="img"
   aria-label="위는 트리플 한 줄, 아래는 같은 사실을 관계 개체로 펴서 기간·확실성·근거를 붙인 n-ary 구조">
  <defs><marker id="ahn" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7"
    orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" class="sv-ah"/></marker></defs>

  <text x="14" y="18" class="sv-t" font-weight="700" font-size="11">Core — 트리플 한 줄</text>
  ${box(24, 32, 108, 32, '정세균')}
  <text x="216" y="44" class="sv-p" font-size="8.5" text-anchor="middle">rico:occupiesOrOccupied</text>
  <line x1="132" y1="48" x2="296" y2="48" class="sv-l" marker-end="url(#ahn)"/>
  ${box(300, 32, 176, 32, '제20대 전반기 국회의장', 11)}
  <text x="492" y="52" class="sv-n" font-size="10">기간·근거를 붙일 자리가 없다</text>

  <line x1="14" y1="88" x2="706" y2="88" class="sv-l" stroke-dasharray="4 5"/>

  <text x="14" y="112" class="sv-t" font-weight="700" font-size="11">n-ary — 관계를 개체로</text>
  ${box(24, 130, 108, 34, '정세균')}
  <text x="199" y="142" class="sv-p" font-size="8.5" text-anchor="middle">relationHasSource</text>
  <line x1="132" y1="147" x2="266" y2="147" class="sv-l" marker-end="url(#ahn)"/>
  <rect x="270" y="126" width="176" height="42" rx="9" class="sv-box hl"/>
  <text x="358" y="142" class="sv-p" font-size="9" text-anchor="middle">rico:PositionHoldingRelation</text>
  <text x="358" y="157" class="sv-s" font-size="9.5" text-anchor="middle">이 관계가 하나의 개체</text>
  <text x="515" y="142" class="sv-p" font-size="8.5" text-anchor="middle">relationHasTarget</text>
  <line x1="446" y1="147" x2="580" y2="147" class="sv-l" marker-end="url(#ahn)"/>
  ${box(584, 130, 122, 34, '국회의장 직위', 10.5)}

  ${[[14, 'beginningDate', '2016-06-09'], [190, 'endDate', '2018-05-29'],
      [366, 'relationCertainty', 'certain'], [542, 'isEvidencedBy', '1차 구술']]
      .map(([x, p, v]) => `<line x1="358" y1="168" x2="${x + 82}" y2="${240}" class="sv-l" marker-end="url(#ahn)"/>${leg(x, 244, p, v)}`).join('')}
  <text x="14" y="306" class="sv-n" font-size="10">→ 관계가 개체이므로, 관계에도 속성을 달 수 있습니다</text>
</svg><figcaption>같은 사실을 두 가지로. 아래쪽은 W3C <i>n-ary 릴레이션 패턴</i> — 관계를 위한 클래스를 하나 두고,
참여자를 <code>relationHasSource</code>·<code>relationHasTarget</code>으로 매답니다.</figcaption></figure>`;
}

/* 10장 그림 — 계층 한 자리(ISAD(G)) vs 맥락마다 선 하나(RiC) */
function netSVG() {
  const box = (x, y, w, h, t, hl) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="sv-box${hl ? ' hl' : ''}"/>
     <text x="${x + w / 2}" y="${y + h / 2 + 4}" class="sv-t" text-anchor="middle">${t}</text>`;
  const targets = [
    [48, '상위 기록집합', 'isOrWasIncludedIn', '국회의장단 구술총서'],
    [110, '주제', 'hasOrHadSubject', '한보사태'],
    [172, '생산자', 'hasCreator', '국회기록보존소'],
    [234, '구현체', 'hasOrHadInstantiation', '구술 영상 MP4'],
    [296, '관련 날짜', 'isAssociatedWithDate', '2018-08-14'],
  ];
  return `<figure class="svgfig"><svg viewBox="0 0 720 384" role="img"
   aria-label="왼쪽은 기록을 계층 한 자리에 넣는 ISAD(G), 오른쪽은 같은 기록을 다섯 맥락에 동시에 잇는 RiC">
  <defs><marker id="ahd" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7"
    orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" class="sv-ah"/></marker></defs>

  <text x="14" y="24" class="sv-t" font-weight="700">ISAD(G) · 계층</text>
  <text x="14" y="42" class="sv-s">한 기록은 한 자리에만</text>
  ${box(24, 58, 214, 34, '국회의장단 구술총서')}
  <line x1="131" y1="92" x2="131" y2="116" class="sv-l"/>
  ${box(48, 116, 214, 34, '정세균 구술기록')}
  <line x1="155" y1="150" x2="155" y2="174" class="sv-l"/>
  ${box(72, 174, 214, 34, '정세균 1차 구술')}
  <text x="24" y="242" class="sv-s">면담자 · 채록사업 · 주제 · 수록매체는</text>
  <text x="24" y="259" class="sv-s">설명란 안의 글자로만 남습니다.</text>
  <text x="24" y="286" class="sv-n">→ 검색은 되어도 따라갈 수 없습니다</text>

  <line x1="320" y1="14" x2="320" y2="370" class="sv-l" stroke-dasharray="4 5"/>

  <text x="340" y="24" class="sv-t" font-weight="700">RiC · 그물</text>
  <text x="340" y="42" class="sv-s">맥락마다 선 하나</text>
  ${box(340, 170, 124, 42, '정세균 1차 구술', true)}
  ${targets.map(([y, ko, prop, label]) => `
  <line x1="464" y1="191" x2="574" y2="${y + 15}" class="sv-l" marker-end="url(#ahd)"/>
  <text x="706" y="${y - 20}" text-anchor="end" class="sv-t" font-size="10.5" fill="currentColor" style="color:var(--accent)">${ko}</text>
  <text x="706" y="${y - 8}" text-anchor="end" class="sv-p" font-size="8">rico:${prop}</text>
  ${box(580, y, 126, 30, label)}`).join('')}
  <text x="340" y="366" class="sv-n">→ 어느 쪽에서 들어와도 이 구술에 닿습니다</text>
</svg><figcaption>같은 기록, 두 가지 놓는 법. 왼쪽에서 잃어버리는 맥락이 오른쪽에서는 전부 따라갈 수 있는 선이 됩니다.</figcaption></figure>`;
}

/* 10장 — RiC-CM 엔티티 표. RiC-O_1-1.rdf 의 엔티티 주석에서 확인한 19종 */
const CM_ENTITIES = [
  ['E01', 'Thing', '사물', '모든 것의 최상위. 아래 모든 엔티티를 포괄한다'],
  ['E02', 'RecordResource', '기록자원', '기록집합·기록·기록구성부분의 상위'],
  ['E03', 'RecordSet', '기록집합', '관련 기록을 묶은 집합'],
  ['E04', 'Record', '기록', '증거적 가치를 지닌 개별 기록 단위'],
  ['E05', 'RecordPart', '기록구성부분', '기록 안의 독립 기술 대상 부분'],
  ['E06', 'Instantiation', '구현체', '기록이 특정 매체·형태로 실현된 실체'],
  ['E07', 'Agent', '행위자', '인물·그룹·직위·기계장치의 상위'],
  ['E08', 'Person', '인물', '개인'],
  ['E09', 'Group', '그룹', '가족·단체의 상위'],
  ['E10', 'Family', '가족', '혈연·혼인으로 이어진 집단'],
  ['E11', 'CorporateBody', '단체', '법인·기관·조직'],
  ['E12', 'Position', '직위', '단체 안에 있으면서 인물이 맡는 자리'],
  ['E13', 'Mechanism', '기계장치', '자동으로 기록을 만드는 장치·소프트웨어'],
  ['E14', 'Event', '사건', '특정 시점에 일어난 일'],
  ['E15', 'Activity', '활동', '어떤 목적으로 수행하는 일'],
  ['E16', 'Rule', '규칙', '기록·활동을 규율하는 법령·지침·표준'],
  ['E17', 'Mandate', '위임근거', '행위자에게 활동 권한을 주는 규칙'],
  ['E18', 'Date', '날짜', '시간 표현'],
  ['E22', 'Place', '장소', '지리적 위치'],
];
const CORE12 = new Set(['RecordSet', 'Record', 'Instantiation', 'Agent', 'Person',
  'CorporateBody', 'Position', 'Activity', 'Event', 'Place', 'Date', 'Rule']);

function cmTable() {
  return `<div class="vwrap"><table>
  <tr><th>번호</th><th>RiC-O 클래스</th><th>한글</th><th>뜻</th><th>이 사이트</th></tr>
  ${CM_ENTITIES.map(([id, t, ko, def]) => `<tr>
    <td class="mono" style="color:var(--muted)">RiC-${id}</td>
    <td>${clsPill(t)}</td><td>${ko}</td><td class="vdef">${def}</td>
    <td>${CORE12.has(t) ? '<b style="color:var(--accent)">Core</b>' : '<span style="color:var(--muted)">—</span>'}</td>
  </tr>`).join('')}
  </table></div>`;
}

const CARDS = [
  {
    n: 1, tag: '온톨로지란 무엇인가', kicker: '개요',
    body: `
<div class="defbox"><b>온톨로지(Ontology)</b>는 어떤 영역에 <b>무엇이 존재하는가</b>를 종류로 나누고,
그것들이 <b>서로 어떻게 이어지는가</b>를 기계가 읽을 수 있는 형식으로 명시해 둔 어휘 체계다.
<span class="src">T. Gruber(1993)의 고전적 정의 “개념화에 대한 명시적 명세” · W3C, <i>OWL 2 Primer</i>, §1</span></div>
<h3>온톨로지가 정하는 세 가지</h3>
<div class="scroll"><table>
<tr><th></th><th>정하는 것</th><th>예시</th></tr>
<tr><td><b>무엇이 있는가</b></td><td>개체의 종류 = <b>클래스</b></td><td>인물 · 단체 · 직위 · 기록 · 사건 · 장소</td></tr>
<tr><td><b>어떻게 부르는가</b></td><td>고유 <b>식별자</b></td><td><code>ric:agent-071</code> — 표기가 ‘정세균’이든 ‘丁世均’이든 이 번호 하나를 가리킨다</td></tr>
<tr><td><b>어떻게 이어지는가</b></td><td>관계 = <b>속성</b>과 그 <b>제약</b></td><td>인물은 직위를 <b>맡는다</b> — ‘대한민국 국회’가 아니라 ‘국회의장’을 맡는다</td></tr>
</table></div>
<h3>사람이 읽는 방식 — 원문과 기술서</h3>
<div class="ex"><div class="lbl">구술 원문</div>
<div class="quote">"권노갑 고문은 저하고는 인연이 없었는데, 제가 잘 아는 쌍용USA의 사장님하고 잘 알았어요. …
김대중 총재는 그분들이 소개해서 만났어요. 제가 고대 총학생회장을 한 데다가 해외 주재원 출신이잖습니까."</div>
<div class="cite">정세균 구술, 1차 구술, 46쪽</div>
<div class="lbl" style="margin-top:1.1rem">기술서</div>
<pre>기록명            : 정세균 1차 구술 녹취문
생산자            : 국회기록보존소
관련인물          : 정세균, 김대중, 권노갑
설명              : 고대 총학생회장 경력과 김대중 총재와의 만남을 구술함</pre>
<p style="margin:.5rem 0 0;font-size:.88rem">원문과 기술서에서 위 세 가지는 <b>명시되어 있지 않습니다</b> — 읽는 사람이 추론으로 채웁니다.</p>
<ul style="margin:.4rem 0 0;font-size:.88rem">
<li><b>무엇이 있는가</b> — 누가 구술자이고 총학생회장이 사람인지 자리인지, 읽어야 압니다.</li>
<li><b>어떻게 부르는가</b> — ‘정세균’이 어느 정세균인지, 문맥으로 짐작할 뿐입니다.</li>
<li><b>어떻게 이어지는가</b> — 정세균이 총학생회장을 맡았다는 것이 <code>설명</code> 문장 안에 녹아 있습니다.</li>
</ul></div>
<h3>기계가 읽는 방식 — 노드와 엣지</h3>
<p>같은 내용을 온톨로지로 옮기면 <b>노드(점)와 엣지(선)</b>가 됩니다.</p>
<div class="lbl" style="margin-top:.9rem">트리플</div>
${tripleSVG('정세균', 'Person', 'occupiesOrOccupied', '총학생회장', 'Position')}
${tripleSVG('총학생회장', 'Position', 'existsOrExistedIn', '고대', 'CorporateBody')}
${tripleSVG('정세균 1차 구술', 'Record', 'hasOrHadSubject', '정세균', 'Person')}
<p>추론에 맡겨져 있던 세 가지가 <b>명시됩니다</b> —
노드마다 <b>클래스</b>와 <b>식별자</b>가 붙고, 맡았다·다루었다가 <b>서로 다른 엣지</b>로 분화됩니다.</p>
<div class="lbl" style="margin-top:1rem">지식그래프</div>
${graph1SVG()}
<h3>AI 시대의 온톨로지</h3>
<ul>
<li><b>AI 에게 기준을 줍니다.</b> 어휘와 제약을 정해 두면 지어낼 여지가 줄고, 틀린 것을 기계적으로 걸러 냅니다.</li>
<li><b>AI 의 답에 근거가 달립니다.</b> 그래프에 물으면 어느 트리플에서 나온 답인지가 따라옵니다.</li>
</ul>
<div class="ex"><div class="lbl">1부 목차</div>
<p style="margin:.3rem 0;font-size:.89rem">
<b>1장 — 개요.</b> 온톨로지란 무엇인가.<br>
<b>2~5장 — 재료.</b> 클래스와 인스턴스, 리터럴과 객체 속성, 트리플, 식별자.<br>
<b>6~7장 — 규칙.</b> 도메인·레인지, 그리고 RDF·RDFS·OWL 3층.<br>
<b>8~9장 — 기록학과의 접점.</b> 전거레코드, 그리고 분류·시소러스와의 경계.<br>
<b>10~11장 — 우리가 쓸 표준.</b> RiC-CM과 RiC-O.<br>
<b>12장 — 꺼내 쓰기.</b> SPARQL.</p></div>
<p class="note">온톨로지의 어휘는 <b>URI 라서 데이터의 문장마다 실려 다니고</b>, 정의 자체도 기계가 읽는 공개 문서입니다.
그래서 남의 데이터와 만났을 때 같은 말을 쓰는지 기계가 확인할 수 있습니다.</p>`
  },
  {
    n: 2, tag: '개체 · 클래스 · 인스턴스', kicker: 'RDF Schema',
    body: `
<div class="defbox"><b>클래스(Class)</b>는 개체들의 범주이고, <b>인스턴스(Instance)</b>는 그 범주에 속하는 개별 개체다.
어떤 개체가 어떤 클래스에 속하는지는 <code>rdf:type</code>으로 밝힌다.
<span class="src">W3C, <i>RDF Schema 1.1</i>, §2.1</span></div>
<p>글자 "김대중"에 클래스가 붙는 순간, <b>기계가 다룰 수 있는 개체가 됩니다.</b></p>
<div class="ex"><div class="lbl">구술 원문</div>
<div class="quote">"권노갑 고문은 저하고는 인연이 없었는데, 제가 잘 아는 쌍용USA의 사장님하고 잘 알았어요. …
김대중 총재는 그분들이 소개해서 만났어요. 제가 고대 총학생회장을 한 데다가 해외 주재원 출신이잖습니까."</div>
<div class="cite">정세균 구술, 1차 구술, 46쪽</div></div>
<div class="scroll"><table>
<tr><th>개체 (원문의 표기)</th><th>클래스</th><th>설명</th></tr>
<tr><td>권노갑</td><td>${clsPill('Person')}</td><td>개인</td></tr>
<tr><td>김대중</td><td>${clsPill('Person')}</td><td>개인</td></tr>
<tr><td>쌍용USA</td><td>${clsPill('CorporateBody')}</td><td>조직·기관</td></tr>
<tr><td>총학생회장</td><td>${clsPill('Position')}</td><td>사람이 맡는 자리</td></tr>
</table></div>
<p class="note">위 표의 한 줄이 트리플 하나입니다.
권노갑과 김대중은 <b>같은 클래스의 서로 다른 인스턴스</b>입니다.</p>`
  },
  {
    n: 3, tag: '속성: 리터럴과 객체 속성', kicker: 'RDF 1.1 · OWL 2',
    body: `
<div class="defbox"><b>속성(Property)</b>은 개체를 다른 개체 또는 값에 잇는 관계다.
값이 문자·숫자·날짜 같은 <b>리터럴(Literal)</b>이면 <b>데이터 속성(datatype property)</b>,
값이 또 다른 개체이면 <b>객체 속성(object property)</b>이다.
<span class="src">W3C, <i>RDF 1.1 Concepts and Abstract Syntax</i>, §3.3–3.5 · <i>OWL 2 Primer</i>, §3
— OWL에서는 각각 <code>owl:DatatypeProperty</code> · <code>owl:ObjectProperty</code>로 선언한다</span></div>
<p><b>리터럴은 검색만 되고, 개체는 링크됩니다.</b></p>
<div class="omk">
  <div class="omk-h"><img class="omk-img" src="assets/person-jung-sye-kyun.jpg" alt="정세균 초상">
    아이템 편집 — 정세균 <span class="pill c-Person">rico:Person</span></div>
  <div class="omk-row"><div class="omk-lbl">이름 <code>rico:name</code></div>
    <div class="omk-val">정세균</div><span class="omk-tag">리터럴</span></div>
  <div class="omk-row"><div class="omk-lbl">식별기호 <code>rico:identifier</code></div>
    <div class="omk-val">agent-071</div><span class="omk-tag">리터럴</span></div>
  <div class="omk-row"><div class="omk-lbl">재임 직위 <code>rico:occupiesOrOccupied</code></div>
    <div class="omk-val"><span class="omk-chip c-Position">총학생회장 ↗</span></div><span class="omk-tag obj">개체 연결</span></div>
  <div class="omk-row"><div class="omk-lbl">소속 <code>rico:isOrWasMemberOf</code></div>
    <div class="omk-val"><span class="omk-chip c-CorporateBody">새정치국민회의 ↗</span></div><span class="omk-tag obj">개체 연결</span></div>
</div>
<p class="note">판단 기준 — <b>“클릭해서 다른 데로 가고 싶은가?”</b> 그렇다면 개체 연결(객체 속성), 아니면 값(데이터 속성)입니다.</p>`
  },
  {
    n: 4, tag: '트리플과 지식그래프', kicker: 'RDF 1.1',
    body: `
<div class="defbox"><b>트리플(Triple)</b>은 주어(Subject)–서술어(Predicate)–목적어(Object) 세 칸으로 이루어진
RDF의 최소 진술 단위다. 트리플의 집합이 <b>그래프(Graph)</b>를 이룬다.
<span class="src">W3C, <i>RDF 1.1 Concepts and Abstract Syntax</i>, §3</span></div>
<p>점 두 개를 선 하나로 잇습니다. 이 단순한 형식이 <b>표로는 못 하던 질문</b>을 가능하게 합니다.</p>
${tripleSVG('정세균', 'Person', 'isOrWasParticipantIn', '한보사태', 'Event')}
${tripleSVG('정세균', 'Person', 'isOrWasMemberOf', '새정치국민회의', 'CorporateBody')}
${tripleSVG('정세균 2차 구술', 'Record', 'hasOrHadSubject', '한보사태', 'Event')}
<p>트리플 세 줄을 쌓으면 그래프입니다. 이제 이렇게 물을 수 있습니다 —
<b>"한보사태를 언급한 구술기록에 등장하는 인물 중, 새정치국민회의 소속은 누구인가?"</b>
엑셀 표로는 조인을 몇 번 해야 하지만, 그래프에서는 선을 따라가면 됩니다.</p>
<p class="note">엑셀 한 행이 한 개체라면, 트리플 한 줄은 한 개의 <i>사실</i>입니다. 단위가 더 작기 때문에 더 자유롭게 조립됩니다.</p>

<h3>지식그래프라고 부르려면 — 다섯 가지 요건</h3>
<p>관계를 그린 그림이라고 다 지식그래프는 아닙니다. 파워포인트로 그린 관계도에는 없고
지식그래프에는 있는 것이 다섯 가지입니다. <b>이 다섯을 갖춰야 남의 데이터와 만나고 기계가 따라갑니다.</b></p>
<div class="scroll"><table>
<tr><th>요건</th><th>무엇을 뜻하는가</th><th>예시</th></tr>
<tr><td><b>URI 기반 식별</b></td>
  <td>모든 개체가 <b>세상에서 유일한 IRI</b>(웹 자원 식별자)를 갖는다.
    이름이 아니라 식별자가 개체를 가리킨다</td>
  <td>5장 · 위키데이터가 발급한 정세균의 IRI — <b>눌러 보세요</b><br>
    <a class="iri" href="http://www.wikidata.org/entity/Q11270093" target="_blank" rel="noopener"><code>http://www.wikidata.org/entity/Q11270093</code></a><br>
    이 사이트는 <code>ric:agent-071</code>로 두고 <code>owl:sameAs</code>로 저 IRI에 잇습니다</td></tr>
<tr><td><b>기계 판독 가능한 구조</b></td>
  <td>RDF처럼 표준화된 형식으로 표현되어, <b>파서</b>(구문 분석기)만 있으면 어느 시스템이든 읽는다</td>
  <td>4·7장 · 트리플과 RDF·RDFS·OWL 3층. 산출물은 RDF/XML·Turtle·JSON-LD</td></tr>
<tr><td><b>공유 가능한 시맨틱 어휘</b></td>
  <td>자체 어휘가 아니라 공표된 표준 어휘를 쓴다. <b>남의 데이터와</b> 같은 말을 쓰는지 기계가 확인할 수 있다</td>
  <td>10·11장 · RiC-O 1.1의 부분집합. 네임스페이스와 이름은 원본 그대로</td></tr>
<tr><td><b>관계 중심의 데이터 조직</b></td>
  <td>칸을 채우는 대신 개체와 개체를 잇는다. 계층은 지식그래프의 <b>여러 관계 중 하나일 뿐이다</b></td>
  <td>3·10장 · 객체 속성이 555개 중 480개. RiC은 계층을 그물로 바꾼다</td></tr>
<tr><td><b>질의·재사용 가능한 구조</b></td>
  <td>표준 질의어로 검색할 수 있고, 남이 가져가 다시 쓸 수 있다</td>
  <td>12장 · SPARQL. <b>3부</b>에서 브라우저 안 엔진으로 직접 실행</td></tr>
</table></div>
<p class="note">거꾸로 읽으면 점검표가 됩니다 — <b>식별자가 없거나, 형식이 우리 기관 전용이거나, 어휘를 우리가 지어냈거나,
표를 그대로 옮겨 놓았거나, 질의할 방법이 없다면</b> 그것은 아직 지식그래프가 아니라 관계도입니다.</p>

<h3>실제로는 이 순서로 만듭니다</h3>
<p><b>앞 단계가 끝나야 다음 단계가 의미를 갖습니다.</b> 우리 기관이 몇 단계에 있는지부터 정하면 됩니다.</p>
${stagesHTML()}
<p class="note">2부 워크벤치가 <b>위 1~4단계를 30분으로 압축한 것</b>입니다 —
원문에서 개체를 뽑아 표기를 고르고(<b>정규화</b>), 역대 의장단 전거에 대조하고(<b>전거 URI</b>),
12클래스·30속성 프로파일을 씌우고(<b>AP</b>), Turtle로 내보내 질의문까지 만듭니다(<b>RDF·SPARQL</b>).
5단계 추론·AI 는 3부에서 맛봅니다.</p>`
  },
  {
    n: 5, tag: 'URI와 식별자', kicker: 'RFC 3986 · Linked Data',
    body: `
<div class="defbox">RDF에서 개체와 속성은 <b>IRI(International Resource Identifier)</b>로 식별된다.
같은 IRI는 언제 어디서나 같은 것을 가리킨다.
<span class="src">W3C, <i>RDF 1.1 Concepts</i>, §3.2 · IETF RFC 3986</span></div>
<p>왜 "정세균"이라고 쓰면 안 되는가 — <b>동명이인</b>과 <b>여러 표기</b> 때문입니다.
정세균/丁世均/JEONG Sye-kyun은 같은 사람이고, 김영삼과 김영삼(다른 사람)은 다른 사람입니다.
글자는 이 둘을 구별하지 못하지만 식별자는 구별합니다.</p>
<div class="ex"><div class="lbl">이름 대신 식별자를</div>
<pre>ric:agent-071   rico:name  "정세균" ;
                rico:name  "丁世均" ;
                rico:birthDate "1950" .</pre>
<p style="margin:.4rem 0 0;font-size:.87rem">표기는 여러 개, 식별자는 하나. <b>전거레코드가 하는 일이 정확히 이것입니다.</b></p></div>
<h3>어떤 것이 IRI인가</h3>
<p>IRI 는 <b>스킴://호스트/경로</b> 모양의 이름입니다. 한글을 그대로 써도 됩니다 —
<code>%EC%A0%95…</code> 처럼 ASCII 로만 적으면 URI, 한글을 그대로 두면 IRI 입니다(IRI 가 URI 를 포함합니다).
<b>모양만 갖추면 되는 게 아니라, 무엇을 가리키느냐가 중요합니다.</b></p>
<div class="scroll"><table>
<tr><th>주소</th><th>무엇을 가리키나</th></tr>
<tr><td><code class="iri">http://archives.nanet.go.kr/id/agent-071</code></td>
  <td>✓ <b>정세균이라는 사람.</b> 우리 기관이 부여한 IRI</td></tr>
<tr><td><code class="iri">http://www.wikidata.org/entity/Q11270093</code></td>
  <td>✓ <b>같은 사람.</b> 위키데이터가 부여 — <code>owl:sameAs</code>로 잇는다</td></tr>
<tr><td><a class="iri" href="https://archivelabedu.github.io/ontology-starterkit/#/c/col-%EC%A0%95%EC%84%B8%EA%B7%A0-%EA%B5%AC%EC%88%A0/item/agent-jsk" target="_blank" rel="noopener"><code>https://archivelabedu.github.io/ontology-starterkit/#/c/col-%EC%A0%95%EC%84%B8%EA%B7%A0-%EA%B5%AC%EC%88%A0/item/agent-jsk</code></a></td>
  <td>✗ <b>화면 한 장.</b> 사람이 아니라 웹페이지다 — 눌러 보세요</td></tr>
<tr><td><code>정세균</code></td>
  <td>✗ <b>글자.</b> 동명이인과 여러 표기를 가리지 못한다</td></tr>
</table></div>
<p class="note">셋째 줄이 함정입니다. 주소 안에 <code>agent-jsk</code>가 보이지만 그건 화면 경로일 뿐이고,
<code>#</code> 뒤는 브라우저 안에서만 쓰여 서버는 보지도 못합니다.
화면 주소를 사람의 식별자로 삼으면 <b>“이 페이지가 1950년에 태어났다”</b>가 되고,
화면 구조를 바꾸는 순간 그 사람을 가리키던 이름이 사라집니다. <b>식별자는 화면보다 오래 살아야 합니다.</b></p>
<p class="note">그래서 순서가 이렇습니다 — 기관이 <b>자기 IRI를 부여</b>하고, 그것을 <code>owl:sameAs</code>로
위키데이터·VIAF 같은 <b>외부 IRI에 잇습니다.</b></p>`
  },
  {
    n: 6, tag: '도메인과 레인지', kicker: 'RDF Schema · 이 사이트의 핵심',
    body: `
<div class="defbox"><code>rdfs:domain</code>은 그 속성을 <b>주어</b>로 쓸 수 있는 클래스를,
<code>rdfs:range</code>는 <b>목적어</b>로 올 수 있는 클래스를 규정한다.
<span class="src">W3C, <i>RDF Schema 1.1</i>, §3.1–3.2</span></div>
<p>속성은 아무 데나 붙지 않습니다. <b>속성마다 붙을 수 있는 자리가 정해져 있습니다.</b>
이것이 온톨로지가 LLM의 환각을 줄이는 기계적 근거입니다 — 어휘를 제한하면 지어낼 여지가 줄어듭니다.</p>
<div class="ex"><div class="lbl">RiC-O 1.1 실제 정의</div>
<div class="scroll"><table>
<tr><th>속성</th><th>도메인(주어)</th><th>레인지(목적어)</th></tr>
<tr><td><code>occupiesOrOccupied</code></td><td>${clsPill('Person')}</td><td>${clsPill('Position')}</td></tr>
<tr><td><code>hasOrHadPosition</code></td><td>${clsPill('CorporateBody')}</td><td>${clsPill('Position')}</td></tr>
<tr><td><code>hasCreator</code></td><td>${clsPill('Record')}</td><td>${clsPill('Agent')}</td></tr>
</table></div></div>
<p><b>이게 왜 중요한가.</b> LLM에게 구술문을 주고 "관계를 뽑아라"라고 하면 이런 걸 만들어 옵니다.</p>
<div class="trow err"><span>정세균</span><span class="p">occupiesOrOccupied</span><span>대한민국 국회</span>
<span class="why">✗ 레인지 위반 — 목적어는 ${clsPill('Position')}이어야 하는데 ${clsPill('CorporateBody')}가 왔다</span></div>
<p>“정세균이 국회에 있었다” — 사람이 읽으면 맞는 말 같지만 온톨로지는 <b>거부합니다.</b>
정세균이 맡은 것은 국회가 아니라 <i>국회의장이라는 직위</i>이기 때문입니다.</p>
<div class="trow" style="border-color:var(--ok)"><span>정세균</span><span class="p">occupiesOrOccupied</span>
<span>제20대 전반기 국회의장</span><span class="pg">✓ 통과</span></div>
<p class="note">2부 워크벤치 ⑤단계에서 이걸 직접 겪습니다. 주어를 고르면 서술어 목록이 줄고, 목적어를 잘못 고르면 빨간불이 켜집니다.</p>`
  },
  {
    n: 7, tag: 'RDF · RDFS · OWL 3층', kicker: 'W3C 표준 스택',
    body: `
<div class="defbox"><b>RDF</b>는 트리플로 사실을 표현하고, <b>RDFS</b>는 클래스·속성의 어휘와 계층을 정의하며,
<b>OWL</b>은 그 위에 제약과 추론 규칙을 얹는다.
<span class="src">W3C, <i>RDF 1.1</i> · <i>RDF Schema 1.1</i> · <i>OWL 2 Primer</i></span></div>
<div class="scroll"><table>
<tr><th>층</th><th>하는 일</th><th>예시</th></tr>
<tr><td><b>OWL</b></td><td>제약·추론<br>역방향, 동등, 상호배타</td><td><code>occupiesOrOccupied</code> ↔ <code>isOrWasOccupiedBy</code>는 서로 역방향이라고 <i>선언</i></td></tr>
<tr><td><b>RDFS</b></td><td>어휘·계층<br>클래스, 속성, domain/range</td><td><code>Person rdfs:subClassOf Agent</code></td></tr>
<tr><td><b>RDF</b></td><td>사실 표현<br>트리플</td><td><code>정세균 occupiesOrOccupied 국회의장</code></td></tr>
</table></div>
<p><b>역방향 선언의 실익</b> — 한쪽만 입력하면 반대 방향은 논리적으로 따라옵니다.
"정세균 → 재임직위 → 국회의장"만 넣어도, 국회의장 쪽에서 "재임자: 정세균"이 자동으로 보입니다.
Omeka S의 <code>Linked Resources</code> 탭이 보여주는 게 바로 이겁니다.</p>
<p class="note">RiC-O Core의 객체 속성 20개 중 18개(9쌍)는 RiC-O 원본에 <code>owl:inverseOf</code>가 명시되어 있습니다. 빌드 시 자동 검증한 결과입니다.</p>`
  },
  {
    n: 8, tag: '전거레코드', kicker: 'ISAAR(CPF) → RiC-O',
    body: `
<div class="defbox"><b>전거레코드(Authority Record)</b>는 식별·접근·연결이 필요한 실체에 대해
<b>우선 명칭과 이명, 식별자, 기술 정보, 다른 실체와의 관계, 그리고 그 근거</b>를 관리하는 레코드다.
대상은 개인·가문·단체에 그치지 않고 장소·개념·사건·작품에 이른다.
<span class="src">기록관리에서 ICA <i>ISAAR(CPF)</i> 2판(2004)은 이 가운데 <b>기록의 생산자·유지자인 단체·개인·가문(CPF)</b>을
기술하는 표준이었다 — RiC-O 에서는 <code>rico:Agent</code>와 그 하위 클래스로 포괄된다</span></div>
<p>전거는 <b>이름 목록이 아닙니다.</b> 이름을 하나로 고정하는 건 시작일 뿐이고,
본체는 <b>그 실체가 언제 무엇이었는가</b>입니다.</p>

<h3>‘전거’는 두 가지 뜻으로 쓰입니다</h3>
<p>이 말이 자주 엉키는 이유는 넓은 뜻과 좁은 뜻이 같은 낱말을 쓰기 때문입니다.</p>
<ul>
<li><b>넓은 뜻</b> — 접근점을 통제하는 일 전반. 도서관은 오래전부터 <i>이름 전거</i>와 <i>주제 전거</i>를 함께 두었습니다.</li>
<li><b>좁은 뜻</b> — 기록관리에서 <b>기록의 생산자·유지자(CPF)</b>를 기술하는 것. ISAAR(CPF)가 이 자리입니다.</li>
</ul>
<p>“전거레코드 = 생산자명 표준화”는 <b>좁은 뜻에서는 맞는 말</b>입니다.
다만 RiC·지식그래프를 전제로 이야기할 때는 <b>실체 전거(entity authority)</b>로 넓혀 잡는 편이 맞습니다.
RiC-CM v1.0 은 ISAD(G)·ISAAR(CPF)·ISDF·ISDIAH 네 표준을 대체하려고 만들어졌고(10장),
그 OWL 구현체인 RiC-O 1.1 은 ${clsPill('Agent')} 뿐 아니라
${clsPill('Event')} · ${clsPill('Activity')} · ${clsPill('Place')} 를 <b>저마다 독립한 실체</b>로 둡니다.
이들은 <code>Agent</code> 아래에 있지 않고 <code>rico:Thing</code> 밑에서 <b>나란히</b> 갈라집니다 —
사건이 인물에 딸린 속성이 아니라는 뜻입니다.</p>
<div class="scroll"><table>
<tr><th>구분</th><th>전거의 대상</th><th>대표 사례</th><th>RiC-O 에서는</th></tr>
<tr><td><b>생산자 전거</b></td><td>개인·가문·단체의 식별, 이력, 기능, 관계</td>
    <td>ISAAR(CPF) · EAC-CPF</td><td>${clsPill('Person')} ${clsPill('CorporateBody')} ${clsPill('Position')}</td></tr>
<tr><td><b>지명 전거</b></td><td>장소의 표준명, 이명, 유형, 위치, 행정·역사적 계층</td>
    <td>Getty TGN · GeoNames · 국가 지명 전거</td><td>${clsPill('Place')}</td></tr>
<tr><td><b>개념·주제 전거</b></td><td>개념의 우선어·비우선어, 정의, 상하위·관련 관계</td>
    <td>Getty AAT · LCSH</td><td><b>RiC-O 밖</b> — <code>skos:Concept</code> (다음 장)</td></tr>
<tr><td><b>사건 전거</b></td><td>사건의 명칭, 일시, 장소, 참여자, 유형, 다른 사건과의 관계</td>
    <td>도메인별 사건 전거 (합의된 국제 표준은 아직 없음)</td>
    <td>${clsPill('Event')} (${clsPill('Activity')}가 그 하위)</td></tr>
<tr><td><b>작품 전거</b></td><td>작품의 표제, 이표제, 창작자, 판본 관계</td>
    <td>도서관 저작·통일표제 전거 · VIAF</td>
    <td>따로 두지 않음 — ${clsPill('Record')} ${clsPill('Instantiation')} 로 다루고 외부 전거는 식별자로 연결</td></tr>
</table></div>
<p class="note">표를 읽을 때 주의할 것 둘. ① 셋째 칸의 <b>Getty AAT·TGN 은 전거파일</b>이지만
<code>rico:Event</code>·<code>skos:Concept</code> 은 <b>전거파일이 아니라 어휘·모델</b>입니다 — 층위가 다릅니다.
② <code>Record</code>／<code>Instantiation</code> 의 갈림은 <b>내용과 매체</b>의 구분이지
FRBR·LRM 의 <i>저작–표현형–구현형</i> 층위와 일대일로 맞지는 않습니다.</p>
<p class="note">다섯을 관통하는 것은 하나입니다 — 전거란 <b>식별·명명·변이형·관계·출처를 통제하는
레코드(또는 그래프의 노드)</b>이며, 그 대상이 생산자에 국한되지 않습니다.
다만 <b>개념·주제만은 성격이 다릅니다</b>: 태어나지도 죽지도 않으므로 RiC-O 의 실체가 아니라 SKOS 로 갑니다.
그 경계가 <b>다음 장</b>의 주제입니다.</p>
<p class="note">날짜(${clsPill('Date')})도 <code>Thing</code> 밑에 나란히 있지만 전거의 대상으로는 세지 않았습니다 —
표준명과 이명을 통제할 일이 없기 때문입니다. 구조상 독립 실체인 것과 전거를 둘 만한 것은 다른 이야기입니다.</p>
<p class="note">이 실습에서 실제로 만드는 것은 그중 <b>생산자 전거</b>(역대 국회의장단)입니다.
나머지 넷은 같은 원리가 대상만 바뀐 것이라고 보시면 됩니다.</p>
<h3>이 사이트의 핵심 3-홉</h3>
${tripleSVG('정세균', 'Person', 'occupiesOrOccupied', '제20대 전반기 국회의장', 'Position')}
${tripleSVG('제20대 전반기 국회의장', 'Position', 'existsOrExistedIn', '대한민국 국회', 'CorporateBody')}
<p><b>왜 정세균을 국회에 바로 잇지 않는가?</b></p>
<ul>
<li>정세균은 제15~20대 국회의원이자 제20대 전반기 국회의장이었습니다. 국회와의 관계가 하나가 아닙니다.</li>
<li>직위를 거치면 <b>어떤 자격으로, 언제부터 언제까지</b>가 데이터에 남습니다. (<code>beginningDate 2016-06-09</code> · <code>endDate 2018-05-29</code>)</li>
<li>국회의장이라는 직위는 정세균 이전에도 이후에도 존재합니다. 직위를 독립 개체로 두면 <b>역대 의장단 계보가 저절로 만들어집니다.</b></li>
</ul>
<p class="note">그런데 방금 두 번째 줄에 구멍이 하나 있습니다 — <b>재임기간을 정확히 어디에 적을 것인가.</b>
직위에 붙이면 <i>직위의 존속기간</i>이 되어 버리고, 트리플 한 줄에는 붙일 칸이 없습니다.
표준이 이걸 어떻게 푸는지는 <b>11장 「관계를 개체로 — n-ary 릴레이션 패턴」</b>에서 봅니다.</p>

<h3>ISAAR(CPF)에서 RiC-O로 — 레코드라는 그릇이 없어졌다</h3>
<p>ISAAR(CPF)에서 전거레코드는 <b>문서</b>입니다. 그래서 네 영역(식별·기술·관계·<b>통제</b>)으로 되어 있고,
마지막 통제 영역에는 “이 레코드를 누가 언제 어떤 규칙으로 만들었는가”가 들어갑니다.
<b>레코드가 실체이니 레코드에 대한 관리정보가 필요한 것</b>입니다.</p>
<p>RiC-O 107개 클래스에는 <code>AuthorityRecord</code>가 없습니다.
${clsPill('Person')}의 인스턴스는 <i>정세균이라는 사람</i>이지 <i>정세균에 대한 기술문서</i>가 아닙니다.
<b>기술은 별도 문서가 아니라 그래프 자체입니다.</b></p>
<div class="scroll"><table>
<tr><th></th><th>ISAAR(CPF)</th><th>RiC-O</th></tr>
<tr><td>기술의 단위</td><td>전거레코드 한 건</td><td><b>사실 한 줄</b>(트리플)</td></tr>
<tr><td>인물이란</td><td>레코드가 기술하는 대상</td><td>IRI를 가진 <b>개체 그 자체</b></td></tr>
<tr><td>관계는 어디에</td><td>양쪽 레코드 안에 각각</td><td>레코드 밖에 <b>독립적으로</b></td></tr>
<tr><td>신뢰도·출처</td><td>레코드 단위 (통제 영역)</td>
    <td>사실 단위 — <code>relationCertainty</code> · <code>isEvidencedBy</code> (11장)</td></tr>
</table></div>
<p class="note">넷째 줄 — <b>입자가 잘아진 것이지 없어진 게 아닙니다.</b>
전거레코드 전체를 “초안”으로 표시하는 것보다 <i>어느 관계가 불확실한지</i> 짚는 쪽이 낫습니다.</p>
<p>그렇다면 “누가 언제 이 전거를 작성했고 어떤 규칙을 따랐는가”는 어디에 적을까요.
<b>사람에게는 붙일 수 없습니다.</b> 표준이 준비해 둔 답은 <b>전거레코드를 하나의 기록으로 따로 세우는 것</b>입니다 —
RiC-O의 문서형식 유형 어휘에 <code>ric-dft:AuthorityRecord</code>(“어떤 개체를 기술하는 기록”)가 들어 있습니다.</p>
<pre>ric:authrec-jsk
    a  rico:Record ;
    rico:hasDocumentaryFormType  ric-dft:AuthorityRecord ;
    rico:hasCreator              ric:org-nanet ;        # 통제 영역: 작성기관
    rico:beginningDate           "2026-08-19" ;         # 통제 영역: 작성일
    rico:isOrWasRegulatedBy      ric:rule-kcr4 ;        # 통제 영역: 적용 규칙
    rico:describesOrDescribed    ric:agent-071 .        # ← 이 기록이 기술하는 사람</pre>
<p class="note">즉 <b>없는 게 아니라 강제되지 않는 것</b>입니다. ISAAR에서는 통제 영역을 채우는 것이 표준의 일부였지만,
RiC의 기본 자세는 <b>사람을 그래프에 놓는 것</b>이고 기술물 모델링은 필요할 때 고르는 선택지입니다.
전거의 출처를 관리해야 하는 기관이라면 <b>이 층을 설계에 넣어야 합니다</b> — 저절로 따라오지 않습니다.</p>

<h3>RiC-O에서 전거를 만드는 일이 어떻게 바뀌나?</h3>
<p>Omeka S에서 ‘관련인물’ 필드에 인물 아이템을 연결해 보셨다면 <b>이미 RiC 방식으로 하고 계신 것</b>입니다 —
값 유형 <code>resource</code>로 잇는 것이 곧 객체 속성입니다. 남은 차이는 넷입니다.</p>
${stairHTML(AUTH_SHIFT)}

<div class="ex"><div class="lbl">이미 갖고 있는 전거파일</div>
<p style="margin:.3rem 0;font-size:.9rem">『정세균』 총서 부록의 <b>역대 국회의장단</b> 표 — 대수·전후반기·의장/부의장·재임기간.
이 표를 기계가 읽을 수 있게 바꾼 것이 지금 이 사이트의 전거 마스터입니다.</p>
<div class="metrics">
<div class="metric"><div class="v" id="authN">–</div><div class="k">전거 인물</div></div>
<div class="metric"><div class="v" id="posN">–</div><div class="k">재임 기록</div></div>
<div class="metric"><div class="v">제헌~21대</div><div class="k">수록 범위</div></div>
</div></div>`
  },
  {
    n: 9, tag: '시소러스', kicker: 'W3C SKOS · 전거 ≠ 분류 ≠ 시소러스',
    body: `
<div class="defbox"><b>시소러스(Thesaurus)</b>는 개념을 <b>용어</b>로 나타내고, 동의어들 가운데 하나를
<b>우선어</b>로 정하며, 개념 사이의 <b>상위·하위·관련</b> 관계를 드러내도록 짜인 <b>통제어휘</b>다.
<span class="src">ISO 25964-1:2011, <i>Thesauri and interoperability with other vocabularies</i> — 용어와 정의</span></div>
<p>그 시소러스를 <b>기계가 읽도록</b> RDF로 옮겨 적는 표준이 SKOS입니다.</p>
<div class="defbox"><b>SKOS</b>는 시소러스·분류체계·주제명표목 같은 <b>지식조직체계(KOS)</b>를 표현하기 위한 표준이며,
그 최소 단위는 <code>skos:Concept</code>이다.
<span class="src">W3C, <i>SKOS Reference</i>, §2</span></div>
<p>현장에서 가장 자주 뒤섞이는 셋입니다. 결정적 차이는 <b>"그것이 실재하는 것인가, 개념인가"</b>입니다.</p>
<p class="note">8장에서 전거의 대상이 생산자만은 아니라고 했습니다. 여기서 가르는 것은 <b>대상의 종류가 아니라 성격</b>입니다 —
실재하는 것(사람·단체·직위·장소·사건)은 RiC-O 의 개체로, 개념은 SKOS 로 갑니다.
아래 표의 ‘전거’ 칸은 그중 이 실습이 다루는 <b>행위자 전거</b>를 기준으로 적었습니다.</p>
<div class="scroll"><table>
<tr><th></th><th>전거레코드(행위자)</th><th>분류체계</th><th>시소러스</th></tr>
<tr><td><b>대상</b></td><td>실재하는 행위자<br>(사람·단체·직위)</td><td>기록을 나누는 칸</td><td>주제를 가리키는 말</td></tr>
<tr><td><b>표준</b></td><td>ISAAR(CPF) / RiC-O</td><td>기관 분류표</td><td>SKOS</td></tr>
<tr><td><b>클래스</b></td><td>${clsPill('Agent')}</td><td>(기관 고유)</td><td><span class="pill c-Date">skos:Concept</span></td></tr>
<tr><td><b>예</b></td><td>정세균 (1950~ )</td><td>총무-인사-01</td><td>"의회정치"</td></tr>
<tr><td><b>물으면</b></td><td>이 사람 누구인가</td><td>이 기록 어디 넣나</td><td>이 주제 뭐라 부르나</td></tr>
</table></div>
<p><b>구별 시험</b> — "그것이 태어나고 죽는가?" 태어나고 죽으면 전거(행위자)입니다.
"의회정치"는 태어나지 않습니다. 개념이고, SKOS의 몫입니다.</p>

<h3>SKOS를 조금 더 — 시소러스를 데이터로</h3>
<p>SKOS는 <b>새로 배우는 체계가 아닙니다.</b> 이미 쓰고 계신 시소러스 용어에 기계가 읽을 이름을 붙여 준 것뿐입니다.</p>
<div class="scroll"><table>
<tr><th>시소러스에서 쓰던 말</th><th>SKOS</th><th></th></tr>
<tr><td>디스크립터 · 우선어</td><td><code>skos:prefLabel</code></td><td>개념 하나에 언어당 <b>하나만</b></td></tr>
<tr><td>비우선어 · UF(use for)</td><td><code>skos:altLabel</code></td><td>여러 개 가능. 검색은 여기로도 걸린다</td></tr>
<tr><td>BT(상위어)</td><td><code>skos:broader</code></td><td rowspan="2">서로 역방향</td></tr>
<tr><td>NT(하위어)</td><td><code>skos:narrower</code></td></tr>
<tr><td>RT(관련어)</td><td><code>skos:related</code></td><td>대칭 관계</td></tr>
<tr><td>범위주기(SN) · 정의</td><td><code>skos:scopeNote</code> · <code>skos:definition</code></td><td></td></tr>
<tr><td>시소러스 그 자체</td><td><code>skos:ConceptScheme</code></td><td><code>inScheme</code> · <code>topConceptOf</code>로 소속을 밝힌다</td></tr>
<tr><td>다른 기관 시소러스와 맞추기</td><td><code>skos:exactMatch</code> · <code>closeMatch</code></td><td>기관을 넘어 주제어를 잇는 자리</td></tr>
</table></div>

<div class="result warn" style="margin:1rem 0"><b>가장 흔한 오해 — <code>skos:broader</code>는 <code>rdfs:subClassOf</code>가 아닙니다.</b>
<p style="margin:.5rem 0 0;color:var(--fg)"><code>rdfs:subClassOf</code>는 <b>논리적 주장</b>입니다.
“Person인 것은 모두 Agent이다” — 추론기가 인스턴스를 위로 올립니다.
<code>skos:broader</code>는 <b>주제어 사이의 느슨한 계층</b>일 뿐이라 인스턴스에 대해 아무 것도 주장하지 않습니다.
“의회정치 <code>broader</code> 정치”라고 적어도, <b>의회정치로 주제를 단 기록이 정치로 자동 검색되지는 않습니다.</b>
SKOS가 일부러 약하게 둔 것입니다 — 시소러스는 논리적 분류가 아니니까요.
분류표를 <code>skos:broader</code>로 옮겨 놓고 추론을 기대하는 것이 현장에서 가장 잦은 실수입니다.</p></div>

<h3>RiC-O와 SKOS는 어떻게 물리나</h3>
<p><b>① 주제어를 달 때.</b> <code>rico:hasOrHadSubject</code>의 레인지가 ${clsPill('Thing')}이라 목적어에 개념을 놓을 수 있습니다.
RiC-O가 준비한 정공법은 <code>rico:Concept</code>(“관념·사고 단위·추상적 문화 객체 또는 범주”, ${clsPill('Thing')}의 하위)이고,
외부 시소러스를 그대로 쓰려면 그 개념에 <b>두 어휘를 함께 붙입니다.</b></p>
<p><b>② RiC-O 자신이 SKOS를 씁니다.</b> 이게 결정적입니다. <code>RiC-O_1-1.rdf</code> 안에는
<code>skos:Concept</code>·<code>ConceptScheme</code>·<code>broader</code>·<code>narrower</code>·<code>inScheme</code>·
<code>topConceptOf</code>·<code>definition</code>·<code>scopeNote</code> 등 <b>SKOS 용어 13개가 선언</b>되어 있고,
RiC-O는 자기 통제어휘를 <b>SKOS 개념으로 배포합니다.</b></p>
<div class="scroll"><table>
<tr><th>어휘</th><th>담긴 개념</th><th>붙이는 속성</th></tr>
<tr><td><code>ric-rst:</code> 기록집합 유형</td><td>Fonds · Series · File · Collection</td>
    <td><code>rico:hasRecordSetType</code><br><span class="vdef">RecordSet → RecordSetType</span></td></tr>
<tr><td><code>ric-dft:</code> 문서형식 유형</td><td>FindingAid · <b>AuthorityRecord</b> · IIIFManifest</td>
    <td><code>rico:hasDocumentaryFormType</code><br><span class="vdef">Record · RecordPart → DocumentaryFormType</span></td></tr>
</table></div>
<p>이 7개는 <code>skos:Concept</code>이면서 <b>동시에</b> <code>rico:RecordSetType</code> 또는
<code>rico:DocumentaryFormType</code>입니다. 한 개체에 두 어휘의 타입을 함께 붙이는 것이 <b>둘을 잇는 표준적인 방법</b>입니다.</p>
<div class="ex"><div class="lbl">두 어휘를 함께 쓰기</div>
<pre>@prefix rico:    &lt;https://www.ica.org/standards/RiC/ontology#&gt; .
@prefix ric-rst: &lt;https://www.ica.org/standards/RiC/vocabularies/recordSetTypes#&gt; .
@prefix skos:    &lt;http://www.w3.org/2004/02/skos/core#&gt; .
@prefix ric:     &lt;http://archives.nanet.go.kr/id/&gt; .
@prefix nak:     &lt;http://archives.nanet.go.kr/thesaurus/&gt; .

ric:recordset-jsk
    a                      rico:RecordSet ;
    rico:hasRecordSetType  ric-rst:Fonds ;             # 퐁이 '계층'이 아니라 '유형'
    rico:hasOrHadSubject   nak:parliamentary-politics .

nak:parliamentary-politics
    a               skos:Concept, rico:Concept ;       # 두 어휘를 함께 붙인다
    skos:prefLabel  "의회정치"@ko ;
    skos:altLabel   "국회정치"@ko ;
    skos:broader    nak:politics ;
    skos:inScheme   nak:scheme .</pre></div>
<p><b>세 번째 줄을 다시 보세요.</b> ISAD(G)에서 <i>퐁</i>은 계층의 맨 윗단, 곧 <b>구조</b>였습니다.
RiC에서는 <code>ric-rst:Fonds</code>라는 <b>주제어 하나</b>, 곧 이 기록집합에 붙는 <b>꼬리표</b>입니다.
계층 자체는 <code>isOrWasIncludedIn</code>이 따로 맡습니다 — 10장에서 본 “계층을 그물로”가
어휘 차원에서는 이렇게 나타납니다.</p>
<p class="note">함정 하나 — <b><code>rico:Concept</code>과 <code>skos:Concept</code>은 다른 클래스입니다.</b>
RiC-O는 자기 <code>Concept</code>을 따로 두었고(${clsPill('Thing')}의 하위), <code>skos:Concept</code>과 같다고 선언하지 않았습니다.
RiC-O의 <code>Type</code> 계열 20종(RecordSetType·DocumentaryFormType·OccupationType…)이 이 <code>rico:Concept</code> 아래에 있습니다.
이름이 같아서 헷갈리니, 접두사를 반드시 붙여 읽으세요.</p>

<h3>그런데 — 이걸 왜 <b>지침</b>으로 만들어야 하나</h3>
<p>여기까지는 <b>무엇이 무엇인지</b>를 갈랐습니다. 현장에서 다음에 오는 질문은 다릅니다.
「그래서 전거·시소러스 관리 지침을 꼭 만들어야 하나. 없으면 무엇이 깨지나.」
개념 설명으로는 답이 안 되므로, <b>안 만들었을 때 실제로 일어나는 일</b> 셋으로 답합니다.</p>

<h3>하나 — 둘은 <b>다른 문제</b>를 푼다. 하나만 있으면 반쪽이다</h3>
<div class="scroll"><table>
<tr><th></th><th>전거레코드</th><th>시소러스</th></tr>
<tr><th>하는 일</th><td>흩어진 <b>같은 것을 하나로</b> 모은다</td><td>서로 <b>다른 것을 한 주제로</b> 묶는다</td></tr>
<tr><th>예</th><td>「정세균」·「丁世均」·「정세균(1950~ )」이 한 사람임을 확정</td>
  <td>한보사태·노사정위원회·청소노동자 정규직 전환을 「노동정책」 아래로</td></tr>
<tr><th>묻는 것</th><td>이 사람 누구인가</td><td>이건 무엇에 관한 것인가</td></tr>
</table></div>
<p><b>스타터킷 그래프에서 실제로 재 본 것입니다.</b>
주제 트리플의 목적어가 <b>전부 실재하는 개체</b>였습니다 — 사건 22·인물 13·단체 7·장소 6·규범 2·직위 1·활동 1, <b>개념은 0</b>.
그래서 「노동에 관한 구술을 찾아라」에 답할 수 없었습니다. 한보사태도 노사정위원회도 각각 들어 있는데
<b>그것들을 한 주제로 묶어 주는 것이 없었기</b> 때문입니다. 개념 층을 얹자 이렇게 바뀝니다.</p>
<div class="ex"><div class="lbl">같은 질문, 두 번</div>
<pre># ① 시소러스가 없을 때 — 찾을 것을 사람이 미리 다 알아야 한다
SELECT ?자료 WHERE {
  VALUES ?s { ric:org-nosajeong ric:event-hanbo
              ric:event-cleaner  ric:act-labor-reform }
  ?x rico:hasOrHadSubject ?s .
}                                      # → 3건. 빠뜨린 것은 영영 안 걸린다.

# ② 시소러스가 있을 때 — 상위 개념 하나로 아래를 전부 끌어온다
SELECT ?자료 ?주제 WHERE {
  ?c skos:broader* ric:concept-nodong ; skos:prefLabel ?주제 .
  ?x rico:hasOrHadSubject ?c .
}                                      # → 6건. 새 개념이 아래에 들어가면 질의를 안 고쳐도 늘어난다.</pre></div>
<p class="note"><b>별표(<code>*</code>)를 눈여겨보세요.</b> 위에서 봤듯이 <code>skos:broader</code>는 추론이 일어나지 않습니다.
그래서 계층을 <b>질의가 직접 타고 내려가야</b> 합니다. 이 별표 하나가 시소러스를 관리하는 값어치입니다 —
관리한다는 것은 곧 <b>이 계층을 관리한다</b>는 뜻입니다.</p>

<h3>둘 — 경계는 사람마다 다르게 판단된다. 지침이 그걸 정한다</h3>
<p>앞의 「태어나고 죽는가」 시험은 대부분을 가릅니다. 그런데 <b>안 갈리는 것이 남습니다.</b></p>
<div class="scroll"><table>
<tr><th>이것은</th><th>전거인가</th><th>개념인가</th></tr>
<tr><th>「국회의장」</th><td>RiC-O는 <code>rico:Position</code>을 <b>독립 클래스</b>로 두었다 — 설치되고 폐지된다</td>
  <td>ISAAR(CPF)는 <b>행위자만</b> 다룬다. 직위는 전거가 아니다</td></tr>
<tr><th>「한보사태」</th><td>일어난 <b>사건</b>이다</td><td>구술이 다루는 <b>주제</b>이기도 하다</td></tr>
<tr><th>「유신헌법」</th><td>제정·시행된 <b>규범</b>이다</td><td>「권위주의 체제」라는 주제로도 걸린다</td></tr>
</table></div>
<p>어느 쪽도 틀리지 않습니다. <b>그래서 기관이 정해야 합니다.</b>
스타터킷 그래프에서 직위는 <b>143건</b>입니다. 정하지 않으면 담당자마다 다르게 넣고,
3년 뒤 「국회의장」이 전거파일에도 있고 시소러스에도 있게 됩니다.
관리 시스템에 <b>중복 스캔·병합</b> 기능이 있는 이유가 그것입니다 — 지침이 없으면 사후 수습만 반복합니다.</p>
<p class="note">두 번째·세 번째 줄의 답은 「둘 다」입니다. 사건은 사건대로 두고 그 위에 주제를 <b>한 겹 얹습니다</b>.
개념이 실재하는 것을 <b>대체하지 않는다</b>는 것이 이 층의 핵심입니다.</p>

<h3>셋 — AI에게 시키려면 규칙이 <b>실행 가능한 형태</b>여야 한다</h3>
<p>추출 실습에서 직접 겪습니다. LLM에게 「개체를 뽑아라」라고만 하면 실재와 개념을 섞습니다.
지침의 판단 기준이 그대로 <b>추출 프롬프트의 제약</b>이 되고 <b>검수 화면의 판정 기준</b>이 됩니다.
<b>지침이 없으면 AI에게 줄 기준도 없습니다.</b></p>
<p>거꾸로 말하면 지침은 캐비닛에 들어가는 종이가 아니라 <b>시스템 설정에 그대로 들어가는 값</b>입니다 —
개념체계 목록, 우선어 선정 규칙, 신규어 승인 권한. 이 셋은 화면에 입력란이 있는 항목입니다.</p>

<h3>지침에 무엇을 담나</h3>
<p>「필요한 건 알겠는데 무엇을 써야 할지 모르겠다」가 나머지 절반입니다. 뼈대는 이렇습니다 —
굵은 항목이 시스템 화면·설정과 직접 이어지는 자리입니다.</p>
<div class="scroll"><table>
<tr><th>1 총칙</th><td>목적·적용 범위 · 용어 정의(전거형·이형·우선어·비우선어·개념체계) ·
  준거 표준(ISAAR(CPF) · RiC-O · SKOS · KS X ISO 25964)</td></tr>
<tr><th>2 전거레코드</th><td><b>대상 — 무엇을 전거로 만드는가</b>(직위의 처리를 여기서 확정) ·
  전거형 표기 규칙(한글·한자·로마자, 동명이인 한정어) · 필수·선택 요소 ·
  <b>외부 전거 연결 기준</b>(VIAF·위키데이터, <code>owl:sameAs</code>를 언제 쓰는가) ·
  <b>식별자 부여·병합·폐기</b>(병합 시 구 PID는 301 승계)</td></tr>
<tr><th>3 시소러스</th><td><b>개념체계 목록과 각 체계의 범위</b> · 우선어 선정 기준(문헌적 근거·이용자 언어) ·
  계층(BT/NT) 설정 규칙 · 관련어(RT)·범위주기(SN) ·
  <b>신규어 제안·심의·승인 절차</b> · 폐기어 처리(지우지 않고 대체어로 유도) ·
  <b>타 기관 시소러스 매핑</b>(exactMatch·closeMatch)</td></tr>
<tr><th>4 운영</th><td><b>소관과 권한</b> · 정기 검토 주기 · 변경 이력 ·
  <b>시스템 반영 절차</b>(지침 → 기술규칙 → 추출 프롬프트)</td></tr>
<tr><th>부록</th><td><b>판단 사례집</b> — 전거인가 개념인가. 위 표의 세 줄이 첫 항목입니다</td></tr>
</table></div>
<p class="note">이 목차는 <b>초안</b>입니다. 채우는 것은 기관의 몫이고, 채울 때 필요한 판단은
추출 실습에서 손으로 겪습니다 — 추출 화면에서 「이건 개체인가 개념인가」를 직접 고르게 되기 때문입니다.
자료실에서 <b>전거·시소러스 관리 지침 목차 초안</b>을 내려받을 수 있습니다.</p>`
  },
  {
    n: 10, tag: 'RiC-CM — 기록을 보는 개념모델', kicker: 'ICA EGAD',
    body: `
<div class="defbox"><b>RiC-CM</b>(Records in Contexts – Conceptual Model)은 기록과 그 맥락을 기술하기 위한
<b>개념모델</b>이다. 기록·행위자·활동·사건·장소·날짜 등 <b>엔티티</b>와 그 사이 <b>관계</b>,
그리고 각 엔티티가 갖는 <b>속성</b>을 논리적으로 정의한다. 특정 기술규칙이나 소프트웨어에 매이지 않는다.
<span class="src">ICA EGAD, <i>Records in Contexts — A Conceptual Model for Archival Description</i>, Consultation Draft v1.0, 2023-11-30</span></div>
<p>RiC은 기존 네 표준(ISAD(G)·ISAAR(CPF)·ISDF·ISDIAH)을 <b>대체하려고</b> 만들어졌습니다.
네 표준은 각각 기록·행위자·기능·소장기관을 따로 기술했고, 그 사이를 잇는 일은 사람의 몫이었습니다.
RiC은 그 넷을 <b>하나의 모델 안에서 서로 이어진 엔티티</b>로 다시 놓습니다.</p>

<h3>무엇이 근본적으로 달라지는가 — 계층에서 그물로</h3>
<p>ISAD(G)는 하나의 기록을 <b>하나의 계층</b>에 넣었습니다. 퐁-시리즈-철-건. 계층 구조입니다.
그런데 실제 기록은 여러 맥락에 동시에 속합니다. 정세균 구술은 <i>국회의장단 구술총서</i>이자
<i>정세균 개인기록</i>이자 <i>2018년 채록 사업</i>의 산출물입니다. 계층으로는 한 자리밖에 못 줍니다.</p>
<p><b>RiC은 계층을 그물로 바꿉니다.</b> 계층은 여러 관계 중 하나(<code>isOrWasIncludedIn</code>)로 격하되고, 나머지 맥락도 동등하게 표현됩니다.</p>
${netSVG()}
<p>왼쪽에서 잃어버린 것들이 오른쪽에서는 <b>전부 선</b>입니다. 선은 <b>반대편에서 들어와도 만납니다</b> —
한보사태 쪽에서 출발해도, 국회기록보존소 쪽에서 출발해도 이 구술에 닿습니다.</p>

<h3>RiC-CM 1.0 전경도</h3>
<figure>
  <img src="assets/ric-cm-overview.jpg" alt="RiC-CM v1.0 전경도 — Record Resource, Agent, Event/Activity, Rule/Mandate, Date, Place 엔티티와 그 사이 관계" loading="lazy">
  <figcaption><b>RiC-CM v1.0: a global overview</b> · Created by ICA-EGAD, September 2023 ·
  <a href="https://www.ica.org/app/uploads/2025/02/diagram_RiC-CM-overview-RiC-v1-0.jpg" target="_blank" rel="noopener">원본</a> ·
  CC BY 4.0. 왼쪽 파란 덩어리가 <b>기록</b>, 오른쪽 보라 덩어리가 <b>행위자</b>,
  가운데 노랑이 <b>사건·활동</b>, 아래 초록이 <b>규칙·위임</b>입니다.
  덩어리 안에 상자가 겹쳐 있는 것은 상위/하위 관계입니다 — Agent 안에 Person·Group이 들어 있듯이.</figcaption>
</figure>
<p>전경도의 <code>RiC-E00</code>은 <b>엔티티 번호</b>, <code>RiC-R000</code>은 <b>관계 번호</b>입니다.
뒤에 <code>i</code>가 붙은 것(<code>RiC-R026i</code>)은 <b>역방향 관계</b>입니다 — 7장에서 본 <code>owl:inverseOf</code>가 여기서 옵니다.</p>

<details class="disc"><summary>RiC-CM 엔티티 전체 펼쳐보기<span class="c">19개</span></summary>
<div class="discbody">
<p style="font-size:.85rem;color:var(--muted);margin:.2rem 0 .6rem">
아래 목록은 이 사이트가 담고 있는 <code>RiC-O_1-1.rdf</code> 원본에서
각 클래스에 달린 RiC-CM 엔티티 주석을 그대로 읽어 만든 것입니다.
번호가 <b>E19~E21에서 비어 있는데</b>, 초안(v0.2)의 날짜 엔티티 3종이 v1.0에서
<code>Date</code> 하나로 합쳐졌기 때문입니다. 번호는 그대로 두고 항목만 줄인 것입니다 —
<b>표준도 판을 거치며 줄어듭니다.</b></p>
${cmTable()}
</div></details>
<p class="note">RiC-CM은 <b>사람이 읽는 문서</b>입니다. 여기에는 파일도 네임스페이스도 없습니다.
이걸 기계가 읽을 수 있게 OWL로 옮긴 것이 다음 장의 <b>RiC-O</b>입니다.</p>`
  },
  {
    n: 11, tag: 'RiC-O — 개념모델을 기계가 읽게', kicker: 'ICA EGAD · OWL 2',
    body: `
<div class="defbox"><b>RiC-O</b>(Records in Contexts – Ontology)는 RiC-CM을
<b>OWL 2 온톨로지</b>로 구현한 것이다. RiC-CM의 엔티티는 <code>owl:Class</code>가 되고,
관계는 <code>owl:ObjectProperty</code>, 속성은 <code>owl:DatatypeProperty</code>가 된다.
네임스페이스는 <code>https://www.ica.org/standards/RiC/ontology#</code>, 접두사는 <code>rico:</code>다.
<span class="src">ICA EGAD, <i>RiC-O 1.1</i>, 2025-05-22 · CC BY 4.0</span></div>
<div class="scroll"><table>
<tr><th></th><th>RiC-CM</th><th>RiC-O</th></tr>
<tr><td>성격</td><td>개념모델 (사람이 읽는 문서)</td><td>OWL 온톨로지 (기계가 읽는 파일)</td></tr>
<tr><td>내용</td><td>엔티티·관계·속성의 논리적 정의</td><td>네임스페이스·클래스·속성의 실제 구현</td></tr>
<tr><td>규모</td><td>엔티티 19종</td><td><b>클래스 107 · 속성 555</b><br>
  <span style="font-size:.8rem;color:var(--muted)">객체속성 480 · 데이터속성 75</span></td></tr>
<tr><td>쓰임</td><td>설계할 때 읽는다</td><td>Omeka·트리플스토어에 넣는다</td></tr>
<tr><td>형식</td><td>PDF 문서</td><td>RDF/XML · Turtle · JSON-LD</td></tr>
</table></div>
<p class="note">위 수치는 이 사이트가 담고 있는 <code>RiC-O_1-1.rdf</code>를 직접 파싱해 센 값이며,
ICA 공식 페이지의 발표 수치(클래스 107 · 객체속성 480 · 데이터속성 75)와 일치합니다.</p>

<h3>왜 엔티티 19개가 클래스 107개가 되는가</h3>
<p>개념모델은 <b>큰 덩어리</b>만 정의합니다. 온톨로지는 그걸 실제로 쓰려고 잘게 나눕니다.
가장 많이 늘어난 곳은 <b>관계 자체를 개체로 만든 클래스</b>들입니다 —
<code>rico:Relation</code>과 그 하위 48종, 합쳐서 <b>49개</b>. 클래스 107개 중 절반에 가깝습니다.</p>
<p>속성 555개 중 <b>480개가 객체속성</b>이라는 사실이 이 표준의 성격을 말해 줍니다.
RiC-O는 값을 적는 표준이 아니라 <b>잇는 표준</b>입니다.</p>

<h3>관계를 개체로 — n-ary 릴레이션 패턴</h3>
<p>8장에서 정세균과 국회를 직위를 거쳐 이었습니다. 그런데 거기서 답하지 않은 것이 하나 있습니다.
<b>“2016-06-09부터 2018-05-29까지”는 어디에 적는가?</b></p>
<p>트리플은 칸이 세 개뿐입니다. 주어·서술어·목적어를 다 쓰고 나면 <b>기간을 붙일 자리가 없습니다.</b></p>
${narySVG()}
<p>실무에서는 흔히 <b>직위 개체에</b> <code>beginningDate</code>·<code>endDate</code>를 답니다.
그런데 그것은 엄밀히 <i>직위의 존속기간</i>이지 <i>그 사람의 재임기간</i>이 아닙니다.
국회의장이라는 직위는 정세균 이전에도 이후에도 존재하니까요.
사람마다 재임기간이 다른데 직위는 하나라면, 그 값을 어디에도 정확히 놓을 수 없습니다.</p>
<p><b>그래서 관계를 개체로 만듭니다.</b> W3C가 정리해 둔
<i>Defining N-ary Relations on the Semantic Web</i>의 첫 번째 패턴 — <b>관계를 위한 클래스를 하나 두는 것</b> — 이고,
RiC-O는 이것을 표준의 뼈대로 삼았습니다. 원본 정의에 그 말이 그대로 적혀 있습니다:
<code>relationHasSource</code>는 “Connects an <b>n-ary Relation</b> to a Thing that is its source.”</p>

<div class="ex"><div class="lbl">같은 사실, 두 가지 적기</div>
<pre># Core — 한 줄. 기간을 붙일 자리가 없다
ric:agent-071  rico:occupiesOrOccupied  ric:position-na-speaker-20-1 .

# n-ary — 관계가 개체가 되고, 거기에 다 붙는다
ric:rel-jsk-speaker-20-1
    a  rico:PositionHoldingRelation ;
    rico:relationHasSource  ric:agent-071 ;                 # 정세균 (Person 이 source)
    rico:relationHasTarget  ric:position-na-speaker-20-1 ;  # 국회의장 직위 (Position 이 target)
    rico:beginningDate      "2016-06-09" ;
    rico:endDate            "2018-05-29" ;
    rico:relationCertainty  "certain" ;
    rico:isEvidencedBy      ric:record-jsk-oral-1 .         # 이 사실의 근거 기록</pre></div>

<h3>관계 개체에 붙일 수 있는 것</h3>
<div class="scroll"><table>
<tr><th>속성</th><th>도메인 → 레인지</th><th>무엇을 담나</th></tr>
<tr><td><code>relationHasSource</code></td><td>Relation → Thing</td><td>방향 있는 관계의 출발점</td></tr>
<tr><td><code>relationHasTarget</code></td><td>Relation → Thing</td><td>방향 있는 관계의 도착점</td></tr>
<tr><td><code>relationConnects</code></td><td>Relation → Thing</td><td>방향이 없는 관계의 참여자</td></tr>
<tr><td><code>relationHasDate</code><br><code>beginningDate</code>·<code>endDate</code></td>
    <td>Relation → Date<br>Thing → Literal</td><td>이 관계가 성립한 시점·기간</td></tr>
<tr><td><code>relationCertainty</code></td><td>Relation → Literal</td>
    <td><b>확실성</b> — <code>certain</code> · <code>quite probable</code> · <code>uncertain</code> · <code>unknown</code></td></tr>
<tr><td><code>isEvidencedBy</code></td><td>Relation → RecordResource</td>
    <td><b>이 관계의 근거 기록.</b> “쪽수 없는 사실은 넣지 않는다”가 표준 어휘로 들어온 자리</td></tr>
<tr><td><code>relationHasContext</code></td><td>Relation → Thing</td><td>이 관계가 놓인 맥락</td></tr>
<tr><td><code>membershipWithPosition</code></td><td>MembershipRelation → Position</td>
    <td>3항으로 늘리는 슬롯 — “누가 · 어느 단체에 · <b>어떤 직위로</b>”</td></tr>
</table></div>
<p><b>방향은 클래스마다 못 박혀 있습니다.</b> <code>PositionHoldingRelation</code>은
“Person이 source, Position이 target”, <code>MembershipRelation</code>은 거꾸로
“Group이 source, Person이 target”입니다. 임의로 정하면 안 되고, 원본 정의를 확인하고 써야 합니다
— 위 <b>전체 어휘 펼쳐보기</b>에서 <code>Relation</code>으로 검색하면 49종이 모두 나옵니다.</p>

<h3>비슷해 보이지만 다른 셋</h3>
<div class="scroll"><table>
<tr><th></th><th>무엇인가</th><th>왜 RiC-O가 이걸 안 쓰나</th></tr>
<tr><td><b>RDF 리이피케이션</b><br><code>rdf:Statement</code></td>
  <td>“트리플에 대한 트리플”. 주어·서술어·목적어를 각각 속성으로 다시 적는다</td>
  <td>진술 자체를 <b>주장하지 않아</b> 추론이 걸리지 않고, 질의가 무겁습니다.
      n-ary는 관계를 <b>도메인의 실제 개체</b>로 세우는 것이라 추론·질의가 정상 작동합니다</td></tr>
<tr><td><b>RDF-star</b><br><code>&lt;&lt; s p o &gt;&gt;</code></td>
  <td>트리플에 바로 주석을 다는 더 최근의 문법</td>
  <td>훨씬 간결하지만 트리플스토어별 지원 편차가 있습니다.
      RiC-O는 <b>OWL 2 안에서 그대로 도는</b> n-ary를 택했습니다</td></tr>
<tr><td><b>직위를 거치는 3-홉</b><br>(8장)</td>
  <td>사람 → 직위 → 단체</td>
  <td>이건 <b>n-ary가 아닙니다.</b> <code>Position</code>은 관계를 개체로 바꾼 게 아니라
      <i>실재하는 것</i>(<code>Position</code>은 <code>Agent</code>의 하위 클래스)입니다. 모양만 비슷합니다</td></tr>
</table></div>
<p>RiC-O는 <b>둘 다</b> 줍니다 —
실체가 실재하면 <code>Position</code>을 쓰고, 관계에 시점·확실성·근거를 붙여야 하면
<code>PositionHoldingRelation</code>을 씁니다. 둘을 함께 쓰는 것도 정상입니다.</p>
<p class="note">구술 프로파일 Core 12·30에는 <code>Relation</code> 계열이 <b>하나도 없습니다.</b>
비전공자 30분 실습에서 관계를 개체로 세우는 데까지 가면 무너지기 때문입니다.
그러나 이것은 <b>Core가 표준을 줄인 대가</b>이고, 재임기간처럼 자주 필요한 것이라 실무에서는 곧 만나게 됩니다.
그때 Full에서 <code>rico:PositionHoldingRelation</code>을 꺼내 쓰면 됩니다 —
네임스페이스가 같으므로 <b>기존 데이터는 한 줄도 고칠 필요가 없습니다.</b></p>

<h3>그래서 부분집합을 씁니다</h3>
<p><b>555개 속성.</b> 이게 RiC-O를 처음 만나면 압도당하는 이유입니다.
그대로 Omeka S에 넣으면 리소스 템플릿 드롭다운에 555개가 뜹니다.
그래서 구술기록에 실제로 필요한 <b>12클래스 · 30속성</b>만 추린 부분집합을 씁니다.</p>
<p>네임스페이스와 로컬 네임(local name)은 <b>원본 그대로</b>입니다. 그래서 이 부분집합으로 만든 데이터는
<b>완전한 RiC-O 데이터로 유효합니다.</b> 나중에 Full로 넓혀도 기존 데이터는 한 줄도 고칠 필요가 없습니다.</p>
<div class="metrics">
  <div class="metric"><div class="v">12</div><div class="k">Core 클래스</div></div>
  <div class="metric"><div class="v">30</div><div class="k">Core 속성 (객체 20 · 데이터 10)</div></div>
  <div class="metric"><div class="v">72</div><div class="k">Core+Extended 용어</div></div>
</div>

<details class="disc" ontoggle="if(this.open)renderVocab('core')">
  <summary>구술 프로파일 펼쳐보기<span class="c">Core 12클래스·30속성 (+Extended 10·20)</span></summary>
  <div class="discbody" id="vocab-core">불러오는 중…</div></details>
<details class="disc" ontoggle="if(this.open)renderVocab('full')">
  <summary>RiC-O 1.1 전체 어휘 펼쳐보기<span class="c">107클래스 · 555속성</span></summary>
  <div class="discbody" id="vocab-full">불러오는 중…</div></details>

<h3>파일 내려받기</h3>
<p style="font-size:.89rem;color:var(--muted);margin:.2rem 0 .5rem">
같은 내용을 RDF/XML·Turtle·JSON-LD로 담았습니다. 어느 것을 받아도 트리플은 동일합니다 —
<b>직렬화 형식만 다릅니다.</b> Omeka S 어휘 가져오기에는 <code>.rdf</code>를,
텍스트 편집기로 읽을 때는 <code>.ttl</code>을, 자바스크립트에서 쓸 때는 <code>.jsonld</code>를 권합니다.</p>
<div class="dlgrid">
  <a class="dl" href="downloads/rico-oral-profile.rdf" download><b>rico-oral-profile.rdf</b><span>구술 프로파일 · RDF/XML · Omeka S 어휘 가져오기용</span></a>
  <a class="dl" href="downloads/rico-oral-profile.ttl" download><b>rico-oral-profile.ttl</b><span>구술 프로파일 · Turtle · 사람이 읽기 가장 쉬움</span></a>
  <a class="dl" href="downloads/rico-oral-profile.jsonld" download><b>rico-oral-profile.jsonld</b><span>구술 프로파일 · JSON-LD</span></a>
  <a class="dl" href="downloads/rico-core-12x30.csv" download><b>rico-core-12x30.csv</b><span>Core 12클래스·30속성 표 · 엑셀에서 열림</span></a>
  <a class="dl" href="downloads/omeka-templates.json" download><b>omeka-templates.json</b><span>Omeka S 리소스 템플릿 정의</span></a>
  <a class="dl" href="downloads/authority-thesaurus-policy-outline.md" download><b>authority-thesaurus-policy-outline.md</b><span>전거·시소러스 관리 지침 목차 초안 · 9장에서 다룬 것을 채워 넣을 뼈대</span></a>
  <a class="dl" href="downloads/RiC-O_1-1.rdf" download><b>RiC-O_1-1.rdf</b><span>ICA 원본 전체 · RDF/XML · 1.6 MB</span></a>
  <a class="dl" href="downloads/RiC-O_1-1.ttl" download><b>RiC-O_1-1.ttl</b><span>ICA 원본 전체 · Turtle · 0.9 MB</span></a>
  <a class="dl" href="vocab/rico-full.json" download><b>rico-full.json</b><span>위 표에 쓰인 어휘 목록 그대로 · 0.2 MB</span></a>
</div>
<p class="note">원본 RiC-O는 <a href="https://github.com/ICA-EGAD/RiC-O" target="_blank" rel="noopener">github.com/ICA-EGAD/RiC-O</a>에서
배포되며 <b>CC BY 4.0</b>입니다. 여기 실린 사본은 2025-05-22자 1.1 릴리스입니다.
프로파일 파일은 원본을 부분집합으로 추린 것으로, 같은 라이선스를 따릅니다.</p>`
  },
  {
    n: 12, tag: 'SPARQL', kicker: 'W3C SPARQL 1.1',
    body: `
<div class="defbox"><b>SPARQL</b>은 RDF 그래프에 대한 질의 언어다. 질의는 <b>그래프 패턴</b>으로 표현되며,
데이터에서 그 패턴에 맞는 부분을 찾아 변수에 바인딩한다.
<span class="src">W3C, <i>SPARQL 1.1 Query Language</i>, §2</span></div>
<p>SQL이 표를 다룬다면 SPARQL은 그래프를 다룹니다. 문법의 핵심은 하나 —
<b>찾고 싶은 모양을 트리플로 그리고, 모르는 자리에 <code>?변수</code>를 놓는다.</b></p>
<div class="ex"><div class="lbl">질문: 한보사태를 다룬 구술기록은?</div>
<pre>PREFIX rico: &lt;https://www.ica.org/standards/RiC/ontology#&gt;
PREFIX ric:  &lt;http://archives.nanet.go.kr/id/&gt;

SELECT ?record ?title WHERE {
  ?record  rico:hasOrHadSubject  ric:event-hanbo ;
           rico:title            ?title .
}</pre></div>
<div class="ex"><div class="lbl">질문: 역대 국회의장을 재임 순으로</div>
<pre>PREFIX rico: &lt;https://www.ica.org/standards/RiC/ontology#&gt;
PREFIX ric:  &lt;http://archives.nanet.go.kr/id/&gt;

SELECT ?name ?start WHERE {
  ?person  rico:occupiesOrOccupied  ?pos ;
           rico:name                ?name .
  ?pos     rico:existsOrExistedIn   ric:org-national-assembly ;
           rico:beginningDate       ?start .
}
ORDER BY ?start</pre>
<p style="margin:.4rem 0 0;font-size:.87rem">8장의 3-홉을 그대로 질의로 옮긴 것입니다. <b>설계가 곧 질의</b>입니다.</p></div>
<p class="note">3부에서는 브라우저 안에서 도는 진짜 SPARQL 엔진(Oxigraph WASM)으로 이 질의를 실행합니다.
그리고 자연어 질문을 SPARQL로 바꾸는 일은 LLM에게 시킵니다 — 우리는 <b>어떤 모양을 찾을지</b>만 알면 됩니다.</p>`
  },
];

let curCard = 0;
const seen = new Set([0]);

function renderCardNav() {
  $('#cardnav').innerHTML = CARDS.map((c, i) =>
    `<button class="chip ${cardQuizDone(i) ? 'quizdone' : seen.has(i) ? 'done' : ''}"
       aria-current="${i === curCard}"
       onclick="setCard(${i})"><span class="n">${c.n}</span>${esc(c.tag)}</button>`).join('');
}
function renderCard() {
  const c = CARDS[curCard];
  $('#cardhost').innerHTML =
    `<article class="card"><div class="kicker">${esc(c.kicker)}</div>
     <h2>${c.n}. ${esc(c.tag)}</h2>${c.body}</article>`
    + (QUIZZES[c.n] || []).map(quizHTML).join('');
  $('#prevC').disabled = curCard === 0;
  $('#nextC').textContent = curCard === CARDS.length - 1 ? '2부 워크벤치로 →' : '다음 →';
  if (CARDS[curCard].n === 8) {   // 8장: 전거 통계 주입
    $('#authN').textContent = D.authority.length + '명';
    $('#posN').textContent = D.authority.reduce((a, p) => a + p.positions.length, 0) + '건';
  }
  renderCardNav(); updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setCard(i) { curCard = i; seen.add(i); renderCard(); syncHash(); }
function goCard(d) {
  if (d > 0 && curCard === CARDS.length - 1) { showView(2); return; }
  setCard(Math.max(0, Math.min(CARDS.length - 1, curCard + d)));
}
/* 헤더 막대는 **지금 어디쯤인가**를 가리킨다.
   본 장의 누적(seen)으로 채우면 5장에서 1장으로 돌아와도 안 줄어들어,
   위치 표시처럼 생긴 것이 위치를 안 따라가는 꼴이 된다.
   '어디까지 봤나'는 아래 칩의 ✓ 가 이미 맡고 있으므로 여기서는 위치만 말한다. */
function updateProgress() {
  const bar = $('#progbar'), track = bar.parentElement;
  const view = [1, 2, 3].find(i => $('#view' + i).classList.contains('on')) || 1;
  let pct, label;
  if (view === 1) { pct = (curCard + 1) / CARDS.length * 100; label = `1부 ${curCard + 1} / ${CARDS.length}장`; }
  else if (view === 2) { pct = WB.step / STEP_NAMES.length * 100; label = `2부 ${WB.step} / ${STEP_NAMES.length}단계`; }
  else { track.style.visibility = 'hidden'; return; }   // 3부는 차례가 없다 — 탭을 오가며 본다
  track.style.visibility = 'visible';
  track.title = label;
  track.setAttribute('aria-label', label);
  bar.style.width = pct + '%';
}

/* ══════════ 11장 · 어휘 펼쳐보기 ══════════ */
let VOCAB = null, vocabWant = null;
const VSTATE = { core: { kind: 'classes', q: '', tier: 'core' }, full: { kind: 'classes', q: '' } };

async function renderVocab(which) {
  vocabWant = which;
  if (!VOCAB) {
    try {
      VOCAB = await (await fetch('vocab/rico-full.json')).json();
    } catch (e) {
      const h = $('#vocab-' + which);
      if (h) h.innerHTML = `<p class="result fail">어휘 목록을 불러오지 못했습니다 —
        <code>vocab/rico-full.json</code>. 이 사이트는 웹서버로 열어야 합니다
        (<code>python3 -m http.server 8765</code>). <code>file://</code>로는 동작하지 않습니다.</p>`;
      return;
    }
  }
  paintVocab(which);
}
function setVocab(which, k, v) { VSTATE[which][k] = v; paintVocab(which); }

function paintVocab(which) {
  const host = $('#vocab-' + which); if (!host || !VOCAB) return;
  const st = VSTATE[which];
  const pick = { classes: 'classes', obj: 'objectProps', dat: 'dataProps' }[st.kind];
  const core = which === 'core';
  // Core 패널은 Core 12·30 / Extended 10·20 을 갈라 본다. 전체 패널은 걸러내지 않는다.
  const keep = r => core ? (st.tier === 'all' ? !!r.tier : r.tier === st.tier) : true;
  let rows = VOCAB[pick].filter(keep);
  const n = k => VOCAB[{ classes: 'classes', obj: 'objectProps', dat: 'dataProps' }[k]]
    .filter(keep).length;
  const q = st.q.trim().toLowerCase();
  if (q) rows = rows.filter(r => (r.t + ' ' + r.en + ' ' + (r.ko || '') + ' ' +
    (r.koDef || '') + ' ' + r.def).toLowerCase().includes(q));

  const tab = (k, lbl) => `<button class="vtab" aria-pressed="${st.kind === k}"
    onclick="setVocab('${which}','kind','${k}')">${lbl} <b>${n(k)}</b></button>`;
  const tierTab = (t, lbl) => `<button class="vtab" aria-pressed="${st.tier === t}"
    onclick="setVocab('core','tier','${t}')">${lbl}</button>`;
  const dr = r => [...(r.d || []), '→', ...(r.r || [])].join(' ') === ' → ' ? '—'
    : `${(r.d || []).join(' · ') || '—'} → ${(r.r || []).join(' · ') || '—'}`;
  const tierMark = r => r.tier
    ? `<span class="tierdot ${r.tier}" title="${r.tier === 'core' ? 'Core' : 'Extended'}"></span>`
    : '';

  const head = st.kind === 'classes'
    ? '<tr><th>rico:</th><th>영문 레이블</th><th>' + (core ? '한글 · 뜻' : '정의') + '</th></tr>'
    : '<tr><th>rico:</th><th>영문 레이블</th><th>도메인 → 레인지</th><th>' + (core ? '한글 · 뜻' : '정의') + '</th></tr>';
  const body = rows.map(r => {
    const desc = core && r.koDef
      ? `<b>${esc(r.ko)}</b> <span class="vdef">${esc(r.koDef)}</span>`
      : `<span class="vdef">${esc(r.def || '')}</span>`;
    const inv = r.inv ? ` <span class="vdef">↔ ${esc(r.inv)}</span>` : '';
    return st.kind === 'classes'
      ? `<tr><td>${tierMark(r)}<code>${esc(r.t)}</code></td><td>${esc(r.en)}</td><td>${desc}</td></tr>`
      : `<tr><td>${tierMark(r)}<code>${esc(r.t)}</code>${inv}</td><td>${esc(r.en)}</td>
         <td class="vdef">${esc(dr(r))}</td><td>${desc}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="vdef">찾는 용어가 없습니다.</td></tr>';

  host.innerHTML = `
  ${core ? `<div class="vtabs">${tierTab('core', 'Core — 비전공자 기본값')}${tierTab('ext', 'Extended — 전공자용 추가분')}${tierTab('all', '둘 다')}</div>` : ''}
  <div class="vtabs">${tab('classes', '클래스')}${tab('obj', '객체속성')}${tab('dat', '데이터속성')}</div>
  <input class="vsearch" placeholder="용어·정의로 거르기 (예: position, 직위, creator)"
    value="${esc(st.q)}" oninput="setVocab('${which}','q',this.value)">
  <div class="vwrap"><table>${head}${body}</table></div>
  <p class="vdef" style="margin:.5rem 0 0">${rows.length}건 표시 ·
  ${core ? '<span class="tierdot core"></span>Core <span class="tierdot ext"></span>Extended · 정의와 도메인·레인지는 RiC-O 1.1 원본 값'
      : '<span class="tierdot core"></span>가 붙은 것이 구술 프로파일 Core, <span class="tierdot ext"></span>가 Extended입니다'} ·
  출처 ${esc(VOCAB.version)}</p>`;
}

/* ══════════ 장마다 붙는 드래그 연습 ══════════ */
const QUIZZES = {
  1: [{
    id: 'q1', title: '개체와 관계',
    prompt: '아래 조각을 개체와 관계로 나눠 담아 보세요.',
    zones: [{ z: 'ent', l: '개체' }, { z: 'rel', l: '관계' }],
    items: [{ i: 'a', l: '김대중' }, { i: 'b', l: '~를 맡았다' }, { i: 'c', l: '쌍용USA' },
    { i: 'd', l: '~의 생산자다' }, { i: 'e', l: '총학생회장' },
    { i: 'f', l: '권노갑' }, { i: 'g', l: '~ 안에 있다' }],
    key: { a: 'ent', b: 'rel', c: 'ent', d: 'rel', e: 'ent', f: 'ent', g: 'rel' },
    why: { e: '직위는 사람이 아니지만 <b>그 자체로 존재하는 것</b>입니다. 맡는 사람은 바뀌어도 자리는 남습니다.' },
    done: '이 두 가지가 온톨로지의 전부입니다 — <b>무엇이 있는가</b>(클래스)와 <b>어떻게 이어지는가</b>(속성).',
    learn: [
      { t: 'rico:Person · CorporateBody · Position', d: `개체는 클래스를 얻습니다. 김대중·권노갑은 <code>Person</code>, 쌍용USA는 <code>CorporateBody</code>, 총학생회장은 <code>Position</code>입니다.` },
      { t: 'rico:occupiesOrOccupied', d: `“~를 맡았다”. 도메인 <b>Person</b> → 레인지 <b>Position</b>. 사람이 맡는 것은 단체가 아니라 <u>직위</u>입니다.` },
      { t: 'rico:hasCreator', d: `“~의 생산자다”. 도메인 <b>Instantiation · RecordResource</b> → 레인지 <b>Agent</b>. 주어가 <u>기록</u>이라는 점이 중요합니다 — 사람이 주어가 되면 도메인 위반입니다.` },
      { t: 'rico:existsOrExistedIn', d: `“~ 안에 있다”. 도메인 <b>Position</b> → 레인지 <b>Group</b>. 총학생회장이라는 자리가 고대라는 단체 <u>안에</u> 존재합니다.` },
    ],
    learnNote: `관계에도 이름이 있고, 그 이름마다 <b>붙을 수 있는 자리가 정해져 있습니다.</b> 6장에서 이 규칙을 다룹니다.`,
  }],
  2: [{
    id: 'q2', title: '개체에 클래스 붙이기',
    prompt: '구술 원문에서 뽑은 개체들을 RiC-O 클래스별로 나눠 담으세요.',
    zones: [{ z: 'Person', l: 'rico:Person 인물' }, { z: 'CorporateBody', l: 'rico:CorporateBody 단체' },
    { z: 'Position', l: 'rico:Position 직위' }, { z: 'Event', l: 'rico:Event 사건' }],
    items: [{ i: 'c', l: '총학생회장' }, { i: 'e', l: '김대중' }, { i: 'f', l: '새정치국민회의' },
    { i: 'd', l: '한보사태' }, { i: 'a', l: '정세균' }, { i: 'g', l: '제20대 전반기 국회의장' },
    { i: 'h', l: '대통령 탄핵소추' }, { i: 'b', l: '고려대학교' }],
    key: {
      a: 'Person', b: 'CorporateBody', c: 'Position', d: 'Event', e: 'Person',
      f: 'CorporateBody', g: 'Position', h: 'Event'
    },
    why: {
      c: '‘총학생회장’은 사람이 아니라 <b>사람이 맡는 자리</b>입니다. 그래서 Position입니다.',
      g: '국회의장도 마찬가지입니다. 정세균은 Person, 국회의장은 Position — 둘은 다른 개체입니다.',
    },
    done: '글자가 클래스를 얻는 순간, 기계가 다룰 수 있는 <b>개체</b>가 됩니다.',
    learn: [
      { t: 'rico:Person', d: `개인 한 사람. <code>Agent</code>의 하위 클래스입니다.` },
      { t: 'rico:CorporateBody', d: `법적·사회적 실체로 인정받으며 하나의 행위자처럼 움직이는 조직. <code>Group</code>의 하위입니다.` },
      { t: 'rico:Position', d: `단체 안에서 인물이 맡는 <b>기능적 역할</b>. 역시 <code>Agent</code>의 하위 — RiC-O에서 <b>직위 그 자체가 행위자</b>입니다. 그래서 직위가 주어인 트리플을 쓸 수 있습니다.` },
      { t: 'rico:Event', d: `시간과 공간 안에서 일어난 일. <code>Thing</code>의 하위이고, <code>Activity</code>(목적을 갖고 수행하는 일)가 그 아래에 있습니다.` },
    ],
    learnNote: `‘총학생회장’과 ‘제20대 전반기 국회의장’이 사람이 아니라 <code>Position</code>인 것이 이 장의 고비입니다. 사람은 오고 가지만 <b>자리는 남습니다.</b>`,
  }],
  3: [{
    id: 'q3', title: '이 필드는 값인가, 연결인가', mode: 'pick',
    form: `아이템 편집 — 정세균 1차 구술 <span class="pill c-Record">rico:Record</span>`,
    prompt: '구술기록 「정세균 1차 구술」 아이템의 필드들입니다. 필드마다 리터럴(값)인지 개체(연결)인지 고르세요.',
    zones: [{ z: 'lit', l: '리터럴' }, { z: 'obj', l: '개체' }],
    items: [
      { i: 'a', f: '제목', p: 'rico:title', v: '정세균 1차 구술', l: '제목: 정세균 1차 구술' },
      { i: 'b', f: '생산자', p: 'rico:hasCreator', v: '국회기록보존소', l: '생산자: 국회기록보존소' },
      { i: 'c', f: '구술일', p: 'rico:beginningDate', v: '2018-08-14', l: '구술일: 2018-08-14' },
      { i: 'h', f: '생산 시기', p: 'rico:hasCreationDate', v: '2018년', l: '생산 시기: 2018년' },
      { i: 'j', f: '언어', p: 'rico:hasOrHadLanguage', v: '한국어', l: '언어: 한국어' },
      { i: 'd', f: '주제', p: 'rico:hasOrHadSubject', v: '한보사태', l: '주제: 한보사태' },
      { i: 'e', f: '면담자', p: 'rico:hasAuthor', v: '손동유', l: '면담자: 손동유' },
      { i: 'f', f: '식별기호', p: 'rico:identifier', v: 'rec-jsk-1', l: '식별기호: rec-jsk-1' },
      { i: 'g', f: '상위 기록집합', p: 'rico:isOrWasIncludedIn', v: '국회의장단 구술총서', l: '상위 기록집합: 국회의장단 구술총서' }],
    key: { a: 'lit', b: 'obj', c: 'lit', d: 'obj', e: 'obj', f: 'lit', g: 'obj', h: 'obj', j: 'obj' },
    why: {
      a: '제목은 그 기록을 <b>부르는 글자</b>입니다. 클릭해서 갈 데가 없습니다.',
      b: '글자 "국회기록보존소"를 채우면 <b>그 기관이 만든 다른 기록으로 건너뛸 수 없습니다.</b> 단체 아이템으로 잇습니다.',
      j: '“한국어”라는 글자를 적는 것이 아니라 <b><code>Language</code> 개체</b>에 잇습니다 — RiC-O 에는 언어를 값으로 적는 속성이 아예 없습니다. 그래야 한국어로 된 기록을 언어 쪽에서 모을 수 있습니다.',
      h: '날짜처럼 보여도 <b><code>hasCreationDate</code>의 레인지는 Date 클래스</b>입니다 — 날짜를 <b>개체</b>로 세워 잇고, 같은 시기의 기록들이 그 개체로 모입니다. 값으로 적는 <code>beginningDate</code>(구술일)와 견줘 보세요.',
    },
    hints: ['판단 기준 — “클릭해서 다른 데로 가고 싶은가?”'],
    done: '리터럴은 검색되고, 개체는 <b>건너갈 수 있습니다</b>. 이 차이가 지식그래프를 만듭니다.',
    learn: [
      { t: 'rico:title', d: `레인지 <b><span class='pill c-Date'>Literal</span></b>. 제목·이름 같은 표기는 개체에 붙는 <b>값</b>입니다 — 개체는 하나, 표기는 여럿일 수 있습니다.` },
      { t: 'rico:hasCreator', d: `도메인 <b>RecordResource</b> → 레인지 <b>Agent</b>. <code>Agent</code>에는 인물과 단체가 모두 들어가므로 기관도 생산자가 됩니다 — <b>개체</b>로 이어야 그 기관의 다른 기록으로 건너갑니다.` },
      { t: 'rico:hasOrHadSubject', d: `도메인 <b>RecordResource</b> → 레인지 <b>Thing</b>. 주제가 되는 사건·인물·장소도 개체로 잇습니다.` },
      { t: 'rico:isOrWasIncludedIn', d: `도메인 <b>Record</b> → 레인지 <b>RecordSet</b>. 총서·시리즈 같은 상위 기록집합도 개체입니다.` },
      { t: 'rico:hasOrHadLanguage', d: `도메인 <b>Agent · Record · RecordPart</b> → 레인지 <b>Language</b>. 언어도 <b>개체</b>입니다 — RiC-O 는 언어를 값으로 적는 데이터 속성을 두지 않았습니다.` },
      { t: 'rico:hasCreationDate', d: `도메인 <b>RecordResource</b> → 레인지 <b>Date</b>. RiC-O는 날짜를 값으로 적는 길(<code>beginningDate</code>)과 <b>개체로 세워 잇는 길</b>을 둘 다 줍니다 — 개체로 두면 같은 시기의 기록을 날짜 쪽에서 모을 수 있습니다.` },
    ],
    learnNote: `헷갈리면 RiC-O 원본의 레인지를 보세요. <code>Literal</code>이라 적혀 있으면 데이터 속성(datatype property), 클래스 이름이 적혀 있으면 객체 속성(object property)입니다.<br>
      <b>도메인은 주어 자리, 레인지는 목적어 자리</b>입니다 — <code>주어(도메인) · 속성 · 목적어(레인지)</code>. 6장에서 다룹니다.`,
  }],
  4: [{
    id: 'q4', mode: 'triple', title: '트리플 한 줄 만들기',
    prompt: '“정세균은 한보사태에 참여했다” — 이 사실을 트리플 세 칸에 옮기세요. 쓰지 않을 조각도 섞여 있습니다.',
    zones: [{ z: 's', l: '주어' }, { z: 'p', l: '서술어' }, { z: 'o', l: '목적어' }],
    rows: [['s', 'p', 'o']],
    items: [{ i: 'a', l: '정세균' }, { i: 'b', l: 'rico:isOrWasParticipantIn', m: 1 },
    { i: 'c', l: '한보사태' }, { i: 'd', l: 'rico:hasOrHadParticipant', m: 1 },
    { i: 'e', l: '국회의사당' }],
    key: { a: 's', b: 'p', c: 'o' },
    why: {
      d: '방향이 반대입니다. 이건 <b>사건이 주어일 때</b> 쓰는 역방향 속성입니다 — “한보사태 → 참여자 → 정세균”.',
      e: '이 문장에 없는 개체입니다. 원문에 없는 것은 넣지 않습니다.',
    },
    done: '점 두 개를 선 하나로 잇기. 트리플은 이게 전부이고, 이것을 쌓으면 그래프가 됩니다.',
    learn: [
      { t: 'rico:isOrWasParticipantIn', d: `도메인 <b>Thing</b> → 레인지 <b>Event</b>. <code>Person</code>은 <code>Thing</code>의 하위라 정세균이 주어가 되고, 한보사태(Event)가 목적어가 됩니다.` },
      { t: 'rico:hasOrHadParticipant', d: `위의 <b>역방향</b>(<code>owl:inverseOf</code>). 도메인 <b>Event</b> → 레인지 <b>Thing</b>. ‘한보사태 → 참여자 → 정세균’으로 읽습니다. <b>둘 중 하나만 입력하면 나머지는 따라옵니다.</b>` },
      { t: '주어–서술어–목적어', d: `세 칸의 순서가 곧 문장의 방향입니다. 같은 사실이라도 주어를 무엇으로 두느냐에 따라 쓸 수 있는 속성이 달라집니다.` },
    ],
    learnNote: `쓰지 않은 조각도 답의 일부입니다. 원문에 없는 개체는 <b>넣지 않는 것</b>이 정답입니다.`,
  }],
  5: [{
    id: 'q5', title: '식별자로 쓸 수 있는 것', mode: 'pick',
    prompt: `각 값이 무엇인지 고르세요. 개체를 가리키는 IRI 만 식별자로 쓸 수 있습니다.
      <span class="qnote">★ 은 그 IRI 가 통하는 범위입니다 — 우열이 아닙니다.</span>`,
    zones: [{ z: 'world', l: '★★ 국제 전거 IRI' }, { z: 'ours', l: '★ 우리 기관 IRI' },
      { z: 'page', l: '웹페이지일 뿐' }, { z: 'name', l: '이름일 뿐' }],
    items: [
      { i: 'a', v: 'ric:agent-071', m: 1, l: 'ric:agent-071' },
      { i: 'b', v: '정세균', l: '정세균' },
      { i: 'g', v: 'https://en.wikipedia.org/wiki/Chung_Sye-kyun',
        href: 'https://en.wikipedia.org/wiki/Chung_Sye-kyun', m: 1, l: '위키백과 주소' },
      { i: 'e', v: 'http://www.wikidata.org/entity/Q11270093',
        href: 'http://www.wikidata.org/entity/Q11270093', m: 1, l: '위키데이터 주소' },
      { i: 'c', v: 'ric:position-na-speaker-20-1', m: 1, l: 'ric:position-na-speaker-20-1' },
      { i: 'k', v: 'person-001', m: 1, l: 'person-001' },
      { i: 'lc', v: 'http://id.loc.gov/authorities/names/no2008151133',
        href: 'http://id.loc.gov/authorities/names/no2008151133', m: 1, l: 'LC 이름전거 주소' },
      { i: 'd', v: '국회의장', l: '국회의장' },
      { i: 'j', v: 'https://encykorea.aks.ac.kr/Article/E0006568',
        href: 'https://encykorea.aks.ac.kr/Article/E0006568', m: 1, l: '백과사전 주소' }],
    key: { a: 'ours', b: 'name', g: 'page', e: 'world', c: 'ours', k: 'name', lc: 'world', d: 'name', j: 'page' },
    why: {
      a: '<code>ric:</code> 가 <code>http://archives.nanet.go.kr/id/</code> 로 펼쳐집니다 — <b>우리 기관이 발급한</b> IRI 입니다.',
      c: '직위에도 IRI 를 발급합니다. 20대 전반기 국회의장이라는 <b>그 자리</b>를 가리키는, 우리 기관의 IRI 입니다.',
      k: '<b>네임스페이스가 없습니다.</b> 우리끼리 쓰는 이름표라, 다른 기관에도 <code>person-001</code> 이 있습니다. 앞에 <code>ric:</code> 를 붙여 <code>ric:person-001</code> 로 펼쳐야 세상에서 하나가 됩니다.',
      b: '이름은 <b>동명이인</b>을 구별하지 못하고, 같은 사람도 <b>표기가 여럿</b>이라 하나로 모이지 않습니다.',
      d: '직위의 <b>이름</b>입니다. 국회의장 자리는 대수마다 사람이 바뀌므로, 이름만으로는 어느 자리인지 가려지지 않습니다.',
      e: '위키데이터가 <b>정세균이라는 사람</b>에게 발급한 IRI 입니다. 우리 것이 아니라 <b>국제 전거</b>의 IRI 라, <code>owl:sameAs</code> 로 이어 씁니다.',
      lc: '미국 의회도서관 이름전거(LCNAF)가 발급한 IRI 입니다 — 「Chŏng, Se-gyun, 1950-」. 브라우저로 열면 끝에 <code>.html</code> 이 붙는데, <b>붙기 전 주소가 개체를, 붙은 주소가 문서를</b> 가리킵니다.',
      g: '위키백과 <b>문서</b>의 주소입니다. 같은 위키미디어라도 <code>wikidata.org/entity/Q11270093</code> 은 <b>사람</b>을, 이 주소는 <b>그 사람에 관한 글</b>을 가리킵니다.',
      j: '백과사전 <b>문서</b>의 주소입니다(이 항목은 「국회」입니다). 문서는 사람도 단체도 아닙니다.',
    },
    done: '이름은 여럿, 웹페이지는 더 여럿, 식별자는 하나. <b>전거레코드가 하는 일이 정확히 이것입니다.</b>',
    learn: [
      { t: '우리 기관 IRI — ric:agent-071', d: `이 기관이 발급한 식별자. 사람이 읽으라고 만든 이름이 아니라 <b>기계가 대조하는 열쇠</b>입니다. <code>ric:</code> 가 <code>http://archives.nanet.go.kr/id/</code> 로 펼쳐지기 때문에 세상에서 하나입니다 — 접두어 없는 <code>person-001</code> 과 갈리는 지점입니다. Turtle에서 로컬 네임에 <code>/</code>는 쓸 수 없어 하이픈을 씁니다.` },
      { t: '국제 전거 IRI — 위키데이터 · LCNAF', d: `같은 사람에게 남들도 IRI 를 발급해 두었습니다. 우리 IRI 를 버리고 남의 것을 쓰는 게 아니라, <code>owl:sameAs</code> 로 <b>이어 붙입니다</b>. 그러면 다른 기관의 데이터와 만났을 때 같은 사람임을 기계가 알아봅니다.` },
      { t: '웹페이지 주소는 왜 안 되나', d: `열리는 주소라고 다 식별자가 아닙니다. 위키백과·백과사전·기록원 화면은 <b>그 사람에 관한 문서</b>를 가리킵니다. 문서 주소는 참고 링크로 붙이고, 같음 선언(<code>owl:sameAs</code>)은 <b>개체끼리</b> 겁니다.` },
      { t: 'rico:name', d: `도메인 <b>Thing</b> → 레인지 <b>Literal</b>. 한 개체에 여러 개 달 수 있습니다. 이름은 개체를 <u>설명</u>할 뿐 <u>식별</u>하지는 못합니다.` },
    ],
    learnNote: `동명이인과 여러 표기 — 이 둘을 글자로는 못 가리고 식별자로는 가립니다. 전거레코드가 하는 일이 정확히 이것입니다.`,
  }],
  6: [{
    id: 'q6a', title: '통과인가 위반인가',
    prompt: 'LLM이 뽑아 온 트리플입니다. RiC-O의 도메인·레인지를 만족하는 것과 위반하는 것으로 나누세요.',
    zones: [{ z: 'ok', l: '통과' }, { z: 'no', l: '위반 — 거부된다' }],
    items: [
      { i: 'a', l: '정세균 — occupiesOrOccupied → 제20대 전반기 국회의장' },
      { i: 'b', l: '정세균 — occupiesOrOccupied → 대한민국 국회' },
      { i: 'c', l: '제20대 전반기 국회의장 — existsOrExistedIn → 대한민국 국회' },
      { i: 'd', l: '정세균 1차 구술 — hasCreator → 국회기록보존소' },
      { i: 'e', l: '국회기록보존소 — hasCreator → 정세균 1차 구술' },
      { i: 'f', l: '정세균 — isOrWasMemberOf → 새정치국민회의' }],
    key: { a: 'ok', b: 'no', c: 'ok', d: 'ok', e: 'no', f: 'ok' },
    why: {
      b: '레인지 위반. <code>occupiesOrOccupied</code>의 목적어는 <b>Position</b>이어야 합니다. 정세균이 맡은 것은 국회가 아니라 <i>국회의장이라는 직위</i>입니다.',
      e: '도메인 위반. <code>hasCreator</code>의 주어는 <b>기록</b>이어야 합니다. 주어와 목적어가 뒤집혔습니다.',
    },
    done: '사람이 읽으면 그럴듯한 문장도 온톨로지는 <b>거부합니다.</b> 이 거부가 곧 그라운딩입니다.',
    learn: [
      { t: 'rico:occupiesOrOccupied', d: `도메인 <b>Person</b> → 레인지 <b>Position</b> · 역방향 <code>isOrWasOccupiedBy</code>. 대한민국 국회는 <code>CorporateBody</code>이지 <code>Position</code>이 아니므로 목적어가 될 수 없습니다.` },
      { t: 'rico:existsOrExistedIn', d: `도메인 <b>Position</b> → 레인지 <b>Group</b> · 역방향 <code>hasOrHadPosition</code>. 직위가 어느 단체 안에 있는지를 잇습니다.` },
      { t: 'rico:hasCreator', d: `도메인 <b>Instantiation · RecordResource</b> → 레인지 <b>Agent</b> · 역방향 <code>isCreatorOf</code>. 주어는 기록입니다. 생산자를 주어로 두고 싶으면 <code>isCreatorOf</code>를 써야 합니다.` },
      { t: 'rico:isOrWasMemberOf', d: `도메인 <b>Person</b> → 레인지 <b>Group</b> · 역방향 <code>hasOrHadMember</code>.` },
    ],
    learnNote: `도메인·레인지 위반은 <b>틀린 사실</b>이 아니라 <b>틀린 자리</b>입니다. “정세균이 국회에 있었다”는 사람에게는 참이지만, 온톨로지에는 그 말을 담을 칸이 없습니다.`,
  }, {
    id: 'q6b', mode: 'triple', title: '자리가 정해져 있다',
    prompt: '서술어는 이미 놓여 있습니다. 도메인과 레인지가 허락하는 개체만 양쪽에 넣으세요.',
    zones: [{ z: 's', l: '주어 (도메인)' }, { z: 'o', l: '목적어 (레인지)' }],
    rows: [['s', { fx: 'rico:occupiesOrOccupied' }, 'o']],
    items: [{ i: 'a', l: '정세균' }, { i: 'b', l: '제20대 전반기 국회의장' },
    { i: 'c', l: '대한민국 국회' }, { i: 'd', l: '한보사태' }],
    key: { a: 's', b: 'o' },
    hints: ['도메인은 Person 하나, 레인지는 Position 하나입니다.'],
    done: '<code>occupiesOrOccupied</code>는 도메인 Person · 레인지 Position. 561개도 555개도 아니고, 이 자리에 올 수 있는 건 정해져 있습니다.',
    learn: [
      { t: 'rico:occupiesOrOccupied', d: `도메인 <b>Person</b> 하나, 레인지 <b>Position</b> 하나. 그래서 주어 자리에는 정세균만, 목적어 자리에는 제20대 전반기 국회의장만 들어갑니다.` },
      { t: '대한민국 국회 · 한보사태', d: `각각 <code>CorporateBody</code>와 <code>Event</code>라 이 속성의 레인지에 맞지 않습니다. 국회를 잇고 싶다면 <code>isOrWasMemberOf</code>, 한보사태라면 <code>isOrWasParticipantIn</code>입니다.` },
      { t: 'rdfs:domain · rdfs:range', d: `RDFS에서 이 둘은 원래 ‘금지’가 아니라 <b>추론 규칙</b>입니다. 위반해도 파일은 만들어지고, 대신 엉뚱한 추론이 생깁니다. 그래서 SHACL이나 2부 워크벤치 같은 <b>검증기</b>가 따로 필요합니다.` },
    ],
  }],
  7: [{
    id: 'q7', title: '어느 층의 진술인가',
    prompt: '같은 어휘를 쓰지만 하는 일이 다릅니다. 각 진술을 해당 층으로 옮기세요.',
    zones: [{ z: 'rdf', l: 'RDF — 사실' }, { z: 'rdfs', l: 'RDFS — 어휘·계층' }, { z: 'owl', l: 'OWL — 제약·추론' }],
    items: [
      { i: 'a', l: '정세균 occupiesOrOccupied 제20대 전반기 국회의장' },
      { i: 'b', l: 'Person rdfs:subClassOf Agent', m: 1 },
      { i: 'c', l: 'occupiesOrOccupied rdfs:domain Person', m: 1 },
      { i: 'd', l: 'occupiesOrOccupied owl:inverseOf isOrWasOccupiedBy', m: 1 },
      { i: 'e', l: '정세균 1차 구술 hasOrHadSubject 한보사태' }],
    key: { a: 'rdf', b: 'rdfs', c: 'rdfs', d: 'owl', e: 'rdf' },
    why: { d: '역방향 <b>선언</b>은 사실이 아니라 규칙입니다. 한쪽만 입력하면 반대 방향이 논리적으로 따라옵니다.' },
    done: '아래층은 사실, 가운데는 어휘, 위층은 규칙. 세 층이 같은 파일 안에 함께 있습니다.',
    learn: [
      { t: 'RDF — 사실', d: `트리플 한 줄이 사실 하나입니다. <code>정세균 occupiesOrOccupied 제20대 전반기 국회의장</code>.` },
      { t: 'rdfs:subClassOf', d: `클래스 사이의 계층. <code>Person rdfs:subClassOf Agent</code>라고 선언해 두면, Person인 것은 자동으로 Agent이기도 합니다.` },
      { t: 'rdfs:domain · rdfs:range', d: `속성이 붙을 수 있는 자리. 어휘를 정의하는 층이라 RDFS의 몫입니다.` },
      { t: 'owl:inverseOf', d: `반대 방향 선언. 사실이 아니라 <b>규칙</b>이라 OWL 층입니다. Omeka S의 <code>Linked Resources</code> 탭이 보여 주는 게 이 추론 결과입니다.` },
    ],
    learnNote: `세 층은 따로 있는 파일이 아닙니다. <b>같은 그래프 안에 함께 들어 있고</b>, 추론 엔진이 위층 규칙으로 아래층 사실을 불립니다.`,
  }],
  8: [{
    id: 'q8', mode: 'triple', title: '3-홉 잇기',
    prompt: '정세균과 국회를 <b>직위를 거쳐</b> 이으려 합니다. 두 칸에 들어갈 속성을 골라 넣으세요.',
    zones: [{ z: 'p1', l: '속성' }, { z: 'p2', l: '속성' }],
    rows: [[{ fx: '정세균' }, 'p1', { fx: '제20대 전반기 국회의장' }],
    [{ fx: '제20대 전반기 국회의장' }, 'p2', { fx: '대한민국 국회' }]],
    items: [{ i: 'a', l: 'rico:occupiesOrOccupied', m: 1 }, { i: 'b', l: 'rico:existsOrExistedIn', m: 1 },
    { i: 'c', l: 'rico:isOrWasMemberOf', m: 1 }, { i: 'd', l: 'rico:hasOrHadPosition', m: 1 }],
    key: { a: 'p1', b: 'p2' },
    why: {
      c: '사람과 단체를 <b>바로</b> 잇습니다. 그러면 “어떤 자격으로, 언제부터 언제까지”가 사라집니다.',
      d: '방향이 반대입니다 — 단체가 주어이고 직위가 목적어인 속성입니다.',
    },
    done: '직위를 거치기 때문에 <b>재임기간과 자격</b>이 데이터에 남고, 역대 의장단 계보가 저절로 만들어집니다.',
    learn: [
      { t: 'rico:occupiesOrOccupied', d: `도메인 <b>Person</b> → 레인지 <b>Position</b>. 정세균 → 국회의장 <b>직위</b>.` },
      { t: 'rico:existsOrExistedIn', d: `도메인 <b>Position</b> → 레인지 <b>Group</b>. 국회의장 직위 → 대한민국 국회. 직위가 주어가 될 수 있는 것은 <code>Position</code>이 <code>Agent</code>의 하위이기 때문입니다.` },
      { t: 'rico:isOrWasMemberOf', d: `도메인 <b>Person</b> → 레인지 <b>Group</b>. 규칙상으로는 통과하지만 정세균과 국회를 <u>바로</u> 이어 버려서 <b>‘어떤 자격으로, 언제부터 언제까지’가 사라집니다.</b>` },
      { t: 'rico:hasOrHadPosition', d: `도메인 <b>Group</b> → 레인지 <b>Position</b>. <code>existsOrExistedIn</code>의 역방향이라 방향이 반대입니다.` },
    ],
    learnNote: `직위를 한 칸 거치는 대가로 얻는 것 — <code>beginningDate 2016-06-09</code> · <code>endDate 2018-05-29</code>, 그리고 정세균 이전·이후 의장까지 이어지는 <b>계보</b>입니다.`,
  }],
  9: [{
    id: 'q9', title: '전거 · 분류 · 시소러스',
    prompt: '현장에서 가장 자주 뒤섞이는 셋입니다. 각각 제자리로 옮기세요.',
    zones: [{ z: 'auth', l: '행위자 전거 — rico:Agent' }, { z: 'cls', l: '분류체계' },
    { z: 'skos', l: '시소러스 — skos:Concept' }],
    items: [{ i: 'a', l: '정세균' }, { i: 'b', l: '의회정치' }, { i: 'c', l: '총무-인사-01' },
    { i: 'd', l: '대한민국 국회' }, { i: 'e', l: '민주화운동' },
    { i: 'f', l: '제20대 전반기 국회의장' }],
    key: { a: 'auth', b: 'skos', c: 'cls', d: 'auth', e: 'skos', f: 'auth' },
    why: { f: '직위도 <b>행위자</b>입니다. RiC-O에서 Position은 Agent의 하위 클래스입니다.' },
    hints: ['구별 시험 — “그것이 태어나고 죽는가?” 태어나고 죽으면 전거입니다.'],
    done: '행위자 전거는 <b>실재하는 행위자</b>, 시소러스는 <b>개념</b>, 분류는 <b>기록을 넣는 칸</b>입니다.',
    learn: [
      { t: 'rico:Agent', d: `<code>Person</code> · <code>Group</code> · <code>Position</code> · <code>Mechanism</code>의 상위 클래스. <b>행위자 전거의 뿌리</b>입니다.` },
      { t: 'rico:Position', d: `직위도 <code>Agent</code>의 하위라 전거의 대상입니다. ‘제20대 전반기 국회의장’은 분류항목이 아니라 <b>행위자</b>입니다.` },
      { t: 'skos:Concept', d: `시소러스·주제명표목의 최소 단위. ‘의회정치’·‘민주화운동’처럼 <b>태어나지도 죽지도 않는</b> 것들이 여기 옵니다.` },
      { t: 'rico:hasOrHadSubject', d: `도메인 <b>RecordResource</b> → 레인지 <b>Thing</b>. 레인지가 넓어서 <b>목적어로 <code>skos:Concept</code>도 올 수 있습니다</b> — RiC-O와 SKOS는 이렇게 같이 씁니다.` },
    ],
    learnNote: `구별 시험 하나 — <b>“그것이 태어나고 죽는가?”</b> 태어나고 죽으면 RiC-O 의 개체, 아니면 개념입니다. 분류체계는 셋 중 유일하게 <b>기록을 넣는 칸</b>이라 대상이 아예 다릅니다.<br>
      ‘민주화운동’이 개념 쪽에 온 것은 <b>일반 주제</b>여서입니다. <b>‘5·18민주화운동’처럼 특정된 사건</b>이라면 <code>skos:Concept</code>이 아니라 <code>rico:Event</code>로 갑니다 — 같은 말처럼 보여도 가리키는 것이 다릅니다.`,
  }],
  10: [{
    id: 'q10', title: '계층으로 되는 것, 그물이라야 되는 것',
    prompt: '같은 구술기록에 대한 진술들입니다. ISAD(G)의 계층 한 자리로 표현되는 것과, RiC의 그물이라야 표현되는 것으로 나누세요.',
    zones: [{ z: 'tree', l: '계층 한 자리로 된다' }, { z: 'net', l: '그물이라야 된다' }],
    items: [
      { i: 'a', l: '이 구술은 국회의장단 구술총서에 속한다' },
      { i: 'b', l: '이 구술은 정세균 개인기록이면서 동시에 2018 채록사업의 산출물이다' },
      { i: 'c', l: '이 철은 저 시리즈 아래에 있다' },
      { i: 'd', l: '면담자는 손동유, 주제는 한보사태, 구현체는 MP4다' },
      { i: 'e', l: '정세균은 2016-06-09부터 2018-05-29까지 국회의장을 맡았다' }],
    key: { a: 'tree', b: 'net', c: 'tree', d: 'net', e: 'net' },
    why: {
      b: '한 기록이 <b>세 맥락에 동시에</b> 속합니다. 계층은 한 자리밖에 주지 못합니다.',
      e: '기간이 붙은 관계입니다. 관계 자체에 속성을 달아야 하므로 계층으로는 표현할 수 없습니다.',
    },
    done: '계층은 사라지지 않습니다. <b>여러 관계 중 하나</b>(<code>isOrWasIncludedIn</code>)가 될 뿐입니다.',
    learn: [
      { t: 'rico:isOrWasIncludedIn', d: `도메인 <b>Record · RecordSet</b> → 레인지 <b>RecordSet</b>. ISAD(G)의 퐁-시리즈-철-건 <b>계층 전체가 이 속성 하나로 들어옵니다.</b> 사라진 게 아니라 격하된 것입니다.` },
      { t: 'rico:hasOrHadSubject', d: `도메인 <b>RecordResource</b> → 레인지 <b>Thing</b>. 주제를 개체로 잇습니다.` },
      { t: 'rico:hasCreator', d: `도메인 <b>Instantiation · RecordResource</b> → 레인지 <b>Agent</b>. 면담자·채록기관이 여기 붙습니다.` },
      { t: 'rico:hasOrHadInstantiation', d: `도메인 <b>RecordResource</b> → 레인지 <b>Instantiation</b>. 같은 기록의 MP4·PDF·인쇄본을 각각 개체로 답니다.` },
      { t: '기간이 붙은 관계', d: `‘2016-06-09부터 2018-05-29까지’처럼 <b>관계 자체에 속성을 달아야 하는 진술</b>은 계층으로는 아예 표현할 수 없습니다. RiC-O가 <code>Relation</code> 클래스를 40여 종이나 두는 이유입니다.` },
    ],
  }],
  11: [{
    id: 'q11a', title: 'Core에 있나, Full에만 있나',
    prompt: '아래 클래스 중 구술 프로파일 Core 12에 든 것은 무엇일까요? 위의 ‘부분집합 펼쳐보기’를 열어 확인해도 좋습니다.',
    zones: [{ z: 'core', l: 'Core 12클래스에 있다' }, { z: 'full', l: 'RiC-O에는 있지만 Core에는 없다' }],
    items: [{ i: 'a', l: 'rico:Person', m: 1 }, { i: 'b', l: 'rico:Family', m: 1 },
    { i: 'c', l: 'rico:Record', m: 1 }, { i: 'd', l: 'rico:Mechanism', m: 1 },
    { i: 'e', l: 'rico:Place', m: 1 }, { i: 'f', l: 'rico:Mandate', m: 1 },
    { i: 'g', l: 'rico:Instantiation', m: 1 }],
    key: { a: 'core', b: 'full', c: 'core', d: 'full', e: 'core', f: 'full', g: 'core' },
    why: {
      b: '가족 전거는 구술기록에서 거의 쓰지 않아 Extended로 미뤘습니다. <b>필요해지면 꺼내 쓰면 됩니다.</b>',
      d: '자동 생성 장치(CCTV·로그 시스템 등)를 위한 클래스입니다.',
    },
    done: 'Core에 없다고 표준에 없는 게 아닙니다. <b>축약은 표준의 변형이 아니라 부분집합입니다.</b>',
    learn: [
      { t: 'Core 12에 든 것', d: `<code>Person</code> · <code>Record</code> · <code>Place</code> · <code>Instantiation</code>. 구술기록을 기술하는 데 매번 쓰이는 것들만 남겼습니다.` },
      { t: 'rico:Family', d: `<code>Group</code>의 하위. 가문 전거를 위한 클래스입니다. 구술기록에서는 거의 쓰지 않아 Extended로 미뤘습니다.` },
      { t: 'rico:Mechanism', d: `<code>Agent</code>의 하위. 사람이 만들어 놓고 <b>스스로 기록을 생산하는 장치</b>(CCTV·로그 시스템 등)입니다. 행위자가 사람만은 아니라는 뜻입니다.` },
      { t: 'rico:Mandate', d: `<code>Rule</code>의 하위. 한 행위자가 다른 행위자에게 <b>활동 권한을 위임하는 근거</b>입니다.` },
    ],
    learnNote: `Core에 없다고 표준에 없는 게 아닙니다. 네임스페이스와 이름이 원본과 같으므로, 나중에 <code>rico:Family</code>가 필요해지면 <b>그냥 쓰면 됩니다</b> — 기존 데이터는 한 줄도 고칠 필요가 없습니다.`,
  }, {
    id: 'q11b', title: 'CM의 몫, O의 몫',
    prompt: '개념모델과 온톨로지 중 어느 쪽에 속하는 일인지 나누세요.',
    zones: [{ z: 'cm', l: 'RiC-CM — 개념모델' }, { z: 'o', l: 'RiC-O — 온톨로지' }],
    items: [{ i: 'a', l: '엔티티 번호 RiC-E07' }, { i: 'b', l: 'owl:Class 선언', m: 1 },
    { i: 'c', l: '설계할 때 읽는 PDF 문서' },
    { i: 'd', l: 'https://www.ica.org/standards/RiC/ontology#', m: 1 },
    { i: 'e', l: 'Omeka S에 가져오는 .rdf 파일' }],
    key: { a: 'cm', b: 'o', c: 'cm', d: 'o', e: 'o' },
    done: 'CM은 <b>설계도</b>, O는 그 설계도로 깎아 낸 <b>실제 부품</b>입니다.',
    learn: [
      { t: 'RiC-E07', d: `CM의 <b>엔티티 번호</b>. 개념모델에만 있습니다. RiC-O에는 번호가 없고 이름(<code>rico:Agent</code>)만 있습니다.` },
      { t: 'owl:Class', d: `CM의 엔티티가 O에서 갖는 형식. 관계는 <code>owl:ObjectProperty</code>, 속성은 <code>owl:DatatypeProperty</code>가 됩니다.` },
      { t: '네임스페이스', d: `<code>https://www.ica.org/standards/RiC/ontology#</code> — O에만 있습니다. CM은 PDF 문서라 네임스페이스가 없습니다.` },
      { t: '.rdf · .ttl · .jsonld', d: `모두 O의 직렬화 형식입니다. 어느 것을 받아도 <b>트리플은 똑같습니다</b>(구술 프로파일은 216개).` },
    ],
    learnNote: `CM은 <b>무엇을 기술할 것인가</b>를 정하고, O는 <b>그것을 어떤 이름으로 어떻게 적을 것인가</b>를 정합니다.`,
  }],
  12: [{
    id: 'q12', title: '어디에 ?변수를 놓는가',
    prompt: '질문 — “한보사태를 다룬 구술기록의 제목은 무엇인가?” 이 질문을 SPARQL로 옮길 때, 각 조각을 어디에 둘지 나누세요.',
    zones: [{ z: 'var', l: '?변수로 둔다 (모르는 것)' }, { z: 'fix', l: '고정값으로 둔다 (아는 것)' }],
    items: [{ i: 'a', l: '구술기록 자체' }, { i: 'b', l: '기록의 제목' },
    { i: 'c', l: '주제가 한보사태라는 조건' }, { i: 'd', l: 'rico:hasOrHadSubject', m: 1 },
    { i: 'e', l: 'rico:title', m: 1 }],
    key: { a: 'var', b: 'var', c: 'fix', d: 'fix', e: 'fix' },
    why: { c: '이게 <b>거르는 조건</b>입니다. 조건은 고정값으로 적어야 그 모양에 맞는 것만 걸립니다.' },
    done: 'SPARQL 문법의 핵심 하나 — <b>찾고 싶은 모양을 트리플로 그리고, 모르는 자리에 ?변수를 놓는다.</b>',
    learn: [
      { t: '?변수', d: `모르는 자리. <code>SELECT</code>에 적은 변수만 결과 표의 열이 됩니다. 찾고 싶은 것(기록 자체·제목)이 여기 옵니다.` },
      { t: '고정값', d: `아는 자리 = <b>거르는 조건</b>. <code>ric:event-hanbo</code>처럼 IRI를 박아 두면 그 모양에 맞는 것만 걸립니다.` },
      { t: 'rico:hasOrHadSubject', d: `도메인 <b>RecordResource</b> → 레인지 <b>Thing</b>. 조건을 거는 축이라 속성 자리는 늘 고정입니다.` },
      { t: 'rico:title', d: `도메인 <b>Instantiation · RecordResource · Rule</b> → 레인지 <b>Literal</b>. 데이터 속성이라 <code>?title</code>에는 개체가 아니라 <b>글자가 바인딩됩니다.</b>` },
    ],
    learnNote: `그래서 SPARQL을 배우는 일은 문법을 외우는 일이 아니라 <b>찾고 싶은 모양을 트리플로 그릴 줄 아는 일</b>입니다. 8장의 3-홉이 그대로 질의가 된 것을 떠올려 보세요.`,
  }],
};

const QBY = {};
Object.values(QUIZZES).flat().forEach(q => { QBY[q.id] = q; });
const QS = {};
const st_ = q => QS[q.id] || (QS[q.id] = { place: {}, checked: false, hint: 0 });
const qOK = (q, i) => (st_(q).place[i] || null) === (q.key[i] || null);
const qAllOK = q => q.items.every(it => qOK(q, it.i));

function quizHTML(q) {
  const st = st_(q);
  const chip = it => {
    const good = qOK(q, it.i);
    const mk = st.checked ? `<span class="mk">${good ? '✓' : '✗'}</span>` : '';
    return `<button class="qchip${st.checked ? (good ? ' ok' : ' no') : ''}"
      data-q="${q.id}" data-item="${it.i}">${mk}<span${it.m ? ' class="mono"' : ''}>${esc(it.l)}</span></button>`;
  };
  const inZone = z => q.items.filter(it => st.place[it.i] === z).map(chip).join('');
  const drop = (z, cls, inner) =>
    `<div class="${cls}" data-drop="${z.z}" data-q="${q.id}">${inner}</div>`;
  const zl = z => `<span class="zl">${esc(z.l)}</span>`;

  let board;
  if (q.mode === 'pick') {
    /* 본문의 아이템 편집 화면과 같은 모양으로 필드를 늘어놓고,
       행마다 리터럴/개체를 고르게 한다. 자료 모델은 드래그와 같다(place[item]=zone). */
    board = `<div class="omk">
      ${q.form ? `<div class="omk-h">${q.form}</div>` : ''}
      ${q.items.map(it => {
      const sel = st.place[it.i];
      const good = qOK(q, it.i);
      const mk = st.checked ? `<span class="mk">${good ? '✓' : '✗'}</span>` : '';
      return `<div class="omk-row${st.checked ? (good ? ' qok' : ' qno') : ''}">
        ${it.f ? `<div class="omk-lbl">${esc(it.f)} <code>${esc(it.p)}</code></div>` : ''}
        <div class="omk-val${it.m ? ' mono' : ''}">${it.href
          ? `<a href="${it.href}" target="_blank" rel="noopener">${esc(it.v)}</a>` : esc(it.v)}</div>
        <div class="qpick">${q.zones.map(z => `<button class="qpick-btn${sel === z.z ? ' on' : ''}"
          onclick="pickQuiz('${q.id}','${it.i}','${z.z}')">${esc(z.l)}</button>`).join('')}${mk}</div>
      </div>`;
    }).join('')}</div>`;
  } else if (q.mode === 'triple') {
    const zoneOf = id => q.zones.find(z => z.z === id);
    board = q.rows.map(r => `<div class="qtriple">${r.map((cell, k) => {
      const arrow = k ? '<span class="qfix" aria-hidden="true">—</span>' : '';
      if (typeof cell !== 'string')     // rico:… ?변수 는 고정폭, 한글 개체명은 본문 글꼴로
        return arrow + `<span class="qfix${/^[?A-Za-z]/.test(cell.fx) ? '' : ' ko'}">${esc(cell.fx)}</span>`;
      const held = inZone(cell);           // 채워진 슬롯은 자리 이름 대신 놓인 조각을 보인다
      return arrow + drop(zoneOf(cell), 'qslot', held || zl(zoneOf(cell)));
    }).join('')}</div>`).join('');
  } else {
    board = `<div class="qzones">${q.zones.map(z =>
      drop(z, 'qzone', zl(z) + `<div class="zi">${inZone(z.z)}</div>`)).join('')}</div>`;
  }

  /* 미끼 조각(정답 자리가 없는 것)은 분모에서 뺀다 —
     가만히 둬도 맞은 것으로 세면 시작하자마자 2/5 가 되어 점수가 뜻을 잃는다.
     대신 미끼를 잘못 놓으면 아래 오답 목록에는 그대로 잡힌다. */
  const scored = q.items.filter(it => q.key[it.i]);
  const placed = scored.filter(it => st.place[it.i]).length;
  let fb = '';
  if (st.checked) {
    const wrong = q.items.filter(it => !qOK(q, it.i));
    const got = scored.filter(it => qOK(q, it.i)).length;
    fb = wrong.length
      ? `<div class="qfb part"><b>${got === scored.length
        ? '자리는 다 맞았습니다. 다만 쓰지 않을 조각이 들어가 있습니다.'
        : `${got}/${scored.length} 맞았습니다.`}</b>
         <ul>${wrong.map(it => `<li><b>${esc(it.l)}</b> — ${q.why?.[it.i]
        || (q.key[it.i] ? (q.mode === 'pick'
          ? `정답은 <b>${esc(q.zones.find(z => z.z === q.key[it.i]).l)}</b>입니다.`
          : `여기가 아닙니다. <b>${esc(q.zones.find(z => z.z === q.key[it.i]).l)}</b> 자리입니다.`)
          : '이건 쓰지 않는 조각입니다. 원래 자리로 되돌려 두세요.')}</li>`).join('')}</ul></div>`
      : `<div class="qfb pass"><b>전부 맞았습니다.</b> ${q.done}</div>`;
  }
  if (st.hint) {
    fb += `<div class="qfb part">${(q.hints || [])[st.hint - 1] || ''}</div>`;
  }

  return `<section class="quiz" data-q="${q.id}">
    <div class="qhead"><span class="qtag">연습</span><h4>${esc(q.title)}</h4>
      <span class="qn">${placed}/${scored.length} ${q.mode === 'pick' ? '선택' : '배치'}</span></div>
    <p class="qprompt">${q.prompt}</p>
    ${q.mode === 'pick' ? '' : `<div class="qbank" data-drop="" data-q="${q.id}">${q.items.filter(it => !st.place[it.i]).map(chip).join('')}</div>`}
    ${board}
    <div class="qbar">
      <button class="btn sm primary" onclick="gradeQuiz('${q.id}')" ${st.checked ? 'disabled' : ''}>채점</button>
      <button class="btn sm" onclick="resetQuiz('${q.id}')">다시</button>
      ${q.hints && !(st.checked && qAllOK(q)) ? `<button class="btn sm hintbtn" onclick="hintQuiz('${q.id}')">힌트</button>` : ''}
    </div>${fb}${st.checked && q.learn ? learnHTML(q) : ''}</section>`;
}
/* 채점하고 나면 — 맞았든 틀렸든 — 이 문제에 나온 어휘를 원본 정의로 짚어 준다 */
function learnHTML(q) {
  return `<div class="qlearn"><b>짚고 넘어가기</b>
    <dl>${q.learn.map(x => `<dt>${esc(x.t)}</dt><dd>${x.d}</dd>`).join('')}</dl>
    ${q.learnNote ? `<p class="ln">${q.learnNote}</p>` : ''}</div>`;
}
function paintQuiz(id) {
  const el = document.querySelector(`section.quiz[data-q="${id}"]`);
  if (el) el.outerHTML = quizHTML(QBY[id]);
}
function gradeQuiz(id) { st_(QBY[id]).checked = true; paintQuiz(id); renderCardNav(); }
function pickQuiz(id, item, zone) {
  const s = st_(QBY[id]);
  if (s.checked) return;
  s.place[item] = zone; paintQuiz(id);
}
function resetQuiz(id) { QS[id] = { place: {}, checked: false, hint: 0 }; paintQuiz(id); renderCardNav(); }
function hintQuiz(id) {
  const q = QBY[id], s = st_(q);
  s.hint = Math.min((q.hints || []).length, s.hint + 1); paintQuiz(id);
}
const cardQuizDone = i => {
  const qs = QUIZZES[CARDS[i].n];
  return qs && qs.length && qs.every(q => QS[q.id]?.checked && qAllOK(q));
};

/* 드래그 — 포인터 이벤트 하나로 마우스·터치 모두 처리 */
let DRAG = null, SEL = null;
function place(id, item, zone) {
  const s = st_(QBY[id]);
  if (zone) s.place[item] = zone; else delete s.place[item];
  s.checked = false; paintQuiz(id);
}
document.addEventListener('pointerdown', e => {
  const chip = e.target.closest('.qchip');
  if (chip) {
    e.preventDefault();
    const r = chip.getBoundingClientRect();
    DRAG = {
      chip, id: chip.dataset.q, item: chip.dataset.item, moved: false,
      x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width,
    };
    return;
  }
  const zone = e.target.closest('[data-drop]');
  if (zone && SEL && zone.dataset.q === SEL.id) {
    const id = SEL.id, item = SEL.item; SEL = null;
    place(id, item, zone.dataset.drop);
  }
});
document.addEventListener('pointermove', e => {
  if (!DRAG) return;
  if (!DRAG.moved) {
    if (Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0) < 5) return;
    DRAG.moved = true;
    const g = DRAG.chip.cloneNode(true);
    g.classList.add('qghost'); g.style.width = DRAG.w + 'px';
    document.body.appendChild(g); DRAG.ghost = g;
    DRAG.chip.style.opacity = '.3';
    if (SEL) { document.querySelectorAll('.qchip.sel').forEach(c => c.classList.remove('sel')); SEL = null; }
  }
  DRAG.ghost.style.left = (e.clientX - DRAG.ox) + 'px';
  DRAG.ghost.style.top = (e.clientY - DRAG.oy) + 'px';
  const t = zoneAt(e.clientX, e.clientY, DRAG.id);
  if (DRAG.over !== t) {
    DRAG.over?.classList.remove('over');
    t?.classList.add('over');
    DRAG.over = t;
  }
});
document.addEventListener('pointerup', e => {
  if (!DRAG) return;
  const d = DRAG; DRAG = null;
  d.ghost?.remove(); d.over?.classList.remove('over'); d.chip.style.opacity = '';
  if (d.moved) {
    const t = zoneAt(e.clientX, e.clientY, d.id);
    if (t) place(d.id, d.item, t.dataset.drop);
  } else {                                   // 움직이지 않았으면 = 집기/놓기 방식 선택
    const on = d.chip.classList.contains('sel');
    document.querySelectorAll('.qchip.sel').forEach(c => c.classList.remove('sel'));
    SEL = on ? null : { id: d.id, item: d.item };
    if (SEL) d.chip.classList.add('sel');
  }
});
function zoneAt(x, y, id) {
  const el = document.elementFromPoint(x, y);
  const t = el && el.closest('[data-drop]');
  return t && t.dataset.q === id ? t : null;
}

/* ══════════ 뷰 전환 ══════════ */
function showView(n) {
  for (const i of [1, 2, 3]) {
    $('#view' + i).classList.toggle('on', n === i);
    $('#tab' + i).setAttribute('aria-selected', n === i);
  }
  if (n === 2) renderWB();
  if (n === 3) renderPart3();
  updateProgress();
  syncHash();
  window.scrollTo({ top: 0 });
}

/* ══════════ 주소 ══════════
   #1-3 = 1부 3장 · #2 = 2부 · #3-net = 3부 관계망.
   새로고침해도 보던 자리로 돌아오고, 링크로 특정 장을 바로 열 수 있다.
   history 에 쌓지 않는다(replaceState) — 뒤로 가기가 '앞 장'이 되면
   부(部)를 오갈 때 어디로 가는지 종잡을 수 없어진다. */
const viewNow = () => [1, 2, 3].find(i => $('#view' + i).classList.contains('on')) || 1;
function syncHash() {
  const v = viewNow();
  const h = v === 1 ? `#1-${CARDS[curCard].n}`
    : v === 2 ? '#2'
      : '#3' + (window.p3 && p3.now ? '-' + p3.now() : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}
function applyHash() {
  const h = location.hash;
  let m;
  if ((m = /^#1-(\d+)$/.exec(h))) {
    const i = CARDS.findIndex(c => c.n === +m[1]);
    showView(1); setCard(i < 0 ? 0 : i);
  } else if (h === '#2') {
    showView(2);
  } else if ((m = /^#3(?:-([a-z]+))?$/.exec(h))) {
    showView(3);
    if (m[1] && window.p3) p3.tab(m[1]);
  } else {
    showView(1); setCard(curCard);
  }
}
addEventListener('hashchange', applyHash);

/* ══════════ 2부 · 워크벤치 ══════════ */
const WB = { step: 1, para: null, ents: [], triples: [], validated: null, source: null };
const STEP_NAMES = ['원문 준비', '개체 추출', '클래스 배정', '전거 매핑', '트리플 잇기', '검증', '산출'];

const findProp = t => D.objectProps.find(p => p.t === t);
const authorityNames = () => new Set(D.authority.map(a => a.name));

function renderSteps() {
  $('#steps').innerHTML = STEP_NAMES.map((s, i) =>
    `<span class="step ${WB.step === i + 1 ? 'on' : ''} ${WB.step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</span>`).join('');
}

/* 버튼을 눌렀을 때 "무언가 일어났다"를 보이게 — 해당 단계로 옮겨 가고 한 번 깜빡인다 */
function flashTo(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1400);
}
const wbBlock = n => document.querySelectorAll('#wbhost .wb')[n];
/* ⑥의 “고치기” 링크 — 제목으로 찾는다(블록 순서가 상태에 따라 달라지므로) */
window.goStep = title => {
  const el = [...document.querySelectorAll('#wbhost .wb')]
    .find(x => x.querySelector('h3')?.textContent.trim() === title);
  if (el) flashTo(el);
};
window.goValidate = btn => {
  btn.disabled = true; btn.textContent = '검증하는 중…';
  setTimeout(() => { WB.step = 6; validate(); flashTo(wbBlock(5)); }, 120);
};
window.goOutput = () => { WB.step = 7; renderWB(); flashTo(wbBlock(6)); };

function renderWB() {
  renderSteps();
  const h = [];
  h.push(stepSource());
  if (WB.para) h.push(stepExtract());
  if (WB.ents.length) h.push(stepClass());
  if (WB.ents.length) h.push(stepAuthority());
  // 1개부터 연다 — 나머지 한쪽은 ⑤에서 직접 담을 수 있다
  if (WB.ents.filter(e => e.cls).length >= 1) h.push(stepTriples());
  if (WB.triples.length) h.push(stepValidate());
  if (WB.validated) h.push(stepOutput());
  $('#wbhost').innerHTML = h.join('');
  updateProgress();
}

/* ① 원문 — 준비된 8단락 + 내가 넣은 원문 */
const USER_PARAS = [];                       // 이번 세션에만 남는다 (서버로 가지 않음)
const allParas = () => [...D.paragraphs, ...USER_PARAS];
const paraById = id => allParas().find(p => p.id === id);
/* 출처 앵커 — 숫자만 적혀 있으면 '쪽'을 붙이고, '3단락' 같은 표기는 그대로 쓴다.
   앵커는 쪽수여야만 하는 것이 아니라 "이 사실을 어디서 다시 찾는가"를 가리키면 된다. */
const anchorText = v => {
  const s = String(v ?? '').trim();
  return !s ? '' : (/^\d+(\s*[-~]\s*\d+)?$/.test(s) ? s + '쪽' : s);
};
// 준비된 단락은 출처 문자열에 이미 쪽수가 들어 있다 — 두 번 적지 않는다
const srcLabel = p => p.source + (p.page && !String(p.source).includes(String(p.page)) ? ` · ${anchorText(p.page)}` : '');
let importOpen = false;

function stepSource() {
  const card = p => {
    const main = `<button aria-pressed="${WB.para?.id === p.id}" onclick="pickPara('${p.id}')">
      ${p.user ? '<span class="mine">내 원문</span> ' : ''}${esc(p.title)}
      <span class="src">${esc(srcLabel(p))}${D.precomputed[p.id] ? ' · AI추출 준비됨' : ''}</span></button>`;
    return p.user
      ? `<span class="pcard">${main}<button class="pdel" title="이 단락 지우기"
           aria-label="${esc(p.title)} 지우기" onclick="delMine('${p.id}')">×</button></span>`
      : main;
  };
  return `<div class="wb"><div class="wbhead"><span class="no">①</span><h3>원문 준비</h3>
    <span class="hint">준비된 8단락 중 하나, 또는 내 원문</span></div>
  <div class="parapick">${D.paragraphs.map(card).join('')}</div>
  ${USER_PARAS.length ? `<div class="parapick" style="margin-top:.55rem">${USER_PARAS.map(card).join('')}</div>` : ''}
  <div style="margin-top:.8rem">
    <button class="btn sm ${importOpen ? '' : 'primary'}" onclick="toggleImport()">
      ${importOpen ? '× 닫기' : '＋ 내 원문 넣기'}</button>
    ${USER_PARAS.length ? `<button class="btn sm" onclick="clearMine()" style="margin-left:.4rem">내 원문 비우기 (${USER_PARAS.length})</button>` : ''}
  </div>
  ${importOpen ? importPanel() : ''}
  ${WB.para ? `<div class="ex" style="margin-top:1rem"><div class="lbl">원문 — ${esc(srcLabel(WB.para))}</div>
    <div id="srcText">${highlight(WB.para.text)}</div></div>` : ''}</div>`;
}

function importPanel() {
  return `<div class="imp" id="impPanel"
    ondragover="event.preventDefault();this.classList.add('over')"
    ondragleave="this.classList.remove('over')"
    ondrop="event.preventDefault();this.classList.remove('over');pickFiles(event.dataTransfer.files)">
    <p class="impinfo">파일을 이 상자에 끌어다 놓거나, 아래 칸에 <b>텍스트를 그대로 붙여 넣으세요.</b>
      읽을 수 있는 형식은 <b>txt · md · docx · hwpx · pdf</b>입니다.
      <span class="vdef">(구형 <code>.doc</code>·<code>.hwp</code>는 읽지 못합니다 — 원본에서 복사해 붙여 넣거나 .docx·.hwpx로 저장해 주세요.
      스캔만 된 PDF도 글자가 없어 읽히지 않습니다.)</span></p>
    <p class="impinfo"><b>파일은 브라우저 안에서만 열립니다.</b> 어디로도 전송되지 않고, 새로고침하면 사라집니다.</p>
    <p class="impinfo"><b>쪽·위치는 비워 두어도 됩니다.</b> ⑥의 규칙6은 “이 사실을 어디서 다시 찾는가”를 묻는 것이라
      쪽수가 아니어도 됩니다. PDF면 <b>실제 쪽 번호</b>를, 그 밖의 글이면 <code>1단락</code> <code>2단락</code> … 을
      자동으로 답니다. 아는 쪽수가 있으면 적어 주세요 — 적은 값은 이번에 넣는 모든 단락에 그대로 붙습니다.</p>
    <div class="impgrid">
      <label>출처 <span style="color:var(--bad)">*</span>
        <input id="impSrc" placeholder="예: 정세균 구술, 5차 구술 / 우리 기관 OO보고서"></label>
      <label>쪽·위치 <span class="vdef">(비우면 자동)</span>
        <input id="impPage" placeholder="${esc(autoAnchorHint())}"></label>
      <label>제목 <span class="vdef">(선택)</span>
        <input id="impTitle" placeholder="비우면 자동으로 붙습니다"></label>
    </div>
    <div style="margin:.5rem 0">
      <input type="file" id="impFile" accept=".txt,.md,.markdown,.docx,.hwpx,.pdf"
        onchange="pickFiles(this.files)" style="font-size:.85rem">
    </div>
    <textarea id="impText" rows="6" placeholder="여기에 원문을 붙여 넣으세요"></textarea>
    <div style="margin-top:.5rem">
      <button class="btn sm primary" onclick="addMine()">단락으로 넣기</button>
      <span id="impMsg" class="impmsg"></span>
    </div></div>`;
}
/* 파일에서 읽어 온 쪽 정보. 사용자가 본문을 고치면 쪽 경계가 어긋나므로 그때는 버린다. */
let IMP = { pages: null, text: '' };
const autoAnchorHint = () =>
  IMP.pages ? `비우면 PDF 쪽 번호 (1–${IMP.pages[IMP.pages.length - 1].page}쪽)` : '비우면 1단락 · 2단락 …';

window.toggleImport = () => { importOpen = !importOpen; IMP = { pages: null, text: '' }; renderWB(); };
window.delMine = id => {
  const i = USER_PARAS.findIndex(p => p.id === id);
  if (i < 0) return;
  USER_PARAS.splice(i, 1);
  DONE.delete(id);
  if (WB.para?.id === id) { WB.para = null; WB.ents = []; WB.triples = []; WB.validated = null; WB.step = 1; }
  renderWB();
};
window.clearMine = () => {
  if (!confirm(`내가 넣은 원문 ${USER_PARAS.length}건을 지웁니다. 계속할까요?`)) return;
  const ids = new Set(USER_PARAS.map(p => p.id));
  USER_PARAS.length = 0;
  if (WB.para && ids.has(WB.para.id)) { WB.para = null; WB.ents = []; WB.triples = []; WB.validated = null; WB.step = 1; }
  renderWB();
};
const impSay = (m, bad) => {
  const el = $('#impMsg'); if (!el) return;
  el.textContent = m; el.className = 'impmsg' + (bad ? ' bad' : '');
};
window.pickFiles = async (files) => {
  if (!files || !files.length) return;
  const f = files[0];
  impSay(`${f.name} 여는 중…`);
  IMP = { pages: null, text: '' };
  try {
    const got = await readDocFile(f, impSay);
    const text = scrubText(got.text).trim();
    $('#impText').value = text;
    IMP = { pages: got.pages, text };
    if (!$('#impSrc').value.trim()) $('#impSrc').value = f.name;
    const pg = $('#impPage'); if (pg) pg.placeholder = autoAnchorHint();
    impSay(`${f.name} — ${text.length.toLocaleString()}자를 읽었습니다` +
      `${got.pages ? ` (${got.pages.length}쪽 · 쪽 번호를 자동으로 답니다)` : ''}. ` +
      `출처를 확인하고 “단락으로 넣기”를 누르세요.`);
  } catch (e) { impSay(e.message, true); }
};
window.addMine = () => {
  const text = $('#impText').value.trim();
  const src = $('#impSrc').value.trim();
  const page = $('#impPage').value.trim();
  const title = $('#impTitle').value.trim();
  if (!text) { impSay('원문이 비어 있습니다.', true); return; }
  if (!src) { impSay('출처를 적어 주세요 — 출처 없는 사실은 검증할 수 없습니다.', true); return; }
  // 쪽 정보가 살아 있는 PDF면 쪽마다 나눠 실제 쪽 번호를 달고, 그 밖에는 '1단락…'을 단다
  const parts = (IMP.pages && IMP.text === text)
    ? splitPages(IMP.pages)
    : splitParagraphs(text).map((t, i) => ({ text: t, page: `${i + 1}단락` }));
  if (!parts.length) { impSay('단락으로 나눌 만한 내용이 없습니다.', true); return; }
  const base = USER_PARAS.length;
  parts.forEach((part, i) => USER_PARAS.push({
    id: `u${base + i + 1}`, user: true,
    title: title ? (parts.length > 1 ? `${title} (${i + 1})` : title) : `내 원문 ${base + i + 1}`,
    source: src, page: page || part.page, text: part.text,
  }));
  importOpen = false;
  IMP = { pages: null, text: '' };
  pickPara(USER_PARAS[base].id);
  setTimeout(() => flashTo('#wbhost .wb'), 60);
};
function pickPara(id) {
  WB.para = paraById(id);
  WB.ents = []; WB.triples = []; WB.validated = null; WB.step = 2;
  LAST_COST = '';                 // 단락이 바뀌면 앞 단락의 토큰 표시를 남기지 않는다
  renderWB();
}
function highlight(t) {
  // 자리(index)를 먼저 잡고 한 번에 끼워 넣는다.
  // 이어붙이기(split/join)로 하면 이미 칠한 '특권 내려놓기 추진위원회' 안의 '특권'까지
  // 다시 칠해져 mark 가 겹쳐 버린다.
  const spans = [];
  for (const e of WB.ents) {
    if (!e.surface) continue;
    let i = -1;
    while ((i = t.indexOf(e.surface, i + 1)) >= 0) spans.push({ a: i, b: i + e.surface.length, cls: e.cls });
  }
  spans.sort((x, y) => (x.a - y.a) || (y.b - x.b));      // 같은 자리면 긴 쪽 우선
  let out = '', at = 0;
  for (const s of spans) {
    if (s.a < at) continue;                               // 이미 칠한 구간과 겹치면 건너뛴다
    out += esc(t.slice(at, s.a)) +
      `<mark class="c-${s.cls || 'none'}"><span>${esc(t.slice(s.a, s.b))}</span></mark>`;
    at = s.b;
  }
  return out + esc(t.slice(at));
}

/* ② 추출 */
function stepExtract() {
  const pre = D.precomputed[WB.para.id];
  const done = WB.ents.filter(e => e.cls).length;
  const mine = WB.para.user;
  return `<div class="wb"><div class="wbhead"><span class="no">②</span><h3>개체 추출</h3>
    <span class="hint">손으로 먼저, 그다음 일괄로</span></div>
  <p style="font-size:.9rem;color:var(--muted);margin:.2rem 0 .8rem">
    위 원문에서 <b>실제로 존재하는 것</b>을 드래그해 하나씩 담아 보세요. 길이 제한도 개수 제한도 없습니다.
    몇 개 해 보고 나서 <b>일괄 추출</b>을 눌러 무엇을 더 찾았고 무엇을 잘못 찾았는지 견주면 됩니다.</p>
  <button class="btn sm" onclick="addSelection()">＋ 드래그한 부분을 추출</button>
  ${pre ? `<button class="btn sm primary" onclick="loadAI()" style="margin-left:.4rem">⚡ AI로 추출
      <span style="opacity:.75">— 개체 ${pre.entities.length} · 트리플 ${pre.triples.length}</span></button>` : ''}
  ${mine ? `<button class="btn sm primary" onclick="runRules()" style="margin-left:.4rem">⚙ 규칙으로 일괄 추출</button>
    <button class="btn sm" id="aiBtn" onclick="runAI(this)" style="margin-left:.4rem">⚡ AI로 추출${savedKey() ? '' : ' (키 필요)'}</button>` : ''}
  <button class="btn sm" onclick="WB.ents=[];WB.triples=[];WB.validated=null;renderWB()" style="margin-left:.4rem">비우기</button>
  <span id="exMsg" class="impmsg"></span>
  <div id="exCost" class="excost">${LAST_COST}</div>
  ${pre ? `<p class="note" style="margin-top:.7rem"><b>AI 추출은 사전 계산본입니다</b>(API 키 불필요).
    Claude가 이 단락을 읽고 실제로 뽑은 결과를 그대로 담았고, 준비된 8단락 전부에 있습니다.
    개체와 클래스는 물론 <b>트리플까지 한 번에</b> 들어옵니다 — ⑤단계를 건너뛰고 바로 검증해 볼 수 있습니다.<br>
    두 가지를 눈여겨보세요. ① 원문에 글자로 없는 <b>“정세균”이 들어옵니다</b> — “제가”를 구술자로 되돌린 것입니다.
    ② <b>틀린 항목이 섞여 있습니다.</b> 사람이 읽으면 그럴듯하지만 온톨로지는 거부하는 것들이고, ⑥에서 걸러집니다.</p>` : ''}
  ${mine ? `<p class="note" style="margin-top:.7rem"><b>내가 넣은 원문에는 사전 계산본이 없습니다.</b> 두 가지 길이 있습니다.<br>
    <b>⚙ 규칙 — AI가 아닙니다.</b> 이 브라우저 안에서 도는 <b>글자 패턴 찾기</b>입니다.
    모델도, 학습도, 통신도 없습니다. 하는 일은 두 가지뿐입니다 —
    ① 전거 마스터 <b>${D.authority.length}명의 이름과 글자가 똑같은 자리</b>를 찾고,
    ② <code>…당</code> <code>…위원회</code> <code>…법</code> <code>…의장</code> <code>…사태</code> <code>2019년</code> 처럼
    <b>끝나는 모양</b>으로 종류를 짐작합니다.
    <b>문맥을 읽지 않습니다.</b> 그래서 “국회의장을 지냈다”의 국회의장은 찾아도
    “그분이 의장이었다”의 <i>그분</i>은 못 찾고, 장소는 조사(‘…도’·‘…에서’)와 구별이 안 돼 아예 포기했습니다.
    <b>이 거칢을 직접 보는 것이 이 버튼의 목적입니다</b> — 아래 AI가 무엇을 더 하는지 견주려면 기준이 있어야 하니까요.<br>
    <b>⚡ AI</b> — 브라우저에서 고른 모델을 <b>직접</b> 부릅니다(우리 서버를 거치지 않습니다).
    ${savedKey() ? `키가 저장돼 있습니다 — ${esc(PROVIDERS[provider()].label)} · ${esc(savedModel())}.` : '아래에서 제공자를 고르고 API 키를 넣으면 켜집니다.'}
    <b>키는 이 브라우저에만 저장됩니다.</b></p>
    ${keyRow()}` : ''}
  <div class="entlist" id="entlist">${WB.ents.map((e, i) => entChip(e, i)).join('')}</div>
  <p style="font-size:.85rem;color:var(--muted)">현재 ${WB.ents.length}개 · 클래스 배정 ${done}개
    ${WB.ents.length && done < WB.ents.length ? '· <b style="color:var(--warn)">클래스가 없으면 검증할 수 없습니다</b>' : ''}</p></div>`;
}


/* ── 규칙 기반 후보 추출 ──────────────────────────────────────────────────
   전거 이름은 정확 일치, 나머지는 접미사 패턴. 겹치면 긴 쪽을 남긴다.
   정확도는 낮다 — 그것이 ⑥ 검증과 AI가 필요한 이유를 보여 준다. */
const RULES = [
  [/(\d{4}-\d{2}-\d{2})/g, 'Date'],
  [/(\d{4}년(?:\s?\d{1,2}월)?(?:\s?\d{1,2}일)?)/g, 'Date'],
  [/(\d{1,2}월\s?\d{1,2}일)/g, 'Date'],
  [/(제\s?\d{1,3}대(?:\s?(?:전반기|후반기))?)/g, 'Date'],
  [/([가-힣]{2,12}(?:사태|사건|운동|항쟁|전쟁|위기|참사|소추|정변|혁명|선언|협정|파동))/g, 'Event'],
  [/((?:대한민국)?헌법|[가-힣]{2,12}(?:기본법|특별법|법률|시행령|조례|지침))/g, 'Rule'],
  [/([가-힣]{2,10}법)(?![인원률])/g, 'Rule'],
  [/([가-힣]{2,14}(?:위원회|대학교|고등학교|연구원|연구소|공사|공단|재단|협회|그룹|은행|신문사|방송|아카이브|기록관|도서관|박물관))/g, 'CorporateBody'],
  [/([가-힣]{2,8}(?:당|정부|부처|사무처|사무국))(?![원국])/g, 'CorporateBody'],
  // 긴 이름을 먼저 둔다 — 앞의 대안이 먼저 맞으면 '국회기록보존소'가 '국회'로 잘린다
  [/(국회기록보존소|국가기록원|헌법재판소|(?:대한민국\s?)?국회|청와대|대법원)/g, 'CorporateBody'],
  [/([가-힣]{2,12}(?:의장|부의장|위원장|원내대표|당대표|대표|총리|부총리|대통령|장관|차관|의원|간사|위원|총장|비서관|수석|실장|사장|회장|이사장|교수))/g, 'Position'],
  // 앞에 수식어 없이 홀로 쓰인 직함 ("… 위원장을 맡았다")
  [/(?<![가-힣])(위원장|부의장|의장|원내대표|대표|부총리|총리|대통령|장관|차관|의원|간사|총장|실장|사장|회장|교수)(?![가-힣])/g, 'Position'],
  // 장소는 한 음절 접미사(도·시·리·산·사…)가 조사·어미와 구별되지 않아 규칙으로 못 잡는다.
  // 억지로 넣으면 "하면서도"·"산에도"가 장소가 된다. 확실한 것만 남기고 나머지는 손으로.
  [/([가-힣]{2,10}(?:의사당|청사|회관|기념관|기록관|생가|묘역|광장|공원|캠퍼스))/g, 'Place'],
];
// 이름 뒤에 직함이 오는 자리. 두 글자면 "우리 대표"·"당시 의장"까지 걸리므로 세 글자만.
const NOT_NAME = new Set(['자신이', '우리당', '이번에', '그때는', '지금은', '해당자', '본인이', '정책위', '상임위', '운영위']);
const HONORIFIC = /(?<![가-힣])([가-힣]{3})(?=\s(?:씨|님|의원|장관|대표|총재|고문|위원장|대통령|총리|부총리|의장|교수|박사|사장|회장))/g;
// 김원기金元基 처럼 한자를 병기한 인명. 네 글자까지 허용하면 대마불사大馬不死 가 걸린다.
const HANJA_NAME = /(?<![가-힣])([가-힣]{2,3})[一-鿿]{2,3}(?![一-鿿])/g;

function ruleExtract(text) {
  const names = authorityNames();
  const spans = [];
  const push = (s, i, cls, w) => { if (s && s.trim()) spans.push({ s: s.trim(), a: i, b: i + s.length, cls, w }); };
  for (const n of names) {                       // 전거 이름 — 가장 믿을 만하다
    let i = -1; while ((i = text.indexOf(n, i + 1)) >= 0) push(n, i, 'Person', 3);
  }
  for (const re of [HONORIFIC, HANJA_NAME]) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) {
      if (NOT_NAME.has(m[1]) || /[이가을를은는의에와과도만로]$/.test(m[1])) continue;
      push(m[1], m.index, 'Person', 2);
    }
  }
  for (const [re, cls] of RULES) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(text))) push(m[1], m.index + m[0].indexOf(m[1]), cls, 1);
  }
  // 겹치면 (가중치 → 길이) 순으로 남긴다
  spans.sort((x, y) => (y.w - x.w) || (y.s.length - x.s.length) || (x.a - y.a));
  const kept = [], taken = [];
  for (const sp of spans) {
    if (taken.some(t => sp.a < t.b && t.a < sp.b)) continue;
    taken.push(sp); kept.push(sp);
  }
  const seen = new Set(), out = [];
  for (const sp of kept.sort((x, y) => x.a - y.a)) {
    if (seen.has(sp.s)) continue;
    seen.add(sp.s); out.push({ surface: sp.s, cls: sp.cls });
  }
  return out.slice(0, 40);
}
window.runRules = () => {
  const found = ruleExtract(WB.para.text);
  if (!found.length) { $('#exMsg').textContent = '규칙에 걸리는 후보가 없습니다. 드래그로 직접 담아 주세요.'; return; }
  WB.ents = found.map(e => ({ ...e, rule: true }));
  WB.triples = []; WB.validated = null; WB.step = 3;
  setCost('<b>규칙 추출은 브라우저 안에서 돌았습니다</b> — 어디로도 보내지 않았으므로 토큰도 비용도 0입니다.');
  renderWB();
  $('#exMsg').textContent = `규칙으로 후보 ${found.length}개를 뽑았습니다 — 틀린 것을 지우고 클래스를 고쳐 주세요.`;
};

/* ── AI 추출 ──────────────────────────────────────────────────────────────
   Anthropic·OpenAI·Google 세 곳을 쓸 수 있다. 셋 다 "JSON만 내놓아라"를 말로
   부탁하지 않고 각 API가 제공하는 구조적 출력 기능으로 강제한다 —
   말로 부탁하면 앞뒤에 설명이 붙거나 길이 제한에 잘려 파싱이 깨진다. */
const PROVIDERS = {
  anthropic: {
    label: 'Anthropic · Claude', hint: 'sk-ant-…', defModel: 'claude-sonnet-5',
    where: 'console.anthropic.com',
  },
  openai: {
    label: 'OpenAI · GPT', hint: 'sk-…', defModel: 'gpt-4o',
    where: 'platform.openai.com',
  },
  gemini: {
    label: 'Google · Gemini', hint: 'AIza…', defModel: 'gemini-2.5-flash',
    where: 'aistudio.google.com',
  },
};
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
const provider = () => (PROVIDERS[LS.get('llm-provider', 'anthropic')] ? LS.get('llm-provider', 'anthropic') : 'anthropic');
const savedKey = (p = provider()) => LS.get(p + '-key', '');
const savedModel = (p = provider()) => LS.get(p + '-model', '') || PROVIDERS[p].defModel;

window.setProvider = v => { LS.set('llm-provider', v); renderWB(); };
window.saveKey = () => {
  const p = provider(), v = ($('#apiKey').value || '').trim(), m = ($('#apiModel').value || '').trim();
  if (!v) { $('#exMsg').textContent = '키를 입력해 주세요.'; return; }
  LS.set(p + '-key', v);
  if (m) LS.set(p + '-model', m);
  renderWB();
};
window.clearKey = () => { LS.del(provider() + '-key'); renderWB(); };
window.saveModel = el => LS.set(provider() + '-model', el.value.trim());

/* ── 토큰·비용 표시 ────────────────────────────────────────────────────────
   토큰 수는 각 API가 응답에 실어 보내는 실제 값이다. 비용은 아래 단가표로 곱한 어림값이다.

   단가는 100만 토큰당 미국 달러, Anthropic 공식가(2026-06 기준)만 넣었다.
   claude-sonnet-5 는 2026-08-31 까지 도입가($2/$10)가 적용되므로 아래 값은 상한이다.
   OpenAI·Google 단가는 확인하지 못해 비워 두었다 — 표시하려면 한 줄 추가하면 된다:
       'gpt-4o': [2.50, 10.00],
   단가가 없는 모델은 토큰 수만 보여 준다. 지어낸 값을 쓰지 않는다. */
const PRICES = {
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5': [1, 5],
  'claude-fable-5': [10, 50],
};
// 모델 이름은 사람이 고쳐 쓸 수 있다 — 가장 길게 겹치는 항목을 고른다
const priceOf = m => {
  let hit = null;
  for (const k in PRICES) if (String(m || '').startsWith(k) && (!hit || k.length > hit.length)) hit = k;
  return hit ? PRICES[hit] : null;
};
const usd = n => n < 0.0001 ? '$0.0001 미만' : '$' + n.toFixed(4);
const SPEND = { calls: 0, tok: 0, usd: 0, allPriced: true };   // 이번 세션 누적

function costLine(u, model) {
  // 토큰을 못 받았으면 조용히 사라지지 말고 그렇다고 말한다
  if (!u || (!u.in && !u.out)) {
    return '이번 호출 — <b>토큰 정보를 응답에서 찾지 못했습니다.</b> ' +
      '<span class="vdef">(제공자·모델에 따라 usage 를 주지 않는 경우가 있습니다)</span>';
  }
  const pr = priceOf(model);
  const cost = pr ? (u.in * pr[0] + u.out * pr[1]) / 1e6 : null;
  SPEND.calls++; SPEND.tok += u.in + u.out;
  if (cost === null) SPEND.allPriced = false; else SPEND.usd += cost;
  const one = `이번 호출 — 입력 ${u.in.toLocaleString()} · 출력 ${u.out.toLocaleString()} 토큰` +
    (cost === null
      ? ` · <b>단가 미등록</b>이라 비용은 계산하지 않았습니다 (<code>app.js</code>의 <code>PRICES</code>에 추가할 수 있습니다)`
      : ` ≈ <b>${usd(cost)}</b> <span class="vdef">(어림값)</span>`);
  const many = SPEND.calls > 1
    ? `<br>이번 세션 누적 — ${SPEND.calls}회 · ${SPEND.tok.toLocaleString()} 토큰` +
      (SPEND.allPriced ? ` ≈ <b>${usd(SPEND.usd)}</b>` : '')
    : '';
  return one + many;
}
/* 상태로 들고 있다가 stepExtract 가 그린다 — 그리지 않고 DOM 에 꽂아 두면
   그다음 renderWB(클래스 배정·트리플 추가·검증 …)에서 통째로 지워진다. */
let LAST_COST = '';
const setCost = h => { LAST_COST = h || ''; const el = $('#exCost'); if (el) el.innerHTML = LAST_COST; };

function keyRow() {
  const p = provider(), P = PROVIDERS[p], k = savedKey(p);
  const sel = `<select onchange="setProvider(this.value)" aria-label="AI 제공자">
    ${Object.entries(PROVIDERS).map(([id, x]) =>
    `<option value="${id}" ${id === p ? 'selected' : ''}>${x.label}</option>`).join('')}</select>`;
  return `<div class="keyrow">${sel}
    ${k ? `<span class="keyok">키 저장됨 · ${esc(k.slice(0, 6))}…${esc(k.slice(-4))}</span>
           <input id="apiModel" value="${esc(savedModel(p))}" onchange="saveModel(this)" aria-label="모델 이름">
           <button class="btn sm" onclick="clearKey()">키 지우기</button>`
      : `<input id="apiKey" type="password" placeholder="${esc(P.hint)}" autocomplete="off" aria-label="API 키">
         <input id="apiModel" value="${esc(savedModel(p))}" aria-label="모델 이름">
         <button class="btn sm" onclick="saveKey()">키 저장</button>`}
    <span class="vdef">키는 ${esc(P.where)} 에서 발급합니다. 모델 이름은 고쳐 쓸 수 있습니다.</span>
  </div>`;
}

const EXTRACT_SCHEMA = () => ({
  type: 'object',
  properties: {
    entities: {
      type: 'array', description: '원문에서 뽑은 개체',
      items: {
        type: 'object', required: ['surface', 'cls'], additionalProperties: false,
        properties: {
          surface: { type: 'string', description: '원문에 나온 표층 문자열' },
          cls: { type: 'string', enum: D.classes.map(c => c.t) },
        },
      },
    },
    triples: {
      type: 'array', description: '개체 사이의 관계',
      items: {
        type: 'object', required: ['s', 'p', 'o'], additionalProperties: false,
        properties: {
          s: { type: 'string' },
          p: { type: 'string', enum: D.objectProps.map(x => x.t) },
          o: { type: 'string' },
        },
      },
    },
  },
  required: ['entities', 'triples'],
});

const AI_SYS = () => `너는 한국 기록학 자료에서 개체와 관계를 뽑는 추출기다.
아래 어휘만 쓴다. 없는 클래스·속성을 지어내지 마라.

클래스(12): ${D.classes.map(c => `${c.t}(${c.ko})`).join(', ')}
객체속성(도메인 → 레인지):
${D.objectProps.map(p => ` ${p.t} (${p.d.slice(0, 3).join('|')} → ${p.r.slice(0, 3).join('|')})`).join('\n')}

규칙:
1. entities 의 surface 는 되도록 원문에 나온 그대로 쓴다. 대명사로만 나온 인물은 지시 대상 이름으로 되돌려도 된다.
2. triples 의 s·o 는 반드시 entities 에 있는 surface 여야 한다.
3. 도메인·레인지를 지켜라. 예: occupiesOrOccupied 는 Person → Position 이다.
4. 원문이 말하지 않은 사실은 넣지 마라. 추측하지 마라.`;

/* 잘렸거나 앞뒤에 군말이 붙어도 최대한 살려 낸다 */
function parseJSONish(raw, meta) {
  let s = String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (e) { }
  const a = s.indexOf('{');
  if (a >= 0) {
    let depth = 0, inStr = false, esc2 = false;
    for (let i = a; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc2) esc2 = false; else if (ch === '\\') esc2 = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { try { return JSON.parse(s.slice(a, i + 1)); } catch (e) { } }
    }
  }
  throw new Error(`응답을 JSON으로 읽지 못했습니다${meta ? ` · ${meta}` : ''}. ` +
    `받은 내용 앞부분: ${s.slice(0, 140) || '(비어 있음)'}`);
}
const httpFail = async r => {
  const body = (await r.text()).slice(0, 220);
  if (r.status === 401 || r.status === 403) throw new Error(`인증 실패 (${r.status}) — 키를 다시 확인해 주세요. ${body}`);
  if (r.status === 404) throw new Error(`모델을 찾지 못했습니다 (404) — 모델 이름을 확인해 주세요. ${body}`);
  if (r.status === 429) throw new Error(`요청이 몰렸습니다 (429) — 잠시 뒤 다시 눌러 주세요.`);
  throw new Error(`API ${r.status} — ${body}`);
};

/* { data, usage } 를 돌려준다. usage 는 세 곳의 서로 다른 필드 이름을 {in,out} 으로 맞춘 것. */
async function callLLM(text) {
  const p = provider(), key = savedKey(p), model = savedModel(p), system = AI_SYS();
  if (!key) throw new Error('API 키를 먼저 저장해 주세요.');

  if (p === 'anthropic') {
    // 도구 호출을 강제하면 응답이 곧바로 객체로 온다 — 파싱할 것이 없다
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'x-api-key': key,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model, max_tokens: 8000, system,
        messages: [{ role: 'user', content: text }],
        tools: [{ name: 'record_extraction', description: '추출 결과를 적는다', input_schema: EXTRACT_SCHEMA() }],
        tool_choice: { type: 'tool', name: 'record_extraction' },
      }),
    });
    if (!r.ok) await httpFail(r);
    const j = await r.json();
    const u = j.usage || {};
    const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0 };
    const use = (j.content || []).find(b => b.type === 'tool_use');
    if (use) return { data: use.input, usage };
    const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { data: parseJSONish(txt, `stop_reason=${j.stop_reason}`), usage };
  }

  if (p === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system + '\n\n반드시 JSON 객체 하나만 낸다. 형식: {"entities":[{"surface":"","cls":""}],"triples":[{"s":"","p":"","o":""}]}' },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!r.ok) await httpFail(r);
    const j = await r.json();
    const ch = (j.choices || [])[0] || {};
    const u = j.usage || {};
    return {
      data: parseJSONish(ch.message?.content, `finish_reason=${ch.finish_reason}`),
      usage: { in: u.prompt_tokens || 0, out: u.completion_tokens || 0 },
    };
  }

  // gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    }),
  });
  if (!r.ok) await httpFail(r);
  const j = await r.json();
  const c = (j.candidates || [])[0] || {};
  const txt = (c.content?.parts || []).map(x => x.text || '').join('');
  // 출력은 전체에서 입력을 뺀다 — 생각(thinking) 토큰까지 함께 잡힌다
  const m = j.usageMetadata || {};
  const inTok = m.promptTokenCount || 0;
  const outTok = Math.max(0, (m.totalTokenCount || 0) - inTok) || (m.candidatesTokenCount || 0);
  return { data: parseJSONish(txt, `finishReason=${c.finishReason}`), usage: { in: inTok, out: outTok } };
}

window.runAI = async (btn) => {
  if (!savedKey()) { $('#exMsg').className = 'impmsg bad'; $('#exMsg').textContent = 'API 키를 먼저 저장해 주세요.'; return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = '추출 중…';
  $('#exMsg').className = 'impmsg';
  $('#exMsg').textContent = `${PROVIDERS[provider()].label} (${savedModel()}) 에 보내는 중…`;
  setCost('');
  let cost = '';                       // 응답이 오면 실패하더라도 쓴 토큰은 보여 준다
  try {
    const res = await callLLM(WB.para.text);
    cost = costLine(res.usage, savedModel());
    const got = res.data;
    const valid = new Set(D.classes.map(c => c.t));
    // 이 워크벤치에서 개체의 식별자는 '이름'이다(idOf). 같은 이름을 두 클래스로 받으면
    // 앞의 것만 남기고 무엇을 버렸는지 밝힌다 — 조용히 둘 다 담으면 ⑤에서 어느 쪽을 고르든
    // 검증은 앞의 것을 집어, 고른 것과 다른 판정이 나온다.
    const ents = [];
    const firstCls = new Map(); const merged = [];
    for (const e of (got.entities || [])) {
      if (!e || !e.surface || !valid.has(e.cls)) continue;
      const s = String(e.surface).trim();
      if (firstCls.has(s)) {
        if (firstCls.get(s) !== e.cls) merged.push(`${s}(${firstCls.get(s)} 유지 · ${e.cls} 버림)`);
        continue;
      }
      firstCls.set(s, e.cls);
      ents.push({ surface: s, cls: e.cls, ai: true });
    }
    if (!ents.length) throw new Error('쓸 만한 개체를 받지 못했습니다. 원문이 너무 짧거나 모델이 빈 답을 냈습니다.');
    const have = new Set(ents.map(e => e.surface));
    const page = WB.para.page || null;
    const raw = got.triples || [];
    const tri = raw.filter(t => t && have.has(t.s) && have.has(t.o) && findProp(t.p))
      .map(t => ({ s: t.s, p: t.p, o: t.o, page, ai: true }));
    WB.ents = ents; WB.triples = tri; WB.validated = null; WB.step = tri.length ? 5 : 3;
    renderWB();
    const dropped = raw.length - tri.length;
    $('#exMsg').textContent = `개체 ${ents.length}개 · 트리플 ${tri.length}개를 받았습니다` +
      `${dropped > 0 ? ` (어휘 밖이라 버린 트리플 ${dropped}개)` : ''}. 그대로 믿지 말고 ⑥에서 검증하세요.` +
      `${merged.length ? ` ※ 같은 이름을 두 클래스로 받아 하나로 합쳤습니다 — ${merged.join(', ')}.` +
        ` 정말 다른 것이라면 ③에서 이름을 구분해 주세요.` : ''}`;
    setCost(cost);                     // renderWB 가 지우므로 다시 그린 뒤에 넣는다
  } catch (e) {
    btn.disabled = false; btn.textContent = old;
    $('#exMsg').className = 'impmsg bad';
    $('#exMsg').textContent = '실패: ' + e.message;
    setCost(cost);
  }
};
function entChip(e, i) {
  const ko = D.classes.find(c => c.t === e.cls)?.ko || '';
  // 클래스를 고르면 눈에 보이게 — 12개 중 Person 만 표시가 바뀌던 문제를 고친다
  const st = !e.cls ? 'todo'
    : e.cls === 'Person' ? (authorityNames().has(e.surface) ? 'mapped' : 'unmapped')
      : 'typed';
  const badge = !e.cls ? ''
    : st === 'mapped' ? `<span class="tag ok">✓ ${esc(ko)}</span>`
      : st === 'unmapped' ? `<span class="tag warn">⚠ ${esc(ko)}</span>`
        : `<span class="tag">${esc(ko)}</span>`;
  return `<span class="ent ${st} c-${e.cls || 'none'}">${e.hand ? '<span class="hand">직접</span>' : ''}<b>${esc(e.surface)}</b>${badge}
    <select onchange="setCls(${i},this.value)">
      <option value="">클래스…</option>
      ${D.classes.map(c => `<option value="${c.t}" ${e.cls === c.t ? 'selected' : ''}>${c.ko} · ${c.t}</option>`).join('')}
    </select><button class="x" onclick="delEnt(${i})">×</button></span>`;
}
function addSelection() {
  const sel = window.getSelection();
  const src = $('#srcText');
  const inSrc = sel.rangeCount && src && src.contains(sel.getRangeAt(0).commonAncestorContainer);
  const s = String(sel).replace(/\s+/g, ' ').trim();
  if (!s || !inSrc) { alert('위 원문에서 개체가 될 부분을 드래그한 뒤 눌러 주세요.'); return; }
  if (WB.ents.some(e => e.surface === s)) { alert(`"${s}" 은(는) 이미 담겨 있습니다.`); return; }
  WB.ents.push({ surface: s, cls: '' });
  WB.step = 3; renderWB();
}
function loadAI() {
  const pre = D.precomputed[WB.para.id];
  WB.ents = pre.entities.map(e => ({ surface: e.surface, cls: e.cls, ai: true, ok: e.ok, why: e.why }));
  WB.triples = pre.triples.map(t => ({ ...t, ai: true }));
  WB.validated = null; WB.step = 5;
  setCost('<b>사전 계산본입니다</b> — 이번에는 API를 부르지 않았으므로 토큰도 비용도 들지 않았습니다. ' +
    '<span class="vdef">토큰·비용은 내 원문을 “⚡ AI로 추출”로 뽑을 때만 나옵니다.</span>');
  renderWB();
}
function setCls(i, v) { WB.ents[i].cls = v; renderWB(); }
function delEnt(i) { WB.ents.splice(i, 1); renderWB(); }

/* ③ 클래스 */
function stepClass() {
  const done = WB.ents.filter(e => e.cls).length;
  const todo = WB.ents.filter(e => !e.cls);
  const used = D.classes.filter(c => WB.ents.some(e => e.cls === c.t)).length;
  return `<div class="wb"><div class="wbhead"><span class="no">③</span><h3>클래스 배정</h3>
    <span class="hint">${done}/${WB.ents.length} 배정됨</span></div>
  <p style="font-size:.9rem;color:var(--muted);margin:.2rem 0 .6rem">
    ②의 각 개체 옆 드롭다운에서 RiC-O 클래스를 고르세요. <b>선택지는 12개뿐입니다</b> — 원본 107개가 아니라
    구술기록용으로 추린 Core입니다. 고르는 대로 아래 표에 쌓입니다.</p>
  <div class="metrics">
    <div class="metric"><div class="v" style="color:var(--ok)">${done}</div><div class="k">배정된 개체</div></div>
    <div class="metric"><div class="v" style="color:${todo.length ? 'var(--warn)' : 'var(--muted)'}">${todo.length}</div><div class="k">미배정</div></div>
    <div class="metric"><div class="v">${used}<span style="font-size:.95rem;color:var(--muted)">/12</span></div><div class="k">쓰인 클래스</div></div>
  </div>
  ${todo.length ? `<div class="result warn"><b>클래스가 없는 개체 ${todo.length}개</b> —
    ${todo.map(e => esc(e.surface)).join(' · ')}<br>
    <span style="color:var(--fg)">클래스가 없으면 그 개체가 낀 트리플은 ⑥에서 <b>검증 불가</b>로 떨어집니다.</span></div>` : ''}
  <div class="scroll"><table><tr><th>클래스</th><th>뜻</th><th>이 단락에서 배정한 개체</th></tr>
  ${D.classes.map(c => {
      const mine = WB.ents.filter(e => e.cls === c.t);
      return `<tr class="${mine.length ? 'used' : ''}"><td>${clsPill(c.t)}</td><td>${esc(c.ko)}</td>
      <td>${mine.length
          ? `<span class="cnt">${mine.length}</span>` +
          mine.map(e => `<span class="cchip c-${c.t}"><b>${esc(e.surface)}</b></span>`).join('')
          : `<span class="vdef">아직 없음 · 예를 들면 “${esc(c.ex)}”</span>`}</td></tr>`;
    }).join('')}
  </table></div>
  <p class="note">색이 든 줄이 <b>이 단락에서 실제로 쓰인 클래스</b>입니다.
  12개를 다 쓸 필요는 없습니다 — 한 단락에서 보통 4~6개가 쓰입니다.</p></div>`;
}

/* ④ 전거 매핑 */
function stepAuthority() {
  const persons = WB.ents.filter(e => e.cls === 'Person');
  const names = authorityNames();
  const hit = persons.filter(p => names.has(p.surface));
  const miss = persons.filter(p => !names.has(p.surface));
  return `<div class="wb"><div class="wbhead"><span class="no">④</span><h3>전거 매핑</h3>
    <span class="hint">이 이름이 누구인지 확정하기</span></div>
  <p style="font-size:.9rem;color:var(--muted);margin:.2rem 0 .8rem">
    <b>③에서 ${clsPill('Person')}으로 지정한 이름을 전거 마스터와 대조해, ⑦에서 <u>어느 URI를 쓸지</u> 가릅니다.</b>
    맞으면 이미 있는 전거 URI를, 없으면 임시 URI를 받습니다. “김대중”이라는 <i>글자</i>가 아니라 <b>어느 김대중인지</b>를 정합니다.<br>
    전거 마스터는 『정세균』 총서 부록의 <b>역대 국회의장단 표</b> 하나로 만들어, 제헌국회~제21대
    <b>의장·부의장 ${D.authority.length}명</b>(재임 ${D.authority.reduce((a, p) => a + p.positions.length, 0)}건)만 들어 있습니다.
    <b>일부러 좁게 잡았습니다</b> — 전거의 경계가 결과를 어떻게 가르는지 보이게 하려는 것입니다.</p>
  ${persons.length === 0 ? `<p style="font-size:.9rem;color:var(--muted)">③에서 ${clsPill('Person')}으로 지정한 개체가 아직 없습니다.</p>` : `
  <div class="metrics">
    <div class="metric"><div class="v" style="color:var(--ok)">${hit.length}</div><div class="k">전거 매칭</div></div>
    <div class="metric"><div class="v" style="color:var(--warn)">${miss.length}</div><div class="k">신규 후보</div></div>
  </div>
  ${hit.map(p => {
    const a = D.authority.find(x => x.name === p.surface);
    const po = a.positions[0];
    return `<div class="trow" style="border-color:var(--ok)"><b>${esc(a.name)}</b>
      <span class="mono" style="font-size:.76rem;color:var(--muted)">ric:${a.id}</span>
      <span style="font-size:.82rem">${esc(po.assembly)} ${esc(po.half || '')} ${esc(po.role)} · ${po.start}~${po.end}</span></div>`;
  }).join('')}
  ${miss.map(p => `<div class="trow" style="border-color:var(--warn);background:var(--warn-soft)">
      <b>${esc(p.surface)}</b>
      <span class="mono" style="font-size:.76rem;color:var(--warn)">${esc(idOf(p.surface))}</span>
      <span style="font-size:.82rem">전거 마스터에 없음 → <b>신규 후보</b>로 격리 · 위 URI는 <b>임시</b></span></div>`).join('')}
  ${miss.length ? `<button class="btn sm" onclick="dlCandidates()" style="margin-top:.5rem">
      ⇩ 신규 후보 ${miss.length}건 내보내기 (CSV)</button>` : ''}

  <p class="note"><b>“격리”가 실제로 뜻하는 것.</b> 이 워크벤치는 매칭되지 않은 이름을 <b>버리지도, 전거로 등록하지도 않습니다.</b>
  ⑦ 산출에서 <code>ric:local-이름</code> 이라는 <b>임시 URI</b>를 받아 그래프에는 들어가되, 전거 URI(<code>ric:agent-071</code>)와는
  구별된 채로 남습니다. 나중에 진짜 전거가 만들어지면 <b>이 임시 URI를 바꿔 끼우는 일</b>이 남습니다 —
  그래서 격리 목록을 따로 뽑아 전거 담당자에게 넘기는 것이 실제 절차입니다. 위 버튼이 그 목록입니다.</p>

  <p class="note">김대중·노무현처럼 잘 알려진 인물도 <b>의장단이 아니면 ‘신규 후보’로 떨어집니다.</b>
  데이터가 틀린 게 아니라 <b>전거의 범위가 거기까지</b>인 것입니다 — 실제 기관에서는 여기에
  국회의원 전거, 직원 전거, 외부 인물 전거가 차례로 붙습니다.
  동명이인·오탈자·실제 신규 인물이 이 목록에 섞여 있고, 가르는 일은 사람이 해야 합니다.
  <b>자동화가 멈추고 아키비스트가 개입하는 지점</b>이 여기입니다.</p>

  <details class="disc"><summary>실제 시스템에서는 — 식별자와 외부 전거 (이 실습에는 없는 부분)</summary>
  <div class="discbody">
  <p style="font-size:.88rem;margin:.5rem 0">
    <b>식별자.</b> 이 사이트는 보기 쉬우라고 <code>agent-071</code>(전거 순번)와 <code>ric:local-이름</code>(임시)만 씁니다.
    실무에서는 이름이 바뀌어도 흔들리지 않도록 <b>UUID나 기관이 부여한 불변 ID</b>를 URI로 삼고,
    이름은 <code>rico:hasOrHadAgentName</code> → <code>rico:AgentName</code> 으로 따로 답니다.
    이름을 URI에 넣는 이 실습 방식은 개명·이표기·동명이인에서 곧바로 깨집니다.</p>
  <p style="font-size:.88rem;margin:.5rem 0">
    <b>외부 전거(VIAF · Wikidata · ISNI).</b> 이 워크벤치는 연결하지 않습니다 — 정적 파일만으로 도는 실습이고,
    외부 대조는 사람이 후보를 골라 확정해야 하는 일이라 자동화가 어렵습니다.
    RiC-O에는 자리가 마련돼 있습니다:</p>
  <div class="ex"><div class="lbl">RiC-O 로 외부 식별자 붙이기</div>
  <pre style="margin:0;font-size:.8rem;overflow-x:auto">ric:agent-071
    a rico:Person ;
    rico:hasOrHadIdentifier ric:id-072-viaf , ric:id-072-wd .

ric:id-072-viaf
    a rico:Identifier ;
    rico:identifier "12345678" ;
    rico:hasIdentifierType ric:idtype-viaf .</pre></div>
  <p style="font-size:.88rem;margin:.5rem 0">
    <code>rico:Identifier</code> + <code>rico:IdentifierType</code> 로 <b>어느 체계의 식별자인지까지</b> 적습니다.
    RiC-O 밖의 관행으로는 <code>owl:sameAs</code>(같은 개체) 나 <code>skos:exactMatch</code>(같은 개념)를 씁니다 —
    사람에게는 <code>owl:sameAs</code> 쪽이 맞습니다.
    <code>rico:isEquivalentTo</code>(Thing → Thing)도 있지만 이는 <b>RiC 안의 두 개체</b>를 잇는 것이라 용도가 다릅니다.</p>
  </div></details>`}</div>`;
}
/* 격리된 신규 후보 목록 — 전거 담당자에게 넘길 인수인계표 */
window.dlCandidates = () => {
  const names = authorityNames();
  const rows = WB.ents.filter(e => e.cls === 'Person' && !names.has(e.surface));
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['이름,클래스,임시URI,출처,쪽·위치,비고']
    .concat(rows.map(e => [q(e.surface), 'Person', q(idOf(e.surface)),
      q(WB.para.source), q(anchorText(WB.para.page)), q('전거 마스터 미등재 — 확정 필요')].join(',')))
    .join('\r\n');
  saveText('﻿' + csv, `전거-신규후보-${WB.para.id}.csv`, 'text/csv;charset=utf-8');
};

/* ⑤ 트리플 — 도메인·레인지 자동 필터 (핵심) */
let TB = { s: '', p: '', o: '' };
function stepTriples() {
  const typed = WB.ents.filter(e => e.cls);
  const sCls = typed.find(e => e.surface === TB.s)?.cls;
  const allowed = sCls ? D.objectProps.filter(p => p.d.includes(sCls)) : [];
  const pDef = allowed.find(p => p.t === TB.p);
  const objs = pDef ? typed.filter(e => pDef.r.includes(e.cls)) : [];
  return `<div class="wb"><div class="wbhead"><span class="no">⑤</span><h3>트리플 잇기</h3>
    <span class="hint">도메인·레인지가 선택지를 좁힙니다</span></div>
  <div class="builder">
    <div><label>주어</label><select onchange="TB.s=this.value;TB.p='';TB.o='';renderWB()">
      <option value="">개체 선택…</option>
      ${typed.map(e => `<option value="${esc(e.surface)}" ${TB.s === e.surface ? 'selected' : ''}>${esc(e.surface)} (${e.cls})</option>`).join('')}
    </select></div>
    <div><label>서술어 ${sCls ? `<b style="color:var(--accent)">${allowed.length}개로 좁혀짐</b>` : ''}</label>
    <select ${!sCls ? 'disabled' : ''} onchange="TB.p=this.value;TB.o='';renderWB()">
      <option value="">${sCls ? '속성 선택…' : '먼저 주어를'}</option>
      ${allowed.map(p => `<option value="${p.t}" ${TB.p === p.t ? 'selected' : ''}>${p.ko} · ${p.t}</option>`).join('')}
    </select></div>
    <div><label>목적어 ${pDef ? `<b style="color:var(--accent)">${objs.length}개만 허용</b>` : ''}</label>
    <select ${!pDef || !objs.length ? 'disabled' : ''} onchange="TB.o=this.value;renderWB()">
      <option value="">${!pDef ? '먼저 서술어를' : objs.length ? '개체 선택…' : '후보 없음 — 아래에서 담기'}</option>
      ${objs.map(e => `<option value="${esc(e.surface)}" ${TB.o === e.surface ? 'selected' : ''}>${esc(e.surface)} (${e.cls})</option>`).join('')}
    </select></div>
    <div><button class="btn primary" ${!(TB.s && TB.p && TB.o) ? 'disabled' : ''} onclick="addTriple()">추가</button></div>
  </div>
  ${pDef ? handObj(pDef) : ''}
  ${sCls ? `<p class="rangehint">주어가 <b>${sCls}</b>라서 555개 중 <b>${allowed.length}개</b>만 남았습니다.
    ${pDef ? `그리고 <code>${pDef.t}</code>의 레인지는 <b>${pDef.r.slice(0, 4).join(' · ')}</b>이므로,
    이 단락의 개체 중 <b>${objs.length}개</b>만 목적어가 될 수 있습니다.
    ${objs.length ? '' : '<b>지금은 하나도 없습니다</b> — 아래에서 직접 담으세요.'}` : ''}</p>` :
      `<p class="rangehint">주어를 고르면 그 클래스를 <code>rdfs:domain</code>으로 갖는 속성만 남습니다.</p>`}
  <div class="tlist">${WB.triples.map((t, i) => trow(t, i)).join('') || '<p style="font-size:.87rem;color:var(--muted)">아직 트리플이 없습니다.</p>'}</div>
  ${WB.triples.length ? `<button class="btn primary" onclick="goValidate(this)">⑥ 검증하기 →</button>` : ''}</div>`;
}
function trow(t, i) {
  return `<div class="trow ${t.checked && !t.pass ? 'err' : ''}">
    <span>${esc(t.s)}</span><span class="p">${t.p}</span><span>${esc(t.o)}</span>
    <span class="pg">${t.page ? esc(anchorText(t.page)) : '<b style="color:var(--warn)">출처없음</b>'}</span>
    <button class="x" onclick="WB.triples.splice(${i},1);WB.validated=null;renderWB()">×</button>
    ${t.checked && !t.pass ? `<span class="why">✗ ${esc(t.reason)}</span>` : ''}</div>`;
}
/* 목적어를 손으로 담는다 — 원문에 이름이 없는 개최장소·소속기관 같은 것.
   클래스는 고른 속성의 레인지로 이미 정해져 있으므로 그 안에서만 고르게 한다.
   ‘등록’이라 하지 않는다 — 이 사이트에서 등록은 ④의 전거 등록을 가리키고, 여기서 그 일은 일어나지 않는다. */
function handObj(pDef) {
  const allow = pDef.r.filter(r => D.classes.some(c => c.t === r));
  const cur = allow.includes(TB.newOCls) ? TB.newOCls : allow[0];
  const one = allow.length === 1;
  return `<div class="handadd">
    <label for="newObj">목적어가 위 목록에 없나요? 직접 담으세요</label>
    <input id="newObj" value="${esc(TB.newO || '')}" oninput="TB.newO=this.value"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addObjByHand()}"
      placeholder="예: 이음센터 — 원문에 안 나오는 이름도 됩니다">
    ${one
      ? `<span class="fixcls">${esc(D.classes.find(c => c.t === cur)?.ko || cur)} · ${esc(cur)}</span>`
      : `<select onchange="TB.newOCls=this.value" aria-label="새 목적어의 클래스">
           ${allow.map(r => `<option value="${r}" ${r === cur ? 'selected' : ''}>${esc(D.classes.find(c => c.t === r)?.ko || r)} · ${r}</option>`).join('')}
         </select>`}
    <button class="btn sm" onclick="addObjByHand()">＋ 담고 목적어로</button>
    <span id="tbMsg" class="impmsg"></span>
    <p class="vdef" style="grid-column:1/-1;margin:.15rem 0 0">
      <code>${esc(pDef.t)}</code>의 레인지가 <b>${esc(allow.join(' · '))}</b>라서 ${one ? '그 클래스로만' : '그 중에서만'} 담깁니다.
      원문에 없는 이름이라 개체 목록에 <b>“직접”</b> 표시가 붙습니다 — 출처 앵커(${esc(anchorText(WB.para.page) || '없음')})는 그대로 달립니다.</p>
  </div>`;
}
window.addObjByHand = () => {
  const say = m => { const el = $('#tbMsg'); if (el) { el.textContent = m; el.className = 'impmsg bad'; } };
  const s = String(TB.newO || '').replace(/\s+/g, ' ').trim();
  const pDef = findProp(TB.p);
  if (!pDef) return;
  const allow = pDef.r.filter(r => D.classes.some(c => c.t === r));
  const cls = allow.includes(TB.newOCls) ? TB.newOCls : allow[0];
  if (!s) { say('이름을 적어 주세요.'); return; }
  const dup = WB.ents.find(e => e.surface === s);
  if (dup) {
    // 이름이 곧 식별자다 — 같은 이름을 다른 클래스로 또 담지 않는다
    if (dup.cls && dup.cls !== cls) {
      say(`"${s}" 은(는) 이미 ${dup.cls} 로 담겨 있습니다. 다른 것이라면 이름을 구분해 주세요.`);
      return;
    }
    dup.cls = cls;
  } else {
    WB.ents.push({ surface: s, cls, hand: true });
  }
  TB.o = s; TB.newO = ''; WB.validated = null; renderWB();
};
function addTriple() {
  WB.triples.push({ s: TB.s, p: TB.p, o: TB.o, page: WB.para.page });
  TB = { s: '', p: '', o: '' }; WB.validated = null; renderWB();
}

/* ⑥ 검증 6종 */
function validate() {
  const clsOf = n => WB.ents.find(e => e.surface === n)?.cls;
  // 같은 이름이 서로 다른 클래스로 두 번 담혔으면 어느 쪽인지 가릴 수 없다.
  // 앞의 것을 말없이 집으면 ⑤에서 고른 것과 다른 판정이 나온다 — 그러지 말고 그렇다고 말한다.
  const ambiguous = n => new Set(WB.ents.filter(e => e.surface === n && e.cls).map(e => e.cls)).size > 1;
  const names = authorityNames();
  const validCls = new Set(D.classes.map(c => c.t));
  let fails = [];
  /* 두 클래스를 실제로 이을 수 있는 속성 — 도메인·레인지 위반에서 “그럼 뭘 써야 하나”의 답 */
  const fitting = (s, o) => D.objectProps.filter(p => p.d.includes(s) && p.r.includes(o));
  const cd = s => `<code>${esc(s)}</code>`;
  const go = (title, label) => `<button class="lnk" onclick="goStep('${title}')">${label}</button>`;
  /* ③ 드롭다운에 실제로 있는 클래스만 권한다 — Thing·Group 은 Core 12 밖이라 고를 수 없다 */
  const pickable = list => list.filter(c => D.classes.some(x => x.t === c)).slice(0, 3);
  const asOne = list => list.length === 1 ? `${cd(list[0])} 로` : `${list.map(cd).join(' · ')} 중 하나로`;
  const swap = (s, o) => {
    const f = fitting(s, o);
    return f.length
      ? `이 짝(<b>${esc(s)} → ${esc(o)}</b>)에는 ${f.slice(0, 3).map(p => cd(p.t)).join(' · ')} 가 맞습니다.`
      : `Core 20개 속성 중 <b>${esc(s)} → ${esc(o)}</b> 를 잇는 것은 없습니다 — 둘 중 한쪽의 클래스가 잘못됐을 가능성이 큽니다.`;
  };

  WB.triples.forEach(t => {
    const pd = findProp(t.p); const sc = clsOf(t.s); const oc = clsOf(t.o);
    let reason = null, fix = null;
    if (!pd) {
      reason = `규칙1 클래스·속성 실재 — rico:${t.p} 는 프로파일에 없는 속성`;
      fix = `⑤에서 이 트리플을 <b>×</b> 로 지우고, 드롭다운에 있는 속성으로 다시 이으세요. ${go('트리플 잇기', '⑤로 가기')}`;
    } else if (!sc || !oc) {
      const who = !sc ? t.s : t.o;
      reason = `규칙1 클래스 미배정 — ${!sc ? '주어' : '목적어'} "${who}"에 클래스가 없어 검증 불가`;
      fix = `③에서 <b>${esc(who)}</b> 옆 드롭다운으로 클래스를 고르세요. ${go('클래스 배정', '③으로 가기')}`;
    } else if (ambiguous(t.s) || ambiguous(t.o)) {
      const who = ambiguous(t.s) ? t.s : t.o;
      reason = `규칙1 이름 중복 — "${who}" 이(가) 서로 다른 클래스로 두 번 담겨 어느 쪽인지 가릴 수 없습니다`;
      fix = `이 워크벤치는 <b>이름으로</b> 개체를 식별합니다. ③에서 같은 이름 둘 중 하나를 <b>×</b> 로 지우거나, ` +
        `정말 다른 것이라면 이름을 구분하세요(예: 기관은 그대로, 장소는 “이음센터”). ${go('클래스 배정', '③으로 가기')}`;
    } else if (!pd.d.includes(sc)) {
      reason = `규칙2 도메인 위반 — ${t.p}의 주어는 ${pd.d.slice(0, 3).join('·')} 여야 하는데 ${sc}`;
      const can = pickable(pd.d);
      fix = `${swap(sc, oc)}` +
        (can.length ? ` 아니면 ③에서 <b>${esc(t.s)}</b>의 클래스를 ${asOne(can)} 고치세요.` : '') +
        ` ${go('트리플 잇기', '⑤로 가기')}${can.length ? ' ' + go('클래스 배정', '③으로 가기') : ''}`;
    } else if (!pd.r.includes(oc)) {
      reason = `규칙3 레인지 위반 — ${t.p}의 목적어는 ${pd.r.slice(0, 3).join('·')} 여야 하는데 ${oc}`;
      const can = pickable(pd.r);
      fix = `${swap(sc, oc)}` +
        (can.length ? ` 또는 ⑤에서 ${can.map(cd).join(' · ')} 인 개체를 목적어로 담으세요 (목록에 없으면 <b>직접 담기</b>).` : '') +
        ` ${go('트리플 잇기', '⑤로 가기')}`;
    } else if (!t.page) {
      reason = `규칙6 출처 앵커 누락 — 쪽·위치가 없어 되짚어 볼 수 없음`;
      fix = `원문 어디에 나오는지 <b>근거를 댈 수 없는</b> 트리플입니다. 근거가 있으면 ①에서 쪽·위치를 채워 다시 넣고, ` +
        `없으면 ⑤에서 <b>×</b> 로 지우세요 — 출처 없는 사실은 넣지 않는 것이 원칙입니다. ${go('트리플 잇기', '⑤로 가기')}`;
    }
    t.checked = true; t.pass = !reason; t.reason = reason;
    if (reason) fails.push({ t, reason, fix });
  });
  const unmapped = WB.ents.filter(e => e.cls === 'Person' && !names.has(e.surface));
  const badCls = WB.ents.filter(e => e.cls && !validCls.has(e.cls));
  WB.validated = { fails, unmapped, badCls };
  WB.step = fails.length ? 6 : 7;
  renderWB();
}
function stepValidate() {
  const v = WB.validated; if (!v) return '';
  const pass = WB.triples.length - v.fails.length;
  const ext = WB.ents.map(e => e.surface);
  // 정답지 = 편집자가 색인 표제어로 삼은 것 중, 이 단락 본문에 실제로 등장하는 것.
  // (색인의 쪽 번호는 편집자가 대표 쪽만 적은 것이라 쪽으로 거르면 정답이 과소집계된다)
  const goldOnPage = D.gold
    .filter(g => WB.para.text.includes(g.term))
    .map(g => g.term);
  const missed = goldOnPage.filter(g => !ext.some(s => s.includes(g) || g.includes(s)));
  return `<div class="wb"><div class="wbhead"><span class="no">⑥</span><h3>검증</h3>
    <span class="hint">6종 규칙 + 정답지 대조</span></div>
  <div class="metrics">
    <div class="metric"><div class="v" style="color:var(--ok)">${pass}</div><div class="k">통과 트리플</div></div>
    <div class="metric"><div class="v" style="color:${v.fails.length ? 'var(--bad)' : 'var(--muted)'}">${v.fails.length}</div><div class="k">실패</div></div>
    <div class="metric"><div class="v" style="color:var(--warn)">${v.unmapped.length}</div><div class="k">전거 미매칭</div></div>
  </div>
  ${v.fails.length
      ? `<div class="result fail"><b>검증 실패 ${v.fails.length}건.</b> 각 항목의 <b>고치는 법</b>을 함께 적었습니다.
       <ol class="fixlist">${v.fails.map(f => `<li>
         <div class="ft"><span class="tri">${esc(f.t.s)} <i>${esc(f.t.p)}</i> ${esc(f.t.o)}</span></div>
         <div class="fr">✗ ${esc(f.reason)}</div>
         ${f.fix ? `<div class="fx"><b>고치기</b> ${f.fix}</div>` : ''}</li>`).join('')}</ol></div>
       <p class="note"><b>고치는 순서.</b> ① 클래스가 빠졌거나 이름이 겹쳤으면 <b>③</b>에서 먼저 정리하고,
       ② 클래스는 맞는데 속성이 안 맞으면 <b>⑤</b>에서 속성이나 목적어를 바꾸고,
       ③ 근거가 없는 트리플은 <b>지웁니다.</b> 고친 뒤 ⑤ 아래 <b>“⑥ 검증하기”</b>를 다시 누르세요.</p>
       <p class="note">이것이 계획안 프로세스 ③의 <b>"실패 시 추출 단계로 회귀"</b>입니다.
       사람이 읽으면 그럴듯한 문장도 온톨로지는 거부합니다. 이 거부가 곧 그라운딩입니다.</p>`
      : `<div class="result pass"><b>전 항목 통과.</b> 이 트리플들은 RiC-O 제약을 만족합니다.</div>`}
  <h3 style="margin-top:1.3rem">정답지 대조 — 책 뒤 찾아보기</h3>
  <p style="font-size:.89rem;color:var(--muted);margin:.2rem 0 .7rem">
    『정세균』 총서 편집자가 만든 색인 <b>${D.gold.length}개 표제어</b> 중,
    <b>이 단락 본문에 실제로 등장하는</b> 것을 "뽑았어야 할 개체"로 봅니다.
    사람이 큐레이션한 목록이라 정답지로 쓸 수 있습니다.</p>
  <div class="metrics">
    <div class="metric"><div class="v">${goldOnPage.length}</div><div class="k">이 단락 정답 표제어</div></div>
    <div class="metric"><div class="v" style="color:var(--ok)">${goldOnPage.length - missed.length}</div><div class="k">찾아냄</div></div>
    <div class="metric"><div class="v" style="color:var(--bad)">${missed.length}</div><div class="k">놓침</div></div>
  </div>
  ${goldOnPage.length ? `<div class="result ${missed.length ? 'warn' : 'pass'}">
    ${missed.length ? `<b>놓친 표제어:</b> ${missed.map(esc).join(', ')}` : '<b>이 쪽 색인 표제어를 모두 찾았습니다.</b>'}</div>
    <p class="note">재현율 <b>${Math.round((goldOnPage.length - missed.length) / goldOnPage.length * 100)}%</b>.
    LLM은 빠르지만 완전하지 않습니다. 이 숫자가 ③단계 검증이 필요한 이유입니다.</p>`
      : `<p style="font-size:.87rem;color:var(--muted)">이 쪽에 걸린 색인 표제어가 없습니다. 다른 단락을 시도해 보세요.</p>`}
  <div style="margin-top:1rem">
    <button class="btn" onclick="WB.step=2;renderWB();window.scrollTo({top:400,behavior:'smooth'})">← ② 추출로 회귀</button>
    <button class="btn primary" onclick="goOutput(this)" style="margin-left:.4rem">⑦ 산출 →</button>
  </div></div>`;
}

/* ⑦ 산출 */
function idOf(n) {
  const a = D.authority.find(x => x.name === n);
  // Turtle 로컬 네임에 '/'는 쓸 수 없다(PN_LOCAL 규칙) → 하이픈으로
  if (a) return 'ric:' + a.id.replace(/\//g, '-');
  return 'ric:local-' + n.replace(/[^가-힣A-Za-z0-9]/g, '');
}
const TTL_HEAD = `@prefix rico: <https://www.ica.org/standards/RiC/ontology#> .
@prefix ric:  <http://archives.nanet.go.kr/id/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .`;

/* 한 단락의 본문 블록 (머리말 제외) — 누적본을 만들 때 그대로 이어 붙인다 */
function ttlBody(para, ents, triples) {
  const anchor = t => t.page ? `   # ${anchorText(t.page)}` : '';
  return `# 출처: ${srcLabel(para)}\n` +
    ents.filter(e => e.cls).map(e =>
      `${idOf(e.surface)}\n    a rico:${e.cls} ;\n    rico:name "${e.surface}" .`).join('\n\n') +
    '\n\n' + triples.map(t => `${idOf(t.s)}  rico:${t.p}  ${idOf(t.o)} .${anchor(t)}`).join('\n');
}
/* ⑦까지 온 단락을 세션에 쌓아 둔다 — 여러 파일을 따로 받지 않아도 되게 */
const DONE = new Map();
const doneStats = () => {
  let n = 0; for (const v of DONE.values()) n += v.triples.length;
  return { paras: DONE.size, triples: n };
};
function mergedTTL() {
  const blocks = [...DONE.values()].map(v => ttlBody(v.para, v.ents, v.triples));
  return `${TTL_HEAD}\n\n# 2026 국회기록원 그라운딩 워크벤치 — 단락 ${DONE.size}개를 합친 그래프\n\n${blocks.join('\n\n\n')}`;
}

function stepOutput() {
  const ok = WB.triples.filter(t => t.pass !== false);
  DONE.set(WB.para.id, { para: WB.para, ents: WB.ents.filter(e => e.cls), triples: ok });
  const st = doneStats();
  const ttl = `${TTL_HEAD}\n\n${ttlBody(WB.para, WB.ents, ok)}`;
  return `<div class="wb"><div class="wbhead"><span class="no">⑦</span><h3>산출</h3>
    <span class="hint">검증 통과분만 내보냅니다</span></div>
  <pre id="ttl">${esc(ttl)}</pre>
  <button class="btn sm" onclick="dl()">이 단락만 내려받기</button>
  <button class="btn sm ${st.paras > 1 ? 'primary' : ''}" onclick="dlAll()" style="margin-left:.4rem"
    ${st.paras < 2 ? 'disabled title="단락을 둘 이상 마치면 켜집니다"' : ''}>
    지금까지 전부 한 파일로 (${st.paras}단락 · 트리플 ${st.triples})</button>
  <button class="btn sm" id="copyBtn" onclick="copyTTL(this)" style="margin-left:.4rem">복사</button>
  <button class="btn sm" onclick="toggleHelp('dlHelp',this)" aria-expanded="false"
    title="이 파일이 무엇인지" style="margin-left:.4rem">? 이 파일이 뭔가요</button>
  ${st.paras > 1 ? `<p class="note" style="margin-top:.7rem">단락을 마칠 때마다 여기에 쌓입니다.
    <b>파일을 여러 개 받을 필요 없이</b>, 마지막에 “전부 한 파일로”를 한 번만 누르면 됩니다.
    (①에서 다른 단락으로 옮겨도 지금까지 만든 것은 남아 있습니다. 새로고침하면 사라집니다.)</p>` : ''}
  <div class="helpbox" id="dlHelp" hidden>
    <p><b>무엇인가</b> — 방금 만든 트리플을 <b>Turtle</b>이라는 형식으로 적은 것입니다.
      ⑥ 검증을 통과한 것만 들어가고 실패한 트리플은 빠집니다.
      파일 이름은 <code>${esc(WB.para.id)}-graph.ttl</code>.</p>
    <p><b>.ttl 은 그냥 텍스트 파일입니다</b> — 확장자만 <code>.ttl</code>일 뿐,
      안에 든 것은 위 상자에 보이는 글자 그대로입니다.
      <b>메모장·VS Code 등 아무 텍스트 편집기로 열립니다.</b>
      전용 프로그램은 필요 없습니다. (윈도우에서 더블클릭했을 때 “연결 프로그램 없음”이 뜨면,
      마우스 오른쪽 → <i>연결 프로그램</i> → 메모장을 고르면 됩니다.)</p>
    <p><b>꼭 받아야 하나요</b> — <b>아닙니다.</b> 스타터킷은 팀마다 자기 <code>data/graph.ttl</code>을
      새로 만들기 때문에, 이 파일이 없어도 이후 실습은 그대로 진행됩니다.</p>
    <p><b>받아 두면 좋은 경우</b> — ① 여기서 만든 것을 스타터킷의 자기 그래프에 붙여 보고 싶을 때 ·
      ② 기관에 가져가 Omeka S나 트리플스토어에 넣어 볼 때 ·
      ③ 나중에 열어 “내가 만든 게 이렇게 생겼구나”를 다시 볼 때.</p>
    <p><b>어디에 넣나</b> — 트리플스토어(Fuseki·Oxigraph 등)에는 그대로 적재됩니다.
      Omeka S에서는 <i>어휘 가져오기</i>가 아니라 <i>아이템 가져오기</i> 쪽입니다 —
      어휘는 11장의 <code>rico-oral-profile.rdf</code>가 맡고, 이 파일은 <b>데이터</b>입니다.</p>
  </div>
  <div class="result pass" style="margin-top:1rem"><b>여기까지가 프로세스 ①②③입니다.</b>
  수집·전처리 → 온톨로지 정의 → 추출·그라운딩·검증.
  <b>3부에서 이 파일을 그대로 올려</b> 연표·관계망·SPARQL로 봅니다 — 내려받지 않아도 됩니다.
  <button class="btn sm primary" onclick="showView(3)" style="margin-left:.5rem">3부로 →</button></div></div>`;
}
function toggleHelp(id, btn) {
  const el = $('#' + id); el.hidden = !el.hidden;
  btn.setAttribute('aria-expanded', !el.hidden);
}
async function copyTTL(btn) {
  const txt = $('#ttl').textContent;
  const flash = (msg, ok) => {
    btn.textContent = msg; btn.classList.toggle('okflash', ok);
    setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('okflash'); }, 1800);
  };
  try {
    await navigator.clipboard.writeText(txt);
    flash('✓ 복사했습니다', true);
  } catch (e) {
    // https·localhost 가 아니면 클립보드 API가 막힌다 — 옛 방식으로 한 번 더
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    flash(ok ? '✓ 복사했습니다' : '복사 실패 — 위 상자를 직접 선택하세요', !!ok);
  }
}
function saveText(text, name, type = 'text/turtle;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dl() { saveText($('#ttl').textContent, `${WB.para.id}-graph.ttl`); }
window.dlAll = () => saveText(mergedTTL(), `workbench-graph-${DONE.size}단락.ttl`);

/* ══════════ 시작 ══════════ */
applyHash();
