/**
 * =========================================================================================
 * SmartReader Renderer Process (Frontend Logic)
 * =========================================================================================
 * 
 * 이 파일은 사용자의 UI 상호작용과 화면 출력을 담당합니다.
 * 주요 기능:
 * 1. PDF 뷰어 제어 (챕터 선택, 페이지 이동)
 * 2. AI 채팅 인터페이스 관리 (메시지 표시, 스트리밍 응답 처리)
 * 3. 퀴즈 시스템 UI (퀴즈 생성, 풀기, 채점 결과 표시)
 * 4. 오답 노트 및 메모 관리
 * 5. 테마 및 검색 기능
 * 
 * Electron의 IPC(Inter-Process Communication)를 통해 메인 프로세스와 통신합니다.
 */

// =========================================================================================
// 전역 상태 변수 (State Management)
// =========================================================================================

let pdfData = null;             // 현재 로드된 PDF 파싱 데이터
let messages = [];              // 채팅 메시지 기록 배열
let notes = [];                 // 사용자 메모 배열
let selectedNoteId = null;      // 현재 선택된 메모 ID
let currentQuiz = null;         // 현재 진행 중인 퀴즈 데이터
let currentQuizSession = null;  // 현재 퀴즈 세션 ID (DB 저장 연동용)
let quizAnswers = [];           // 사용자가 입력한 퀴즈 정답 배열
let chapters = [];              // PDF 챕터 목록
let currentChapter = null;      // 현재 선택된 챕터 번호 (null이면 전체 모드)
let searchResults = [];         // 검색 결과 배열
let searchResultsCollapsed = false; // 검색 결과 패널 접힘 상태
let chaptersCollapsed = false;      // 챕터 목록 패널 접힘 상태
let currentAIProvider = 'gemini';   // 현재 AI 공급자 (gemini 고정)
let currentStreamingMessageDiv = null; // 현재 스트리밍 중인 메시지 엘리먼트 (타이핑 효과용)
let currentTheme = null;        // 현재 적용된 테마 ID

// =========================================================================================
// DOM 엘리먼트 참조 (UI Elements)
// =========================================================================================

// 채팅 관련 DOM (WebView 전환으로 인해 삭제/주석 처리됨)
// const chatMessages = document.getElementById('chat-messages'); 
// const chatInput = document.getElementById('chat-input');       
// const sendBtn = document.getElementById('send-btn');           
// const aiProviderSelect = document.getElementById('ai-provider-select');

// PDF 및 파일 제어 DOM
const uploadPdfBtn = document.getElementById('upload-pdf-btn');        // 상단 업로드 버튼
const uploadPdfBtnCenter = document.getElementById('upload-pdf-btn-center'); // 중앙 업로드 버튼 (초기 화면용)
const pdfViewer = document.getElementById('pdf-viewer');               // 초기 업로드 화면 컨테이너
const chapterSelectionScreen = document.getElementById('chapter-selection-screen'); // 챕터 선택 화면
const chapterCardsGrid = document.getElementById('chapter-cards-grid'); // 챕터 카드 그리드 컨테이너
const startFullModeBtn = document.getElementById('start-full-mode-btn'); // 전체 모드 진입 버튼

// PDF 컨텐츠 뷰어 DOM (실제 PDF 표시)
const pdfContentViewer = document.getElementById('pdf-content-viewer'); // 뷰어 컨테이너
const backToChaptersBtn = document.getElementById('back-to-chapters-btn'); // 챕터 목록 복귀 버튼
const currentChapterInfo = document.getElementById('current-chapter-info'); // 현재 챕터/페이지 정보 표시줄
const pdfIframe = document.getElementById('pdf-iframe'); // PDF.js 뷰어를 포함하는 iframe

