/**
 * Document parsing service
 * Extracts headings, hierarchy, and chunk content from documentation files
 */

import type { ParsedChunk, ChunkType } from '../types.js';

/**
 * RST heading underline characters and their hierarchy levels
 */
const RST_HEADING_CHARS = ['=', '-', '`', ':', '.', "'", '"', '~', '^', '_', '*', '+', '#'];

/**
 * Parse reStructuredText (RST) document into chunks
 */
export function parseRST(content: string, _filePath: string): ParsedChunk[] {
  const lines = content.split('\n');
  const chunks: ParsedChunk[] = [];
  const headingStack: Array<{ level: number; text: string; line: number }> = [];
  const headingCharLevels = new Map<string, number>(); // Track which chars we've seen and their levels

  let currentChunkStart = 0;
  let currentChunkLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const nextLine = lines[i + 1] ?? '';
    const prevLine = lines[i - 1] ?? '';

    // Check for underline-style heading (most common in RST)
    if (nextLine && RST_HEADING_CHARS.includes(nextLine[0] ?? '') && nextLine.trim().length >= line.trim().length) {
      const underlineChar = nextLine[0] ?? '';
      const isValidUnderline = new RegExp(`^\\${underlineChar}+$`).test(nextLine.trim());

      if (isValidUnderline && line.trim().length > 0) {
        // Check if there's an overline too (title format)
        const hasOverline =
          prevLine && prevLine[0] === underlineChar && new RegExp(`^\\${underlineChar}+$`).test(prevLine.trim());

        // Save previous chunk
        if (currentChunkLines.length > 0) {
          const chunk = createChunk(currentChunkLines, currentChunkStart, i - 1 - (hasOverline ? 1 : 0), headingStack);
          if (chunk) {
            chunks.push(chunk);
          }
        }

        // Determine heading level
        let level = headingCharLevels.get(underlineChar);
        if (level === undefined) {
          level = headingCharLevels.size;
          headingCharLevels.set(underlineChar, level);
        }

        const text = line.trim();

        // Pop headings of same or lower level
        while (headingStack.length > 0 && (headingStack[headingStack.length - 1]?.level ?? 0) >= level) {
          headingStack.pop();
        }

        headingStack.push({ level, text, line: i });

        // Start new chunk (skip overline if present)
        currentChunkStart = hasOverline ? i - 1 : i;
        currentChunkLines = hasOverline ? [prevLine, line, nextLine] : [line, nextLine];
        i += 2; // Skip the underline
        continue;
      }
    }

    currentChunkLines.push(line);
    i++;
  }

  // Save last chunk
  if (currentChunkLines.length > 0) {
    const chunk = createChunk(currentChunkLines, currentChunkStart, lines.length - 1, headingStack);
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Parse AsciiDoc document into chunks
 */
export function parseAsciiDoc(content: string, _filePath: string): ParsedChunk[] {
  const lines = content.split('\n');
  const chunks: ParsedChunk[] = [];
  const headingStack: Array<{ level: number; text: string; line: number }> = [];

  let currentChunkStart = 0;
  let currentChunkLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // AsciiDoc headings: = Title, == Section, === Subsection, etc.
    const headingMatch = line.match(/^(={1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous chunk if it exists
      if (currentChunkLines.length > 0) {
        const chunk = createChunk(currentChunkLines, currentChunkStart, i - 1, headingStack);
        if (chunk) {
          chunks.push(chunk);
        }
      }

      // Update heading stack
      const level = headingMatch[1]?.length ?? 0;
      const text = headingMatch[2]?.trim() ?? '';

      // Pop headings of same or lower level
      while (headingStack.length > 0 && (headingStack[headingStack.length - 1]?.level ?? 0) >= level) {
        headingStack.pop();
      }

      headingStack.push({ level, text, line: i });

      // Start new chunk
      currentChunkStart = i;
      currentChunkLines = [line];
    } else {
      currentChunkLines.push(line);
    }
  }

  // Save last chunk
  if (currentChunkLines.length > 0) {
    const chunk = createChunk(currentChunkLines, currentChunkStart, lines.length - 1, headingStack);
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Parse markdown document into chunks
 */
export function parseMarkdown(content: string, _filePath: string): ParsedChunk[] {
  const lines = content.split('\n');
  const chunks: ParsedChunk[] = [];
  const headingStack: Array<{ level: number; text: string; line: number }> = [];

  let currentChunkStart = 0;
  let currentChunkLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous chunk if it exists
      if (currentChunkLines.length > 0) {
        const chunk = createChunk(currentChunkLines, currentChunkStart, i - 1, headingStack);
        if (chunk) {
          chunks.push(chunk);
        }
      }

      // Update heading stack
      const level = headingMatch[1]?.length ?? 0;
      const text = headingMatch[2]?.trim() ?? '';

      // Pop headings of same or lower level
      while (headingStack.length > 0 && (headingStack[headingStack.length - 1]?.level ?? 0) >= level) {
        headingStack.pop();
      }

      headingStack.push({ level, text, line: i });

      // Start new chunk
      currentChunkStart = i;
      currentChunkLines = [line];
    } else {
      currentChunkLines.push(line);
    }
  }

  // Save last chunk
  if (currentChunkLines.length > 0) {
    const chunk = createChunk(currentChunkLines, currentChunkStart, lines.length - 1, headingStack);
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Create a parsed chunk from lines and heading context
 */
function createChunk(
  lines: string[],
  startLine: number,
  endLine: number,
  headingStack: Array<{ level: number; text: string; line: number }>
): ParsedChunk | null {
  const content = lines.join('\n').trim();

  if (!content) {
    return null;
  }

  const headings = headingStack.map((h) => h.text);
  const firstSentence = extractFirstSentence(content);
  const chunkType = detectChunkType(content);

  return {
    headings,
    firstSentence,
    chunkType,
    content,
    startLine,
    endLine
  };
}

/**
 * Extract the first meaningful sentence from content
 */
export function extractFirstSentence(content: string): string {
  // Remove headings
  const withoutHeadings = content.replace(/^#{1,6}\s+.+$/gm, '').trim();

  // Remove code blocks
  const withoutCode = withoutHeadings.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  const withoutInlineCode = withoutCode.replace(/`[^`]+`/g, '');

  // Remove list markers
  const withoutLists = withoutInlineCode.replace(/^[-*+]\s+/gm, '');

  // Get first sentence
  const match = withoutLists.match(/^(.+?[.!?])\s/);
  if (match?.[1]) {
    return match[1];
  }

  // Fallback: first line or first 100 chars
  const firstLine = withoutLists.split('\n')[0]?.trim() ?? '';
  return firstLine.slice(0, 100);
}

/**
 * Detect chunk type based on content
 */
function detectChunkType(content: string): ChunkType {
  // Check if starts with heading
  if (/^#{1,6}\s+/.test(content)) {
    return 'heading';
  }

  // Check if contains code block
  if (/```[\s\S]*?```/.test(content)) {
    return 'code';
  }

  // Check if starts with list
  if (/^[-*+]\s+/m.test(content)) {
    return 'list';
  }

  return 'paragraph';
}

/**
 * Parse plain text document (simple paragraph-based chunking)
 */
export function parsePlainText(content: string, _filePath: string): ParsedChunk[] {
  const paragraphs = content.split(/\n\s*\n/);
  const chunks: ParsedChunk[] = [];

  let lineOffset = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lineOffset += paragraph.split('\n').length;
      continue;
    }

    const lines = paragraph.split('\n').length;
    const firstSentence = extractFirstSentence(trimmed);

    chunks.push({
      headings: [],
      firstSentence,
      chunkType: 'paragraph',
      content: trimmed,
      startLine: lineOffset,
      endLine: lineOffset + lines - 1
    });

    lineOffset += lines + 1; // +1 for the blank line separator
  }

  return chunks;
}

/**
 * Estimate token count for a string (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Merge small chunks together to reach target size
 */
export function mergeSmallChunks(chunks: ParsedChunk[], minTokens: number): ParsedChunk[] {
  const merged: ParsedChunk[] = [];
  let accumulator: ParsedChunk | null = null;

  for (const chunk of chunks) {
    const tokenCount = estimateTokenCount(chunk.content);

    if (!accumulator) {
      if (tokenCount < minTokens) {
        accumulator = chunk;
      } else {
        merged.push(chunk);
      }
      continue;
    }

    // Merge if still under min tokens
    const combinedTokens = estimateTokenCount(accumulator.content) + tokenCount;
    if (combinedTokens < minTokens) {
      accumulator = {
        ...accumulator,
        content: `${accumulator.content}\n\n${chunk.content}`,
        endLine: chunk.endLine,
        firstSentence: accumulator.firstSentence || chunk.firstSentence
      };
    } else {
      // Push accumulated chunk and start new one or add current
      merged.push(accumulator);
      if (tokenCount < minTokens) {
        accumulator = chunk;
      } else {
        merged.push(chunk);
        accumulator = null;
      }
    }
  }

  // Add final accumulated chunk
  if (accumulator) {
    merged.push(accumulator);
  }

  return merged;
}

/**
 * Split large chunks at paragraph boundaries
 */
export function splitLargeChunks(chunks: ParsedChunk[], maxTokens: number): ParsedChunk[] {
  const result: ParsedChunk[] = [];

  for (const chunk of chunks) {
    const tokenCount = estimateTokenCount(chunk.content);

    if (tokenCount <= maxTokens) {
      result.push(chunk);
      continue;
    }

    // Split at paragraph boundaries
    const paragraphs = chunk.content.split(/\n\s*\n/);
    let currentContent = '';
    let currentStartLine = chunk.startLine;
    let lineOffset = chunk.startLine;

    for (const paragraph of paragraphs) {
      const testContent = currentContent ? `${currentContent}\n\n${paragraph}` : paragraph;
      const testTokens = estimateTokenCount(testContent);

      if (testTokens > maxTokens && currentContent) {
        // Save current chunk
        const lines = currentContent.split('\n').length;
        result.push({
          ...chunk,
          content: currentContent,
          startLine: currentStartLine,
          endLine: currentStartLine + lines - 1
        });

        currentContent = paragraph;
        currentStartLine = lineOffset;
      } else {
        currentContent = testContent;
      }

      lineOffset += paragraph.split('\n').length + 1;
    }

    // Add final piece
    if (currentContent) {
      const lines = currentContent.split('\n').length;
      result.push({
        ...chunk,
        content: currentContent,
        startLine: currentStartLine,
        endLine: currentStartLine + lines - 1
      });
    }
  }

  return result;
}
