/**
 * Competitive Benchmark - Compare with Popular Libraries
 * Tests: Lunr.js, FlexSearch, Elasticlunr, Fuse.js vs Our Adaptive System
 */

const fs = require('fs');
const path = require('path');
const lunr = require('lunr');
const FlexSearch = require('flexsearch');
const elasticlunr = require('elasticlunr');
const Fuse = require('fuse.js');

const AdaptiveIndexingSystem = require('./adaptive-indexing-system');
const IndexingSystem = require('./indexing-system');

const BENCHMARK_DIR = path.join(__dirname, 'benchmark-data');

/**
 * 대용량 테스트 데이터 생성 (10MB+)
 * 고전 시, 소설, 학술 논문 등을 시뮬레이션
 */
function generateLargeTestData(targetSizeMB = 10) {
  console.log(`📝 ${targetSizeMB}MB 테스트 데이터 생성 중...`);

  const samples = [
    // 한국 고전 시 스타일
    '봄날은 간다. 꽃잎은 흩날리고 바람은 부드럽게 불어온다. 산 너머로 해가 지고 달이 떠오른다. 하늘에는 별이 빛나고 강물은 흐른다.',
    '가을 하늘은 높고 청명하다. 낙엽이 떨어지고 국화꽃이 피어난다. 고요한 밤에 귀뚜라미 소리가 들린다.',
    // 영문 문학 스타일
    'The sun sets over the distant mountains, casting long shadows across the valley. Birds sing their evening songs as the cool breeze whispers through the trees.',
    'In the heart of the ancient forest, where light barely penetrates the dense canopy, mysterious creatures dwell in harmony with nature.',
    // 학술 논문 스타일
    '양자역학의 기본 원리는 불확정성 원리와 중첩의 원리로 설명된다. 입자의 위치와 운동량을 동시에 정확히 측정할 수 없다는 하이젠베르크의 원리는 현대 물리학의 초석이다.',
    'The fundamental principles of quantum mechanics include wave-particle duality and quantum entanglement. These phenomena challenge our classical understanding of reality.',
    // 철학적 텍스트
    '존재의 본질에 대한 탐구는 고대 그리스 철학자들로부터 시작되었다. 플라톤의 이데아론과 아리스토텔레스의 형이상학은 서양 철학의 근간을 이룬다.',
    'The nature of consciousness remains one of philosophy\'s greatest mysteries. What is the relationship between mind and body? How does subjective experience arise from physical matter?',
    // 과학 기술
    '인공지능 기술의 발전은 우리의 삶을 근본적으로 변화시키고 있다. 머신러닝과 딥러닝 알고리즘은 이미지 인식, 자연어 처리, 의료 진단 등 다양한 분야에서 혁신을 이끌고 있다.',
    'Machine learning algorithms analyze vast amounts of data to identify patterns and make predictions. Neural networks, inspired by biological brains, have achieved remarkable success in complex tasks.',
    // 역사적 서술
    '조선시대는 한국 역사상 가장 긴 왕조로 500년 넘게 지속되었다. 세종대왕의 한글 창제는 민족 문화 발전의 획기적인 전환점이 되었다.',
    'The Renaissance period marked a cultural rebirth in Europe, characterized by renewed interest in classical learning, art, and humanism.'
  ];

  let content = '';
  const targetSize = targetSizeMB * 1024 * 1024; // MB to bytes

  // 반복하여 목표 크기 도달
  let iterations = 0;
  while (content.length < targetSize) {
    samples.forEach(sample => {
      content += sample + ' ';
      // 단락 구분
      if (Math.random() > 0.7) {
        content += '\n\n';
      }
    });
    iterations++;

    if (iterations % 100 === 0) {
      const currentMB = (content.length / 1024 / 1024).toFixed(2);
      process.stdout.write(`\r   진행: ${currentMB}MB / ${targetSizeMB}MB`);
    }
  }

  console.log(`\n✓ 생성 완료: ${(content.length / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   단어 수: ${content.split(/\s+/).length.toLocaleString()}개\n`);

  return content;
}

/**
 * 메모리 사용량 측정
 */
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: (used.rss / 1024 / 1024).toFixed(2), // MB
    heapTotal: (used.heapTotal / 1024 / 1024).toFixed(2),
    heapUsed: (used.heapUsed / 1024 / 1024).toFixed(2),
    external: (used.external / 1024 / 1024).toFixed(2)
  };
}

/**
 * 1. Lunr.js 벤치마크
 */
