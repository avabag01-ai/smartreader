/**
 * Configuration Module
 * Loads environment variables and provides secure configuration
 */

require('dotenv').config();

/**
 * Generate random secret for development
 * In production, this MUST be set in .env
 */
function generateRandomSecret() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    console.warn('⚠️  Using generated session secret. Set SESSION_SECRET in .env for production!');
    return require('crypto').randomBytes(32).toString('hex');
  }
  throw new Error('SESSION_SECRET must be set in .env for production');
}

const config = {
  // AI Configuration
  ai: {
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama2',
    // If using external AI service (future expansion)
    apiKey: process.env.AI_API_KEY || null,
    apiEndpoint: process.env.AI_API_ENDPOINT || null
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || './studypad.db'
  },

  // Application Settings
  app: {
    logLevel: process.env.APP_LOG_LEVEL || 'info',
    maxFileSize: process.env.APP_MAX_FILE_SIZE || '100MB',
    isDevelopment: process.env.NODE_ENV === 'development'
  },

  // Security
  security: {
    sessionSecret: process.env.SESSION_SECRET || generateRandomSecret(),
    enableEncryption: process.env.ENABLE_ENCRYPTION === 'true'
  },

  // Feature Flags
  features: {
    cloudSync: process.env.ENABLE_CLOUD_SYNC === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    experimentalFeatures: process.env.ENABLE_EXPERIMENTAL === 'true'
  }
};

/**
 * Validate required configuration
 */
function validateConfig() {
  const errors = [];

  // Check if sensitive values are not using defaults in production
  if (!config.app.isDevelopment) {
    if (!process.env.SESSION_SECRET) {
      errors.push('SESSION_SECRET must be set in production');
    }
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Invalid configuration');
  }
}

// Validate on load
validateConfig();

module.exports = config;
