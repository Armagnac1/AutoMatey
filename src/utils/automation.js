import { debugLog, errorLog } from './logger.js';
import { ActionType } from '../config/config.js';

// Execute automation actions
export async function executeActions(instructions, tabId) {
  debugLog('Executing automation actions', { instructions, tabId });
  
  if (!tabId) {
    throw new Error('No tab ID provided to executeActions');
  }
  
  try {
    // Handle display messages
    if (instructions.display) {
      chrome.runtime.sendMessage({
        type: 'showMessage',
        message: instructions.display.message,
        messageType: instructions.display.type
      });
    }

    // Handle data extraction results
    if (instructions.extract && instructions.extract.data.length > 0) {
      chrome.runtime.sendMessage({
        type: 'showExtractedData',
        data: instructions.extract.data,
        selector: instructions.extract.selector,
        attribute: instructions.extract.attribute
      });
    }

    // Handle other actions
    const actions = [
      { type: ActionType.CLICK, handler: handleClick },
      { type: ActionType.FILL, handler: handleFill },
      { type: ActionType.SELECT, handler: handleSelect },
      { type: ActionType.SCROLL, handler: handleScroll },
      { type: ActionType.WAIT, handler: handleWait }
    ];

    for (const action of actions) {
      if (instructions[action.type]) {
        await action.handler(instructions[action.type], tabId);
      }
    }

    return true;
  } catch (error) {
    errorLog('Error executing actions', error);
    throw error;
  }
}

// Action handlers
async function handleClick(selector, tabId) {
  return sendMessageToContentScript({
    type: ActionType.CLICK,
    selector
  }, tabId);
}

async function handleFill(fillData, tabId) {
  return sendMessageToContentScript({
    type: ActionType.FILL,
    selector: fillData.selector,
    value: fillData.value
  }, tabId);
}

async function handleSelect(selectData, tabId) {
  return sendMessageToContentScript({
    type: ActionType.SELECT,
    selector: selectData.selector,
    value: selectData.value
  }, tabId);
}

async function handleScroll(scrollData, tabId) {
  return sendMessageToContentScript({
    type: ActionType.SCROLL,
    selector: scrollData.selector,
    behavior: scrollData.behavior
  }, tabId);
}

async function handleWait(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

// Helper function to send messages to content script
async function sendMessageToContentScript(message, tabId) {
  try {
    debugLog('Sending message to content script:', { message, tabId });
    
    if (!tabId) {
      throw new Error('No tab ID available');
    }

    // First, ensure content script is injected
    try {
      // Inject the content script and wait for it to complete
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content.js']
      });
      debugLog('Content script injected successfully');
      
      // Wait for the content script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send a ping message to verify the content script is ready
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            debugLog('Ping failed, retrying injection:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          debugLog('Content script is ready:', response);
          resolve();
        });
      });
    } catch (error) {
      debugLog('Content script injection failed, retrying:', error);
      // Retry injection once
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content.js']
      });
      // Wait again after retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Now send the actual message
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          debugLog('Error sending message:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        if (!response || !response.success) {
          const error = response?.error || 'Unknown error';
          debugLog('Error in response:', error);
          reject(new Error(error));
          return;
        }
        debugLog('Message sent successfully:', response);
        resolve(response);
      });
    });
  } catch (error) {
    errorLog('Error sending message to content script:', error);
    throw error;
  }
} 