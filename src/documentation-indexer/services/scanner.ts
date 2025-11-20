/**
 * Documentation file scanner and indexer
 * Scans directories for documentation files and builds the chunk index
 */

import { existsSync, readFileSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative, extname } from 'path';

import ignore from 'ignore';

import type { DocIndex, DocChunk, ScanProgress, ChunkingConfig } from '../types.js';
import { DOC_EXTENSIONS, DOC_IGNORE_PATTERNS, DEFAULT_CHUNKING_CONFIG } from '../types.js';

import { generateEmbedding } from '../../shared/embeddings.js';

import { generateContext } from './context-generator.js';
import {
  parseMarkdown,
  parseRST,
  parseAsciiDoc,
  parsePlainText,
  mergeSmallChunks,
  splitLargeChunks,
  estimateTokenCount,
  countWords
} from './parser.js';

/**
 * Check if a file is a documentation file
 */
function isDocumentationFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return DOC_EXTENSIONS.includes(ext);
}

/**
 * Scan and index documentation files in a directory
 */
export async function scanAndIndexDocumentation(
  directory: string,
  onProgress?: (progress: ScanProgress) => void,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): Promise<DocIndex> {
  const files = await findDocumentationFiles(directory);

  const index: DocIndex = {
    chunks: new Map(),
    embeddings: new Map(),
    metadata: {
      version: '1.0.0',
      indexedAt: Date.now(),
      fileCount: 0,
      chunkCount: 0
    }
  };

  const progress: ScanProgress = {
    totalFiles: files.length,
    filesProcessed: 0,
    currentFile: ''
  };

  for (const file of files) {
    try {
      progress.currentFile = file;
      onProgress?.(progress);

      const chunks = processFile(file, config);

      if (chunks.length > 0) {
        index.chunks.set(file, chunks);

        // Generate embeddings for each chunk
        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk.context);
          if (embedding) {
            index.embeddings.set(chunk.id, new Float32Array(embedding));
          }
        }
      }

      progress.filesProcessed++;
      onProgress?.(progress);
    } catch {
      // Skip files that fail to index
    }
  }

  // Update metadata
  let totalChunks = 0;
  for (const chunks of index.chunks.values()) {
    totalChunks += chunks.length;
  }

  index.metadata.fileCount = index.chunks.size;
  index.metadata.chunkCount = totalChunks;

  return index;
}

/**
 * Process a single documentation file into chunks
 */
function processFile(file: string, config: ChunkingConfig): DocChunk[] {
  const content = readFileSync(file, 'utf-8');
  const ext = extname(file).toLowerCase();

  // Parse based on file type
  let parsedChunks;
  if (['.md', '.markdown'].includes(ext)) {
    parsedChunks = parseMarkdown(content, file);
  } else if (ext === '.rst') {
    parsedChunks = parseRST(content, file);
  } else if (['.adoc', '.asciidoc'].includes(ext)) {
    parsedChunks = parseAsciiDoc(content, file);
  } else {
    // Plain text or unknown format
    parsedChunks = parsePlainText(content, file);
  }

  // Apply chunking strategy
  if (config.splitAtHeadings) {
    parsedChunks = mergeSmallChunks(parsedChunks, config.minTokens);
    parsedChunks = splitLargeChunks(parsedChunks, config.maxTokens);
  }

  // Convert to DocChunks
  const chunks: DocChunk[] = [];
  for (const parsed of parsedChunks) {
    const chunk: DocChunk = {
      id: `${file}:${parsed.startLine}`,
      file,
      startLine: parsed.startLine,
      endLine: parsed.endLine,
      content: parsed.content,
      context: '', // Will be set below
      hierarchy: parsed.headings,
      chunkType: parsed.chunkType,
      metadata: {
        wordCount: countWords(parsed.content),
        tokenCount: estimateTokenCount(parsed.content)
      }
    };

    // Generate context
    chunk.context = generateContext(chunk);
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Update index for specific files (incremental re-indexing)
 */
export async function updateIndexForFiles(index: DocIndex, files: string[], config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG): Promise<void> {
  for (const file of files) {
    try {
      // Remove old chunks and embeddings
      index.chunks.delete(file);

      const keysToDelete: string[] = [];
      for (const key of index.embeddings.keys()) {
        if (key.startsWith(`${file}:`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        index.embeddings.delete(key);
      }

      // Re-process if file exists
      if (existsSync(file)) {
        const chunks = processFile(file, config);

        if (chunks.length > 0) {
          index.chunks.set(file, chunks);

          for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.context);
            if (embedding) {
              index.embeddings.set(chunk.id, new Float32Array(embedding));
            }
          }
        }
      }
    } catch {
      // Skip files that fail to update
    }
  }

  // Update metadata
  let totalChunks = 0;
  for (const chunks of index.chunks.values()) {
    totalChunks += chunks.length;
  }

  index.metadata.fileCount = index.chunks.size;
  index.metadata.chunkCount = totalChunks;
  index.metadata.indexedAt = Date.now();
}

/**
 * Validate and sync index with filesystem
 * - Remove entries for deleted files
 * - Add entries for new files
 * - Update entries for modified files
 */
export async function validateAndSyncIndex(index: DocIndex, projectRoot: string): Promise<void> {
  const filesToUpdate: string[] = [];
  const indexedAt = index.metadata.indexedAt;

  // 1. Check for deleted files
  for (const file of index.chunks.keys()) {
    if (!existsSync(file)) {
      filesToUpdate.push(file);
    }
  }

  // 2. Scan for new and modified files
  const currentFiles = await findDocumentationFiles(projectRoot);
  const indexedFiles = new Set(index.chunks.keys());

  for (const file of currentFiles) {
    // New file - not in index
    if (!indexedFiles.has(file)) {
      filesToUpdate.push(file);
      continue;
    }

    // Modified file - check mtime
    try {
      const stats = await stat(file);
      if (stats.mtimeMs > indexedAt) {
        filesToUpdate.push(file);
      }
    } catch {
      // If we can't stat the file, skip it
    }
  }

  // 3. Update all changed files
  if (filesToUpdate.length > 0) {
    await updateIndexForFiles(index, filesToUpdate);
  }
}

/**
 * Find all documentation files in a directory
 */
async function findDocumentationFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const ig = ignore().add(DOC_IGNORE_PATTERNS);

  // Load .gitignore if it exists
  const gitignorePath = join(directory, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(directory, fullPath);

      if (ig.ignores(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        if (isDocumentationFile(entry.name)) {
          const stats = await stat(fullPath);
          // Skip files larger than 5MB
          if (stats.size < 5 * 1024 * 1024) {
            files.push(fullPath);
          }
        }
      }
    }
  }

  await scan(directory);

  return files;
}
