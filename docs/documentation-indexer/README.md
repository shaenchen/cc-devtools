# Documentation Indexer Tool Documentation

Semantic documentation indexing and search system for Claude Code with heuristic-based context generation.

## Overview

The Documentation Indexer tool indexes your project's documentation files (markdown, text, etc.) and provides powerful semantic search capabilities. It's designed to help Claude Code quickly find relevant documentation sections without having to grep through hundreds of files.

### Key Features

- **Works Out-of-the-Box** - Heuristic context generation (no LLM API calls needed)
- **Multi-Format Support** - Markdown, reStructuredText, AsciiDoc, plain text
- **Semantic Search** - Find documentation by meaning, not just keywords
- **Smart Chunking** - Adaptive chunking based on document structure (headings, paragraphs)
- **File Watching** - Automatic index updates on file changes
- **Efficient Storage** - MessagePack binary serialization
- **Fast Search** - Three modes: semantic, exact, and fuzzy
- **Context Preview** - Heuristic-generated context helps identify relevant results quickly

## Storage

- **Index:** `cc-devtools/.cache/documentation-index.msgpack`
- **Format:** MessagePack binary (compact and fast)
- **Created:** Automatically on first use
- **Version Control:** Should be gitignored (ephemeral cache)
- **Rebuild:** Automatically rebuilt if cache is missing

## Supported File Formats

### Markdown (`.md`, `.markdown`)
- Full heading hierarchy extraction (H1-H6)
- Code block detection and exclusion from chunking
- List and table handling
- Front matter support

### reStructuredText (`.rst`)
- Underline/overline heading detection
- Directive handling
- Code block exclusion

### AsciiDoc (`.adoc`, `.asciidoc`)
- Equal-sign heading syntax
- Block detection
- Attribute handling

### Plain Text (`.txt`)
- Paragraph-based chunking
- Simple sentence extraction
- Line-based structure preservation

## MCP Tools

### `search_docs`

Search documentation with semantic/exact/fuzzy modes.

**Parameters:**
- `query` (required, string) - Search query (natural language or keywords)
- `mode` (optional, string) - Search mode: "semantic", "exact", or "fuzzy" (default: "semantic")
- `filters` (optional, object) - Filter options:
  - `filePattern` (string) - Glob pattern (e.g., "docs/api/**")
  - `category` (string[]) - Filter by category (derived from file path)
  - `minScore` (number) - Minimum similarity score (0-1)
- `limit` (optional, number) - Maximum results to return (default: 10)

**Returns:**
```json
{
  "results": [
    {
      "file": "docs/setup/authentication.md",
      "line": 42,
      "score": 0.87,
      "context": "setup > Authentication Setup: Configure JWT tokens and OAuth providers...",
      "hierarchy": ["Getting Started", "Authentication Setup"],
      "content": "## Authentication Setup\n\nConfigure JWT tokens..."
    }
  ],
  "query": "authentication configuration",
  "mode": "semantic",
  "totalResults": 1
}
```

**Search Modes:**

1. **Semantic Mode** (default) - Embedding-based similarity search
   - Use for: Natural language queries, finding documentation by purpose
   - Example: `query: "how to configure authentication"` finds relevant auth setup docs
   - Works by: Generating embeddings for query and comparing with indexed chunks

2. **Exact Mode** - Case-sensitive keyword matching
   - Use for: Finding specific terms, code examples, configuration keys
   - Example: `query: "JWT_SECRET"` finds exact mentions of JWT_SECRET
   - Works by: Exact string matching in content and context

3. **Fuzzy Mode** - Case-insensitive substring matching
   - Use for: Partial word matching, exploring related topics
   - Example: `query: "auth"` finds "authentication", "authorize", "authMiddleware"
   - Works by: Substring matching with scoring based on position

**Example Usage:**

