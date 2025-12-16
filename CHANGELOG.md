# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-12-16

### Fixed

- **Source Code Mapper**: Fixed catastrophic backtracking regex that caused parser to hang on TypeScript files with many braces. Replaced with efficient O(n) brace-counting algorithm.
- **Workflow Integration**: When workflow feature is enabled, "what to work on" trigger phrases now correctly use `workflow check` instead of `kanban_get_work_item` MCP tool.

### Changed

- **Documentation**: Clarified review command terminology in workflow templates.

## [0.2.0] - 2025-12-16

### Added

- **Documentation Indexer**: New tool for semantic documentation search. Indexes markdown documentation files and provides intelligent search across project docs.

### Fixed

- **CLI**: Version now reads from package.json instead of hardcoded value.
- **Tests**: Prevented flaky tests caused by temp directory collisions.

## [0.1.1] - 2025-11-17

### Fixed

- **Planner Search**: Fixed `on_hold` status not being included in `filterByStatus` function, which caused paused plans to not appear in search results.

## [0.1.0] - 2025-11-16

### Added - Initial Beta Release

#### Core Tools
- **Kanban Board** - Project management with stories, subtasks, and configurable workflow phases
- **Persistent Memory** - Store and search project knowledge with semantic search
- **Implementation Planner** - Create, track, and search implementation plans with work session management
- **Source Code Mapper** - Index and search codebase with semantic understanding (30+ languages)
- **Clipboard** - Copy generated content directly to system clipboard
- **Workflow Orchestration** - Automated solo developer workflow with state machine and AI code reviews

#### CLI Tools
- **Per-File Runner** - Batch process files with intelligent state tracking and MD5-based change detection
- **Setup Command** - Interactive setup with feature selection and configuration
- **Feature Management** - Add and remove features after initial setup
- **Source Code Mapper Stats** - View codebase indexing statistics
- **Output Style Generator** - Generate custom Claude Code output-style for enabled features

#### Web Application
- **Kanban Board** - Browser-based kanban with drag-and-drop and real-time updates
- **Code Editor** - Monaco-based code editor with syntax highlighting and file tree navigation
- **Remote Console** - Web-based terminal with multiple sessions, tab management, and persistent connections
- Token-based authentication with QR code support
- Persistent authentication tokens across server restarts
- WebSocket connections for real-time updates

#### Developer Experience
- Comprehensive test suite with 445 tests
- Full TypeScript support with strict type checking
- Custom type enforcement to prevent duplication and ensure composition
- ESLint configuration with zero warnings policy
- Slash command templates for all major tools
- Detailed documentation for each feature

### Features

- **MCP Integration** - Seamless integration with Claude Code via Model Context Protocol
- **Local-First** - All data stored in your project's `cc-devtools/` directory
- **File Watching** - Automatic updates for kanban and source code index
- **Hybrid Search** - Keyword + semantic search across all tools
- **Work Session Management** - Pause and resume work with full context preservation
- **Automated Code Reviews** - Parallel AI reviewers with cross-validation
- **Decision Tree Workflow** - Configurable state machine for workflow progression
- **Cross-Platform** - Support for macOS, Windows, and Linux

### Technical

- Node.js >= 18.0.0 required
- TypeScript 5.7+ with strict mode
- Vite-based web application build
- MessagePack for efficient binary storage
- YAML for human-readable configuration
- Vitest for testing with coverage support
- Express.js for web server
- VibeTunnel for terminal streaming

[1.0.0]: https://github.com/shaenchen/cc-devtools/releases/tag/v1.0.0
