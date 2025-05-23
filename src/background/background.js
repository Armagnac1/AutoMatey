import { config } from '../config/config.js';
import { debugLog, errorLog } from '../utils/logger.js';
import { loadSettings, saveSettings } from '../utils/storage.js';
import { executeActions } from '../utils/automation.js';
import { StorageKey } from '../config/config.js';

// Helper function to make API requests
async function makeAPIRequest(url, headers, body) {
  debugLog('Making API request', { url, headers: { ...headers, Authorization: 'Bearer ***' } });
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error?.message || `API request failed with status ${response.status}`);
  }

  return response.json();
}

// Helper function to parse AI response
function parseAIResponse(content) {
  try {
    // Remove markdown code block markers if present
    let jsonContent = content;
    if (content.includes('```')) {
      // Extract content between code block markers
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonContent = match[1].trim();
      }
    }
    
    // Try to parse the content as JSON
    const instructions = JSON.parse(jsonContent);
    
    // Validate the instructions structure
    validateInstructions(instructions);
    
    return instructions;
  } catch (error) {
    errorLog('Failed to parse AI response:', error);
    throw new Error('Invalid response format from AI');
  }
}

// Helper function to validate instructions
function validateInstructions(instructions) {
  if (!instructions || typeof instructions !== 'object') {
    throw new Error('Invalid instructions format');
  }

  // Check for error message
  if (instructions.error) {
    throw new Error(instructions.error);
  }

  // Validate each action type if present
  if (instructions.click && typeof instructions.click !== 'string') {
    throw new Error('Invalid click selector');
  }

  if (instructions.fill) {
    if (typeof instructions.fill !== 'object' || 
        typeof instructions.fill.selector !== 'string' || 
        typeof instructions.fill.value !== 'string') {
      throw new Error('Invalid fill action format');
    }
  }

  if (instructions.select) {
    if (typeof instructions.select !== 'object' || 
        typeof instructions.select.selector !== 'string' || 
        typeof instructions.select.value !== 'string') {
      throw new Error('Invalid select action format');
    }
  }

  if (instructions.wait && typeof instructions.wait !== 'number') {
    throw new Error('Invalid wait duration');
  }

  if (instructions.scroll) {
    if (typeof instructions.scroll !== 'object' || 
        typeof instructions.scroll.selector !== 'string' || 
        !['smooth', 'auto'].includes(instructions.scroll.behavior)) {
      throw new Error('Invalid scroll action format');
    }
  }

  if (instructions.display) {
    if (typeof instructions.display !== 'object' || 
        typeof instructions.display.message !== 'string' || 
        !['info', 'warning', 'error', 'success'].includes(instructions.display.type)) {
      throw new Error('Invalid display action format');
    }
  }

  if (instructions.extract) {
    if (typeof instructions.extract !== 'object' || 
        typeof instructions.extract.selector !== 'string' || 
        !Array.isArray(instructions.extract.data)) {
      throw new Error('Invalid extract action format');
    }
  }
}

// Helper function to clean and prepare HTML
function cleanHTML(html) {
  try {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove script tags
    const scripts = tempDiv.getElementsByTagName('script');
    while (scripts.length > 0) {
      scripts[0].parentNode.removeChild(scripts[0]);
    }

    // Remove style tags
    const styles = tempDiv.getElementsByTagName('style');
    while (styles.length > 0) {
      styles[0].parentNode.removeChild(styles[0]);
    }

    // Remove comments
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    const comments = [];
    let node;
    while (node = walker.nextNode()) {
      comments.push(node);
    }
    comments.forEach(comment => comment.parentNode.removeChild(comment));

    // Get the cleaned HTML
    const cleanedHTML = tempDiv.innerHTML;

    // Truncate if too long (to avoid token limits)
    const maxLength = 10000; // Adjust this value based on your needs
    if (cleanedHTML.length > maxLength) {
      return cleanedHTML.substring(0, maxLength) + '...';
    }

    return cleanedHTML;
  } catch (error) {
    errorLog('Error cleaning HTML:', error);
    // If cleaning fails, return a truncated version of the original HTML
    return html.substring(0, 10000) + '...';
  }
}

// Load settings on startup
loadSettings().then(settings => {
  if (settings.provider) {
    config.provider = settings.provider;
    debugLog('Provider loaded from storage:', config.provider);
  }
  if (settings.openaiKey && config.provider === 'openai') {
    config.apiKey = settings.openaiKey;
    debugLog('OpenAI API key loaded from storage');
  }
  if (settings.groqKey && config.provider === 'groq') {
    config.apiKey = settings.groqKey;
    debugLog('Groq API key loaded from storage');
  }
});

