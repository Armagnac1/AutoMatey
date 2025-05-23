// Configuration settings
export const config = {
  apiKey: '', // To be set by user
  model: 'gpt-3.5-turbo',
  baseUrl: 'https://api.openai.com/v1/chat/completions',
  provider: 'groq', // Default provider
  debug: true, // Enable debug output
  maxRetries: 3,
  requestTimeout: 30000, // 30 seconds
  rateLimit: {
    requestsPerMinute: 60,
    lastRequestTime: 0,
    requestCount: 0
  }
};

// Message types for display
export const MessageType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

// Action types for automation
export const ActionType = {
  CLICK: 'click',
  FILL: 'fill',
  SELECT: 'select',
  WAIT: 'wait',
  SCROLL: 'scroll',
  DISPLAY: 'display',
  EXTRACT: 'extract'
};

// Provider types
export const ProviderType = {
  OPENAI: 'openai',
  GROQ: 'groq'
};

// Storage keys
export const StorageKey = {
  PROVIDER: 'provider',
  OPENAI_KEY: 'openaiKey',
  GROQ_KEY: 'groqKey',
  AUTOMATION_HISTORY: 'automationHistory'
}; 