// 사이드 패널 관련 DOM (챕터 목록, 검색 결과 등)
const viewGemini = document.getElementById('view-gemini');
const viewChapters = document.getElementById('view-chapters');
const tabGemini = document.getElementById('tab-gemini');
const tabChapters = document.getElementById('tab-chapters');
const chaptersList = document.getElementById('chapters-list');
// const toggleChaptersBtn = document.getElementById('toggle-chapters-btn'); // 탭 방식으로 변경되어 더 이상 사용 안함

// 검색 관련 DOM
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResultsPanel = document.getElementById('search-results-panel');
const searchResultsTitle = document.getElementById('search-results-title');
const searchResultsContent = document.getElementById('search-results-content');
const toggleSearchResultsBtn = document.getElementById('toggle-search-results-btn');

// 메모 및 오답노트 DOM
const notesList = document.getElementById('notes-list');
const noteInput = document.getElementById('note-input');
const saveNoteBtn = document.getElementById('save-note-btn');
const newNoteBtn = document.getElementById('new-note-btn');
const mistakesList = document.getElementById('mistakes-list');
const refreshMistakesBtn = document.getElementById('refresh-mistakes-btn');

// 탭 버튼 및 컨텐츠 DOM
const tabNotes = document.getElementById('tab-notes');
const tabMistakes = document.getElementById('tab-mistakes');
const tabQuiz = document.getElementById('tab-quiz');
const notesTab = document.getElementById('notes-tab');
const mistakesTab = document.getElementById('mistakes-tab');
const quizTab = document.getElementById('quiz-tab');

// 퀴즈 시스템 DOM
const quizRangeType = document.getElementById('quiz-range-type');
const customRange = document.getElementById('custom-range');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const quizContent = document.getElementById('quiz-content'); // 문제 표시 영역
const quizResults = document.getElementById('quiz-results'); // 결과 표시 영역
const quizGenerator = document.getElementById('quiz-generator'); // 생성 옵션 영역

/**
 * 초기화 함수 (애플리케이션 시작 시 호출)
 */
async function init() {
  console.log('🚀 Renderer 초기화 시작');
  loadNotes();          // 저장된 메모 불러오기
  setupEventListeners(); // 이벤트 리스너 등록
  loadMistakeNotes();   // 오답 노트 불러오기
  loadSavedTheme();     // 테마 적용
}

/**
 * 이벤트 리스너 일괄 등록
 */
function setupEventListeners() {
  // 1. 채팅 전송 이벤트 (WebView 전환으로 삭제됨)
  // sendBtn.addEventListener... (Removed)

  // 2. AI 프로바이더 변경 (WebView 전환으로 삭제됨)
  // aiProviderSelect.addEventListener... (Removed)

  // 3. 검색 기능 이벤트
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });

  /*
  // 4. 패널 토글 이벤트 (검색 결과, 챕터 목록) - 챕터 토글 로직은 탭으로 변경됨
  if (toggleSearchResultsBtn) {
    toggleSearchResultsBtn.addEventListener('click', toggleSearchResults);
    document.querySelector('.search-results-header').addEventListener('click', toggleSearchResults);
  }
  // if (toggleChaptersBtn) {
  //  document.querySelector('.chapters-header').addEventListener('click', toggleChapters);
  // }
  */

  // 5. 좌측 패널 탭 전환 이벤트 (Gemini <-> 목차)
  if (tabGemini && tabChapters) {
    tabGemini.addEventListener('click', () => switchLeftPanelTab('gemini'));
    tabChapters.addEventListener('click', () => switchLeftPanelTab('chapters'));
  }

  // 5. PDF 업로드 및 네비게이션
  uploadPdfBtn.addEventListener('click', selectPDF);
  uploadPdfBtnCenter.addEventListener('click', selectPDF);

  if (startFullModeBtn) {
    startFullModeBtn.addEventListener('click', startFullMode);
  }
  if (backToChaptersBtn) {
    backToChaptersBtn.addEventListener('click', backToChapterSelection);
  }

  // 6. 메모장 기능
  newNoteBtn.addEventListener('click', newNote);
  saveNoteBtn.addEventListener('click', saveNote);
  noteInput.addEventListener('input', () => {
    saveNoteBtn.disabled = !noteInput.value.trim(); // 내용이 없으면 저장 버튼 비활성화
  });

  // 7. 우측 사이드바 탭 전환
  tabNotes.addEventListener('click', () => switchTab('notes'));
  tabMistakes.addEventListener('click', () => switchTab('mistakes'));
  tabQuiz.addEventListener('click', () => switchTab('quiz'));

  // 8. 오답노트 새로고침
  refreshMistakesBtn.addEventListener('click', loadMistakeNotes);

  // 9. 퀴즈 생성 옵션 제어
  quizRangeType.addEventListener('change', () => {
    // '사용자 지정' 범위 선택 시 날짜 입력창 표시
    if (quizRangeType.value === 'custom') {
      customRange.style.display = 'block';
    } else {
      customRange.style.display = 'none';
    }
  });

  generateQuizBtn.addEventListener('click', generateQuiz);
}