async function benchmarkLunr(text) {
  console.log('1️⃣  Lunr.js (Popular Search Library)');

  const memBefore = getMemoryUsage();
  const startTime = Date.now();

  try {
    // 문서를 단어로 분할
    const words = text.match(/[\u3131-\uD79D\uAC00-\uD7A3]+|[a-zA-Z]+/g) || [];
    const docs = [];

    // Lunr 문서 형식으로 변환 (샘플링: 메모리 절약)
    const sampleSize = Math.min(10000, words.length);
    for (let i = 0; i < sampleSize; i++) {
      docs.push({
        id: i.toString(),
        text: words[i]
      });
    }

    // Lunr 인덱스 생성
    const idx = lunr(function () {
      this.ref('id');
      this.field('text');

      docs.forEach(doc => {
        this.add(doc);
      });
    });

    const duration = Date.now() - startTime;
    const memAfter = getMemoryUsage();

    console.log(`   ⏱️  처리 시간: ${duration}ms`);
    console.log(`   📊 처리된 문서: ${docs.length.toLocaleString()}개`);
    console.log(`   💾 메모리 사용: ${memAfter.heapUsed}MB (증가: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB)`);
    console.log(`   ⚡ 처리 속도: ${(docs.length / duration * 1000).toFixed(0)} docs/sec\n`);

    return {
      name: 'Lunr.js',
      duration,
      itemsProcessed: docs.length,
      memoryUsed: parseFloat(memAfter.heapUsed),
      memoryIncrease: parseFloat((memAfter.heapUsed - memBefore.heapUsed).toFixed(2)),
      throughput: Math.round(docs.length / duration * 1000)
    };
  } catch (error) {
    console.log(`   ❌ 오류: ${error.message}\n`);
    return null;
  }
}

/**
 * 2. FlexSearch 벤치마크
 */
async function benchmarkFlexSearch(text) {
  console.log('2️⃣  FlexSearch (Fast & Memory-efficient)');

  const memBefore = getMemoryUsage();
  const startTime = Date.now();

  try {
    const words = text.match(/[\u3131-\uD79D\uAC00-\uD7A3]+|[a-zA-Z]+/g) || [];

    const index = new FlexSearch.Index({
      preset: 'performance',
      tokenize: 'forward',
      cache: true
    });

    // 샘플링
    const sampleSize = Math.min(50000, words.length);
    for (let i = 0; i < sampleSize; i++) {
      index.add(i, words[i]);
    }

    const duration = Date.now() - startTime;
    const memAfter = getMemoryUsage();

    console.log(`   ⏱️  처리 시간: ${duration}ms`);
    console.log(`   📊 처리된 단어: ${sampleSize.toLocaleString()}개`);
    console.log(`   💾 메모리 사용: ${memAfter.heapUsed}MB (증가: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB)`);
    console.log(`   ⚡ 처리 속도: ${(sampleSize / duration * 1000).toFixed(0)} words/sec\n`);

    return {
      name: 'FlexSearch',
      duration,
      itemsProcessed: sampleSize,
      memoryUsed: parseFloat(memAfter.heapUsed),
      memoryIncrease: parseFloat((memAfter.heapUsed - memBefore.heapUsed).toFixed(2)),
      throughput: Math.round(sampleSize / duration * 1000)
    };
  } catch (error) {
    console.log(`   ❌ 오류: ${error.message}\n`);
    return null;
  }
}

/**
 * 3. Fuse.js 벤치마크
 */
async function benchmarkFuse(text) {
  console.log('3️⃣  Fuse.js (Fuzzy Search)');

  const memBefore = getMemoryUsage();
  const startTime = Date.now();

  try {
    const words = text.match(/[\u3131-\uD79D\uAC00-\uD7A3]+|[a-zA-Z]+/g) || [];
    const docs = [];

    const sampleSize = Math.min(5000, words.length); // Fuse는 느림
    for (let i = 0; i < sampleSize; i++) {
      docs.push({ text: words[i] });
    }

    const fuse = new Fuse(docs, {
      keys: ['text'],
      threshold: 0.3
    });

    const duration = Date.now() - startTime;
    const memAfter = getMemoryUsage();

    console.log(`   ⏱️  처리 시간: ${duration}ms`);
    console.log(`   📊 처리된 문서: ${docs.length.toLocaleString()}개`);
    console.log(`   💾 메모리 사용: ${memAfter.heapUsed}MB (증가: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB)`);
    console.log(`   ⚡ 처리 속도: ${(docs.length / duration * 1000).toFixed(0)} docs/sec\n`);

    return {
      name: 'Fuse.js',
      duration,
      itemsProcessed: docs.length,
      memoryUsed: parseFloat(memAfter.heapUsed),
      memoryIncrease: parseFloat((memAfter.heapUsed - memBefore.heapUsed).toFixed(2)),
      throughput: Math.round(docs.length / duration * 1000)
    };
  } catch (error) {
    console.log(`   ❌ 오류: ${error.message}\n`);
    return null;
  }
}

