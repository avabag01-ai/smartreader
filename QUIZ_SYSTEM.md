# 스마트 퀴즈 시스템 사용 가이드

## 개요

StudyPad AI에 누적 학습 데이터 기반 스마트 퀴즈 시스템이 추가되었습니다. 이 시스템은 학생의 학습 이력을 자동으로 추적하고, 맞춤형 퀴즈를 생성하며, 오답을 자동으로 관리합니다.

## 주요 기능

### 1. 자동 학습 이력 추적

**LearningHistory 테이블**
- PDF 파일명, 페이지 번호
- 학습한 텍스트 내용
- AI와의 대화 내역 (질문과 답변)
- 학습 시간 정보
- 사용자 메모

모든 학습 활동이 자동으로 SQLite 데이터베이스에 저장됩니다.

### 2. 맞춤형 퀴즈 생성

#### 퀴즈 생성 방법

1. 오른쪽 패널에서 **"퀴즈"** 탭 클릭
2. 학습 범위 선택:
   - **전체 기간**: 모든 학습 데이터 사용
   - **최근 1주일**: 최근 7일간의 학습 데이터
   - **최근 1개월**: 최근 30일간의 학습 데이터
   - **직접 설정**: 원하는 날짜 범위 지정

3. 문제 수 설정 (3~15개)
4. **"퀴즈 생성하기"** 버튼 클릭

#### 퀴즈 특징

- AI가 학습 이력을 분석하여 핵심 개념 추출
- 객관식과 주관식 문제를 적절히 혼합
- 각 문제마다 출처 페이지 정보 포함
- 상세한 해설 제공

### 3. 자동 채점 및 오답노트

#### 채점 시스템

- 제출 즉시 자동 채점
- 정답률과 점수 표시
- 문제별 정답/오답 표시
- 오답 문제는 자동으로 오답노트에 저장

#### 오답노트 (MistakeNote)

저장되는 정보:
- 원문 텍스트 및 출처 페이지
- 문제 내용
- 사용자의 오답
- 정답
- AI 해설
- 해결 여부

### 4. 오답노트 활용

1. 오른쪽 패널에서 **"오답노트"** 탭 클릭
2. 미해결/해결됨 상태 확인
3. 오답 항목 클릭 시:
   - 해당 페이지로 이동 (향후 구현)
   - 자동으로 '해결됨'으로 표시
4. 🔄 새로고침 버튼으로 최신 오답 확인

## 데이터베이스 구조

### LearningHistory 테이블
```sql
- id: 고유 ID
- timestamp: 학습 시각
- fileName: PDF 파일명
- filePath: 파일 경로
- pageNumber: 페이지 번호
- textContent: 학습한 텍스트
- conversationId: 대화 세션 ID
- userQuestion: 사용자 질문
- aiResponse: AI 답변
- userMemo: 사용자 메모
- timeSpent: 학습 시간
```

### MistakeNote 테이블
```sql
- id: 고유 ID
- timestamp: 생성 시각
- fileName: PDF 파일명
- pageNumber: 페이지 번호
- originalText: 원문 텍스트
- question: 문제 내용
- userAnswer: 사용자 답변
- correctAnswer: 정답
- aiExplanation: AI 해설
- quizSessionId: 퀴즈 세션 ID
- isResolved: 해결 여부 (0/1)
```

### QuizSession 테이블
```sql
- id: 세션 ID
- timestamp: 생성 시각
- dateRangeStart: 학습 범위 시작
- dateRangeEnd: 학습 범위 종료
- pageRangeStart: 페이지 범위 시작
- pageRangeEnd: 페이지 범위 종료
- fileName: PDF 파일명
- totalQuestions: 총 문제 수
- correctAnswers: 정답 수
- score: 점수
```

## 사용 시나리오

### 시나리오 1: 주간 복습 퀴즈

