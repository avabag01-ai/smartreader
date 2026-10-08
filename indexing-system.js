/**
 * StudyPad AI - 지능형 데이터 인덱싱 시스템
 * TOON 포맷 기반 경량화 데이터 구조
 *
 * 메모리: 위치마다 객체를 만들지 않고 숫자 배열(문서 번호·오프셋)로 담는다.
 *         문서(파일·챕터·페이지)는 표 하나에 한 번만 적고 번호로 가리킨다.
 * 검색:   단어마다 "나온 문서 목록"을 따로 두어 searchPages 가 바로 교집합을 낸다.
 * 저장:   TOON v2 — 문서 표 한 번 + 단어별 위치를 차이값·구분 기호 없는 32진 글자로. 예전(v1) 파일도 읽는다.
 */

const fs = require('fs');
const path = require('path');

const DICT_V2 = '#toon-dict v2';
const INDEX_V2 = '#toon-index v2';

// 구분 기호 없는 숫자: 끝 자리와 앞 자리를 다른 글자로 써서 어디서 끝나는지 안다
const LAST = '0123456789abcdefghijklmnopqrstuv';
const MORE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';
const DIGIT = new Map([...LAST].map((ch, v) => [ch, [v, true]]).concat([...MORE].map((ch, v) => [ch, [v, false]])));

function encodeNum(n) {
  let out = '';
  while (n >= 32) { out += MORE[n % 32]; n = Math.floor(n / 32); }
  return out + LAST[n];
}

function decodeNums(text) {
  const out = [];
  let value = 0, scale = 1;
  for (const ch of text) {
    const [v, last] = DIGIT.get(ch);
    value += v * scale;
    if (last) { out.push(value); value = 0; scale = 1; } else scale *= 32;
  }
  return out;
}

const zigzag = (n) => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzigzag = (z) => (z % 2 ? -(z + 1) / 2 : z / 2);

class IndexingSystem {
  constructor(basePath) {
    this.basePath = basePath;
    this.wordDict = new Map(); // 단어 → ID 매핑 (메모리)
    this.nextWordId = 1;
    this._reset();
  }

  _reset() {
    this.idToWord = [];        // ID → 단어
    this.docs = [];            // 문서 번호 → { f, c, p }
    this.docKey = new Map();   // "f\0c\0p" → 문서 번호
    // 단어 ID 마다 "항목" 목록: 같은 문서에 이어서 나온 위치들은 항목 하나로 묶는다.
    // 항목 = 문서 번호, 그 문서에 2번 이상 이어서 나왔으면 바로 뒤에 -개수 (한 번이면 표시 없음 —
    // 대부분이 한 번이라 개수 배열을 따로 두는 것보다 메모리가 적다).
    this.pageDocs = [];        // 단어 ID → [문서, (-개수), 문서, ...]
    this.postOffs = [];        // 단어 ID → 위치마다 오프셋 (항목 순서대로)
    this.unsorted = new Set(); // 항목 문서 번호가 오름차순이 아닌 단어 ID (앞 문서에 나중에 더한 경우)
    this.grouped = new Set();  // -개수 표시가 하나라도 있는 단어 ID
    this.pageCache = new Map(); // 검색한 grouped·unsorted 단어의 순수 문서 목록(정렬·중복 없음)
  }

  /**
   * 단어 ID → 위치 배열 ({ f, c, p, o }) 을 돌려주는 Map 모양 보기 (예전 코드 호환)
   */
  get invertedIndex() {
    const self = this;
    const ids = () => { const out = []; self.pageDocs.forEach((a, id) => { if (a) out.push(id); }); return out; };
    return {
      get: (id) => (self.pageDocs[id] ? self._positions(id) : undefined),
      has: (id) => !!self.pageDocs[id],
      get size() { return ids().length; },
      keys: () => ids()[Symbol.iterator](),
      values: () => ids().map(id => self._positions(id))[Symbol.iterator](),
      entries: () => ids().map(id => [id, self._positions(id)])[Symbol.iterator](),
      forEach: (fn) => ids().forEach(id => fn(self._positions(id), id)),
      [Symbol.iterator]() { return this.entries(); },
    };
  }

