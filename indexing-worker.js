/**
 * Indexing Worker - Multi-processing worker for parallel text indexing
 * Processes text chunks in parallel using Node.js worker threads
 */

const { parentPort, workerData } = require('worker_threads');

/**
 * Tokenize text into words
 */
function tokenize(text) {
  const tokens = text.match(/[\u3131-\uD79D\uAC00-\uD7A3]+|[a-zA-Z]+|[0-9]+/g) || [];
  return tokens.map(t => t.toLowerCase());
}

/**
 * Process a chunk of text and return word tokens with positions
 */
function processTextChunk(text, meta, startOffset = 0) {
  const tokens = tokenize(text);
  const results = [];

  tokens.forEach((word, idx) => {
    results.push({
      word,
      position: {
        f: meta.fileName,
        c: meta.chapterId,
        p: meta.pageNumber,
        o: startOffset + idx
      }
    });
  });

  return results;
}

// Main worker execution
if (parentPort) {
  const { text, meta, startOffset } = workerData;

  try {
    const results = processTextChunk(text, meta, startOffset);
    parentPort.postMessage({ success: true, results });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
}

module.exports = { processTextChunk, tokenize };
