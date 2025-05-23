import { MessageHandler } from '../services/MessageHandler.js';
import { SettingsService } from '../services/SettingsService.js';
import { debugLog } from '../utils/logger.js';

// Initialize services
const settingsService = new SettingsService();
const messageHandler = new MessageHandler();

// Initialize settings on startup
settingsService.initialize().catch(error => {
  debugLog('Error initializing settings:', error);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  messageHandler.handleMessage(request, sender, sendResponse);
  return true; // Keep the message channel open for async response
}); 