// =========================================================================================
// UI 제어 함수 (Toggle, Tab Switching)
// =========================================================================================

/**
 * 좌측 패널 탭 전환 함수
 */
function switchLeftPanelTab(tabName) {
  // 탭 활성화 상태 변경
  if (tabName === 'gemini') {
    tabGemini.classList.add('active');
    tabChapters.classList.remove('active');

    viewGemini.style.display = 'flex';
    viewChapters.style.display = 'none';
  } else {
    tabGemini.classList.remove('active');
    tabChapters.classList.add('active');

    viewGemini.style.display = 'none';
    viewChapters.style.display = 'flex';
  }
}

/**
 * [수정됨] 탭 방식으로 변경됨에 따라 기존 토글 함수 대체/삭제
 */
function toggleChapters() {
  // 레거시 지원을 위해 남겨두거나, 탭 전환으로 유도
  switchLeftPanelTab('chapters');
}

/**
 * 우측 사이드바 탭 전환 함수
 * @param {string} tabName - 'notes', 'mistakes', 'quiz' 중 하나
 */
function switchTab(tabName) {
  // 모든 탭 버튼 및 컨텐츠 비활성화 (초기화)
  [tabNotes, tabMistakes, tabQuiz].forEach(btn => btn.classList.remove('active'));
  [notesTab, mistakesTab, quizTab].forEach(content => content.classList.remove('active'));

  // 선택된 탭 활성화
  if (tabName === 'notes') {
    tabNotes.classList.add('active');
    notesTab.classList.add('active');
  } else if (tabName === 'mistakes') {
    tabMistakes.classList.add('active');
    mistakesTab.classList.add('active');
    loadMistakeNotes(); // 오답노트 데이터 갱신
  } else if (tabName === 'quiz') {
    tabQuiz.classList.add('active');
    quizTab.classList.add('active');
  }
}

// =========================================================================================
// PDF 파일 처리 (업로드, 챕터 로딩)
// =========================================================================================

/**
 * PDF 선택 및 로드 프로세스 시작
 */