  /**
   * Map<단어 ID, 위치 배열> 을 통째로 넣기 (병렬 색인 결과를 옮길 때)
   */
  set invertedIndex(map) {
    this._reset();
    this.wordDict.forEach((id, word) => { this.idToWord[id] = word; });
    map.forEach((positions, id) => positions.forEach(pos => this._add(id, this._docId(pos.f, pos.c, pos.p), pos.o)));
  }

  _positions(id) {
    const os = this.postOffs[id], out = new Array(os.length);
    this._entries(id, (doc, cnt, start) => {
      const d = this.docs[doc];
      for (let k = 0; k < cnt; k++) out[start + k] = { f: d.f, c: d.c, p: d.p, o: os[start + k] };
    });
    return out;
  }

  /**
   * 단어의 항목마다 fn(문서 번호, 위치 개수, 첫 위치의 postOffs 번호)
   */
  _entries(id, fn) {
    const pages = this.pageDocs[id];
    let start = 0;
    for (let e = 0; e < pages.length; e++) {
      const cnt = e + 1 < pages.length && pages[e + 1] < 0 ? -pages[e + 1] : 1;
      fn(pages[e], cnt, start);
      start += cnt;
      if (cnt > 1) e++;
    }
  }

  _docId(f, c, p) {
    const key = f + '\0' + c + '\0' + p;
    let id = this.docKey.get(key);
    if (id === undefined) {
      id = this.docs.length;
      this.docs.push({ f, c, p });
      this.docKey.set(key, id);
    }
    return id;
  }

  _add(wordId, docId, offset) {
    const pages = this.pageDocs[wordId];
    if (!pages) {
      // 처음엔 딱 한 칸짜리로 만든다. 빈 배열에 push 하면 V8 이 17칸을 잡아서, 한두 번 나오는
      // 단어(지프 분포에선 절반 가까이)마다 빈칸이 생긴다.
      this.pageDocs[wordId] = [docId];
      this.postOffs[wordId] = [offset];
      return;
    }
    this.postOffs[wordId].push(offset);
    const last = pages.length - 1;
    if (pages[last] < 0) {                 // 마지막 항목이 이미 2번 이상
      if (pages[last - 1] === docId) { pages[last]--; return; }
    } else if (pages[last] === docId) {
      pages.push(-2);
      this.grouped.add(wordId);
      return;
    }
    const lastDoc = pages[last] < 0 ? pages[last - 1] : pages[last];
    if (docId < lastDoc) this.unsorted.add(wordId);
    if (this.pageCache.size) this.pageCache.delete(wordId);
    pages.push(docId);
  }

  _pages(wordId) {
    const unsorted = this.unsorted.has(wordId);
    if (!unsorted && !this.grouped.has(wordId)) return this.pageDocs[wordId];
    let list = this.pageCache.get(wordId);
    if (!list) {
      list = this.pageDocs[wordId].filter(d => d >= 0);
      if (unsorted) list = [...new Set(list)].sort((a, b) => a - b);
      this.pageCache.set(wordId, list);
    }
    return list;
  }

  /**
   * 텍스트에서 단어 추출 및 ID 부여
   */
  tokenize(text) {
    // 한글, 영문, 숫자 단위로 토큰화
    const tokens = text.match(/[ㄱ-힝가-힣]+|[a-zA-Z]+|[0-9]+/g) || [];
    return tokens.map(t => t.toLowerCase());
  }

  /**
   * 단어 ID 가져오기 (없으면 생성)
   */
  getWordId(word) {
    let id = this.wordDict.get(word);
    if (id === undefined) {
      id = this.nextWordId++;
      this.wordDict.set(word, id);
      this.idToWord[id] = word;
    }
    return id;
  }

