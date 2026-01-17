# Getting Started with StudyPad AI

## Quick Start (5 minutes)

### 1. Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Ollama** (optional, for AI features) ([Download](https://ollama.ai/))

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/studypad-ai.git
cd studypad-ai

# Install dependencies
npm install
```

### 3. Configuration

```bash
# Create environment file
cp .env.example .env

# Edit .env with your settings (optional)
# Default values work for most users
```

### 4. Run

```bash
npm start
```

That's it! StudyPad AI should now be running.

---

## Detailed Setup

### Environment Variables

Open `.env` and configure:

```bash
# Ollama Configuration (local AI)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2

# Database (default is fine)
DB_PATH=./studypad.db

# Application Settings
APP_LOG_LEVEL=info
APP_MAX_FILE_SIZE=100MB
```

### Ollama Setup (Optional)

For AI features, install Ollama:

1. Download from [ollama.ai](https://ollama.ai/)
2. Install and run: `ollama serve`
3. Pull a model: `ollama pull llama2`

Without Ollama, the app still works for PDF viewing, notes, and quizzes.

---

## First Use

### 1. Upload a PDF

Click **"+ PDF 업로드"** button and select your textbook.

### 2. Select Chapter

After upload, choose a chapter to focus on.

### 3. Ask Questions

Use the AI chat panel to ask questions about the content.

### 4. Take Quiz

Switch to **[문제 풀이]** tab and generate a quiz.

### 5. Review Mistakes

Wrong answers automatically go to **[오답 노트]** tab.

### 6. Navigate to Source

Click any mistake card to jump to the exact location in the textbook.

---

## Testing

### Test Indexing System

```bash
npm run test:indexing
```

Expected output:
```
✓ Word Dictionary: 32% storage reduction
✓ Inverted Index: O(1) search performance
✓ Note Linking: Source location accuracy
✓ Duplicate Elimination: 99% for repeated words
```

### Run All Tests

```bash
npm test
```

---

## Troubleshooting

### "Cannot find module 'dotenv'"

```bash
npm install
```

### "Ollama connection failed"

Either:
1. Install Ollama and run `ollama serve`
2. Or just use the app without AI features

### "Permission denied" on database

```bash
chmod 755 .
rm -f studypad.db
npm start
```

### Database is locked

Close all instances of the app and restart.

---

## Usage Tips

### 1. Zero-Duplication Magic

The more you use StudyPad AI, the more efficient it becomes:
- First PDF: ~10 MB → 5 MB (50% reduction)
- After 10 PDFs: ~100 MB → 30 MB (70% reduction)

Common words like "energy", "physics" stored only once!

### 2. Smart Mistakes

Don't just mark mistakes as "resolved". Click them!
- Auto-navigates to source location
- Highlights relevant context
- Shows related content

### 3. Exam Prep Mode

Before exam:
1. Go to **[오답 노트]** tab
2. Click **"미해결만 보기"**
3. Review each mistake by clicking
4. Mark as resolved when mastered

### 4. Keyboard Shortcuts

- `Ctrl/Cmd + O` - Open PDF
- `Ctrl/Cmd + F` - Search (coming soon)
- `Ctrl/Cmd + N` - New note
- `Enter` - Send chat message

---

## Data Location

All data stored locally:

```
~/Library/Application Support/StudyPad AI/  (macOS)
%APPDATA%/StudyPad AI/                       (Windows)
~/.config/StudyPad AI/                       (Linux)
```

Files:
- `studypad.db` - SQLite database
- `word-dictionary.toon` - Word index
- `inverted-index.toon` - Location index

**Privacy**: Nothing leaves your computer unless you enable cloud sync.

---

## Development Mode

### Enable DevTools

Edit `main.js`:
```javascript
mainWindow.webContents.openDevTools();
```

### Watch Mode

```bash
npm run dev
```

### Debug Indexing

```bash
node test-indexing-system.js
```

---

## Building for Distribution

```bash
# Build for current platform
npm run build

# Find output in:
dist/
```

---

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Check [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for codebase layout
3. Review [SECURITY.md](./SECURITY.md) for security practices

---

## Getting Help

- Check existing issues in repository
- Review troubleshooting section above
- Contact maintainer for private repository access

---

## Feature Highlights

### 🎯 Zero-Duplication Indexing
Your textbooks take 60-70% less space than traditional apps.

### 📊 TOON Format
Custom data format that's 32% smaller than JSON.

### 🔗 Smart Linking
Click mistake → Jump to exact page and highlight context.

### 🤖 AI Assistant
Ask questions about your textbooks (with Ollama).

### 🔒 Privacy First
Everything stored locally. No telemetry. No tracking.

---

**Welcome to StudyPad AI!** Let's make learning efficient. 🚀