async function selectPDF() {
  console.log('📂 PDF 선택 시작');

  // 메인 프로세스에 파일 선택 다이얼로그 요청
  const result = await window.electronAPI.selectPDF();

  if (!result) {
    console.log('⚠️ PDF 선택이 취소되었습니다.');
    return;
  }

  if (result.error) {
    console.error('❌ PDF 로드 오류:', result.error);
    addMessage('assistant', `오류 발생: ${result.error}`);
    return;
  }

  // 로드 성공 상태 업데이트
  console.log('✅ PDF 로드 성공:', result.fileName);
  pdfData = result;

  // 초기 상태: iframe 숨김 (챕터 선택 화면을 먼저 보여주기 위함)
  pdfContentViewer.style.display = 'none';
  if (pdfIframe) pdfIframe.src = '';

  // 데이터베이스/메타데이터에서 챕터 정보 로드
  await loadChapters();

  // 챕터 목록 패널 표시
  chaptersPanel.style.display = 'block';

  // UX 결정: 챕터 카드를 보여주는 대신 바로 전체 문서 모드로 진입하도록 변경됨
  // (사용자 편의성을 위해 기본적으로 문서를 바로 열어줌)
  console.log('🎨 UI 전환: 전체 문서 모드로 자동 진입');
  pdfViewer.style.display = 'none'; // 초기화면 숨김
  chapterSelectionScreen.style.display = 'none';
  pdfContentViewer.style.display = 'flex'; // 메인 뷰어 표시

  // 상단 정보 표시
  currentChapterInfo.textContent = `📖 전체 문서 모드 (${result.numPages}페이지) - 왼쪽 목록에서 챕터 이동 가능`;

  // PDF.js 뷰어 iframe 로드 (1페이지부터)
  const pdfUrl = `pdf-viewer.html?file=${encodeURIComponent('file://' + result.filePath)}&page=1`;
  pdfIframe.src = pdfUrl;

  console.log('✅ 뷰어 로드 완료');
}

/**
 * DB에서 해당 PDF의 챕터 목록을 불러오는 함수
 */
async function loadChapters() {
  if (!pdfData) return;

  try {
    const result = await window.electronAPI.getChapters(pdfData.fileName);

    if (result.success && result.chapters.length > 0) {
      chapters = result.chapters;
      renderChapters(); // 사이드바 목록 렌더링
      chaptersPanel.style.display = 'block';
    } else {
      console.log('ℹ️ 챕터 정보가 없습니다.');
      chapters = [];
      chaptersPanel.style.display = 'none';
    }
  } catch (error) {
    console.error('❌ 챕터 로드 실패:', error);
    chapters = [];
  }
}

/**
 * 사이드바에 챕터 목록을 HTML로 렌더링
 */
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

// =========================================================================================
// 챕터 및 페이지 네비게이션 제어
// =========================================================================================

/**
 * 왼쪽 사이드바에서 특정 챕터를 클릭했을 때 호출됨
 * @param {number} chapterNumber 
 */
function selectChapter(chapterNumber) {
  console.log(`🎯 챕터 전환: Chapter ${chapterNumber}`);

  currentChapter = chapterNumber;
  const chapter = chapters.find(c => c.chapterNumber === chapterNumber);
  if (!chapter) return;

  // 상단 정보 업데이트
  currentChapterInfo.textContent = `📚 Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle} (${chapter.startPage}-${chapter.endPage}페이지)`;

  // 이미 뷰어가 떠 있다면 페이지만 이동
  if (pdfContentViewer.style.display === 'flex' && pdfIframe.src) {
    goToPdfPage(chapter.startPage);
  } else {
    // 처음이라면 뷰어 전체 로드
    pdfViewer.style.display = 'none';
    chapterSelectionScreen.style.display = 'none';
    pdfContentViewer.style.display = 'flex';
    const pdfUrl = `pdf-viewer.html?file=${encodeURIComponent('file://' + pdfData.filePath)}&page=${chapter.startPage}`;
    pdfIframe.src = pdfUrl;
  }

  // 활성 챕터 표시 업데이트 (CSS 클래스)
  renderChapters();
  // 퀴즈 탭의 챕터 정보 업데이트
  updateQuizChapterInfo();
}

/**
 * "전체 문서 모드" 시작 (챕터 제한 없이 보기)
 */
function startFullMode() {
  currentChapter = null; // 챕터 선택 해제
  if (!pdfData) return;

  chapterSelectionScreen.style.display = 'none';
  pdfContentViewer.style.display = 'flex';
  currentChapterInfo.textContent = `📖 전체 문서 모드 (${pdfData.numPages}페이지)`;

  const pdfUrl = `pdf-viewer.html?file=${encodeURIComponent('file://' + pdfData.filePath)}&page=1`;
  pdfIframe.src = pdfUrl;

  renderChapters();
  updateQuizChapterInfo();
}

