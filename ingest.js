/* 원문 파일 읽기 — 라이브러리 없이(PDF만 동봉한 pdf.js).
   txt·md  : 그대로 디코딩 (UTF-8 실패 시 EUC-KR)
   docx    : ZIP 안의 word/document.xml
   hwpx    : ZIP 안의 Contents/section*.xml
   pdf     : vendor/pdf.min.mjs (필요할 때만 불러온다)
   doc·hwp : 구형 바이너리 포맷이라 읽지 못한다 — 붙여넣기로 안내 */

const OK_EXT = ['txt', 'md', 'markdown', 'docx', 'hwpx', 'pdf'];
const NO_EXT = { doc: 'MS Word 97-2003', hwp: '한글 2018 이하', rtf: 'RTF', pages: 'Pages', odt: 'ODF' };

function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) {
    try { return new TextDecoder('euc-kr').decode(buf); }   // 국내 구형 txt 는 CP949 가 많다
    catch (e2) { return new TextDecoder().decode(buf); }
  }
}

/* ── 최소 ZIP 리더 ──────────────────────────────────────────────────────────
   중앙 디렉터리를 훑어 원하는 항목만 꺼낸다. 저장(0)·Deflate(8)만 지원하는데,
   docx·hwpx 는 전부 이 둘 안에 있다. 압축 해제는 브라우저 내장 DecompressionStream. */
async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(s).text();
}
async function unzip(buf, wanted) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP 구조를 찾지 못했습니다 — 파일이 손상되었을 수 있습니다.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count && p + 46 <= buf.byteLength; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const mlen = dv.getUint16(p + 30, true);
    const klen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + mlen + klen;
    if (!wanted(name)) continue;
    const ln = dv.getUint16(lho + 26, true), lx = dv.getUint16(lho + 28, true);
    const raw = u8.subarray(lho + 30 + ln + lx, lho + 30 + ln + lx + csize);
    if (method !== 0 && method !== 8) throw new Error(`지원하지 않는 압축 방식(${method})입니다.`);
    out.push({ name, xml: method === 0 ? dec.decode(raw) : await inflateRaw(raw) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* docx·hwpx 모두 문단이 <p>, 글자가 <t> 다 (네임스페이스만 w: / hp: 로 다름) */
function xmlParagraphs(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML을 읽지 못했습니다.');
  const out = [];
  for (const para of doc.getElementsByTagNameNS('*', 'p')) {
    const s = [...para.getElementsByTagNameNS('*', 't')].map(t => t.textContent).join('').trim();
    if (s) out.push(s);
  }
  return out.join('\n');
}

let pdfjsPromise = null;
async function pdfText(buf, onProgress) {
  if (!pdfjsPromise) {
    pdfjsPromise = import('./vendor/pdf.min.mjs').then(m => {
      m.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
      return m;
    });
  }
  const pdfjs = await pdfjsPromise;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`PDF ${i}/${doc.numPages}쪽 읽는 중…`);
    const tc = await (await doc.getPage(i)).getTextContent();
    let line = '', buf2 = [];
    for (const it of tc.items) {
      line += it.str;
      if (it.hasEOL) { buf2.push(line); line = ''; }
    }
    if (line) buf2.push(line);
    const t = buf2.join('\n').trim();
    if (t) pages.push({ page: i, text: t });          // 쪽 번호를 달아 둔다 — 출처 앵커로 쓴다
  }
  const text = pages.map(p => p.text).join('\n\n');
  if (!text.trim()) {
    throw new Error('이 PDF에서 글자를 찾지 못했습니다 — 스캔 이미지로 된 PDF로 보입니다. ' +
      'OCR을 먼저 돌리거나, 다른 곳에서 텍스트를 복사해 붙여 넣어 주세요.');
  }
  return { text, pages };
}

/* 파일 하나 → { text, pages }. pages 는 쪽 경계를 아는 형식(PDF)에서만 채워지고,
   그 밖에는 null 이다. 실패하면 사람이 읽을 수 있는 메시지로 throw 한다. */
