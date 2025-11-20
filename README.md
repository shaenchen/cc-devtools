# cc-devtools

> A modular developer toolkit for Claude Code that provides kanban project management, persistent memory, implementation planning, source code mapping, and automated workflow orchestration capabilities.

[![npm version](https://badge.fury.io/js/@shaenchen%2Fcc-devtools.svg)](https://www.npmjs.com/package/@shaenchen/cc-devtools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`cc-devtools` is a comprehensive toolkit that extends [Claude Code](https://claude.com/claude-code) with powerful project management and development capabilities through MCP (Model Context Protocol) servers. Each tool operates independently and stores data in your project's `cc-devtools/` directory.

### MCP Tools (Claude Code Integration)

- **Kanban Board** - Manage stories, subtasks, and workflows with intelligent work recommendations
- **Persistent Memory** - Store and search project knowledge with semantic search
- **Implementation Planner** - Create, track, and search implementation plans with tasks
- **Source Code Mapper** - Index and search your codebase with semantic understanding
- **Documentation Indexer** - Semantic documentation search for markdown, text, and other doc formats
- **Workflow Orchestration** - Automated solo developer workflow with state machine and AI code reviews
- **Clipboard** - Copy generated content directly to system clipboard

### Web Application

In addition to the MCP tools, cc-devtools includes a standalone web application that provides browser-based access to project management and development features:

- **📋 Kanban Board** - Visual kanban board with drag-and-drop, customizable columns, and real-time updates
- **📝 Code Editor** - Browser-based code editor with syntax highlighting and file tree navigation
- **💻 Remote Console** - **NEW!** Web-based terminal with multiple sessions, tab management, and persistent connections
  - Full xterm.js terminal rendering with colors and formatting
  - Multiple terminal sessions in tabbed interface
  - Sessions persist across page refreshes
  - Auto-updating tab names based on current directory
  - Powered by VibeTunnel for efficient terminal streaming
  - **Platform Support:** macOS and Linux only (tested on macOS)

**Quick Start (Web App):**
```bash
# Build and start the web server
npm run build:web
npx cc-devtools web

# Or run in development mode (separate terminals)
npm run dev:web          # Frontend dev server
npx cc-devtools web      # Backend server

# Clear stored authentication tokens (if needed)
npx cc-devtools web --invalidate-tokens
```

Access at `http://localhost:9100` (or next available port)

**Web App Features:**
- Token-based authentication with QR code support
- **Persistent authentication tokens** - tokens remain valid across server restarts
- Persistent sidebar navigation across all pages
- Responsive design for desktop browsers
- File watching for real-time kanban updates
- WebSocket connections for terminal I/O

**Screenshots** (click to expand):

<details>
<summary>📋 Kanban Board</summary>

![Kanban Board](docs/screenshots/kanban-board.png)
*Visual kanban board with stories, subtasks, and workflow phases*
</details>

<details>
<summary>📝 Code Editor</summary>

![Code Editor](docs/screenshots/editor-page.png)
*Browser-based code editor with syntax highlighting and file tree*
</details>

<details>
<summary>💻 Remote Console</summary>

![Remote Console](docs/screenshots/console-page.png)
*Web-based terminal with multiple sessions and tab management*
</details>

<details>
<summary>🧠 Memory</summary>

![Memory](docs/screenshots/memory-page.png)
*Persistent memory storage with semantic search*
</details>

<details>
<summary>📋 Plans</summary>

![Plans](docs/screenshots/plans-page.png)
*Implementation planning with tasks and progress tracking*
</details>

[📖 Web Application Documentation](docs/web/README.md) | [📖 Remote Console Documentation](docs/console/README.md) | [📖 Deployment Guide](CONSOLE_DEPLOYMENT.md)

## Installation

**Important:** This package must be installed locally in your project (not globally) because the MCP servers need to run from your project's `node_modules/` directory.

```bash
npm install @shaenchen/cc-devtools
```

## Quick Start

### 1. Install the Package

```bash
npm install @shaenchen/cc-devtools
```

### 2. Run Setup

Run the interactive setup command:

```bash
npx cc-devtools setup
```

This will:
- Create the `cc-devtools/` directory structure
- Update `.gitignore` to exclude cache files
- Configure `.mcp.json` with MCP server entries
- Optionally copy slash command templates to `.claude/commands/`
- Generate a recommended output-style for proactive tool usage

You can also use flags for non-interactive setup:

```bash
npx cc-devtools setup --features=kanban,memory --gitignore --mcp
```

### 3. Restart Claude Code

After setup, restart Claude Code to load the new MCP servers.

### 4. Start Using the Tools

The tools are now available through Claude Code's MCP tools:

- `kanban_get_work_item` - Get recommended work items
- `kanban_update_work_item` - Update story/subtask status
- `memory_store` - Store project memories
- `memory_search` - Search memories with hybrid search
- `plan_store` - Create implementation plans
- `plan_search` - Search plans and tasks
- `plan_update` - Update plan status and tasks
- `search_code` - Search code symbols semantically
- `query_imports` - Query import relationships
- `get_file_info` - Get file symbol information
- `search_docs` - Search documentation with semantic/exact/fuzzy modes
- `clipboard_write` - Copy content to system clipboard

## Managing Features

### Check Status

View currently enabled features and data files:

```bash
npx cc-devtools status
```

This displays:
- Package installation status
- Which features are enabled in .mcp.json
- Which features have data files
- Configuration status (.mcp.json, .gitignore)
- Suggested next steps

### Add Features

Enable additional features after initial setup:

```bash
# Interactive mode - select features from a menu
npx cc-devtools add-feature

# With flags - specify features directly
npx cc-devtools add-feature --features=planner,memory
npx cc-devtools add-feature --features=kanban --slash-commands
```

This will:
- Add MCP server entries to .mcp.json for the selected features
- Optionally copy slash command templates
- Display next steps for using the new features

**Note:** Restart Claude Code after adding features to load the new MCP servers.

### Remove Features

Disable features you no longer need:

```bash
# Interactive mode - select features and choose data handling
npx cc-devtools remove-feature

# With flags - specify features and data handling
npx cc-devtools remove-feature --features=memory --keep-data
npx cc-devtools remove-feature --features=planner --remove-data
```

This will:
- Remove MCP server entries from .mcp.json
- Remove slash commands (if any)
- Optionally remove data files (prompted or via flags)

**⚠️ Warning:** Removing features with `--remove-data` permanently deletes your data files. This cannot be undone.

### Source Code Mapper Commands

View statistics about your indexed codebase:

```bash
# Show statistics about the indexed codebase
npx cc-devtools scm stats
```

This displays:
- Number of files indexed
- Total symbols found
- Breakdown by symbol type (functions, classes, etc.)
- Top files by symbol count

**Note:** The source code mapper works out-of-the-box using comprehensive regex parsing for all major languages. No additional installation or setup required.

### Per-File Runner

Run commands on files matching glob patterns with intelligent state tracking. Perfect for batch processing files with AI tools like Claude CLI or running automated tasks on your codebase.

```bash
# View status of files (new, out-of-date, up-to-date)
npx cc-devtools per-file-runner status <config-id>

# Run command on all files that need processing
npx cc-devtools per-file-runner run <config-id>

# Run with dry-run to preview what would execute
npx cc-devtools per-file-runner run <config-id> --dry-run

# Run all configs in priority order
npx cc-devtools per-file-runner run-all

# Automatic mode: continuously run with retry logic
# Success: retry in 1 minute | Failure: retry in 1 hour
npx cc-devtools per-file-runner automatic

# Reset state to re-process all files
npx cc-devtools per-file-runner reset <config-id>
```

**Key Features:**
- MD5-based change detection (only process new or modified files)
- Prompt template with `{filename}` placeholder substitution
- Sequential processing with automatic state updates
- Priority-based execution for multiple configs
- Timestamped logging for all operations
- Dry-run mode for testing
- Automatic retry logic for continuous processing

**Configuration:** `cc-devtools/per-file-runner.yaml`
**State Tracking:** `cc-devtools/per-file-runner-state.yaml`

[📖 Full Per-File Runner Documentation](docs/per-file-runner/)

### Suggest Output Style

Generate a custom Claude Code output-style tailored to your enabled cc-devtools features:

```bash
npx cc-devtools suggest-output-style
```

This command:
- Detects which features are currently enabled
- Generates output-style content with prescriptive guidance
- Displays the suggested content for review
- Offers to save as a new file OR append to existing output-style

**Why use this?**
- **Workflow automation (ESSENTIAL if enabled)**: If you enabled the workflow feature, the output-style guidance is REQUIRED for it to function. It tells Claude when to automatically run `npx cc-devtools workflow check` and how to interpret and act on the results.
- **Proactive tool usage (OPTIONAL)**: Instructs Claude to use other MCP tools autonomously without asking
- **Clear behavioral directives**: "Store decisions immediately", "Search before answering"
- **Tool selection guidance**: When to use Planner vs Memory vs TodoWrite
- **Efficient context usage**: Only includes guidance NOT already in MCP tool descriptions

**Workflow options:**

**Option 1: Create new output-style**
```bash
npx cc-devtools suggest-output-style
# Review generated content
# Choose "Create new"
# Enter name: "cc-devtools-enhanced"
# Restart Claude Code
# Activate: /output-style cc-devtools-enhanced
```

**Option 2: Append to existing output-style**
```bash
npx cc-devtools suggest-output-style
# Review generated content
# Choose "Append to existing"
# Select your current output-style
# Restart Claude Code (your existing style is now enhanced)
```

## Tools Documentation

### Kanban Tool

Manage project work with stories, subtasks, and customizable workflow phases.

**Key Features:**
- Configurable workflow phases (defaults: MVP, BETA, V1, POSTRELEASE)
- Story and subtask dependency tracking
- Intelligent work recommendations based on priorities and blockers
- Status validation and workflow enforcement
- Progress tracking and analytics
- 10 slash command templates included

**Storage:** `cc-devtools/kanban.yaml`

**Customization:** Phases are fully configurable via the YAML config - use the defaults or define your own phases like `ALPHA`, `RC`, `PRODUCTION`, etc.

**MCP Tools:**
- `kanban_get_work_item` - Get next recommended work item with reasoning
- `kanban_update_work_item` - Update story or subtask status with validation

**Slash Commands:** `/kanban-next`, `/kanban-board`, `/kanban-move`, `/kanban-list`, and more

[📖 Full Kanban Documentation](docs/kanban/)

### Memory Tool

Store and retrieve project knowledge with semantic search capabilities.

**Key Features:**
- Hybrid keyword + semantic search
- Automatic embedding generation
- Cosine similarity scoring
- Persistent storage with YAML
- Category-based organization

**Storage:** `cc-devtools/memory.yaml`

**MCP Tools:**
- `memory_store` - Store memories with optional categories and metadata
- `memory_search` - Search with filters, limits, and similarity thresholds

[📖 Full Memory Documentation](docs/memory/)

### Planner Tool

Create and manage implementation plans with tasks and dependencies.

**Key Features:**
- Plan creation with goals and implementation notes
- Task management with status tracking
- Hybrid search across plans and tasks
- Plan status updates (planning, in_progress, completed, on_hold)
- Task completion tracking with timestamps
- Work session pause/resume with context preservation
- 2 slash command templates included

**Storage:** `cc-devtools/planner/`

**MCP Tools:**
- `plan_store` - Create new implementation plans
- `plan_search` - Search plans with filters and semantic search
- `plan_update` - Update plan status and mark tasks complete

**Slash Commands:** `/plan-create`, `/plan-pause-work`, `/plan-resume-work`

**Session Management:**
The Planner tool includes powerful work session management via slash commands:
- `/plan-create` - Convert conversation into comprehensive tracked implementation plan
- `/plan-pause-work` - Save your current work context when stepping away
- `/plan-resume-work` - Resume work later with full context restoration
- Switch between multiple work streams effortlessly
- Preserve decisions and progress across sessions

See [Work Session Workflow](#work-session-workflow) below for detailed usage guide.

[📖 Full Planner Documentation](docs/planner/)

### Source Code Mapper Tool

Index and search your codebase with semantic understanding.

**Key Features:**
- Works out-of-the-box with comprehensive regex parsing for 30+ languages
- Three search modes: exact, fuzzy, and semantic
- Import graph tracking and querying
- File symbol extraction (functions, classes, interfaces, types, variables)
- Automatic index updates via file watching
- Efficient MessagePack storage
- No external dependencies required

**Storage:** `cc-devtools/.cache/source-code-index.msgpack`

**Language Support:**
- JavaScript/TypeScript (full support for functions, classes, interfaces, types, enums)
- Python (functions, classes, decorators)
- Go (functions, methods, structs, interfaces)
- Java/C# (classes, interfaces, methods)
- Rust (functions, structs, traits, impls)
- Ruby, PHP, C/C++, Swift, and 20+ more languages
- View stats: `npx cc-devtools scm stats`

**MCP Tools:**
- `search_code` - Search code symbols with configurable modes
- `query_imports` - Query import relationships and dependencies
- `get_file_info` - Get symbols and imports for specific files

[📖 Full Source Code Mapper Documentation](docs/source-code-mapper/)

### Documentation Indexer Tool

Index and search your documentation with semantic understanding.

**Key Features:**
- Works out-of-the-box with heuristic context generation (no LLM API calls)
- Multi-format support: Markdown, reStructuredText, AsciiDoc, plain text
- Three search modes: semantic, exact, and fuzzy
- Smart chunking based on document structure (headings, paragraphs)
- Automatic index updates via file watching
- Efficient MessagePack storage
- Fast context preview for quick result identification

**Storage:** `cc-devtools/.cache/documentation-index.msgpack`

**Format Support:**
- Markdown (`.md`, `.markdown`) - Full heading hierarchy, code blocks, lists
- reStructuredText (`.rst`) - Underline/overline headings, directives
- AsciiDoc (`.adoc`, `.asciidoc`) - Equal-sign headings, blocks
- Plain text (`.txt`) - Paragraph-based chunking

**MCP Tools:**
- `search_docs` - Search documentation with semantic/exact/fuzzy modes

[📖 Full Documentation Indexer Documentation](docs/documentation-indexer/)

### Clipboard Tool

Copy generated content directly to your system clipboard for easy pasting.

**Key Features:**
- Copy any text content to system clipboard
- Cross-platform support (macOS, Windows, Linux)
- No storage or configuration needed
- Instant availability for pasting

**Usage:**
When Claude generates content you want to use elsewhere, **explicitly ask** Claude to copy it to your clipboard:

```
You: "Can you create a summary of the API changes?"
Claude: "Here's a comprehensive summary of the API changes..."
You: "Copy that to my clipboard"
Claude: [Uses clipboard_write tool]
Claude: "✓ Summary copied to clipboard - ready to paste!"
```

**Important:** Claude will only use the clipboard tool when you explicitly request it. It won't automatically copy content.

**MCP Tool:**
- `clipboard_write` - Copy text content to system clipboard

**Use Cases:**
- Copy generated documentation for pasting into wikis
- Copy code snippets for use in other editors
- Copy summaries for sharing with team members
- Copy formatted content (markdown, code, etc.)

**Note:** The clipboard tool has no persistent storage - it simply provides a convenient way to transfer Claude's output to your clipboard.

### Workflow Tool

Automated solo developer workflow orchestration with state machine and AI-powered code reviews.

**Key Features:**
- Decision tree-based state machine guides workflow progression
- Analyzes git branch/status and kanban state to recommend next actions
- Orchestrates multiple AI reviewers in parallel for cross-validated code reviews
- Automated workflow progression: start work → implement → commit → review → merge → done
- Fully atomic operations (one git/kanban command at a time)
- Branch-based workflow with feature branch support
- Local-first (never auto-pushes to remote)
- Configurable decision trees and reviewer configurations
- 2 slash command templates included

**Storage:** `cc-devtools/workflow/` (config files), `workflow.log` (execution log)

**CLI Commands:**
- `npx cc-devtools workflow check` - Check current workflow state and get recommendations
- `npx cc-devtools workflow review` - Run automated code review with AI reviewers

**Slash Commands:** `/workflow-check`, `/workflow-start-review`

**Review System:**
The workflow includes a sophisticated automated review system that:
- Generates comprehensive review prompts with story context
- Runs multiple AI reviewers (Claude, Codex, Qwen, Gemini) in parallel
- Collects and stores all review outputs to kanban
- Supports cross-validation to identify false positives
- Configurable reviewer timeouts and arguments
- Stores false positives to memory for learning

**Workflow States:**
The state machine tracks git state (branch, clean status, commit messages) and kanban state (stories, subtasks, statuses) to determine current workflow state and recommend appropriate actions like:
- Starting new work on todo stories
- Creating feature branches
- Continuing implementation
- Moving to code review
- Running automated reviewers
- Merging completed work

**Customization:**
- **Decision Tree:** Fully customizable YAML decision tree (or use defaults)
- **Reviewers:** Configure any AI CLI tool as a reviewer
- **Review Prompt:** Customize the review prompt template (`cc-devtools/workflow/review-prompt.md`) to match your project's coding standards, security requirements, and review focus
- **Logging:** Configurable log levels (info, debug, error)
- **Integration:** Direct kanban imports or CLI mode

**Requirements:**
- **Kanban feature** - Workflow depends on kanban for state management (must be enabled together)
- **Output-style guidance** - ESSENTIAL for workflow to function. Setup will prompt you to generate this automatically. The workflow output-style tells Claude when to run `npx cc-devtools workflow check` and how to interpret the JSON results.

[📖 Full Workflow Documentation](docs/workflow/)

## Automated Workflow Orchestration

The workflow feature is an **automated solo developer workflow orchestrator** that analyzes your git and kanban state, makes intelligent decisions about what to do next, and guides Claude through a complete development workflow from story creation to code review to completion.

### How It Works

The workflow system is a **state machine** that:

1. **Analyzes State**: Reads git branch/status and kanban stories/subtasks via `npx cc-devtools workflow check`
2. **Makes Decisions**: Uses a YAML decision tree to determine current workflow state
3. **Guides Actions**: Returns actionable JSON telling Claude what to do next
4. **Orchestrates Reviews**: Runs multiple AI reviewers in parallel, cross-validates findings
5. **Automates Flow**: Automatically progresses through: start work → implement → commit → review → merge → done

**Key Principles:**
- **One thing in progress at a time** - No parallel work on multiple stories
- **Branch-based workflow** - Main branch only has `todo` and `done` stories
- **Feature branches** - Work happens on feature branches with `in_progress` and `in_review` stories
- **Local-first** - Git operations stay local (never auto-push)
- **AI-powered reviews** - Multiple AI reviewers provide cross-validated feedback

### Example Decision Flow

```
Is git clean?
├─ No → Commit or stash changes first
└─ Yes → Are we on a feature branch?
    ├─ No → On main branch
    │   └─ Any stories in progress?
    │       ├─ Yes → Create feature branch
    │       └─ No → Start next todo story
    └─ Yes → On feature branch
        └─ Current story status?
            ├─ in_progress → Continue implementing
            ├─ in_review → Run automated review
            └─ done → Merge to main and cleanup
```

### Setup and Usage

**1. Enable Workflow Feature**
```bash
# If setting up a new project
npx cc-devtools setup --features=kanban,workflow

# If adding to existing project
npx cc-devtools add-feature --features=workflow
```

**2. Generate Output-Style (REQUIRED)**

The workflow feature REQUIRES output-style guidance to function autonomously:

```bash
npx cc-devtools suggest-output-style
```

This creates essential workflow guidance that:
- Tells Claude when to automatically run `npx cc-devtools workflow check`
- Explains how to interpret and act on the JSON results
- Enables the self-perpetuating workflow loop

**Without output-style guidance**, Claude won't know when to run workflow checks or how to interpret results.

**3. Check Workflow State**

```bash
npx cc-devtools workflow check

# Output example:
{
  "state": "ready_to_start_work",
  "gitState": {
    "current_branch": "main",
    "clean": true
  },
  "kanbanState": {
    "next_item": {
      "id": "story-1",
      "title": "Implement user authentication",
      "status": "todo"
    }
  },
  "actionNecessary": "Start work on next todo story",
  "options": [
    {
      "option": "Start Story",
      "description": "Begin work on 'Implement user authentication'",
      "actionNecessary": "npx cc-devtools kanban update-work-item story-1 --status in_progress"
    }
  ]
}
```

**4. Run Automated Code Review**

When your story reaches `in_review` status:

```bash
# Run all enabled reviewers
npx cc-devtools workflow review

# Run specific reviewers only
npx cc-devtools workflow review claude codex
```

The review system:
- Generates comprehensive review prompt with story context
- Executes multiple AI CLIs in parallel (Claude, Codex, Qwen, Gemini)
- Collects all reviewer outputs
- Stores reviews to kanban story
- Supports cross-validation to identify false positives

### Typical User Experience

Once workflow is set up with output-style guidance, the workflow becomes **fully autonomous**. Here's what a typical session looks like:

**You:** "What should I work on?"

**Claude:**
- Automatically runs `npx cc-devtools workflow check`
- Analyzes the JSON output
- Determines you should start story-123: "Implement user authentication"
- Updates the story to `in_progress`
- Creates feature branch `feature/story-123`
- Begins implementing the feature

**Claude continues autonomously:**
- Writes code, makes commits with descriptive messages
- Periodically checks workflow state
- After completing each subtask, offers options:
  - **Option A**: Start next subtask
  - **Option B**: Stop for now (you can `/clear` and resume again with `Continue working`)
- When all subtasks are complete, moves story to `in_review`
- Asks you to run `/workflow-start-review` for code review

**You:** `/workflow-start-review`

**Claude:**
- Runs pre-research on the story and changes
- Generates comprehensive review prompt
- Executes multiple AI reviewers in parallel (Claude, Codex, etc.)
- Cross-validates findings across reviewers
- Presents issues in interactive table
- Creates subtasks for required changes OR approves the work
- If changes needed: implements them and repeats review
- If approved: merges to main, marks story done, moves to next story

**You:** "Continue"

**Claude:**
- Checks workflow state again
- Sees next todo story
- Starts the cycle over

**What happens behind the scenes:**
```bash
# Claude automatically runs these commands as needed:
npx cc-devtools workflow check
npx cc-devtools kanban update-work-item <id> --status <status>
git checkout -b feature/<story-id>
git add . && git commit -m "..."
npx cc-devtools kanban create-work-item (for subtasks)
git checkout main && git merge feature/<story-id>
```

**When Claude stops to ask you:**
- After completing each subtask (offers to continue with next subtask or stop)
- When implementation is complete and ready for review (asks you to run `/workflow-start-review`)
- When review findings need your approval/decision
- When there are blockers that need human input
- When all work is complete

### Configuration

The workflow system uses several YAML configuration files in `cc-devtools/workflow/`:

- **config.yaml** - Main workflow configuration
- **decision-tree.yaml** - State machine decision logic (customizable)
- **reviewers.yaml** - AI reviewer configuration (Claude, Codex, Qwen, Gemini)
- **review-prompt.md** - Review prompt template
- **round-1-guidance.md** / **round-2-guidance.md** / **round-3-plus-guidance.md** - Round-specific review guidance

### Customizing the Decision Tree

You can customize the workflow decision logic by editing `decision-tree.yaml` or creating your own:

```yaml
decisions:
  - name: root
    condition: "{{git_clean}} === true"
    if_true: check_branch
    if_false:
      state: uncommitted_changes
      action_type: suggest
      action: "Commit or stash your changes before proceeding"
```

See [Decision Tree Documentation](docs/workflow/DECISION_TREE.md) for full customization guide.

### Slash Commands

- **/workflow-check** - Quick workflow state check and recommendations
- **/workflow-start-review** - Comprehensive multi-phase code review with cross-validation

For complete workflow documentation, see [docs/workflow/](docs/workflow/)

### Technical Details

- **Storage:** Sessions saved in `cc-devtools/plans/` as YAML files
- **Identification:** Plans with `status="on_hold"`
- **Search:** `/plan-resume-work` searches for `on_hold` plans only
- **Automatic cleanup:** Completed sessions excluded from future searches
- **Persistence:** Sessions survive Claude Code restarts

See [Planner Slash Commands Documentation](docs/planner/SLASH_COMMANDS.md) for complete technical details and examples.

## Directory Structure

After setup, your project will have:

```
my-project/
├── package.json
├── node_modules/
│   └── @shaenchen/cc-devtools/
├── .mcp.json                  # MCP server configuration
├── .gitignore                 # Updated with cache exclusions
├── workflow.log               # Workflow execution log (gitignored)
├── .claude/
│   └── commands/              # Optional slash commands
└── cc-devtools/
    ├── kanban.yaml                  # Kanban data (created on first use)
    ├── memory.yaml                  # Memory storage (created on first use)
    ├── plans/                       # Planner storage (created on first use)
    ├── per-file-runner.yaml         # Per-file runner config
    ├── per-file-runner-state.yaml   # Per-file runner state tracking
    ├── workflow/                    # Workflow configuration (if enabled)
    │   ├── config.yaml              # Workflow settings
    │   ├── decision-tree.yaml       # Decision tree (optional custom)
    │   └── reviewers.yaml           # Reviewer configuration
    └── .cache/                      # Ephemeral cache files (gitignored)
        ├── source-code-index.msgpack     # Source code index
        ├── documentation-index.msgpack   # Documentation index
        ├── kanban-embeddings.msgpack     # Kanban search cache
        ├── memory-embeddings.msgpack     # Memory search cache
        ├── planner-embeddings.msgpack    # Planner search cache
        └── web-tokens.msgpack            # Web server auth tokens
```

## Configuration

### Setup Options

The `setup` command accepts these flags:

- `--features=<list>` - Comma-separated list of features to enable (kanban, memory, planner, source-code-mapper, documentation-indexer, workflow, clipboard)
- `--gitignore` - Update .gitignore with cache exclusions
- `--mcp` - Configure .mcp.json with MCP server entries
- `--slash-commands` - Copy slash command templates to .claude/commands/

### MCP Server Configuration

The setup command adds entries to `.mcp.json` like:

```json
{
  "mcpServers": {
    "cc-devtools-kanban": {
      "command": "node",
      "args": ["./node_modules/@shaenchen/cc-devtools/dist/kanban/mcp-server/index.js"],
      "disabled": false
    },
    "cc-devtools-memory": {
      "command": "node",
      "args": ["./node_modules/@shaenchen/cc-devtools/dist/memory/mcp-server/index.js"],
      "disabled": false
    }
  }
}
```

You can manually edit `.mcp.json` to:
- Disable specific tools (set `"disabled": true`)
- Change server names
- Adjust configuration

## Data Management

### Storage Locations

Each tool stores data in predictable locations:

- **Kanban:** `cc-devtools/kanban.yaml`
- **Memory:** `cc-devtools/memory.yaml`
- **Planner:** `cc-devtools/plans/*.yaml`
- **Source Code Mapper:** `cc-devtools/.cache/source-code-index.msgpack`
- **Documentation Indexer:** `cc-devtools/.cache/documentation-index.msgpack`

### Gitignore

The setup command adds these patterns to `.gitignore`:

```
# cc-devtools cache
cc-devtools/.cache
```

You should commit `cc-devtools/kanban.yaml`, `cc-devtools/memory.yaml`, and `cc-devtools/plans/` to version control to preserve project data.

### Backup and Migration

To backup or migrate your data:

1. Copy the entire `cc-devtools/` directory
2. Install `@shaenchen/cc-devtools` in the new project: `npm install @shaenchen/cc-devtools`
3. Run `npx cc-devtools setup` with desired features
4. Copy your backed-up `cc-devtools/` directory to the new project

## Troubleshooting

### MCP Servers Not Appearing in Claude Code

1. Verify the package is installed locally: `npm list @shaenchen/cc-devtools`
2. Check that `.mcp.json` exists and is valid JSON
3. Verify that `"disabled": false` for each server
4. Ensure paths point to `./node_modules/@shaenchen/cc-devtools/dist/...`
5. Restart Claude Code
6. Check Claude Code logs for MCP server errors

### "Cannot find module" Errors

If MCP servers fail to start with module errors:

1. Verify local installation: `npm list @shaenchen/cc-devtools`
2. Re-install if needed: `npm install @shaenchen/cc-devtools`
3. Rebuild the package: `npm run build` (if developing locally)
4. Check that `node_modules/@shaenchen/cc-devtools/dist/` exists

### Tool Commands Not Working

1. Ensure the package is installed locally: `npm list @shaenchen/cc-devtools`
2. Check that data files exist in `cc-devtools/`
3. Verify file permissions on `cc-devtools/` directory
4. Check for file locking issues (multiple processes)

### Build Issues

If you encounter build issues during development:

```bash
# Clean and rebuild
npm run clean
npm run build

# Verify TypeScript compilation
npx tsc --noEmit
```

### Data Corruption

If data files become corrupted:

1. Check YAML syntax with a validator
2. Restore from git history if committed
3. Review Claude Code logs for error details
4. Create a minimal test case and report as an issue

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- TypeScript 5.x

### Building from Source

```bash
# Clone the repository
git clone https://github.com/shaenchen/cc-devtools.git
cd cc-devtools

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# View test UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Testing

The project includes comprehensive test coverage:

- **427 tests** covering all tools
- **Unit tests** for business logic
- **Integration tests** for storage and file operations
- **Test helpers** for creating fixtures and mocking

Run tests with:

```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode
npm run test:ui           # Interactive UI
npm run test:coverage     # Coverage report
```

### Project Structure

```
cc-devtools/
├── src/
│   ├── cli/              # CLI entry point and utilities
│   ├── setup/            # Setup command implementation
│   ├── kanban/           # Kanban tool
│   │   ├── lib/          # Core business logic
│   │   └── mcp-server/   # MCP server
│   ├── memory/           # Memory tool
│   ├── planner/          # Planner tool
│   └── source-code-mapper/  # Source code mapper tool
├── tests/
│   ├── integration/      # Integration tests
│   └── unit/             # Unit tests
├── templates/            # Slash command templates
└── docs/                 # Tool-specific documentation
```

## CLI Commands Reference

Full list of available commands:

```
cc-devtools v0.1.0

A modular developer toolkit for Claude Code

Usage:
  npx cc-devtools <command> [options]

Commands:
  setup                       Setup cc-devtools in the current project
  status                      Show current configuration status
  add-feature                 Enable additional features
  remove-feature              Disable features
  suggest-output-style        Generate output-style suggestions for enabled features
  scm                         Source code mapper - manage code indexing and statistics
  kanban                      Kanban project management commands
  workflow                    Automated workflow state machine and code review
  web                         Start web interface for kanban and code editing
  per-file-runner             Run commands on files matching glob patterns with state tracking
  help                        Show this help message
  version                     Show version number

Examples:
  npx cc-devtools setup
  npx cc-devtools setup --features=kanban,memory
  npx cc-devtools status
  npx cc-devtools add-feature
  npx cc-devtools add-feature --features=planner
  npx cc-devtools remove-feature --features=memory --keep-data
  npx cc-devtools suggest-output-style
  npx cc-devtools scm install
  npx cc-devtools scm install rust go python
  npx cc-devtools scm list
  npx cc-devtools scm stats
  npx cc-devtools kanban list
  npx cc-devtools kanban get MVP-001
  npx cc-devtools workflow check
  npx cc-devtools workflow review
  npx cc-devtools workflow review claude codex
  npx cc-devtools web
  npx cc-devtools web --port 8080
  npx cc-devtools per-file-runner run my-config
  npx cc-devtools per-file-runner run-all
  npx cc-devtools per-file-runner automatic
```

For detailed documentation on specific commands, see the relevant sections above or run `npx cc-devtools <command> --help`.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

### Code Quality Standards

- No `any` types - use proper TypeScript types
- Prefer interfaces over inline types
- Resolve all linting and type errors
- Add tests for new functionality
- Follow existing code style and patterns

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Issues:** [GitHub Issues](https://github.com/shaenchen/cc-devtools/issues)
- **Documentation:** [docs/](docs/)
- **Claude Code:** https://claude.com/claude-code

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and migration notes.

## Acknowledgments

Built for use with [Claude Code](https://claude.com/claude-code) by Anthropic.

Uses the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for Claude Code integration.