  /**
   * 본문 텍스트를 인덱싱 (챕터, 페이지, 오프셋)
   */
  indexText(text, meta) {
    const { fileName, chapterId, pageNumber, offset = 0 } = meta;
    const tokens = this.tokenize(text);
    const docId = this._docId(fileName, chapterId, pageNumber);
    const wordIds = new Array(tokens.length);

    for (let i = 0; i < tokens.length; i++) {
      const wordId = this.getWordId(tokens[i]);
      wordIds[i] = wordId;
      this._add(wordId, docId, offset + i);
    }

    // 단어 ID 배열 반환 (중복 제거된 형태)
    return wordIds;
  }

  /**
   * 검색어의 모든 단어가 들어 있는 문서(파일·챕터·페이지) 목록
   */
  searchPages(query) {
    const lists = [];
    for (const word of this.tokenize(query)) {
      const id = this.wordDict.get(word);
      if (id === undefined || !this.pageDocs[id]) return [];
      lists.push(this._pages(id));
    }
    if (!lists.length) return [];
    lists.sort((a, b) => a.length - b.length);
    let acc = lists[0];
    for (let k = 1; k < lists.length && acc.length; k++) {
      const other = lists[k], next = [];
      let j = 0;
      for (const d of acc) {               // 둘 다 오름차순: 짧은 쪽을 돌며 긴 쪽 포인터를 민다
        while (j < other.length && other[j] < d) j++;
        if (j === other.length) break;
        if (other[j] === d) next.push(d);
      }
      acc = next;
    }
    return acc.map(d => this.docs[d]);
  }

