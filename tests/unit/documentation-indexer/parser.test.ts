/**
 * Parser service tests for Documentation Indexer
 * Tests markdown, RST, AsciiDoc, and plain text parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  parseRST,
  parseAsciiDoc,
  parsePlainText,
  extractFirstSentence,
  estimateTokenCount,
  countWords,
  mergeSmallChunks,
  splitLargeChunks
} from '../../../src/documentation-indexer/services/parser.js';

describe('Documentation Parser', () => {
  describe('parseMarkdown()', () => {
    it('should parse simple markdown with headings', () => {
      const content = `# Title

This is the first paragraph.

## Section 1

Content under section 1.

### Subsection

Nested content.`;

      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.headings).toEqual(['Title']);
      expect(chunks[1]?.headings).toEqual(['Title', 'Section 1']);
      expect(chunks[2]?.headings).toEqual(['Title', 'Section 1', 'Subsection']);
    });

    it('should extract content correctly', () => {
      const content = `# Heading

Paragraph content here.`;

      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks[0]?.content).toContain('# Heading');
      if (chunks.length > 1) {
        expect(chunks[1]?.content).toContain('Paragraph content here');
      } else {
        expect(chunks[0]?.content).toContain('Paragraph content here');
      }
    });

    it('should handle empty content', () => {
      const chunks = parseMarkdown('', 'test.md');
      expect(chunks).toEqual([]);
    });

    it('should handle content without headings', () => {
      const content = 'Just plain text without any headings.';
      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.headings).toEqual([]);
    });

    it('should maintain heading hierarchy', () => {
      const content = `# H1

Content

## H2

More content

# Another H1

Back to top level`;

      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks[0]?.headings).toEqual(['H1']);
      const h2Chunk = chunks.find(c => c.headings.includes('H2'));
      expect(h2Chunk?.headings).toEqual(['H1', 'H2']);
      const anotherH1Chunk = chunks.find(c => c.headings.includes('Another H1'));
      expect(anotherH1Chunk?.headings).toEqual(['Another H1']);
    });

    it('should track line numbers correctly', () => {
      const content = `# Title
Line 2
Line 3
## Section
Line 5`;

      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks[0]?.startLine).toBe(0);
      expect(chunks[0]?.endLine).toBe(2);
      expect(chunks[1]?.startLine).toBe(3);
    });

    it('should detect chunk types', () => {
      const content = `# Heading

Normal paragraph.

- List item 1
- List item 2

\`\`\`javascript
code block
\`\`\``;

      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.chunkType).toBe('heading');
      const chunkTypes = new Set(chunks.map(c => c.chunkType));
      expect(chunkTypes.size).toBeGreaterThan(0);
    });
  });

  describe('parseRST()', () => {
    it('should parse RST with underline headings', () => {
      const content = `Title
=====

This is content under title.

Section
-------

Section content.`;

      const chunks = parseRST(content, 'test.rst');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.headings).toEqual(['Title']);
      const sectionChunk = chunks.find(c => c.headings.includes('Section'));
      expect(sectionChunk?.headings).toEqual(['Title', 'Section']);
    });

    it('should handle overline+underline style', () => {
      const content = `=====
Title
=====

Content here.

Section
-------

More content.`;

      const chunks = parseRST(content, 'test.rst');

      expect(chunks.length).toBeGreaterThan(0);
      const titleChunk = chunks.find(c => c.headings.includes('Title'));
      expect(titleChunk).toBeDefined();
    });

    it('should track heading hierarchy based on character type', () => {
      const content = `Main Title
==========

Content

Section
-------

Section content

Subsection
~~~~~~~~~~

Subsection content`;

      const chunks = parseRST(content, 'test.rst');

      const mainChunk = chunks.find(c => c.headings.includes('Main Title'));
      expect(mainChunk).toBeDefined();
      const sectionChunk = chunks.find(c => c.headings.includes('Section'));
      expect(sectionChunk?.headings).toEqual(['Main Title', 'Section']);
      const subsectionChunk = chunks.find(c => c.headings.includes('Subsection'));
      expect(subsectionChunk?.headings).toEqual(['Main Title', 'Section', 'Subsection']);
    });

    it('should handle empty content', () => {
      const chunks = parseRST('', 'test.rst');
      expect(chunks).toEqual([]);
    });

    it('should handle content without headings', () => {
      const content = 'Just plain text without any headings.';
      const chunks = parseRST(content, 'test.rst');

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.headings).toEqual([]);
    });
  });

  describe('parseAsciiDoc()', () => {
    it('should parse AsciiDoc headings', () => {
      const content = `= Document Title

This is content.

== Section 1

Section content.

=== Subsection

Nested content.`;

      const chunks = parseAsciiDoc(content, 'test.adoc');

      expect(chunks.length).toBeGreaterThan(0);
      const docChunk = chunks.find(c => c.headings.includes('Document Title'));
      expect(docChunk).toBeDefined();
      const sectionChunk = chunks.find(c => c.headings.includes('Section 1'));
      expect(sectionChunk?.headings).toEqual(['Document Title', 'Section 1']);
      const subsectionChunk = chunks.find(c => c.headings.includes('Subsection'));
      expect(subsectionChunk?.headings).toEqual(['Document Title', 'Section 1', 'Subsection']);
    });

    it('should maintain heading hierarchy', () => {
      const content = `= Top

Content

== Level 2

More

= Another Top

Back to top`;

      const chunks = parseAsciiDoc(content, 'test.adoc');

      const topChunk = chunks.find(c => c.headings.includes('Top') && c.headings.length === 1);
      expect(topChunk).toBeDefined();
      const level2Chunk = chunks.find(c => c.headings.includes('Level 2'));
      expect(level2Chunk?.headings).toEqual(['Top', 'Level 2']);
      const anotherTopChunk = chunks.find(c => c.headings.includes('Another Top'));
      expect(anotherTopChunk?.headings).toEqual(['Another Top']);
    });

    it('should handle empty content', () => {
      const chunks = parseAsciiDoc('', 'test.adoc');
      expect(chunks).toEqual([]);
    });

    it('should handle content without headings', () => {
      const content = 'Just plain text without any headings.';
      const chunks = parseAsciiDoc(content, 'test.adoc');

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.headings).toEqual([]);
    });
  });

  describe('parsePlainText()', () => {
    it('should split text by paragraphs', () => {
      const content = `First paragraph.

Second paragraph.

Third paragraph.`;

      const chunks = parsePlainText(content, 'test.txt');

      expect(chunks.length).toBe(3);
      expect(chunks[0]?.content).toBe('First paragraph.');
      expect(chunks[1]?.content).toBe('Second paragraph.');
      expect(chunks[2]?.content).toBe('Third paragraph.');
    });

    it('should handle single paragraph', () => {
      const content = 'Single paragraph of text.';
      const chunks = parsePlainText(content, 'test.txt');

      expect(chunks.length).toBe(1);
      expect(chunks[0]?.content).toBe(content);
    });

    it('should track line numbers', () => {
      const content = `Line 1

Line 3
Line 4

Line 6`;

      const chunks = parsePlainText(content, 'test.txt');

      expect(chunks[0]?.startLine).toBe(0);
      expect(chunks[1]?.startLine).toBeGreaterThan(chunks[0].endLine);
    });

    it('should handle empty content', () => {
      const chunks = parsePlainText('', 'test.txt');
      expect(chunks).toEqual([]);
    });

    it('should skip empty paragraphs', () => {
      const content = `Paragraph 1.


Paragraph 2.`;

      const chunks = parsePlainText(content, 'test.txt');

      expect(chunks.length).toBe(2);
    });

    it('should have empty headings array', () => {
      const content = 'Plain text paragraph.';
      const chunks = parsePlainText(content, 'test.txt');

      expect(chunks[0]?.headings).toEqual([]);
    });
  });

  describe('extractFirstSentence()', () => {
    it('should extract first sentence ending with period', () => {
      const text = 'This is the first sentence. This is the second.';
      const result = extractFirstSentence(text);

      expect(result).toBe('This is the first sentence.');
    });

    it('should extract sentence ending with exclamation', () => {
      const text = 'Amazing feature! More text here.';
      const result = extractFirstSentence(text);

      expect(result).toBe('Amazing feature!');
    });

    it('should extract sentence ending with question mark', () => {
      const text = 'How does it work? Let me explain.';
      const result = extractFirstSentence(text);

      expect(result).toBe('How does it work?');
    });

    it('should remove headings before extraction', () => {
      const text = '## Title\n\nThis is the content.';
      const result = extractFirstSentence(text);

      expect(result).toBe('This is the content.');
    });

    it('should remove code blocks', () => {
      const text = 'Before text. ```js\ncode\n```\nAfter code.';
      const result = extractFirstSentence(text);

      expect(result).toBe('Before text.');
    });

    it('should remove inline code', () => {
      const text = 'The `function()` does something. More text.';
      const result = extractFirstSentence(text);

      expect(result).toContain('does something.');
    });

    it('should remove list markers', () => {
      const text = '- First item\n- Second item';
      const result = extractFirstSentence(text);

      expect(result).not.toContain('-');
    });

    it('should fallback to first line if no sentence', () => {
      const text = 'No sentence ending here';
      const result = extractFirstSentence(text);

      expect(result).toBe('No sentence ending here');
    });

    it('should limit fallback to 100 characters', () => {
      const longText = 'a'.repeat(200);
      const result = extractFirstSentence(longText);

      expect(result.length).toBe(100);
    });

    it('should handle empty content', () => {
      const result = extractFirstSentence('');
      expect(result).toBe('');
    });
  });

  describe('estimateTokenCount()', () => {
    it('should estimate tokens roughly as 4 chars per token', () => {
      const text = 'abcd efgh';
      const count = estimateTokenCount(text);

      expect(count).toBe(Math.ceil(text.length / 4));
    });

    it('should round up for partial tokens', () => {
      const text = 'abc';
      const count = estimateTokenCount(text);

      expect(count).toBe(1);
    });

    it('should handle empty string', () => {
      const count = estimateTokenCount('');
      expect(count).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const count = estimateTokenCount(text);

      expect(count).toBe(250);
    });
  });

  describe('countWords()', () => {
    it('should count words separated by spaces', () => {
      const text = 'one two three four';
      const count = countWords(text);

      expect(count).toBe(4);
    });

    it('should handle multiple spaces', () => {
      const text = 'one  two   three';
      const count = countWords(text);

      expect(count).toBe(3);
    });

    it('should handle newlines', () => {
      const text = 'one\ntwo\nthree';
      const count = countWords(text);

      expect(count).toBe(3);
    });

    it('should handle empty string', () => {
      const count = countWords('');
      expect(count).toBe(0);
    });

    it('should handle whitespace only', () => {
      const count = countWords('   \n  \t  ');
      expect(count).toBe(0);
    });
  });

  describe('mergeSmallChunks()', () => {
    it('should merge chunks smaller than min tokens', () => {
      const chunks = [
        {
          headings: ['A'],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: 'Small',
          startLine: 0,
          endLine: 0
        },
        {
          headings: ['B'],
          firstSentence: 'Second.',
          chunkType: 'paragraph' as const,
          content: 'Also small',
          startLine: 1,
          endLine: 1
        }
      ];

      const merged = mergeSmallChunks(chunks, 100);

      expect(merged.length).toBe(1);
      expect(merged[0]?.content).toContain('Small');
      expect(merged[0]?.content).toContain('Also small');
    });

    it('should keep large chunks separate', () => {
      const largeContent = 'a'.repeat(500);
      const chunks = [
        {
          headings: [],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: largeContent,
          startLine: 0,
          endLine: 0
        },
        {
          headings: [],
          firstSentence: 'Second.',
          chunkType: 'paragraph' as const,
          content: largeContent,
          startLine: 1,
          endLine: 1
        }
      ];

      const merged = mergeSmallChunks(chunks, 100);

      expect(merged.length).toBe(2);
    });

    it('should update endLine when merging', () => {
      const chunks = [
        {
          headings: [],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: 'Small',
          startLine: 0,
          endLine: 5
        },
        {
          headings: [],
          firstSentence: 'Second.',
          chunkType: 'paragraph' as const,
          content: 'Also',
          startLine: 6,
          endLine: 10
        }
      ];

      const merged = mergeSmallChunks(chunks, 100);

      expect(merged[0]?.startLine).toBe(0);
      expect(merged[0]?.endLine).toBe(10);
    });

    it('should handle empty array', () => {
      const merged = mergeSmallChunks([], 100);
      expect(merged).toEqual([]);
    });

    it('should preserve first sentence from first chunk', () => {
      const chunks = [
        {
          headings: [],
          firstSentence: 'Keep this.',
          chunkType: 'paragraph' as const,
          content: 'Small',
          startLine: 0,
          endLine: 0
        },
        {
          headings: [],
          firstSentence: 'Discard this.',
          chunkType: 'paragraph' as const,
          content: 'Also',
          startLine: 1,
          endLine: 1
        }
      ];

      const merged = mergeSmallChunks(chunks, 100);

      expect(merged[0]?.firstSentence).toBe('Keep this.');
    });
  });

  describe('splitLargeChunks()', () => {
    it('should split chunks larger than max tokens', () => {
      const largeContent = 'a'.repeat(200) + '\n\n' + 'b'.repeat(200) + '\n\n' + 'c'.repeat(200);
      const chunks = [
        {
          headings: ['Title'],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: largeContent,
          startLine: 0,
          endLine: 0
        }
      ];

      const split = splitLargeChunks(chunks, 100);

      expect(split.length).toBeGreaterThan(1);
    });

    it('should keep small chunks intact', () => {
      const chunks = [
        {
          headings: [],
          firstSentence: 'Small.',
          chunkType: 'paragraph' as const,
          content: 'Small content',
          startLine: 0,
          endLine: 0
        }
      ];

      const split = splitLargeChunks(chunks, 100);

      expect(split.length).toBe(1);
      expect(split[0]?.content).toBe('Small content');
    });

    it('should split at paragraph boundaries', () => {
      const chunks = [
        {
          headings: [],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: `${'a'.repeat(200)}\n\n${'b'.repeat(200)}\n\n${'c'.repeat(200)}`,
          startLine: 0,
          endLine: 10
        }
      ];

      const split = splitLargeChunks(chunks, 100);

      expect(split.length).toBeGreaterThan(1);
      split.forEach(chunk => {
        const tokens = estimateTokenCount(chunk.content);
        expect(tokens).toBeLessThanOrEqual(300);
      });
    });

    it('should preserve headings in split chunks', () => {
      const chunks = [
        {
          headings: ['Main', 'Sub'],
          firstSentence: 'First.',
          chunkType: 'heading' as const,
          content: `${'a'.repeat(200)}\n\n${'b'.repeat(200)}`,
          startLine: 0,
          endLine: 5
        }
      ];

      const split = splitLargeChunks(chunks, 100);

      split.forEach(chunk => {
        expect(chunk.headings).toEqual(['Main', 'Sub']);
      });
    });

    it('should handle empty array', () => {
      const split = splitLargeChunks([], 100);
      expect(split).toEqual([]);
    });

    it('should update line numbers correctly', () => {
      const chunks = [
        {
          headings: [],
          firstSentence: 'First.',
          chunkType: 'paragraph' as const,
          content: `${'a'.repeat(200)}\n\n${'b'.repeat(200)}`,
          startLine: 0,
          endLine: 10
        }
      ];

      const split = splitLargeChunks(chunks, 100);

      if (split.length > 1) {
        expect(split[0]?.startLine).toBeLessThan(split[1]?.startLine ?? 0);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle unicode characters', () => {
      const content = '# 日本語\n\n中文内容。';
      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.headings[0]).toBe('日本語');
    });

    it('should handle special markdown characters', () => {
      const content = '# Title with *emphasis* and **bold**\n\nContent.';
      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks[0]?.headings[0]).toContain('Title with');
    });

    it('should handle very long lines', () => {
      const longLine = 'a'.repeat(10000);
      const content = `# Title\n\n${longLine}`;
      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mixed line endings', () => {
      const content = '# Title\r\n\r\nContent.\n\nMore content.';
      const chunks = parseMarkdown(content, 'test.md');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
