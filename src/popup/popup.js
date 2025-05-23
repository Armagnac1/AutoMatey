import { debugLog, errorLog } from '../utils/logger.js';
import { MessageType } from '../config/config.js';

// Handle settings button click
document.getElementById('settingsButton').addEventListener('click', () => {
  window.location.href = 'settings.html';
});

// Character counter functionality
const textarea = document.getElementById('userPrompt');
const charCounter = document.getElementById('charCount');
const MAX_CHARS = 500;

textarea.addEventListener('input', () => {
  const remaining = textarea.value.length;
  charCounter.textContent = remaining;
  
  if (remaining > MAX_CHARS) {
    textarea.value = textarea.value.substring(0, MAX_CHARS);
    charCounter.textContent = MAX_CHARS;
  }
  
  // Update counter color based on remaining characters
  if (remaining > MAX_CHARS * 0.9) {
    charCounter.style.color = '#f44336';
  } else if (remaining > MAX_CHARS * 0.7) {
    charCounter.style.color = '#ff9800';
  } else {
    charCounter.style.color = '#666';
  }
});

// Loading state management
function setLoading(isLoading) {
  const submitButton = document.querySelector('#automationForm button[type="submit"]');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const buttonText = submitButton.querySelector('span');
  
  if (isLoading) {
    submitButton.disabled = true;
    loadingSpinner.style.display = 'block';
    buttonText.textContent = 'Processing...';
  } else {
    submitButton.disabled = false;
    loadingSpinner.style.display = 'none';
    buttonText.textContent = 'Automate';
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Popup received message:', message);

  switch (message.type) {
    case 'showMessage':
      showMessage(message.message, message.messageType);
      break;
    case 'showExtractedData':
      showExtractedData(message.data);
      break;
    case 'automationComplete':
      setLoading(false);
      break;
    default:
      errorLog('Unknown message type:', message.type);
  }
});

function showMessage(message, type = MessageType.INFO) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type.toLowerCase()}`;
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
  
  // Auto-scroll to the new message
  messageElement.scrollIntoView({ behavior: 'smooth' });
  
  // Remove old messages if there are more than 5
  const messages = messagesDiv.getElementsByClassName('message');
  while (messages.length > 5) {
    messages[0].remove();
  }
}

function showExtractedData(data) {
  debugLog('Showing extracted data:', data);
  const dataDiv = document.getElementById('data');
  dataDiv.innerHTML = ''; // Clear previous data

  // Add header
  const header = document.createElement('h3');
  header.textContent = `Found ${data.length} items:`;
  dataDiv.appendChild(header);

  // Add data items
  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '10px 0';
  
  data.forEach((item, index) => {
    const listItem = document.createElement('li');
    listItem.style.padding = '8px';
    listItem.style.borderBottom = '1px solid #eee';
    listItem.style.display = 'flex';
    listItem.style.alignItems = 'center';
    
    // Add index
    const indexSpan = document.createElement('span');
    indexSpan.textContent = `${index + 1}. `;
    indexSpan.style.marginRight = '8px';
    indexSpan.style.color = '#666';
    listItem.appendChild(indexSpan);
    
    // Add item content
    const contentSpan = document.createElement('span');
    if (typeof item === 'object') {
      contentSpan.textContent = JSON.stringify(item);
    } else {
      contentSpan.textContent = item;
    }
    listItem.appendChild(contentSpan);
    
    list.appendChild(listItem);
  });
  
  dataDiv.appendChild(list);

  // Show success message
  showMessage(`Successfully extracted ${data.length} items`, MessageType.SUCCESS);
}

// Check if API key is set
async function checkApiKey() {
  try {
    const { provider, openaiKey, groqKey } = await chrome.storage.sync.get(['provider', 'openaiKey', 'groqKey']);
    
    if (!provider) {
      return false;
    }
    
    if (provider === 'openai' && !openaiKey) {
      return false;
    }
    
    if (provider === 'groq' && !groqKey) {
      return false;
    }
    
    return true;
  } catch (error) {
    errorLog('Error checking API key:', error);
    return false;
  }
}

// Handle form submission
document.getElementById('automationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userPrompt = document.getElementById('userPrompt').value.trim();
  if (!userPrompt) {
    showMessage('Please enter a prompt', 'error');
    return;
  }

  // Check for API key
  if (!await checkApiKey()) {
    showMessage('Please set your API key in settings', 'error');
    return;
  }

  try {
    setLoading(true);
    
    // Get the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    debugLog('Current tab:', tabs[0]);
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tabId = tabs[0].id;
    debugLog('Using tab ID:', tabId);

    // Get the page HTML
    const [{ result: websiteHTML }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    });

    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'getAutomationInstructions',
      userPrompt,
      websiteHTML,
      tabId // Pass the tab ID to the background script
    }, (response) => {
      if (chrome.runtime.lastError) {
        showMessage(chrome.runtime.lastError.message, 'error');
        setLoading(false);
        return;
      }
      
      if (!response || !response.success) {
        showMessage(response?.error || 'Failed to get automation instructions', 'error');
        setLoading(false);
        return;
      }
      
      showMessage('Automation instructions received', 'success');
    });
  } catch (error) {
    errorLog('Error in form submission:', error);
    showMessage(error.message, 'error');
    setLoading(false);
  }
}); 