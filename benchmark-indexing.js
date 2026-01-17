/**
 * Indexing Performance Benchmark
 * Compares Single-process vs Multi-processing performance
 */

const ParallelIndexingSystem = require('./parallel-indexing-system');
const IndexingSystem = require('./indexing-system');
const path = require('path');
const fs = require('fs');

const BENCHMARK_DIR = path.join(__dirname, 'benchmark-data');

// 벤치마크용 샘플 텍스트 생성
function generateSampleText(size = 'medium') {
  const samples = {
    small: '물리학은 자연 현상을 연구하는 학문입니다. '.repeat(100),
    medium: '에너지는 보존된다. 물리학의 기본 법칙이다. 화학은 물질을 연구한다. 생물학은 생명체를 다룬다. '.repeat(500),
    large: '양자역학은 미시세계를 설명한다. 상대성이론은 시공간을 다룬다. 열역학은 에너지 변환을 연구한다. '.repeat(2000),
    xlarge: '물리학은 자연의 근본 원리를 탐구한다. 화학은 물질의 구조와 성질을 연구한다. 생물학은 생명 현상을 이해한다. '.repeat(5000)
  };

  return samples[size] || samples.medium;
}

// 벤치마크 실행
async function runBenchmark() {
  console.log('========================================');
  console.log('   📊 인덱싱 성능 벤치마크');
  console.log('========================================\n');

  // 벤치마크 디렉토리 생성
  if (!fs.existsSync(BENCHMARK_DIR)) {
    fs.mkdirSync(BENCHMARK_DIR);
  }

  const sizes = ['small', 'medium', 'large', 'xlarge'];
  const results = [];

  for (const size of sizes) {
    console.log(`\n🔬 테스트 크기: ${size.toUpperCase()}`);
    console.log('─'.repeat(50));

    const text = generateSampleText(size);
    const wordCount = text.split(/\s+/).length;

    console.log(`📝 텍스트 길이: ${text.length.toLocaleString()} 문자`);
    console.log(`📝 단어 개수: ${wordCount.toLocaleString()} 개\n`);

    const meta = {
      fileName: 'benchmark.pdf',
      chapterId: 1,
      pageNumber: 1
    };

    // 1. 싱글 프로세스 벤치마크
    console.log('1️⃣  싱글 프로세스 모드');
    const singleSystem = new IndexingSystem(BENCHMARK_DIR);

    const singleStart = Date.now();
    const singleResult = singleSystem.indexText(text, meta);
    const singleDuration = Date.now() - singleStart;

    console.log(`   ⏱️  처리 시간: ${singleDuration}ms`);
    console.log(`   📊 단어 처리: ${singleResult.length.toLocaleString()} 개`);
    console.log(`   ⚡ 처리 속도: ${(singleResult.length / singleDuration * 1000).toFixed(0)} words/sec\n`);

    // 2. 멀티 프로세스 벤치마크
    console.log('2️⃣  멀티 프로세스 모드');
    const parallelSystem = new ParallelIndexingSystem(BENCHMARK_DIR);

    const parallelStart = Date.now();
    const parallelResult = await parallelSystem.indexTextParallel(text, meta);
    const parallelDuration = parallelResult.duration;

    console.log(`   ⏱️  처리 시간: ${parallelDuration}ms`);
    console.log(`   👷 워커 수: ${parallelResult.workerCount} 개`);
    console.log(`   📊 단어 처리: ${parallelResult.wordsProcessed.toLocaleString()} 개`);
    console.log(`   ⚡ 처리 속도: ${(parallelResult.wordsProcessed / parallelDuration * 1000).toFixed(0)} words/sec\n`);

    // 3. 성능 비교
    const speedup = (singleDuration / parallelDuration).toFixed(2);
    const timeSaved = singleDuration - parallelDuration;
    const improvement = ((timeSaved / singleDuration) * 100).toFixed(1);

    console.log('📈 성능 비교');
    console.log(`   🚀 속도 향상: ${speedup}x`);
    console.log(`   ⏰ 시간 단축: ${timeSaved}ms (${improvement}% 개선)`);

    if (speedup >= 2) {
      console.log(`   ✅ 멀티프로세싱 효과: 탁월함! 🎉`);
    } else if (speedup >= 1.5) {
      console.log(`   ✅ 멀티프로세싱 효과: 우수함 👍`);
    } else if (speedup >= 1.1) {
      console.log(`   ⚠️  멀티프로세싱 효과: 보통 (오버헤드 존재)`);
    } else {
      console.log(`   ⚠️  멀티프로세싱 효과: 미미함 (텍스트 크기가 작음)`);
    }

    results.push({
      size,
      textLength: text.length,
      wordCount,
      singleDuration,
      parallelDuration,
      speedup: parseFloat(speedup),
      timeSaved,
      improvement: parseFloat(improvement)
    });

    // 정리
    if (fs.existsSync(path.join(BENCHMARK_DIR, 'word-dictionary.toon'))) {
      fs.unlinkSync(path.join(BENCHMARK_DIR, 'word-dictionary.toon'));
    }
    if (fs.existsSync(path.join(BENCHMARK_DIR, 'inverted-index.toon'))) {
      fs.unlinkSync(path.join(BENCHMARK_DIR, 'inverted-index.toon'));
    }
  }

  // 최종 요약
  console.log('\n========================================');
  console.log('   📊 종합 벤치마크 결과');
  console.log('========================================\n');

  console.log('크기별 성능 향상:');
  results.forEach(r => {
    const emoji = r.speedup >= 2 ? '🔥' : r.speedup >= 1.5 ? '⚡' : '📊';
    console.log(`  ${emoji} ${r.size.padEnd(10)} : ${r.speedup}x 빠름 (${r.improvement}% 개선)`);
  });

  const avgSpeedup = (results.reduce((sum, r) => sum + r.speedup, 0) / results.length).toFixed(2);
  const avgImprovement = (results.reduce((sum, r) => sum + r.improvement, 0) / results.length).toFixed(1);

  console.log(`\n📈 평균 성능 향상: ${avgSpeedup}x`);
  console.log(`📈 평균 시간 단축: ${avgImprovement}%`);

  // 권장 사항
  console.log('\n💡 권장 사항:');
  if (avgSpeedup >= 2) {
    console.log('   ✅ 멀티프로세싱을 적극 사용하세요!');
    console.log('   ✅ 대용량 PDF 처리에 최적화되어 있습니다.');
  } else if (avgSpeedup >= 1.5) {
    console.log('   ✅ 멀티프로세싱 사용 권장');
    console.log('   ⚠️  소량 데이터에서는 싱글 프로세스가 나을 수 있음');
  } else {
    console.log('   ⚠️  데이터 크기가 작으면 싱글 프로세스 사용 권장');
    console.log('   ⚠️  멀티프로세싱 오버헤드가 이득보다 클 수 있음');
  }

  console.log('\n========================================\n');

  // 결과를 JSON 파일로 저장
  const reportPath = path.join(BENCHMARK_DIR, 'benchmark-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    cpuCores: require('os').cpus().length,
    results,
    summary: {
      avgSpeedup,
      avgImprovement
    }
  }, null, 2));

  console.log(`📄 상세 결과 저장: ${reportPath}\n`);

  // 정리
  if (fs.existsSync(BENCHMARK_DIR)) {
    const files = fs.readdirSync(BENCHMARK_DIR);
    files.forEach(file => {
      if (file.endsWith('.toon')) {
        fs.unlinkSync(path.join(BENCHMARK_DIR, file));
      }
    });
  }

  return results;
}

// 실행
if (require.main === module) {
  runBenchmark()
    .then(() => {
      console.log('✅ 벤치마크 완료!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 벤치마크 오류:', error);
      process.exit(1);
    });
}

module.exports = { runBenchmark, generateSampleText };
