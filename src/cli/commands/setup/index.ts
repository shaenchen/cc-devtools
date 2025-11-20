import path from 'path';

import { initCommand } from '../kanban/init.js';
import { suggestOutputStyleCommand } from '../suggest-output-style/index.js';

import { ensureDir, copyFile, fileExists } from '../../utils/fs-utils.js';
import { addToGitignore } from '../../utils/gitignore.js';
import { addMcpServer } from '../../utils/mcp-config.js';
import { confirm, multiSelect } from '../../utils/prompts.js';
import { ensureValidProjectRoot, validateFeatures } from '../../utils/validation.js';

import type { SetupOptions } from '../../types.js';

/**
 * Parse command-line flags for setup command
 */
function parseSetupArgs(args: string[]): SetupOptions {
  const options: SetupOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--features=')) {
      const featuresStr = arg.split('=')[1];
      options.features = featuresStr.split(',').map(f => f.trim());
    } else if (arg === '--gitignore') {
      options.gitignore = true;
    } else if (arg === '--no-gitignore') {
      options.gitignore = false;
    } else if (arg === '--mcp') {
      options.mcp = true;
    } else if (arg === '--no-mcp') {
      options.mcp = false;
    } else if (arg === '--slash-commands') {
      options.slashCommands = true;
    } else if (arg === '--no-slash-commands') {
      options.slashCommands = false;
    }
  }

  return options;
}

/**
 * Get feature selection (from flags or interactive prompt)
 */
async function getFeatureSelection(providedFeatures?: string[]): Promise<string[]> {
  if (providedFeatures) {
    const { valid, invalid, suggestions } = validateFeatures(providedFeatures);

    if (invalid.length > 0) {
      console.error(`Error: Invalid features: ${invalid.join(', ')}`);

      for (const invalidFeature of invalid) {
        const suggestion = suggestions[invalidFeature];
        if (suggestion) {
          console.error(`  Did you mean '${suggestion}' instead of '${invalidFeature}'?`);
        }
      }

      console.error('\nValid features: kanban, memory, planner, source-code-mapper, documentation-indexer, clipboard, workflow');
      process.exit(1);
    }

    return valid;
  }

  // Interactive selection
  const choices = [
    {
      name: 'Kanban',
      value: 'kanban',
      description: 'Project management with kanban board',
    },
    {
      name: 'Memory',
      value: 'memory',
      description: 'Persistent memory for Claude Code',
    },
    {
      name: 'Planner',
      value: 'planner',
      description: 'Implementation planning and tracking',
    },
    {
      name: 'Source Code Mapper',
      value: 'source-code-mapper',
      description: 'Semantic code search and mapping',
    },
    {
      name: 'Documentation Indexer',
      value: 'documentation-indexer',
      description: 'Semantic documentation search',
    },
    {
      name: 'Clipboard',
      value: 'clipboard',
      description: 'Copy content to system clipboard',
    },
    {
      name: 'Workflow',
      value: 'workflow',
      description: 'Automated workflow and code review (requires kanban)',
    },
  ];

  return multiSelect(
    'Which features would you like to enable?',
    choices,
    ['kanban', 'memory', 'planner', 'source-code-mapper', 'documentation-indexer', 'clipboard', 'workflow'], // Default to all features
    {
      workflow: ['kanban'], // Workflow requires kanban
    }
  );
}

/**
 * Setup MCP server configuration for a feature
 */
async function setupMcpServer(feature: string, projectRoot: string): Promise<void> {
  const packageRoot = path.join(projectRoot, 'node_modules', '@shaenchen', 'cc-devtools');
  const mcpServerPath = path.join(packageRoot, 'dist', feature, 'index.js');

  const serverName = `cc-devtools-${feature}`;

  await addMcpServer(serverName, {
    command: 'node',
    args: [mcpServerPath],
    disabled: false,
  }, projectRoot);

  console.log(`  ✓ Added MCP server: ${serverName}`);
}

/**
 * Copy slash command templates for a feature
 */
