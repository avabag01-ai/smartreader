let pdfData = null;
let messages = [];
let notes = [];
let selectedNoteId = null;
let currentQuiz = null;
let currentQuizSession = null;
let quizAnswers = [];
let chapters = [];
let currentChapter = null;
let chaptersCollapsed = false;

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const uploadPdfBtn = document.getElementById('upload-pdf-btn');
const uploadPdfBtnCenter = document.getElementById('upload-pdf-btn-center');
const pdfViewer = document.getElementById('pdf-viewer');
const chapterSelectionScreen = document.getElementById('chapter-selection-screen');
const chapterCardsGrid = document.getElementById('chapter-cards-grid');
const startFullModeBtn = document.getElementById('start-full-mode-btn');
const pdfContentViewer = document.getElementById('pdf-content-viewer');
const backToChaptersBtn = document.getElementById('back-to-chapters-btn');
const currentChapterInfo = document.getElementById('current-chapter-info');
const pdfIframe = document.getElementById('pdf-iframe');
const notesList = document.getElementById('notes-list');
const noteInput = document.getElementById('note-input');
const saveNoteBtn = document.getElementById('save-note-btn');
const newNoteBtn = document.getElementById('new-note-btn');
const ollamaStatus = document.getElementById('ollama-status');

// 탭 관련
const tabNotes = document.getElementById('tab-notes');
const tabMistakes = document.getElementById('tab-mistakes');
const tabQuiz = document.getElementById('tab-quiz');
const notesTab = document.getElementById('notes-tab');
const mistakesTab = document.getElementById('mistakes-tab');
const quizTab = document.getElementById('quiz-tab');

// 오답노트 관련
const refreshMistakesBtn = document.getElementById('refresh-mistakes-btn');
const mistakesList = document.getElementById('mistakes-list');

// 퀴즈 관련
const quizRangeType = document.getElementById('quiz-range-type');
const customRange = document.getElementById('custom-range');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const quizContent = document.getElementById('quiz-content');
const quizResults = document.getElementById('quiz-results');
const quizGenerator = document.getElementById('quiz-generator');

// 챕터 관련
const chaptersPanel = document.getElementById('chapters-panel');
const chaptersList = document.getElementById('chapters-list');
const toggleChaptersBtn = document.getElementById('toggle-chapters-btn');

async function init() {
  await checkOllama();
  loadNotes();
  setupEventListeners();
  loadMistakeNotes();
}

async function checkOllama() {
  const result = await window.electronAPI.checkOllama();
  
  if (result.available) {
    ollamaStatus.textContent = '✅ 연결됨';
    ollamaStatus.className = 'status-indicator connected';
  } else {
    ollamaStatus.textContent = '❌ 연결 안됨';
    ollamaStatus.className = 'status-indicator disconnected';
  }
}

function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  uploadPdfBtn.addEventListener('click', selectPDF);
  uploadPdfBtnCenter.addEventListener('click', selectPDF);

  if (startFullModeBtn) {
    startFullModeBtn.addEventListener('click', startFullMode);
  }

  if (backToChaptersBtn) {
    backToChaptersBtn.addEventListener('click', backToChapterSelection);
  }

  newNoteBtn.addEventListener('click', newNote);
  saveNoteBtn.addEventListener('click', saveNote);
  noteInput.addEventListener('input', () => {
    saveNoteBtn.disabled = !noteInput.value.trim();
  });

  // 탭 전환
  tabNotes.addEventListener('click', () => switchTab('notes'));
  tabMistakes.addEventListener('click', () => switchTab('mistakes'));
  tabQuiz.addEventListener('click', () => switchTab('quiz'));

  // 오답노트
  refreshMistakesBtn.addEventListener('click', loadMistakeNotes);

  // 퀴즈
  quizRangeType.addEventListener('change', () => {
    if (quizRangeType.value === 'custom') {
      customRange.style.display = 'block';
    } else {
      customRange.style.display = 'none';
    }
  });

  generateQuizBtn.addEventListener('click', generateQuiz);

  // 챕터
  if (toggleChaptersBtn) {
    document.querySelector('.chapters-header').addEventListener('click', toggleChapters);
  }
}

