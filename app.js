/* 온톨로지와 RiC-O — 구술기록으로 배우기
   1부 개념카드 10장 + 2부 그라운딩 워크벤치 */
const D = window.NARA;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clsPill = c => `<span class="pill c-${c}">rico:${c}</span>`;

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

const CARDS = [
  {
    n: 1, tag: '엔티티 · 클래스 · 인스턴스', kicker: 'RDF Schema',
    body: `
<div class="defbox"><b>클래스(Class)</b>는 개체들의 범주이고, <b>인스턴스(Instance)</b>는 그 범주에 속하는 개별 개체다.
어떤 개체가 어떤 클래스에 속하는지는 <code>rdf:type</code>으로 밝힌다.
<span class="src">W3C, <i>RDF Schema 1.1</i>, §2.1</span></div>
<p>기록학에서 "인물"이라는 서가 이름표가 클래스라면, 그 서가에 꽂힌 낱낱의 인물 카드가 인스턴스입니다.
컴퓨터는 "정세균"이라는 글자만 봐서는 그게 사람인지 지명인지 모릅니다. <b>클래스를 붙이는 순간 기계가 다룰 수 있는 개체가 됩니다.</b></p>
<div class="ex"><div class="lbl">구술 원문</div>
<div class="quote">"제가 고대 총학생회장을 한 데다가 …"</div>
<div class="cite">정세균 구술, 1차 구술, 46쪽</div></div>
<div class="scroll"><table>
<tr><th>표층 문자열</th><th>클래스</th><th>왜</th></tr>
<tr><td>정세균</td><td>${clsPill('Person')}</td><td>개인</td></tr>
<tr><td>고려대학교</td><td>${clsPill('CorporateBody')}</td><td>조직·기관</td></tr>
<tr><td>총학생회장</td><td>${clsPill('Position')}</td><td>사람이 점유하는 자리</td></tr>
<tr><td>한보사태</td><td>${clsPill('Event')}</td><td>특정 시점의 일</td></tr>
</table></div>
<p class="note">RiC-O Core는 클래스 12개만 씁니다. 원본 RiC-O 1.1에는 110개가 있지만, 구술기록에 실제로 필요한 것만 추린 부분집합입니다.</p>`
  },
  {
    n: 2, tag: '속성과 리터럴', kicker: 'RDF 1.1',
    body: `
<div class="defbox"><b>속성(Property)</b>은 개체를 다른 개체 또는 값에 잇는 관계다.
값이 문자·숫자·날짜 같은 <b>리터럴(Literal)</b>이면 데이터 속성, 값이 또 다른 개체이면 객체 속성이다.
<span class="src">W3C, <i>RDF 1.1 Concepts and Abstract Syntax</i>, §3.3–3.5</span></div>
<p>이 구분이 실무를 가릅니다. <b>리터럴은 검색은 되지만 따라갈 수 없고, 개체는 따라갈 수 있습니다.</b>
소속 정당을 글자로 적으면 "새정치국민회의"를 검색할 수는 있어도, 그 정당의 다른 소속 의원으로 건너뛸 수는 없습니다.</p>
<div class="ex"><div class="lbl">같은 사실, 두 가지 적기</div>
<p style="margin:.3rem 0"><b>리터럴로</b> — <code>정세균 rico:name "정세균"</code> · <code>정세균 rico:birthDate "1950"</code></p>
<p style="margin:.3rem 0"><b>개체로</b> — ${tripleSVG('정세균', 'Person', 'isOrWasMemberOf', '새정치국민회의', 'CorporateBody')}</p></div>
<p class="note">판단 기준 하나 — <b>"이걸 클릭해서 다른 데로 가고 싶은가?"</b> 그렇다면 개체로, 아니면 리터럴로.</p>`
  },
  {
    n: 3, tag: '트리플과 지식그래프', kicker: 'RDF 1.1',
    body: `
<div class="defbox"><b>트리플(Triple)</b>은 주어(Subject)–서술어(Predicate)–목적어(Object) 세 칸으로 이루어진
RDF의 최소 진술 단위다. 트리플의 집합이 <b>그래프(Graph)</b>를 이룬다.
<span class="src">W3C, <i>RDF 1.1 Concepts and Abstract Syntax</i>, §3</span></div>
<p>점 두 개를 선 하나로 잇는 것, 그게 전부입니다. 그런데 이 단순한 형식이 <b>표로는 못 하던 질문</b>을 가능하게 합니다.</p>
${tripleSVG('정세균', 'Person', 'isOrWasParticipantIn', '한보사태', 'Event')}
${tripleSVG('정세균', 'Person', 'isOrWasMemberOf', '새정치국민회의', 'CorporateBody')}
${tripleSVG('정세균 1차 구술', 'Record', 'hasOrHadSubject', '한보사태', 'Event')}
<p>세 줄을 쌓으면 이미 그래프입니다. 그리고 이제 이렇게 물을 수 있습니다 —
<b>"한보사태를 언급한 구술기록에 등장하는 인물 중, 새정치국민회의 소속은 누구인가?"</b>
엑셀 표로는 조인을 몇 번 해야 하지만, 그래프에서는 선을 따라가면 됩니다.</p>
<p class="note">엑셀 한 행이 한 개체라면, 트리플 한 줄은 한 개의 <i>사실</i>입니다. 단위가 더 작기 때문에 더 자유롭게 조립됩니다.</p>`
  },
  {
    n: 4, tag: 'URI와 식별자', kicker: 'RFC 3986 · Linked Data',
    body: `
<div class="defbox">RDF에서 개체와 속성은 <b>IRI(International Resource Identifier)</b>로 식별된다.
같은 IRI는 언제 어디서나 같은 것을 가리킨다.
<span class="src">W3C, <i>RDF 1.1 Concepts</i>, §3.2 · IETF RFC 3986</span></div>
<p>왜 "정세균"이라고 쓰면 안 되는가 — <b>동명이인</b> 때문입니다. 그리고 <b>표기 흔들림</b> 때문입니다.
정세균/丁世均/JEONG Sye-kyun은 같은 사람이고, 김영삼과 김영삼(다른 사람)은 다른 사람입니다.
글자는 이 둘을 구별하지 못하지만 식별자는 구별합니다.</p>
<div class="ex"><div class="lbl">이름 대신 식별자를</div>
<pre>ric:agent/jeong-sye-kyun   rico:name  "정세균" ;
                           rico:name  "丁世均" ;
                           rico:birthDate "1950" .</pre>
<p style="margin:.4rem 0 0;font-size:.87rem">표기는 여러 개, 식별자는 하나. <b>전거레코드가 하는 일이 정확히 이것입니다.</b></p></div>
<p class="note">외부와 잇고 싶다면 <code>owl:sameAs</code>로 위키데이터·VIAF의 IRI에 연결합니다. 그러면 내 데이터가 세계 데이터의 일부가 됩니다.</p>`
  },
  {
    n: 5, tag: '도메인과 레인지', kicker: 'RDF Schema · 이 강의의 핵심',
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
<p>사람이 읽으면 그럴듯합니다. "정세균이 국회에 있었다", 맞는 말 같죠.
그러나 온톨로지는 <b>거부합니다.</b> 정세균이 점유한 것은 국회가 아니라 <i>국회의장이라는 직위</i>이기 때문입니다.</p>
<div class="trow" style="border-color:var(--ok)"><span>정세균</span><span class="p">occupiesOrOccupied</span>
<span>제20대 전반기 국회의장</span><span class="pg">✓ 통과</span></div>
<p class="note">2부 워크벤치 ⑤단계에서 이걸 직접 겪습니다. 주어를 고르면 서술어 목록이 줄고, 목적어를 잘못 고르면 빨간불이 켜집니다.</p>`
  },
  {
    n: 6, tag: 'RDF · RDFS · OWL 3층', kicker: 'W3C 표준 스택',
    body: `
<div class="defbox"><b>RDF</b>는 트리플로 사실을 표현하고, <b>RDFS</b>는 클래스·속성의 어휘와 계층을 정의하며,
<b>OWL</b>은 그 위에 제약과 추론 규칙을 얹는다.
<span class="src">W3C, <i>RDF 1.1</i> · <i>RDF Schema 1.1</i> · <i>OWL 2 Primer</i></span></div>
<div class="scroll"><table>
<tr><th>층</th><th>하는 일</th><th>이 강의의 예</th></tr>
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
    n: 7, tag: '전거레코드', kicker: 'ISAAR(CPF) → RiC-O',
    body: `
<div class="defbox"><b>전거레코드(Authority Record)</b>는 기록의 생산자인 개인·가문·단체의
이름을 표준화하고 그 맥락(이력·기능·관계)을 기술한 레코드다.
<span class="src">ICA, <i>ISAAR(CPF)</i> 2nd ed. — RiC-O에서는 <code>rico:Agent</code>와 그 하위 클래스로 구현</span></div>
<p>전거는 <b>이름 목록이 아닙니다.</b> 이름을 하나로 고정하는 건 시작일 뿐이고,
본체는 <b>그 행위자가 언제 무엇이었는가</b>입니다.</p>
<h3>이 강의의 핵심 3-홉</h3>
${tripleSVG('정세균', 'Person', 'occupiesOrOccupied', '제20대 전반기 국회의장', 'Position')}
${tripleSVG('제20대 전반기 국회의장', 'Position', 'existsOrExistedIn', '대한민국 국회', 'CorporateBody')}
<p><b>왜 정세균을 국회에 바로 잇지 않는가?</b></p>
<ul>
<li>정세균은 제15~20대 국회의원이자 제20대 전반기 국회의장이었습니다. 국회와의 관계가 하나가 아닙니다.</li>
<li>직위를 거치면 <b>어떤 자격으로, 언제부터 언제까지</b>가 데이터에 남습니다. (<code>beginningDate 2016-06-09</code> · <code>endDate 2018-05-29</code>)</li>
<li>국회의장이라는 직위는 정세균 이전에도 이후에도 존재합니다. 직위를 독립 개체로 두면 <b>역대 의장단 계보가 저절로 만들어집니다.</b></li>
</ul>
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
    n: 8, tag: '전거 ≠ 분류 ≠ 시소러스', kicker: 'SKOS와의 경계',
    body: `
<div class="defbox"><b>SKOS</b>는 시소러스·분류체계·주제명표목 같은 <b>지식조직체계(KOS)</b>를 표현하기 위한 표준이며,
그 최소 단위는 <code>skos:Concept</code>이다.
<span class="src">W3C, <i>SKOS Reference</i>, §2</span></div>
<p>현장에서 가장 자주 뒤섞이는 셋입니다. 결정적 차이는 <b>"그것이 실재하는 것인가, 개념인가"</b>입니다.</p>
<div class="scroll"><table>
<tr><th></th><th>전거레코드</th><th>분류체계</th><th>시소러스</th></tr>
<tr><td><b>대상</b></td><td>실재하는 행위자<br>(사람·단체·직위)</td><td>기록을 나누는 칸</td><td>주제를 가리키는 말</td></tr>
<tr><td><b>표준</b></td><td>ISAAR(CPF) / RiC-O</td><td>기관 분류표</td><td>SKOS</td></tr>
<tr><td><b>클래스</b></td><td>${clsPill('Agent')}</td><td>(기관 고유)</td><td><span class="pill c-Date">skos:Concept</span></td></tr>
<tr><td><b>예</b></td><td>정세균 (1950~ )</td><td>총무-인사-01</td><td>"의회정치"</td></tr>
<tr><td><b>물으면</b></td><td>이 사람 누구인가</td><td>이 기록 어디 넣나</td><td>이 주제 뭐라 부르나</td></tr>
</table></div>
<p><b>구별 시험</b> — "그것이 태어나고 죽는가?" 태어나고 죽으면 전거(행위자)입니다.
"의회정치"는 태어나지 않습니다. 개념이고, SKOS의 몫입니다.</p>
<p class="note">RiC-O는 행위자와 기록의 맥락을 다루고, SKOS는 주제어를 다룹니다. 둘은 경쟁하지 않고 <b>같이 씁니다</b> —
<code>rico:hasOrHadSubject</code>의 목적어로 <code>skos:Concept</code>을 쓰는 식입니다.</p>`
  },
  {
    n: 9, tag: 'RiC-CM과 RiC-O', kicker: 'ICA EGAD',
    body: `
<div class="defbox"><b>RiC-CM</b>(Conceptual Model)은 기록과 그 맥락을 기술하기 위한 개념모델이고,
<b>RiC-O</b>(Ontology)는 그 개념모델을 OWL로 구현한 것이다.
<span class="src">ICA EGAD, <i>RiC-CM 1.0</i>(2023-11-30) · <i>RiC-O 1.1</i>(2025-05-22)</span></div>
<p>ISAD(G)는 하나의 기록을 <b>하나의 계층</b>에 넣었습니다. 퐁-시리즈-철-건. 나무 구조입니다.
그런데 실제 기록은 여러 맥락에 동시에 속합니다. 정세균 구술은 <i>국회의장단 구술총서</i>이자
<i>정세균 개인기록</i>이자 <i>2018년 채록 사업</i>의 산출물입니다. 나무로는 한 자리밖에 못 줍니다.</p>
<p><b>RiC은 나무를 그물로 바꿉니다.</b> 계층은 여러 관계 중 하나(<code>isOrWasIncludedIn</code>)로 격하되고, 나머지 맥락도 동등하게 표현됩니다.</p>
<div class="scroll"><table>
<tr><th></th><th>RiC-CM</th><th>RiC-O</th></tr>
<tr><td>성격</td><td>개념모델 (사람이 읽는 문서)</td><td>OWL 온톨로지 (기계가 읽는 파일)</td></tr>
<tr><td>내용</td><td>엔티티·속성·관계의 논리적 정의</td><td>네임스페이스·클래스·속성의 실제 구현</td></tr>
<tr><td>규모</td><td>엔티티 22종</td><td><b>클래스 110 · 속성 561</b></td></tr>
<tr><td>쓰임</td><td>설계할 때 읽는다</td><td>Omeka·트리플스토어에 넣는다</td></tr>
</table></div>
<p><b>561개 속성.</b> 이게 RiC-O를 처음 만나면 압도당하는 이유입니다.
그래서 이 강의는 구술기록에 필요한 <b>12클래스 · 30속성</b>만 추린 부분집합을 씁니다.
네임스페이스와 이름은 원본 그대로라, 이걸로 만든 데이터는 <b>완전한 RiC-O 데이터로 유효합니다.</b></p>
<p class="note">축약은 표준의 변형이 아니라 <b>부분집합</b>입니다. 나중에 Full로 넓혀도 기존 데이터는 한 줄도 고칠 필요가 없습니다.</p>`
  },
  {
    n: 10, tag: 'SPARQL', kicker: 'W3C SPARQL 1.1',
    body: `
<div class="defbox"><b>SPARQL</b>은 RDF 그래프에 대한 질의 언어다. 질의는 <b>그래프 패턴</b>으로 표현되며,
데이터에서 그 패턴에 맞는 부분을 찾아 변수에 바인딩한다.
<span class="src">W3C, <i>SPARQL 1.1 Query Language</i>, §2</span></div>
<p>SQL이 표를 다룬다면 SPARQL은 그래프를 다룹니다. 문법의 핵심은 하나 —
<b>찾고 싶은 모양을 트리플로 그리고, 모르는 자리에 <code>?변수</code>를 놓는다.</b></p>
<div class="ex"><div class="lbl">질문: 한보사태를 다룬 구술기록은?</div>
<pre>PREFIX rico: &lt;https://www.ica.org/standards/RiC/ontology#&gt;

SELECT ?record ?title WHERE {
  ?record  rico:hasOrHadSubject  ric:event/hanbo ;
           rico:title            ?title .
}</pre></div>
<div class="ex"><div class="lbl">질문: 역대 국회의장을 재임 순으로</div>
<pre>SELECT ?name ?start WHERE {
  ?person  rico:occupiesOrOccupied  ?pos ;
           rico:name                ?name .
  ?pos     rico:existsOrExistedIn   ric:org/national-assembly ;
           rico:beginningDate       ?start .
}
ORDER BY ?start</pre>
<p style="margin:.4rem 0 0;font-size:.87rem">7장의 3-홉을 그대로 질의로 옮긴 것입니다. <b>설계가 곧 질의</b>입니다.</p></div>
<p class="note">오후 실습에서는 브라우저 안에서 도는 진짜 SPARQL 엔진(Oxigraph WASM)으로 이 질의를 실행합니다.
그리고 자연어 질문을 SPARQL로 바꾸는 일은 LLM에게 시킵니다 — 우리는 <b>어떤 모양을 찾을지</b>만 알면 됩니다.</p>`
  },
];

let curCard = 0;
const seen = new Set([0]);

function renderCardNav() {
  $('#cardnav').innerHTML = CARDS.map((c, i) =>
    `<button class="chip ${seen.has(i) ? 'done' : ''}" aria-current="${i === curCard}"
       onclick="setCard(${i})"><span class="n">${c.n}</span>${esc(c.tag)}</button>`).join('');
}
function renderCard() {
  const c = CARDS[curCard];
  $('#cardhost').innerHTML =
    `<article class="card"><div class="kicker">${esc(c.kicker)}</div>
     <h2>${c.n}. ${esc(c.tag)}</h2>${c.body}</article>`;
  $('#prevC').disabled = curCard === 0;
  $('#nextC').textContent = curCard === CARDS.length - 1 ? '2부 워크벤치로 →' : '다음 →';
  if (curCard === 6) {   // 7장: 전거 통계 주입
    $('#authN').textContent = D.authority.length + '명';
    $('#posN').textContent = D.authority.reduce((a, p) => a + p.positions.length, 0) + '건';
  }
  renderCardNav(); updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setCard(i) { curCard = i; seen.add(i); renderCard(); }
function goCard(d) {
  if (d > 0 && curCard === CARDS.length - 1) { showView(2); return; }
  setCard(Math.max(0, Math.min(CARDS.length - 1, curCard + d)));
}
function updateProgress() {
  $('#progbar').style.width = (seen.size / CARDS.length * 100) + '%';
}

/* ══════════ 뷰 전환 ══════════ */
function showView(n) {
  $('#view1').classList.toggle('on', n === 1);
  $('#view2').classList.toggle('on', n === 2);
  $('#tab1').setAttribute('aria-selected', n === 1);
  $('#tab2').setAttribute('aria-selected', n === 2);
  if (n === 2) renderWB();
  window.scrollTo({ top: 0 });
}

/* ══════════ 2부 · 워크벤치 ══════════ */
const WB = { step: 1, para: null, ents: [], triples: [], validated: null, source: null };
const STEP_NAMES = ['원문 투입', '개체 추출', '클래스 배정', '전거 매핑', '트리플 잇기', '검증', '산출'];

const findProp = t => D.objectProps.find(p => p.t === t);
const authorityNames = () => new Set(D.authority.map(a => a.name));

function renderSteps() {
  $('#steps').innerHTML = STEP_NAMES.map((s, i) =>
    `<span class="step ${WB.step === i + 1 ? 'on' : ''} ${WB.step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</span>`).join('');
}

function renderWB() {
  renderSteps();
  const h = [];
  h.push(stepSource());
  if (WB.para) h.push(stepExtract());
  if (WB.ents.length) h.push(stepClass());
  if (WB.ents.length) h.push(stepAuthority());
  if (WB.ents.filter(e => e.cls).length >= 2) h.push(stepTriples());
  if (WB.triples.length) h.push(stepValidate());
  if (WB.validated) h.push(stepOutput());
  $('#wbhost').innerHTML = h.join('');
}

/* ① 원문 */
function stepSource() {
  return `<div class="wb"><div class="wbhead"><span class="no">①</span><h3>원문 투입</h3>
    <span class="hint">정세균 구술 8단락 중 하나를 고르세요</span></div>
  <div class="parapick">${D.paragraphs.map(p =>
    `<button aria-pressed="${WB.para?.id === p.id}" onclick="pickPara('${p.id}')">
      ${esc(p.title)}<span class="src">${esc(p.source)}${D.precomputed[p.id] ? ' · AI추출 준비됨' : ''}</span></button>`).join('')}</div>
  ${WB.para ? `<div class="ex" style="margin-top:1rem"><div class="lbl">원문 — ${esc(WB.para.source)}</div>
    <div id="srcText">${highlight(WB.para.text)}</div></div>` : ''}</div>`;
}
function pickPara(id) {
  WB.para = D.paragraphs.find(p => p.id === id);
  WB.ents = []; WB.triples = []; WB.validated = null; WB.step = 2;
  renderWB();
}
function highlight(t) {
  return WB.ents.length
    ? WB.ents.reduce((s, e) => s.split(e.surface).join(`<mark>${esc(e.surface)}</mark>`), esc(t))
    : esc(t);
}

/* ② 추출 */
function stepExtract() {
  const pre = D.precomputed[WB.para.id];
  return `<div class="wb"><div class="wbhead"><span class="no">②</span><h3>개체 추출</h3>
    <span class="hint">손으로 먼저, 그다음 AI와 비교</span></div>
  <p style="font-size:.9rem;color:var(--muted);margin:.2rem 0 .8rem">
    위 원문에서 <b>실제로 존재하는 것</b>에 해당하는 부분을 드래그하고 아래 버튼을 누르세요.
    손으로 해봐야 AI가 무슨 일을 하는지 알 수 있습니다.</p>
  <button class="btn sm" onclick="addSelection()">＋ 선택한 부분을 개체로</button>
  ${pre ? `<button class="btn sm" onclick="loadAI()" style="margin-left:.4rem">AI 추출 결과 불러오기</button>` : ''}
  <button class="btn sm" onclick="WB.ents=[];WB.triples=[];WB.validated=null;renderWB()" style="margin-left:.4rem">비우기</button>
  ${pre ? `<p class="note" style="margin-top:.7rem">AI 결과는 <b>사전 계산본</b>입니다(API 키 불필요).
    Claude가 이 단락을 읽고 뽑은 실제 결과이며, <b>틀린 항목이 섞여 있습니다.</b> ⑥에서 걸러집니다.</p>` : ''}
  <div class="entlist" id="entlist">${WB.ents.map((e, i) => entChip(e, i)).join('')}</div>
  <p style="font-size:.85rem;color:var(--muted)">현재 ${WB.ents.length}개</p></div>`;
}
function entChip(e, i) {
  const mapped = authorityNames().has(e.surface);
  const st = e.cls ? (e.cls === 'Person' ? (mapped ? 'mapped' : 'unmapped') : '') : '';
  return `<span class="ent ${st}"><b>${esc(e.surface)}</b>
    <select onchange="setCls(${i},this.value)">
      <option value="">클래스…</option>
      ${D.classes.map(c => `<option value="${c.t}" ${e.cls === c.t ? 'selected' : ''}>${c.ko} · ${c.t}</option>`).join('')}
    </select><button class="x" onclick="delEnt(${i})">×</button></span>`;
}
function addSelection() {
  const s = String(window.getSelection()).trim();
  if (!s || s.length > 30) { alert('원문에서 30자 이내로 드래그한 뒤 눌러 주세요.'); return; }
  if (!WB.ents.some(e => e.surface === s)) WB.ents.push({ surface: s, cls: '' });
  WB.step = 3; renderWB();
}
function loadAI() {
  const pre = D.precomputed[WB.para.id];
  WB.ents = pre.entities.map(e => ({ surface: e.surface, cls: e.cls, ai: true, ok: e.ok, why: e.why }));
  WB.triples = pre.triples.map(t => ({ ...t, ai: true }));
  WB.step = 5; renderWB();
}
function setCls(i, v) { WB.ents[i].cls = v; renderWB(); }
function delEnt(i) { WB.ents.splice(i, 1); renderWB(); }

/* ③ 클래스 */
function stepClass() {
  const done = WB.ents.filter(e => e.cls).length;
  return `<div class="wb"><div class="wbhead"><span class="no">③</span><h3>클래스 배정</h3>
    <span class="hint">${done}/${WB.ents.length} 배정됨</span></div>
  <p style="font-size:.9rem;color:var(--muted);margin:.2rem 0 .6rem">
    각 개체 옆 드롭다운에서 RiC-O 클래스를 고르세요. <b>선택지는 12개뿐입니다</b> — 원본 110개가 아니라
    구술기록용으로 추린 Core입니다.</p>
  <div class="scroll"><table><tr><th>클래스</th><th>뜻</th><th>이 단락의 예</th></tr>
  ${D.classes.map(c => `<tr><td>${clsPill(c.t)}</td><td>${esc(c.ko)}</td>
    <td style="color:var(--muted);font-size:.85rem">${esc(WB.ents.filter(e => e.cls === c.t).map(e => e.surface).join(', ') || c.ex)}</td></tr>`).join('')}
  </table></div></div>`;
}

/* ④ 전거 매핑 */
function stepAuthority() {
  const persons = WB.ents.filter(e => e.cls === 'Person');
  const names = authorityNames();
  const hit = persons.filter(p => names.has(p.surface));
  const miss = persons.filter(p => !names.has(p.surface));
  return `<div class="wb"><div class="wbhead"><span class="no">④</span><h3>전거 매핑</h3>
    <span class="hint">역대 국회의장단 ${D.authority.length}명 대조</span></div>
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
      <b>${esc(p.surface)}</b><span style="font-size:.82rem">전거 마스터에 없음 → <b>신규 후보</b>로 격리</span></div>`).join('')}
  <p class="note">매칭되지 않은 이름은 <b>버리지 않고 격리</b>합니다. 동명이인·오탈자·실제 신규 인물이 여기 섞여 있고,
  이 판단은 사람이 해야 합니다. 자동화가 멈추고 아키비스트가 개입하는 지점입니다.</p>`}</div>`;
}

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
    <select ${!pDef ? 'disabled' : ''} onchange="TB.o=this.value;renderWB()">
      <option value="">${pDef ? '개체 선택…' : '먼저 서술어를'}</option>
      ${objs.map(e => `<option value="${esc(e.surface)}" ${TB.o === e.surface ? 'selected' : ''}>${esc(e.surface)} (${e.cls})</option>`).join('')}
    </select></div>
    <div><button class="btn primary" ${!(TB.s && TB.p && TB.o) ? 'disabled' : ''} onclick="addTriple()">추가</button></div>
  </div>
  ${sCls ? `<p class="rangehint">주어가 <b>${sCls}</b>라서 561개 중 <b>${allowed.length}개</b>만 남았습니다.
    ${pDef ? `그리고 <code>${pDef.t}</code>의 레인지는 <b>${pDef.r.slice(0, 4).join(' · ')}</b>이므로,
    이 단락의 개체 중 <b>${objs.length}개</b>만 목적어가 될 수 있습니다.` : ''}</p>` :
      `<p class="rangehint">주어를 고르면 그 클래스를 <code>rdfs:domain</code>으로 갖는 속성만 남습니다.</p>`}
  <div class="tlist">${WB.triples.map((t, i) => trow(t, i)).join('') || '<p style="font-size:.87rem;color:var(--muted)">아직 트리플이 없습니다.</p>'}</div>
  ${WB.triples.length ? `<button class="btn primary" onclick="WB.step=6;validate()">⑥ 검증하기 →</button>` : ''}</div>`;
}
function trow(t, i) {
  return `<div class="trow ${t.checked && !t.pass ? 'err' : ''}">
    <span>${esc(t.s)}</span><span class="p">${t.p}</span><span>${esc(t.o)}</span>
    <span class="pg">${t.page ? t.page + '쪽' : '<b style="color:var(--warn)">출처없음</b>'}</span>
    <button class="x" onclick="WB.triples.splice(${i},1);WB.validated=null;renderWB()">×</button>
    ${t.checked && !t.pass ? `<span class="why">✗ ${esc(t.reason)}</span>` : ''}</div>`;
}
function addTriple() {
  WB.triples.push({ s: TB.s, p: TB.p, o: TB.o, page: WB.para.page });
  TB = { s: '', p: '', o: '' }; WB.validated = null; renderWB();
}

/* ⑥ 검증 6종 */
function validate() {
  const clsOf = n => WB.ents.find(e => e.surface === n)?.cls;
  const names = authorityNames();
  const validCls = new Set(D.classes.map(c => c.t));
  let fails = [];
  WB.triples.forEach(t => {
    const pd = findProp(t.p); const sc = clsOf(t.s); const oc = clsOf(t.o);
    let reason = null;
    if (!pd) reason = `규칙1 클래스·속성 실재 — rico:${t.p} 는 프로파일에 없는 속성`;
    else if (!sc) reason = `규칙1 클래스 미배정 — 주어 "${t.s}"에 클래스가 없어 검증 불가`;
    else if (!oc) reason = `규칙1 클래스 미배정 — 목적어 "${t.o}"에 클래스가 없어 검증 불가`;
    else if (!pd.d.includes(sc)) reason = `규칙2 도메인 위반 — ${t.p}의 주어는 ${pd.d.slice(0, 3).join('·')} 여야 하는데 ${sc}`;
    else if (!pd.r.includes(oc)) reason = `규칙3 레인지 위반 — ${t.p}의 목적어는 ${pd.r.slice(0, 3).join('·')} 여야 하는데 ${oc}`;
    else if (!t.page) reason = `규칙6 출처 앵커 누락 — 쪽수가 없어 검증 불가`;
    t.checked = true; t.pass = !reason; t.reason = reason;
    if (reason) fails.push({ t, reason });
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
      ? `<div class="result fail"><b>검증 실패 ${v.fails.length}건 — ②단계로 회귀해야 합니다.</b>
       <ul style="margin:.5rem 0 0;padding-left:1.1rem">${v.fails.map(f => `<li>${esc(f.reason)}</li>`).join('')}</ul></div>
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
    <button class="btn primary" onclick="WB.step=7;renderWB()" style="margin-left:.4rem">⑦ 산출 →</button>
  </div></div>`;
}

/* ⑦ 산출 */
function idOf(n) {
  const a = D.authority.find(x => x.name === n);
  // Turtle 지역명에 '/'는 쓸 수 없다(PN_LOCAL 규칙) → 하이픈으로
  if (a) return 'ric:' + a.id.replace(/\//g, '-');
  return 'ric:local-' + n.replace(/[^가-힣A-Za-z0-9]/g, '');
}
function stepOutput() {
  const ok = WB.triples.filter(t => t.pass !== false);
  const ttl = `@prefix rico: <https://www.ica.org/standards/RiC/ontology#> .