/**
 * 챕터 선택 화면(카드 그리드)으로 돌아가기
 * 현재는 전체 문서 모드로 돌아가는 기능으로 동작함
 */
function backToChapterSelection() {
  currentChapter = null;
  if (!pdfData) return;

  currentChapterInfo.textContent = `📖 전체 문서 모드 (${pdfData.numPages}페이지)`;
  goToPdfPage(1); // 1페이지로 복귀
  renderChapters();
}

/**
 * iframe 내부의 PDF.js 뷰어에게 페이지 이동 메시지 전송
 * @param {number} pageNumber 
 */
function goToPdfPage(pageNumber) {
  if (pdfIframe && pdfIframe.contentWindow) {
    // postMessage를 사용하여 iframe 내부 스크립트와 통신
    pdfIframe.contentWindow.postMessage({
      type: 'goToPage',
      page: pageNumber
    }, '*');
    console.log(`📡 페이지 이동 명령 전송: ${pageNumber}p`);
  }
}

function updateQuizChapterInfo() {
  const quizInfoBox = document.getElementById('current-chapter-quiz-info');
  const quizChapterName = document.getElementById('quiz-chapter-name');

  if (currentChapter && chapters.length > 0) {
    const chapter = chapters.find(c => c.chapterNumber === currentChapter);
    if (chapter) {
      quizInfoBox.style.display = 'block';
      quizChapterName.textContent = `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`;
    }
  } else {
    quizInfoBox.style.display = 'none';
  }
}

// =========================================================================================
// AI 채팅 및 스트리밍 로직 (핵심 기능)
// =========================================================================================

/**
 * 사용자가 메시지를 전송할 때 실행되는 함수
 * 스트리밍 방식을 사용하여 실시간으로 AI 응답을 표시합니다.
 */
/**
 * sendMessage 및 AI Streaming 로직 삭제됨
 * 사유: WebView(gemini.google.com) 직접 사용으로 전환되어 더 이상 사용하지 않음.
 */

/**
 * 스트리밍용 빈 메시지 버블을 생성하여 반환함
 */
