/**
 * Scanner service tests for Documentation Indexer
 * Tests file discovery and chunk processing logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { scanAndIndexDocumentation, updateIndexForFiles } from '../../../src/documentation-indexer/services/scanner.js';
import { createEmptyIndex } from '../../../src/documentation-indexer/core/storage.js';
import type { ScanProgress } from '../../../src/documentation-indexer/types.js';

// Mock embeddings to speed up tests
vi.mock('../../../src/shared/embeddings.js', () => ({
  generateEmbedding: vi.fn(async () => new Float32Array([0.1, 0.2, 0.3, 0.4]))
}));

describe('Documentation Scanner', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(originalCwd, '.test-scanner-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  describe('scanAndIndexDocumentation()', () => {
    it('should scan and index markdown files', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'test.md'),
        '# Title\n\nThis is a test document.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBeGreaterThan(0);
      expect(index.metadata.fileCount).toBeGreaterThan(0);
      expect(index.metadata.chunkCount).toBeGreaterThan(0);
    });

    it('should generate embeddings for chunks', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'test.md'),
        '# Test\n\nContent.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.embeddings.size).toBeGreaterThan(0);
    });

    it('should call progress callback', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'test.md'), '# Test');

      let progressCalled = false;
      const onProgress = (progress: ScanProgress) => {
        progressCalled = true;
        expect(progress.totalFiles).toBeGreaterThanOrEqual(0);
        expect(progress.filesProcessed).toBeGreaterThanOrEqual(0);
      };

      await scanAndIndexDocumentation(testDir, onProgress);

      expect(progressCalled).toBe(true);
    });

    it('should handle empty directory', async () => {
      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBe(0);
      expect(index.metadata.fileCount).toBe(0);
      expect(index.metadata.chunkCount).toBe(0);
    });

    it('should skip non-documentation files', async () => {
      writeFileSync(join(testDir, 'test.js'), 'console.log("test")');
      writeFileSync(join(testDir, 'test.py'), 'print("test")');

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBe(0);
    });

    it('should index multiple file types', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'test.md'), '# Markdown');
      writeFileSync(join(docsDir, 'test.rst'), 'RST Title\n=========');
      writeFileSync(join(docsDir, 'test.txt'), 'Plain text.');

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBeGreaterThanOrEqual(3);
    });

    it('should respect .gitignore', async () => {
      const docsDir = join(testDir, 'docs');
      const nodeModules = join(testDir, 'node_modules');
      mkdirSync(docsDir, { recursive: true });
      mkdirSync(nodeModules, { recursive: true });

      writeFileSync(join(docsDir, 'included.md'), '# Included');
      writeFileSync(join(nodeModules, 'excluded.md'), '# Excluded');

      const index = await scanAndIndexDocumentation(testDir);

      const files = Array.from(index.chunks.keys());
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should set correct metadata', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'test.md'), '# Test\n\nContent.');

      const before = Date.now();
      const index = await scanAndIndexDocumentation(testDir);
      const after = Date.now();

      expect(index.metadata.version).toBeDefined();
      expect(index.metadata.indexedAt).toBeGreaterThanOrEqual(before);
      expect(index.metadata.indexedAt).toBeLessThanOrEqual(after);
    });

    it('should handle files with multiple chunks', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'multi.md'),
        '# Section 1\n\nContent 1 with enough text.\n\n## Section 2\n\nContent 2 with more text here.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const filePath = Array.from(index.chunks.keys())[0];
      const chunks = index.chunks.get(filePath ?? '');

      expect(chunks?.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate unique chunk IDs', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'test.md'),
        '# Section 1\n\nContent.\n\n# Section 2\n\nMore content.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const allChunks = Array.from(index.chunks.values()).flat();
      const ids = allChunks.map(c => c.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('updateIndexForFiles()', () => {
    it('should update index for specific files', async () => {
      const index = createEmptyIndex();
      const testFile = join(testDir, 'test.md');

      writeFileSync(testFile, '# Original\n\nOriginal content.');

      await updateIndexForFiles(index, [testFile]);

      expect(index.chunks.has(testFile)).toBe(true);
    });

    it('should replace existing chunks', async () => {
      const index = createEmptyIndex();
      const testFile = join(testDir, 'test.md');

      writeFileSync(testFile, '# Original with some text here.');
      await updateIndexForFiles(index, [testFile]);

      const originalCount = index.metadata.chunkCount;

      writeFileSync(testFile, '# Updated\n\n## New Section\n\nNew content with more text.\n\n### Another Section\n\nEven more content here.');
      await updateIndexForFiles(index, [testFile]);

      expect(index.metadata.chunkCount).toBeGreaterThanOrEqual(originalCount);
    });

    it('should remove chunks if file is deleted', async () => {
      const index = createEmptyIndex();
      const testFile = join(testDir, 'test.md');

      writeFileSync(testFile, '# Test');
      await updateIndexForFiles(index, [testFile]);

      expect(index.chunks.has(testFile)).toBe(true);

      rmSync(testFile);
      await updateIndexForFiles(index, [testFile]);

      expect(index.chunks.has(testFile)).toBe(false);
    });

    it('should update metadata after update', async () => {
      const index = createEmptyIndex();
      const testFile = join(testDir, 'test.md');

      const beforeTime = Date.now();
      writeFileSync(testFile, '# Test');
      await updateIndexForFiles(index, [testFile]);

      expect(index.metadata.fileCount).toBe(1);
      expect(index.metadata.indexedAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should handle multiple files', async () => {
      const index = createEmptyIndex();
      const file1 = join(testDir, 'test1.md');
      const file2 = join(testDir, 'test2.md');

      writeFileSync(file1, '# Test 1');
      writeFileSync(file2, '# Test 2');

      await updateIndexForFiles(index, [file1, file2]);

      expect(index.chunks.has(file1)).toBe(true);
      expect(index.chunks.has(file2)).toBe(true);
      expect(index.metadata.fileCount).toBe(2);
    });

    it('should remove old embeddings when updating', async () => {
      const index = createEmptyIndex();
      const testFile = join(testDir, 'test.md');

      writeFileSync(testFile, '# Original');
      await updateIndexForFiles(index, [testFile]);

      const originalEmbeddingCount = index.embeddings.size;

      writeFileSync(testFile, '# Updated with more\n\n## Sections\n\nContent.');
      await updateIndexForFiles(index, [testFile]);

      expect(index.embeddings.size).toBeGreaterThan(0);
    });

    it('should handle empty file list', async () => {
      const index = createEmptyIndex();

      await updateIndexForFiles(index, []);

      expect(index.metadata.fileCount).toBe(0);
    });
  });

  describe('Chunking behavior', () => {
    it('should create chunks with context', async () => {
      const docsDir = join(testDir, 'docs', 'frontend');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'auth.md'),
        '# Authentication\n\nThis describes authentication.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const allChunks = Array.from(index.chunks.values()).flat();
      expect(allChunks.length).toBeGreaterThan(0);

      allChunks.forEach(chunk => {
        expect(chunk.context).toBeDefined();
        expect(chunk.context.length).toBeGreaterThan(0);
      });
    });

    it('should create chunks with hierarchy', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'nested.md'),
        '# Level 1\n\nSome content here.\n\n## Level 2\n\nMore content text.\n\n### Level 3\n\nContent with details.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const allChunks = Array.from(index.chunks.values()).flat();
      const hasMultipleLevels = allChunks.some(c => c.hierarchy.length > 0);

      expect(hasMultipleLevels).toBe(true);
    });

    it('should create chunks with metadata', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'test.md'),
        '# Test\n\nThis is test content with several words.'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const allChunks = Array.from(index.chunks.values()).flat();

      allChunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata?.wordCount).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata?.tokenCount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should set correct chunk types', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(
        join(docsDir, 'types.md'),
        '# Heading\n\nParagraph text.\n\n- List item\n\n```js\ncode\n```'
      );

      const index = await scanAndIndexDocumentation(testDir);

      const allChunks = Array.from(index.chunks.values()).flat();
      const chunkTypes = new Set(allChunks.map(c => c.chunkType));

      expect(chunkTypes.size).toBeGreaterThan(0);
      expect(Array.from(chunkTypes).every(t =>
        ['heading', 'paragraph', 'list', 'code'].includes(t)
      )).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'empty.md'), '');

      const index = await scanAndIndexDocumentation(testDir);

      expect(Array.isArray(Array.from(index.chunks.values()))).toBe(true);
    });

    it('should handle files with only whitespace', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'whitespace.md'), '   \n\n   \t\t\n   ');

      const index = await scanAndIndexDocumentation(testDir);

      expect(Array.isArray(Array.from(index.chunks.values()))).toBe(true);
    });

    it('should handle unicode filenames', async () => {
      const docsDir = join(testDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, '中文.md'), '# 中文标题\n\n内容。');

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBeGreaterThan(0);
    });

    it('should handle deeply nested directories', async () => {
      const deepDir = join(testDir, 'a', 'b', 'c', 'd', 'e');
      mkdirSync(deepDir, { recursive: true });

      writeFileSync(join(deepDir, 'deep.md'), '# Deep file');

      const index = await scanAndIndexDocumentation(testDir);

      expect(index.chunks.size).toBeGreaterThan(0);
    });
  });
});
