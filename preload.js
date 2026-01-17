const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  getAIResponse: (data) => ipcRenderer.invoke('get-ai-response', data),
  generateQuiz: (filters) => ipcRenderer.invoke('generate-quiz', filters),
  gradeQuiz: (data) => ipcRenderer.invoke('grade-quiz', data),
  getMistakeNotes: (filters) => ipcRenderer.invoke('get-mistake-notes', filters),
  resolveMistakeNote: (noteId) => ipcRenderer.invoke('resolve-mistake-note', noteId),
  getStatistics: (fileName) => ipcRenderer.invoke('get-statistics', fileName),
  getChapters: (fileName) => ipcRenderer.invoke('get-chapters', fileName),
  getChapter: (fileName, chapterNumber) => ipcRenderer.invoke('get-chapter', fileName, chapterNumber)
});