function createStreamingMessageBubble() {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message assistant`; // AI 역할 클래스
  messageDiv.innerHTML = `
    <div class="message-bubble"></div> <!-- 내용은 비워둠 -->
    <div class="message-time">${formatTime(new Date())}</div>
  `;
  return messageDiv;
}

/**
 * 일반 메시지(User 등)를 추가하는 헬퍼 함수
 */
/**
 * (수정됨) 채팅 UI 제거로 인해 console.log 및 alert로 대체
 */
function addMessage(role, content) {
  console.log(`[${role}] ${content}`);
  if (role === 'assistant' && content.includes('오류')) {
    alert(content);
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// =========================================================================================
// 검색 기능 구현
// =========================================================================================

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return alert('검색어를 입력해주세요.');
  if (!pdfData) return alert('PDF가 로드되지 않았습니다.');

  console.log(`🔍 검색 시작: ${query}`);
  searchBtn.disabled = true;
  searchBtn.textContent = '...';

  try {
    searchResults = [];
    const queryLower = query.toLowerCase();

    // 페이지별 텍스트 순회
    pdfData.pageTexts.forEach((pageData) => {
      const text = pageData.text;
      const textLower = text.toLowerCase();
      let index = textLower.indexOf(queryLower);

      // 한 페이지 내에서 여러 개의 결과를 찾으려면 while 루프 사용 가능하지만
      // 여기서는 페이지당 첫 번째 결과만 찾는 단순 로직 사용
      if (index !== -1) {
        // 앞뒤 100자 컨텍스트 추출
        const start = Math.max(0, index - 100);
        const end = Math.min(text.length, index + query.length + 100);
        let context = text.substring(start, end);

        if (start > 0) context = '...' + context;
        if (end < text.length) context = context + '...';

        searchResults.push({
          pageNum: pageData.pageNum,
          context: context,
          query: query
        });
      }
    });

    renderSearchResults();

  } catch (error) {
    console.error('검색 중 오류:', error);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = '검색';
  }
}

function renderSearchResults() {
  if (searchResults.length === 0) {
    searchResultsContent.innerHTML = `<div class="search-no-results"><p>결과가 없습니다.</p></div>`;
    searchResultsTitle.textContent = '결과 (0)';
  } else {
    searchResultsTitle.textContent = `결과 (${searchResults.length})`;
    searchResultsContent.innerHTML = searchResults.map(result => {
      // 검색어 하이라이팅 처리
      const highlighted = highlightSearchTerm(result.context, result.query);
      return `
        <div class="search-result-item" onclick="goToSearchResult(${result.pageNum})">
          <span class="search-result-page">p.${result.pageNum}</span>
          <div class="search-result-text">${highlighted}</div>
        </div>
      `;
    }).join('');
  }

  searchResultsPanel.style.display = 'block';
  searchResultsPanel.classList.remove('collapsed');
}

/**
 * 텍스트 내에서 검색어를 <span> 태그로 감싸 하이라이트 처리
 */
function highlightSearchTerm(text, query) {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<span class="search-result-highlight">$1</span>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toggleSearchResults() {
  searchResultsCollapsed = !searchResultsCollapsed;
  if (searchResultsCollapsed) {
    searchResultsPanel.classList.add('collapsed');
    toggleSearchResultsBtn.textContent = '▶';
  } else {
    searchResultsPanel.classList.remove('collapsed');
    toggleSearchResultsBtn.textContent = '▼';
  }
}

/**
 * 검색 결과 클릭 시 해당 페이지로 이동
 */
function goToSearchResult(pageNum) {
  // 뷰어가 안 보이면 강제 표시
  if (pdfContentViewer.style.display === 'none') {
    chapterSelectionScreen.style.display = 'none';
    pdfContentViewer.style.display = 'flex';
    const pdfUrl = `pdf-viewer.html?file=${encodeURIComponent('file://' + pdfData.filePath)}&page=${pageNum}`;
    pdfIframe.src = pdfUrl;
  } else {
    goToPdfPage(pageNum);
  }
}

// =========================================================================================
// 메모(Notes) 시스템
// =========================================================================================

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
      <div class="note-preview">${note.content.substring(0, 50) || '빈 메모'}...</div>
      <div class="note-date">${new Date(note.createdAt).toLocaleDateString()}</div>
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
  renderNotes(); // 선택 해제 반영
}

function saveNote() {
  const content = noteInput.value.trim();
  if (!content) return;

  if (selectedNoteId) {
    // 기존 메모 업데이트
    const note = notes.find(n => n.id === selectedNoteId);
    if (note) note.content = content;
  } else {
    // 새 메모 생성
    const newNote = {
      id: Date.now().toString(),
      content: content,
      createdAt: new Date().toISOString()
    };
    notes.unshift(newNote); // 최신 순
    selectedNoteId = newNote.id;
  }

  saveNotes();
  renderNotes();
  alert('메모가 저장되었습니다.');
}

// =========================================================================================
// 오답노트 시스템
// =========================================================================================

async function loadMistakeNotes() {
  try {
    // 메인 프로세스에서 전체 오답노트 호출
    const result = await window.electronAPI.getMistakeNotes({});

    if (result.success && result.notes.length > 0) {
      renderMistakeNotes(result.notes);
    } else {
      mistakesList.innerHTML = `
        <div class="empty-mistakes">
          <h3>오답노트가 비어있습니다</h3>
          <p>퀴즈를 틀리면 자동으로 기록됩니다.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('오답노트 로드 오류:', error);
  }
}