@prefix ric:  <http://archives.nanet.go.kr/id/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

# 출처: ${WB.para.source}
${WB.ents.filter(e => e.cls).map(e =>
    `${idOf(e.surface)}\n    a rico:${e.cls} ;\n    rico:name "${e.surface}" .`).join('\n\n')}

${ok.map(t => `${idOf(t.s)}  rico:${t.p}  ${idOf(t.o)} .   # ${t.page}쪽`).join('\n')}`;
  return `<div class="wb"><div class="wbhead"><span class="no">⑦</span><h3>산출</h3>
    <span class="hint">검증 통과분만 내보냅니다</span></div>
  <pre id="ttl">${esc(ttl)}</pre>
  <button class="btn sm" onclick="dl()">TTL 내려받기</button>
  <button class="btn sm" onclick="navigator.clipboard.writeText(document.getElementById('ttl').textContent)" style="margin-left:.4rem">복사</button>
  <h3 style="margin-top:1.4rem">이 그래프에 물어볼 수 있는 것</h3>
  <pre>PREFIX rico: &lt;https://www.ica.org/standards/RiC/ontology#&gt;
SELECT ?s ?o WHERE { ?s rico:${ok[0]?.p || 'hasOrHadSubject'} ?o . }</pre>
  <p class="note">여기서는 질의문만 보여 줍니다. <b>실제 SPARQL 실행은 오후 실습</b>에서 —
  브라우저 안에서 도는 Oxigraph WASM 엔진으로 이 TTL을 그대로 질의하고,
  자연어 질문을 SPARQL로 바꾸는 일은 Claude에게 맡깁니다.</p>
  <div class="result pass" style="margin-top:1rem"><b>여기까지가 프로세스 ①②③입니다.</b>
  수집·전처리 → 온톨로지 정의 → 추출·그라운딩·검증. 오후에는 이 위에 ④ 시맨틱 검색을 얹습니다.</div></div>`;
}
function dl() {
  const b = new Blob([$('#ttl').textContent], { type: 'text/turtle' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `${WB.para.id}-graph.ttl`; a.click();
}

/* ══════════ 시작 ══════════ */
renderCard();
