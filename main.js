const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const StudyDatabase = require('./database');
const config = require('./config');

// PDF.js 설정
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

let mainWindow;
let db;

// 환경 변수에서 안전하게 로드
const OLLAMA_API_URL = `${config.ai.ollamaHost}/api/generate`;
const OLLAMA_MODEL = config.ai.ollamaModel;

console.log('🔐 Configuration loaded securely from environment variables');
console.log(`   Ollama Host: ${config.ai.ollamaHost}`);
console.log(`   Ollama Model: ${config.ai.ollamaModel}`);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // 개발 중 디버깅용
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  db = new StudyDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// PDF 텍스트 추출 함수
async function extractTextFromPDF(filePath) {
  try {
    console.log('PDF 파싱 시작:', filePath);

    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;

    const numPages = pdfDocument.numPages;
    console.log('총 페이지 수:', numPages);

    let fullText = '';
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`페이지 ${pageNum}/${numPages} 처리 중...`);
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pageTexts.push({ pageNum, text: pageText });
      fullText += pageText + '\n\n';
    }

    console.log('PDF 파싱 완료. 총 텍스트 길이:', fullText.length);

    return {
      text: fullText,
      numPages: numPages,
      pageTexts: pageTexts,
      pdfDocument: pdfDocument // PDF 문서 객체도 반환 (목차 추출용)
    };
  } catch (error) {
    console.error('PDF 파싱 오류:', error);
    throw error;
  }
}

// PDF 내장 Outline(목차)에서 챕터 추출 함수
async function extractChaptersFromOutline(pdfDocument) {
  try {
    console.log('==========================================');
    console.log('PDF 내장 목차(Outline) 추출 시작');
    console.log('==========================================');

    const outline = await pdfDocument.getOutline();
    console.log('Outline 결과:', outline);

    if (!outline || outline.length === 0) {
      console.log('❌ PDF에 내장된 목차가 없습니다.');
      console.log('→ 자동 분할 모드로 전환합니다.');
      return null;
    }

    console.log(`✅ ${outline.length}개의 목차 항목을 발견했습니다.`);
    const chapters = [];
    let chapterNum = 1;

    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];
      console.log(`\n목차 항목 ${i + 1}:`, {
        title: item.title,
        dest: item.dest,
        items: item.items ? item.items.length : 0
      });

      try {
        // dest가 있으면 페이지 참조를 가져옴
        let pageNum = null;

        if (item.dest) {
          const dest = typeof item.dest === 'string'
            ? await pdfDocument.getDestination(item.dest)
            : item.dest;

          console.log(`  → destination:`, dest);

          if (dest && dest[0]) {
            const pageRef = dest[0];
            const pageIndex = await pdfDocument.getPageIndex(pageRef);
            pageNum = pageIndex + 1; // 0-based index를 1-based로 변환
            console.log(`  → 페이지 번호: ${pageNum}`);
          }
        }

        if (pageNum) {
          chapters.push({
            number: chapterNum,
            title: item.title,
            startPage: pageNum
          });
          console.log(`  ✅ 챕터 ${chapterNum} 추가 완료`);
          chapterNum++;
        } else {
          console.log(`  ⚠️ 페이지 번호를 찾을 수 없어 스킵합니다.`);
        }
      } catch (itemError) {
        console.warn(`  ❌ 목차 항목 처리 오류:`, itemError);
        continue;
      }
    }

    // endPage 계산 (다음 챕터의 startPage - 1)
    for (let i = 0; i < chapters.length; i++) {
      if (i < chapters.length - 1) {
        chapters[i].endPage = chapters[i + 1].startPage - 1;
      } else {
        // 마지막 챕터는 문서 끝까지
        chapters[i].endPage = pdfDocument.numPages;
      }
    }

    console.log('\n==========================================');
    console.log(`✅ 총 ${chapters.length}개의 챕터를 추출했습니다.`);
    console.log('추출된 챕터 목록:', chapters);
    console.log('==========================================\n');
    return chapters;

  } catch (error) {
    console.error('❌ Outline 추출 오류:', error);
    return null;
  }
}

