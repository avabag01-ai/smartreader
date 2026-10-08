/**
 * 공정 벤치마크 — 모든 엔진에 같은 페이지·같은 양·같은 질의를 준다.
 *
 *   node fair-benchmark.js [페이지 수=3000] [페이지당 단어=300]
 *
 * 재는 것 (엔진마다 따로 node 프로세스에서, 메모리는 --expose-gc 후 heapUsed + external 차이)
 *   - 색인 시간: 페이지 전부를 넣는 데 걸린 시간
 *   - 메모리: 색인을 잡고 있는 동안 늘어난 힙 (색인 직후와 질의 뒤 중 큰 값 — 검색 캐시도 센다)
 *   - 저장 크기: 색인을 직렬화한 바이트 (우리 것 = TOON 파일 두 개)
 *   - 질의 시간: 한 단어 300개(자주·중간·드문 단어 100개씩) + 두 단어 AND 100개, 평균
 *   - 정확도: 정답(페이지에 그 단어가 정확히 있음)과 비교한 정밀도·재현율
 * 말뭉치는 시드 고정 무작위(지프 분포, 한글·영문·숫자 단어)라 매번 같다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const IS_CHILD = process.argv[2] === '--child';   // 자식: --child <엔진> <질의파일> <폴더> <쪽수> <단어수>
const ARGS = IS_CHILD ? process.argv.slice(6) : process.argv.slice(2);
const PAGES = parseInt(ARGS[0] || '3000', 10);
const WORDS_PER_PAGE = parseInt(ARGS[1] || '300', 10);
const VOCAB = 50000;
const ENGINES = ['ours', 'flexsearch', 'lunr', 'elasticlunr', 'fuse'];

// ---------------------------------------------------------------- 말뭉치
function rng(seed) {                       // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeVocab(rand) {
  const words = new Set();
  while (words.size < VOCAB) {
    const r = rand();
    let w = '';
    if (r < 0.5) {                         // 한글 2~4 음절
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) w += String.fromCharCode(0xAC00 + Math.floor(rand() * 11172));
    } else if (r < 0.95) {                 // 영문 3~10 글자
      const n = 3 + Math.floor(rand() * 8);
      for (let i = 0; i < n; i++) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    } else {
      w = String(Math.floor(rand() * 100000));
    }
    words.add(w);
  }
  return [...words];
}

function makeCorpus() {
  const rand = rng(20260108);
  const vocab = makeVocab(rand);
  // 지프 분포: 누적 가중치에서 이분 탐색
  const cum = new Float64Array(VOCAB);
  let s = 0;
  for (let i = 0; i < VOCAB; i++) { s += 1 / (i + 1); cum[i] = s; }
  const pick = () => {
    const x = rand() * s;
    let lo = 0, hi = VOCAB - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    return lo;
  };
  const pages = [];
  for (let p = 0; p < PAGES; p++) {
    const ws = new Array(WORDS_PER_PAGE);
    for (let i = 0; i < WORDS_PER_PAGE; i++) ws[i] = vocab[pick()];
    pages.push(ws.join(' '));
  }
  return { vocab, pages, rand };
}

// ---------------------------------------------------------------- 엔진 어댑터
// build(pages) -> 색인,  query(index, words[]) -> 페이지 번호 배열(AND),  size(index, dir) -> 바이트
const adapters = {
  ours: () => {
    const IndexingSystem = require('./indexing-system');
    return {
      build(pages, dir) {
        const ix = new IndexingSystem(dir);
        pages.forEach((t, i) => ix.indexText(t, { fileName: 'bench.pdf', chapterId: 1, pageNumber: i }));
        return ix;
      },
      query(ix, words) {
        if (typeof ix.searchPages === 'function') return ix.searchPages(words.join(' ')).map(d => d.p);
        // 예전 판: 단어별 위치 -> 페이지 집합 -> 교집합 (검색 기능이 없어서 여기서 만든다)
        let acc = null;
        for (const w of words) {
          const set = new Set(ix.findPositions(w).map(pos => pos.p));
          acc = acc ? new Set([...acc].filter(p => set.has(p))) : set;
        }
        return [...(acc || [])];
      },
      size(ix, dir) {
        const a = ix.saveWordDictionary(), b = ix.saveInvertedIndex();
        return fs.statSync(a).size + fs.statSync(b).size;
      },
    };
  },
  flexsearch: () => {
    const { Index, Charset } = require('flexsearch');
    return {
      build(pages) {
        // 기본 인코더는 겹친 글자를 합쳐(apple = aple) 정확 일치가 아니다 -> Exact (말뭉치는 소문자뿐)
        const ix = new Index({ tokenize: 'strict', encoder: Charset.Exact });
        pages.forEach((t, i) => ix.add(i, t));
        return ix;
      },
      query(ix, words) { return ix.search(words.join(' '), { limit: PAGES }); },
      size(ix) {
        let n = 0;
        ix.export((key, data) => { if (data !== undefined) n += Buffer.byteLength(String(key)) + Buffer.byteLength(String(data)); });
        return n;
      },
    };
  },
  lunr: () => {
    const lunr = require('lunr');
    return {
      build(pages) {
        return lunr(function () {
          this.pipeline.reset();               // 어간 추출·불용어 끔 = 정확한 단어 일치로 맞춤
          this.searchPipeline.reset();
          this.ref('id');
          this.field('text');
          pages.forEach((t, i) => this.add({ id: String(i), text: t }));
        });
      },
      query(ix, words) { return ix.search(words.map(w => '+' + w).join(' ')).map(r => +r.ref); },
      size(ix) { return Buffer.byteLength(JSON.stringify(ix)); },
    };
  },
  elasticlunr: () => {
    const elasticlunr = require('elasticlunr');
    return {
      build(pages) {
        const ix = elasticlunr(function () {
          this.addField('text');
          this.setRef('id');
          this.saveDocument(false);
          this.pipeline.reset();
        });
        pages.forEach((t, i) => ix.addDoc({ id: i, text: t }));
        return ix;
      },
      query(ix, words) {
        return ix.search(words.join(' '), { fields: { text: { bool: 'AND' } }, bool: 'AND', expand: false }).map(r => +r.ref);
      },
      size(ix) { return Buffer.byteLength(JSON.stringify(ix.toJSON())); },
    };
  },
  fuse: () => {
    const Fuse = require('fuse.js');
    return {
      build(pages) {
        const docs = pages.map((t, i) => ({ id: i, text: t }));
        return new Fuse(docs, { keys: ['text'], useExtendedSearch: true, ignoreLocation: true, threshold: 0 });
      },
      // 'w = 그 글자가 들어 있음(부분 문자열). Fuse 에는 단어 단위 정확 일치가 없다.
      query(ix, words) { return ix.search(words.map(w => "'" + w).join(' ')).map(r => r.item.id); },
      size(ix) { return Buffer.byteLength(JSON.stringify(ix.getIndex().toJSON())); },
    };
  },
};

// ---------------------------------------------------------------- 자식: 엔진 하나 재기
function child(engine, queryFile, outDir) {
  const { pages } = makeCorpus();
  const queries = JSON.parse(fs.readFileSync(queryFile, 'utf8'));
  const a = adapters[engine]();
  global.gc(); global.gc();
  const mem = () => { const m = process.memoryUsage(); return m.heapUsed + m.external; };   // 힙 밖(ArrayBuffer 등)도 센다
  const heap0 = mem();
  const t0 = process.hrtime.bigint();
  const ix = a.build(pages, outDir);
  const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
  global.gc(); global.gc();
  const heapMB = (mem() - heap0) / 1048576;

  for (const q of queries.slice(0, 20)) a.query(ix, q.words);   // 데우기
  const results = [];
  const t1 = process.hrtime.bigint();
  for (const q of queries) results.push(a.query(ix, q.words));
  const queryUs = Number(process.hrtime.bigint() - t1) / 1e3 / queries.length;
  global.gc(); global.gc();
  const heapAfterMB = (mem() - heap0) / 1048576;   // 질의 뒤 (검색 캐시까지 포함)
  const sizeBytes = a.size(ix, outDir);
  return { buildMs, heapMB: Math.max(heapMB, heapAfterMB), queryUs, sizeBytes, results };
}

// ---------------------------------------------------------------- 부모
function main() {
  const { vocab, pages, rand } = makeCorpus();
  const pageSets = pages.map(t => new Set(t.split(' ')));
  const df = new Map();
  for (const s of pageSets) for (const w of s) df.set(w, (df.get(w) || 0) + 1);
  const used = vocab.filter(w => df.has(w));          // 실제로 나온 단어, vocab 순 = 빈도 순
  const pickFrom = (lo, hi) => used[Math.floor(lo + rand() * (hi - lo))];
  const n = used.length;
  const queries = [];
  for (let i = 0; i < 100; i++) queries.push({ kind: '자주', words: [pickFrom(0, n * 0.01)] });
  for (let i = 0; i < 100; i++) queries.push({ kind: '중간', words: [pickFrom(n * 0.01, n * 0.3)] });
  for (let i = 0; i < 100; i++) queries.push({ kind: '드문', words: [pickFrom(n * 0.3, n)] });
  for (let i = 0; i < 100; i++) queries.push({ kind: 'AND', words: [pickFrom(0, n * 0.05), pickFrom(0, n * 0.2)] });
  const truth = queries.map(q => {
    const out = [];
    pageSets.forEach((s, p) => { if (q.words.every(w => s.has(w))) out.push(p); });
    return out;
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fair-bench-'));
  const qf = path.join(tmp, 'queries.json');
  fs.writeFileSync(qf, JSON.stringify(queries));
  console.log(`말뭉치: ${PAGES}쪽 x ${WORDS_PER_PAGE}단어 = ${(PAGES * WORDS_PER_PAGE).toLocaleString()}단어, ${(pages.join('\n').length / 1048576).toFixed(1)}MB, 서로 다른 단어 ${n.toLocaleString()}개`);
  console.log(`질의: 한 단어 300(자주·중간·드문 100씩) + 두 단어 AND 100, node ${process.version}, CPU ${os.cpus().length}코어\n`);

  const rows = [];
  for (const engine of ENGINES) {
    const outDir = fs.mkdtempSync(path.join(tmp, engine + '-'));
    let r;
    try {
      r = JSON.parse(execFileSync(process.execPath, ['--expose-gc', __filename, '--child', engine, qf, outDir, String(PAGES), String(WORDS_PER_PAGE)],
        { encoding: 'utf8', maxBuffer: 1 << 30, timeout: 600000, stdio: ['ignore', 'pipe', 'ignore'] }));
    } catch (e) {
      rows.push({ engine, error: String(e.message).split('\n')[0] });
      continue;
    }
    let tp = 0, fp = 0, fn = 0, exact = 0;
    r.results.forEach((got, i) => {
      const want = new Set(truth[i]);
      const g = new Set(got);
      let hit = 0;
      for (const p of g) if (want.has(p)) hit++;
      tp += hit; fp += g.size - hit; fn += want.size - hit;
      if (hit === want.size && g.size === want.size) exact++;
    });
    rows.push({
      engine, buildMs: r.buildMs, heapMB: r.heapMB, sizeKB: r.sizeBytes / 1024, queryUs: r.queryUs,
      precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1), exact: exact / queries.length,
    });
  }

  const pad = (s, w) => String(s).padStart(w);
  console.log('엔진          색인(ms)  메모리(MB)  저장(KB)  질의(µs)  정밀도   재현율   완전일치');
  for (const r of rows) {
    if (r.error) { console.log(`${r.engine.padEnd(12)} 실패: ${r.error}`); continue; }
    console.log(`${r.engine.padEnd(12)}${pad(r.buildMs.toFixed(0), 9)}${pad(r.heapMB.toFixed(1), 12)}${pad(r.sizeKB.toFixed(0), 10)}${pad(r.queryUs.toFixed(1), 10)}` +
      `${pad((r.precision * 100).toFixed(1) + '%', 9)}${pad((r.recall * 100).toFixed(1) + '%', 9)}${pad((r.exact * 100).toFixed(1) + '%', 10)}`);
  }
  const ok = rows.filter(r => !r.error && r.exact === 1);
  const best = (k) => ok.length ? ok.reduce((a, b) => (a[k] <= b[k] ? a : b)).engine : '-';
  console.log(`\n정답을 100% 맞힌 엔진 중 가장 좋은 것 — 색인: ${best('buildMs')}, 메모리: ${best('heapMB')}, 저장: ${best('sizeKB')}, 질의: ${best('queryUs')}`);
  fs.writeFileSync(path.join(__dirname, 'benchmark-data', `fair-benchmark-results-${PAGES}.json`),
    JSON.stringify({ date: new Date().toISOString(), node: process.version, pages: PAGES, wordsPerPage: WORDS_PER_PAGE, rows }, null, 2));
}

if (IS_CHILD) {
  const [, , , engine, qf, outDir] = process.argv;
  console.log = () => {};                  // 엔진의 안내 출력이 결과 JSON 에 섞이지 않게
  process.stdout.write(JSON.stringify(child(engine, qf, outDir)));
} else {
  main();
}
