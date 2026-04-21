/**
 * Robust JSON parser that handles common Claude API response quirks:
 * - Markdown code fences
 * - Invalid escape sequences
 * - Extra text before/after JSON
 */

function sanitizeJson(text) {
  return text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

function extractJsonByBracketCounting(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    if (depth === 0) return text.substring(start, i + 1);
  }
  return null;
}

export function parseClaudeResponse(rawText) {
  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  // 1. Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Sanitize invalid escape sequences, then parse
  try {
    return JSON.parse(sanitizeJson(cleaned));
  } catch {}

  // 3. Extract JSON by bracket counting
  const extracted = extractJsonByBracketCounting(cleaned);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch {}

    // 4. Sanitize extracted JSON
    try {
      return JSON.parse(sanitizeJson(extracted));
    } catch (err) {
      console.error('[json-parser] Failed to parse extracted JSON:', err.message);
    }
  }

  return null;
}
