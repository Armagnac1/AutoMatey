import { config } from '../config/config.js';
import { debugLog } from '../utils/logger.js';
import { loadSettings, saveSettings } from '../utils/storage.js';

export class SettingsService {
  constructor() {
    this.config = config;
  }

  async initialize() {
    const settings = await loadSettings();
    if (settings.provider) {
      this.config.provider = settings.provider;
      debugLog('Provider loaded from storage:', this.config.provider);
    }
    if (settings.openaiKey && this.config.provider === 'openai') {
      this.config.apiKey = settings.openaiKey;
      debugLog('OpenAI API key loaded from storage');
    }
    if (settings.groqKey && this.config.provider === 'groq') {
      this.config.apiKey = settings.groqKey;
      debugLog('Groq API key loaded from storage');
    }
  }

  async setApiKey(apiKey) {
    await saveSettings({ apiKey });
    this.config.apiKey = apiKey;
    debugLog('API key set successfully');
  }

  async setProvider(provider) {
    await saveSettings({ provider });
    this.config.provider = provider;
    debugLog('Provider set successfully');
  }

  getConfig() {
    return this.config;
  }
} 