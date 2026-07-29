/**
 * =========================================================================================
 * SmartReader Main Process (Electron)
 * =========================================================================================
 * 
 * 이 파일은 Electron 애플리케이션의 메인 프로세스를 담당합니다.
 * 주요 기능:
 * 1. 애플리케이션 수명 주기 관리 (시작, 종료, 창 관리)
 * 2. PDF 파일 처리 (텍스트 추출, 메타데이터 분석)
 * 3. 로컬 데이터베이스 연동 (SQLite)
 * 4. AI 서비스 통합 (Google Gemini - 스트리밍 지원)
 * 5. IPC(Inter-Process Communication) 인터페이스 제공 (렌더러 프로세스와 통신)
 * 
 * 작성자: 김영일 (Antigravity AI Assistant)
 * 최종 수정일: 2026-01-18
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// axios 라이브러리 제거됨 (Ollama API 미사용)
const StudyDatabase = require('./database'); // 로컬 SQLite 데이터베이스 모듈
const config = require('./config'); // 환경 변수 및 설정 관리 모듈

// PDF.js 라이브러리 로드 (레거시 빌드 사용)
// PDF 텍스트 추출 및 파싱을 위해 사용됩니다.
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

let mainWindow; // 메인 윈도우 인스턴스 저장 변수
let db; // 데이터베이스 인스턴스 저장 변수

// Google Generative AI (API 방식) 설정 제거됨 - WebView 사용으로 전환
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// 환경 변수 로드 상태 로깅
console.log('✅ 환경 변수 로드 완료.');

/**
 * 메인 윈도우 생성 함수
 * Electron 브라우저 창을 생성하고 설정을 적용합니다.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, // 창 너비
    height: 900, // 창 높이
    webPreferences: {
      nodeIntegration: false, // 보안: Node.js 통합 비활성화
      contextIsolation: true, // 보안: 컨텍스트 격리 활성화 (권장)
      webviewTag: true,       // ✨ [중요] WebView 태그 활성화 (Gemini)
      preload: path.join(__dirname, 'preload.js') // 프리로드 스크립트 연결
    }
  });

  // index.html 파일을 로드하여 UI 표시
  mainWindow.loadFile('index.html');

  // 개발 모드일 경우 개발자 도구 자동 실행 (디버깅 편의성)
  // 배포 시에는 주석 처리하는 것이 좋습니다.
  mainWindow.webContents.openDevTools();
}

// =========================================================================================
// 애플리케이션 수명 주기 이벤트 핸들러
// =========================================================================================

// 앱이 준비되면 실행 (초기화)
app.whenReady().then(() => {
  console.log('🚀 애플리케이션 시작...');
  // 데이터베이스 인스턴스 생성 및 테이블 초기화
  db = new StudyDatabase();
  // UI 창 생성
  createWindow();
});

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  // DB 연결 종료로 리소스 정리
  if (db) {
    db.close();
  }
  // macOS가 아니면 앱 완전히 종료
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱이 활성화될 때 (macOS Dock 아이콘 클릭 등) 창이 없으면 새로 생성
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// =========================================================================================
// PDF 처리 로직 (텍스트 추출 및 구조 분석)
// =========================================================================================

/**
 * PDF 파일에서 텍스트를 추출하는 비동기 함수
 * @param {string} filePath - PDF 파일의 절대 경로
 * @returns {Promise<Object>} 추출된 텍스트와 메타데이터
 */
async function extractTextFromPDF(filePath) {
  try {
    console.log(`📂 PDF 파싱 시작: ${filePath}`);

    // 파일을 바이너리 버퍼로 읽음
    const data = new Uint8Array(fs.readFileSync(filePath));

    // PDF 문서를 로드 (비동기 작업)
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;

    const numPages = pdfDocument.numPages; // 전체 페이지 수
    console.log(`📄 총 페이지 수: ${numPages}`);

    let fullText = '';
    const pageTexts = [];

    // 1페이지부터 끝까지 순회하며 텍스트 추출
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (pageNum % 10 === 0) console.log(`⏳ 처리 중: 페이지 ${pageNum}/${numPages}...`);

      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // 페이지 내의 텍스트 아이템들을 공백으로 연결하여 하나의 문자열로 만듦
      const pageText = textContent.items.map(item => item.str).join(' ');

      // 페이지별 데이터 저장
      pageTexts.push({ pageNum, text: pageText });
      // 전체 텍스트 누적
      fullText += pageText + '\n\n';
    }

    console.log(`✅ PDF 파싱 완료. 총 텍스트 길이: ${fullText.length}자`);

    return {
      text: fullText,
      numPages: numPages,
      pageTexts: pageTexts,
      pdfDocument: pdfDocument // 챕터 추출을 위해 문서 객체도 반환
    };
  } catch (error) {
    console.error('❌ PDF 파싱 중 치명적 오류:', error);
    throw error;
  }
}

