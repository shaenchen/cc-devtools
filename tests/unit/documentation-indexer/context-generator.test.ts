/**
 * Context generator tests for Documentation Indexer
 * Tests heuristic context generation logic
 */

import { describe, it, expect } from 'vitest';
import {
  generateContext,
  extractCategory,
  generateSearchableText
} from '../../../src/documentation-indexer/services/context-generator.js';
import type { DocChunk } from '../../../src/documentation-indexer/types.js';

describe('Context Generator', () => {
  describe('generateContext()', () => {
    it('should generate full context with category, hierarchy, and sentence', () => {
      const chunk: DocChunk = {
        id: 'test-1',
        file: 'docs/frontend/auth.md',
        startLine: 0,
        endLine: 5,
        content: '# Authentication\n\nThe frontend uses JWT tokens for secure authentication.',
        context: '',
        hierarchy: ['Authentication'],
        chunkType: 'heading',
        metadata: { wordCount: 10, tokenCount: 15 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('frontend');
      expect(context).toContain('Authentication');
      expect(context).toContain('frontend');
    });

    it('should handle chunks with nested hierarchy', () => {
      const chunk: DocChunk = {
        id: 'test-2',
        file: 'docs/api/users.md',
        startLine: 0,
        endLine: 5,
        content: 'Content about user endpoints.',
        context: '',
        hierarchy: ['API', 'Users', 'Endpoints'],
        chunkType: 'paragraph',
        metadata: { wordCount: 5, tokenCount: 7 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('API > Users > Endpoints');
    });

    it('should generate context without hierarchy', () => {
      const chunk: DocChunk = {
        id: 'test-3',
        file: 'docs/general/README.md',
        startLine: 0,
        endLine: 3,
        content: 'This is a general documentation file.',
        context: '',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 6, tokenCount: 8 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('general');
      expect(context).toContain('This is a general documentation file.');
      expect(context).not.toContain('>');
    });

    it('should generate context with hierarchy but no sentence', () => {
      const chunk: DocChunk = {
        id: 'test-4',
        file: 'docs/backend/setup.md',
        startLine: 0,
        endLine: 1,
        content: '## Setup',
        context: '',
        hierarchy: ['Installation', 'Setup'],
        chunkType: 'heading',
        metadata: { wordCount: 1, tokenCount: 2 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('backend > Installation > Setup');
      expect(context).not.toContain(':');
    });

    it('should truncate long first sentences to 80 characters', () => {
      const longSentence = 'a'.repeat(150);
      const chunk: DocChunk = {
        id: 'test-5',
        file: 'docs/test/long.md',
        startLine: 0,
        endLine: 1,
        content: longSentence,
        context: '',
        hierarchy: ['Title'],
        chunkType: 'paragraph',
        metadata: { wordCount: 1, tokenCount: 38 }
      };

      const context = generateContext(chunk);

      const sentencePart = context.split(': ')[1] ?? '';
      expect(sentencePart.length).toBeLessThanOrEqual(80);
    });

    it('should handle chunks with only category', () => {
      const chunk: DocChunk = {
        id: 'test-6',
        file: 'docs/misc/empty.md',
        startLine: 0,
        endLine: 0,
        content: '',
        context: '',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 0, tokenCount: 0 }
      };

      const context = generateContext(chunk);

      expect(context).toBe('misc');
    });

    it('should extract first sentence from content', () => {
      const chunk: DocChunk = {
        id: 'test-7',
        file: 'docs/guide/intro.md',
        startLine: 0,
        endLine: 5,
        content: 'This is the introduction. Here is more text that follows.',
        context: '',
        hierarchy: ['Guide', 'Introduction'],
        chunkType: 'paragraph',
        metadata: { wordCount: 11, tokenCount: 14 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('This is the introduction.');
      expect(context).not.toContain('Here is more text');
    });
  });

  describe('extractCategory()', () => {
    it('should extract category from docs/ directory', () => {
      const category = extractCategory('docs/frontend/components.md');
      expect(category).toBe('frontend');
    });

    it('should extract category from documentation/ directory', () => {
      const category = extractCategory('documentation/backend/api.md');
      expect(category).toBe('backend');
    });

    it('should extract category from doc/ directory', () => {
      const category = extractCategory('doc/guides/setup.md');
      expect(category).toBe('guides');
    });

    it('should extract category from guides/ directory', () => {
      const category = extractCategory('guides/tutorials/intro.md');
      expect(category).toBe('tutorials');
    });

    it('should extract category from wiki/ directory', () => {
      const category = extractCategory('wiki/development/workflow.md');
      expect(category).toBe('development');
    });

    it('should handle nested documentation paths', () => {
      const category = extractCategory('project/docs/api/endpoints.md');
      expect(category).toBe('api');
    });

    it('should be case insensitive for directory names', () => {
      const category = extractCategory('DOCS/Frontend/auth.md');
      expect(category).toBe('Frontend');
    });

    it('should fallback to second-to-last directory if no docs dir found', () => {
      const category = extractCategory('src/components/Button.md');
      expect(category).toBe('components');
    });

    it('should return "general" for root-level files', () => {
      const category = extractCategory('README.md');
      expect(category).toBe('general');
    });

    it('should return "general" for single directory', () => {
      const category = extractCategory('project/README.md');
      expect(category).toBe('project');
    });

    it('should skip file extensions when determining category', () => {
      const category = extractCategory('docs/setup.md/nested.md');
      expect(category).toBe('general');
    });

    it('should handle absolute paths', () => {
      const category = extractCategory('/home/user/project/docs/api/users.md');
      expect(category).toBe('api');
    });

    it('should handle Windows paths', () => {
      const category = extractCategory('C:\\Users\\project\\docs\\backend\\db.md');
      expect(category).toBe('general');
    });

    it('should handle paths with spaces', () => {
      const category = extractCategory('docs/user guides/authentication.md');
      expect(category).toBe('user guides');
    });

    it('should handle multiple docs directories', () => {
      const category = extractCategory('docs/inner/docs/api/test.md');
      expect(category).toBe('inner');
    });
  });

  describe('generateSearchableText()', () => {
    it('should combine context, hierarchy, and content', () => {
      const chunk: DocChunk = {
        id: 'test-1',
        file: 'docs/api/users.md',
        startLine: 0,
        endLine: 5,
        content: 'User authentication endpoints.',
        context: 'api > Users: User authentication',
        hierarchy: ['Users', 'Authentication'],
        chunkType: 'paragraph',
        metadata: { wordCount: 3, tokenCount: 5 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable).toContain('api');
      expect(searchable).toContain('users');
      expect(searchable).toContain('authentication');
      expect(searchable).toContain('endpoints');
    });

    it('should convert to lowercase', () => {
      const chunk: DocChunk = {
        id: 'test-2',
        file: 'test.md',
        startLine: 0,
        endLine: 1,
        content: 'UPPERCASE Content',
        context: 'Test CONTEXT',
        hierarchy: ['HIERARCHY'],
        chunkType: 'paragraph',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable).toBe(searchable.toLowerCase());
      expect(searchable).toContain('uppercase');
      expect(searchable).toContain('content');
    });

    it('should handle empty hierarchy', () => {
      const chunk: DocChunk = {
        id: 'test-3',
        file: 'test.md',
        startLine: 0,
        endLine: 1,
        content: 'Simple content',
        context: 'general: Simple content',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable).toContain('simple');
      expect(searchable).toContain('content');
    });

    it('should join all parts with spaces', () => {
      const chunk: DocChunk = {
        id: 'test-4',
        file: 'test.md',
        startLine: 0,
        endLine: 1,
        content: 'Content',
        context: 'Context',
        hierarchy: ['H1', 'H2'],
        chunkType: 'paragraph',
        metadata: { wordCount: 1, tokenCount: 2 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable.split(' ').length).toBeGreaterThan(3);
    });

    it('should handle special characters', () => {
      const chunk: DocChunk = {
        id: 'test-5',
        file: 'test.md',
        startLine: 0,
        endLine: 1,
        content: 'Content with @special #chars!',
        context: 'test',
        hierarchy: [],
        chunkType: 'paragraph',
        metadata: { wordCount: 4, tokenCount: 6 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable).toContain('@special');
      expect(searchable).toContain('#chars');
    });

    it('should preserve code snippets in searchable text', () => {
      const chunk: DocChunk = {
        id: 'test-6',
        file: 'test.md',
        startLine: 0,
        endLine: 3,
        content: 'Use `function()` to call the method.',
        context: 'api',
        hierarchy: ['API'],
        chunkType: 'paragraph',
        metadata: { wordCount: 6, tokenCount: 8 }
      };

      const searchable = generateSearchableText(chunk);

      expect(searchable).toContain('function()');
    });
  });

  describe('Edge cases', () => {
    it('should handle chunks with unicode characters', () => {
      const chunk: DocChunk = {
        id: 'test-1',
        file: 'docs/国际化/中文.md',
        startLine: 0,
        endLine: 1,
        content: '这是中文内容。',
        context: '',
        hierarchy: ['国际化'],
        chunkType: 'paragraph',
        metadata: { wordCount: 1, tokenCount: 7 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('国际化');
      expect(context.length).toBeGreaterThan(0);
    });

    it('should handle chunks with emojis', () => {
      const chunk: DocChunk = {
        id: 'test-2',
        file: 'docs/fun/emojis.md',
        startLine: 0,
        endLine: 1,
        content: '🎉 Celebrate with emojis! 🚀',
        context: '',
        hierarchy: ['Fun'],
        chunkType: 'paragraph',
        metadata: { wordCount: 4, tokenCount: 8 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('🎉');
    });

    it('should handle very deeply nested hierarchies', () => {
      const chunk: DocChunk = {
        id: 'test-3',
        file: 'docs/deep/path.md',
        startLine: 0,
        endLine: 1,
        content: 'Deep content.',
        context: '',
        hierarchy: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'],
        chunkType: 'paragraph',
        metadata: { wordCount: 2, tokenCount: 3 }
      };

      const context = generateContext(chunk);

      expect(context).toContain('L1 > L2 > L3 > L4 > L5 > L6');
    });

    it('should handle chunks with no metadata', () => {
      const chunk: DocChunk = {
        id: 'test-4',
        file: 'docs/test.md',
        startLine: 0,
        endLine: 1,
        content: 'Content',
        context: '',
        hierarchy: [],
        chunkType: 'paragraph'
      };

      const context = generateContext(chunk);

      expect(context.length).toBeGreaterThan(0);
    });
  });
});