// 챕터 자동 추출 함수 (Outline 우선, 없으면 자동 분할)
async function extractChapters(pdfData) {
  console.log('\n🔍 챕터 추출 프로세스 시작');
  console.log('PDF 페이지 수:', pdfData.numPages);

  try {
    // 1단계: PDF 내장 Outline(목차) 추출 시도
    if (pdfData.pdfDocument) {
      console.log('1단계: PDF 내장 목차 추출 시도...');
      const outlineChapters = await extractChaptersFromOutline(pdfData.pdfDocument);

      if (outlineChapters && outlineChapters.length > 0) {
        console.log(`✅ PDF 내장 목차에서 ${outlineChapters.length}개 챕터 추출 성공!`);
        return outlineChapters;
      } else {
        console.log('⚠️ 내장 목차 추출 실패 또는 빈 결과');
      }
    } else {
      console.log('⚠️ PDF 문서 객체가 없습니다.');
    }

    // 2단계: Outline이 없으면 페이지 단위로 자동 분할 (무조건 실행)
    console.log('\n2단계: 페이지 단위 자동 분할 실행...');
    const autoChapters = autoSplitChapters(pdfData.numPages);
    console.log(`✅ 자동 분할로 ${autoChapters.chapters.length}개 챕터 생성 완료!`);
    return autoChapters.chapters;

  } catch (error) {
    console.error('❌ 챕터 추출 중 오류 발생:', error);
    // 오류 시에도 무조건 자동 분할
    console.log('→ 오류 복구: 자동 분할 실행');
    const fallbackChapters = autoSplitChapters(pdfData.numPages);
    return fallbackChapters.chapters;
  }
}

// 자동 챕터 분할 (목차가 없을 때)
function autoSplitChapters(numPages) {
  const chapters = [];
  // 페이지 수에 따라 적절한 분할 단위 결정
  let pagesPerChapter;

  if (numPages <= 50) {
    pagesPerChapter = 10; // 짧은 문서는 10페이지씩
  } else if (numPages <= 150) {
    pagesPerChapter = 20; // 중간 문서는 20페이지씩
  } else {
    pagesPerChapter = 30; // 긴 문서는 30페이지씩
  }

  let chapterNum = 1;

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

  console.log(`자동 분할: ${chapters.length}개의 파트로 나눴습니다. (${pagesPerChapter}페이지씩)`);
  return { chapters };
}

ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);

  try {
    const pdfData = await extractTextFromPDF(filePath);

    // 챕터 자동 추출 및 저장
    if (db) {
      // 기존 챕터 삭제
      db.deleteChapters(fileName);

      // 새 챕터 추출
      const chapters = await extractChapters(pdfData);

      // 챕터 저장
      for (const chapter of chapters) {
        // 챕터 범위의 텍스트 추출
        const chapterPages = pdfData.pageTexts.filter(
          p => p.pageNum >= chapter.startPage && p.pageNum <= chapter.endPage
        );
        const chapterText = chapterPages.map(p => p.text).join('\n\n');

        db.addChapter({
          fileName: fileName,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          extractedText: chapterText
        });
      }

      console.log(`${chapters.length}개의 챕터를 추출하여 저장했습니다.`);
    }

    return {
      fileName: fileName,
      filePath: filePath,
      text: pdfData.text,
      numPages: pdfData.numPages
    };
  } catch (error) {
    console.error('PDF 파싱 오류:', error);
    return { error: error.message };
  }
});

ipcMain.handle('check-ollama', async () => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags', {
      timeout: 2000
    });
    return { available: true };
  } catch (error) {
    return { available: false };
  }
});

