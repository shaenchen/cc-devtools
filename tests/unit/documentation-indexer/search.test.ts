/**
 * Search functionality tests for Documentation Indexer
 * Tests semantic, exact, and fuzzy search modes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchDocumentation } from '../../../src/documentation-indexer/services/search.js';
import { createEmptyIndex } from '../../../src/documentation-indexer/core/storage.js';
import type { DocIndex, DocChunk } from '../../../src/documentation-indexer/types.js';

// Mock the embeddings module
vi.mock('../../../src/shared/embeddings.js', () => ({
  generateEmbedding: vi.fn(async (text: string) => {
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const embedding = new Float32Array(4);
    embedding[0] = Math.sin(hash);
    embedding[1] = Math.cos(hash);
    embedding[2] = Math.sin(hash * 2);
    embedding[3] = Math.cos(hash * 2);
    return embedding;
  }),
  cosineSimilarity: vi.fn((a: Float32Array, b: Float32Array) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  })
}));

describe('Documentation Search', () => {
  let testIndex: DocIndex;

  beforeEach(() => {
    testIndex = createEmptyIndex();

    // Add test documentation chunks
    const authChunk: DocChunk = {
      id: 'auth-1',
      file: 'docs/frontend/auth.md',
      startLine: 0,
      endLine: 10,
      content: '# Authentication\n\nThe frontend uses JWT tokens for authentication.',
      context: 'frontend > Authentication: The frontend uses JWT tokens',
      hierarchy: ['Authentication'],
      chunkType: 'heading',
      metadata: { wordCount: 10, tokenCount: 15 }
    };

    const apiChunk: DocChunk = {
      id: 'api-1',
      file: 'docs/backend/api.md',
      startLine: 0,
      endLine: 15,
      content: '## User API\n\nEndpoints for managing users.',
      context: 'backend > API > User API: Endpoints for managing users',
      hierarchy: ['API', 'User API'],
      chunkType: 'heading',
      metadata: { wordCount: 8, tokenCount: 12 }
    };

    const setupChunk: DocChunk = {
      id: 'setup-1',
      file: 'docs/general/setup.md',
      startLine: 0,
      endLine: 20,
      content: '# Setup Guide\n\nFollow these steps to set up the project.',
      context: 'general > Setup Guide: Follow these steps',
      hierarchy: ['Setup Guide'],
      chunkType: 'heading',
      metadata: { wordCount: 12, tokenCount: 18 }
    };

    testIndex.chunks.set('docs/frontend/auth.md', [authChunk]);
    testIndex.chunks.set('docs/backend/api.md', [apiChunk]);
    testIndex.chunks.set('docs/general/setup.md', [setupChunk]);

    // Add mock embeddings
    testIndex.embeddings.set('auth-1', new Float32Array([0.1, 0.2, 0.3, 0.4]));
    testIndex.embeddings.set('api-1', new Float32Array([0.5, 0.6, 0.7, 0.8]));
    testIndex.embeddings.set('setup-1', new Float32Array([0.9, 0.1, 0.2, 0.3]));
  });

  describe('Exact search mode', () => {
    it('should find exact keyword match in context', async () => {
      const results = await searchDocumentation(testIndex, 'authentication', 'exact');

      expect(results.length).toBeGreaterThan(0);
      const authResult = results.find((r) => r.id === 'auth-1');
      expect(authResult).toBeDefined();
      expect(authResult?.match_reason).toContain('context match');
    });

    it('should find match in hierarchy', async () => {
      const results = await searchDocumentation(testIndex, 'User API', 'exact');

      expect(results.length).toBeGreaterThan(0);
      const apiResult = results.find((r) => r.id === 'api-1');
      expect(apiResult).toBeDefined();
    });

    it('should find partial keyword match', async () => {
      const results = await searchDocumentation(testIndex, 'auth', 'exact');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'auth-1')).toBe(true);
    });

    it('should be case insensitive', async () => {
      const results = await searchDocumentation(testIndex, 'AUTHENTICATION', 'exact');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'auth-1')).toBe(true);
    });

    it('should return empty array when no match', async () => {
      const results = await searchDocumentation(testIndex, 'nonexistent', 'exact');

      expect(results).toEqual([]);
    });

    it('should rank context matches higher than content matches', async () => {
      const results = await searchDocumentation(testIndex, 'frontend', 'exact');

      expect(results.length).toBeGreaterThan(0);
      if (results.length > 1 && results[0]?.match_reason === 'context match') {
        expect(results[0].score).toBeGreaterThan(results[1]?.score ?? 0);
      }
    });
  });

  describe('Fuzzy search mode', () => {
    it('should find fuzzy matches with typos', async () => {
      const results = await searchDocumentation(testIndex, 'authenticaton', 'fuzzy');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should find close matches', async () => {
      const results = await searchDocumentation(testIndex, 'usr', 'fuzzy');

      const hasUserMatch = results.some((r) => r.hierarchy.some((h) => h.toLowerCase().includes('user')));
      expect(hasUserMatch).toBe(true);
    });

    it('should have match reason "fuzzy match"', async () => {
      const results = await searchDocumentation(testIndex, 'authen', 'fuzzy');

      if (results.length > 0) {
        expect(results[0]?.match_reason).toBe('fuzzy match');
      }
    });

    it('should filter out poor fuzzy matches', async () => {
      const results = await searchDocumentation(testIndex, 'xyz', 'fuzzy');

      results.forEach((r) => {
        expect(r.score).toBeGreaterThan(0.6);
      });
    });
  });

  describe('Semantic search mode', () => {
    it('should combine semantic and keyword results', async () => {
      const results = await searchDocumentation(testIndex, 'auth', 'semantic');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should boost scores when both keyword and semantic match', async () => {
      const results = await searchDocumentation(testIndex, 'authentication', 'semantic');

      const authResult = results.find((r) => r.id === 'auth-1');
      if (authResult?.match_reason.includes('+')) {
        expect(authResult.score).toBeGreaterThan(0.5);
      }
    });

    it('should work with empty query', async () => {
      const results = await searchDocumentation(testIndex, '', 'semantic');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return semantic matches even without keyword match', async () => {
      const results = await searchDocumentation(testIndex, 'login', 'semantic');

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Filters', () => {
    it('should filter by file pattern', async () => {
      const results = await searchDocumentation(
        testIndex,
        'auth',
        'exact',
        { filePattern: 'docs/frontend/**' },
        10
      );

      results.forEach((r) => {
        expect(r.file).toContain('frontend');
      });
    });

    it('should filter by category', async () => {
      const results = await searchDocumentation(testIndex, 'guide', 'exact', { category: ['general'] }, 10);

      results.forEach((r) => {
        expect(r.context.toLowerCase()).toContain('general');
      });
    });

    it('should combine multiple filters', async () => {
      const results = await searchDocumentation(
        testIndex,
        'api',
        'exact',
        {
          filePattern: 'docs/backend/**',
          category: ['backend']
        },
        10
      );

      results.forEach((r) => {
        expect(r.file).toContain('backend');
      });
    });

    it('should return empty when filters exclude all results', async () => {
      const results = await searchDocumentation(
        testIndex,
        'authentication',
        'exact',
        { filePattern: 'docs/backend/**' },
        10
      );

      expect(results).toEqual([]);
    });
  });

  describe('Limit parameter', () => {
    it('should respect limit', async () => {
      const results = await searchDocumentation(testIndex, 'a', 'exact', undefined, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should default to 10', async () => {
      const manyChunks: DocChunk[] = [];
      for (let i = 0; i < 20; i++) {
        manyChunks.push({
          id: `test-${i}`,
          file: 'test.md',
          startLine: i,
          endLine: i + 1,
          content: `Test content ${i}`,
          context: `general: Test content ${i}`,
          hierarchy: [],
          chunkType: 'paragraph',
          metadata: { wordCount: 3, tokenCount: 5 }
        });
      }
      testIndex.chunks.set('test.md', manyChunks);

      const results = await searchDocumentation(testIndex, 'test', 'exact');

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle limit of 0', async () => {
      const results = await searchDocumentation(testIndex, 'auth', 'exact', undefined, 0);

      expect(results).toEqual([]);
    });

    it('should handle limit larger than results', async () => {
      const results = await searchDocumentation(testIndex, 'authentication', 'exact', undefined, 100);

      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Scoring and ranking', () => {
    it('should include score in results', async () => {
      const results = await searchDocumentation(testIndex, 'auth', 'exact');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.score).toBeGreaterThan(0);
        expect(typeof r.score).toBe('number');
      });
    });

    it('should include match reason', async () => {
      const results = await searchDocumentation(testIndex, 'auth', 'exact');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.match_reason).toBeDefined();
        expect(typeof r.match_reason).toBe('string');
      });
    });

    it('should sort by score descending', async () => {
      const results = await searchDocumentation(testIndex, 'a', 'exact');

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1]?.score ?? 0).toBeGreaterThanOrEqual(results[i]?.score ?? 0);
        }
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty index', async () => {
      const emptyIndex = createEmptyIndex();
      const results = await searchDocumentation(emptyIndex, 'test', 'exact');

      expect(results).toEqual([]);
    });

    it('should handle special characters in query', async () => {
      const results = await searchDocumentation(testIndex, 'user@api.com', 'exact');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long query', async () => {
      const longQuery = 'a'.repeat(1000);
      const results = await searchDocumentation(testIndex, longQuery, 'exact');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle unicode in query', async () => {
      const results = await searchDocumentation(testIndex, '🔍', 'exact');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should preserve all chunk fields in results', async () => {
      const results = await searchDocumentation(testIndex, 'authentication', 'exact');

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];

      expect(result?.id).toBeDefined();
      expect(result?.file).toBeDefined();
      expect(result?.startLine).toBeGreaterThanOrEqual(0);
      expect(result?.endLine).toBeGreaterThanOrEqual(0);
      expect(result?.content).toBeDefined();
      expect(result?.context).toBeDefined();
      expect(Array.isArray(result?.hierarchy)).toBe(true);
      expect(result?.chunkType).toBeDefined();
      expect(result?.score).toBeGreaterThan(0);
      expect(result?.match_reason).toBeDefined();
    });

    it('should handle chunks with empty context', async () => {
      const emptyContextChunk: DocChunk = {
        id: 'empty-1',
        file: 'test.md',
        startLine: 0,
        endLine: 1,
        content: 'Content without context',
        context: '',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 3, tokenCount: 5 }
      };

      testIndex.chunks.set('test.md', [emptyContextChunk]);

      const results = await searchDocumentation(testIndex, 'content', 'exact');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle chunks with empty hierarchy', async () => {
      const results = await searchDocumentation(testIndex, 'setup', 'exact');

      const setupResult = results.find((r) => r.id === 'setup-1');
      expect(setupResult).toBeDefined();
    });

    it('should handle multiple chunks in same file', async () => {
      const chunk1: DocChunk = {
        id: 'multi-1',
        file: 'docs/multi.md',
        startLine: 0,
        endLine: 5,
        content: 'First chunk',
        context: 'multi > First',
        hierarchy: ['First'],
        chunkType: 'heading',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      const chunk2: DocChunk = {
        id: 'multi-2',
        file: 'docs/multi.md',
        startLine: 6,
        endLine: 10,
        content: 'Second chunk',
        context: 'multi > Second',
        hierarchy: ['Second'],
        chunkType: 'heading',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      testIndex.chunks.set('docs/multi.md', [chunk1, chunk2]);

      const results = await searchDocumentation(testIndex, 'chunk', 'exact');

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
