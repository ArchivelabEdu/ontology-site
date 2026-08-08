#!/usr/bin/env python3
"""학습·그라운딩 사이트용 data.js 조립.

입력: _speakers_raw.json (전거 마스터), _index_gold.json (정답지),
      _paras_clean.json (원문 단락), ../01-profile/rico-oral-profile.rdf (어휘)
출력: data.js
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent

# ── 1. 전거 마스터: 인물 단위로 묶기 ────────────────────────────────────────
roster = json.loads((HERE / "_speakers_raw.json").read_text(encoding="utf-8"))
people = {}
for r in roster:
    p = people.setdefault(r["name"], {"name": r["name"], "positions": []})
    p["positions"].append({
        "assembly": r["assembly"], "half": r["half"], "role": r["role"],
        "start": r["start"], "end": r["end"],
    })
authority = sorted(people.values(), key=lambda x: x["name"])
for i, p in enumerate(authority, 1):
    # Turtle 지역명에 '/'는 쓸 수 없다(PN_LOCAL) — 화면 표시와 산출 TTL이 어긋나지 않도록 여기서부터 하이픈
    p["id"] = f"agent-{i:03d}"

gold = json.loads((HERE / "_index_gold.json").read_text(encoding="utf-8"))

# ── 2. 원문 단락 (_paras_clean.json 이 이미 id·제목·출처를 갖고 있음) ────────
paragraphs = json.loads((HERE / "_paras_clean.json").read_text(encoding="utf-8"))
for p in paragraphs:
    # 쪽 넘김으로 앞 음절만 남은 파편 제거 ("땐 학생회…" → "학생회…")
    p["text"] = re.sub(r"^[가-힣]{1}\s+", "", p["text"]).strip()
    p.pop("key", None)

# ── 3. Core 어휘 (프로파일에서 읽어옴) ──────────────────────────────────────
CLASSES = [
    {"t": "RecordSet", "ko": "기록집합", "ex": "국회의장단 구술총서"},
    {"t": "Record", "ko": "기록", "ex": "정세균 1차 구술 녹취문"},
    {"t": "Instantiation", "ko": "구현체", "ex": "구술 영상 MP4"},
    {"t": "Agent", "ko": "행위자", "ex": "(상위 개념)"},
    {"t": "Person", "ko": "인물", "ex": "정세균, 김대중"},
    {"t": "CorporateBody", "ko": "단체", "ex": "대한민국 국회, 새정치국민회의"},
    {"t": "Position", "ko": "직위", "ex": "제20대 전반기 국회의장"},
    {"t": "Activity", "ko": "활동", "ex": "구술기록 아카이브 구축 사업"},
    {"t": "Event", "ko": "사건", "ex": "한보사태, 대통령 탄핵소추"},
    {"t": "Place", "ko": "장소", "ex": "전라북도 진안, 국회의사당"},
    {"t": "Date", "ko": "날짜", "ex": "2016-06-09"},
    {"t": "Rule", "ko": "규칙", "ex": "국회법, 과거사법"},
]

# 도메인·레인지는 RiC-O 1.1 실측값 (build_profile.py 검증 통과분)
PROPS = [
    {"t": "hasCreator", "ko": "생산자", "d": ["Instantiation", "RecordResource", "Record", "RecordSet"], "r": ["Agent", "Person", "CorporateBody", "Position", "Group"]},
    {"t": "hasAuthor", "ko": "저자", "d": ["Record"], "r": ["Group", "Person", "Position", "CorporateBody"]},
    {"t": "hasOrHadSubject", "ko": "주제", "d": ["RecordResource", "Record", "RecordSet"], "r": ["Thing", "Person", "CorporateBody", "Position", "Event", "Place", "Activity", "Rule", "Date", "Agent"]},
    {"t": "isOrWasSubjectOf", "ko": "주제인 기록", "d": ["Thing", "Person", "CorporateBody", "Event", "Place", "Position", "Activity", "Rule"], "r": ["RecordResource", "Record", "RecordSet"]},
    {"t": "occupiesOrOccupied", "ko": "재임 직위", "d": ["Person"], "r": ["Position"]},
    {"t": "isOrWasOccupiedBy", "ko": "재임자", "d": ["Position"], "r": ["Person"]},
    {"t": "hasOrHadPosition", "ko": "소속 직위", "d": ["Group", "CorporateBody"], "r": ["Position"]},
    {"t": "existsOrExistedIn", "ko": "소속 단체", "d": ["Position"], "r": ["Group", "CorporateBody"]},
    {"t": "isOrWasMemberOf", "ko": "소속", "d": ["Person"], "r": ["Group", "CorporateBody"]},
    {"t": "hasOrHadMember", "ko": "구성원", "d": ["Group", "CorporateBody"], "r": ["Person"]},
    {"t": "includesOrIncluded", "ko": "하위 기록", "d": ["RecordSet"], "r": ["Record", "RecordSet"]},
    {"t": "isOrWasIncludedIn", "ko": "상위 기록집합", "d": ["Record", "RecordSet"], "r": ["RecordSet"]},
    {"t": "hasOrHadInstantiation", "ko": "구현체", "d": ["RecordResource", "Record", "RecordSet"], "r": ["Instantiation"]},
    {"t": "isOrWasInstantiationOf", "ko": "원기록", "d": ["Instantiation"], "r": ["RecordResource", "Record", "RecordSet"]},
    {"t": "isOrWasParticipantIn", "ko": "참여 사건", "d": ["Thing", "Person", "CorporateBody", "Position", "Agent"], "r": ["Event", "Activity"]},
    {"t": "hasOrHadParticipant", "ko": "참여자", "d": ["Event", "Activity"], "r": ["Thing", "Person", "CorporateBody", "Position", "Agent"]},
    {"t": "isAssociatedWithPlace", "ko": "관련 장소", "d": ["Thing", "Person", "CorporateBody", "Event", "Record", "Activity"], "r": ["Place"]},
    {"t": "isAssociatedWithDate", "ko": "관련 날짜", "d": ["Thing", "Person", "CorporateBody", "Event", "Record", "Activity"], "r": ["Date"]},
    {"t": "isOrWasRegulatedBy", "ko": "적용 규칙", "d": ["Thing", "Activity", "CorporateBody", "Record"], "r": ["Rule"]},
    {"t": "resultsOrResultedIn", "ko": "결과", "d": ["Event", "Activity"], "r": ["Thing", "Rule", "Record", "Event"]},
]

DATA_PROPS = [
    {"t": "name", "ko": "이름", "d": ["Thing", "Person", "CorporateBody", "Position", "Event", "Place", "Activity", "Rule", "Agent"]},
    {"t": "identifier", "ko": "식별기호", "d": ["Thing", "Person", "CorporateBody", "Position", "Event", "Place", "Record", "RecordSet", "Activity", "Rule"]},
    {"t": "title", "ko": "제목", "d": ["Record", "RecordSet", "RecordResource", "Instantiation", "Rule"]},
    {"t": "scopeAndContent", "ko": "범위와 내용", "d": ["Record", "RecordSet", "RecordResource"]},
    {"t": "history", "ko": "연혁", "d": ["Agent", "Person", "CorporateBody", "Position", "Event", "Instantiation", "Place", "Record", "RecordSet", "Rule"]},
    {"t": "generalDescription", "ko": "일반 설명", "d": ["Thing", "Person", "CorporateBody", "Position", "Event", "Place", "Activity", "Rule"]},
    {"t": "birthDate", "ko": "생년월일", "d": ["Person"]},
    {"t": "deathDate", "ko": "사망일", "d": ["Person"]},
    {"t": "beginningDate", "ko": "시작일", "d": ["Thing", "Person", "CorporateBody", "Position", "Event", "Record", "Activity"]},
    {"t": "endDate", "ko": "종료일", "d": ["Thing", "Person", "CorporateBody", "Position", "Event", "Record", "Activity"]},
]

# ── 4. 사전 계산된 LLM 추출 결과 ────────────────────────────────────────────
# 의도적으로 '그럴듯하지만 틀린' 항목을 섞어 검증 단계가 잡아내도록 설계.
PRECOMPUTED = {
    "p3": {  # 한보사태와 정권교체
        "entities": [
            {"surface": "한보사태", "cls": "Event", "ok": True},
            {"surface": "김대중", "cls": "Person", "ok": True},
            {"surface": "재경위원회", "cls": "CorporateBody", "ok": True},
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "1997년", "cls": "Date", "ok": True},
            {"surface": "신한국당", "cls": "CorporateBody", "ok": True},
            {"surface": "대한민국 국회", "cls": "CorporateBody", "ok": True},
            {"surface": "정권 교체", "cls": "Event", "ok": False,
             "why": "일반명사구를 고유 사건으로 잘못 승격 — 찾아보기에 없음"},
        ],
        "triples": [
            {"s": "정세균", "p": "isOrWasParticipantIn", "o": "한보사태", "page": 67, "ok": True},
            {"s": "정세균", "p": "isOrWasMemberOf", "o": "재경위원회", "page": 67, "ok": True},
            {"s": "정세균", "p": "occupiesOrOccupied", "o": "대한민국 국회", "page": None, "ok": False,
             "why": "레인지 위반 — occupiesOrOccupied의 목적어는 Position이어야 함. 단체를 넣었다"},
            {"s": "김대중", "p": "hasCreator", "o": "정세균", "page": None, "ok": False,
             "why": "도메인 위반 — hasCreator의 주어는 기록이어야 함. 인물을 넣었다"},
        ],
    },
    "p6": {  # 탄핵소추
        "entities": [
            {"surface": "노무현", "cls": "Person", "ok": True},
            {"surface": "박근혜", "cls": "Person", "ok": True},
            {"surface": "탄핵소추", "cls": "Event", "ok": True},
            {"surface": "열린우리당", "cls": "CorporateBody", "ok": True},
            {"surface": "새천년민주당", "cls": "CorporateBody", "ok": True},
            {"surface": "대통합 민주신당", "cls": "CorporateBody", "ok": True},
            {"surface": "김근태", "cls": "Person", "ok": True},
            {"surface": "정세균", "cls": "Person", "ok": True},
        ],
        "triples": [
            {"s": "노무현", "p": "isOrWasParticipantIn", "o": "탄핵소추", "page": 171, "ok": True},
            {"s": "정세균", "p": "isOrWasMemberOf", "o": "열린우리당", "page": 171, "ok": True},
            {"s": "탄핵소추", "p": "hasOrHadParticipant", "o": "노무현", "page": None, "ok": False,
             "why": "출처 앵커 누락 — 쪽수가 없어 검증 불가"},
        ],
    },
    "p1": {  # 대학 시절과 10월유신
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "10월유신", "cls": "Event", "ok": True},
            {"surface": "고려대학교", "cls": "CorporateBody", "ok": True},
            {"surface": "총학생회장", "cls": "Position", "ok": True},
            {"surface": "동학사", "cls": "Place", "ok": True},
            {"surface": "막걸리 대학", "cls": "CorporateBody", "ok": False,
             "why": "별명을 기관명으로 잘못 승격 — 고려대학교를 가리키는 관용 표현일 뿐"},
        ],
        "triples": [
            {"s": "정세균", "p": "occupiesOrOccupied", "o": "총학생회장", "page": 33, "ok": True},
            {"s": "총학생회장", "p": "existsOrExistedIn", "o": "고려대학교", "page": 33, "ok": True},
            {"s": "정세균", "p": "isAssociatedWithPlace", "o": "동학사", "page": 33, "ok": True},
            {"s": "고려대학교", "p": "occupiesOrOccupied", "o": "총학생회장", "page": 33, "ok": False,
             "why": "도메인 위반 — occupiesOrOccupied의 주어는 Person. 직위를 점유하는 것은 단체가 아니라 사람이다"},
            {"s": "정세균", "p": "isOrWasParticipantIn", "o": "10월유신", "page": None, "ok": False,
             "why": "출처 앵커 누락 — 구술자는 시위가 있었다고만 말했고 자신의 참여를 말하지 않았다"},
        ],
    },
    "p2": {  # 정계 입문
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "권노갑", "cls": "Person", "ok": True},
            {"surface": "김대중", "cls": "Person", "ok": True},
            {"surface": "쌍용USA", "cls": "CorporateBody", "ok": True},
            {"surface": "고대", "cls": "CorporateBody", "ok": True},
            {"surface": "총학생회장", "cls": "Position", "ok": True},
            {"surface": "경영 마인드", "cls": "Event", "ok": False,
             "why": "추상 개념을 사건으로 잘못 승격 — 태어나지도 끝나지도 않는다"},
        ],
        "triples": [
            {"s": "정세균", "p": "occupiesOrOccupied", "o": "총학생회장", "page": 46, "ok": True},
            {"s": "총학생회장", "p": "existsOrExistedIn", "o": "고대", "page": 46, "ok": True},
            {"s": "정세균", "p": "isOrWasParticipantIn", "o": "김대중", "page": 46, "ok": False,
             "why": "레인지 위반 — '만났다'를 참여 관계로 옮겼다. 목적어는 Event·Activity라야 한다"},
        ],
    },
    "p4": {  # 노사정위원회
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "노사정위원회", "cls": "CorporateBody", "ok": True},
            {"surface": "김원기", "cls": "Person", "ok": True},
            {"surface": "노사정 대타협", "cls": "Event", "ok": True},
            {"surface": "상무위원장", "cls": "Position", "ok": True},
            {"surface": "간사위원", "cls": "Position", "ok": True},
            {"surface": "재경위", "cls": "CorporateBody", "ok": True},
            {"surface": "고등학교 3학년", "cls": "Date", "ok": False,
             "why": "학년 표현을 날짜 개체로 잘못 승격 — 여기서는 비유일 뿐 시점이 아니다"},
        ],
        "triples": [
            {"s": "정세균", "p": "occupiesOrOccupied", "o": "상무위원장", "page": 80, "ok": True},
            {"s": "정세균", "p": "occupiesOrOccupied", "o": "간사위원", "page": 80, "ok": True},
            {"s": "노사정위원회", "p": "hasOrHadMember", "o": "정세균", "page": 80, "ok": True},
            {"s": "김원기", "p": "occupiesOrOccupied", "o": "노사정위원회", "page": 80, "ok": False,
             "why": "레인지 위반 — 김원기가 점유한 것은 위원장이라는 직위이지 위원회라는 단체가 아니다"},
            {"s": "상무위원장", "p": "existsOrExistedIn", "o": "노사정위원회", "page": None, "ok": False,
             "why": "출처 앵커 누락 — 관계는 맞지만 쪽수가 붙지 않아 검증 불가"},
        ],
    },
    "p5": {  # 과거사법 협상
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "강재섭", "cls": "Person", "ok": True},
            {"surface": "노무현", "cls": "Person", "ok": True},
            {"surface": "한나라당", "cls": "CorporateBody", "ok": True},
            {"surface": "과거사법", "cls": "Rule", "ok": True},
            {"surface": "대통령", "cls": "Position", "ok": True},
            {"surface": "원내대표", "cls": "Position", "ok": True},
            {"surface": "당의장", "cls": "Position", "ok": True},
            {"surface": "2007년", "cls": "Date", "ok": True},
            {"surface": "투 톱", "cls": "Position", "ok": False,
             "why": "체제를 가리키는 비유를 직위로 잘못 승격 — 실제 직위는 원내대표와 당의장이다"},
        ],
        "triples": [
            {"s": "강재섭", "p": "isOrWasMemberOf", "o": "한나라당", "page": 133, "ok": True},
            {"s": "노무현", "p": "occupiesOrOccupied", "o": "대통령", "page": 133, "ok": True},
            {"s": "대통령", "p": "isOrWasOccupiedBy", "o": "노무현", "page": 133, "ok": True},
            {"s": "정세균", "p": "isOrWasRegulatedBy", "o": "과거사법", "page": 133, "ok": False,
             "why": "도메인 위반 — 협상한 사람을 법의 적용 대상으로 이었다. 주어는 사람이 될 수 없다"},
            {"s": "과거사법", "p": "hasOrHadParticipant", "o": "강재섭", "page": 133, "ok": False,
             "why": "도메인 위반 — hasOrHadParticipant의 주어는 Event·Activity. 법은 참여자를 갖지 않는다"},
        ],
    },
    "p7": {  # 특권 내려놓기
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "특권 내려놓기 추진위원회", "cls": "CorporateBody", "ok": True},
            {"surface": "제20대 전반기", "cls": "Date", "ok": True},
            {"surface": "의원동산", "cls": "Place", "ok": True},
            {"surface": "국회동산", "cls": "Place", "ok": True},
            {"surface": "해외 출장", "cls": "Activity", "ok": True},
            {"surface": "특권", "cls": "Rule", "ok": False,
             "why": "일반명사를 규칙 개체로 잘못 승격 — 여기의 '특권'은 특정 법령·지침을 가리키지 않는다"},
        ],
        "triples": [
            {"s": "특권 내려놓기 추진위원회", "p": "isAssociatedWithDate", "o": "제20대 전반기",
             "page": 212, "ok": True},
            {"s": "해외 출장", "p": "isAssociatedWithDate", "o": "제20대 전반기", "page": 212, "ok": True},
            {"s": "특권 내려놓기 추진위원회", "p": "isOrWasRegulatedBy", "o": "해외 출장",
             "page": 212, "ok": False,
             "why": "레인지 위반 — isOrWasRegulatedBy의 목적어는 Rule. 활동을 규칙 자리에 넣었다"},
            {"s": "정세균", "p": "isOrWasMemberOf", "o": "특권 내려놓기 추진위원회",
             "page": None, "ok": False,
             "why": "출처 앵커 누락 — 원문은 위원회를 '통해서' 정리했다고만 했지 소속을 말하지 않았다"},
        ],
    },
    "p8": {  # 청소노동자 정규직 전환
        "entities": [
            {"surface": "정세균", "cls": "Person", "ok": True},
            {"surface": "유일호", "cls": "Person", "ok": True},
            {"surface": "부총리", "cls": "Position", "ok": True},
            {"surface": "예산실장", "cls": "Position", "ok": True},
            {"surface": "국회사무총장", "cls": "Position", "ok": True},
            {"surface": "의장실", "cls": "Place", "ok": True},
            {"surface": "용역업체", "cls": "CorporateBody", "ok": True},
            {"surface": "12월 2일", "cls": "Date", "ok": True},
            {"surface": "고용의 질", "cls": "Activity", "ok": False,
             "why": "추상 개념을 활동으로 잘못 승격 — 누가 수행하는 업무가 아니다"},
        ],
        "triples": [
            {"s": "유일호", "p": "occupiesOrOccupied", "o": "부총리", "page": 230, "ok": True},
            {"s": "정세균", "p": "isAssociatedWithPlace", "o": "의장실", "page": 230, "ok": True},
            {"s": "유일호", "p": "isAssociatedWithPlace", "o": "의장실", "page": 230, "ok": True},
            {"s": "국회사무총장", "p": "occupiesOrOccupied", "o": "정세균", "page": 230, "ok": False,
             "why": "도메인 위반 — 주어와 목적어가 뒤집혔다. 직위가 사람을 점유할 수는 없다"},
            {"s": "예산실장", "p": "isOrWasOccupiedBy", "o": "유일호", "page": None, "ok": False,
             "why": "출처 앵커 누락 — '유일호 부총리와 예산실장'을 한 사람으로 붙여 읽은 결과"},
        ],
    },
}

# ── 4-1. 사전 계산본 자체 검증 ──────────────────────────────────────────────
# 화면의 ⑥ 검증이 쓰는 규칙을 여기서 그대로 돌려, 손으로 적은 ok 표시와 어긋나면 중단한다.
# (어긋난 채 배포되면 "틀렸다고 적어 둔 트리플이 검증을 통과"하는 사태가 난다)
PROP_BY = {p["t"]: p for p in PROPS}
PARA_BY = {p["id"]: p for p in paragraphs}
errors, inferred = [], []

for pid, pre in PRECOMPUTED.items():
    if pid not in PARA_BY:
        errors.append(f"{pid}: 그런 단락이 없습니다")
        continue
    text = PARA_BY[pid]["text"]
    page = PARA_BY[pid]["page"]
    cls_of = {e["surface"]: e["cls"] for e in pre["entities"]}
    for e in pre["entities"]:
        if e["cls"] not in {c["t"] for c in CLASSES}:
            errors.append(f"{pid}: 프로파일에 없는 클래스 {e['cls']}")
        if e["surface"] not in text:
            inferred.append(f"{pid}/{e['surface']}")     # 원문에 없는 = LLM이 추론한 개체
    for t in pre["triples"]:
        pd = PROP_BY.get(t["p"])
        sc, oc = cls_of.get(t["s"]), cls_of.get(t["o"])
        if pd is None:
            reason = "프로파일에 없는 속성"
        elif sc is None or oc is None:
            reason = "개체 목록에 없는 주어/목적어"
        elif sc not in pd["d"]:
            reason = "도메인 위반"
        elif oc not in pd["r"]:
            reason = "레인지 위반"
        elif not t["page"]:
            reason = "출처 앵커 누락"
        else:
            reason = None
        if (reason is None) != t["ok"]:
            errors.append(f"{pid}: <{t['s']} {t['p']} {t['o']}> ok={t['ok']} 인데 "
                          f"검증 결과는 {reason or '통과'}")
        if t["page"] and t["page"] != page:
            errors.append(f"{pid}: 쪽수 {t['page']} 가 단락 쪽수 {page} 와 다릅니다")

if errors:
    print("사전 계산본 검증 실패 — 아무 파일도 쓰지 않았습니다:")
    for e in errors:
        print("  -", e)
    raise SystemExit(1)

# ── 5. 출력 ─────────────────────────────────────────────────────────────────
payload = {
    "authority": authority,
    "gold": gold,
    "paragraphs": paragraphs,
    "classes": CLASSES,
    "objectProps": PROPS,
    "dataProps": DATA_PROPS,
    "precomputed": PRECOMPUTED,
}
js = "// 자동 생성 — build_data.py\nwindow.NARA = " + \
     json.dumps(payload, ensure_ascii=False, indent=1) + ";\n"
(HERE / "data.js").write_text(js, encoding="utf-8")

print(f"data.js 생성")
print(f"  전거 마스터   : {len(authority)}명 (재임기록 {len(roster)}건)")
print(f"  정답지 표제어 : {len(gold)}개")
print(f"  실습 단락     : {len(paragraphs)}개")
print(f"  Core 클래스   : {len(CLASSES)} / 객체속성 {len(PROPS)} / 데이터속성 {len(DATA_PROPS)}")
print(f"  사전계산 추출 : {len(PRECOMPUTED)}/{len(paragraphs)}단락 · "
      f"개체 {sum(len(v['entities']) for v in PRECOMPUTED.values())} "
      f"(오류 심음 {sum(1 for v in PRECOMPUTED.values() for e in v['entities'] if not e['ok'])}) · "
      f"트리플 {sum(len(v['triples']) for v in PRECOMPUTED.values())} "
      f"(오류 심음 {sum(1 for v in PRECOMPUTED.values() for t in v['triples'] if not t['ok'])})")
print(f"  검증 통과     : 심어 둔 ok 표시가 화면 ⑥ 규칙과 전부 일치")
print(f"  원문에 없는 개체(LLM 추론분): {len(inferred)}건 — {', '.join(inferred)}")
