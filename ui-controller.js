/**
 * UI 컨트롤러 - 4단 탭과 오답노트/메모 클릭 시 본문 자동 이동
 */

class UIController {
  constructor(noteLinkingSystem) {
    this.noteSystem = noteLinkingSystem;
    this.currentTab = 'content';
    this.currentLocation = null;

    this.initializeTabs();
    this.initializeMistakeClickHandlers();
    this.initializeMemoClickHandlers();
  }

  /**
   * 4단 탭 초기화
   */
  initializeTabs() {
    const tabButtons = {
      'tab-content': 'content-tab',
      'tab-quiz': 'quiz-tab',
      'tab-mistakes': 'mistakes-tab',
      'tab-notes': 'notes-tab'
    };

    Object.keys(tabButtons).forEach(buttonId => {
      const button = document.getElementById(buttonId);
      const tabContentId = tabButtons[buttonId];

      button?.addEventListener('click', () => {
        this.switchTab(buttonId, tabContentId);
      });
    });
  }

  /**
   * 탭 전환
   */
  switchTab(buttonId, tabContentId) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // 모든 탭 콘텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    // 선택된 탭 활성화
    document.getElementById(buttonId)?.classList.add('active');
    const tabContent = document.getElementById(tabContentId);
    if (tabContent) {
      tabContent.classList.add('active');
      tabContent.style.display = 'block';
    }

