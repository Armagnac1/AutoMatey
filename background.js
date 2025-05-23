// Configuration
const config = {
  apiKey: '', // To be set by user
  model: 'gpt-3.5-turbo',
  baseUrl: 'https://api.openai.com/v1/chat/completions'
};

// Store API key securely
chrome.storage.local.get(['apiKey'], (result) => {
  if (result.apiKey) {
    config.apiKey = result.apiKey;
  }
});

async function getAIInstructions(userPrompt, websiteHTML) {
  if (!config.apiKey) {
    throw new Error('Please set your OpenAI API key in the extension settings');
  }

  try {
    // Create a system message that explains the task
    const systemMessage = `You are a website automation assistant. Based on the user's request and the website HTML, 
    provide specific instructions for automating actions on the webpage. Return ONLY a JSON object with these possible keys:
    - click: CSS selector for elements to click
    - fill: Object with CSS selectors as keys and values to fill
    - select: Object with selector and value for dropdowns
    - wait: Number of milliseconds to wait
    - scroll: String (CSS selector) or Object (with top/left coordinates)
    Example: {"click": "#submit-button", "fill": {"#email": "user@example.com"}}`;

    // Clean and truncate HTML to fit token limits
    const cleanHTML = websiteHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .substring(0, 4000); // Limit HTML length

    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `Website HTML: ${cleanHTML}\n\nUser Request: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'AI API request failed');
    }

    const data = await response.json();
    const instructions = JSON.parse(data.choices[0].message.content);
    
    // Validate instructions format
    validateInstructions(instructions);
    
    return instructions;
  } catch (error) {
    console.error('AI API Error:', error);
    throw new Error(`Failed to get AI instructions: ${error.message}`);
  }
}

function validateInstructions(instructions) {
  const validKeys = ['click', 'fill', 'select', 'wait', 'scroll'];
  const invalidKeys = Object.keys(instructions).filter(key => !validKeys.includes(key));
  
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid instruction keys: ${invalidKeys.join(', ')}`);
  }

  if (instructions.wait && typeof instructions.wait !== 'number') {
    throw new Error('Wait duration must be a number');
  }

  if (instructions.fill && typeof instructions.fill !== 'object') {
    throw new Error('Fill instructions must be an object');
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getAutomationInstructions") {
    (async () => {
      try {
        const instructions = await getAIInstructions(
          request.userPrompt,
          request.websiteHTML
        );
        sendResponse({ success: true, instructions });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Required for async response
  }

  if (request.type === "setApiKey") {
    chrome.storage.local.set({ apiKey: request.apiKey }, () => {
      config.apiKey = request.apiKey;
      sendResponse({ success: true });
    });
    return true;
  }
});