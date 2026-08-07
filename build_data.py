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
    p["id"] = f"agent/{i:03d}"

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
}

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
print(f"  사전계산 추출 : {len(PRECOMPUTED)}단락 "
      f"(오류 심음 {sum(1 for v in PRECOMPUTED.values() for t in v['triples'] if not t['ok'])}건)")
