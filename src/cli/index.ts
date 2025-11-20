#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { addFeatureCommand } from './commands/add-feature/index.js';
import { kanbanCommand } from './commands/kanban/index.js';
import { perFileRunnerCommand } from './commands/per-file-runner/index.js';
import { removeFeatureCommand } from './commands/remove-feature/index.js';
import { scmCommand } from './commands/scm/index.js';
import { setupCommand } from './commands/setup/index.js';
import { statusCommand } from './commands/status/index.js';
import { suggestOutputStyleCommand } from './commands/suggest-output-style/index.js';
import { webCommand } from './commands/web/index.js';
import { workflowCommand } from './commands/workflow/index.js';
import { formatErrorWithSuggestions } from './core/suggestions.js';
import { ensureCcDevtoolsEnabled } from './utils/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version as string;

interface CommandHandler {
  handler: (args: string[]) => Promise<void> | void;
  description: string;
}

const commands: Record<string, CommandHandler> = {
  setup: {
    handler: setupCommand,
    description: 'Setup cc-devtools in the current project',
  },
  status: {
    handler: statusCommand,
    description: 'Show current configuration status',
  },
  'add-feature': {
    handler: addFeatureCommand,
    description: 'Enable additional features',
  },
  'remove-feature': {
    handler: removeFeatureCommand,
    description: 'Disable features',
  },
  'suggest-output-style': {
    handler: suggestOutputStyleCommand,
    description: 'Generate output-style suggestions for enabled features',
  },
  'scm': {
    handler: scmCommand,
    description: 'Source code mapper - manage code indexing and statistics',
  },
  'kanban': {
    handler: kanbanCommand,
    description: 'Kanban project management commands',
  },
  'workflow': {
    handler: workflowCommand,
    description: 'Automated workflow state machine and code review',
  },
  'web': {
    handler: webCommand,
    description: 'Start web interface for kanban and code editing',
  },
  'per-file-runner': {
    handler: perFileRunnerCommand,
    description: 'Run commands on files matching glob patterns with state tracking',
  },
};

function showHelp(): void {
  console.log(`
cc-devtools v${VERSION}

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

For more information, visit: https://github.com/shaenchen/cc-devtools
`);
}

function showVersion(): void {
  console.log(`cc-devtools v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === 'version' || args[0] === '--version' || args[0] === '-v') {
    showVersion();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  const commandHandler = commands[command];

  if (!commandHandler) {
    const errorMessage = formatErrorWithSuggestions(command, Object.keys(commands), {
      type: 'command',
      helpCommand: 'npx cc-devtools help',
    });
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }

  // Commands that can run without cc-devtools being enabled
  const commandsWithoutValidation = ['setup'];

  // For all other commands, ensure cc-devtools is enabled in the current project
  if (!commandsWithoutValidation.includes(command)) {
    ensureCcDevtoolsEnabled();
  }

  try {
    await commandHandler.handler(commandArgs);
  } catch (error) {
    console.error(`Error executing command '${command}':`, error);
    process.exit(1);
  }
}

void main();
