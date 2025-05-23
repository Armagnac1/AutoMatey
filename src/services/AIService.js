import { config } from '../config/config.js';
import { debugLog, errorLog } from '../utils/logger.js';
import { loadSettings } from '../utils/storage.js';

export class AIService {
  constructor() {
    this.systemMessage = `You are a website automation assistant that helps users automate tasks on websites. Your role is to analyze the provided HTML and user request, then generate precise automation instructions.

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
}`;
    this.maxHTMLLength = 10000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async makeAPIRequest(url, headers, body) {
    debugLog('Making API request', { url, headers: { ...headers, Authorization: 'Bearer ***' } });
    
    let lastError;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error?.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
          throw new Error('Invalid response format from API');
        }

        return data;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
          debugLog(`Retrying API request (attempt ${attempt + 1}/${this.retryAttempts})`);
        }
      }
    }
    throw lastError;
  }

  async getInstructions(userPrompt, websiteHTML) {
    debugLog('getAIInstructions called', { userPromptLength: userPrompt.length, websiteHTMLLength: websiteHTML.length });
    
    const settings = await loadSettings();
    this.validateSettings(settings);

    const cleanedHTML = this.cleanHTML(websiteHTML);
    const { baseUrl, headers, body } = this.prepareRequest(settings, cleanedHTML, userPrompt);

    const startTime = Date.now();
    const data = await this.makeAPIRequest(baseUrl, headers, body);
    const requestDuration = Date.now() - startTime;
    
    debugLog(`API request completed in ${requestDuration}ms`, {
      status: 'success',
      responseId: data.id,
      model: data.model,
      usage: data.usage,
      finishReason: data.choices[0].finish_reason
    });

    return this.parseAIResponse(data.choices[0].message.content);
  }

  validateSettings(settings) {
    if (!settings.provider) {
      throw new Error('Please select an AI provider in the extension settings');
    }
    if (settings.provider === 'openai' && !settings.openaiKey) {
      throw new Error('Please set your OpenAI API key in the extension settings');
    }
    if (settings.provider === 'groq' && !settings.groqKey) {
      throw new Error('Please set your Groq API key in the extension settings');
    }
  }

  prepareRequest(settings, cleanedHTML, userPrompt) {
    let baseUrl, headers, body;
    
    if (settings.provider === 'groq') {
      baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.groqKey}`
      };
      body = {
        model: 'gemma2-9b-it',
        messages: [
          { role: 'system', content: this.systemMessage },
          { role: 'user', content: `Website HTML: ${cleanedHTML}\n\nUser Request: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      };
    } else {
      baseUrl = config.baseUrl;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiKey}`
      };
      body = {
        model: config.model,
        messages: [
          { role: 'system', content: this.systemMessage },
          { role: 'user', content: `Website HTML: ${cleanedHTML}\n\nUser Request: ${userPrompt}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      };
    }

    return { baseUrl, headers, body };
  }

  cleanHTML(html) {
    try {
      if (!html || typeof html !== 'string') {
        throw new Error('Invalid HTML input');
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Remove unwanted elements
      const elementsToRemove = [
        'script',
        'style',
        'noscript',
        'iframe',
        'object',
        'embed',
        'applet',
        'meta',
        'link[rel="stylesheet"]',
        'link[rel="preload"]',
        'link[rel="prefetch"]'
      ];

      elementsToRemove.forEach(selector => {
        const elements = tempDiv.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

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

      // Remove empty elements
      const emptyElements = tempDiv.querySelectorAll('*:empty');
      emptyElements.forEach(el => el.remove());

      // Remove inline styles and event handlers
      const allElements = tempDiv.getElementsByTagName('*');
      for (const el of allElements) {
        el.removeAttribute('style');
        el.removeAttribute('onclick');
        el.removeAttribute('onload');
        el.removeAttribute('onerror');
        el.removeAttribute('onmouseover');
        el.removeAttribute('onmouseout');
      }

      const cleanedHTML = tempDiv.innerHTML;
      return cleanedHTML.length > this.maxHTMLLength 
        ? cleanedHTML.substring(0, this.maxHTMLLength) + '...' 
        : cleanedHTML;
    } catch (error) {
      errorLog('Error cleaning HTML:', error);
      return html.substring(0, this.maxHTMLLength) + '...';
    }
  }

  parseAIResponse(content) {
    try {
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid AI response content');
      }

      let jsonContent = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      }
      
      const instructions = JSON.parse(jsonContent);
      this.validateInstructions(instructions);
      return instructions;
    } catch (error) {
      errorLog('Failed to parse AI response:', error);
      throw new Error('Invalid response format from AI');
    }
  }

  validateInstructions(instructions) {
    if (!instructions || typeof instructions !== 'object') {
      throw new Error('Invalid instructions format');
    }

    if (instructions.error) {
      throw new Error(instructions.error);
    }

    const validators = {
      click: (value) => typeof value === 'string',
      fill: (value) => 
        typeof value === 'object' && 
        typeof value.selector === 'string' && 
        typeof value.value === 'string',
      select: (value) => 
        typeof value === 'object' && 
        typeof value.selector === 'string' && 
        typeof value.value === 'string',
      wait: (value) => typeof value === 'number' && value >= 0,
      scroll: (value) => 
        typeof value === 'object' && 
        typeof value.selector === 'string' && 
        ['smooth', 'auto'].includes(value.behavior),
      display: (value) => 
        typeof value === 'object' && 
        typeof value.message === 'string' && 
        ['info', 'warning', 'error', 'success'].includes(value.type),
      extract: (value) => 
        typeof value === 'object' && 
        typeof value.selector === 'string' && 
        Array.isArray(value.data)
    };

    for (const [key, validator] of Object.entries(validators)) {
      if (instructions[key] && !validator(instructions[key])) {
        throw new Error(`Invalid ${key} action format`);
      }
    }
  }
} 