function toggleChapters() {
  chaptersCollapsed = !chaptersCollapsed;
  if (chaptersCollapsed) {
    chaptersList.style.display = 'none';
    toggleChaptersBtn.classList.add('collapsed');
  } else {
    chaptersList.style.display = 'block';
    toggleChaptersBtn.classList.remove('collapsed');
  }
}

function switchTab(tabName) {
  // 탭 버튼 활성화
  [tabNotes, tabMistakes, tabQuiz].forEach(btn => btn.classList.remove('active'));
  [notesTab, mistakesTab, quizTab].forEach(content => content.classList.remove('active'));

  if (tabName === 'notes') {
    tabNotes.classList.add('active');
    notesTab.classList.add('active');
  } else if (tabName === 'mistakes') {
    tabMistakes.classList.add('active');
    mistakesTab.classList.add('active');
    loadMistakeNotes();
  } else if (tabName === 'quiz') {
    tabQuiz.classList.add('active');
    quizTab.classList.add('active');
  }
}

async function selectPDF() {
  console.log('📂 PDF 선택 시작');

  const result = await window.electronAPI.selectPDF();

  if (!result) {
    console.log('⚠️ PDF 선택 취소됨');
    return;
  }

  if (result.error) {
    console.error('❌ PDF 읽기 오류:', result.error);
    addMessage('assistant', `PDF 읽기 오류: ${result.error}`);
    return;
  }

  console.log('✅ PDF 로드 완료:', result.fileName);
  pdfData = result;

  // ⚠️ CRITICAL: PDF iframe을 절대 표시하지 않음
  console.log('🚫 PDF iframe 강제 숨김 (챕터 선택 전까지 표시 금지)');
  pdfContentViewer.style.display = 'none';
  if (pdfIframe) {
    pdfIframe.src = ''; // iframe src 초기화
  }

  // 챕터 로드 (데이터베이스에서)
  console.log('📚 데이터베이스에서 챕터 로드 중...');
  await loadChapters();

  // 업로드 화면 숨기고 챕터 선택 화면만 표시
  console.log('🎨 UI 전환: 챕터 선택 화면 표시');
  pdfViewer.style.display = 'none';
  chapterSelectionScreen.style.display = 'block';

  // 챕터 카드 렌더링
  console.log('🎴 챕터 카드 렌더링 중...');
  renderChapterCards();
  console.log(`✅ ${chapters.length}개 챕터 카드 렌더링 완료`);

  // 왼쪽 사이드바 챕터 패널도 표시
  chaptersPanel.style.display = 'block';

  addMessage('assistant', `PDF "${result.fileName}" (${result.numPages}페이지, ${chapters.length}개 챕터)를 분석했습니다! 중앙에서 학습할 챕터를 선택하거나, 전체 문서 모드로 시작할 수 있습니다.`);
  console.log('✅ selectPDF 함수 완료\n');
}

async function loadChapters() {
  if (!pdfData) return;

  try {
    const result = await window.electronAPI.getChapters(pdfData.fileName);

    if (result.success && result.chapters.length > 0) {
      chapters = result.chapters;
      renderChapters();
      chaptersPanel.style.display = 'block';
    } else {
      chapters = [];
      chaptersPanel.style.display = 'none';
    }
  } catch (error) {
    console.error('챕터 로드 오류:', error);
    chapters = [];
    chaptersPanel.style.display = 'none';
  }
}

function renderChapters() {
  chaptersList.innerHTML = chapters.map(chapter => `
    <div class="chapter-item ${currentChapter === chapter.chapterNumber ? 'active' : ''}"
         onclick="selectChapter(${chapter.chapterNumber})">
      <div>
        <span class="chapter-number">Ch.${chapter.chapterNumber}</span>
        <span class="chapter-title">${chapter.chapterTitle}</span>
      </div>
      <div class="chapter-pages">${chapter.startPage}-${chapter.endPage}p</div>
    </div>
  `).join('');
}

