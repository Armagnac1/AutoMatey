import { debugLog, errorLog } from '../utils/logger.js';

// Function to show the appropriate API key input
function showApiKeyInput(provider) {
  // Hide all API key inputs
  document.querySelectorAll('.api-key-input').forEach(input => {
    input.classList.remove('active');
  });
  
  // Show the selected provider's input
  document.getElementById(`${provider}KeyInput`).classList.add('active');
}

// Load saved settings when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await chrome.storage.sync.get(['provider', 'openaiKey', 'groqKey']);
    
    // Set provider
    if (result.provider) {
      document.getElementById('provider').value = result.provider;
      showApiKeyInput(result.provider);
    } else {
      // Default to OpenAI if no provider is set
      showApiKeyInput('openai');
    }
    
    // Set API keys
    if (result.openaiKey) {
      document.getElementById('openaiKey').value = result.openaiKey;
    }
    if (result.groqKey) {
      document.getElementById('groqKey').value = result.groqKey;
    }
  } catch (error) {
    errorLog('Error loading settings:', error);
    showMessage('Error loading settings', 'error');
  }
});

// Handle provider change
document.getElementById('provider').addEventListener('change', (event) => {
  showApiKeyInput(event.target.value);
});

// Handle form submission
document.getElementById('settingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const provider = document.getElementById('provider').value;
  const openaiKey = document.getElementById('openaiKey').value.trim();
  const groqKey = document.getElementById('groqKey').value.trim();
  
  // Validate that the selected provider has an API key
  if (provider === 'openai' && !openaiKey) {
    showMessage('Please enter your OpenAI API key', 'error');
    return;
  }
  if (provider === 'groq' && !groqKey) {
    showMessage('Please enter your Groq API key', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({
      provider,
      openaiKey,
      groqKey
    });
    showMessage('Settings saved successfully', 'success');
  } catch (error) {
    errorLog('Error saving settings:', error);
    showMessage('Error saving settings', 'error');
  }
});

// Handle back button
document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'popup.html';
});

function showMessage(message, type) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = message;
  messageElement.className = `message ${type}`;
  messageElement.style.display = 'block';
  
  // Hide message after 3 seconds
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
} 