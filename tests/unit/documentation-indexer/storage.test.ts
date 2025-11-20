/**
 * Storage tests for Documentation Indexer
 * Tests MessagePack serialization and file I/O
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { saveIndex, loadIndex, createEmptyIndex } from '../../../src/documentation-indexer/core/storage.js';
import type { DocIndex, DocChunk } from '../../../src/documentation-indexer/types.js';

describe('Documentation Indexer Storage', () => {
  let testDir: string;
  let indexPath: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(originalCwd, '.test-doc-index-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    indexPath = join(testDir, 'test-index.msgpack');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  describe('createEmptyIndex()', () => {
    it('should create index with empty maps', () => {
      const index = createEmptyIndex();

      expect(index.chunks.size).toBe(0);
      expect(index.embeddings.size).toBe(0);
    });

    it('should create index with metadata', () => {
      const index = createEmptyIndex();

      expect(index.metadata.version).toBeDefined();
      expect(index.metadata.indexedAt).toBeGreaterThan(0);
      expect(index.metadata.fileCount).toBe(0);
      expect(index.metadata.chunkCount).toBe(0);
    });

    it('should set indexedAt to current time', () => {
      const before = Date.now();
      const index = createEmptyIndex();
      const after = Date.now();

      expect(index.metadata.indexedAt).toBeGreaterThanOrEqual(before);
      expect(index.metadata.indexedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('saveIndex()', () => {
    it('should save index to file', async () => {
      const index = createEmptyIndex();

      await saveIndex(index, indexPath);

      expect(existsSync(indexPath)).toBe(true);
    });

    it('should save chunks correctly', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'test-1',
        file: 'docs/test.md',
        startLine: 0,
        endLine: 5,
        content: '# Test\n\nTest content.',
        context: 'test > Test: Test content',
        hierarchy: ['Test'],
        chunkType: 'heading',
        metadata: { wordCount: 3, tokenCount: 5 }
      };

      index.chunks.set('docs/test.md', [chunk]);
      index.metadata.fileCount = 1;
      index.metadata.chunkCount = 1;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded).not.toBeNull();
      expect(loaded?.chunks.size).toBe(1);
      expect(loaded?.chunks.get('docs/test.md')).toHaveLength(1);
      expect(loaded?.chunks.get('docs/test.md')?.[0]?.id).toBe('test-1');
    });

    it('should save embeddings correctly', async () => {
      const index = createEmptyIndex();
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);

      index.embeddings.set('chunk-1', embedding);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.embeddings.size).toBe(1);
      expect(loaded?.embeddings.get('chunk-1')).toEqual(embedding);
    });

    it('should save metadata correctly', async () => {
      const index = createEmptyIndex();
      index.metadata.fileCount = 10;
      index.metadata.chunkCount = 25;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.metadata.fileCount).toBe(10);
      expect(loaded?.metadata.chunkCount).toBe(25);
      expect(loaded?.metadata.version).toBe(index.metadata.version);
      expect(loaded?.metadata.indexedAt).toBe(index.metadata.indexedAt);
    });

    it('should overwrite existing file', async () => {
      const index1 = createEmptyIndex();
      index1.metadata.chunkCount = 5;

      const index2 = createEmptyIndex();
      index2.metadata.chunkCount = 10;

      await saveIndex(index1, indexPath);
      await saveIndex(index2, indexPath);

      const loaded = await loadIndex(indexPath);

      expect(loaded?.metadata.chunkCount).toBe(10);
    });

    it('should handle empty index', async () => {
      const index = createEmptyIndex();

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.chunks.size).toBe(0);
      expect(loaded?.embeddings.size).toBe(0);
    });
  });

  describe('loadIndex()', () => {
    it('should return null if file does not exist', async () => {
      const loaded = await loadIndex(join(testDir, 'nonexistent.msgpack'));

      expect(loaded).toBeNull();
    });

    it('should load saved index', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'load-1',
        file: 'docs/load.md',
        startLine: 0,
        endLine: 3,
        content: 'Content',
        context: 'test: Content',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 1, tokenCount: 2 }
      };

      index.chunks.set('docs/load.md', [chunk]);
      index.metadata.fileCount = 1;
      index.metadata.chunkCount = 1;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded).not.toBeNull();
      expect(loaded?.chunks.size).toBe(1);
      expect(loaded?.metadata.fileCount).toBe(1);
    });

    it('should preserve chunk properties', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'preserve-1',
        file: 'docs/preserve.md',
        startLine: 10,
        endLine: 20,
        content: '# Heading\n\nParagraph content.',
        context: 'test > Heading: Paragraph content',
        hierarchy: ['Heading', 'Subheading'],
        chunkType: 'heading',
        metadata: { wordCount: 5, tokenCount: 8 }
      };

      index.chunks.set('docs/preserve.md', [chunk]);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedChunk = loaded?.chunks.get('docs/preserve.md')?.[0];

      expect(loadedChunk?.id).toBe('preserve-1');
      expect(loadedChunk?.file).toBe('docs/preserve.md');
      expect(loadedChunk?.startLine).toBe(10);
      expect(loadedChunk?.endLine).toBe(20);
      expect(loadedChunk?.content).toBe('# Heading\n\nParagraph content.');
      expect(loadedChunk?.context).toBe('test > Heading: Paragraph content');
      expect(loadedChunk?.hierarchy).toEqual(['Heading', 'Subheading']);
      expect(loadedChunk?.chunkType).toBe('heading');
      expect(loadedChunk?.metadata?.wordCount).toBe(5);
      expect(loadedChunk?.metadata?.tokenCount).toBe(8);
    });

    it('should convert embeddings back to Float32Array', async () => {
      const index = createEmptyIndex();
      const embedding = new Float32Array([0.5, 0.6, 0.7]);

      index.embeddings.set('embed-1', embedding);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedEmbedding = loaded?.embeddings.get('embed-1');

      expect(loadedEmbedding).toBeInstanceOf(Float32Array);
      expect(loadedEmbedding).toEqual(embedding);
    });

    it('should handle multiple chunks in same file', async () => {
      const index = createEmptyIndex();
      const chunks: DocChunk[] = [
        {
          id: 'multi-1',
          file: 'docs/multi.md',
          startLine: 0,
          endLine: 5,
          content: 'First',
          context: 'test: First',
          hierarchy: [],
          chunkType: 'paragraph',
          metadata: { wordCount: 1, tokenCount: 2 }
        },
        {
          id: 'multi-2',
          file: 'docs/multi.md',
          startLine: 6,
          endLine: 10,
          content: 'Second',
          context: 'test: Second',
          hierarchy: [],
          chunkType: 'paragraph',
          metadata: { wordCount: 1, tokenCount: 2 }
        }
      ];

      index.chunks.set('docs/multi.md', chunks);
      index.metadata.chunkCount = 2;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.chunks.get('docs/multi.md')).toHaveLength(2);
      expect(loaded?.chunks.get('docs/multi.md')?.[0]?.id).toBe('multi-1');
      expect(loaded?.chunks.get('docs/multi.md')?.[1]?.id).toBe('multi-2');
    });

    it('should handle corrupted file gracefully', async () => {
      const fs = require('fs');
      fs.writeFileSync(indexPath, 'corrupted data');

      const loaded = await loadIndex(indexPath);

      expect(loaded).toBeNull();
    });

    it('should return null for wrong version', async () => {
      const fs = require('fs');
      const { pack } = require('msgpackr');

      const wrongVersion = {
        version: '999.0.0',
        indexedAt: Date.now(),
        fileCount: 0,
        chunkCount: 0,
        chunks: [],
        embeddings: []
      };

      fs.writeFileSync(indexPath, pack(wrongVersion));

      const loaded = await loadIndex(indexPath);

      expect(loaded).toBeNull();
    });
  });

  describe('Round-trip integrity', () => {
    it('should preserve index through save/load cycle', async () => {
      const index = createEmptyIndex();

      const chunk1: DocChunk = {
        id: 'round-1',
        file: 'docs/round.md',
        startLine: 0,
        endLine: 10,
        content: '# Title\n\nContent here.',
        context: 'test > Title: Content here',
        hierarchy: ['Title'],
        chunkType: 'heading',
        metadata: { wordCount: 5, tokenCount: 8 }
      };

      const chunk2: DocChunk = {
        id: 'round-2',
        file: 'docs/other.md',
        startLine: 0,
        endLine: 5,
        content: 'Plain text.',
        context: 'other: Plain text',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      index.chunks.set('docs/round.md', [chunk1]);
      index.chunks.set('docs/other.md', [chunk2]);
      index.embeddings.set('round-1', new Float32Array([0.1, 0.2]));
      index.embeddings.set('round-2', new Float32Array([0.3, 0.4]));
      index.metadata.fileCount = 2;
      index.metadata.chunkCount = 2;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.chunks.size).toBe(2);
      expect(loaded?.embeddings.size).toBe(2);
      expect(loaded?.metadata.fileCount).toBe(2);
      expect(loaded?.metadata.chunkCount).toBe(2);
    });

    it('should handle large embeddings', async () => {
      const index = createEmptyIndex();
      const largeEmbedding = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        largeEmbedding[i] = i / 384;
      }

      index.embeddings.set('large-1', largeEmbedding);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedEmbedding = loaded?.embeddings.get('large-1');

      expect(loadedEmbedding?.length).toBe(384);
      expect(loadedEmbedding).toEqual(largeEmbedding);
    });

    it('should handle unicode content', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'unicode-1',
        file: 'docs/国际化.md',
        startLine: 0,
        endLine: 3,
        content: '# 中文标题\n\n这是中文内容。',
        context: 'test: 中文',
        hierarchy: ['中文标题'],
        chunkType: 'heading',
        metadata: { wordCount: 1, tokenCount: 8 }
      };

      index.chunks.set('docs/国际化.md', [chunk]);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedChunk = loaded?.chunks.get('docs/国际化.md')?.[0];

      expect(loadedChunk?.content).toContain('中文');
      expect(loadedChunk?.hierarchy).toEqual(['中文标题']);
    });

    it('should handle special characters in content', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'special-1',
        file: 'docs/special.md',
        startLine: 0,
        endLine: 3,
        content: 'Content with "quotes" and \'apostrophes\' and\nnewlines',
        context: 'test',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 6, tokenCount: 10 }
      };

      index.chunks.set('docs/special.md', [chunk]);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedChunk = loaded?.chunks.get('docs/special.md')?.[0];

      expect(loadedChunk?.content).toBe(chunk.content);
    });

    it('should handle chunks without metadata', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'no-meta-1',
        file: 'docs/no-meta.md',
        startLine: 0,
        endLine: 1,
        content: 'Content',
        context: 'test',
        hierarchy: [],
        chunkType: 'paragraph'
      };

      index.chunks.set('docs/no-meta.md', [chunk]);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      const loadedChunk = loaded?.chunks.get('docs/no-meta.md')?.[0];

      expect(loadedChunk).toBeDefined();
      expect(loadedChunk?.id).toBe('no-meta-1');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large index', async () => {
      const index = createEmptyIndex();

      for (let i = 0; i < 100; i++) {
        const chunk: DocChunk = {
          id: `chunk-${i}`,
          file: `docs/file-${i}.md`,
          startLine: 0,
          endLine: 10,
          content: `Content ${i}`,
          context: `test: Content ${i}`,
          hierarchy: [],
          chunkType: 'paragraph',
          metadata: { wordCount: 2, tokenCount: 3 }
        };

        index.chunks.set(`docs/file-${i}.md`, [chunk]);
        index.embeddings.set(`chunk-${i}`, new Float32Array([i / 100, (i + 1) / 100]));
      }

      index.metadata.fileCount = 100;
      index.metadata.chunkCount = 100;

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.chunks.size).toBe(100);
      expect(loaded?.embeddings.size).toBe(100);
    });

    it('should handle empty file path in chunks', async () => {
      const index = createEmptyIndex();
      const chunk: DocChunk = {
        id: 'empty-path-1',
        file: '',
        startLine: 0,
        endLine: 1,
        content: 'Content',
        context: 'test',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 1, tokenCount: 2 }
      };

      index.chunks.set('', [chunk]);

      await saveIndex(index, indexPath);
      const loaded = await loadIndex(indexPath);

      expect(loaded?.chunks.get('')).toBeDefined();
    });
  });
});
