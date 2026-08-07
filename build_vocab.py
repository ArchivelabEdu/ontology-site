#!/usr/bin/env python3
"""RiC-O 1.1 전체 어휘 목록과 내려받기 파일 묶음을 만든다.

입력: ../01-profile/RiC-O_1-1.rdf      (원본 온톨로지)
      ../01-profile/rico-oral-profile.rdf (이 강의용 부분집합)
      ../01-profile/templates.json     (Omeka S 리소스 템플릿)
출력: vocab/rico-full.json  — 9장 '전체 어휘 펼쳐보기'가 필요할 때만 fetch
      downloads/*          — 카드에서 내려받는 파일들
"""
import csv
import json
import shutil
from pathlib import Path

import rdflib
from rdflib.namespace import OWL, RDF, RDFS

HERE = Path(__file__).parent
PROF = HERE.parent / "01-profile"
RICO = "https://www.ica.org/standards/RiC/ontology#"

full = rdflib.Graph()
full.parse(PROF / "RiC-O_1-1.rdf", format="xml")


def short(u):
    return str(u).split("#")[-1] if isinstance(u, rdflib.URIRef) else str(u)


def resolve(node):
    """URIRef면 지역명, owl:unionOf 공백노드면 ['A','B']로 편다."""
    if isinstance(node, rdflib.URIRef):
        return [short(node)]
    for u in full.objects(node, OWL.unionOf):
        return [short(x) for x in rdflib.collection.Collection(full, u)]
    return []


def label(s, lang="en"):
    for o in full.objects(s, RDFS.label):
        if o.language == lang:
            return str(o)
    return ""


def comment(s, lang="en"):
    for o in full.objects(s, RDFS.comment):
        if o.language == lang:
            return " ".join(str(o).split())
    return ""


def terms_of(kind):
    """RiC-O 네임스페이스 안의 kind 타입 용어만. (skos:broader 등 외부 어휘 제외)"""
    out = []
    for s in set(full.subjects(RDF.type, kind)):
        if not (isinstance(s, rdflib.URIRef) and str(s).startswith(RICO)):
            continue
        out.append(s)
    return sorted(out, key=lambda s: short(s).lower())


def dr(s):
    d = [x for o in full.objects(s, RDFS.domain) for x in resolve(o)]
    r = [x for o in full.objects(s, RDFS.range) for x in resolve(o)]
    return d, r


classes = []
for s in terms_of(OWL.Class):
    classes.append({
        "t": short(s),
        "en": label(s),
        "fr": label(s, "fr"),
        "def": comment(s),
        "sub": sorted({short(o) for o in full.objects(s, RDFS.subClassOf)
                       if isinstance(o, rdflib.URIRef) and str(o).startswith(RICO)}),
    })

objprops, dataprops = [], []
for kind, bucket in ((OWL.ObjectProperty, objprops), (OWL.DatatypeProperty, dataprops)):
    for s in terms_of(kind):
        d, r = dr(s)
        rec = {"t": short(s), "en": label(s), "fr": label(s, "fr"),
               "def": comment(s), "d": d, "r": r}
        inv = [short(o) for o in full.objects(s, OWL.inverseOf)
               if isinstance(o, rdflib.URIRef)]
        if inv:
            rec["inv"] = inv[0]
        bucket.append(rec)

# ── 이 강의의 부분집합 표시용: 프로파일에 실린 용어 집합 ──────────────────────
prof = rdflib.Graph()
prof.parse(PROF / "rico-oral-profile.rdf", format="xml")
in_profile = {str(s).split("#")[-1] for s in set(prof.subjects())
              if isinstance(s, rdflib.URIRef) and str(s).startswith(RICO)}


def core_or_ext(term):
    """프로파일 rdfs:comment 머리의 [Core]/[Ext] 표시를 읽는다."""
    for o in prof.objects(rdflib.URIRef(RICO + term), RDFS.comment):
        txt = str(o)
        if txt.startswith("[Core]"):
            return "core"
        if txt.startswith("[Ext]"):
            return "ext"
    return ""


def ko_of(term):
    """프로파일의 한글 레이블·설명. 설명 머리의 [Core]/[Ext] 표시는 떼어 낸다."""
    u = rdflib.URIRef(RICO + term)
    lab = next((str(o) for o in prof.objects(u, RDFS.label) if o.language == "ko"), "")
    com = next((str(o) for o in prof.objects(u, RDFS.comment) if o.language == "ko"), "")
    return lab, com.split("] ", 1)[-1] if com.startswith("[") else com


for rec in classes + objprops + dataprops:
    tier = core_or_ext(rec["t"]) if rec["t"] in in_profile else ""
    if tier:
        rec["tier"] = tier
        rec["ko"], rec["koDef"] = ko_of(rec["t"])

payload = {
    "version": "RiC-O 1.1 (2025-05-22)",
    "ns": RICO,
    "classes": classes,
    "objectProps": objprops,
    "dataProps": dataprops,
}
(HERE / "vocab").mkdir(exist_ok=True)
(HERE / "vocab" / "rico-full.json").write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# ── 내려받기 묶음 ────────────────────────────────────────────────────────────
DL = HERE / "downloads"
DL.mkdir(exist_ok=True)

shutil.copy(PROF / "rico-oral-profile.rdf", DL / "rico-oral-profile.rdf")
shutil.copy(PROF / "templates.json", DL / "omeka-templates.json")
shutil.copy(PROF / "RiC-O_1-1.rdf", DL / "RiC-O_1-1.rdf")

prof.serialize(destination=DL / "rico-oral-profile.ttl", format="turtle")
prof.serialize(destination=DL / "rico-oral-profile.jsonld", format="json-ld", indent=1)
full.serialize(destination=DL / "RiC-O_1-1.ttl", format="turtle")

# Core 12클래스·30속성을 표 한 장으로 (엑셀에서 여는 사람용)
core_cls = [c for c in classes if c.get("tier") == "core"]
core_op = [p for p in objprops if p.get("tier") == "core"]
core_dp = [p for p in dataprops if p.get("tier") == "core"]
with (DL / "rico-core-12x30.csv").open("w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["구분", "rico: 지역명", "영문 레이블", "도메인", "레인지", "역방향", "RiC-O 1.1 정의"])
    for c in core_cls:
        w.writerow(["클래스", c["t"], c["en"], "", "", "", c["def"]])
    for p in core_op:
        w.writerow(["객체속성", p["t"], p["en"], " | ".join(p["d"]),
                    " | ".join(p["r"]), p.get("inv", ""), p["def"]])
    for p in core_dp:
        w.writerow(["데이터속성", p["t"], p["en"], " | ".join(p["d"]),
                    " | ".join(p["r"]), "", p["def"]])

print("vocab/rico-full.json")
print(f"  클래스 {len(classes)} · 객체속성 {len(objprops)} · 데이터속성 {len(dataprops)}"
      f" (속성 합계 {len(objprops) + len(dataprops)})")
print(f"  프로파일 표시  : Core {sum(1 for r in classes + objprops + dataprops if r.get('tier') == 'core')}"
      f" · Extended {sum(1 for r in classes + objprops + dataprops if r.get('tier') == 'ext')}")
print(f"  Core 내역      : 클래스 {len(core_cls)} · 객체속성 {len(core_op)} · 데이터속성 {len(core_dp)}")
print("downloads/")
for p in sorted(DL.iterdir()):
    print(f"  {p.name:28s} {p.stat().st_size / 1024:8.1f} KB")