function renderMistakeNotes(notes) {
  mistakesList.innerHTML = notes.map(note => `
    <div class="mistake-item ${note.isResolved ? 'resolved' : ''}"
         onclick="viewMistakeNote(${note.id}, ${note.pageNumber || 0})">
      <div class="mistake-header">
        <span class="mistake-badge ${note.isResolved ? 'resolved' : ''}">
          ${note.isResolved ? '복습 완료' : '복습 필요'}
        </span>
        <span class="mistake-page">p.${note.pageNumber || '?'}</span>
      </div>
      <div class="mistake-question">Q. ${note.question}</div>
      <div class="mistake-answer user">❌ 내 답: ${note.userAnswer || '-'}</div>
      <div class="mistake-answer correct">✅ 정답: ${note.correctAnswer}</div>
    </div>
  `).join('');
}

/**
 * 오답노트 클릭 시 액션
 * 1. 해당 페이지로 이동하여 복습 유도
 * 2. '해결됨' 상태로 업데이트
 */
async function viewMistakeNote(noteId, pageNumber) {
  // 상태 업데이트 요청
  await window.electronAPI.resolveMistakeNote(noteId);

  // 페이지 이동
  if (pageNumber && pdfData) {
    if (pdfContentViewer.style.display === 'none') {
      chapterSelectionScreen.style.display = 'none';
      pdfContentViewer.style.display = 'flex';
      const pdfUrl = `pdf-viewer.html?file=${encodeURIComponent('file://' + pdfData.filePath)}&page=${pageNumber}`;
      pdfIframe.src = pdfUrl;
    } else {
      goToPdfPage(pageNumber);
    }
  }

  // 목록 새로고침 (상태 변경 반영)
  loadMistakeNotes();
}

// =========================================================================================
// 퀴즈 생성 및 풀이 시스템
// =========================================================================================

async function generateQuiz() {
  if (!pdfData) return alert('PDF를 먼저 업로드해주세요.');

  generateQuizBtn.disabled = true;
  generateQuizBtn.textContent = '문제 생성 중...';

  try {
    const filters = {
      fileName: pdfData.fileName,
      questionCount: parseInt(document.getElementById('quiz-question-count').value) || 5,
      pageTexts: pdfData.pageTexts
    };

    // 챕터가 선택된 상태면 해당 챕터 우선
    if (currentChapter) {
      filters.chapterNumber = currentChapter;
    } else {
      // 날짜 범위 필터 등 추가 가능
    }

    // 메인 프로세스에 생성 요청
    const result = await window.electronAPI.generateQuiz(filters);

    if (result.success) {
      currentQuiz = result.quiz;
      currentQuizSession = result.sessionId;
      quizAnswers = new Array(result.quiz.questions.length).fill(''); // 답안 배열 초기화

      renderQuiz(result.quiz); // 퀴즈 UI 표시

      // 화면 전환
      quizGenerator.style.display = 'none';
      quizContent.style.display = 'block';
      quizResults.style.display = 'none';
    } else {
      alert(`생성 실패: ${result.error}`);
    }
  } catch (error) {
    console.error(error);
    alert('오류가 발생했습니다.');
  } finally {
    generateQuizBtn.disabled = false;
    generateQuizBtn.textContent = '퀴즈 생성하기';
  }
}

/**
 * 퀴즈 문제들을 HTML로 렌더링
 */
