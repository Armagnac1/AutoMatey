// Popup script for AI Website Automator
document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptInput');
  const runButton = document.getElementById('runAutomation');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsContent = document.getElementById('settingsContent');
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const statusDiv = document.getElementById('status');

  // Load API key from storage
  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Load previous automations from storage
  chrome.storage.local.get(['automationHistory'], (result) => {
    const history = result.automationHistory || [];
    if (history.length > 0) {
      promptInput.value = history[history.length - 1].prompt;
    }
  });

  // Toggle settings visibility
  settingsToggle.addEventListener('click', () => {
    settingsContent.classList.toggle('visible');
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'setApiKey',
        apiKey: apiKey
      });
      showStatus('API key saved successfully!', 'success');
    } catch (error) {
      showStatus('Failed to save API key', 'error');
    }
  });

  // Run automation
  runButton.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showStatus('Please enter a prompt', 'error');
      return;
    }

    showStatus('Running automation...', 'info');
    runButton.disabled = true;

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Save to history
      const timestamp = new Date().toISOString();
      chrome.storage.local.get(['automationHistory'], (result) => {
        const history = result.automationHistory || [];
        history.push({ prompt, timestamp, url: tab.url });
        chrome.storage.local.set({ automationHistory: history.slice(-10) }); // Keep last 10 items
      });

      // Send message to get website HTML
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "getPageContent"
      });

      // Get AI instructions
      const aiResponse = await chrome.runtime.sendMessage({
        type: "getAutomationInstructions",
        userPrompt: prompt,
        websiteHTML: response.html
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error);
      }

      // Execute automation
      const automationResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "performAutomation",
        instructions: aiResponse.instructions
      });

      if (!automationResponse.success) {
        throw new Error(automationResponse.error);
      }

      showStatus('Automation completed successfully!', 'success');
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      runButton.disabled = false;
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    if (type !== 'info') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 5000);
    }
  }
});