    this.currentTab = tabContentId.replace('-tab', '');
  }

  /**
   * 오답 노트 클릭 핸들러 초기화
   */
  initializeMistakeClickHandlers() {
    const mistakesList = document.getElementById('mistakes-list');

    mistakesList?.addEventListener('click', async (e) => {
      const mistakeCard = e.target.closest('.mistake-card');
      if (!mistakeCard) return;

      const mistakeId = parseInt(mistakeCard.dataset.mistakeId);
      if (!mistakeId) return;

      // 본문 위치 찾기
      const sourceLocation = this.noteSystem.findSourceFromMistake(mistakeId);

      if (sourceLocation) {
        // 본문 탭으로 자동 전환
        this.switchTab('tab-content', 'content-tab');

        // 본문 표시
        await this.displayContentAtLocation(sourceLocation);

        // 좌측 인덱스 연동
        this.syncLeftIndex(sourceLocation);

        // 시각적 피드백
        this.highlightLocation(sourceLocation);
      } else {
        this.showNotification('본문 위치를 찾을 수 없습니다', 'warning');
      }
    });
  }

  /**
   * 학습 메모 클릭 핸들러 초기화
   */
  initializeMemoClickHandlers() {
    const notesList = document.getElementById('notes-list');

    notesList?.addEventListener('click', async (e) => {
      const noteCard = e.target.closest('.note-card');
      if (!noteCard) return;

      const historyId = parseInt(noteCard.dataset.historyId);
      if (!historyId) return;

      // 본문 위치 찾기
      const sourceLocation = this.noteSystem.findSourceFromMemo(historyId);

      if (sourceLocation) {
        // 본문 탭으로 자동 전환
        this.switchTab('tab-content', 'content-tab');

        // 본문 표시
        await this.displayContentAtLocation(sourceLocation);

        // 좌측 인덱스 연동
        this.syncLeftIndex(sourceLocation);

        // 시각적 피드백
        this.highlightLocation(sourceLocation);
      } else {
        this.showNotification('본문 위치를 찾을 수 없습니다', 'warning');
      }
    });
  }

  /**
   * 특정 위치의 본문 내용 표시
   */
  async displayContentAtLocation(location) {
    const { fileName, chapterId, pageNumber, offset, contextWords, confidence } = location;

    this.currentLocation = location;

    const contentDisplay = document.getElementById('selected-content-display');
    const locationInfo = document.getElementById('current-location-info');

    // 위치 정보 업데이트
    if (locationInfo) {
      locationInfo.textContent = `${fileName} - 챕터 ${chapterId} - 페이지 ${pageNumber}`;
    }

    // 본문 내용 로드
    try {
      // 챕터 데이터 가져오기
      const chapter = this.noteSystem.db.getChapter(fileName, chapterId);

      if (!chapter || !chapter.extractedText) {
        contentDisplay.innerHTML = `
          <div class="content-error">
            <p>본문 텍스트를 찾을 수 없습니다</p>
            <p class="content-location">파일: ${fileName}, 챕터: ${chapterId}, 페이지: ${pageNumber}</p>
          </div>
        `;
        return;
      }

      // 오프셋 기준으로 컨텍스트 추출 (전후 200자)
      const text = chapter.extractedText;
      const startIdx = Math.max(0, offset * 5 - 200); // 단어 오프셋을 대략적인 문자 위치로 변환
      const endIdx = Math.min(text.length, offset * 5 + 200);
      const contextText = text.substring(startIdx, endIdx);

      // 컨텍스트 단어 하이라이팅
      let highlightedText = contextText;
      if (contextWords && contextWords.length > 0) {
        contextWords.forEach(word => {
          const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
          highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
      }

      contentDisplay.innerHTML = `
        <div class="content-display-header">
          <div class="confidence-badge ${confidence === 'high' ? 'high' : 'low'}">
            ${confidence === 'high' ? '정확한 위치' : '근사 위치'}
          </div>
          <div class="content-meta">
            <span>📄 ${fileName}</span>
            <span>📚 챕터 ${chapterId}</span>
            <span>📖 페이지 ${pageNumber}</span>
          </div>
        </div>
        <div class="content-text">
          <p>${startIdx > 0 ? '...' : ''}${highlightedText}${endIdx < text.length ? '...' : ''}</p>
        </div>
        <div class="content-actions">
          <button id="view-full-chapter-btn" class="action-btn-small">전체 챕터 보기</button>
          <button id="copy-content-btn" class="action-btn-small">텍스트 복사</button>
        </div>
      `;

      // 버튼 이벤트 연결
      document.getElementById('view-full-chapter-btn')?.addEventListener('click', () => {
        this.viewFullChapter(fileName, chapterId);
      });

      document.getElementById('copy-content-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(contextText);
        this.showNotification('텍스트가 복사되었습니다', 'success');
      });

      // 네비게이션 버튼 활성화
      this.updateNavigationButtons();

    } catch (error) {
      console.error('본문 표시 오류:', error);
      contentDisplay.innerHTML = `
        <div class="content-error">
          <p>본문을 불러오는 중 오류가 발생했습니다</p>
          <p class="error-detail">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * 좌측 인덱스 연동 (챕터 강조)
   */
  syncLeftIndex(location) {
    const { fileName, chapterId } = location;

    // 모든 챕터 항목에서 active 클래스 제거
    document.querySelectorAll('.chapter-item').forEach(item => {
      item.classList.remove('active');
    });

    // 해당 챕터 강조
    const chapterItem = document.querySelector(
      `.chapter-item[data-file="${fileName}"][data-chapter="${chapterId}"]`
    );

    if (chapterItem) {
      chapterItem.classList.add('active');
      chapterItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * 위치 하이라이팅 (시각적 피드백)
   */
  highlightLocation(location) {
    const contentDisplay = document.getElementById('selected-content-display');

    // 애니메이션 효과
    contentDisplay?.classList.add('highlight-flash');
    setTimeout(() => {
      contentDisplay?.classList.remove('highlight-flash');
    }, 1000);
  }

  /**
   * 전체 챕터 보기
   */
  viewFullChapter(fileName, chapterId) {
    // 중앙 패널의 PDF 뷰어로 전환
    const chapter = this.noteSystem.db.getChapter(fileName, chapterId);

    if (chapter) {
      // PDF 뷰어 트리거 (기존 PDF 뷰어 로직 활용)
      window.electronAPI?.loadChapter({
        fileName,
        chapterId,
        startPage: chapter.startPage
      });
    }
  }

  /**
   * 네비게이션 버튼 업데이트
   */
  updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-section-btn');
    const nextBtn = document.getElementById('next-section-btn');

    if (this.currentLocation) {
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    }
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    // 간단한 토스트 알림
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * 정규식 이스케이프
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 오답 노트 통계 업데이트
   */
  updateMistakeStats() {
    const allMistakes = this.noteSystem.db.getMistakeNotes({});
    const unresolvedMistakes = this.noteSystem.db.getMistakeNotes({ isResolved: 0 });

    const totalCount = allMistakes.length;
    const unresolvedCount = unresolvedMistakes.length;
    const resolutionRate = totalCount > 0
      ? Math.round((totalCount - unresolvedCount) / totalCount * 100)
      : 0;

    document.getElementById('total-mistakes-count').textContent = totalCount;
    document.getElementById('unresolved-mistakes-count').textContent = unresolvedCount;
    document.getElementById('resolution-rate').textContent = `${resolutionRate}%`;
  }

  /**
   * 오답 노트 목록 렌더링
   */
  renderMistakesList(showOnlyUnresolved = false) {
    const filters = showOnlyUnresolved ? { isResolved: 0 } : {};
    const mistakes = this.noteSystem.getMistakeNotesWithLinks(filters);

    const mistakesList = document.getElementById('mistakes-list');

    if (mistakes.length === 0) {
      mistakesList.innerHTML = `
        <div class="empty-state-small">
          <p>오답 노트가 없습니다</p>
          <p>퀴즈를 풀면 자동으로 오답이 여기에 저장됩니다</p>
        </div>
      `;
      return;
    }

    mistakesList.innerHTML = mistakes.map(mistake => `
      <div class="mistake-card ${mistake.isResolved ? 'resolved' : ''}" data-mistake-id="${mistake.id}">
        <div class="mistake-header">
          <span class="mistake-date">${new Date(mistake.timestamp).toLocaleDateString('ko-KR')}</span>
          <span class="mistake-status">${mistake.isResolved ? '✅ 해결' : '❌ 미해결'}</span>
        </div>
        <div class="mistake-question">
          <strong>문제:</strong> ${mistake.question}
        </div>
        <div class="mistake-answers">
          <div class="user-answer">
            <span class="answer-label">내 답:</span>
            <span>${mistake.userAnswer || '-'}</span>
          </div>
          <div class="correct-answer">
            <span class="answer-label">정답:</span>
            <span>${mistake.reconstructedAnswer || '-'}</span>
          </div>
        </div>
        <div class="mistake-location">
          📍 ${mistake.fileName} - 페이지 ${mistake.pageNumber}
        </div>
        <button class="resolve-btn" data-mistake-id="${mistake.id}">
          ${mistake.isResolved ? '미해결로 표시' : '해결 완료'}
        </button>
      </div>
    `).join('');

    // 해결 버튼 이벤트
    mistakesList.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mistakeId = parseInt(btn.dataset.mistakeId);
        this.toggleMistakeResolution(mistakeId);
      });
    });

    this.updateMistakeStats();
  }

  /**
   * 오답 해결 상태 토글
   */
  toggleMistakeResolution(mistakeId) {
    // TODO: DB에 해결 상태 토글 로직 추가
    this.noteSystem.db.resolveMistakeNote(mistakeId);
    this.renderMistakesList();
    this.showNotification('상태가 변경되었습니다', 'success');
  }
}

module.exports = UIController;
