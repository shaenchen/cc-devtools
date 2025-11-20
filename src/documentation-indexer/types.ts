/**
 * Core type definitions for documentation indexer
 */

import type { WithScore } from '../shared/types/common.js';

export type ChunkType = 'heading' | 'paragraph' | 'code' | 'list';

export interface DocChunk {
  id: string; // Unique chunk identifier: {file}:{startLine}
  file: string; // Absolute file path
  startLine: number; // Starting line number
  endLine: number; // Ending line number
  content: string; // Raw chunk content
  context: string; // Heuristic-generated context
  hierarchy: string[]; // ["H1", "H2", "H3"]
  chunkType: ChunkType;
  metadata?: {
    wordCount: number;
    tokenCount: number;
  };
}

export interface DocIndex {
  chunks: Map<string, DocChunk[]>; // file -> chunks
  embeddings: Map<string, Float32Array>; // chunkId -> embedding
  metadata: IndexMetadata;
}

// @type-duplicate-allowed
export interface IndexMetadata {
  version: string;
  indexedAt: number;
  fileCount: number;
  chunkCount: number;
}

export type SearchResult = WithScore<DocChunk>;

export type SearchMode = 'semantic' | 'exact' | 'fuzzy';

export interface SearchFilters {
  filePattern?: string; // Glob pattern for files
  category?: string[]; // Filter by category (from path)
  minScore?: number;
}

/**
 * Supported documentation file extensions
 */
export const DOC_EXTENSIONS = [
  '.md',
  '.markdown', // Markdown
  '.txt', // Plain text
  '.rst', // reStructuredText
  '.adoc',
  '.asciidoc' // AsciiDoc
];

/**
 * Standard ignore patterns for documentation files
 */
export const DOC_IGNORE_PATTERNS = [
  'node_modules/**',
  '.venv/**',
  'venv/**',
  '__pycache__/**',
  'vendor/**',
  'target/**',
  'dist/**',
  'build/**',
  '.git/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '*.min.*'
];

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  minTokens: number;
  maxTokens: number;
  splitAtHeadings: boolean;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  minTokens: 200,
  maxTokens: 500,
  splitAtHeadings: true
};

/**
 * Search configuration
 */
export interface SearchConfig {
  defaultMode: SearchMode;
  defaultLimit: number;
  semanticThreshold: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  defaultMode: 'semantic',
  defaultLimit: 10,
  semanticThreshold: 0.3
};

/**
 * Parse result from document parsing
 */
export interface ParsedChunk {
  headings: string[]; // ["Getting Started", "Installation"]
  firstSentence: string;
  chunkType: ChunkType;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Progress callback for scanning
 */
export interface ScanProgress {
  filesProcessed: number;
  totalFiles: number;
  currentFile: string;
}

/**
 * File watcher interface
 */
export interface FileWatcher {
  start(): void;
  stop(): void;
}