```json
{
  "query": "how to configure authentication for the frontend",
  "mode": "semantic",
  "filters": {
    "category": ["frontend", "setup"],
    "minScore": 0.5
  },
  "limit": 5
}
```

**Typical Workflow:**
1. Call `search_docs` with your query
2. Review the `context` field to identify most relevant results
3. Use the `Read` tool with the returned `file` and `line` to get full content
4. No need for additional grep/glob commands

## Context Generation

The Documentation Indexer uses **heuristic context generation** for fast, reliable context previews without LLM API calls.

### Context Format

```
{category} > {heading}: {first_sentence_snippet}
```

**Example:**
```
frontend > Authentication Setup: The frontend application uses JWT tokens stored in httpOnly cookies for secure authentication.
```

### Context Components

1. **Category** - Extracted from file path
   - `docs/frontend/auth.md` → category: "frontend"
   - `README.md` → category: "general"

2. **Heading Hierarchy** - Heading path to the chunk
   - `["Getting Started", "Installation", "Prerequisites"]` → "Getting Started > Installation > Prerequisites"

3. **First Sentence** - First meaningful sentence from chunk
   - Excludes code blocks, lists, headings
   - Truncated to ~80 characters
   - Provides content preview

### Why Heuristic?

After extensive testing, heuristic context generation was chosen because:
- **Performance:** <0.1ms per chunk vs 5000ms+ for LLM-based
- **Quality:** Sufficient for 90%+ of search scenarios (validated via POC)
- **Cost:** Free vs API costs
- **Predictability:** Deterministic output
- **Simplicity:** No external dependencies or API keys

See [Implementation Plan](../../documentation_indexer.md) for detailed testing results.

## Chunking Strategy

The Documentation Indexer uses **adaptive chunking** that respects document structure:

### Chunking Algorithm

1. **Parse Document** - Extract all headings (H1-H6 or equivalent)
2. **Split at Headings** - Create initial chunks at heading boundaries
3. **Merge Small Chunks** - Chunks < 200 tokens merged with next (same level)
4. **Split Large Chunks** - Chunks > 500 tokens split at paragraph boundaries
5. **Preserve Hierarchy** - Track heading path for each chunk

### Chunk Types

- **heading** - Starts with a heading element
- **paragraph** - Regular paragraph text
- **code** - Code block or example
- **list** - List items (ordered/unordered)

### Target Chunk Size

- **Minimum:** 200 tokens (~150 words)
- **Maximum:** 500 tokens (~375 words)
- **Sweet spot:** 300-400 tokens for optimal search precision

### Why Adaptive?

- Respects natural document structure
- Balances context preservation with search precision
- Avoids fragmenting related content
- Works well with hierarchical heading structure

## File Watching

Automatic index updates via chokidar:

### Watched Events
- **File added** - Index new documentation file
- **File changed** - Re-index modified file
- **File deleted** - Remove from index

