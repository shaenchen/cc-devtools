#!/usr/bin/env node

/**
 * Documentation Indexer MCP Server
 * Provides semantic documentation search capabilities
 */

import { join } from 'path';

import { initializeModel } from '../shared/embeddings.js';
import { createMCPServer, startMCPServer } from '../shared/mcp-server-utils.js';

import { loadIndex, saveIndex, createEmptyIndex } from './core/storage.js';
import { scanAndIndexDocumentation, updateIndexForFiles, validateAndSyncIndex } from './services/scanner.js';
import { createFileWatcher } from './services/watcher.js';
import { handleSearchDocs } from './tools/search-docs.js';

import type { DocIndex } from './types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Get paths (evaluated at runtime for test isolation)
 */
function getProjectRoot(): string {
  return process.cwd();
}

function getIndexPath(): string {
  return join(getProjectRoot(), 'cc-devtools', '.cache', 'documentation-index.msgpack');
}

let index: DocIndex | null = null;
const indexingProgress = {
  isIndexing: false,
  filesProcessed: 0,
  totalFiles: 0
};

// Embeddings availability state with self-healing
const embeddingsState = {
  available: false,
  lastAttempt: 0,
  retryIntervalMs: 5 * 60 * 1000 // 5 minutes
};

async function tryInitializeEmbeddings(): Promise<boolean> {
  try {
    await initializeModel();
    embeddingsState.available = true;
    embeddingsState.lastAttempt = Date.now();
    return true;
  } catch {
    embeddingsState.available = false;
    embeddingsState.lastAttempt = Date.now();
    return false;
  }
}

async function ensureEmbeddingsAvailable(): Promise<boolean> {
  if (embeddingsState.available) {
    return true;
  }

  const timeSinceLastAttempt = Date.now() - embeddingsState.lastAttempt;
  if (timeSinceLastAttempt >= embeddingsState.retryIntervalMs) {
    return tryInitializeEmbeddings();
  }

  return false;
}

const SEARCH_DOCS_TOOL: Tool = {
  name: 'search_docs',
  description:
    'Search documentation with semantic/exact/fuzzy modes. Returns relevant documentation chunks with context, hierarchy, and file locations.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "authentication setup", "API documentation")'
      },
      mode: {
        type: 'string',
        enum: ['semantic', 'exact', 'fuzzy'],
        description: 'Search mode: semantic (natural language), exact (keyword), fuzzy (typo-tolerant)',
        default: 'semantic'
      },
      filters: {
        type: 'object',
        properties: {
          filePattern: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g., "docs/api/**")'
          },
          category: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Filter by documentation category (e.g., ["frontend", "security"])'
          },
          minScore: {
            type: 'number',
            description: 'Minimum relevance score (0-1)'
          }
        }
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
        default: 10
      }
    },
    required: ['query']
  }
};

async function initialize(): Promise<void> {
  // Try to initialize embeddings (will enter degraded mode if fails)
  await tryInitializeEmbeddings();

  const indexPath = getIndexPath();
  const projectRoot = getProjectRoot();

  index = await loadIndex(indexPath);

  if (!index) {
    index = createEmptyIndex();
    indexingProgress.isIndexing = true;

    index = await scanAndIndexDocumentation(projectRoot, (progress) => {
      indexingProgress.filesProcessed = progress.filesProcessed;
      indexingProgress.totalFiles = progress.totalFiles;
    });

    indexingProgress.isIndexing = false;
    await saveIndex(index, indexPath);
  } else {
    try {
      await Promise.race([
        validateAndSyncIndex(index, projectRoot),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Index validation timeout')), 30000))
      ]);
      await saveIndex(index, indexPath);
    } catch {
      // If validation times out or fails, use existing index as-is
    }
  }

  const watcher = createFileWatcher(projectRoot, (files) => {
    if (index) {
      void (async (): Promise<void> => {
        try {
          await updateIndexForFiles(index, files);
          await saveIndex(index, indexPath);
        } catch {
          // Silently fail file watcher updates
        }
      })();
    }
  });

  watcher.start();
}

async function main(): Promise<void> {
  // Register global error handlers
  process.on('unhandledRejection', () => {
    // Silently handle unhandled rejections
  });

  process.on('uncaughtException', () => {
    // Exit on uncaught exceptions
    process.exit(1);
  });

  const server = createMCPServer({
    name: 'cc-devtools-documentation-indexer',
    version: '0.1.0',
    tools: [SEARCH_DOCS_TOOL],
    handlers: {
      search_docs: async (args) => {
        void ensureEmbeddingsAvailable();
        return handleSearchDocs(
          index,
          indexingProgress,
          embeddingsState,
          args as unknown as Parameters<typeof handleSearchDocs>[3]
        );
      }
    }
  });

  await startMCPServer(server);

  initialize().catch(() => {
    embeddingsState.available = false;
    index = index ?? createEmptyIndex();
    indexingProgress.isIndexing = false;
  });
}

main().catch(() => {
  process.exit(1);
});