/**
 * PDF 내장 목차(Outline) 정보를 이용하여 챕터를 추출하는 함수
 * @param {Object} pdfDocument - PDF.js 문서 객체
 * @returns {Array|null} 추출된 챕터 배열 또는 실패 시 null
 */
async function extractChaptersFromOutline(pdfDocument) {
  try {
    console.log('--- [Chapter Logic] 내장 목차 추출 시도 ---');

    // PDF 내장 아웃라인 가져오기
    const outline = await pdfDocument.getOutline();

    // 목차가 없는 경우 처리
    if (!outline || outline.length === 0) {
      console.log('ℹ️ PDF에 내장된 목차 정보가 없습니다.');
      return null;
    }

    console.log(`ℹ️ ${outline.length}개의 목차 항목 발견.`);
    const chapters = [];
    let chapterNum = 1;

    // 목차 아이템 순회
    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];
      let pageNum = null;

      try {
        // Destination(목표 위치) 정보가 있는지 확인
        if (item.dest) {
          // Destination이 문자열인 경우 실제 참조 객체로 변환
          const dest = typeof item.dest === 'string'
            ? await pdfDocument.getDestination(item.dest)
            : item.dest;

          // 참조 객체로부터 페이지 인덱스 획득
          if (dest && dest[0]) {
            const pageRef = dest[0];
            const pageIndex = await pdfDocument.getPageIndex(pageRef);
            pageNum = pageIndex + 1; // 0-based를 1-based로 변환
          }
        }

        // 페이지 번호를 성공적으로 찾은 경우 챕터 추가
        if (pageNum) {
          chapters.push({
            number: chapterNum,
            title: item.title, // 목차 제목
            startPage: pageNum
            // endPage는 나중에 다음 챕터의 startPage를 보고 계산
          });
          chapterNum++;
        }
      } catch (itemError) {
        console.warn(`⚠️ 목차 항목(${item.title}) 처리 중 오류 스킵:`, itemError);
        continue;
      }
    }

    // 각 챕터의 끝 페이지(endPage) 계산
    for (let i = 0; i < chapters.length; i++) {
      if (i < chapters.length - 1) {
        // 다음 챕터 시작 바로 전 페이지
        chapters[i].endPage = chapters[i + 1].startPage - 1;
      } else {
        // 마지막 챕터는 문서의 끝까지
        chapters[i].endPage = pdfDocument.numPages;
      }
    }

    console.log(`✅ 총 ${chapters.length}개의 챕터를 내장 목차에서 추출했습니다.`);
    return chapters;

  } catch (error) {
    console.error('❌ 목차 추출 로직 오류:', error);
    return null;
  }
}

/**
 * 챕터 추출 메인 함수 (전략 패턴)
 * 1. 내장 목차(Outline) 추출 시도
 * 2. 실패 시 페이지 수에 따라 자동 분할(Fallback)
 */
async function extractChapters(pdfData) {
  console.log('🔍 챕터 추출 프로세스 시작...');

  try {
    // 1단계: 내장 목차 시도
    if (pdfData.pdfDocument) {
      const outlineChapters = await extractChaptersFromOutline(pdfData.pdfDocument);

      if (outlineChapters && outlineChapters.length > 0) {
        return outlineChapters; // 성공 시 반환
      }
    }

    // 2단계: 실패했거나 목차가 없으면 자동 분할 실행
    console.log('ℹ️ 자동 분할(Auto-Split) 모드로 진입합니다.');
    const autoChapters = autoSplitChapters(pdfData.numPages);
    return autoChapters.chapters;

  } catch (error) {
    console.error('❌ 챕터 추출 중 예외 발생, 자동 분할로 복구 시도:', error);
    const fallbackChapters = autoSplitChapters(pdfData.numPages);
    return fallbackChapters.chapters;
  }
}

/**
 * 페이지 수에 기반한 단순 자동 분할 함수
 * 문서 길이에 따라 분할 단위(10/20/30페이지)를 조정합니다.
 */
