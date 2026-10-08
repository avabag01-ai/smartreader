const fs = require('fs');
const os = require('os');
const path = require('path');
const IndexingSystem = require('../indexing-system');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'idx-test-'));

function sample(ix) {
  ix.indexText('에너지 보존 법칙 Energy is conserved 에너지', { fileName: 'a.pdf', chapterId: 1, pageNumber: 1 });
  ix.indexText('운동 에너지 kinetic energy 2024', { fileName: 'a.pdf', chapterId: 1, pageNumber: 2 });
  ix.indexText('보존 conserved', { fileName: 'b.pdf', chapterId: 3, pageNumber: 7, offset: 40 });
  ix.indexText('에너지 다시 앞 페이지', { fileName: 'a.pdf', chapterId: 1, pageNumber: 1, offset: 100 });
  ix.indexText('반복 반복 반복 끝 반복', { fileName: 'c.pdf', chapterId: 2, pageNumber: 9 });
  ix.indexText('먼 오프셋', { fileName: 'c.pdf', chapterId: 2, pageNumber: 9, offset: 123456789 });
  ix.indexText('반복', { fileName: 'c.pdf', chapterId: 2, pageNumber: 9, offset: 3 });   // 오프셋이 뒤로 감
}

const pages = (list) => list.map(d => `${d.f}/${d.c}/${d.p}`).sort();

test('findPositions 는 예전처럼 {f,c,p,o} 위치를 넣은 순서대로 준다', () => {
  const ix = new IndexingSystem(tmp());
  sample(ix);
  expect(ix.findPositions('에너지')).toEqual([
    { f: 'a.pdf', c: 1, p: 1, o: 0 }, { f: 'a.pdf', c: 1, p: 1, o: 6 },
    { f: 'a.pdf', c: 1, p: 2, o: 1 }, { f: 'a.pdf', c: 1, p: 1, o: 100 },
  ]);
  expect(ix.findPositions('ENERGY').length).toBe(2);
  expect(ix.findPositions('없는말')).toEqual([]);
  expect(ix.findPositions('반복').map(p => p.o)).toEqual([0, 1, 2, 4, 3]);
});

test('searchPages 는 모든 단어가 있는 페이지만, 앞 페이지에 나중에 더해도 맞다', () => {
  const ix = new IndexingSystem(tmp());
  sample(ix);
  expect(pages(ix.searchPages('에너지'))).toEqual(['a.pdf/1/1', 'a.pdf/1/2']);
  expect(pages(ix.searchPages('보존 conserved'))).toEqual(['a.pdf/1/1', 'b.pdf/3/7']);
  expect(pages(ix.searchPages('에너지 kinetic'))).toEqual(['a.pdf/1/2']);
  expect(pages(ix.searchPages('다시 법칙'))).toEqual(['a.pdf/1/1']);
  expect(ix.searchPages('에너지 없는말')).toEqual([]);
  expect(pages(ix.searchPages('반복 끝'))).toEqual(['c.pdf/2/9']);
});

test('TOON v2 저장 -> 불러오기 하면 위치·검색·통계가 같다', () => {
  const dir = tmp();
  const a = new IndexingSystem(dir);
  sample(a);
  a.saveWordDictionary();
  a.saveInvertedIndex();
  const b = new IndexingSystem(dir);
  b.loadWordDictionary();
  b.loadInvertedIndex();
  for (const w of a.wordDict.keys()) {
    const sort = (l) => l.map(p => JSON.stringify(p)).sort();
    expect(sort(b.findPositions(w))).toEqual(sort(a.findPositions(w)));
  }
  expect(b.getStats()).toEqual(a.getStats());
  expect(pages(b.searchPages('보존 conserved'))).toEqual(pages(a.searchPages('보존 conserved')));
  expect(b.getWordId('새말')).toBe(a.nextWordId);
});

test('예전(v1) TOON 파일도 읽는다', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'word-dictionary.toon'), 'id|word\n1|에너지\n2|보존');
  fs.writeFileSync(path.join(dir, 'inverted-index.toon'), 'wid|f|c|p|o\n1|a.pdf|1|1|0\n1|a.pdf|1|2|3\n2|a.pdf|1|2|4');
  const ix = new IndexingSystem(dir);
  ix.loadWordDictionary();
  ix.loadInvertedIndex();
  expect(ix.findPositions('에너지')).toEqual([{ f: 'a.pdf', c: 1, p: 1, o: 0 }, { f: 'a.pdf', c: 1, p: 2, o: 3 }]);
  expect(pages(ix.searchPages('에너지 보존'))).toEqual(['a.pdf/1/2']);
});

test('invertedIndex 는 Map 처럼 읽히고, Map 을 넣으면 그대로 옮겨진다 (병렬 색인 결과)', () => {
  const ix = new IndexingSystem(tmp());
  sample(ix);
  const id = ix.wordDict.get('보존');
  expect(ix.invertedIndex.has(id)).toBe(true);
  expect(ix.invertedIndex.get(id)).toEqual(ix.findPositions('보존'));
  expect(ix.invertedIndex.size).toBe(ix.wordDict.size);

  const other = new IndexingSystem(tmp());
  other.wordDict = new Map([['x', 1], ['y', 2]]);
  other.invertedIndex = new Map([[1, [{ f: 'z.pdf', c: 1, p: 5, o: 0 }]], [2, [{ f: 'z.pdf', c: 1, p: 5, o: 1 }]]]);
  other.nextWordId = 3;
  expect(pages(other.searchPages('x y'))).toEqual(['z.pdf/1/5']);
});

test('getContextWords 는 그 페이지의 오프셋 근처 단어를 준다', () => {
  const ix = new IndexingSystem(tmp());
  sample(ix);
  expect(ix.getContextWords('a.pdf', 1, 2, 50).sort()).toEqual(['2024', 'energy', 'kinetic', '에너지', '운동'].sort());
  expect(ix.getContextWords('없음.pdf', 1, 1)).toEqual([]);
});

test('검색한 뒤에 페이지를 더 넣어도 결과가 새로 반영된다 (검색 캐시)', () => {
  const ix = new IndexingSystem(tmp());
  ix.indexText('사과 사과 배', { fileName: 'a.pdf', chapterId: 1, pageNumber: 5 });
  expect(pages(ix.searchPages('사과'))).toEqual(['a.pdf/1/5']);
  ix.indexText('사과', { fileName: 'a.pdf', chapterId: 1, pageNumber: 9 });
  expect(pages(ix.searchPages('사과'))).toEqual(['a.pdf/1/5', 'a.pdf/1/9']);
  ix.indexText('사과 사과', { fileName: 'a.pdf', chapterId: 1, pageNumber: 2 });   // 앞 페이지
  expect(pages(ix.searchPages('사과'))).toEqual(['a.pdf/1/2', 'a.pdf/1/5', 'a.pdf/1/9']);
  expect(pages(ix.searchPages('사과 배'))).toEqual(['a.pdf/1/5']);
});
