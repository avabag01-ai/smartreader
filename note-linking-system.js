/**
 * 오답노트/학습메모와 본문 인덱스 연동 시스템
 */

const IndexingSystem = require('./indexing-system');

class NoteLinkingSystem {
  constructor(indexingSystem, database) {
    this.indexing = indexingSystem;
    this.db = database;
  }

  /**
   * 오답 노트 저장 (단어 ID 기반)
   * 텍스트를 직접 저장하지 않고 단어 ID 배열로 저장
   */
  saveMistakeNote(data) {
    const {
      fileName,
      pageNumber,
      chapterId,
      question,
      userAnswer,
      correctAnswer,
      aiExplanation,
      quizSessionId,
      originalTextOffset = 0
    } = data;

    // 원문 텍스트를 단어 ID로 변환
    const questionWordIds = this.indexing.indexText(question, {
      fileName,
      chapterId,
      pageNumber,
      offset: originalTextOffset
    });

    const correctAnswerWordIds = correctAnswer ?
      this.indexing.indexText(correctAnswer, {
        fileName,
        chapterId,
        pageNumber,
        offset: originalTextOffset + 100
      }) : null;

    // TOON 포맷으로 단어 ID 배열 저장 (파이프 구분)
    const questionIds = questionWordIds.join(',');
    const answerIds = correctAnswerWordIds ? correctAnswerWordIds.join(',') : null;

    // 데이터베이스에 저장 (기존 스키마 활용)
    const result = this.db.addMistakeNote({
      fileName,
      pageNumber,
      originalText: questionIds,  // 단어 ID 배열 저장
      question,                    // 원본 질문 (검색용)
      userAnswer,
      correctAnswer: answerIds,    // 단어 ID 배열 저장
      aiExplanation,
      quizSessionId
    });

    // 인덱스 파일 업데이트
    this.indexing.saveWordDictionary();
    this.indexing.saveInvertedIndex();

    return {
      noteId: result.lastInsertRowid,
      questionWordIds,
      correctAnswerWordIds
    };
  }

  /**
   * 학습 메모 저장 (단어 ID 기반)
   */
  saveLearningMemo(data) {
    const {
      fileName,
      filePath,
      pageNumber,
      chapterId,
      memoText,
      conversationId,
      userQuestion,
      aiResponse
    } = data;

    // 메모 텍스트를 단어 ID로 변환
    const memoWordIds = this.indexing.indexText(memoText, {
      fileName,
      chapterId,
      pageNumber,
      offset: 0
    });

    const memoIdsString = memoWordIds.join(',');

    // 데이터베이스에 저장
    const result = this.db.addLearningHistory({
      fileName,
      filePath,
      pageNumber,
      chapterNumber: chapterId,
      textContent: memoIdsString,  // 단어 ID 배열 저장
      conversationId,
      userQuestion,
      aiResponse,
      userMemo: memoText,          // 원본 메모 (표시용)
      timeSpent: 0
    });

    // 인덱스 파일 업데이트
    this.indexing.saveWordDictionary();
    this.indexing.saveInvertedIndex();

    return {
      historyId: result.lastInsertRowid,
      memoWordIds
    };
  }

  /**
   * 오답 노트에서 본문 위치 찾기
   * 오답 노트의 단어 ID를 역색인에서 조회하여 본문 위치 반환
   */
  findSourceFromMistake(mistakeNoteId) {
    // 오답 노트 조회
    const stmt = this.db.db.prepare('SELECT * FROM MistakeNote WHERE id = ?');
    const note = stmt.get(mistakeNoteId);

    if (!note) return null;

    // 단어 ID 배열 파싱 (값이 없을 경우 대비)
    if (!note.originalText || note.originalText === '') {
      return {
        fileName: note.fileName,
        pageNumber: note.pageNumber,
        chapterId: null,
        offset: 0,
        confidence: 'low'
      };
    }

    const wordIds = note.originalText.split(',').map(id => parseInt(id));

    // 첫 번째 단어의 위치들 찾기
    const firstWordId = wordIds[0];
    const positions = this.indexing.invertedIndex.get(firstWordId) || [];

    // 해당 페이지의 위치 필터링
    const matchedPositions = positions.filter(pos =>
      pos.f === note.fileName && pos.p === note.pageNumber
    );

    if (matchedPositions.length === 0) {
      // 단어 ID로부터 위치를 찾지 못한 경우, 파일과 페이지 정보만 반환
      return {
        fileName: note.fileName,
        pageNumber: note.pageNumber,
        chapterId: null,
        offset: 0,
        confidence: 'low'
      };
    }

    // 가장 가까운 위치 반환
    const bestMatch = matchedPositions[0];

    return {
      fileName: bestMatch.f,
      chapterId: bestMatch.c,
      pageNumber: bestMatch.p,
      offset: bestMatch.o,
      confidence: 'high',
      contextWords: this.indexing.getContextWords(
        bestMatch.f,
        bestMatch.c,
        bestMatch.p,
        bestMatch.o
      )
    };
  }