function autoSplitChapters(numPages) {
  const chapters = [];
  let pagesPerChapter;

  // 분할 정책 결정
  if (numPages <= 50) {
    pagesPerChapter = 10; // 소형 문서
  } else if (numPages <= 150) {
    pagesPerChapter = 20; // 중형 문서
  } else {
    pagesPerChapter = 30; // 대형 문서
  }

  let chapterNum = 1;
  // 루프를 돌며 챕터 생성
  for (let startPage = 1; startPage <= numPages; startPage += pagesPerChapter) {
    const endPage = Math.min(startPage + pagesPerChapter - 1, numPages);
    chapters.push({
      number: chapterNum,
      title: `Part ${chapterNum} (페이지 ${startPage}-${endPage})`,
      startPage: startPage,
      endPage: endPage
    });
    chapterNum++;
  }

  console.log(`✅ ${chapters.length}개의 파트로 자동 분할되었습니다.`);
  return { chapters };
}

// =========================================================================================
// IPC 핸들러 (렌더러 프로세스 요청 처리)
// =========================================================================================

/**
 * [IPC] 'select-pdf': 사용자가 PDF 파일을 선택할 때 호출
 * 파일 선택 대화상자 표시 -> 텍스트 추출 -> 챕터 분석 -> DB 저장을 수행합니다.
 */
ipcMain.handle('select-pdf', async () => {
  // 파일 열기 대화상자
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled) return null; // 취소됨

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);

  try {
    // 1. 텍스트 추출
    const pdfData = await extractTextFromPDF(filePath);

    // 2. 챕터 처리 및 DB 저장
    if (db) {
      // 기존 해당 파일의 챕터 데이터 삭제 (덮어쓰기)
      db.deleteChapters(fileName);

      // 챕터 전략 실행
      const chapters = await extractChapters(pdfData);

      // 각 챕터별 텍스트 매핑 및 저장
      for (const chapter of chapters) {
        // 해당 챕터 범위에 속하는 페이지들의 텍스트만 필터링
        const chapterPages = pdfData.pageTexts.filter(
          p => p.pageNum >= chapter.startPage && p.pageNum <= chapter.endPage
        );
        const chapterText = chapterPages.map(p => p.text).join('\n\n');

        // DB에 삽입
        db.addChapter({
          fileName: fileName,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          extractedText: chapterText
        });
      }
      console.log(`💾 ${chapters.length}개 챕터 데이터베이스 저장 완료.`);
    }

    // 렌더러로 결과 반환
    return {
      fileName: fileName,
      filePath: filePath,
      text: pdfData.text,
      numPages: pdfData.numPages,
      pageTexts: pdfData.pageTexts
    };
  } catch (error) {
    console.error('❌ 파일 처리 실패:', error);
    return { error: error.message };
  }
});

/**
 * [IPC] 'get-ai-response': 삭제됨 (WebView 전환)
 */

/**
 * [IPC] 'get-chapters': 파일의 모든 챕터 목록 조회
 */
