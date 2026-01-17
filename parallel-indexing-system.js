/**
 * Parallel Indexing System - Multi-processing engine
 * Utilizes all CPU cores for maximum indexing performance
 */

const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const fs = require('fs');

class ParallelIndexingSystem {
  constructor(basePath) {
    this.basePath = basePath;
    this.wordDict = new Map(); // 단어 → ID 매핑
    this.nextWordId = 1;
    this.invertedIndex = new Map(); // 단어 ID → 위치 배열

    // CPU 코어 개수 자동 감지 (효율적인 worker 수: 코어 수 - 1)
    this.numCores = os.cpus().length;
    this.optimalWorkers = Math.max(1, this.numCores - 1);

    console.log(`💻 CPU 정보: ${this.numCores}개 코어 감지`);
    console.log(`⚡ 최적 워커 수: ${this.optimalWorkers}개`);
  }

  /**
   * 텍스트를 청크로 분할 (각 워커가 처리할 단위)
   */
  splitTextIntoChunks(text, numChunks) {
    const chunkSize = Math.ceil(text.length / numChunks);
    const chunks = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        text: text.substring(start, end),
        startOffset: i * Math.ceil(text.split(/\s+/).length / numChunks)
      });
    }

    return chunks;
  }

  /**
   * 병렬 텍스트 인덱싱 (멀티프로세싱)
   */
  async indexTextParallel(text, meta) {
    const startTime = Date.now();

    // 텍스트를 워커 수만큼 청크로 분할
    const chunks = this.splitTextIntoChunks(text, this.optimalWorkers);

    // 각 청크를 병렬로 처리
    const promises = chunks.map((chunk, idx) => {
      return this.processChunkInWorker(chunk.text, meta, chunk.startOffset);
    });

    // 모든 워커 완료 대기
    const results = await Promise.all(promises);

    // 결과 병합
    const allWordPositions = results.flat();

    // 단어 ID 부여 및 역색인 구축
    const wordIds = [];
    allWordPositions.forEach(({ word, position }) => {
      const wordId = this.getWordId(word);
      wordIds.push(wordId);

      if (!this.invertedIndex.has(wordId)) {
        this.invertedIndex.set(wordId, []);
      }
      this.invertedIndex.get(wordId).push(position);
    });

    const duration = Date.now() - startTime;

    return {
      wordIds,
      duration,
      workerCount: this.optimalWorkers,
      chunkCount: chunks.length,
      wordsProcessed: allWordPositions.length
    };
  }

  /**
   * Worker 스레드에서 청크 처리
   */
  processChunkInWorker(text, meta, startOffset) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'indexing-worker.js'), {
        workerData: { text, meta, startOffset }
      });

      worker.on('message', (message) => {
        if (message.success) {
          resolve(message.results);
        } else {
          reject(new Error(message.error));
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  /**
   * 단일 프로세스 인덱싱 (비교용)
   */
  indexTextSingle(text, meta) {
    const startTime = Date.now();

    const tokens = this.tokenize(text);
    const wordIds = [];

    tokens.forEach((word, idx) => {
      const wordId = this.getWordId(word);
      wordIds.push(wordId);

      const position = {
        f: meta.fileName,
        c: meta.chapterId,
        p: meta.pageNumber,
        o: idx
      };

      if (!this.invertedIndex.has(wordId)) {
        this.invertedIndex.set(wordId, []);
      }
      this.invertedIndex.get(wordId).push(position);
    });

    const duration = Date.now() - startTime;

    return {
      wordIds,
      duration,
      workerCount: 1,
      chunkCount: 1,
      wordsProcessed: tokens.length
    };
  }

  /**
   * 토크나이저 (단일 프로세스용)
   */
  tokenize(text) {
    const tokens = text.match(/[\u3131-\uD79D\uAC00-\uD7A3]+|[a-zA-Z]+|[0-9]+/g) || [];
    return tokens.map(t => t.toLowerCase());
  }

  /**
   * 단어 ID 가져오기 (없으면 생성)
   */
  getWordId(word) {
    if (!this.wordDict.has(word)) {
      this.wordDict.set(word, this.nextWordId++);
    }
    return this.wordDict.get(word);
  }

  /**
   * TOON 포맷으로 단어장 저장
   */
  saveWordDictionary() {
    const lines = ['id|word'];

    const sortedEntries = Array.from(this.wordDict.entries())
      .sort((a, b) => a[1] - b[1]);

    sortedEntries.forEach(([word, id]) => {
      lines.push(`${id}|${word}`);
    });

    const filePath = path.join(this.basePath, 'word-dictionary.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    return filePath;
  }

  /**
   * TOON 포맷으로 역색인 저장
   */
  saveInvertedIndex() {
    const lines = ['wid|f|c|p|o'];

    Array.from(this.invertedIndex.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([wordId, positions]) => {
        positions.forEach(pos => {
          lines.push(`${wordId}|${pos.f}|${pos.c}|${pos.p}|${pos.o}`);
        });
      });

    const filePath = path.join(this.basePath, 'inverted-index.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    return filePath;
  }

  /**
   * 단어장 로드
   */
  loadWordDictionary() {
    const filePath = path.join(this.basePath, 'word-dictionary.toon');

    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [id, word] = line.split('|');
      this.wordDict.set(word, parseInt(id));
      this.nextWordId = Math.max(this.nextWordId, parseInt(id) + 1);
    }

    return true;
  }

  /**
   * 역색인 로드
   */
  loadInvertedIndex() {
    const filePath = path.join(this.basePath, 'inverted-index.toon');

    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [wid, f, c, p, o] = line.split('|');
      const wordId = parseInt(wid);
      const position = {
        f,
        c: parseInt(c),
        p: parseInt(p),
        o: parseInt(o)
      };

      if (!this.invertedIndex.has(wordId)) {
        this.invertedIndex.set(wordId, []);
      }
      this.invertedIndex.get(wordId).push(position);
    }

    return true;
  }

  /**
   * 단어로 위치 검색
   */
  findPositions(word) {
    const wordId = this.wordDict.get(word.toLowerCase());
    if (!wordId) return [];

    return this.invertedIndex.get(wordId) || [];
  }

  /**
   * 통계 정보
   */
  getStats() {
    const totalPositions = Array.from(this.invertedIndex.values())
      .reduce((sum, positions) => sum + positions.length, 0);

    return {
      uniqueWords: this.wordDict.size,
      totalPositions,
      avgPositionsPerWord: (totalPositions / this.wordDict.size).toFixed(2),
      cpuCores: this.numCores,
      optimalWorkers: this.optimalWorkers
    };
  }
}

module.exports = ParallelIndexingSystem;
