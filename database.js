const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class StudyDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'studypad.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  initializeTables() {
    // Chapter 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Chapter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileName TEXT NOT NULL,
        chapterNumber INTEGER NOT NULL,
        chapterTitle TEXT NOT NULL,
        startPage INTEGER NOT NULL,
        endPage INTEGER NOT NULL,
        extractedText TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // LearningHistory 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS LearningHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        fileName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        pageNumber INTEGER,
        chapterNumber INTEGER,
        textContent TEXT,
        conversationId TEXT,
        userQuestion TEXT,
        aiResponse TEXT,
        userMemo TEXT,
        timeSpent INTEGER DEFAULT 0
      )
    `);

    // MistakeNote 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS MistakeNote (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        fileName TEXT NOT NULL,
        pageNumber INTEGER,
        originalText TEXT NOT NULL,
        question TEXT NOT NULL,
        userAnswer TEXT,
        correctAnswer TEXT,
        aiExplanation TEXT,
        quizSessionId TEXT,
        isResolved INTEGER DEFAULT 0
      )
    `);

    // QuizSession 테이블 생성 (퀴즈 이력 관리)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS QuizSession (
        id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        dateRangeStart DATETIME,
        dateRangeEnd DATETIME,
        pageRangeStart INTEGER,
        pageRangeEnd INTEGER,
        fileName TEXT,
        totalQuestions INTEGER,
        correctAnswers INTEGER,
        score REAL
      )
    `);

    // 인덱스 생성 (성능 최적화)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chapter_file ON Chapter(fileName);
      CREATE INDEX IF NOT EXISTS idx_chapter_number ON Chapter(chapterNumber);
      CREATE INDEX IF NOT EXISTS idx_learning_timestamp ON LearningHistory(timestamp);
      CREATE INDEX IF NOT EXISTS idx_learning_file ON LearningHistory(fileName);
      CREATE INDEX IF NOT EXISTS idx_learning_page ON LearningHistory(pageNumber);
      CREATE INDEX IF NOT EXISTS idx_learning_chapter ON LearningHistory(chapterNumber);
      CREATE INDEX IF NOT EXISTS idx_mistake_file ON MistakeNote(fileName);
      CREATE INDEX IF NOT EXISTS idx_mistake_page ON MistakeNote(pageNumber);
      CREATE INDEX IF NOT EXISTS idx_quiz_session ON QuizSession(timestamp);
    `);
  }

  // 챕터 저장
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

  // 챕터 조회
  getChapters(fileName) {
    const stmt = this.db.prepare(`
      SELECT * FROM Chapter
      WHERE fileName = ?
      ORDER BY chapterNumber ASC
    `);
    return stmt.all(fileName);
  }

  // 특정 챕터 조회
  getChapter(fileName, chapterNumber) {
    const stmt = this.db.prepare(`
      SELECT * FROM Chapter
      WHERE fileName = ? AND chapterNumber = ?
    `);
    return stmt.get(fileName, chapterNumber);
  }

  // 페이지 번호로 챕터 찾기
  findChapterByPage(fileName, pageNumber) {
    const stmt = this.db.prepare(`
      SELECT * FROM Chapter
      WHERE fileName = ? AND ? BETWEEN startPage AND endPage
    `);
    return stmt.get(fileName, pageNumber);
  }

  // 챕터 삭제 (파일별)
  deleteChapters(fileName) {
    const stmt = this.db.prepare('DELETE FROM Chapter WHERE fileName = ?');
    return stmt.run(fileName);
  }

  // 학습 이력 저장
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

  // 특정 기간의 학습 데이터 조회
  getLearningHistory(filters = {}) {
    let query = 'SELECT * FROM LearningHistory WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.fileName) {
      query += ' AND fileName = ?';
      params.push(filters.fileName);
    }

    if (filters.pageStart !== undefined) {
      query += ' AND pageNumber >= ?';
      params.push(filters.pageStart);
    }

    if (filters.pageEnd !== undefined) {
      query += ' AND pageNumber <= ?';
      params.push(filters.pageEnd);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // 퀴즈용 학습 데이터 추출 (텍스트 집계)
  getQuizContext(filters = {}) {
    const history = this.getLearningHistory(filters);

    // 텍스트 내용 집계
    const textContents = [];
    const conversationPairs = [];

    history.forEach(record => {
      if (record.textContent) {
        textContents.push({
          text: record.textContent,
          page: record.pageNumber,
          fileName: record.fileName
        });
      }

      if (record.userQuestion && record.aiResponse) {
        conversationPairs.push({
          question: record.userQuestion,
          answer: record.aiResponse,
          page: record.pageNumber,
          fileName: record.fileName
        });
      }
    });

    return {
      textContents,
      conversationPairs,
      totalRecords: history.length
    };
  }

  // 오답 노트 저장
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

  // 오답 노트 조회
  getMistakeNotes(filters = {}) {
    let query = 'SELECT * FROM MistakeNote WHERE 1=1';
    const params = [];

    if (filters.fileName) {
      query += ' AND fileName = ?';
      params.push(filters.fileName);
    }

    if (filters.isResolved !== undefined) {
      query += ' AND isResolved = ?';
      params.push(filters.isResolved);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // 오답 노트 해결 표시
  resolveMistakeNote(id) {
    const stmt = this.db.prepare('UPDATE MistakeNote SET isResolved = 1 WHERE id = ?');
    return stmt.run(id);
  }

  // 퀴즈 세션 저장
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

  // 퀴즈 세션 조회
  getQuizSessions(limit = 10) {
    const stmt = this.db.prepare('SELECT * FROM QuizSession ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  }

  // 통계 데이터 조회
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

  // 데이터베이스 닫기
  close() {
    this.db.close();
  }
}

module.exports = StudyDatabase;