async function getAIInstructions(userPrompt, websiteHTML) {
  debugLog('getAIInstructions called', { userPromptLength: userPrompt.length, websiteHTMLLength: websiteHTML.length });
  
  // Load latest settings to ensure we have the most up-to-date API key
  const settings = await loadSettings();
  if (!settings.provider) {
    throw new Error('Please select an AI provider in the extension settings');
  }
  if (settings.provider === 'openai' && !settings.openaiKey) {
    throw new Error('Please set your OpenAI API key in the extension settings');
  }
  if (settings.provider === 'groq' && !settings.groqKey) {
    throw new Error('Please set your Groq API key in the extension settings');
  }

  try {
    const systemMessage = `You are a website automation assistant that helps users automate tasks on websites. Your role is to analyze the provided HTML and user request, then generate precise automation instructions.

Key responsibilities:
1. Analyze the website's HTML structure to identify relevant elements
2. Generate clear, specific automation instructions
3. Ensure instructions are valid and executable
4. Handle edge cases and potential errors
5. Extract and return requested data when needed

IMPORTANT: When extracting data, you MUST analyze the provided HTML and include the actual extracted data in the response. Do not return an empty data array.

Your response must be a valid JSON object with the following structure:
{
  "click": "CSS selector for element to click",
  "fill": {
    "selector": "CSS selector for input field",
    "value": "text to enter"
  },
  "select": {
    "selector": "CSS selector for dropdown",
    "value": "option value to select"
  },
  "wait": number of milliseconds to wait,
  "scroll": {
    "selector": "CSS selector to scroll to",
    "behavior": "smooth" or "auto"
  },
  "display": {
    "message": "Message to show to the user",
    "type": "info" or "warning" or "error" or "success"
  },
  "extract": {
    "selector": "CSS selector for elements to extract",
    "attribute": "attribute to extract (optional, e.g., 'href', 'textContent')",
    "multiple": boolean indicating if multiple elements should be extracted,
    "data": [] // MUST contain the actual extracted data
  }
}

Guidelines:
- Use specific, reliable CSS selectors (prefer IDs, data attributes, or unique class combinations)
- Include appropriate wait times between actions
- Handle dynamic content and loading states
- Consider mobile responsiveness
- Validate all selectors exist in the provided HTML
- Return only the JSON object, no additional text or explanation
- Use display messages to inform users about automation progress or issues

For data extraction tasks:
1. ALWAYS analyze the provided HTML to find the requested elements
2. ALWAYS populate the data array with the actual extracted information
3. Use appropriate selectors to target the desired elements
4. Specify whether to extract single or multiple elements
5. Include the attribute to extract if needed
6. Return the data in a structured format

Example for extracting link names:
{
  "extract": {
    "selector": "a",
    "attribute": "textContent",
    "multiple": true,
    "data": ["Home", "About", "Contact", "Products", "Services"] // MUST include actual extracted data
  },
  "display": {
    "message": "Successfully extracted 5 link names",
    "type": "success"
  }
}

If you cannot find a suitable selector or the request cannot be automated, return an error message in the format:
{
  "error": "Detailed error message explaining why automation is not possible"
}`;

    debugLog('System message prepared');

    const cleanedHTML = cleanHTML(websiteHTML);
    debugLog('HTML cleaned and truncated', { 
      originalLength: websiteHTML.length,
      cleanedLength: cleanedHTML.length,
      sample: cleanedHTML.substring(0, 100) + '...' 
    });

    let baseUrl, headers, body;
    
    if (config.provider === 'groq') {
      debugLog('Using Groq provider configuration');
      baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.groqKey}`
      };
      body = {
        model: 'gemma2-9b-it',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `Website HTML: ${cleanedHTML}\n\nUser Request: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      };
    } else {
      debugLog('Using OpenAI provider configuration');
      baseUrl = config.baseUrl;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiKey}`
      };
      body = {
        model: config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `Website HTML: ${cleanedHTML}\n\nUser Request: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      };
    }

    debugLog('API request prepared', {
      baseUrl,
      headers: { ...headers, Authorization: 'Bearer ***' },
      body: { ...body, messages: body.messages.map(m => ({ ...m, content: m.content.substring(0, 50) + '...' })) }
    });

    const startTime = Date.now();
    const data = await makeAPIRequest(baseUrl, headers, body);
    const requestDuration = Date.now() - startTime;
    
    debugLog(`API request completed in ${requestDuration}ms`, {
      status: 'success',
      responseId: data.id,
      model: data.model,
      usage: data.usage,
      finishReason: data.choices[0].finish_reason
    });

    debugLog('Raw message content:', data.choices[0].message.content);
    
    let instructions;
    try {
      instructions = parseAIResponse(data.choices[0].message.content);
    } catch (error) {
      errorLog('Failed to parse AI response', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
    
    debugLog('Validating instructions');
    validateInstructions(instructions);
    
    return instructions;
  } catch (error) {
    errorLog('Error in getAIInstructions', error);
    throw new Error(`Failed to get AI instructions: ${error.message}`);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog('Message received', {
    type: request.type,
    sender: sender.url,
    tabId: request.tabId,
    requestData: request.type === "getAutomationInstructions" ? {
      userPromptLength: request.userPrompt.length,
      websiteHTMLLength: request.websiteHTML.length
    } : request
  });

  if (request.type === "getAutomationInstructions") {
    (async () => {
      try {
        const instructions = await getAIInstructions(request.userPrompt, request.websiteHTML);
        debugLog('Sending successful response', { instructions });
        
        if (!request.tabId) {
          throw new Error('No tab ID provided');
        }
        
        debugLog('Using provided tab ID:', request.tabId);
        
        // Execute the actions with the provided tab ID
        await executeActions(instructions, request.tabId);
        
        sendResponse({ success: true, instructions });
      } catch (error) {
        errorLog('Error processing automation request:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for async response
  }

  if (request.type === "setApiKey") {
    debugLog('Setting new API key');
    saveSettings({ apiKey: request.apiKey })
      .then(() => {
        config.apiKey = request.apiKey;
        debugLog('API key set successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        errorLog('Error saving API key:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === "setProvider") {
    debugLog('Setting new provider:', request.provider);
    saveSettings({ provider: request.provider })
      .then(() => {
        config.provider = request.provider;
        debugLog('Provider set successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        errorLog('Error saving provider:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
}); 