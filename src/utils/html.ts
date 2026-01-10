// HTML utility functions

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Converts &, <, >, ", and ' to their HTML entity equivalents.
 */
export function escapeHtml(text: string): string {
  return text.replace(HTML_ESCAPE_REGEX, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}