function renderChapterCards() {
  console.log('🎴 renderChapterCards 호출');
  console.log('  → 챕터 개수:', chapters ? chapters.length : 0);

  if (!chapters || chapters.length === 0) {
    console.warn('⚠️ 챕터가 없습니다. 안내 메시지 표시');
    chapterCardsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
        <p>챕터 정보가 없습니다. 전체 문서 모드로 시작해주세요.</p>
      </div>
    `;
    return;
  }

  console.log('  → 챕터 카드 HTML 생성 중...');
  const cardsHtml = chapters.map((chapter, index) => {
    console.log(`    [${index + 1}] Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle} (${chapter.startPage}-${chapter.endPage})`);
    return `
      <div class="chapter-card" onclick="selectChapterCard(${chapter.chapterNumber})">
        <div class="chapter-card-number">Chapter ${chapter.chapterNumber}</div>
        <div class="chapter-card-title">${chapter.chapterTitle}</div>
        <div class="chapter-card-pages">${chapter.startPage}-${chapter.endPage} 페이지</div>
      </div>
    `;
  }).join('');

  chapterCardsGrid.innerHTML = cardsHtml;
  console.log('✅ 챕터 카드 DOM 렌더링 완료');
}

function selectChapterCard(chapterNumber) {
  console.log(`\n🎯 챕터 카드 선택: Chapter ${chapterNumber}`);

  currentChapter = chapterNumber;
  const chapter = chapters.find(c => c.chapterNumber === chapterNumber);

  if (!chapter) {
    console.error('❌ 챕터를 찾을 수 없습니다:', chapterNumber);
    return;
  }

  if (!pdfData) {
    console.error('❌ PDF 데이터가 없습니다.');
    return;
  }

  console.log('✅ 챕터 정보:', chapter);

  // 챕터 선택 화면 숨기고 PDF 뷰어 표시
  console.log('🎨 UI 전환: 챕터 선택 → PDF 뷰어');
  chapterSelectionScreen.style.display = 'none';
  pdfContentViewer.style.display = 'flex';

  // 현재 챕터 정보 표시
  currentChapterInfo.textContent = `📚 Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle} (${chapter.startPage}-${chapter.endPage}페이지)`;

  // PDF iframe에 파일 로드 (이 시점에만 로드!)
  const pdfUrl = `file://${pdfData.filePath}#page=${chapter.startPage}`;
  console.log('📄 PDF 로드:', pdfUrl);
  pdfIframe.src = pdfUrl;

  // 왼쪽 사이드바 챕터도 업데이트
  renderChapters();

  // AI에게 챕터 선택 알림
  addMessage('assistant', `📚 "${chapter.chapterTitle}" (${chapter.startPage}~${chapter.endPage}페이지)로 포커스를 전환했습니다. 이 챕터에 집중해서 답변하겠습니다.`);
  console.log('✅ 챕터 선택 완료\n');
}

function startFullMode() {
  console.log('\n📖 전체 문서 모드 시작');

  currentChapter = null;

  if (!pdfData) {
    console.error('❌ PDF 데이터가 없습니다.');
    return;
  }

  console.log('✅ PDF 파일:', pdfData.fileName);

  // 챕터 선택 화면 숨기고 PDF 뷰어 표시
  console.log('🎨 UI 전환: 챕터 선택 → PDF 뷰어 (전체 모드)');
  chapterSelectionScreen.style.display = 'none';
  pdfContentViewer.style.display = 'flex';

  // 현재 챕터 정보 표시
  currentChapterInfo.textContent = `📖 전체 문서 모드 (${pdfData.numPages}페이지)`;

  // PDF iframe에 파일 로드 (이 시점에만 로드!)
  const pdfUrl = `file://${pdfData.filePath}`;
  console.log('📄 PDF 로드 (전체):', pdfUrl);
  pdfIframe.src = pdfUrl;

  // 왼쪽 사이드바 챕터 업데이트
  renderChapters();

  // AI에게 전체 모드 알림
  addMessage('assistant', '전체 문서 모드로 전환했습니다. 모든 내용에 대해 질문할 수 있습니다.');
  console.log('✅ 전체 문서 모드 시작 완료\n');
}

