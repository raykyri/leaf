// HTML utility functions

const HTML_ESCAPE_REGEX = /[&<>"'`/]/g;

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * Escapes the following characters per OWASP recommendations:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#39;
 * - ` → &#96;  (prevents template literal injection in inline JS)
 * - / → &#x2F; (defense-in-depth against tag closing)
 *
 * @param text - The string to escape
 * @returns The escaped string, or empty string if input is not a string
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  return text.replace(HTML_ESCAPE_REGEX, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '`': return '&#96;';
      case '/': return '&#x2F;';
      default: return char;
    }
  });
}
