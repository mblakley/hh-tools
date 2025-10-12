/**
 * Utility functions for the RDYSL API
 */

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = ['RDYSL_USERNAME', 'RDYSL_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Generate a random delay between min and max milliseconds
 */
function randomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize HTML content for logging (remove sensitive data)
 */
function sanitizeForLogging(html) {
  if (!html) return '';
  
  // Remove potential password fields, tokens, etc.
  return html
    .replace(/password[^>]*>/gi, 'password>')
    .replace(/value="[^"]*"/gi, 'value="***"')
    .substring(0, 500); // Limit length
}

/**
 * Check if a string looks like HTML content
 */
function isHtmlContent(content) {
  if (!content || typeof content !== 'string') return false;
  
  const htmlIndicators = [
    '<html', '<!DOCTYPE', '<head', '<body', '<table', '<div'
  ];
  
  return htmlIndicators.some(indicator => 
    content.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Extract error message from various error types
 */
function extractErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error) return error.error;
  return 'Unknown error occurred';
}

/**
 * Validate player search input
 */
function validatePlayerSearch(search) {
  if (!search || typeof search !== 'string') return { valid: true, search: '' };
  
  const trimmed = search.trim();
  
  // Check for potentially malicious input
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Invalid search input detected' };
    }
  }
  
  return { valid: true, search: trimmed };
}

module.exports = {
  validateEnvironment,
  randomDelay,
  sleep,
  sanitizeForLogging,
  isHtmlContent,
  extractErrorMessage,
  validatePlayerSearch
};