ipcMain.handle('get-chapters', async (event, fileName) => {
  try {
    if (!db) return { success: false, error: 'DB 미초기화' };
    const chapters = db.getChapters(fileName);
    return { success: true, chapters: chapters };
  } catch (error) {
    console.error('챕터 조회 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * [IPC] 'get-chapter': 특정 번호의 챕터 상세 정보 조회
 */
ipcMain.handle('get-chapter', async (event, fileName, chapterNumber) => {
  try {
    if (!db) return { success: false, error: 'DB 미초기화' };
    const chapter = db.getChapter(fileName, chapterNumber);
    return { success: true, chapter: chapter };
  } catch (error) {
    console.error('개별 챕터 조회 실패:', error);
    return { success: false, error: error.message };
  }
});

// =========================================================================================
// 퀴즈 시스템 (자체 알고리즘)
// =========================================================================================

/**
 * 텍스트에서 주요 키워드(명사, 영단어)를 추출하는 함수
 * 빈도수 기반으로 상위 키워드를 선정합니다.
 */
function extractKeyTerms(text, count = 20) {
  // 정규식으로 한글 명사(2글자 이상), 영단어(3글자 이상), 숫자 추출 (간이 형태소 분석)
  const words = text.match(/[가-힣]{2,}|[A-Za-z]{3,}|[0-9]+/g) || [];

  // 의미 없는 불용어(Stopwords) 제거
  const stopWords = ['것', '수', '등', '및', '또는', '하는', '되는', '있는', '없는', '대한', '위한', '통해', '따라', '의해', '경우', '가장'];
  const filtered = words.filter(w => !stopWords.includes(w));

  // 단어 빈도수 계산
  const frequency = {};
  filtered.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // 빈도수 내림차순 정렬 후 상위 count개 반환
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

/**
 * 문장을 기반으로 빈칸 채우기(Cloze) 퀴즈를 생성하는 함수
 */
function generateBlankQuestion(sentence, term, pageNum) {
  // 정답 단어를 빈칸(______)으로 치환
  const questionText = sentence.replace(new RegExp(term, 'g'), '______');

  // 70% 확률로 객관식, 30% 확률로 주관식 생성
  const isMultipleChoice = Math.random() < 0.7;

  if (isMultipleChoice) {
    // [객관식] 오답 보기 생성 (단순 변형)
    // 실제로는 더 정교한 오답 생성 로직(유의어 등)이 필요하지만 여기선 간단히 처리
    const wrongAnswers = [
      term + '형',
      term.slice(0, -1) + '식', // 끝글자 변경
      term + '체',
      '비' + term // 접두사 추가
    ].slice(0, 3);

    // 정답과 오답을 합치고 섞기(Shuffle)
    const choices = [term, ...wrongAnswers].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(term) + 1; // 1-based index

    return {
      type: '객관식',
      question: `다음 빈칸에 들어갈 알맞은 말은?\n\n"${questionText}"`,
      choices: choices,
      answer: correctIndex.toString(),
      explanation: `정답은 "${term}"입니다. 본문 문맥을 통해 유추할 수 있습니다.`,
      sourcePages: [pageNum] // 출처 페이지
    };
  } else {
    // [주관식]
    return {
      type: '주관식',
      question: `다음 문장의 빈칸에 들어갈 알맞은 단어를 쓰시오.\n\n"${questionText}"`,
      answer: term,
      explanation: `정답은 "${term}"입니다.`,
      sourcePages: [pageNum]
    };
  }
}

/**
 * [IPC] 'generate-quiz': 퀴즈 생성 요청 처리
 */
ipcMain.handle('generate-quiz', async (event, filters) => {
  try {
    if (!db) return { success: false, error: 'DB 미초기화' };

    let pageTexts = [];

    // [필터링] 특정 챕터만 대상으로 할지 결정
    if (filters.chapterNumber) {
      const chapter = db.getChapter(filters.fileName, filters.chapterNumber);
      if (!chapter) return { success: false, error: '챕터 정보 없음' };

      // 렌더러에서 받은 전체 페이지 텍스트 중, 해당 챕터 범위만 필터링
      if (filters.pageTexts && Array.isArray(filters.pageTexts)) {
        pageTexts = filters.pageTexts.filter(
          page => page.pageNum >= chapter.startPage && page.pageNum <= chapter.endPage
        );
      }
    } else {
      // 전체 문서 대상
      if (filters.pageTexts && Array.isArray(filters.pageTexts)) {
        pageTexts = filters.pageTexts;
      }
    }

    if (pageTexts.length === 0) return { success: false, error: '퀴즈를 생성할 텍스트가 없습니다.' };

    // 분석을 위해 전체 텍스트 병합
    const fullText = pageTexts.map(p => p.text).join(' ');

    // 키워드 추출 실행
    const keyTerms = extractKeyTerms(fullText, 50); // 상위 50개 키워드
    if (keyTerms.length === 0) return { success: false, error: '키워드를 추출할 수 없습니다 (텍스트가 너무 짧거나 불명확).' };

    const questionCount = filters.questionCount || 5; // 기본 5문제
    const questions = [];

    // 키워드 기반으로 문제 생성
    // 키워드 하나당 하나의 문제를 만들려고 시도
    for (let i = 0; i < Math.min(questionCount, keyTerms.length); i++) {
      const term = keyTerms[i];
      let foundPage = null;
      let foundSentence = null;

      // 해당 키워드가 포함된 페이지와 문장 찾기
      for (const page of pageTexts) {
        if (page.text.includes(term)) {
          foundPage = page.pageNum;
          // 문장 단위 분리 (. ! ? 기준)
          const sentences = page.text.split(/[.!?]\s+/).filter(s => s.length > 20); // 너무 짧은 문장 제외
          foundSentence = sentences.find(s => s.includes(term));
          if (foundSentence) break; // 첫 번째 발견된 문장 사용
        }
      }

      // 문장을 찾았으면 퀴즈 객체 생성
      if (foundSentence && foundPage) {
        const question = generateBlankQuestion(foundSentence, term, foundPage);
        questions.push({
          number: i + 1,
          ...question
        });
      }
    }

    if (questions.length === 0) return { success: false, error: '문제를 생성하지 못했습니다.' };

    const quizData = { questions };
    const sessionId = Date.now().toString(); // 퀴즈 세션 ID 생성

    // 퀴즈 시작 정보를 DB에 기록
    db.addQuizSession({
      id: sessionId,
      fileName: filters.fileName || null,
      totalQuestions: quizData.questions.length,
      correctAnswers: 0,
      score: 0
      // dateRange 등은 필요 시 추가
    });

    return {
      success: true,
      sessionId: sessionId,
      quiz: quizData
    };

  } catch (error) {
    console.error('퀴즈 생성 실패:', error);
    return { success: false, error: error.message };
  }
});

/**
 * [IPC] 'grade-quiz': 퀴즈 답안 채점
 */
ipcMain.handle('grade-quiz', async (event, { sessionId, answers, quiz }) => {
  try {
    if (!db) return { success: false, error: 'DB 미초기화' };

    let correctCount = 0;
    const results = [];

    // 제출된 답안 순회하며 채점
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const userAnswer = answers[i] || ''; // 미입력 방어

      // 대소문자 무시 비교
      const isCorrect = userAnswer.toLowerCase().trim() === question.answer.toLowerCase().trim();

      if (isCorrect) {
        correctCount++;
      } else {
        // [오답 노트 기능] 틀린 문제는 자동으로 오답 노트에 추가
        const sourcePages = question.sourcePages || [];
        db.addMistakeNote({
          fileName: quiz.fileName || 'Unknown',
          pageNumber: sourcePages[0] || null,
          originalText: `문제 ${question.number}: ${question.question}`,
          question: question.question,
          userAnswer: userAnswer,
          correctAnswer: question.answer,
          aiExplanation: question.explanation,
          quizSessionId: sessionId
        });
      }

      // 결과 배열 구성
      results.push({
        questionNumber: question.number,
        isCorrect: isCorrect,
        userAnswer: userAnswer,
        correctAnswer: question.answer,
        explanation: question.explanation
      });
    }

    // 최종 점수 계산 및 DB 업데이트
    const score = (correctCount / quiz.questions.length) * 100;

    // SQLite UPDATE 쿼리 직접 실행 (Helper 메소드 부재 시 대비)
    const updateStmt = db.db.prepare(`
      UPDATE QuizSession
      SET correctAnswers = ?, score = ?
      WHERE id = ?
    `);
    updateStmt.run(correctCount, score, sessionId);

    return {
      success: true,
      correctCount: correctCount,
      totalQuestions: quiz.questions.length,
      score: score, // 백분율 점수
      results: results
    };
  } catch (error) {
    console.error('채점 실패:', error);
    return { success: false, error: error.message };
  }
});

// =========================================================================================
// 기타 데이터 관리 IPC (오답노트, 통계, 테마)
// =========================================================================================

// 오답노트 조회
ipcMain.handle('get-mistake-notes', async (event, filters = {}) => {
  try {
    if (!db) return { success: false, error: 'DB Error' };
    const notes = db.getMistakeNotes(filters);
    return { success: true, notes: notes };
  } catch (err) { return { success: false, error: err.message }; }
});

// 오답노트 해결 처리 (토글 등)
ipcMain.handle('resolve-mistake-note', async (event, noteId) => {
  try {
    if (!db) return { success: false, error: 'DB Error' };
    db.resolveMistakeNote(noteId);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// 학습 통계 조회
ipcMain.handle('get-statistics', async (event, fileName = null) => {
  try {
    if (!db) return { success: false, error: 'DB Error' };
    const stats = db.getStatistics(fileName);
    const quizSessions = db.getQuizSessions(10); // 최근 10개 세션
    return { success: true, statistics: stats, recentSessions: quizSessions };
  } catch (err) { return { success: false, error: err.message }; }
});

// 테마 저장 (JSON 파일 기반 설정 관리)
ipcMain.handle('save-theme', async (event, themeId) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'theme-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ theme: themeId }), 'utf8');
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// 테마 로드
ipcMain.handle('load-theme', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'theme-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(data);
      return { success: true, theme: config.theme };
    }
    return { success: true, theme: null };
  } catch (err) { return { success: false, theme: null }; }
});
