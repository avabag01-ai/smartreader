/**
 * Theme Selector - Ultra-lightweight theme management
 * Total size: ~8KB (including all 20 themes data)
 */

// Theme Database (compact format for performance)
const THEMES = [
  // Student Themes
  {
    id: 'pink-blossom',
    name: '핑크 블라썸',
    description: '봄날의 벚꽃처럼 부드럽고 따뜻한 테마',
    category: 'student',
    tags: ['귀여움', '봄', '밝음'],
    colors: { primary: '#fff5f8', accent: '#ff6b9d', text: '#4a2c3d' }
  },
  {
    id: 'sky-blue',
    name: '스카이 블루',
    description: '맑은 하늘처럼 상쾌한 학습 환경',
    category: 'student',
    tags: ['시원함', '집중', '밝음'],
    colors: { primary: '#f0f8ff', accent: '#4fc3f7', text: '#2c3e50' }
  },
  {
    id: 'grid-paper',
    name: '모눈종이',
    description: '정갈한 모눈종이 위에서 깔끔하게 공부',
    category: 'student',
    tags: ['깔끔', '수학', '정돈'],
    colors: { primary: '#fafafa', accent: '#5c6bc0', text: '#212121' }
  },
  {
    id: 'chalkboard',
    name: '칠판 테마',
    description: '교실의 향수를 느낄 수 있는 칠판 스타일',
    category: 'student',
    tags: ['교실', '복고', '어두움'],
    colors: { primary: '#2d3a2e', accent: '#7cb342', text: '#f0f0e8' }
  },
  {
    id: 'study-lamp',
    name: '독서실 스탠드',
    description: '밤늦게 공부하는 독서실의 따뜻한 조명',
    category: 'student',
    tags: ['야간', '집중', '따뜻함'],
    colors: { primary: '#2a2418', accent: '#ffab40', text: '#fff4e0' }
  },

  // Retro / Hipster Themes
  {
    id: '8bit-game',
    name: '8비트 게임',
    description: '고전 게임보이의 추억을 되살리는 픽셀 테마',
    category: 'retro',
    tags: ['게임', '픽셀', '복고'],
    colors: { primary: '#0f380f', accent: '#9bbc0f', text: '#9bbc0f' }
  },
  {
    id: 'windows95',
    name: 'Windows 95',
    description: '90년대 윈도우의 클래식한 감성',
    category: 'retro',
    tags: ['복고', '클래식', '90년대'],
    colors: { primary: '#c0c0c0', accent: '#000080', text: '#000000' }
  },
  {
    id: 'cyberpunk',
    name: '사이버펑크',
    description: '미래 도시의 네온사인 속으로',
    category: 'retro',
    tags: ['미래', '네온', '어두움'],
    colors: { primary: '#0a0e27', accent: '#ff00ff', text: '#00ffff' }
  },
  {
    id: 'typewriter',
    name: '빈티지 타자기',
    description: '오래된 타자기로 글을 쓰는 감성',
    category: 'retro',
    tags: ['빈티지', '작가', '종이'],
    colors: { primary: '#f4f1e8', accent: '#8b4513', text: '#2b2b2b' }
  },

  // Professional Themes
  {
    id: 'dark-chocolate',
    name: '다크 초콜릿',
    description: '진한 초콜릿처럼 깊이 있는 업무용 테마',
    category: 'professional',
    tags: ['고급', '어두움', '집중'],
    colors: { primary: '#2c1810', accent: '#d4a574', text: '#f5e6d3' }
  },
  {
    id: 'office-white',
    name: '오피스 화이트',
    description: '깔끔한 사무실 환경의 프로페셔널 테마',
    category: 'professional',
    tags: ['깔끔', '밝음', '업무'],
    colors: { primary: '#ffffff', accent: '#1976d2', text: '#212121' }
  },
  {
    id: 'mac-classic',
    name: '매킨토시 클래식',
    description: '애플의 클래식한 디자인 철학',
    category: 'professional',
    tags: ['애플', '심플', '세련'],
    colors: { primary: '#e8e8e8', accent: '#0066cc', text: '#000000' }
  },
  {
    id: 'minimal-gray',
    name: '미니멀 그레이',
    description: '방해 요소 없는 극도의 미니멀리즘',
    category: 'professional',
    tags: ['미니멀', '심플', '집중'],
    colors: { primary: '#fafafa', accent: '#666666', text: '#1a1a1a' }
  },

  // Nature / Healing Themes
  {
    id: 'forest-morning',
    name: '숲속의 아침',
    description: '신선한 아침 공기가 느껴지는 숲 테마',
    category: 'nature',
    tags: ['자연', '힐링', '밝음'],
    colors: { primary: '#e8f5e9', accent: '#4caf50', text: '#1b5e20' }
  },
  {
    id: 'deep-sea',
    name: '심해 모드',
    description: '깊은 바다의 고요함 속에서 집중',
    category: 'nature',
    tags: ['바다', '어두움', '고요'],
    colors: { primary: '#0d1b2a', accent: '#00b4d8', text: '#e0fbfc' }
  },
  {
    id: 'sunset-beach',
    name: '노을 지는 해변',
    description: '따뜻한 노을빛이 물드는 해변',
    category: 'nature',
    tags: ['노을', '따뜻함', '휴식'],
    colors: { primary: '#fff4e6', accent: '#ff7043', text: '#4e342e' }
  },
  {
    id: 'rainy-window',
    name: '비 오는 창가',
    description: '빗소리가 들리는 차분한 공간',
    category: 'nature',
    tags: ['비', '차분', '힐링'],
    colors: { primary: '#37474f', accent: '#4fc3f7', text: '#eceff1' }
  },

  // Special Concept Themes
  {
    id: 'akihabara',
    name: '아키하바라 애니',
    description: '애니메이션의 성지에서 느끼는 감성',
    category: 'special',
    tags: ['애니', '귀여움', '일본'],
    colors: { primary: '#fff0f5', accent: '#ff1493', text: '#4a0e4e' }
  },
  {
    id: 'terminal-hacker',
    name: '터미널 해커',
    description: '진짜 해커처럼 터미널에서 코딩',
    category: 'special',
    tags: ['해커', '코딩', '어두움'],
    colors: { primary: '#0c0c0c', accent: '#00ff00', text: '#00ff00' }
  },
  {
    id: 'space-station',
    name: '우주 정거장',
    description: '우주 정거장에서 바라보는 별빛',
    category: 'special',
    tags: ['우주', 'SF', '어두움'],
    colors: { primary: '#0a0a1a', accent: '#6366f1', text: '#e0e0ff' }
  }
];