window.readDocFile = async function (file, onProgress) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (NO_EXT[ext]) {
    throw new Error(`.${ext} (${NO_EXT[ext]})는 읽지 못합니다 — 구형 바이너리 형식입니다. ` +
      `원본 프로그램에서 열어 텍스트를 복사한 뒤 아래 칸에 붙여 넣거나, .docx·.hwpx·.txt 로 저장해 다시 올려 주세요.`);
  }
  if (!OK_EXT.includes(ext)) {
    throw new Error(`.${ext} 는 지원하지 않습니다. txt · md · docx · hwpx · pdf 만 읽습니다.`);
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB가 넘습니다. 필요한 부분만 잘라서 올려 주세요.');

  onProgress?.('파일을 읽는 중…');
  const buf = await file.arrayBuffer();

  if (ext === 'txt' || ext === 'md' || ext === 'markdown') return { text: decodeText(buf), pages: null };
  if (ext === 'pdf') return pdfText(buf, onProgress);

  onProgress?.('압축을 푸는 중…');
  if (ext === 'docx') {
    const [d] = await unzip(buf, n => n === 'word/document.xml');
    if (!d) throw new Error('docx 안에서 본문(word/document.xml)을 찾지 못했습니다.');
    return { text: xmlParagraphs(d.xml), pages: null };
  }
  // hwpx — 본문이 Contents/sectionN.xml 로 나뉘어 있다 (쪽 나눔은 조판 결과라 파일에 없다)
  const secs = await unzip(buf, n => /^Contents\/section\d+\.xml$/i.test(n));
  if (!secs.length) throw new Error('hwpx 안에서 본문(Contents/section*.xml)을 찾지 못했습니다.');
  return { text: secs.map(s => xmlParagraphs(s.xml)).filter(Boolean).join('\n'), pages: null };
};

/* PDF·한글 문서에서 딸려 오는 표시 문자를 걷어 낸다.
   총서 본문에 섞여 들어오는 각주 표시(●), 글머리 기호, 폭 없는 공백, 줄바꿈용 하이픈 등. */
window.scrubText = function (t) {
  return String(t)
    .replace(/[​-‍﻿­]/g, '')        // 폭 없는 공백 · 소프트 하이픈
    .replace(/[●○◦∙•◉◎⦿⚫⚪·]{1,}(?=\s|$)/g, '')        // 각주·글머리 동그라미 (가운뎃점은 뒤에 공백일 때만)
    .replace(/[●○◉◎⦿⚫⚪]/g, '')                        // 낱말 사이에 박힌 것까지
    .replace(/[■□▪▫◆◇▶▷★☆]/g, '')                     // 네모·마름모·별 글머리
    .replace(/ /g, ' ')                            // 줄바꿈 없는 공백 → 보통 공백
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
};

/* 긴 글을 실습하기 좋은 크기의 단락으로 나눈다 */
window.splitParagraphs = function (text, min = 180, max = 1200) {
  text = window.scrubText(text);
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  let cur = '';
  for (const b of blocks) {
    if (b.length > max) {                                  // 너무 긴 덩어리는 문장 끝에서 자른다
      if (cur) { out.push(cur); cur = ''; }
      let rest = b;
      while (rest.length > max) {
        let cut = rest.lastIndexOf('. ', max);
        const k = rest.lastIndexOf('다. ', max);
        if (k > max * 0.4) cut = k + 2;
        if (cut < max * 0.4) cut = max;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) cur = rest;
      continue;
    }
    cur = cur ? cur + ' ' + b : b;
    if (cur.length >= min) { out.push(cur); cur = ''; }
  }
  if (cur) (out.length && cur.length < min ? out[out.length - 1] += ' ' + cur : out.push(cur));
  return out.filter(s => s.length > 20);
};

/* 쪽 경계를 아는 문서(PDF)는 쪽마다 따로 나눈다 — 단락이 실제 쪽 번호를 갖게 된다 */
window.splitPages = function (pages) {
  const out = [];
  for (const pg of pages) {
    for (const t of window.splitParagraphs(pg.text)) out.push({ text: t, page: String(pg.page) });
  }
  return out;
};
