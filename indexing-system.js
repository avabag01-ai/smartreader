/**
 * StudyPad AI - 지능형 데이터 인덱싱 시스템
 * TOON 포맷 기반 경량화 데이터 구조
 */

const fs = require('fs');
const path = require('path');

class IndexingSystem {
  constructor(basePath) {
    this.basePath = basePath;
    this.wordDict = new Map(); // 단어 → ID 매핑 (메모리)
    this.nextWordId = 1;
    this.invertedIndex = new Map(); // 단어 ID → 위치 배열
  }

  /**
   * 텍스트에서 단어 추출 및 ID 부여
   */
  tokenize(text) {
    // 한글, 영문, 숫자 단위로 토큰화
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
   * 본문 텍스트를 인덱싱 (챕터, 페이지, 오프셋)
   */
  indexText(text, meta) {
    const { fileName, chapterId, pageNumber, offset = 0 } = meta;
    const tokens = this.tokenize(text);

    tokens.forEach((word, idx) => {
      const wordId = this.getWordId(word);
      const position = {
        f: fileName,        // 파일명
        c: chapterId,       // 챕터 ID
        p: pageNumber,      // 페이지 번호
        o: offset + idx     // 오프셋
      };

      if (!this.invertedIndex.has(wordId)) {
        this.invertedIndex.set(wordId, []);
      }
      this.invertedIndex.get(wordId).push(position);
    });

    // 단어 ID 배열 반환 (중복 제거된 형태)
    return tokens.map(word => this.getWordId(word));
  }

  /**
   * TOON 포맷으로 단어장 저장
   * 형식: 첫 줄 헤더 | 이후 데이터만 나열
   */
  saveWordDictionary() {
    const lines = ['id|word']; // 헤더

    // ID 순서대로 정렬하여 저장
    const sortedEntries = Array.from(this.wordDict.entries())
      .sort((a, b) => a[1] - b[1]); // value(ID)로 정렬

    sortedEntries.forEach(([word, id]) => {
      lines.push(`${id}|${word}`);
    });

    const filePath = path.join(this.basePath, 'word-dictionary.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    console.log(`✓ 단어장 저장 완료: ${this.wordDict.size}개 단어`);
    return filePath;
  }

  /**
   * TOON 포맷으로 역색인 저장
   * 형식: wordId|fileName|chapterId|pageNumber|offset
   */
  saveInvertedIndex() {
    const lines = ['wid|f|c|p|o']; // 헤더 (축약형)

    // 단어 ID별로 모든 위치 정보 저장
    Array.from(this.invertedIndex.entries())
      .sort((a, b) => a[0] - b[0]) // 단어 ID 순서대로 정렬
      .forEach(([wordId, positions]) => {
        positions.forEach(pos => {
          lines.push(`${wordId}|${pos.f}|${pos.c}|${pos.p}|${pos.o}`);
        });
      });

    const filePath = path.join(this.basePath, 'inverted-index.toon');
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    console.log(`✓ 역색인 저장 완료: ${lines.length - 1}개 위치 정보`);
    return filePath;
  }

  /**
   * TOON 포맷에서 단어장 로드
   */
  loadWordDictionary() {
    const filePath = path.join(this.basePath, 'word-dictionary.toon');

    if (!fs.existsSync(filePath)) {
      console.log('단어장 파일이 없습니다.');
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // 첫 줄은 헤더이므로 스킵
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [id, word] = line.split('|');
      this.wordDict.set(word, parseInt(id));
      this.nextWordId = Math.max(this.nextWordId, parseInt(id) + 1);
    }

    console.log(`✓ 단어장 로드 완료: ${this.wordDict.size}개 단어`);
    return true;
  }

  /**
   * TOON 포맷에서 역색인 로드
   */
  loadInvertedIndex() {
    const filePath = path.join(this.basePath, 'inverted-index.toon');

    if (!fs.existsSync(filePath)) {
      console.log('역색인 파일이 없습니다.');
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // 첫 줄은 헤더이므로 스킵
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

    console.log(`✓ 역색인 로드 완료`);
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
   * 특정 위치의 컨텍스트 단어들 가져오기
   * (오답 노트/메모에서 본문으로 이동 시 사용)
   */
  getContextWords(fileName, chapterId, pageNumber, offsetRange = 50) {
    const contextWords = new Set();

    this.invertedIndex.forEach((positions, wordId) => {
      positions.forEach(pos => {
        if (pos.f === fileName &&
            pos.c === chapterId &&
            pos.p === pageNumber &&
            Math.abs(pos.o - offsetRange) < 100) {
          // 역으로 단어 찾기
          for (let [word, id] of this.wordDict.entries()) {
            if (id === wordId) {
              contextWords.add(word);
              break;
            }
          }
        }
      });
    });

    return Array.from(contextWords);
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
      avgPositionsPerWord: (totalPositions / this.wordDict.size).toFixed(2)
    };
  }
}

module.exports = IndexingSystem;