  /**
   * 학습 메모에서 본문 위치 찾기
   */
  findSourceFromMemo(historyId) {
    const stmt = this.db.db.prepare('SELECT * FROM LearningHistory WHERE id = ?');
    const history = stmt.get(historyId);

    if (!history) return null;

    // 단어 ID 배열 파싱 (값이 없을 경우 대비)
    if (!history.textContent || history.textContent === '') {
      return {
        fileName: history.fileName,
        pageNumber: history.pageNumber,
        chapterId: history.chapterNumber,
        offset: 0,
        confidence: 'low'
      };
    }

    const wordIds = history.textContent.split(',').map(id => parseInt(id));

    // 첫 번째 단어의 위치들 찾기
    const firstWordId = wordIds[0];
    const positions = this.indexing.invertedIndex.get(firstWordId) || [];

    // 해당 페이지의 위치 필터링
    const matchedPositions = positions.filter(pos =>
      pos.f === history.fileName && pos.p === history.pageNumber
    );

    if (matchedPositions.length === 0) {
      return {
        fileName: history.fileName,
        pageNumber: history.pageNumber,
        chapterId: history.chapterNumber,
        offset: 0,
        confidence: 'low'
      };
    }

    const bestMatch = matchedPositions[0];

    return {
      fileName: bestMatch.f,
      chapterId: bestMatch.c,
      pageNumber: bestMatch.p,
      offset: bestMatch.o,
      confidence: 'high',
      contextWords: this.indexing.getContextWords(
        bestMatch.f,
        bestMatch.c,
        bestMatch.p,
        bestMatch.o
      )
    };
  }

  /**
   * 본문에서 특정 위치의 원문 복원
   * 단어 ID 배열로부터 원문 텍스트 재구성
   */
  reconstructText(wordIdsString) {
    if (!wordIdsString || wordIdsString === '') return '';

    const wordIds = wordIdsString.split(',').map(id => parseInt(id));
    const words = [];

    // 역으로 단어 찾기
    wordIds.forEach(id => {
      for (let [word, wordId] of this.indexing.wordDict.entries()) {
        if (wordId === id) {
          words.push(word);
          break;
        }
      }
    });

    return words.join(' ');
  }

  /**
   * 오답 노트 목록 조회 (본문 연동 정보 포함)
   */
  getMistakeNotesWithLinks(filters = {}) {
    const notes = this.db.getMistakeNotes(filters);

    return notes.map(note => ({
      ...note,
      sourceLink: this.findSourceFromMistake(note.id),
      reconstructedQuestion: this.reconstructText(note.originalText),
      reconstructedAnswer: this.reconstructText(note.correctAnswer)
    }));
  }

  /**
   * 학습 메모 목록 조회 (본문 연동 정보 포함)
   */
  getLearningMemosWithLinks(filters = {}) {
    const memos = this.db.getLearningHistory(filters);

    return memos.map(memo => ({
      ...memo,
      sourceLink: this.findSourceFromMemo(memo.id),
      reconstructedContent: this.reconstructText(memo.textContent)
    }));
  }

  /**
   * 전체 통계 (인덱싱 + 노트 연동)
   */
  getSystemStats() {
    const indexStats = this.indexing.getStats();
    const mistakeCount = this.db.db.prepare('SELECT COUNT(*) as count FROM MistakeNote').get().count;
    const memoCount = this.db.db.prepare('SELECT COUNT(*) as count FROM LearningHistory').get().count;

    return {
      indexing: indexStats,
      mistakeNotes: mistakeCount,
      learningMemos: memoCount,
      estimatedStorageSaving: this.calculateStorageSaving()
    };
  }

  /**
   * 저장 공간 절감률 계산
   */
  calculateStorageSaving() {
    const avgWordLength = 5; // 평균 단어 길이
    const avgIdLength = 3;   // 단어 ID 길이 (숫자 3자리 가정)

    const originalSize = this.indexing.getStats().totalPositions * avgWordLength;
    const indexedSize = this.indexing.getStats().totalPositions * avgIdLength;

    const savingPercent = ((originalSize - indexedSize) / originalSize * 100).toFixed(2);

    return {
      original: `${(originalSize / 1024).toFixed(2)} KB`,
      indexed: `${(indexedSize / 1024).toFixed(2)} KB`,
      savingPercent: `${savingPercent}%`
    };
  }
}

module.exports = NoteLinkingSystem;
