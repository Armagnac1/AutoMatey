// Debug logging function
function debugLog(...args) {
  console.log('[Website Automation]', ...args);
}

// Error logging function
function errorLog(...args) {
  console.error('[Website Automation]', ...args);
}

// Helper function to find elements
function findElement(selector, multiple = false) {
  debugLog('Finding element with selector:', selector);
  const elements = multiple ? document.querySelectorAll(selector) : document.querySelector(selector);
  
  if (!elements || (multiple && elements.length === 0)) {
    // Try to find similar elements to help with debugging
    const similarElements = document.querySelectorAll(selector.split('[')[0]);
    const similarCount = similarElements.length;
    
    if (similarCount > 0) {
      const examples = Array.from(similarElements)
        .slice(0, 3)
        .map(el => {
          const attrs = Array.from(el.attributes)
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(' ');
          return `<${el.tagName.toLowerCase()} ${attrs}>`;
        });
      
      throw new Error(
        `Element not found: ${selector}\n` +
        `Found ${similarCount} similar elements. Examples:\n` +
        examples.join('\n')
      );
    }
    
    throw new Error(`Element not found: ${selector}`);
  }
  
  return elements;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Content script received message:', message);

  // Handle ping message to verify content script is ready
  if (message.type === 'ping') {
    debugLog('Received ping, content script is ready');
    sendResponse({ success: true, message: 'Content script is ready' });
    return true;
  }

  // Handle automation actions
  switch (message.type) {
    case 'click':
      handleClick(message.selector, sendResponse);
      break;
    case 'fill':
      handleFill(message.selector, message.value, sendResponse);
      break;
    case 'select':
      handleSelect(message.selector, message.value, sendResponse);
      break;
    case 'scroll':
      handleScroll(message.selector, message.behavior, sendResponse);
      break;
    default:
      errorLog('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep the message channel open for async response
});

// Action handlers
function handleClick(selector, sendResponse) {
  try {
    const element = findElement(selector);
    debugLog('Clicking element:', element);
    element.click();
    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error clicking element:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleFill(selector, value, sendResponse) {
  try {
    const element = findElement(selector);
    debugLog('Filling element:', element, 'with value:', value);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error filling element:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleSelect(selector, value, sendResponse) {
  try {
    const element = findElement(selector);
    debugLog('Selecting option in element:', element, 'with value:', value);
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error selecting option:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleScroll(selector, behavior, sendResponse) {
  try {
    const element = findElement(selector);
    debugLog('Scrolling to element:', element, 'with behavior:', behavior);
    element.scrollIntoView({ behavior: behavior || 'smooth' });
    sendResponse({ success: true });
  } catch (error) {
    errorLog('Error scrolling to element:', error);
    sendResponse({ success: false, error: error.message });
  }
} 