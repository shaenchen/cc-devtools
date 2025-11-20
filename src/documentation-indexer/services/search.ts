/**
 * Documentation search functionality: keyword, semantic, and fuzzy search
 * Combines multiple search strategies with score merging
 */

import { minimatch } from 'minimatch';

import type { DocIndex, SearchResult, SearchFilters, SearchMode, DocChunk } from '../types.js';

import { generateEmbedding, cosineSimilarity } from '../../shared/embeddings.js';

import { generateSearchableText } from './context-generator.js';

const DEFAULT_LIMIT = 10;

export async function searchDocumentation(
  index: DocIndex,
  query: string,
  mode: SearchMode = 'semantic',
  filters?: SearchFilters,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  let results: SearchResult[] = [];

  switch (mode) {
    case 'exact':
      results = keywordSearch(index, query, filters);
      break;
    case 'fuzzy':
      results = fuzzySearch(index, query, filters);
      break;
    case 'semantic':
    default:
      results = await semanticSearchWithKeyword(index, query, filters);
      break;
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Keyword-based exact search
 */
function keywordSearch(index: DocIndex, query: string, filters?: SearchFilters): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const chunks of index.chunks.values()) {
    for (const chunk of chunks) {
      if (!matchesFilters(chunk, filters)) {
        continue;
      }

      const searchableText = generateSearchableText(chunk);
      let score = 0;
      let matchReason = '';

      // Check for exact matches in different parts
      if (chunk.context.toLowerCase().includes(queryLower)) {
        score = 0.9;
        matchReason = 'context match';
      } else if (chunk.hierarchy.some((h) => h.toLowerCase().includes(queryLower))) {
        score = 0.8;
        matchReason = 'heading match';
      } else if (searchableText.includes(queryLower)) {
        score = 0.6;
        matchReason = 'content match';
      }

      if (score > 0) {
        results.push({
          ...chunk,
          score,
          match_reason: matchReason
        });
      }
    }
  }

  return results;
}

/**
 * Semantic search with keyword fallback
 */
async function semanticSearchWithKeyword(index: DocIndex, query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  const keywordResults = keywordSearch(index, query, filters);
  const semanticResults = await semanticSearch(index, query, filters);

  const mergedMap = new Map<string, SearchResult>();

  for (const result of keywordResults) {
    mergedMap.set(result.id, result);
  }

  for (const result of semanticResults) {
    const existing = mergedMap.get(result.id);

    if (existing) {
      // Boost score when both keyword and semantic match
      existing.score += result.score;
      existing.match_reason = `${existing.match_reason} + ${result.match_reason}`;
    } else {
      mergedMap.set(result.id, result);
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Semantic search using embeddings
 */
async function semanticSearch(index: DocIndex, query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    return results;
  }

  for (const [chunkId, chunkEmbedding] of index.embeddings.entries()) {
    // Find the chunk
    let chunk: DocChunk | null = null;
    for (const chunks of index.chunks.values()) {
      chunk = chunks.find((c) => c.id === chunkId) ?? null;
      if (chunk) break;
    }

    if (!chunk) continue;

    if (!matchesFilters(chunk, filters)) {
      continue;
    }

    const similarity = cosineSimilarity(queryEmbedding, Array.from(chunkEmbedding));

    if (similarity > 0.3) {
      results.push({
        ...chunk,
        score: similarity,
        match_reason: 'semantic similarity'
      });
    }
  }

  return results;
}

/**
 * Fuzzy search using Levenshtein distance
 */
function fuzzySearch(index: DocIndex, query: string, filters?: SearchFilters): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const chunks of index.chunks.values()) {
    for (const chunk of chunks) {
      if (!matchesFilters(chunk, filters)) {
        continue;
      }

      // Fuzzy match against headings and context
      let bestScore = 0;
      const matchReason = 'fuzzy match';

      for (const heading of chunk.hierarchy) {
        const distance = levenshteinDistance(queryLower, heading.toLowerCase());
        const maxLen = Math.max(queryLower.length, heading.length);
        const score = 1 - distance / maxLen;

        if (score > bestScore) {
          bestScore = score;
        }
      }

      // Also check context
      const words = chunk.context.toLowerCase().split(/\s+/);
      for (const word of words) {
        const distance = levenshteinDistance(queryLower, word);
        const maxLen = Math.max(queryLower.length, word.length);
        const score = 1 - distance / maxLen;

        if (score > bestScore) {
          bestScore = score;
        }
      }

      if (bestScore > 0.6) {
        results.push({
          ...chunk,
          score: bestScore,
          match_reason: matchReason
        });
      }
    }
  }

  return results;
}

/**
 * Check if chunk matches the provided filters
 */
function matchesFilters(chunk: DocChunk, filters?: SearchFilters): boolean {
  if (!filters) return true;

  // File pattern filter
  if (filters.filePattern && !minimatch(chunk.file, filters.filePattern)) {
    return false;
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    const contextLower = chunk.context.toLowerCase();
    const hasCategory = filters.category.some((cat) => contextLower.includes(cat.toLowerCase()));
    if (!hasCategory) {
      return false;
    }
  }

  // Minimum score filter (only applicable for already-scored results)
  // This will be applied after scoring

  return true;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    if (matrix[0]) {
      matrix[0][j] = j;
    }
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const matrixI = matrix[i];
      const matrixIPrev = matrix[i - 1];
      const matrixIPrevJ = matrixIPrev?.[j - 1] ?? 0;
      const matrixIPrevJCur = matrixIPrev?.[j] ?? 0;
      const matrixIJPrev = matrixI?.[j - 1] ?? 0;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        if (matrixI) {
          matrixI[j] = matrixIPrevJ;
        }
      } else {
        if (matrixI) {
          matrixI[j] = Math.min(matrixIPrevJ + 1, matrixIJPrev + 1, matrixIPrevJCur + 1);
        }
      }
    }
  }

  return matrix[b.length]?.[a.length] ?? 0;
}