function backToChapterSelection() {
  console.log('\n⬅️ 챕터 목록으로 돌아가기');

  // PDF 뷰어 숨기고 챕터 선택 화면 표시
  console.log('🎨 UI 전환: PDF 뷰어 → 챕터 선택');
  pdfContentViewer.style.display = 'none';
  chapterSelectionScreen.style.display = 'block';

  // PDF iframe src 초기화 (메모리 절약)
  if (pdfIframe) {
    pdfIframe.src = '';
    console.log('🚫 PDF iframe 언로드');
  }

  // 현재 챕터 선택 해제
  currentChapter = null;
  renderChapters();

  console.log('✅ 챕터 목록 화면으로 복귀 완료\n');
}

function selectChapter(chapterNumber) {
  if (currentChapter === chapterNumber) {
    // 같은 챕터 클릭 시 선택 해제 (전체 모드)
    currentChapter = null;
    addMessage('assistant', '전체 문서 모드로 전환했습니다. 모든 내용에 대해 질문할 수 있습니다.');
  } else {
    currentChapter = chapterNumber;
    const chapter = chapters.find(c => c.chapterNumber === chapterNumber);
    if (chapter) {
      addMessage('assistant', `📚 "${chapter.chapterTitle}" (${chapter.startPage}~${chapter.endPage}페이지)로 포커스를 전환했습니다. 이 챕터에 집중해서 답변하겠습니다.`);
    }
  }

  renderChapters();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage('user', text);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  sendBtn.disabled = true;
  chatInput.disabled = true;

  const result = await window.electronAPI.getAIResponse({
    question: text,
    pdfText: pdfData ? pdfData.text : '',
    pdfData: pdfData,
    currentChapter: currentChapter
  });

  if (result.success) {
    addMessage('assistant', result.response);
  } else {
    addMessage('assistant', `오류: ${result.error}\n\nOllama가 실행 중인지 확인해주세요.`);
  }

  sendBtn.disabled = false;
  chatInput.disabled = false;
  chatInput.focus();
}