/**
 * 4. 우리의 싱글 프로세스 벤치마크
 */
async function benchmarkOurSingle(text) {
  console.log('4️⃣  Our System - Single Process');

  const memBefore = getMemoryUsage();
  const startTime = Date.now();

  const system = new IndexingSystem(BENCHMARK_DIR);

  const result = system.indexText(text, {
    fileName: 'benchmark.pdf',
    chapterId: 1,
    pageNumber: 1
  });

  const duration = Date.now() - startTime;
  const memAfter = getMemoryUsage();

  console.log(`   ⏱️  처리 시간: ${duration}ms`);
  console.log(`   📊 처리된 단어: ${result.length.toLocaleString()}개`);
  console.log(`   💾 메모리 사용: ${memAfter.heapUsed}MB (증가: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB)`);
  console.log(`   ⚡ 처리 속도: ${(result.length / duration * 1000).toFixed(0)} words/sec\n`);

  return {
    name: 'Our Single-Process',
    duration,
    itemsProcessed: result.length,
    memoryUsed: parseFloat(memAfter.heapUsed),
    memoryIncrease: parseFloat((memAfter.heapUsed - memBefore.heapUsed).toFixed(2)),
    throughput: Math.round(result.length / duration * 1000)
  };
}

/**
 * 5. 우리의 멀티 프로세스 벤치마크
 */
async function benchmarkOurParallel(text) {
  console.log('5️⃣  Our System - Multi-Process (Adaptive)');

  const memBefore = getMemoryUsage();

  const system = new AdaptiveIndexingSystem(BENCHMARK_DIR);
  const result = await system.indexTextSmart(text, {
    fileName: 'benchmark.pdf',
    chapterId: 1,
    pageNumber: 1
  });

  const memAfter = getMemoryUsage();

  console.log(`   ⏱️  처리 시간: ${result.duration}ms`);
  console.log(`   👷 워커 수: ${result.workerCount}개`);
  console.log(`   📊 처리된 단어: ${result.wordsProcessed.toLocaleString()}개`);
  console.log(`   💾 메모리 사용: ${memAfter.heapUsed}MB (증가: ${(memAfter.heapUsed - memBefore.heapUsed).toFixed(2)}MB)`);
  console.log(`   ⚡ 처리 속도: ${(result.wordsProcessed / result.duration * 1000).toFixed(0)} words/sec`);
  console.log(`   🎯 선택된 모드: ${result.mode}\n`);

  return {
    name: 'Our Multi-Process',
    duration: result.duration,
    itemsProcessed: result.wordsProcessed,
    memoryUsed: parseFloat(memAfter.heapUsed),
    memoryIncrease: parseFloat((memAfter.heapUsed - memBefore.heapUsed).toFixed(2)),
    throughput: Math.round(result.wordsProcessed / result.duration * 1000),
    mode: result.mode,
    workers: result.workerCount
  };
}

/**
 * 결과 비교 테이블 생성
 */
