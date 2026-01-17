/**
 * Adaptive Indexing System
 * Automatically chooses between single-process and multi-process based on data size
 */

const IndexingSystem = require('./indexing-system');
const ParallelIndexingSystem = require('./parallel-indexing-system');

class AdaptiveIndexingSystem {
  constructor(basePath) {
    this.basePath = basePath;

    // 두 시스템 모두 준비
    this.singleSystem = new IndexingSystem(basePath);
    this.parallelSystem = new ParallelIndexingSystem(basePath);

    // 임계값 설정 (경험적 값, 벤치마크 결과로 조정 가능)
    this.MULTIPROCESS_THRESHOLD = 100000; // 10만 문자 이상일 때 멀티프로세싱 사용
    this.MIN_WORDS_PER_WORKER = 5000;      // 워커당 최소 5천 단어 처리
  }

  /**
   * 지능형 인덱싱: 데이터 크기에 따라 자동으로 최적 방식 선택
   */
  async indexTextSmart(text, meta) {
    const textLength = text.length;
    const estimatedWords = text.split(/\s+/).length;

    console.log(`📊 텍스트 분석:`);
    console.log(`   - 길이: ${textLength.toLocaleString()} 문자`);
    console.log(`   - 예상 단어: ${estimatedWords.toLocaleString()} 개`);

    // 멀티프로세싱 사용 여부 결정
    const useMultiProcess = textLength >= this.MULTIPROCESS_THRESHOLD;

    if (useMultiProcess) {
      console.log(`✅ 멀티프로세싱 모드 선택 (대용량 데이터)`);

      // 최적 워커 수 계산
      const optimalWorkers = Math.min(
        this.parallelSystem.optimalWorkers,
        Math.ceil(estimatedWords / this.MIN_WORDS_PER_WORKER)
      );

      console.log(`   - 워커 수: ${optimalWorkers} 개`);

      // 워커 수 조정
      this.parallelSystem.optimalWorkers = optimalWorkers;

      const result = await this.parallelSystem.indexTextParallel(text, meta);

      // 단어장과 역색인을 통합
      this.singleSystem.wordDict = this.parallelSystem.wordDict;
      this.singleSystem.invertedIndex = this.parallelSystem.invertedIndex;
      this.singleSystem.nextWordId = this.parallelSystem.nextWordId;

      return {
        ...result,
        mode: 'parallel',
        recommendation: 'Optimal for large datasets'
      };

    } else {
      console.log(`✅ 싱글 프로세스 모드 선택 (효율적)`);

      const startTime = Date.now();
      const wordIds = this.singleSystem.indexText(text, meta);
      const duration = Date.now() - startTime;

      return {
        wordIds,
        duration,
        workerCount: 1,
        chunkCount: 1,
        wordsProcessed: wordIds.length,
        mode: 'single',
        recommendation: 'Optimal for small datasets'
      };
    }
  }

  /**
   * 파일별 인덱싱 (자동 모드 선택)
   */
  async indexFile(filePath, meta) {
    const fs = require('fs');
    const text = fs.readFileSync(filePath, 'utf8');
    return await this.indexTextSmart(text, meta);
  }

  /**
   * 저장 메서드들 (통합)
   */
  saveWordDictionary() {
    return this.singleSystem.saveWordDictionary();
  }

  saveInvertedIndex() {
    return this.singleSystem.saveInvertedIndex();
  }

  loadWordDictionary() {
    return this.singleSystem.loadWordDictionary();
  }

  loadInvertedIndex() {
    return this.singleSystem.loadInvertedIndex();
  }

  findPositions(word) {
    return this.singleSystem.findPositions(word);
  }

  getStats() {
    const baseStats = this.singleSystem.getStats();
    return {
      ...baseStats,
      multiprocessThreshold: this.MULTIPROCESS_THRESHOLD,
      minWordsPerWorker: this.MIN_WORDS_PER_WORKER,
      availableWorkers: this.parallelSystem.optimalWorkers
    };
  }

  /**
   * 시스템 권장 사항
   */
  getRecommendation(textLength) {
    if (textLength >= this.MULTIPROCESS_THRESHOLD * 10) {
      return {
        mode: 'parallel',
        reason: '매우 큰 데이터셋 - 멀티프로세싱 강력 권장',
        expectedSpeedup: '5-10x'
      };
    } else if (textLength >= this.MULTIPROCESS_THRESHOLD) {
      return {
        mode: 'parallel',
        reason: '큰 데이터셋 - 멀티프로세싱 권장',
        expectedSpeedup: '2-5x'
      };
    } else if (textLength >= this.MULTIPROCESS_THRESHOLD / 2) {
      return {
        mode: 'adaptive',
        reason: '중간 데이터셋 - 상황에 따라 선택',
        expectedSpeedup: '1-2x'
      };
    } else {
      return {
        mode: 'single',
        reason: '작은 데이터셋 - 싱글 프로세스 권장',
        expectedSpeedup: 'N/A (오버헤드가 더 큼)'
      };
    }
  }
}

module.exports = AdaptiveIndexingSystem;