function addMessage(role, content) {
  const message = {
    id: Date.now().toString(),
    role: role,
    content: content,
    timestamp: new Date()
  };

  messages.push(message);

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.innerHTML = `
    <div class="message-bubble">${content.replace(/\n/g, '<br>')}</div>
    <div class="message-time">${formatTime(message.timestamp)}</div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function loadNotes() {
  const saved = localStorage.getItem('notes');
  if (saved) {
    notes = JSON.parse(saved);
    renderNotes();
  }
}

function saveNotes() {
  localStorage.setItem('notes', JSON.stringify(notes));
}

function renderNotes() {
  notesList.innerHTML = notes.map(note => `
    <div class="note-item ${selectedNoteId === note.id ? 'selected' : ''}" 
         onclick="selectNote('${note.id}')">
      <div class="note-preview">${note.content || '빈 노트'}</div>
      <div class="note-date">${new Date(note.createdAt).toLocaleDateString('ko-KR')}</div>
    </div>
  `).join('');
}

function selectNote(id) {
  selectedNoteId = id;
  const note = notes.find(n => n.id === id);
  if (note) {
    noteInput.value = note.content;
    saveNoteBtn.disabled = false;
  }
  renderNotes();
}

function newNote() {
  selectedNoteId = null;
  noteInput.value = '';
  saveNoteBtn.disabled = true;
  renderNotes();
}

function saveNote() {
  const content = noteInput.value.trim();
  if (!content) return;

  if (selectedNoteId) {
    const note = notes.find(n => n.id === selectedNoteId);
    if (note) {
      note.content = content;
    }
  } else {
    const newNote = {
      id: Date.now().toString(),
      content: content,
      createdAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    selectedNoteId = newNote.id;
  }

  saveNotes();
  renderNotes();
}

// 오답노트 로드
async function loadMistakeNotes() {
  try {
    const result = await window.electronAPI.getMistakeNotes({});

    if (result.success && result.notes.length > 0) {
      renderMistakeNotes(result.notes);
    } else {
      mistakesList.innerHTML = `
        <div class="empty-mistakes">
          <div class="empty-mistakes-icon">✅</div>
          <h3>오답노트가 비어있습니다</h3>
          <p>퀴즈를 풀고 틀린 문제가 여기에 표시됩니다</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('오답노트 로드 오류:', error);
    mistakesList.innerHTML = `
      <div class="empty-mistakes">
        <div class="empty-mistakes-icon">❌</div>
        <h3>오답노트를 불러올 수 없습니다</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderMistakeNotes(notes) {
  mistakesList.innerHTML = notes.map(note => `
    <div class="mistake-item ${note.isResolved ? 'resolved' : ''}"
         onclick="viewMistakeNote(${note.id}, ${note.pageNumber || 0})">
      <div class="mistake-header">
        <span class="mistake-badge ${note.isResolved ? 'resolved' : ''}">
          ${note.isResolved ? '해결됨' : '미해결'}
        </span>
        <span class="mistake-page">
          ${note.pageNumber ? `페이지 ${note.pageNumber}` : '페이지 미확인'}
        </span>
      </div>
      <div class="mistake-question">${note.question}</div>
      <div class="mistake-answer user">❌ 내 답: ${note.userAnswer || '무응답'}</div>
      <div class="mistake-answer correct">✅ 정답: ${note.correctAnswer}</div>
      ${note.aiExplanation ? `
        <div class="mistake-explanation">
          💡 해설: ${note.aiExplanation}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function viewMistakeNote(noteId, pageNumber) {
  // 오답노트 항목을 해결됨으로 표시
  await window.electronAPI.resolveMistakeNote(noteId);

  // PDF 페이지로 이동 (구현 예정)
  if (pageNumber && pdfData) {
    // 추후 PDF 뷰어에 페이지 이동 기능 추가
    console.log(`페이지 ${pageNumber}로 이동`);
  }

  // 오답노트 새로고침
  loadMistakeNotes();
}

// 퀴즈 생성
async function generateQuiz() {
  if (!pdfData) {
    alert('먼저 PDF를 업로드해주세요!');
    return;
  }

  generateQuizBtn.disabled = true;
  generateQuizBtn.textContent = '퀴즈 생성 중...';

  try {
    // 필터 설정
    const filters = {
      fileName: pdfData.fileName,
      questionCount: parseInt(document.getElementById('quiz-question-count').value) || 5
    };

    // 현재 챕터가 선택되어 있으면 챕터 기반 퀴즈 생성
    if (currentChapter) {
      filters.chapterNumber = currentChapter;
    } else {
      const rangeType = quizRangeType.value;
      const now = new Date();

      if (rangeType === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filters.startDate = weekAgo.toISOString();
        filters.endDate = now.toISOString();
      } else if (rangeType === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filters.startDate = monthAgo.toISOString();
        filters.endDate = now.toISOString();
      } else if (rangeType === 'custom') {
        const startDate = document.getElementById('quiz-start-date').value;
        const endDate = document.getElementById('quiz-end-date').value;
        if (startDate) filters.startDate = new Date(startDate).toISOString();
        if (endDate) filters.endDate = new Date(endDate).toISOString();
      }
    }

    const result = await window.electronAPI.generateQuiz(filters);

    if (result.success) {
      currentQuiz = result.quiz;
      currentQuizSession = result.sessionId;
      quizAnswers = new Array(result.quiz.questions.length).fill('');

      renderQuiz(result.quiz);
      quizGenerator.style.display = 'none';
      quizContent.style.display = 'block';
      quizResults.style.display = 'none';
    } else {
      alert(`퀴즈 생성 실패: ${result.error}`);
    }
  } catch (error) {
    console.error('퀴즈 생성 오류:', error);
    alert(`퀴즈 생성 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    generateQuizBtn.disabled = false;
    generateQuizBtn.textContent = '퀴즈 생성하기';
  }
}

