// Listen for messages from the popup and background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "getPageContent") {
    sendResponse({ html: document.documentElement.outerHTML });
    return true;
  }
  
  if (request.action === "performAutomation") {
    executeAutomation(request.instructions)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function executeAutomation(instructions) {
  const results = [];
  
  try {
    // Handle different types of automation actions
    if (instructions.click) {
      await handleClick(instructions.click);
      results.push(`Clicked: ${instructions.click}`);
    }

    if (instructions.fill) {
      await handleFill(instructions.fill);
      results.push(`Filled ${Object.keys(instructions.fill).length} fields`);
    }

    if (instructions.select) {
      await handleSelect(instructions.select);
      results.push(`Selected: ${instructions.select}`);
    }

    if (instructions.wait) {
      await handleWait(instructions.wait);
      results.push(`Waited: ${instructions.wait}ms`);
    }

    if (instructions.scroll) {
      await handleScroll(instructions.scroll);
      results.push(`Scrolled to: ${instructions.scroll}`);
    }

    return results;
  } catch (error) {
    console.error("Automation error:", error);
    throw error;
  }
}

async function handleClick(selector) {
  const element = await waitForElement(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  element.click();
}

async function handleFill(fields) {
  for (const [selector, value] of Object.entries(fields)) {
    const element = await waitForElement(selector);
    if (!element) throw new Error(`Form field not found: ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function handleSelect(instruction) {
  const { selector, value } = instruction;
  const element = await waitForElement(selector);
  if (!element) throw new Error(`Select element not found: ${selector}`);
  if (element.tagName.toLowerCase() !== 'select') {
    throw new Error(`Element is not a select: ${selector}`);
  }
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function handleWait(duration) {
  await new Promise(resolve => setTimeout(resolve, duration));
}

async function handleScroll(instruction) {
  if (typeof instruction === 'string') {
    const element = await waitForElement(instruction);
    if (!element) throw new Error(`Scroll target not found: ${instruction}`);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    window.scrollTo({
      top: instruction.top || 0,
      left: instruction.left || 0,
      behavior: 'smooth'
    });
  }
}

async function waitForElement(selector, timeout = 5000) {
  const element = document.querySelector(selector);
  if (element) return element;

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        obs.disconnect();
        resolve(null);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}