1. 한 주 동안 PDF를 학습하며 AI에게 질문
2. 주말에 "최근 1주일" 범위로 퀴즈 생성
3. 퀴즈를 풀고 자동 채점
4. 틀린 문제는 오답노트에서 복습

### 시나리오 2: 시험 대비

1. 특정 단원(페이지 범위) 집중 학습
2. "직접 설정"으로 해당 기간 선택
3. 문제 수를 늘려 (10-15개) 종합 테스트
4. 오답노트로 취약점 파악 및 보완

### 시나리오 3: 반복 학습

1. 오답노트에서 미해결 문제 확인
2. 해당 페이지로 돌아가 재학습
3. 같은 범위로 다시 퀴즈 생성
4. 점수 향상 확인

## API 사용법

### 프론트엔드 (renderer.js)

```javascript
// 퀴즈 생성
const result = await window.electronAPI.generateQuiz({
  fileName: 'example.pdf',
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-01-15T23:59:59Z',
  questionCount: 5
});

// 퀴즈 채점
const gradeResult = await window.electronAPI.gradeQuiz({
  sessionId: 'session-123',
  answers: ['답1', '답2', '답3', '답4', '답5'],
  quiz: quizData
});

// 오답노트 조회
const mistakes = await window.electronAPI.getMistakeNotes({
  fileName: 'example.pdf',
  isResolved: 0  // 미해결만
});

// 오답 해결 표시
await window.electronAPI.resolveMistakeNote(noteId);

// 통계 조회
const stats = await window.electronAPI.getStatistics('example.pdf');
```

### 백엔드 (main.js)

데이터베이스 API는 `database.js`에 구현되어 있습니다:

```javascript
const db = new StudyDatabase();

// 학습 이력 저장
db.addLearningHistory({
  fileName: 'example.pdf',
  filePath: '/path/to/file',
  pageNumber: 5,
  userQuestion: '이 개념이 무엇인가요?',
  aiResponse: 'AI의 답변...'
});

// 퀴즈용 컨텍스트 조회
const context = db.getQuizContext({
  fileName: 'example.pdf',
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-01-15T23:59:59Z'
});

// 오답 저장
db.addMistakeNote({
  fileName: 'example.pdf',
  pageNumber: 10,
  originalText: '문제 원문',
  question: '문제 내용',
  userAnswer: '사용자 답변',
  correctAnswer: '정답',
  aiExplanation: '해설',
  quizSessionId: 'session-123'
});
```

## 향후 개선 사항

1. **PDF 뷰어 통합**
   - 오답노트에서 클릭 시 해당 PDF 페이지로 자동 이동
   - 페이지 하이라이트 기능

2. **학습 분석 대시보드**
   - 시간별/날짜별 학습 통계
   - 취약 개념 분석
   - 학습 진도 추적

3. **메타인지 리포트**
   - 자주 틀리는 유형 분석
   - 개념별 이해도 측정
   - 학습 패턴 시각화

4. **스마트 복습 알고리즘**
   - 간격 반복 학습 (Spaced Repetition)
   - 취약 개념 우선 출제
   - 난이도 자동 조절

## 문제 해결

### 퀴즈가 생성되지 않는 경우

- 학습 데이터가 충분한지 확인
- PDF를 업로드하고 AI와 대화를 나눈 후 시도
- Ollama가 실행 중인지 확인

### 데이터베이스 오류

- 앱을 재시작
- 데이터베이스 파일 위치: `~/Library/Application Support/studypad-ai/studypad.db` (macOS)

### AI 응답이 이상한 경우

- 퀴즈 생성은 AI 모델에 의존하므로 결과가 다를 수 있음
- 문제 수를 조정하거나 다시 생성 시도

## 기술 스택

- **데이터베이스**: SQLite (better-sqlite3)
- **AI 모델**: Ollama (qwen2.5-coder:7b)
- **프레임워크**: Electron
- **프론트엔드**: HTML, CSS, JavaScript

## 라이선스

MIT License