async function copySlashCommands(feature: string, projectRoot: string): Promise<void> {
  const packageRoot = path.join(projectRoot, 'node_modules', '@shaenchen', 'cc-devtools');
  const featureTemplatesDir = path.join(packageRoot, 'templates', 'commands', feature);
  const destDir = path.join(projectRoot, '.claude', 'commands');

  // Check if templates exist for this feature
  if (!fileExists(featureTemplatesDir)) {
    // Silently skip features without slash commands
    return;
  }

  // Ensure destination directory exists
  await ensureDir(destDir);

  // Copy all template files from the feature directory
  const fs = await import('fs/promises');
  const files = await fs.readdir(featureTemplatesDir);

  let copiedCount = 0;
  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    const src = path.join(featureTemplatesDir, file);
    const dest = path.join(destDir, file);

    // Check if file already exists
    if (fileExists(dest)) {
      console.log(`  ⚠ Slash command already exists: ${file} (skipping)`);
      continue;
    }

    await copyFile(src, dest);
    copiedCount++;
  }

  if (copiedCount > 0) {
    console.log(`  ✓ Copied ${copiedCount} slash command(s) for ${feature}`);
  }
}

/**
 * Setup workflow configuration files
 */
async function setupWorkflow(projectRoot: string): Promise<void> {
  const packageRoot = path.join(projectRoot, 'node_modules', '@shaenchen', 'cc-devtools');
  const workflowDir = path.join(projectRoot, 'cc-devtools', 'workflow');
  const templatesDir = path.join(packageRoot, 'templates', 'workflow');

  // Create workflow directory
  await ensureDir(workflowDir);

  // Copy workflow config files from templates
  const configFiles = [
    'config.yaml',
    'decision-tree.yaml',
    'reviewers.yaml',
    'review-prompt.md',
    'round-1-guidance.md',
    'round-2-guidance.md',
    'round-3-plus-guidance.md',
  ];

  let allFilesExisted = true;
  for (const configFile of configFiles) {
    const src = path.join(templatesDir, configFile);
    const dest = path.join(workflowDir, configFile);

    // Only copy if file doesn't exist
    if (!fileExists(dest)) {
      await copyFile(src, dest);
      allFilesExisted = false;
    }
  }

  if (allFilesExisted) {
    console.log('  ℹ Workflow configuration already exists (skipping)');
    return;
  }

  console.log('  Created workflow configuration with the following defaults:');
  console.log('    • Decision tree: 23 workflow states (story/subtask lifecycle)');
  console.log('    • Enabled reviewers: Claude, Codex');
  console.log('    • Disabled reviewers: Qwen, Gemini (can be enabled)');
  console.log('    • Review timeout: 15 minutes per reviewer');
  console.log('    • Logging: Disabled (enable in config.yaml for debugging)');
  console.log('');
  console.log('  Customize workflow behavior by editing:');
  console.log('    • cc-devtools/workflow/config.yaml - Main settings');
  console.log('    • cc-devtools/workflow/decision-tree.yaml - Workflow states');
  console.log('    • cc-devtools/workflow/reviewers.yaml - Reviewer configuration');
  console.log('    • cc-devtools/workflow/review-prompt.md - Review prompt template');
  console.log('    • cc-devtools/workflow/round-*-guidance.md - Round-specific guidance');
}

/**
 * Check if the package is installed locally
 */
function checkLocalInstallation(projectRoot: string): void {
  const packagePath = path.join(projectRoot, 'node_modules', '@shaenchen', 'cc-devtools');

  if (!fileExists(packagePath)) {
    console.error('❌ Error: @shaenchen/cc-devtools is not installed locally.\n');
    console.error('The MCP servers require the package to be installed in node_modules/.\n');
    console.error('Please install the package first:');
    console.error('  npm install @shaenchen/cc-devtools\n');
    console.error('Then run setup again:');
    console.error('  npx cc-devtools setup\n');
    process.exit(1);
  }
}

/**
 * Main setup command
 */