function renderQuiz(quiz) {
  const questionsHTML = quiz.questions.map((q, index) => {
    // 객관식 렌더링
    if (q.type === '객관식') {
      return `
        <div class="quiz-question">
          <div class="quiz-question-header">
            <span>#${q.number}</span> <span class="badge">${q.type}</span>
          </div>
          <div class="quiz-text">${q.question}</div>
          <div class="quiz-choices">
            ${q.choices.map((choice, i) => `
              <div class="quiz-choice">
                <input type="radio" name="q-${index}" id="q${index}-c${i}" 
                       value="${choice}" onchange="updateAnswer(${index}, '${choice}')">
                <label for="q${index}-c${i}">${choice}</label>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      // 주관식 렌더링
      return `
        <div class="quiz-question">
          <div class="quiz-question-header">
            <span>#${q.number}</span> <span class="badge">${q.type}</span>
          </div>
          <div class="quiz-text">${q.question}</div>
          <input type="text" class="quiz-input" placeholder="정답 입력" 
                 oninput="updateAnswer(${index}, this.value)">
        </div>
      `;
    }
  }).join('');

  quizContent.innerHTML = `
    ${questionsHTML}
    <div class="quiz-actions">
      <button class="btn-primary" onclick="submitQuiz()">답안 제출</button>
    </div>
  `;
}

function updateAnswer(index, value) {
  quizAnswers[index] = value;
}

/**
 * 퀴즈 답안 제출 처리
 */
async function submitQuiz() {
  // 미응답 체크
  if (quizAnswers.some(a => !a || a.trim() === '')) {
    if (!confirm('풀지 않은 문제가 있습니다. 그래도 제출하시겠습니까?')) return;
  }

  try {
    const result = await window.electronAPI.gradeQuiz({
      sessionId: currentQuizSession,
      answers: quizAnswers,
      quiz: { ...currentQuiz, fileName: pdfData.fileName }
    });

    if (result.success) {
      renderQuizResults(result); // 채점 결과 표시
      quizContent.style.display = 'none';
      quizResults.style.display = 'block';
      loadMistakeNotes(); // 오답노트에도 반영되었으므로 갱신
    }
  } catch (e) {
    alert('제출 중 오류 발생');
  }
}

function renderQuizResults(result) {
  const resultsHTML = result.results.map(r => `
    <div class="quiz-result-item ${r.isCorrect ? 'correct' : 'incorrect'}">
      <div>문제 ${r.questionNumber}: ${r.isCorrect ? '⭕ 정답' : '❌ 오답'}</div>
      <div>내 답: ${r.userAnswer}</div>
      ${!r.isCorrect ? `<div>정답: ${r.correctAnswer}</div>` : ''}
      <div class="explanation">💡 ${r.explanation}</div>
    </div>
  `).join('');

  quizResults.innerHTML = `
    <div class="score-card">
      <h2>${Math.round(result.score)}점</h2>
      <p>(${result.correctCount} / ${result.totalQuestions} 문제 정답)</p>
    </div>
    ${resultsHTML}
    <button onclick="backToQuizGenerator()" class="btn-secondary">새 퀴즈 만들기</button>
  `;
}

function backToQuizGenerator() {
  quizGenerator.style.display = 'block';
  quizContent.style.display = 'none';
  quizResults.style.display = 'none';
  currentQuiz = null;
  quizAnswers = [];
}

// =========================================================================================
// 테마(Theme) 관리
// =========================================================================================

async function loadSavedTheme() {
  const result = await window.electronAPI.loadTheme();
  if (result && result.theme) {
    currentTheme = result.theme;
    applyTheme(result.theme);
  }
}

function applyTheme(themeId) {
  if (themeId && themeId !== 'default') {
    document.body.setAttribute('data-theme', themeId);
  } else {
    document.body.removeAttribute('data-theme');
  }
}

// 전역 스코프에 함수 노출 (HTML onclick 핸들러용)
window.selectNote = selectNote;
window.viewMistakeNote = viewMistakeNote;
window.updateAnswer = updateAnswer;
window.submitQuiz = submitQuiz;
window.backToQuizGenerator = backToQuizGenerator;
window.selectChapter = selectChapter;
window.goToPdfPage = goToPdfPage;
window.goToSearchResult = goToSearchResult;

// 앱 초기화 실행
init();
