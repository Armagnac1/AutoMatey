import { StorageKey } from '../config/config.js';
import { debugLog } from './logger.js';

// Load settings from storage
export async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([StorageKey.PROVIDER, StorageKey.OPENAI_KEY, StorageKey.GROQ_KEY], (result) => {
      if (chrome.runtime.lastError) {
        debugLog('Error loading settings:', chrome.runtime.lastError);
        resolve({});
        return;
      }
      debugLog('Settings loaded:', result);
      resolve(result);
    });
  });
}

// Save settings to storage
export async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        debugLog('Error saving settings:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      debugLog('Settings saved:', settings);
      resolve();
    });
  });
}

// Load automation history
export async function loadAutomationHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get([StorageKey.AUTOMATION_HISTORY], (result) => {
      resolve(result.automationHistory || []);
    });
  });
}

// Save automation to history
export async function saveToHistory(automation) {
  const history = await loadAutomationHistory();
  history.push({
    ...automation,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 10 items
  const trimmedHistory = history.slice(-10);
  
  return saveSettings({ [StorageKey.AUTOMATION_HISTORY]: trimmedHistory });
} 