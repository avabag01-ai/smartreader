/**
 * =========================================================================================
 * SmartReader Database Module (SQLite)
 * =========================================================================================
 * 
 * 로컬 데이터 저장을 위한 SQLite 데이터베이스 매니저입니다.
 * 'better-sqlite3' 라이브러리를 사용하여 동기식으로 빠르고 안정적인 쿼리 수행을 보장합니다.
 * 
 * 주요 테이블:
 * - Chapter: PDF 챕터 정보 및 추출된 텍스트
 * - LearningHistory: AI와의 대화 내용 및 학습 이력
 * - MistakeNote: 퀴즈 오답 노트
 * - QuizSession: 퀴즈 풀이 결과 및 점수
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class StudyDatabase {
  /**
   * 데이터베이스 초기화 및 연결
   * 애플리케이션의 User Data 경로에 'studypad.db' 파일을 생성하거나 엽니다.
   */
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'studypad.db');

    // DB 연결 (파일이 없으면 자동 생성됨)
    this.db = new Database(dbPath); // { verbose: console.log } 를 추가하면 쿼리 로그 확인 가능

    // 테이블 스키마 초기화 실행
    this.initializeTables();
  }

  /**
   * 필요한 테이블이 없으면 생성 (Schema Migration)
   */
  initializeTables() {
    // 1. Chapter 테이블: PDF의 챕터 구조와 추출된 텍스트 저장
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Chapter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileName TEXT NOT NULL,         -- 원본 파일명
        chapterNumber INTEGER NOT NULL, -- 챕터 번호 (1, 2, 3...)
        chapterTitle TEXT NOT NULL,     -- 챕터 제목
        startPage INTEGER NOT NULL,     -- 시작 페이지
        endPage INTEGER NOT NULL,       -- 끝 페이지
        extractedText TEXT,             -- 해당 챕터의 텍스트 전문
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. LearningHistory 테이블: AI와의 채팅 로그 및 학습 활동 기록
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS LearningHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        fileName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        pageNumber INTEGER,
        chapterNumber INTEGER,
        textContent TEXT,
        conversationId TEXT,  -- 대화 세션 ID (그룹핑용)
        userQuestion TEXT,    -- 사용자 질문
        aiResponse TEXT,      -- AI 답변
        userMemo TEXT,
        timeSpent INTEGER DEFAULT 0
      )
    `);

    // 3. MistakeNote 테이블: 틀린 문제 저장 (오답노트)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS MistakeNote (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        fileName TEXT NOT NULL,
        pageNumber INTEGER,
        originalText TEXT NOT NULL,  -- 문제의 원문
        question TEXT NOT NULL,      -- 문제 내용
        userAnswer TEXT,             -- 내가 쓴 답
        correctAnswer TEXT,          -- 정답
        aiExplanation TEXT,          -- AI 해설
        quizSessionId TEXT,          -- 연결된 퀴즈 세션
        isResolved INTEGER DEFAULT 0 -- 0: 미해결(복습필요), 1: 해결됨
      )
    `);

    // 4. QuizSession 테이블: 퀴즈 진행 결과 기록
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS QuizSession (
        id TEXT PRIMARY KEY,        -- 타임스탬프 기반 고유 ID
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        dateRangeStart DATETIME,    -- 출제 범위 시작일 (옵션)
        dateRangeEnd DATETIME,      -- 출제 범위 종료일 (옵션)
        pageRangeStart INTEGER,
        pageRangeEnd INTEGER,
        fileName TEXT,
        totalQuestions INTEGER,     -- 총 문제 수
        correctAnswers INTEGER,     -- 맞은 개수
        score REAL                  -- 점수 (백분율)
      )
    `);

    // 성능 최적화를 위한 인덱스 생성
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chapter_file ON Chapter(fileName);
      CREATE INDEX IF NOT EXISTS idx_learning_timestamp ON LearningHistory(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mistake_file ON MistakeNote(fileName);
    `);
  }

  // =====================================================================================
  // 챕터(Chapter) 관련 메서드
  // =====================================================================================

  /**
   * 챕터 정보 저장
   */
  addChapter(data) {
    const stmt = this.db.prepare(`
      INSERT INTO Chapter
      (fileName, chapterNumber, chapterTitle, startPage, endPage, extractedText)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.fileName,
      data.chapterNumber,
      data.chapterTitle,
      data.startPage,
      data.endPage,
      data.extractedText || null
    );
  }

  /**
   * 특정 파일의 모든 챕터 조회 (번호순 정렬)
   */
  getChapters(fileName) {
    const stmt = this.db.prepare(`
      SELECT * FROM Chapter
      WHERE fileName = ?
      ORDER BY chapterNumber ASC
    `);
    return stmt.all(fileName);
  }

  /**
   * 특정 파일의 특정 챕터 조회
   */
  getChapter(fileName, chapterNumber) {
    const stmt = this.db.prepare(`
      SELECT * FROM Chapter
      WHERE fileName = ? AND chapterNumber = ?
    `);
    return stmt.get(fileName, chapterNumber);
  }

  /**
   * 파일명에 해당하는 챕터 전체 삭제 (새로 업로드 시 갱신용)
   */
  deleteChapters(fileName) {
    const stmt = this.db.prepare('DELETE FROM Chapter WHERE fileName = ?');
    return stmt.run(fileName);
  }

  // =====================================================================================
  // 학습 이력(LearningHistory) 메서드
  // =====================================================================================

  addLearningHistory(data) {
    const stmt = this.db.prepare(`
      INSERT INTO LearningHistory
      (fileName, filePath, pageNumber, chapterNumber, textContent, conversationId,
       userQuestion, aiResponse, userMemo, timeSpent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.fileName,
      data.filePath,
      data.pageNumber || null,
      data.chapterNumber || null,
      data.textContent || null,
      data.conversationId || null,
      data.userQuestion || null,
      data.aiResponse || null,
      data.userMemo || null,
      data.timeSpent || 0
    );
  }

  // =====================================================================================
  // 오답노트(MistakeNote) 메서드
  // =====================================================================================

  addMistakeNote(data) {
    const stmt = this.db.prepare(`
      INSERT INTO MistakeNote
      (fileName, pageNumber, originalText, question, userAnswer,
       correctAnswer, aiExplanation, quizSessionId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.fileName,
      data.pageNumber || null,
      data.originalText,
      data.question,
      data.userAnswer || null,
      data.correctAnswer || null,
      data.aiExplanation || null,
      data.quizSessionId
    );
  }

  /**
   * 오답노트 조회 (필터링 지원)
   */
  getMistakeNotes(filters = {}) {
    let query = 'SELECT * FROM MistakeNote WHERE 1=1';
    const params = [];

    // 파일명 필터
    if (filters.fileName) {
      query += ' AND fileName = ?';
      params.push(filters.fileName);
    }

    // 해결 여부 필터
    if (filters.isResolved !== undefined) {
      query += ' AND isResolved = ?';
      params.push(filters.isResolved);
    }

    query += ' ORDER BY timestamp DESC'; // 최신순

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * 오답노트 해결 처리 (토글)
   */
  resolveMistakeNote(id) {
    // 현재는 단순하게 1(해결됨)로 업데이트
    const stmt = this.db.prepare('UPDATE MistakeNote SET isResolved = 1 WHERE id = ?');
    return stmt.run(id);
  }

  // =====================================================================================
  // 퀴즈 세션(QuizSession) 메서드
  // =====================================================================================

  addQuizSession(data) {
    const stmt = this.db.prepare(`
      INSERT INTO QuizSession
      (id, dateRangeStart, dateRangeEnd, pageRangeStart, pageRangeEnd,
       fileName, totalQuestions, correctAnswers, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.id,
      data.dateRangeStart || null,
      data.dateRangeEnd || null,
      data.pageRangeStart || null,
      data.pageRangeEnd || null,
      data.fileName || null,
      data.totalQuestions,
      data.correctAnswers,
      data.score
    );
  }

  getQuizSessions(limit = 10) {
    const stmt = this.db.prepare('SELECT * FROM QuizSession ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  }

  // =====================================================================================
  // 통계(Statistics) 메서드
  // =====================================================================================

  getStatistics(fileName = null) {
    let query = `
      SELECT
        COUNT(*) as totalSessions,
        SUM(totalQuestions) as totalQuestions,
        SUM(correctAnswers) as totalCorrect,
        AVG(score) as averageScore
      FROM QuizSession
    `;

    const params = [];
    if (fileName) {
      query += ' WHERE fileName = ?';
      params.push(fileName);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params);
  }

  /**
   * DB 연결 종료 (앱 종료 시 호출)
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed.');
    }
  }
}

module.exports = StudyDatabase;