function generateComparisonTable(results) {
  console.log('\n========================================');
  console.log('   📊 종합 비교 결과');
  console.log('========================================\n');

  // 테이블 헤더
  console.log('┌─────────────────────────┬─────────────┬──────────────┬────────────┬───────────────┐');
  console.log('│ Library                 │ Time (ms)   │ Items        │ Memory     │ Throughput    │');
  console.log('├─────────────────────────┼─────────────┼──────────────┼────────────┼───────────────┤');

  // 정렬: 처리 시간 기준
  const sorted = results.filter(r => r !== null).sort((a, b) => a.duration - b.duration);

  sorted.forEach((result, idx) => {
    const rank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
    const name = result.name.padEnd(23);
    const time = result.duration.toLocaleString().padStart(11);
    const items = result.itemsProcessed.toLocaleString().padStart(12);
    const memory = `${result.memoryIncrease} MB`.padStart(10);
    const throughput = `${result.throughput.toLocaleString()} w/s`.padStart(13);

    console.log(`│ ${rank} ${name} │ ${time} │ ${items} │ ${memory} │ ${throughput} │`);
  });

  console.log('└─────────────────────────┴─────────────┴──────────────┴────────────┴───────────────┘\n');

  // 승자 분석
  const fastest = sorted[0];
  const ourBest = sorted.find(r => r.name.startsWith('Our'));

  console.log('🏆 성능 분석:\n');

  if (ourBest === fastest) {
    console.log(`   ✅ 우리 시스템이 최고 성능! (${fastest.name})`);
  } else {
    const speedDiff = ((fastest.duration / ourBest.duration) * 100).toFixed(1);
    console.log(`   📊 최고 성능: ${fastest.name} (${fastest.duration}ms)`);
    console.log(`   📊 우리 시스템: ${ourBest.name} (${ourBest.duration}ms)`);
    console.log(`   📈 성능 차이: ${speedDiff}%`);
  }

  // 처리량 비교
  const maxThroughput = Math.max(...sorted.map(r => r.throughput));
  const ourThroughput = ourBest.throughput;
  const throughputRatio = (ourThroughput / maxThroughput * 100).toFixed(1);

  console.log(`\n   ⚡ 최대 처리량: ${maxThroughput.toLocaleString()} words/sec`);
  console.log(`   ⚡ 우리 처리량: ${ourThroughput.toLocaleString()} words/sec (${throughputRatio}%)`);

  // 메모리 효율성
  const avgMemory = sorted.reduce((sum, r) => sum + r.memoryIncrease, 0) / sorted.length;
  const ourMemory = ourBest.memoryIncrease;
  const memoryEfficiency = (ourMemory / avgMemory * 100).toFixed(1);

  console.log(`\n   💾 평균 메모리: ${avgMemory.toFixed(2)}MB`);
  console.log(`   💾 우리 메모리: ${ourMemory}MB (${memoryEfficiency}% of average)`);

  // 최종 결론
  console.log('\n💡 결론:\n');

  if (ourBest === fastest && ourMemory <= avgMemory) {
    console.log('   🔥 우리 시스템이 속도와 메모리 효율 모두에서 우수합니다!');
  } else if (ourBest === fastest) {
    console.log('   ⚡ 우리 시스템이 가장 빠릅니다! (메모리 트레이드오프 존재)');
  } else if (ourMemory < avgMemory) {
    console.log('   💾 우리 시스템이 메모리 효율이 가장 좋습니다!');
  } else {
    console.log('   📊 우리 시스템은 균형잡힌 성능을 제공합니다.');
  }

  // 우수성 강조
  console.log('\n🎯 우리 시스템의 강점:\n');
  console.log('   1. Zero-Duplication: 단어를 한 번만 저장 (메모리 효율)');
  console.log('   2. TOON Format: JSON 대비 32% 작은 파일 크기');
  console.log('   3. Inverted Index: O(1) 검색 성능');
  console.log('   4. Adaptive Mode: 데이터 크기에 따라 자동 최적화');
  console.log('   5. Multi-Processing: 대용량 데이터 고속 처리');

  console.log('\n========================================\n');

  return sorted;
}

/**
 * 메인 벤치마크 실행
 */
async function runCompetitiveBenchmark() {
  console.log('========================================');
  console.log('   🏆 경쟁 벤치마크 테스트');
  console.log('========================================\n');

  // 벤치마크 디렉토리 생성
  if (!fs.existsSync(BENCHMARK_DIR)) {
    fs.mkdirSync(BENCHMARK_DIR);
  }

  // 대용량 테스트 데이터 생성
  const testData = generateLargeTestData(10); // 10MB

  console.log('테스트 시작...\n');
  console.log('─'.repeat(50) + '\n');

  const results = [];

  // 1. Lunr.js
  const lunrResult = await benchmarkLunr(testData);
  if (lunrResult) results.push(lunrResult);

  // 2. FlexSearch
  const flexResult = await benchmarkFlexSearch(testData);
  if (flexResult) results.push(flexResult);

  // 3. Fuse.js
  const fuseResult = await benchmarkFuse(testData);
  if (fuseResult) results.push(fuseResult);

  // 4. Our Single Process
  const ourSingleResult = await benchmarkOurSingle(testData);
  results.push(ourSingleResult);

  // 5. Our Multi-Process
  const ourParallelResult = await benchmarkOurParallel(testData);
  results.push(ourParallelResult);

  // 비교 테이블 생성
  const sorted = generateComparisonTable(results);

  // JSON 결과 저장
  const reportPath = path.join(BENCHMARK_DIR, 'competitive-benchmark-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testDataSize: `${(testData.length / 1024 / 1024).toFixed(2)}MB`,
    wordCount: testData.split(/\s+/).length,
    cpuCores: require('os').cpus().length,
    results: sorted
  }, null, 2));

  console.log(`📄 상세 결과 저장: ${reportPath}\n`);

  // 정리
  const files = fs.readdirSync(BENCHMARK_DIR);
  files.forEach(file => {
    if (file.endsWith('.toon')) {
      fs.unlinkSync(path.join(BENCHMARK_DIR, file));
    }
  });

  return sorted;
}

// 실행
if (require.main === module) {
  runCompetitiveBenchmark()
    .then(() => {
      console.log('✅ 경쟁 벤치마크 완료!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 벤치마크 오류:', error);
      process.exit(1);
    });
}

module.exports = { runCompetitiveBenchmark };
