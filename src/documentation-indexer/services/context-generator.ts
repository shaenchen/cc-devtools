/**
 * Heuristic context generation for documentation chunks
 * Generates human-readable context strings for search results
 */

import type { DocChunk } from '../types.js';

import { extractFirstSentence } from './parser.js';

/**
 * Generate heuristic context from a documentation chunk
 * Format: "{category} > {hierarchy}: {firstSentence}"
 *
 * @param chunk - The documentation chunk
 * @returns Context string for display and search
 */
export function generateContext(chunk: DocChunk): string {
  const category = extractCategory(chunk.file);
  const hierarchy = chunk.hierarchy.join(' > ');
  const firstSentence = extractFirstSentence(chunk.content);

  // Format based on available information
  if (hierarchy && firstSentence) {
    return `${category} > ${hierarchy}: ${firstSentence.slice(0, 80)}`;
  } else if (hierarchy) {
    return `${category} > ${hierarchy}`;
  } else if (firstSentence) {
    return `${category}: ${firstSentence.slice(0, 80)}`;
  } else {
    return category;
  }
}

/**
 * Extract category from file path
 * Examples:
 *   docs/frontend/auth.md -> "frontend"
 *   documentation/api/users.md -> "api"
 *   README.md -> "general"
 */
export function extractCategory(filePath: string): string {
  const pathParts = filePath.split('/');

  // Look for common documentation directory names
  const docsDirNames = ['docs', 'documentation', 'doc', 'guides', 'wiki'];

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i]?.toLowerCase();
    if (part && docsDirNames.includes(part)) {
      const nextPart = pathParts[i + 1];
      if (nextPart && !nextPart.includes('.')) {
        return nextPart;
      }
    }
  }

  // Fallback: use the second-to-last directory name
  if (pathParts.length >= 2) {
    const secondToLast = pathParts[pathParts.length - 2];
    if (secondToLast && !secondToLast.includes('.')) {
      return secondToLast;
    }
  }

  return 'general';
}

/**
 * Generate searchable text from chunk (for keyword matching)
 * Combines all relevant text fields for comprehensive keyword search
 */
export function generateSearchableText(chunk: DocChunk): string {
  const parts = [chunk.context, ...chunk.hierarchy, chunk.content];
  return parts.join(' ').toLowerCase();
}
