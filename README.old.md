# StudyPad AI - PDF 학습 도우미

## 🔧 수정 완료 사항

### PDF 파싱 문제 해결
- ❌ 기존: `pdf-parse` 라이브러리 (Electron 환경에서 불안정)
- ✅ 수정: `pdfjs-dist` 라이브러리로 교체 (Mozilla의 공식 PDF.js)

### 주요 변경사항

1. **package.json**
   - `pdf-parse` 제거
   - `pdfjs-dist` 추가

2. **main.js**
   - PDF.js 라이브러리 임포트
   - `extractTextFromPDF()` 함수 새로 작성
   - 페이지별 텍스트 추출 로직 구현
   - 상세한 로그 추가 (디버깅용)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 애플리케이션 실행
npm start
```

### 테스트

```bash
# PDF 파싱 단독 테스트
node test-pdf-parsing.js
```

### 기능

1. **PDF 업로드 및 파싱**
   - 모든 페이지의 텍스트 자동 추출
   - 한글 및 영문 모두 지원
   - 페이지 수 자동 계산

2. **AI 채팅**
   - Ollama 로컬 AI 연동 (qwen2.5-coder:7b)
   - PDF 내용 기반 질의응답
   - 일반 대화 지원

3. **노트 작성**
   - 학습 내용 저장
   - 로컬스토리지 기반 영구 저장

### 확인된 작동 상태

✅ PDF 파싱 성공
- test.pdf로 테스트 완료
- 텍스트 추출 정상 작동
- 211자 텍스트 정상 추출

### 필요 사항

- Electron 39.2.7
- Node.js (최신 버전)
- Ollama 설치 및 실행 (AI 기능 사용 시)

### 참고사항

- Canvas 모듈 경고는 무시 가능 (텍스트 추출에는 영향 없음)
- 폰트 경고는 무시 가능 (텍스트 추출에는 영향 없음)
- Ollama가 실행 중이 아니면 AI 기능만 비활성화됩니다
