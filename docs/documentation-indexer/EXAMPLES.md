# Documentation Indexer Examples

Practical examples for using the Documentation Indexer with Claude Code.

## Basic Search Examples

### Finding Setup Instructions

**Goal:** Find how to set up authentication in your project

**Query:**
```json
{
  "query": "authentication setup configuration",
  "mode": "semantic",
  "limit": 5
}
```

**Expected Results:**
- Setup guides for authentication
- Configuration documentation
- Getting started sections related to auth

**Why This Works:**
Semantic mode understands intent, so it finds docs about "setting up auth" even if they don't use those exact words.

---

### Finding Specific Configuration Values

**Goal:** Find where `DATABASE_URL` is documented

**Query:**
```json
{
  "query": "DATABASE_URL",
  "mode": "exact"
}
```

**Expected Results:**
- Configuration file documentation
- Environment variable guides
- Setup instructions mentioning DATABASE_URL

**Why This Works:**
Exact mode finds literal string matches, perfect for finding specific config keys, environment variables, or code snippets in docs.

---

### Exploring Related Topics

**Goal:** Find all authentication-related documentation

**Query:**
```json
{
  "query": "auth",
  "mode": "fuzzy",
  "filters": {
    "category": ["security", "api"]
  },
  "limit": 10
}
```

**Expected Results:**
- Authentication guides
- Authorization documentation
- OAuth setup docs
- authMiddleware usage
- Any docs with "auth" substring

**Why This Works:**
Fuzzy mode + category filter casts a wide net for related topics while keeping results relevant.

---

## Advanced Search Examples

### Finding Troubleshooting Guides

**Goal:** Find solutions for connection errors

**Query:**
```json
{
  "query": "connection refused error troubleshooting",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/troubleshooting/**",
    "minScore": 0.6
  }
}
```

**Explanation:**
- `filePattern`: Narrows search to troubleshooting directory
- `minScore`: Only returns high-confidence matches
- `semantic`: Understands "connection problems" concept

---

### Finding API Documentation

**Goal:** Find API endpoint documentation for user management

**Query:**
```json
{
  "query": "user management API endpoints",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/api/**",
    "category": ["api", "backend"]
  },
  "limit": 3
}
```

**Explanation:**
- Combines semantic search with path and category filtering
- Returns top 3 most relevant API docs
- Focuses on backend API category

---

### Finding Best Practices

**Goal:** Find security best practices for password handling

**Query:**
```json
{
  "query": "password security best practices hashing storage",
  "mode": "semantic",
  "filters": {
    "category": ["security", "best-practices"]
  }
}
```

**Explanation:**
- Rich query with multiple concepts
- Semantic mode connects related ideas
- Category filter ensures relevant docs

---

## Workflow Examples

### Example 1: Implementing a New Feature

**Scenario:** You need to implement OAuth login

**Step 1: Find Setup Docs**
```json
{
  "query": "OAuth setup configuration",
  "mode": "semantic",
  "limit": 5
}
```

**Step 2: Find Code Examples**
```json
{
  "query": "OAuth implementation example",
  "mode": "semantic",
  "filters": {
    "category": ["examples", "tutorials"]
  }
}
```

**Step 3: Find Security Guidelines**
```json
{
  "query": "OAuth security best practices",
  "mode": "semantic",
  "filters": {
    "category": ["security"]
  }
}
```

---

### Example 2: Debugging an Issue

**Scenario:** Getting "CORS error" in your frontend

**Step 1: Find Error Documentation**
```json
{
  "query": "CORS error",
  "mode": "fuzzy"
}
```

**Step 2: Find Configuration Docs**
```json
{
  "query": "CORS configuration setup",
  "mode": "semantic",
  "filters": {
    "category": ["frontend", "backend", "api"]
  }
}
```

**Step 3: Find Troubleshooting Guide**
```json
{
  "query": "CORS troubleshooting cross-origin",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/troubleshooting/**"
  }
}
```

---

### Example 3: Onboarding a New Developer

**Scenario:** New team member needs to get started

**Step 1: Find Getting Started**
```json
{
  "query": "getting started installation prerequisites",
  "mode": "semantic",
  "filters": {
    "category": ["getting-started", "setup"]
  }
}
```

**Step 2: Find Architecture Overview**
```json
{
  "query": "system architecture overview components",
  "mode": "semantic",
  "filters": {
    "category": ["architecture", "overview"]
  }
}
```

**Step 3: Find Development Workflow**
```json
{
  "query": "development workflow git commit process",
  "mode": "semantic",
  "filters": {
    "category": ["development", "workflow"]
  }
}
```

---

## Search Mode Selection Guide

### Use Semantic Mode When:
- Asking "how to" questions
- Finding conceptual documentation
- Searching by purpose or description
- Query uses natural language
- Don't know exact terminology

**Examples:**
- "how to deploy the application"
- "user authentication flow explanation"
- "database migration best practices"

### Use Exact Mode When:
- Looking for specific terms
- Finding configuration keys
- Searching for code snippets
- Need precise matches
- Know exact terminology

**Examples:**
- "JWT_SECRET"
- "DATABASE_URL"
- "REACT_APP_API_URL"
- "express.Router()"

### Use Fuzzy Mode When:
- Exploring related topics
- Partial word matching
- Don't remember exact term
- Want broad results
- Finding all mentions

