# Website Automation Chrome Extension

A Chrome extension that uses AI to automate website tasks based on natural language instructions.

## Features

- Natural language interface for automation tasks
- Support for multiple AI providers (OpenAI and Groq)
- Automated actions:
  - Clicking elements
  - Filling forms
  - Selecting options
  - Scrolling to elements
  - Extracting data
  - Displaying messages
- Real-time feedback and status updates
- Error handling and logging

## Project Structure

```
src/
├── background/     # Background script for handling AI requests
├── content/        # Content script for DOM interactions
├── popup/          # Popup UI and interaction
├── utils/          # Utility functions and helpers
└── config/         # Configuration and constants
```

## Setup

1. Clone the repository
2. Install dependencies (if any)
3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## Configuration

The extension requires an API key for either OpenAI or Groq. You can set this in the extension's popup interface.

## Usage

1. Click the extension icon to open the popup
2. Enter your automation request in natural language
3. The extension will:
   - Analyze the current webpage
   - Generate automation instructions
   - Execute the actions
   - Display results and status updates

## Development

The extension uses ES modules and modern JavaScript features. The code is organized into modules for better maintainability:

- `background.js`: Handles AI requests and orchestrates automation
- `content.js`: Manages DOM interactions
- `popup.js`: Handles UI and user interaction
- `utils/`: Contains shared utilities and helpers
- `config/`: Contains configuration and constants

## License

MIT 