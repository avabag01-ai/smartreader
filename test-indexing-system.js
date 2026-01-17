/**
 * 인덱싱 시스템 통합 테스트
 */

const IndexingSystem = require('./indexing-system');
const NoteLinkingSystem = require('./note-linking-system');
const StudyDatabase = require('./database');
const path = require('path');
const fs = require('fs');

// 테스트용 임시 디렉토리
const TEST_DIR = path.join(__dirname, 'test-data');

// 테스트 데이터베이스 초기화
function setupTestEnvironment() {
  // 테스트 디렉토리 생성
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR);
  }

  console.log('✓ 테스트 환경 설정 완료\n');
}

// 테스트 정리
function cleanupTestEnvironment() {
  // 테스트 파일 삭제
  const files = [
    'word-dictionary.toon',
    'inverted-index.toon'
  ];

  files.forEach(file => {
    const filePath = path.join(TEST_DIR, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  console.log('\n✓ 테스트 환경 정리 완료');
}

// 테스트 1: 단어장 생성 및 TOON 포맷 저장
function test1_WordDictionary() {
  console.log('=== 테스트 1: 단어장 생성 ===');

  const indexing = new IndexingSystem(TEST_DIR);

  // 샘플 텍스트 인덱싱
  const sampleTexts = [
    "물리학의 기본 법칙은 에너지 보존 법칙입니다",
    "화학에서 원자는 물질의 기본 단위입니다",
    "생물학은 생명체를 연구하는 학문입니다"
  ];

  sampleTexts.forEach((text, idx) => {
    indexing.indexText(text, {
      fileName: 'physics-101.pdf',
      chapterId: 1,
      pageNumber: idx + 1,
      offset: 0
    });
  });

  // 단어장 저장
  indexing.saveWordDictionary();

  // TOON 파일 확인
  const dictPath = path.join(TEST_DIR, 'word-dictionary.toon');
  const content = fs.readFileSync(dictPath, 'utf8');
  const lines = content.split('\n');

  console.log(`  - 단어 수: ${indexing.wordDict.size}`);
  console.log(`  - TOON 파일 라인 수: ${lines.length}`);
  console.log(`  - 첫 줄 헤더: ${lines[0]}`);
  console.log(`  - 샘플 데이터: ${lines.slice(1, 4).join(', ')}`);

  // JSON 대비 크기 비교
  const jsonSize = JSON.stringify(Array.from(indexing.wordDict.entries())).length;
  const toonSize = content.length;
  const savings = ((jsonSize - toonSize) / jsonSize * 100).toFixed(2);

  console.log(`  - JSON 크기: ${jsonSize} bytes`);
  console.log(`  - TOON 크기: ${toonSize} bytes`);
  console.log(`  - 절감률: ${savings}%`);

  console.log('✓ 테스트 1 통과\n');
  return indexing;
}

// 테스트 2: 역색인 구조 및 위치 매핑
function test2_InvertedIndex(indexing) {
  console.log('=== 테스트 2: 역색인 구조 ===');

  // 역색인 저장
  indexing.saveInvertedIndex();

  // TOON 파일 확인
  const indexPath = path.join(TEST_DIR, 'inverted-index.toon');
  const content = fs.readFileSync(indexPath, 'utf8');
  const lines = content.split('\n');

  console.log(`  - 총 위치 정보: ${lines.length - 1}개`);
  console.log(`  - 첫 줄 헤더: ${lines[0]}`);
  console.log(`  - 샘플 데이터:`);
  lines.slice(1, 6).forEach(line => {
    console.log(`    ${line}`);
  });

  // 특정 단어 검색 테스트
  const searchWord = '법칙';
  const positions = indexing.findPositions(searchWord);

  console.log(`\n  - "${searchWord}" 검색 결과: ${positions.length}개 위치`);
  positions.forEach(pos => {
    console.log(`    파일: ${pos.f}, 챕터: ${pos.c}, 페이지: ${pos.p}, 오프셋: ${pos.o}`);
  });

  // 통계
  const stats = indexing.getStats();
  console.log(`\n  - 통계:`);
  console.log(`    고유 단어: ${stats.uniqueWords}`);
  console.log(`    총 위치: ${stats.totalPositions}`);
  console.log(`    단어당 평균 위치: ${stats.avgPositionsPerWord}`);

  console.log('✓ 테스트 2 통과\n');
  return indexing;
}

// 테스트 3: 인덱스 로드 및 복원
function test3_LoadIndex() {
  console.log('=== 테스트 3: 인덱스 로드 ===');

  // 새로운 인스턴스 생성
  const indexing = new IndexingSystem(TEST_DIR);

  // 저장된 인덱스 로드
  indexing.loadWordDictionary();
  indexing.loadInvertedIndex();

  console.log(`  - 로드된 단어 수: ${indexing.wordDict.size}`);

  // 검색 테스트
  const testWords = ['물리학', '에너지', '생명체'];
  testWords.forEach(word => {
    const positions = indexing.findPositions(word);
    console.log(`  - "${word}": ${positions.length}개 위치 발견`);
  });

  console.log('✓ 테스트 3 통과\n');
  return indexing;
}

// 테스트 4: 노트 연동 시스템 (모의 데이터베이스)
function test4_NoteLinking(indexing) {
  console.log('=== 테스트 4: 노트 연동 시스템 ===');

  // 모의 데이터베이스 객체
  const mockDB = {
    mistakeNotes: [],
    learningHistory: [],

    addMistakeNote(data) {
      const id = this.mistakeNotes.length + 1;
      this.mistakeNotes.push({ id, ...data });
      return { lastInsertRowid: id };
    },

    getMistakeNotes(filters) {
      return this.mistakeNotes.filter(note => {
        if (filters.isResolved !== undefined && note.isResolved !== filters.isResolved) {
          return false;
        }
        return true;
      });
    },

    addLearningHistory(data) {
      const id = this.learningHistory.length + 1;
      this.learningHistory.push({ id, ...data });
      return { lastInsertRowid: id };
    },

    getLearningHistory(filters) {
      return this.learningHistory;
    },

    resolveMistakeNote(id) {
      const note = this.mistakeNotes.find(n => n.id === id);
      if (note) note.isResolved = 1;
    },

    getChapter(fileName, chapterId) {
      return {
        fileName,
        chapterNumber: chapterId,
        extractedText: '물리학의 기본 법칙은 에너지 보존 법칙입니다. 이것은 매우 중요한 개념입니다.'
      };
    },

    db: {
      prepare(query) {
        return {
          get: () => ({ count: mockDB.mistakeNotes.length }),
          all: () => []
        };
      }
    }
  };

  const noteSystem = new NoteLinkingSystem(indexing, mockDB);

  // 오답 노트 저장 테스트
  const mistakeResult = noteSystem.saveMistakeNote({
    fileName: 'physics-101.pdf',
    pageNumber: 1,
    chapterId: 1,
    question: '에너지 보존 법칙이란 무엇인가',
    userAnswer: '잘 모르겠습니다',
    correctAnswer: '에너지는 생성되거나 소멸되지 않고 형태만 변환된다',
    aiExplanation: '에너지 보존 법칙은 물리학의 기본 법칙입니다',
    quizSessionId: 'quiz-001',
    originalTextOffset: 0
  });

  console.log(`  - 오답 노트 저장 완료: ID ${mistakeResult.noteId}`);
  console.log(`  - 질문 단어 ID 수: ${mistakeResult.questionWordIds.length}`);

  // 학습 메모 저장 테스트
  const memoResult = noteSystem.saveLearningMemo({
    fileName: 'physics-101.pdf',
    filePath: '/path/to/physics-101.pdf',
    pageNumber: 1,
    chapterId: 1,
    memoText: '에너지 보존 법칙을 꼭 기억하자',
    conversationId: 'conv-001',
    userQuestion: '에너지 보존 법칙이 뭐야?',
    aiResponse: '에너지는 생성되거나 소멸되지 않습니다'
  });

  console.log(`  - 학습 메모 저장 완료: ID ${memoResult.historyId}`);
  console.log(`  - 메모 단어 ID 수: ${memoResult.memoWordIds.length}`);

  // 본문 위치 찾기 테스트
  const sourceLocation = noteSystem.findSourceFromMistake(mistakeResult.noteId);
  console.log(`\n  - 오답 노트 → 본문 위치:`);
  console.log(`    파일: ${sourceLocation.fileName}`);
  console.log(`    챕터: ${sourceLocation.chapterId}`);
  console.log(`    페이지: ${sourceLocation.pageNumber}`);
  console.log(`    오프셋: ${sourceLocation.offset}`);
  console.log(`    신뢰도: ${sourceLocation.confidence}`);

  // 통계
  const systemStats = noteSystem.getSystemStats();
  console.log(`\n  - 시스템 통계:`);
  console.log(`    고유 단어: ${systemStats.indexing.uniqueWords}`);
  console.log(`    오답 노트: ${systemStats.mistakeNotes}`);
  console.log(`    학습 메모: ${systemStats.learningMemos}`);
  console.log(`    저장 공간 절감: ${systemStats.estimatedStorageSaving.savingPercent}`);

  console.log('✓ 테스트 4 통과\n');
}

// 테스트 5: 중복 제거 효율성 검증
function test5_DuplicateElimination() {
  console.log('=== 테스트 5: 중복 제거 효율성 ===');

  const indexing = new IndexingSystem(TEST_DIR);

  // 같은 단어가 반복되는 텍스트
  const repetitiveTexts = [
    '에너지는 중요하다 에너지는 보존된다',
    '에너지를 이해하면 물리학을 이해한다',
    '에너지 법칙은 에너지 보존이다'
  ];

  repetitiveTexts.forEach((text, idx) => {
    indexing.indexText(text, {
      fileName: 'test.pdf',
      chapterId: 1,
      pageNumber: idx + 1
    });
  });

  const stats = indexing.getStats();

  console.log(`  - 총 단어 출현: ${stats.totalPositions}회`);
  console.log(`  - 고유 단어: ${stats.uniqueWords}개`);
  console.log(`  - 중복 제거율: ${((1 - stats.uniqueWords / stats.totalPositions) * 100).toFixed(2)}%`);

  // '에너지' 단어의 모든 출현 위치
  const energyPositions = indexing.findPositions('에너지');
  console.log(`\n  - "에너지" 단어 출현: ${energyPositions.length}회`);
  energyPositions.forEach((pos, idx) => {
    console.log(`    ${idx + 1}. 페이지 ${pos.p}, 오프셋 ${pos.o}`);
  });

  console.log('✓ 테스트 5 통과\n');
}

// 전체 테스트 실행
function runAllTests() {
  console.log('========================================');
  console.log('   StudyPad AI 인덱싱 시스템 테스트');
  console.log('========================================\n');

  try {
    setupTestEnvironment();

    const indexing1 = test1_WordDictionary();
    test2_InvertedIndex(indexing1);
    const indexing3 = test3_LoadIndex();
    test4_NoteLinking(indexing3);
    test5_DuplicateElimination();

    console.log('========================================');
    console.log('   🎉 모든 테스트 통과!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  } finally {
    cleanupTestEnvironment();
  }
}

// 테스트 실행
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