### Ignored Patterns
Respects `.gitignore` plus additional patterns:
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- Hidden files (`.*)
- Binary files

### Performance
- Incremental updates (only changed files)
- Debounced re-indexing (500ms delay)
- Background processing (non-blocking)

## Data Schema

### DocChunk

```typescript
interface DocChunk {
  id: string;                    // Unique chunk identifier
  file: string;                  // Absolute file path
  startLine: number;             // Starting line number
  endLine: number;               // Ending line number
  content: string;               // Raw chunk content
  context: string;               // Heuristic-generated context
  hierarchy: string[];           // ["H1", "H2", "H3"]
  chunkType: 'heading' | 'paragraph' | 'code' | 'list';
  metadata?: {
    wordCount: number;
    tokenCount: number;
  };
}
```

### DocIndex

```typescript
interface DocIndex {
  chunks: Map<string, DocChunk[]>;           // file -> chunks
  embeddings: Map<string, Float32Array>;     // chunkId -> embedding
  metadata: IndexMetadata;
}

interface IndexMetadata {
  version: string;
  indexedAt: number;
  fileCount: number;
  chunkCount: number;
}
```

### SearchResult

```typescript
interface SearchResult {
  chunk: DocChunk;
  score: number;
  matchReason: string;
}
```

## Best Practices

### Search Strategies

**Finding How-To Guides:**
```json
{
  "query": "how to configure authentication",
  "mode": "semantic"
}
```

**Finding Specific Configuration:**
```json
{
  "query": "JWT_SECRET",
  "mode": "exact"
}
```

**Exploring Related Topics:**
```json
{
  "query": "auth",
  "mode": "fuzzy",
  "filters": {
    "category": ["security", "setup"]
  }
}
```

**Narrowing Results:**
```json
{
  "query": "database setup",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/backend/**",
    "minScore": 0.7
  },
  "limit": 3
}
```

### Performance Tips

1. **Use semantic mode for natural language queries** - Best results for "how to" questions
2. **Use exact mode for code/config** - Faster and more precise for specific terms
3. **Filter by category** - Narrows search space significantly
4. **Set appropriate minScore** - Higher threshold (0.7+) for more precise results
5. **Limit results** - Request only what you need (default 10 is usually good)

## Use Cases

### Finding Setup Instructions
```json
{
  "query": "installation and setup steps",
  "mode": "semantic",
  "filters": {
    "category": ["setup", "getting-started"]
  }
}
```

### Finding API Documentation
```json
{
  "query": "authentication API endpoints",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/api/**"
  }
}
```

### Finding Configuration Options
```json
{
  "query": "DATABASE_URL",
  "mode": "exact"
}
```

### Finding Troubleshooting Guides
```json
{
  "query": "error connection refused",
  "mode": "fuzzy",
  "filters": {
    "category": ["troubleshooting", "debugging"]
  }
}
```

### Finding Best Practices
```json
{
  "query": "security best practices for authentication",
  "mode": "semantic"
}
```

## Integration with Claude Code

The Documentation Indexer enables Claude Code to:

1. **Find Documentation Quickly** - No need to grep through hundreds of files
2. **Understand Context** - Preview context before reading full file
3. **Navigate Documentation** - Jump directly to relevant sections
4. **Discover Features** - Search by purpose/description
5. **Stay Updated** - Automatic re-indexing on file changes

### Proactive Usage

When integrated with Claude Code's output-style, the Documentation Indexer should be used proactively:

**ALWAYS use `search_docs` instead of Grep/Glob when:**
- Searching for "how to" or "setup" documentation
- Looking for API documentation or usage examples
- Finding configuration guides or best practices
- Searching across multiple documentation files
- Looking for conceptual explanations

**Examples:**
- ❌ DON'T: `grep -r "authentication" docs/`
- ✅ DO: `search_docs({ query: "authentication setup", mode: "semantic" })`

- ❌ DON'T: `glob("docs/**/*auth*.md")`
- ✅ DO: `search_docs({ query: "authentication", filters: { category: ["security"] } })`

## Troubleshooting

### Index Not Building

**Check:**
1. File permissions on `cc-devtools/.cache/`
2. Documentation files exist in project
3. Files not in .gitignore
4. Check MCP server logs for errors

**Verify index exists:**
```bash
ls -lh cc-devtools/.cache/documentation-index.msgpack
```

### Search Returns No Results

**Check:**
1. Index built - File exists at `cc-devtools/.cache/documentation-index.msgpack`
2. Search mode - Try fuzzy instead of semantic
3. Filters - Remove filters to search all files
4. Query - Try broader search terms

**Debug tips:**
- Remove `filters` to search all files
- Try `mode: "fuzzy"` with a single word
- Check if files are being indexed (look at index file size)

### Slow Indexing

**First Run:**
- Large documentation sets take time
- Expected time for 1000 files: ~10-30 seconds
- Embedding generation: ~50ms per chunk

**Subsequent Runs:**
- Only changed files are re-indexed
- Watch mode is incremental and fast
- Most changes update in <1 second

### Context Quality Issues

**If context is not helpful:**
1. Context is just a preview - read full chunk using `file` and `line`
2. Try different search modes (semantic vs fuzzy)
3. Adjust `minScore` threshold
4. Review multiple results before deciding

**Remember:** Context is designed for quick identification, not complete information. Always read the full chunk for implementation details.

## Performance Characteristics

### Indexing Speed
- **Small docs** (<100 files): ~5 seconds
- **Medium docs** (100-1000 files): ~30 seconds
- **Large docs** (1000-5000 files): ~2 minutes
- **Context generation:** <0.1ms per chunk
- **Embedding generation:** ~50ms per chunk

### Search Speed
- **Exact search:** <10ms
- **Fuzzy search:** <50ms
- **Semantic search:** ~100-300ms

### Memory Usage
- **Index size:** ~2-5KB per file
- **Embedding cache:** ~1.5KB per chunk
- **Runtime memory:** <200MB

## Configuration

No configuration file needed. Default behavior:

**File Patterns:**
- Include: `**/*.md`, `**/*.markdown`, `**/*.txt`, `**/*.rst`, `**/*.adoc`, `**/*.asciidoc`
- Exclude: `node_modules/**`, `.git/**`, `dist/**`, `build/**`, `*.min.*`

**Chunking:**
- Min tokens: 200
- Max tokens: 500
- Split at headings: true

**Search:**
- Default mode: semantic
- Default limit: 10
- Semantic threshold: 0.3

**Performance:**
- Watch enabled: true
- Debounce delay: 500ms

**Storage:**
- Cache dir: `cc-devtools/.cache`
- Index file: `documentation-index.msgpack`

## Implementation Details

### Heuristic Context Generation

The context generator uses a deterministic algorithm:

1. **Extract Category** from file path
   ```
   docs/frontend/auth.md → "frontend"
   README.md → "general"
   ```

2. **Build Hierarchy String** from heading path
   ```
   ["Getting Started", "Installation"] → "Getting Started > Installation"
   ```

3. **Extract First Sentence**
   - Remove headings
   - Remove code blocks
   - Remove inline code
   - Get first sentence (up to period/exclamation/question mark)
   - Truncate to 80 characters

4. **Format Context**
   ```
   {category} > {hierarchy}: {firstSentence}
   ```

### Parser Design

Each format has specialized parsing logic:

**Markdown:**
- Regex: `/^(#{1,6})\s+(.+)$/gm`
- Extracts heading level and text
- Handles code blocks with triple backticks
- Detects lists and tables

**reStructuredText:**
- Heading detection by underline/overline characters
- Directive handling (.. directive::)
- Code block detection (::)

**AsciiDoc:**
- Heading syntax: `= Title`, `== Subtitle`
- Block detection with delimiters
- Attribute extraction

**Plain Text:**
- Paragraph-based chunking (double newline)
- Sentence detection for context
- No heading structure (flat hierarchy)

### Search Algorithm

**Semantic Search:**
1. Generate embedding for query
2. Compare with all chunk embeddings (cosine similarity)
3. Filter by threshold (default 0.3)
4. Sort by similarity score
5. Apply limit

**Exact Search:**
1. Normalize query (case-sensitive)
2. Search in content and context fields
3. Exact string matching
4. Sort by file path, then line number

**Fuzzy Search:**
1. Normalize query and content (case-insensitive)
2. Substring matching
3. Score by match position and length
4. Sort by score

## Related Documentation

- [Implementation Plan](../../documentation_indexer.md) - Detailed design and POC results
- [Main README](../../README.md) - Package documentation
- [Source Code Mapper](../source-code-mapper/README.md) - Similar tool for code indexing

## Support

- **Issues:** [GitHub Issues](https://github.com/shaenchen/cc-devtools/issues)
- **Main Documentation:** [cc-devtools README](../../README.md)
