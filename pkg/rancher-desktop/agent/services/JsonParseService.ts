/**
 * JsonParseService - Robust JSON parsing for LLM outputs
 * Handles malformed JSON, markdown fences, missing quotes, control characters, etc.
 */

import { jsonrepair } from 'jsonrepair';
import { loads as jsonRepairLoads } from 'json-repair-js';
import { parse as bestEffortParse } from 'best-effort-json-parser';
import JSON5 from 'json5';
import { parse as relaxedJsonParse } from 'relaxed-json';
import { parse as dirtyJsonParse } from 'dirty-json';

/**
 * Extract JSON from text that may contain markdown fences, prose, etc.
 * Uses multiple strategies to find valid JSON.
 */
function extractFirstJSONObjectText(text: string): string | null {
  const src = String(text || '');
  
  // Strategy 1: Look for JSON in markdown code fences
  const fenceMatch = src.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('{') || inner.startsWith('[')) {
      return inner;
    }
  }
  
  // Strategy 2: Find the outermost balanced braces
  const firstBrace = src.indexOf('{');
  if (firstBrace === -1) return null;
  
  let depth = 0;
  let inString = false;
  let escape = false;
  const start = firstBrace;
  
  for (let i = firstBrace; i < src.length; i++) {
    const char = src[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    
    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return src.substring(start, i + 1);
        }
      }
    }
  }
  
  // Fallback: simple regex match
  const match = src.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Parse JSON with multiple fallback strategies for LLM output.
 * Tries: native JSON.parse -> json-repair-js -> jsonrepair -> best-effort-json-parser
 */
function parseJsonLenient<T = unknown>(text: string): T | null {
  const src = String(text || '').trim();
  if (!src) return null;
  
  // Strategy 1: Native JSON.parse (fastest)
  try {
    return JSON.parse(src) as T;
  } catch { /* continue */ }

  // Strategy 1b: json5 (allows trailing commas, single quotes, etc.)
  try {
    return JSON5.parse(src) as T;
  } catch { /* continue */ }

  // Strategy 1c: relaxed-json (very permissive JSON parser)
  try {
    return relaxedJsonParse(src) as T;
  } catch { /* continue */ }

  // Strategy 1d: dirty-json (handles very dirty JSON-ish strings)
  try {
    return dirtyJsonParse(src) as T;
  } catch { /* continue */ }
  
  // Strategy 2: json-repair-js (designed for LLM output, handles markdown fences)
  try {
    const result = jsonRepairLoads(src);
    if (result && typeof result === 'object') {
      return result as T;
    }
  } catch { /* continue */ }
  
  // Strategy 3: jsonrepair library
  try {
    const repaired = jsonrepair(src);
    return JSON.parse(repaired) as T;
  } catch { /* continue */ }
  
  // Strategy 4: best-effort-json-parser (handles incomplete/partial JSON)
  try {
    const result = bestEffortParse(src);
    if (result && typeof result === 'object') {
      return result as T;
    }
  } catch { /* continue */ }
  
  // Strategy 5: Sanitize control chars and retry
  const sanitized = src.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (sanitized !== src) {
    try {
      return JSON.parse(sanitized) as T;
    } catch { /* continue */ }

    try {
      return JSON5.parse(sanitized) as T;
    } catch { /* continue */ }
    
    try {
      const repaired = jsonrepair(sanitized);
      return JSON.parse(repaired) as T;
    } catch { /* continue */ }
  }
  
  return null;
}

/**
 * Parse JSON from LLM response text.
 * Handles markdown fences, malformed JSON, missing quotes, control characters, etc.
 * This is the ONLY exported function - all parsing logic is internal.
 */
export function parseJson<T = unknown>(text: string): T | null {
  // First try json-repair-js directly on full text (it extracts JSON from markdown)
  try {
    const result = jsonRepairLoads(text);
    if (result && typeof result === 'object') {
      return result as T;
    }
  } catch { /* continue */ }
  
  // Extract JSON text and parse with fallback strategies
  const jsonText = extractFirstJSONObjectText(text);
  if (!jsonText) {
    return null;
  }
  return parseJsonLenient<T>(jsonText);
}