  /**
   * TOON 포맷으로 단어장 저장
   * 형식(v2): 첫 줄 표시 | 이후 한 줄에 단어 하나, 줄 번호 = ID
   */
  saveWordDictionary() {
    const lines = [DICT_V2];
    for (let id = 1; id < this.nextWordId; id++) lines.push(this.idToWord[id] || '');

    const filePath = path.join(this.basePath, 'word-dictionary.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    console.log(`✓ 단어장 저장 완료: ${this.wordDict.size}개 단어`);
    return filePath;
  }

  /**
   * TOON 포맷으로 역색인 저장
   * 형식(v2): 문서 표(f|c|p, 번호는 줄 순서) 한 번, 이어서 단어 ID 순서대로 한 줄씩(줄 번호 = ID)
   *   한 줄 = 문서마다 [문서차*2 + (2번 이상?1:0)] [개수(2번 이상일 때)] [오프셋] [오프셋차]...
   *   숫자는 구분 기호 없이 32진 글자: 끝 자리는 0-9a-v, 앞 자리들은 A-Z@#$%&* (작은 자리부터).
   *   오프셋·오프셋차는 지그재그(음수도 담음).
   */
  saveInvertedIndex() {
    const lines = [INDEX_V2, 'f|c|p'];
    this.docs.forEach(d => lines.push(`${d.f}|${d.c}|${d.p}`));
    lines.push('postings');

    let count = 0;
    for (let id = 1; id < this.nextWordId; id++) {
      if (!this.pageDocs[id]) { lines.push(''); continue; }
      const ds = [];                       // 위치마다 문서 번호로 펼친다
      this._entries(id, (d, cnt) => { for (let k = 0; k < cnt; k++) ds.push(d); });
      // 문서 번호 순으로 묶는다 (같은 문서 안에서는 넣은 순서)
      const order = ds.map((_, i) => i).sort((a, b) => ds[a] - ds[b] || a - b);
      const os = this.postOffs[id];
      let out = '', prevDoc = 0;
      for (let g = 0; g < order.length;) {
        const doc = ds[order[g]];
        let h = g;
        while (h < order.length && ds[order[h]] === doc) h++;
        const cnt = h - g;
        out += encodeNum((doc - prevDoc) * 2 + (cnt > 1 ? 1 : 0));
        if (cnt > 1) out += encodeNum(cnt);
        let prevOff = 0;
        for (let k = g; k < h; k++) {
          out += encodeNum(zigzag(os[order[k]] - prevOff));
          prevOff = os[order[k]];
        }
        prevDoc = doc;
        count += cnt;
        g = h;
      }
      lines.push(out);
    }

    const filePath = path.join(this.basePath, 'inverted-index.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    console.log(`✓ 역색인 저장 완료: ${count}개 위치 정보`);
    return filePath;
  }

  /**
   * TOON 포맷에서 단어장 로드 (v2, 예전 id|word 둘 다)
   */
  loadWordDictionary() {
    const filePath = path.join(this.basePath, 'word-dictionary.toon');

    if (!fs.existsSync(filePath)) {
      console.log('단어장 파일이 없습니다.');
      return false;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const v2 = lines[0] === DICT_V2;

    // 첫 줄은 헤더이므로 스킵
    for (let i = 1; i < lines.length; i++) {
      let id, word;
      if (v2) {
        id = i; word = lines[i];
      } else {
        const line = lines[i].trim();
        if (!line) continue;
        const cut = line.indexOf('|');
        id = parseInt(line.slice(0, cut)); word = line.slice(cut + 1);
      }
      if (!word) continue;
      this.wordDict.set(word, id);
      this.idToWord[id] = word;
      this.nextWordId = Math.max(this.nextWordId, id + 1);
    }

    console.log(`✓ 단어장 로드 완료: ${this.wordDict.size}개 단어`);
    return true;
  }

  /**
   * TOON 포맷에서 역색인 로드 (v2, 예전 wid|f|c|p|o 둘 다)
   */
  loadInvertedIndex() {
    const filePath = path.join(this.basePath, 'inverted-index.toon');

    if (!fs.existsSync(filePath)) {
      console.log('역색인 파일이 없습니다.');
      return false;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');

    if (lines[0] !== INDEX_V2) {
      // 예전 형식: 첫 줄은 헤더, 이후 위치마다 한 줄
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [wid, f, c, p, o] = line.split('|');
        this._add(parseInt(wid), this._docId(f, parseInt(c), parseInt(p)), parseInt(o));
      }
    } else {
      let i = 2;
      const docIds = [];
      for (; i < lines.length && lines[i] !== 'postings'; i++) {
        const [f, c, p] = lines[i].split('|');
        docIds.push(this._docId(f, parseInt(c), parseInt(p)));
      }
      for (let wordId = 1, j = i + 1; j < lines.length; wordId++, j++) {
        const nums = decodeNums(lines[j]);
        let doc = 0;
        for (let k = 0; k < nums.length;) {
          const head = nums[k++];
          doc += Math.floor(head / 2);
          const cnt = head % 2 ? nums[k++] : 1;
          let off = 0;
          for (let n = 0; n < cnt; n++) {
            off += unzigzag(nums[k++]);
            this._add(wordId, docIds[doc], off);
          }
        }
      }
    }

    console.log(`✓ 역색인 로드 완료`);
    return true;
  }

  /**
   * 단어로 위치 검색
   */
  findPositions(word) {
    const wordId = this.wordDict.get(word.toLowerCase());
    if (!wordId || !this.pageDocs[wordId]) return [];

    return this._positions(wordId);
  }

  /**
   * 특정 위치의 컨텍스트 단어들 가져오기
   * (오답 노트/메모에서 본문으로 이동 시 사용)
   */
  getContextWords(fileName, chapterId, pageNumber, offsetRange = 50) {
    const contextWords = new Set();
    const docId = this.docKey.get(fileName + '\0' + chapterId + '\0' + pageNumber);
    if (docId === undefined) return [];

    this.pageDocs.forEach((pages, wordId) => {
      if (!pages || !pages.includes(docId)) return;
      const os = this.postOffs[wordId];
      this._entries(wordId, (doc, cnt, start) => {
        if (doc !== docId) return;
        for (let k = 0; k < cnt; k++) {
          if (Math.abs(os[start + k] - offsetRange) < 100) contextWords.add(this.idToWord[wordId]);
        }
      });
    });

    return Array.from(contextWords);
  }

  /**
   * 통계 정보
   */
  getStats() {
    let totalPositions = 0;
    this.postOffs.forEach(os => { if (os) totalPositions += os.length; });

    return {
      uniqueWords: this.wordDict.size,
      totalPositions,
      avgPositionsPerWord: (totalPositions / this.wordDict.size).toFixed(2)
    };
  }
}

module.exports = IndexingSystem;
