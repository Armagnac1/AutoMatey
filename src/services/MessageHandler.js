import { debugLog, errorLog } from '../utils/logger.js';
import { executeActions } from '../utils/automation.js';
import { AIService } from './AIService.js';
import { SettingsService } from './SettingsService.js';

export class MessageHandler {
  constructor() {
    this.aiService = new AIService();
    this.settingsService = new SettingsService();
  }

  async handleMessage(request, sender, sendResponse) {
    debugLog('Message received', {
      type: request.type,
      sender: sender.url,
      tabId: request.tabId,
      requestData: request.type === "getAutomationInstructions" ? {
        userPromptLength: request.userPrompt.length,
        websiteHTMLLength: request.websiteHTML.length
      } : request
    });

    switch (request.type) {
      case "getAutomationInstructions":
        await this.handleAutomationInstructions(request, sendResponse);
        break;
      case "setApiKey":
        await this.handleSetApiKey(request, sendResponse);
        break;
      case "setProvider":
        await this.handleSetProvider(request, sendResponse);
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  async handleAutomationInstructions(request, sendResponse) {
    try {
      const instructions = await this.aiService.getInstructions(request.userPrompt, request.websiteHTML);
      debugLog('Sending successful response', { instructions });
      
      if (!request.tabId) {
        throw new Error('No tab ID provided');
      }
      
      debugLog('Using provided tab ID:', request.tabId);
      
      await executeActions(instructions, request.tabId);
      sendResponse({ success: true, instructions });
    } catch (error) {
      errorLog('Error processing automation request:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleSetApiKey(request, sendResponse) {
    try {
      await this.settingsService.setApiKey(request.apiKey);
      sendResponse({ success: true });
    } catch (error) {
      errorLog('Error saving API key:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleSetProvider(request, sendResponse) {
    try {
      await this.settingsService.setProvider(request.provider);
      sendResponse({ success: true });
    } catch (error) {
      errorLog('Error saving provider:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
} 