function renderQuiz(quiz) {
  const questionsHTML = quiz.questions.map((q, index) => {
    if (q.type === '객관식') {
      return `
        <div class="quiz-question">
          <div class="quiz-question-header">
            <span class="quiz-question-number">문제 ${q.number}</span>
            <span class="quiz-question-type">${q.type}</span>
          </div>
          <div class="quiz-question-text">${q.question}</div>
          <div class="quiz-choices">
            ${q.choices.map((choice, i) => `
              <div class="quiz-choice">
                <input type="radio"
                       name="question-${index}"
                       id="q${index}-choice${i}"
                       value="${choice}"
                       onchange="updateAnswer(${index}, '${choice}')">
                <label for="q${index}-choice${i}">${choice}</label>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="quiz-question">
          <div class="quiz-question-header">
            <span class="quiz-question-number">문제 ${q.number}</span>
            <span class="quiz-question-type">${q.type}</span>
          </div>
          <div class="quiz-question-text">${q.question}</div>
          <input type="text"
                 class="quiz-answer-input"
                 placeholder="답을 입력하세요"
                 oninput="updateAnswer(${index}, this.value)">
        </div>
      `;
    }
  }).join('');

  quizContent.innerHTML = `
    ${questionsHTML}
    <button class="quiz-submit-btn" onclick="submitQuiz()">제출하기</button>
  `;
}

function updateAnswer(index, value) {
  quizAnswers[index] = value;
}

async function submitQuiz() {
  if (quizAnswers.some(a => !a || a.trim() === '')) {
    if (!confirm('답변하지 않은 문제가 있습니다. 제출하시겠습니까?')) {
      return;
    }
  }

  try {
    const result = await window.electronAPI.gradeQuiz({
      sessionId: currentQuizSession,
      answers: quizAnswers,
      quiz: {
        ...currentQuiz,
        fileName: pdfData.fileName
      }
    });

    if (result.success) {
      renderQuizResults(result);
      quizContent.style.display = 'none';
      quizResults.style.display = 'block';

      // 오답노트 새로고침
      loadMistakeNotes();
    } else {
      alert(`채점 실패: ${result.error}`);
    }
  } catch (error) {
    console.error('채점 오류:', error);
    alert(`채점 중 오류가 발생했습니다: ${error.message}`);
  }
}

function renderQuizResults(result) {
  const resultsHTML = result.results.map(r => `
    <div class="quiz-result-item ${r.isCorrect ? 'correct' : 'incorrect'}">
      <div class="quiz-result-header">
        <span class="quiz-question-number">문제 ${r.questionNumber}</span>
        <span class="quiz-result-status ${r.isCorrect ? 'correct' : 'incorrect'}">
          ${r.isCorrect ? '정답' : '오답'}
        </span>
      </div>
      <div class="mistake-answer user">내 답: ${r.userAnswer}</div>
      ${!r.isCorrect ? `<div class="mistake-answer correct">정답: ${r.correctAnswer}</div>` : ''}
      ${r.explanation ? `<div class="mistake-explanation">💡 ${r.explanation}</div>` : ''}
    </div>
  `).join('');

  quizResults.innerHTML = `
    <div class="quiz-score">
      <h3>퀴즈 결과</h3>
      <div class="quiz-score-value">${Math.round(result.score)}점</div>
      <div class="quiz-score-details">
        ${result.correctCount}/${result.totalQuestions} 정답
      </div>
    </div>
    ${resultsHTML}
    <button class="quiz-back-btn" onclick="backToQuizGenerator()">새 퀴즈 만들기</button>
  `;
}

function backToQuizGenerator() {
  quizGenerator.style.display = 'block';
  quizContent.style.display = 'none';
  quizResults.style.display = 'none';
  currentQuiz = null;
  currentQuizSession = null;
  quizAnswers = [];
}

window.selectNote = selectNote;
window.viewMistakeNote = viewMistakeNote;
window.updateAnswer = updateAnswer;
window.submitQuiz = submitQuiz;
window.backToQuizGenerator = backToQuizGenerator;
window.selectChapter = selectChapter;
window.selectChapterCard = selectChapterCard;

init();