**Examples:**
- "auth" (finds authentication, authorize, etc.)
- "config" (finds configuration, configs, etc.)
- "deploy" (finds deployment, deploying, etc.)

---

## Filter Usage Examples

### Category Filtering

Categories are automatically extracted from file paths:
- `docs/frontend/` → category: "frontend"
- `docs/api/` → category: "api"
- `docs/security/` → category: "security"

**Example:**
```json
{
  "query": "authentication",
  "filters": {
    "category": ["frontend", "security"]
  }
}
```

Returns auth docs ONLY from frontend and security directories.

---

### File Pattern Filtering

Use glob patterns to search specific locations:

**Search only API docs:**
```json
{
  "query": "endpoint",
  "filters": {
    "filePattern": "docs/api/**"
  }
}
```

**Search specific file:**
```json
{
  "query": "installation",
  "filters": {
    "filePattern": "**/README.md"
  }
}
```

**Search multiple patterns:**
```json
{
  "query": "setup",
  "filters": {
    "filePattern": "docs/{setup,getting-started}/**"
  }
}
```

---

### Score Filtering

Control result precision with `minScore`:

**High precision (fewer but more relevant results):**
```json
{
  "query": "authentication",
  "filters": {
    "minScore": 0.8
  }
}
```

**Balanced (default threshold):**
```json
{
  "query": "authentication",
  "filters": {
    "minScore": 0.5
  }
}
```

**Broad search (more results, some less relevant):**
```json
{
  "query": "authentication",
  "filters": {
    "minScore": 0.3
  }
}
```

---

## Common Patterns

### Pattern: Find All Docs About a Topic

```json
{
  "query": "database",
  "mode": "fuzzy",
  "limit": 20
}
```

Then use `Read` tool to examine each result.

---

### Pattern: Find Specific Section

```json
{
  "query": "Docker deployment production",
  "mode": "semantic",
  "filters": {
    "category": ["deployment"],
    "minScore": 0.7
  },
  "limit": 3
}
```

Context field shows hierarchy to verify correct section.

---

### Pattern: Cross-Reference Search

First search for main topic:
```json
{
  "query": "authentication middleware",
  "mode": "semantic"
}
```

Then search for related topics:
```json
{
  "query": "authorization permissions roles",
  "mode": "semantic"
}
```

---

## Integration with Claude Code Workflow

### Typical Workflow

1. **Claude receives user question**
   - User: "How do I configure authentication?"

2. **Claude uses `search_docs`**
   ```json
   {
     "query": "authentication configuration setup",
     "mode": "semantic",
     "limit": 5
   }
   ```

3. **Claude reviews context field**
   - Identifies most relevant result
   - Checks hierarchy to understand location

4. **Claude uses Read tool**
   - Reads full file at specified line
   - Gets complete context

5. **Claude answers user**
   - Provides accurate answer based on docs
   - Cites documentation location

---

### Best Practices for Claude Code

**DO:**
- Use `search_docs` first before grepping
- Review context field to pick best result
- Use Read tool for full content
- Try multiple search modes if needed
- Combine with category/path filters

**DON'T:**
- Grep through docs directory
- Guess file locations
- Read all documentation files
- Use overly long queries (keep to 5-10 words)
- Ignore the context field

---

## Performance Tips

1. **Start with semantic mode** - Best results for natural queries
2. **Use filters to narrow scope** - Faster search, better results
3. **Limit results appropriately** - Default 10 is usually enough
4. **Try exact mode for specific terms** - Much faster than semantic
5. **Use fuzzy mode for exploration** - Good middle ground

---

## Troubleshooting Search Issues

### No Results Returned

**Try:**
1. Remove all filters
2. Switch to fuzzy mode
3. Use shorter, simpler query
4. Check if docs are indexed (look for `.cache/documentation-index.msgpack`)

### Too Many Irrelevant Results

**Try:**
1. Use exact mode instead of fuzzy
2. Add category filter
3. Increase minScore threshold
4. Use more specific query terms
5. Add filePattern filter

### Wrong Results

**Try:**
1. Use exact mode for specific terms
2. Add more context to semantic query
3. Use category filters
4. Review context field to understand why result matched
5. Try different search mode

---

## Real-World Example

**Scenario:** You're implementing a new payment processing feature and need to understand the existing payment flow, security requirements, and API endpoints.

**Step-by-Step Search Strategy:**

1. **Understand Current Payment Flow**
```json
{
  "query": "payment processing flow architecture",
  "mode": "semantic",
  "filters": {
    "category": ["architecture", "payments"]
  }
}
```

2. **Find Security Requirements**
```json
{
  "query": "payment security PCI compliance requirements",
  "mode": "semantic",
  "filters": {
    "category": ["security", "compliance"]
  }
}
```

3. **Find API Documentation**
```json
{
  "query": "payment API endpoints",
  "mode": "semantic",
  "filters": {
    "filePattern": "docs/api/**",
    "category": ["api", "payments"]
  }
}
```

4. **Find Implementation Examples**
```json
{
  "query": "payment integration example",
  "mode": "semantic",
  "filters": {
    "category": ["examples", "tutorials"]
  }
}
```

5. **Find Testing Guidelines**
```json
{
  "query": "payment testing sandbox",
  "mode": "fuzzy",
  "filters": {
    "category": ["testing", "development"]
  }
}
```

**Result:** Comprehensive understanding of payment system without manually reading dozens of documentation files.
