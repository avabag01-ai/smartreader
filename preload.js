/**
 * =========================================================================================
 * SmartReader Preload Script (Bridge)
 * =========================================================================================
 * 
 * 이 스크립트는 렌더러 프로세스(웹페이지)와 메인 프로세스(Node.js) 사이의 
 * 안전한 통신 다리 역할을 합니다.
 * 
 * 'contextBridge'를 통해 메인 프로세스의 기능 중 허용된 것만 
 * 'window.electronAPI' 객체로 렌더러에 노출합니다.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // =====================================================================================
  // 파일 시스템 및 기본 기능
  // =====================================================================================

  /**
   * PDF 파일 선택 대화상자 열기 요청
   * @returns {Promise<Object>} 선택된 파일 정보 및 텍스트 데이터
   */
  selectPDF: () => ipcRenderer.invoke('select-pdf'),

  // =====================================================================================
  // AI 스트리밍 (Gemini) 리스너 및 요청
  // =====================================================================================

  /**
   * AI 응답 데이터(텍스트 청크) 수신 리스너 등록
   * @param {function} callback - (chunk: string) => void
   */
  onAIStreamData: (callback) => ipcRenderer.on('ai-stream-data', (event, chunk) => callback(chunk)),

  /**
   * AI 응답 완료 신호 수신 리스너 등록
   * @param {function} callback - (fullText: string) => void
   */
  onAIStreamEnd: (callback) => ipcRenderer.on('ai-stream-end', (event, fullText) => callback(fullText)),

  /**
   * AI 오류 발생 신호 수신 리스너 등록
   * @param {function} callback - (errorMessage: string) => void
   */
  onAIStreamError: (callback) => ipcRenderer.on('ai-stream-error', (event, error) => callback(error)),

  /**
   * 모든 AI 관련 리스너 제거 (메모리 누수 방지용 Clean-up)
   */
  removeAIListeners: () => {
    ipcRenderer.removeAllListeners('ai-stream-data');
    ipcRenderer.removeAllListeners('ai-stream-end');
    ipcRenderer.removeAllListeners('ai-stream-error');
  },

  /**
   * AI 답변 생성 요청 (스트리밍 시작)
   * @param {Object} data - { question, pdfText, currentChapter ... }
   */
  getAIResponse: (data) => ipcRenderer.invoke('get-ai-response', data),

  // =====================================================================================
  // 퀴즈 및 학습 기능
  // =====================================================================================

  /**
   * 퀴즈 생성 요청
   * @param {Object} filters - { fileName, chapterNumber, questionCount ... }
   */
  generateQuiz: (filters) => ipcRenderer.invoke('generate-quiz', filters),

  /**
   * 퀴즈 채점 요청
   * @param {Object} data - { sessionId, answers, quiz }
   */
  gradeQuiz: (data) => ipcRenderer.invoke('grade-quiz', data),

  /**
   * 오답노트 목록 조회
   */
  getMistakeNotes: (filters) => ipcRenderer.invoke('get-mistake-notes', filters),

  /**
   * 오답노트 해결(복습 완료) 처리
   */
  resolveMistakeNote: (noteId) => ipcRenderer.invoke('resolve-mistake-note', noteId),

  /**
   * 학습 통계 조회
   */
  getStatistics: (fileName) => ipcRenderer.invoke('get-statistics', fileName),

  // =====================================================================================
  // 데이터 조회 및 테마
  // =====================================================================================

  /**
   * 파일의 모든 챕터 목록 조회
   */
  getChapters: (fileName) => ipcRenderer.invoke('get-chapters', fileName),

  /**
   * 특정 챕터 상세 정보 조회
   */
  getChapter: (fileName, chapterNumber) => ipcRenderer.invoke('get-chapter', fileName, chapterNumber),

  /**
   * 테마 설정 저장
   */
  saveTheme: (themeId) => ipcRenderer.invoke('save-theme', themeId),

  /**
   * 저장된 테마 불러오기
   */
  loadTheme: () => ipcRenderer.invoke('load-theme')
});
