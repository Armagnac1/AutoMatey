import { config } from '../config/config.js';

// Enhanced debug logger with log levels
export function debugLog(message, data = null, level = 'info') {
  if (config.debug) {
    const timestamp = new Date().toISOString();
    const logLevel = level.toUpperCase();
    console.log(`[${timestamp}] ${logLevel}: ${message}`);
    if (data !== null) {
      console.log(`[${timestamp}] ${logLevel} DATA:`, data);
    }
  }
}

// Error logger
export function errorLog(message, error) {
  debugLog(message, error, 'error');
}

// Success logger
export function successLog(message, data = null) {
  debugLog(message, data, 'success');
}

// Warning logger
export function warningLog(message, data = null) {
  debugLog(message, data, 'warning');
}