ipcMain.handle('get-ai-response', async (event, { question, pdfText, pdfData, currentChapter }) => {
  try {
    let contextText = pdfText;
    let rolePrompt = '';

    // 챕터 포커스 모드
    if (currentChapter && db && pdfData) {
      const chapter = db.getChapter(pdfData.fileName, currentChapter);
      if (chapter && chapter.extractedText) {
        contextText = chapter.extractedText;
        rolePrompt = `당신은 "${chapter.chapterTitle}" (${chapter.startPage}~${chapter.endPage}페이지)를 가르치는 전문 튜터입니다. 이 챕터의 내용만을 바탕으로 답변하세요.\n\n`;
      }
    }

    const prompt = contextText
      ? `${rolePrompt}다음은 ${currentChapter ? '현재 챕터의' : 'PDF 문서의'} 내용입니다:

${contextText}

위 내용을 바탕으로 다음 질문에 한국어로 답변해주세요.

질문: ${question}

답변:`
      : `질문: ${question}\n\n답변:`;

    const response = await axios.post(OLLAMA_API_URL, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 500
      }
    }, {
      timeout: 60000
    });

    // 대화 내용을 데이터베이스에 저장
    if (pdfData && db) {
      const conversationId = Date.now().toString();
      db.addLearningHistory({
        fileName: pdfData.fileName,
        filePath: pdfData.filePath,
        pageNumber: pdfData.currentPage || null,
        chapterNumber: currentChapter || null,
        textContent: null,
        conversationId: conversationId,
        userQuestion: question,
        aiResponse: response.data.response,
        userMemo: null,
        timeSpent: 0
      });
    }

    return {
      success: true,
      response: response.data.response
    };
  } catch (error) {
    console.error('Ollama 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 챕터 조회
ipcMain.handle('get-chapters', async (event, fileName) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    const chapters = db.getChapters(fileName);
    return {
      success: true,
      chapters: chapters
    };
  } catch (error) {
    console.error('챕터 조회 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 특정 챕터 조회
ipcMain.handle('get-chapter', async (event, fileName, chapterNumber) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    const chapter = db.getChapter(fileName, chapterNumber);
    return {
      success: true,
      chapter: chapter
    };
  } catch (error) {
    console.error('챕터 조회 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 퀴즈 생성 (챕터 지원)
ipcMain.handle('generate-quiz', async (event, filters) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    let contextText = '';
    let conversationContext = '';
    let chapterInfo = '';

    // 챕터 기반 퀴즈 생성
    if (filters.chapterNumber) {
      const chapter = db.getChapter(filters.fileName, filters.chapterNumber);
      if (!chapter) {
        return { success: false, error: '챕터를 찾을 수 없습니다.' };
      }

      contextText = chapter.extractedText;
      chapterInfo = `"${chapter.chapterTitle}" (${chapter.startPage}~${chapter.endPage}페이지)`;

      // 해당 챕터의 학습 이력만 조회
      const chapterHistory = db.getLearningHistory({
        fileName: filters.fileName,
        chapterNumber: filters.chapterNumber
      });

      conversationContext = chapterHistory
        .filter(h => h.userQuestion && h.aiResponse)
        .map(h => `Q: ${h.userQuestion}\nA: ${h.aiResponse}`)
        .join('\n\n');
    } else {
      // 전체 또는 기간별 학습 데이터 조회
      const context = db.getQuizContext(filters);

      if (context.totalRecords === 0) {
        return { success: false, error: '선택한 범위에 학습 데이터가 없습니다.' };
      }

      contextText = context.textContents.map(item =>
        `[페이지 ${item.page}] ${item.text}`
      ).join('\n\n');

      conversationContext = context.conversationPairs.map(item =>
        `Q: ${item.question}\nA: ${item.answer}`
      ).join('\n\n');
    }

    const prompt = `다음은 학생이 학습한 ${chapterInfo || ''}내용입니다:

${contextText}

그리고 다음은 학생과 AI의 대화 내역입니다:

${conversationContext}

위 학습 데이터를 바탕으로 학생의 이해도를 테스트할 수 있는 퀴즈를 생성해주세요.

요구사항:
1. 총 ${filters.questionCount || 5}개의 문제를 출제하세요
2. 객관식과 주관식을 적절히 섞어주세요
3. 각 문제는 다음 형식을 따르세요:
   - 문제 번호
   - 문제 유형 (객관식/주관식)
   - 문제 내용
   - 객관식인 경우: 4개의 선택지 (1, 2, 3, 4)
   - 정답
   - 해설

JSON 형식으로 응답해주세요:
{
  "questions": [
    {
      "number": 1,
      "type": "객관식" 또는 "주관식",
      "question": "문제 내용",
      "choices": ["1번", "2번", "3번", "4번"] (객관식만),
      "answer": "정답",
      "explanation": "해설",
      "sourcePages": [관련 페이지 번호들]
    }
  ]
}`;

    const response = await axios.post(OLLAMA_API_URL, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.5,
        top_p: 0.9,
        num_predict: 2000
      }
    }, {
      timeout: 120000
    });

    // JSON 파싱 시도
    let quizData;
    try {
      const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다');
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return {
        success: false,
        error: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.'
      };
    }

    // 퀴즈 세션 저장
    const sessionId = Date.now().toString();
    db.addQuizSession({
      id: sessionId,
      dateRangeStart: filters.startDate || null,
      dateRangeEnd: filters.endDate || null,
      pageRangeStart: filters.pageStart || null,
      pageRangeEnd: filters.pageEnd || null,
      fileName: filters.fileName || null,
      totalQuestions: quizData.questions.length,
      correctAnswers: 0,
      score: 0
    });

    return {
      success: true,
      sessionId: sessionId,
      quiz: quizData
    };
  } catch (error) {
    console.error('퀴즈 생성 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 퀴즈 답안 채점
ipcMain.handle('grade-quiz', async (event, { sessionId, answers, quiz }) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    let correctCount = 0;
    const results = [];

    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer.toLowerCase().trim() ===
                       question.answer.toLowerCase().trim();

      if (isCorrect) {
        correctCount++;
      } else {
        // 오답인 경우 오답노트에 저장
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

      results.push({
        questionNumber: question.number,
        isCorrect: isCorrect,
        userAnswer: userAnswer,
        correctAnswer: question.answer,
        explanation: question.explanation
      });
    }

    // 퀴즈 세션 업데이트
    const score = (correctCount / quiz.questions.length) * 100;
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
      score: score,
      results: results
    };
  } catch (error) {
    console.error('채점 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 오답노트 조회
ipcMain.handle('get-mistake-notes', async (event, filters = {}) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    const notes = db.getMistakeNotes(filters);
    return {
      success: true,
      notes: notes
    };
  } catch (error) {
    console.error('오답노트 조회 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 오답노트 해결 표시
ipcMain.handle('resolve-mistake-note', async (event, noteId) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    db.resolveMistakeNote(noteId);
    return { success: true };
  } catch (error) {
    console.error('오답노트 해결 표시 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 학습 통계 조회
ipcMain.handle('get-statistics', async (event, fileName = null) => {
  try {
    if (!db) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    const stats = db.getStatistics(fileName);
    const quizSessions = db.getQuizSessions(10);

    return {
      success: true,
      statistics: stats,
      recentSessions: quizSessions
    };
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 테마 저장
ipcMain.handle('save-theme', async (event, themeId) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'theme-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ theme: themeId }), 'utf8');
    console.log(`테마 저장: ${themeId}`);
    return { success: true };
  } catch (error) {
    console.error('테마 저장 오류:', error);
    return { success: false, error: error.message };
  }
});

// 테마 불러오기
ipcMain.handle('load-theme', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'theme-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(data);
      console.log(`테마 불러오기: ${config.theme}`);
      return { success: true, theme: config.theme };
    }
    return { success: true, theme: null };
  } catch (error) {
    console.error('테마 불러오기 오류:', error);
    return { success: false, theme: null };
  }
});