export async function setupCommand(args: string[]): Promise<void> {
  console.log('🛠️  cc-devtools setup\n');

  // Validate we're in a project root
  ensureValidProjectRoot();

  const projectRoot = process.cwd();

  // Check that package is installed locally
  checkLocalInstallation(projectRoot);

  const options = parseSetupArgs(args);

  // Get feature selection
  const features = await getFeatureSelection(options.features);

  if (features.length === 0) {
    console.log('No features selected. Exiting.');
    return;
  }

  console.log(`\nSelected features: ${features.join(', ')}\n`);

  // Ask about gitignore (if not specified via flag)
  const shouldUpdateGitignore = options.gitignore ?? await confirm('Add cc-devtools/.cache to .gitignore?', true);

  // Ask about MCP configuration (if not specified via flag)
  const shouldConfigureMcp = options.mcp ?? await confirm('Configure MCP servers in .mcp.json?', true);

  // Ask about slash commands (if not specified via flag)
  const shouldCopySlashCommands = options.slashCommands ?? await confirm('Copy slash command templates to .claude/commands/?', true);

  console.log('\n📦 Setting up cc-devtools...\n');

  // Create cc-devtools directory
  const ccDevtoolsDir = path.join(projectRoot, 'cc-devtools');
  await ensureDir(ccDevtoolsDir);
  console.log('✓ Created cc-devtools directory');

  // Create cache directory
  const cacheDir = path.join(ccDevtoolsDir, '.cache');
  await ensureDir(cacheDir);
  console.log('✓ Created cc-devtools/.cache directory');

  // Update .gitignore
  if (shouldUpdateGitignore) {
    const added = await addToGitignore(projectRoot);
    if (added) {
      console.log('✓ Added cc-devtools/.cache to .gitignore');
    } else {
      console.log('✓ cc-devtools/.cache already in .gitignore');
    }
  }

  // Check workflow dependency on kanban
  if (features.includes('workflow') && !features.includes('kanban')) {
    console.error('\n❌ Error: Workflow feature requires kanban feature');
    console.error('Please enable kanban when using workflow.\n');
    process.exit(1);
  }

  // Configure MCP servers
  if (shouldConfigureMcp) {
    console.log('\n📡 Configuring MCP servers:');
    for (const feature of features) {
      // Skip MCP server setup for workflow (it's CLI-only)
      if (feature === 'workflow') {
        continue;
      }
      await setupMcpServer(feature, projectRoot);
    }
  }

  // Copy slash commands
  if (shouldCopySlashCommands) {
    console.log('\n📝 Copying slash command templates:');
    for (const feature of features) {
      await copySlashCommands(feature, projectRoot);
    }
  }

  // Setup workflow configuration if workflow feature is enabled
  if (features.includes('workflow')) {
    console.log('\n⚙️  Setting up workflow configuration:');
    await setupWorkflow(projectRoot);
  }

  // Initialize kanban system if kanban feature is enabled
  if (features.includes('kanban')) {
    console.log('\n🗂️  Initializing kanban system:');
    try {
      const result = await initCommand([], {});
      if (result.success) {
        // @inline-type-allowed - one-off type assertion for init command result
        const data = result.data as { fixes?: string[]; issues?: Array<{ type: string; message: string }> };
        if (data?.fixes && data.fixes.length > 0) {
          // Print each fix message
          for (const fix of data.fixes) {
            console.log(`  ${fix}`);
          }
        } else if (!data?.issues || data.issues.filter(i => i.type === 'ERROR').length === 0) {
          console.log('  ✓ Kanban system validated');
        }
      }
    } catch (_error) {
      console.error('  ⚠ Warning: Failed to initialize kanban system');
      console.error('  You can initialize it manually: npx cc-devtools kanban init');
    }
  }

  // Core setup complete, now optional steps
  console.log('\n✅ Core setup complete!\n');
  console.log('📋 Optional enhancements (recommended):\n');

  // Generate output style (will ask specific questions about what to include)
  console.log('🎨 Output Style Generation:\n');
  try {
    await suggestOutputStyleCommand();
  } catch (error) {
    console.error('\n❌ Failed to generate output style:', error);
    console.error('You can run it manually later with: npx cc-devtools suggest-output-style\n');
  }

  // Source code mapper is ready to use
  if (features.includes('source-code-mapper')) {
    console.log('\nThe source code mapper uses regex-based parsing for 50+ languages.');
    console.log('No additional setup required - it\'s ready to use!\n');
  }

  // All done
  console.log('\n✅ Setup complete!\n');
  console.log('📋 Next steps:');

  let stepNumber = 1;

  if (shouldConfigureMcp) {
    console.log(`  ${stepNumber}. Restart Claude Code to load the MCP servers`);
    stepNumber++;
  }

  // Output style step is no longer needed here since we always run it during setup

  console.log(`  ${stepNumber}. Start using cc-devtools features:`);
  for (const feature of features) {
    console.log(`     - ${feature}`);
  }
  stepNumber++;


  console.log('\nFor more information, run: npx cc-devtools help');
}
