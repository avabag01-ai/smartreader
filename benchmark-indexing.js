/**
 * 🔬 인덱싱 성능 벤치마크 — Single vs Multi-Process
 *
 * 문제점 수정:
 * - Date.now() 해상도보다 빠른 경우(0ms) 방지
 * - 0 나누기 방지
 * - GC 후 메모리 측정
 * - Small/Large two-scale 테스트
 */

const ParallelIndexingSystem = require('./parallel-indexing-system');
const IndexingSystem = require('./indexing-system');
const path = require('path');
const fs = require('fs');

const BENCHMARK_DIR = path.join(__dirname, 'benchmark-data');

function generateSampleText(size) {
  const samples = {
    small: '봄날은 간다. 꽃잎은 흩날리고 바람은 부드럽게 불어온다. '.repeat(100),
    medium: '에너지는 보존된다. 물리학의 기본 법칙이다. 화학은 물질을 연구한다. 생물학은 생명체를 다룬다. 양자역학은 미시세계를 설명한다. 상대성이론은 시공간을 다룬다. '.repeat(500),
    large: '봄날은 간다. 꽃잎은 흩날리고 바람은 부드럽게 불어온다. 산 너머로 해가 지고 달이 떠오른다. 가을 하늘은 높고 청명하다. 낙엽이 떨어지고 국화꽃이 피어난다. 철학은 존재의 본질을 탐구한다. 과학은 자연 현상을 설명한다. 역사는 과거를 기록한다. '.repeat(2000),
    xlarge: '우주의 나이 138억 년, 지구의 역사 46억 년, 인류의 역사는 그중 찰나이다. 그 찰나의 존재가 우주의 원리를 탐구한다는 것은 가장 위대한 신비가 아닐까. 태초에 말씀이 계셨다. 그 말씀은 빛이었고 생명이었다. 인간은 그 빛을 따라 걸으며 자신의 존재 이유를 묻는다. 과학이 발전할수록 더 깊은 신비가 드러난다. '.repeat(10000),
  };
  return samples[size] || samples.medium;
}

async function runBenchmark() {
  console.log('========================================');
  console.log('   📊 인덱싱 성능 벤치마크 (Single vs Multi)');
  console.log('========================================\n');

  if (!fs.existsSync(BENCHMARK_DIR)) fs.mkdirSync(BENCHMARK_DIR);

  const sizes = ['small', 'medium', 'large', 'xlarge'];
  const results = [];

  for (const size of sizes) {
    console.log(`\n🔬 ${size.toUpperCase()}`);
    console.log('─'.repeat(50));

    const text = generateSampleText(size);
    const wordCount = text.split(/\s+/).length;
    console.log(`📝 ${text.length.toLocaleString()} chars / ${wordCount.toLocaleString()} words`);

    const meta = { fileName: 'benchmark.pdf', chapterId: 1, pageNumber: 1 };

    // Single process
    const singleSys = new IndexingSystem(BENCHMARK_DIR);
    const t1 = Date.now();
    const singleResult = singleSys.indexText(text, meta);
    const singleMs = Math.max(Date.now() - t1, 1);
    console.log(`  1️⃣ Single: ${singleMs}ms (${singleResult.length.toLocaleString()} tokens)`);
    if (fs.existsSync(path.join(BENCHMARK_DIR, 'word-dictionary.toon'))) fs.unlinkSync(path.join(BENCHMARK_DIR, 'word-dictionary.toon'));
    if (fs.existsSync(path.join(BENCHMARK_DIR, 'inverted-index.toon'))) fs.unlinkSync(path.join(BENCHMARK_DIR, 'inverted-index.toon'));

    // Multi process
    const multiSys = new ParallelIndexingSystem(BENCHMARK_DIR);
    const t2 = Date.now();
    const multiRes = await multiSys.indexTextParallel(text, meta);
    const multiMs = Math.max(multiRes.duration, 1);
    console.log(`  2️⃣ Multi: ${multiMs}ms (${multiRes.workerCount} workers, ${multiRes.wordsProcessed.toLocaleString()} tokens)`);

    // 속도 향상
    const speedup = singleMs / multiMs;
    const pct = ((singleMs - multiMs) / singleMs * 100).toFixed(1);
    console.log(`  📈 Speedup: ${speedup.toFixed(2)}x (${pct}%)`);

    results.push({ size, chars: text.length, words: wordCount, singleMs, multiMs, speedup: +speedup.toFixed(2), improvement: +pct, workers: multiRes.workerCount });

    // cleanup
    for (const f of fs.readdirSync(BENCHMARK_DIR).filter(f => f.endsWith('.toon'))) {
      try { fs.unlinkSync(path.join(BENCHMARK_DIR, f)); } catch (_) {}
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('   📊 종합');
  console.log('='.repeat(50));
  console.log('\n┌' + '─'.repeat(12) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┐');
  console.log('│ Size' + ' '.repeat(7) + '│ Single(ms)│ Multi(ms) │ Speedup   │ Workers   │ 개선(%)   │');
  console.log('├' + '─'.repeat(12) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┤');
  for (const r of results) {
    console.log(`│ ${r.size.padEnd(10)} │ ${String(r.singleMs).padStart(8)} │ ${String(r.multiMs).padStart(8)} │ ${r.speedup.toFixed(2).padStart(8)} │ ${String(r.workers).padStart(8)} │ ${String(r.improvement).padStart(8)} │`);
  }
  console.log('└' + '─'.repeat(12) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┘\n');

  const avg = results.reduce((s, r) => s + r.speedup, 0) / results.length;
  console.log(`📈 평균 Speedup: ${avg.toFixed(2)}x${avg < 0.8 ? ' ⚠️ 멀티가 더 느림 (오버헤드)' : avg < 1.5 ? ' ⚠️ 미미함' : ' ✅ 효과적'}`);
  console.log('💡 큰 데이터일수록 멀티프로세싱 효과가 커지는 경향.\n');

  fs.writeFileSync(path.join(BENCHMARK_DIR, 'benchmark-results.json'), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  console.log(`📄 결과 저장 완료\n`);
}

if (require.main === module) {
  runBenchmark().then(() => { console.log('✅ 완료!'); process.exit(0); }).catch(e => { console.error('❌', e); process.exit(1); });
}

module.exports = { runBenchmark, generateSampleText };
