/**
 * MCP tool: search_docs
 * Search for documentation chunks in the codebase
 */

import { searchDocumentation } from '../services/search.js';
import type { DocIndex, SearchMode, SearchFilters } from '../types.js';

// @type-duplicate-allowed - Different domain from other search tools
interface SearchDocsParams {
  query: string;
  mode?: SearchMode;
  filters?: SearchFilters;
  limit?: number;
}

export async function handleSearchDocs(
  index: DocIndex | null,
  indexingProgress: { isIndexing: boolean; filesProcessed: number; totalFiles: number },
  embeddingsState: { available: boolean; lastAttempt: number; retryIntervalMs: number },
  params: SearchDocsParams
): Promise<Record<string, unknown>> {
  if (indexingProgress.isIndexing) {
    const percent =
      indexingProgress.totalFiles > 0 ? Math.round((indexingProgress.filesProcessed / indexingProgress.totalFiles) * 100) : 0;
    return {
      success: false,
      error: `Indexing in progress: ${percent}% (${indexingProgress.filesProcessed}/${indexingProgress.totalFiles} files), try again in a few seconds`
    };
  }

  if (!index) {
    return {
      success: false,
      error: 'Index not initialized'
    };
  }

  const { query, mode = 'semantic', filters, limit = 10 } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  // Check embeddings availability for semantic search
  if (mode === 'semantic' && !embeddingsState.available) {
    const nextRetryMinutes = Math.ceil((embeddingsState.retryIntervalMs - (Date.now() - embeddingsState.lastAttempt)) / 60000);
    return {
      success: false,
      error: `Semantic search unavailable - embeddings model failed to load. Retrying in ${nextRetryMinutes} minutes. Use mode='exact' or mode='fuzzy' instead.`
    };
  }

  const results = await searchDocumentation(index, query, mode, filters, limit);

  // Transform results to a more user-friendly format
  const formattedResults = results.map((result) => ({
    file: result.file,
    line: result.startLine,
    score: result.score,
    context: result.context,
    hierarchy: result.hierarchy,
    chunkType: result.chunkType,
    matchReason: result.match_reason
  }));

  return {
    success: true,
    data: {
      results: formattedResults,
      query,
      mode,
      totalResults: formattedResults.length
    }
  };
}