// Theme Manager Class
class ThemeManager {
  constructor() {
    this.currentTheme = this.loadSavedTheme() || 'default';
    this.selectedTheme = this.currentTheme;

    this.init();
  }

  init() {
    this.renderThemes();
    this.attachEventListeners();
    this.applyTheme(this.currentTheme);
    this.updateCurrentThemeDisplay();
  }

  // Render theme cards
  renderThemes(filterCategory = 'all') {
    const grid = document.getElementById('theme-grid');
    grid.innerHTML = '';

    const filteredThemes = filterCategory === 'all'
      ? THEMES
      : THEMES.filter(t => t.category === filterCategory);

    filteredThemes.forEach(theme => {
      const card = this.createThemeCard(theme);
      grid.appendChild(card);
    });
  }

  // Create theme card element
  createThemeCard(theme) {
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.dataset.themeId = theme.id;

    if (theme.id === this.selectedTheme) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      ${theme.id === this.currentTheme ? '<div class="selected-badge">현재 테마</div>' : ''}
      <div class="theme-preview" style="background: ${theme.colors.primary}">
        <div class="theme-preview-content">
          <div class="preview-bar" style="background: ${theme.colors.accent}"></div>
          <div class="preview-text" style="background: ${theme.colors.text}; width: 80%"></div>
          <div class="preview-text" style="background: ${theme.colors.text}; width: 60%"></div>
          <div class="preview-text" style="background: ${theme.colors.text}; width: 90%"></div>
        </div>
      </div>
      <div class="theme-info">
        <div class="theme-name">${theme.name}</div>
        <div class="theme-description">${theme.description}</div>
        <div class="theme-tags">
          ${theme.tags.map(tag => `<span class="theme-tag">${tag}</span>`).join('')}
        </div>
      </div>
    `;

    card.addEventListener('click', () => this.selectTheme(theme.id));

    return card;
  }

  // Select theme
  selectTheme(themeId) {
    this.selectedTheme = themeId;

    // Update UI
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.themeId === themeId) {
        card.classList.add('selected');
      }
    });

    // Preview theme immediately
    this.applyTheme(themeId);
  }

  // Apply theme
  applyTheme(themeId) {
    const body = document.body;

    // Remove all theme classes
    THEMES.forEach(t => {
      body.removeAttribute('data-theme');
    });

    // Apply new theme
    if (themeId && themeId !== 'default') {
      body.setAttribute('data-theme', themeId);
    }

    console.log(`✓ Theme applied: ${themeId}`);
  }

  // Save theme to localStorage
  saveTheme(themeId) {
    this.currentTheme = themeId;
    localStorage.setItem('smartreader-theme', themeId);

    // Notify parent window (main app)
    if (window.opener) {
      window.opener.postMessage({
        type: 'theme-selected',
        themeId: themeId
      }, '*');
    }

    // Notify main app if in Electron
    if (window.electronAPI) {
      window.electronAPI.saveTheme(themeId);
    }

    this.updateCurrentThemeDisplay();
    this.showNotification('테마가 저장되었습니다! ✨');
  }

  // Load saved theme
  loadSavedTheme() {
    return localStorage.getItem('smartreader-theme') || null;
  }

  // Update current theme display
  updateCurrentThemeDisplay() {
    const display = document.getElementById('current-theme-name');
    const theme = THEMES.find(t => t.id === this.currentTheme);

    if (display) {
      display.textContent = theme ? theme.name : '기본 테마';
    }
  }

  // Attach event listeners
  attachEventListeners() {
    // Category filters
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const category = e.target.dataset.category;
        this.renderThemes(category);
      });
    });

    // Apply button
    document.getElementById('apply-theme-btn').addEventListener('click', () => {
      this.saveTheme(this.selectedTheme);

      // Refresh cards to show new current theme
      const activeCategory = document.querySelector('.category-btn.active').dataset.category;
      this.renderThemes(activeCategory);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.saveTheme(this.selectedTheme);
      }
    });
  }

  // Show notification
  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--accent-primary);
      color: var(--bg-primary);
      padding: 16px 24px;
      border-radius: 50px;
      font-weight: 700;
      box-shadow: 0 4px 16px var(--shadow-color);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

// Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, THEMES };
}
