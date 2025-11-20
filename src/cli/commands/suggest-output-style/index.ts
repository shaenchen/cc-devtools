import path from 'path';

import { fileExists, readJsonFile } from '../../utils/fs-utils.js';
import { confirm, input, select } from '../../utils/prompts.js';
import { ensureValidProjectRoot } from '../../utils/validation.js';

const FEATURE_INFO = {
  kanban: {
    name: 'Kanban',
    mcpServerName: 'cc-devtools-kanban',
  },
  memory: {
    name: 'Memory',
    mcpServerName: 'cc-devtools-memory',
  },
  planner: {
    name: 'Planner',
    mcpServerName: 'cc-devtools-planner',
  },
  'source-code-mapper': {
    name: 'Source Code Mapper',
    mcpServerName: 'cc-devtools-source-code-mapper',
  },
  'documentation-indexer': {
    name: 'Documentation Indexer',
    mcpServerName: 'cc-devtools-documentation-indexer',
  },
  workflow: {
    name: 'Workflow',
    mcpServerName: '',
  },
} as const;

type FeatureKey = keyof typeof FEATURE_INFO;

interface EnabledFeatures {
  kanban: boolean;
  memory: boolean;
  planner: boolean;
  'source-code-mapper': boolean;
  'documentation-indexer': boolean;
  workflow: boolean;
}

/**
 * Detect which features are enabled in .mcp.json and file system
 */
async function getEnabledFeatures(projectRoot: string): Promise<EnabledFeatures> {
  const mcpConfigPath = path.join(projectRoot, '.mcp.json');

  const enabled: EnabledFeatures = {
    kanban: false,
    memory: false,
    planner: false,
    'source-code-mapper': false,
    'documentation-indexer': false,
    workflow: false,
  };

  // Check MCP-based features
  if (fileExists(mcpConfigPath)) {
    const mcpConfig = await readJsonFile<{ mcpServers?: Record<string, { disabled?: boolean }> }>(mcpConfigPath);
    const servers = mcpConfig.mcpServers ?? {};

    for (const [key, info] of Object.entries(FEATURE_INFO)) {
      if (info.mcpServerName === '') {
        continue;
      }
      const server = servers[info.mcpServerName];
      if (server && server.disabled !== true) {
        enabled[key as FeatureKey] = true;
      }
    }
  }

  // Check workflow (CLI-only feature, not MCP-based)
  const workflowDataPath = path.join(projectRoot, 'cc-devtools', 'workflow');
  enabled.workflow = fileExists(workflowDataPath);

  return enabled;
}

/**
 * Read workflow template from templates directory
 */
async function getWorkflowTemplate(): Promise<string> {
  const fs = await import('fs/promises');

  const templatePath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
    '..',
    '..',
    'templates',
    'output-style',
    'workflow.md'
  );

  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read workflow template:', error);
    return '';
  }
}

/**
 * Generate frontmatter for a new output-style file
 */
function generateFrontmatter(name: string, enabled: EnabledFeatures): string {
  const mcpFeatures = Object.entries(enabled).filter(
    ([key, isEnabled]) => isEnabled && key !== 'workflow'
  );

  if (mcpFeatures.length === 0 && !enabled.workflow) {
    return `---
name: ${name}
description: Custom output style (no cc-devtools features enabled yet)
---

`;
  }

  const featureNames = mcpFeatures.map(([key]) => FEATURE_INFO[key as FeatureKey].name).join(', ');

  return `---
name: ${name}
description: Enhanced with cc-devtools: ${featureNames}
---

`;
}

/**
 * Generate output-style content based on enabled features (CONCISE VERSION)
 * Note: Workflow is excluded from this content as it's added as a separate XML block
 * Note: Frontmatter is NOT included - add it separately when creating new files
 */
function generateOutputStyleContent(enabled: EnabledFeatures): string {
  // Exclude workflow from the main cc-devtools block
  const mcpFeatures = Object.entries(enabled).filter(
    ([key, isEnabled]) => isEnabled && key !== 'workflow'
  );

  if (mcpFeatures.length === 0 && !enabled.workflow) {
    return `# Custom Output Style

No cc-devtools features are currently enabled. Run \`npx cc-devtools setup\` to enable features, then regenerate this output style.
`;
  }

  let content = `# cc-devtools Proactive Behavior

## Core Rules

**CRITICAL:** You cannot invoke slash commands (like \`/plan-pause-work\`, \`/kanban-add-stories\`). You can only **suggest** them to the user.

`;

  // Build "NEVER ask permission" section dynamically
  const neverAskItems: string[] = [];

  if (enabled.memory) {
    neverAskItems.push('Searching Memory (cc-devtools-memory memory_search)');
    neverAskItems.push('Storing decisions (cc-devtools-memory memory_store)');
  }

  if (enabled.planner) {
    neverAskItems.push('Searching for plans (cc-devtools-planner plan_search)');
  }

  if (enabled['source-code-mapper']) {
    neverAskItems.push(
      'Finding code/files (cc-devtools-source-code-mapper search_code, get_file_info, query_imports) - **ALWAYS use Source Code Mapper before Grep/Glob/Read for symbol searches**'
    );
  }

  if (enabled['documentation-indexer']) {
    neverAskItems.push(
      'Finding documentation (cc-devtools-documentation-indexer search_docs) - **ALWAYS use Documentation Indexer to search project documentation**'
    );
  }

  if (enabled.kanban) {
    neverAskItems.push('Getting work recommendations (cc-devtools-kanban kanban_get_work_item)');
    neverAskItems.push('Updating work status after completion (cc-devtools-kanban kanban_update_work_item)');
  }

  if (neverAskItems.length > 0) {
    content += `**NEVER ask permission** to use MCP tools when:\n`;
    for (const item of neverAskItems) {
      content += `- ${item}\n`;
    }
    content += '\n';
  }

  // Build "ALWAYS ask or suggest" section dynamically
  const alwaysAskItems: string[] = [];

  if (enabled.kanban) {
    alwaysAskItems.push('Creating stories/subtasks (suggest \\`/kanban-add-stories\\`)');
  }

  if (enabled.planner) {
    alwaysAskItems.push(
      'Work seems too large for current session - suggest creating a plan with \\`plan_store\\` (cc-devtools-planner) and confirm scope'
    );
  }

  alwaysAskItems.push('User needs to run a slash command');

  if (alwaysAskItems.length > 0) {
    content += `**ALWAYS ask or suggest** when:\n`;
    for (const item of alwaysAskItems) {
      content += `- ${item}\n`;
    }
    content += '\n';
  }

  // Kanban section
  if (enabled.kanban) {
    content += `## Kanban

**IMPORTANT:** **NEVER** read \`cc-devtools/kanban.yaml\` file directly. Use MCP tools or CLI instead.

**ALWAYS** use \`kanban_get_work_item\` (cc-devtools-kanban) when user asks what to work on (**NEVER** ask first)
**ALWAYS** use \`kanban_get_work_item(include_details=true)\` (cc-devtools-kanban) to get full details for current work item
**ALWAYS** use CLI \`npx cc-devtools kanban get <item-id>\` to get details for any specific story or subtask by ID (**NEVER** ask first)
**ALWAYS IMMEDIATELY** update status with \`kanban_update_work_item\` (cc-devtools-kanban) after completing work (**NEVER** ask "should I update?")
**ALWAYS** suggest \`/kanban-add-stories\` slash command for creating stories/subtasks (you **CANNOT** create via MCP tools)
**ALWAYS** update status to \`blocked\` when blocked, then ask user what's blocking them

`;
  }

  // Memory section
  if (enabled.memory) {
    content += `## Memory

**ALWAYS** search Memory first with \`memory_search\` (cc-devtools-memory) before answering "how/why/what" questions (**NEVER** ask)

**ALWAYS IMMEDIATELY** store to Memory with \`memory_store\` (cc-devtools-memory) when decisions are made (**NEVER** ask)

**ALWAYS** store:
- Why decisions were made (rationale, trade-offs)
- Architectural patterns, constraints, conventions
- API specs, technical limitations, gotchas

**NEVER** store:
- Implementation details (code documents that)
- Temporary todos, current work status

`;
  }

  // Planner section
  if (enabled.planner) {
    content += `## Planner

**CRITICAL:** Before starting any non-trivial implementation, evaluate if it can be completed in current session. If uncertain or work seems large (would risk filling context before completion), **ALWAYS create a plan first** with \`plan_store\` (cc-devtools-planner), then execute from the plan. **Better to over-plan than fail mid-execution due to context limits.**
**ALWAYS** search for paused work with \`plan_search\` (cc-devtools-planner) using \`status="on_hold"\` when user asks about resuming work
**ALWAYS** search for existing plans first with \`plan_search\` (cc-devtools-planner) before creating a new plan (avoid duplicates)
**ALWAYS** record progress with \`plan_update\` (cc-devtools-planner) using \`add_note\` to capture discoveries, blockers, or progress updates
**ALWAYS** mark tasks complete incrementally with \`plan_update\` (cc-devtools-planner) using \`task_updates\`, add new tasks with \`new_tasks\` as work evolves
**ALWAYS** update plan status through phases: \`planning\` → \`in_progress\` → \`completed\` (or \`on_hold\` to pause)
**ALWAYS** suggest user run \`/plan-pause-work\` when context is nearing capacity
**Use Planner for multi-session work with clear goals (use TodoWrite for single-session tasks)**

`;
  }

  // Source Code Mapper section
  if (enabled['source-code-mapper']) {
    content += `## Source Code Mapper

**CRITICAL:** Use source code mapper PROACTIVELY to find files before reading/editing. **NEVER** guess file paths or grep when you can search semantically.

**ALWAYS use \`search_code\` (cc-devtools-source-code-mapper) when:**
- User asks "where is X" or "find the code for Y" (**NEVER** ask permission)
- About to search for a function, class, type, or constant (**NEVER** use Grep/Glob first)
- Need to understand what code exists before planning implementation
- Looking for examples or patterns in the codebase

**ALWAYS use \`get_file_info\` (cc-devtools-source-code-mapper) when:**
- About to read/edit a file - get structure overview first
- Need to understand exports/imports before modifying
- Checking if a file has certain symbols before reading full content

**ALWAYS use \`query_imports\` (cc-devtools-source-code-mapper) when:**
- Before modifying code - understand impact on dependents
- Finding all usages of a module or file
- Understanding dependency relationships

**Search modes for \`search_code\`:**
- \`semantic\` (default): Find by purpose/description ("authentication logic", "user validation")
- \`exact\`: Exact name match ("handleAuth", "UserService")
- \`fuzzy\`: Typo-tolerant ("usrSrvce" finds "UserService")

**Filters available:**
- \`type\`: ['function', 'class', 'interface', 'type', 'const', 'enum']
- \`exported_only\`: true/false

`;
  }

  // Documentation Indexer section
  if (enabled['documentation-indexer']) {
    content += `## Documentation Indexer

**CRITICAL:** Use documentation indexer PROACTIVELY to find project documentation before asking the user or searching manually. **NEVER** grep for documentation when you can search semantically.

**ALWAYS use \`search_docs\` (cc-devtools-documentation-indexer) when:**
- User asks "how do I...", "what is...", or "where is documentation for..." (**NEVER** ask permission)
- Need to understand project architecture, patterns, or conventions
- Looking for setup instructions, configuration guides, or API documentation
- Searching for examples or best practices documented in the project
- Need to understand project-specific terminology or concepts

**What gets indexed:**
- Markdown files (README.md, docs/, etc.)
- API documentation
- Architecture decision records (ADRs)
- Contributing guidelines
- Project wikis and guides

**Search capabilities:**
- Semantic search: Find documentation by meaning, not just keywords
- Returns relevant sections with context
- Includes file paths and line numbers for reference

`;
  }

  // Tool combination patterns (concise)
  if (enabled.kanban && enabled.planner) {
    content += `
## Kanban + Planner Workflow

**Typical flow:**
1. User creates Kanban story with subtasks
2. When starting work on a **complex subtask**, create a Plan with \`plan_store\` (cc-devtools-planner) for implementation
3. Work through Plan tasks, marking them complete with \`plan_update\` (cc-devtools-planner) as you go
4. When Plan is done, mark both Plan status to \`completed\` with \`plan_update\` (cc-devtools-planner) and Kanban subtask to \`done\` with \`kanban_update_work_item\` (cc-devtools-kanban)

**Key insight:** Plans are for implementing **subtasks**, not for breaking down stories into subtasks.

`;
  }

  if (enabled.memory && (enabled.kanban || enabled.planner || enabled['source-code-mapper'])) {
    content += `
## Memory Integration

**ALWAYS** store key decisions to Memory with \`memory_store\` (cc-devtools-memory) after completing work (architecture, patterns, constraints)

**ALWAYS** search Memory with \`memory_search\` (cc-devtools-memory) for related context/decisions before starting work

`;
  }

  // Summary - build dynamically based on enabled features
  const summaryPoints: string[] = [];

  if (enabled['source-code-mapper']) {
    summaryPoints.push('Use Source Code Mapper first to find code (never guess paths).');
  }

  if (enabled['documentation-indexer']) {
    summaryPoints.push('Use Documentation Indexer first to find documentation (never grep manually).');
  }

  if (enabled.planner) {
    summaryPoints.push('Evaluate complexity before starting work - create plans proactively when uncertain.');
  }

  // Build dynamic "Be proactive" bullet based on enabled features
  const proactiveActions: string[] = [];

  if (enabled.memory || enabled['source-code-mapper'] || enabled['documentation-indexer']) {
    proactiveActions.push('search/store without asking');
  }

  proactiveActions.push("suggest slash commands (you can't invoke them)");

  if (enabled.kanban) {
    proactiveActions.push('update statuses');
  }

  if (enabled.planner) {
    proactiveActions.push('suggest \\`/plan-pause-work\\` when needed');
  }

  if (proactiveActions.length > 0) {
    summaryPoints.push(`Be proactive (${proactiveActions.join(', ')}), keep context clean.`);
  }

  if (summaryPoints.length > 0) {
    content += `
---

**Remember:**
`;
    for (const point of summaryPoints) {
      content += `- ${point}\n`;
    }
  }

  return content.trim() + '\n';
}

/**
 * Get the output-styles directory path
 * Always returns project-local path since output styles depend on local package installation
 */
function getOutputStylesDirectory(): string {
  return path.join(process.cwd(), '.claude', 'output-styles');
}

/**
 * List existing output-style files
 */
async function listExistingOutputStyles(): Promise<string[]> {
  const fs = await import('fs/promises');
  const outputStylesDir = getOutputStylesDirectory();

  if (!fileExists(outputStylesDir)) {
    return [];
  }

  try {
    const files = await fs.readdir(outputStylesDir);
    return files.filter(f => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

/**
 * Read an existing output-style file
 */
async function readOutputStyle(filename: string): Promise<string> {
  const fs = await import('fs/promises');
  const outputStylesDir = getOutputStylesDirectory();
  const filepath = path.join(outputStylesDir, filename);
  return fs.readFile(filepath, 'utf-8');
}

/**
 * Save output-style to a new file
 */
async function saveNewOutputStyle(content: string, name: string): Promise<void> {
  const fs = await import('fs/promises');
  const outputStylesDir = getOutputStylesDirectory();

  // Create directory if it doesn't exist
  await fs.mkdir(outputStylesDir, { recursive: true });

  // Sanitize filename
  const filename = name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.md';
  const filepath = path.join(outputStylesDir, filename);

  // Check if file exists
  if (fileExists(filepath)) {
    const overwrite = await confirm(`File ${filename} already exists. Overwrite?`, false);
    if (!overwrite) {
      console.log('\n❌ Cancelled. File not saved.\n');
      return;
    }
  }

  // Write file
  await fs.writeFile(filepath, content, 'utf-8');

  console.log(`\n✅ Output style saved to: ${filepath}`);
  console.log('\nTo use this output style in Claude Code:');
  console.log('  1. Restart Claude Code to detect the new output style');
  console.log(`  2. Run: /output-style ${name}`);
  console.log('  3. Or select it from: /output-style menu\n');
}

/**
 * Append cc-devtools section to an existing output-style
 */
async function appendToOutputStyle(
  ccDevtoolsContent: string,
  workflowContent: string,
  filename: string
): Promise<void> {
  const fs = await import('fs/promises');
  const outputStylesDir = getOutputStylesDirectory();
  const filepath = path.join(outputStylesDir, filename);

  // Read existing content
  const existingContent = await readOutputStyle(filename);

  // Check if cc-devtools section already exists
  const hasCcDevtools = existingContent.includes('<proactiveCcDevtoolsBehavior');
  const hasWorkflow = existingContent.includes('<automatedWorkflow');

  if (hasCcDevtools && workflowContent && !hasWorkflow) {
    console.log(`\n⚠️  This output-style already has a cc-devtools section but is missing workflow.`);
    console.log(`Only adding workflow section to: ${filepath}`);

    // Just append workflow section
    const updatedContent = existingContent.trimEnd() + '\n\n' + workflowContent + '\n';
    await fs.writeFile(filepath, updatedContent, 'utf-8');
    console.log(`\n✅ Appended workflow section to: ${filepath}\n`);
    return;
  }

  if (hasCcDevtools || hasWorkflow) {
    console.log(`\n⚠️  This output-style already has cc-devtools sections.`);
    console.log(`File not modified: ${filepath}`);
    console.log(`\nTo update the sections:`);
    console.log(`  1. Manually remove the existing "<proactiveCcDevtoolsBehavior>" and/or "<automatedWorkflow>" XML blocks`);
    console.log(`  2. Run this command again to append the updated sections\n`);
    return;
  }

  // Build content to append (workflow first, then cc-devtools)
  let contentToAppend = '';

  if (workflowContent) {
    contentToAppend = workflowContent;
  }

  if (ccDevtoolsContent) {
    // Wrap main content in XML block with 2-space indentation
    const indentedContent = ccDevtoolsContent
      .trim()
      .split('\n')
      .map(line => '  ' + line)
      .join('\n');

    const xmlWrappedContent = `<proactiveCcDevtoolsBehavior importance="critical">
${indentedContent}
</proactiveCcDevtoolsBehavior>`;

    if (contentToAppend) {
      // Add cc-devtools after workflow
      contentToAppend = contentToAppend.trimEnd() + '\n\n' + xmlWrappedContent;
    } else {
      // Only cc-devtools
      contentToAppend = xmlWrappedContent;
    }
  }

  // Append to end
  const updatedContent = existingContent.trimEnd() + '\n\n' + contentToAppend + '\n';
  await fs.writeFile(filepath, updatedContent, 'utf-8');
  console.log(`\n✅ Appended sections to: ${filepath}\n`);
}

/**
 * Suggest output-style command - generate and optionally save output-style based on enabled features
 */
export async function suggestOutputStyleCommand(): Promise<void> {
  console.log('✨ cc-devtools Output Style Suggestion\n');

  // Validate we're in a project root
  ensureValidProjectRoot();

  const projectRoot = process.cwd();

  // Check if package is installed
  const packagePath = path.join(projectRoot, 'node_modules', '@shaenchen', 'cc-devtools');
  const isInstalled = fileExists(packagePath);

  if (!isInstalled) {
    console.log('❌ Package not installed locally');
    console.log('\nPlease install first:');
    console.log('  npm install @shaenchen/cc-devtools\n');
    return;
  }

  // Detect enabled features
  const enabled = await getEnabledFeatures(projectRoot);
  const enabledCount = Object.values(enabled).filter(Boolean).length;

  console.log(`📊 Detected ${enabledCount} enabled feature(s):\n`);

  for (const [key, isEnabled] of Object.entries(enabled)) {
    const icon = isEnabled ? '✓' : '✗';
    console.log(`  ${icon} ${FEATURE_INFO[key as FeatureKey].name}`);
  }

  if (enabledCount === 0) {
    console.log('\n⚠️  No features are currently enabled.');
    console.log('\nRun setup to enable features:');
    console.log('  npx cc-devtools setup\n');
    return;
  }

  console.log('\n---\n');

  // Ask about workflow section (if enabled) - emphasize it's essential
  let includeWorkflow = false;
  let workflowContent = '';
  if (enabled.workflow) {
    console.log('🔧 Workflow Guidance (ESSENTIAL for workflow feature to work):\n');
    console.log('The workflow feature requires guidance in your output-style to function.');
    console.log('This tells Claude when and how to use the workflow automation.\n');
    includeWorkflow = await confirm('Include workflow guidance in output-style?', true);

    if (includeWorkflow) {
      workflowContent = await getWorkflowTemplate();
    }
    console.log();
  }

  // Ask about cc-devtools section (optional) - only if at least one MCP feature is enabled
  let includeCcDevtools = false;
  let ccDevtoolsContent = '';
  const hasMcpFeatures = Object.entries(enabled).some(
    ([key, isEnabled]) => isEnabled && key !== 'workflow'
  );

  if (hasMcpFeatures) {
    console.log('📚 CC-Devtools Proactive Behavior (OPTIONAL but recommended):\n');
    console.log('This adds guidance for Claude to use your enabled features proactively.');
    console.log('Without this, you\'ll need to explicitly tell Claude to use each tool.\n');
    includeCcDevtools = await confirm('Include cc-devtools proactive behavior guidance?', true);

    if (includeCcDevtools) {
      ccDevtoolsContent = generateOutputStyleContent(enabled);
    }
    console.log();
  }

  // If neither section selected, exit
  if (!includeWorkflow && !includeCcDevtools) {
    console.log('💡 No sections selected. You can run this command again to generate output-style.\n');
    return;
  }

  // Check for existing output-styles and ask create vs append FIRST
  const existingStyles = await listExistingOutputStyles();

  let action: 'create' | 'append' = 'create';

  if (existingStyles.length > 0) {
    console.log(`\n📁 Found ${existingStyles.length} existing output-style(s)\n`);

    const choice = await select('What would you like to do?', [
      { name: 'Create a new output-style', value: 'create' },
      { name: 'Append to an existing output-style', value: 'append' },
    ]);

    action = choice as 'create' | 'append';
    console.log();
  }

  // Generate display content based on action
  let displayContent = '';

  if (action === 'append') {
    // For append: wrap cc-devtools in XML (no frontmatter to strip!)
    let appendContent = '';

    if (includeWorkflow) {
      appendContent = workflowContent;
    }

    if (includeCcDevtools) {
      const indentedContent = ccDevtoolsContent
        .trim()
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');
      const xmlWrappedContent = `<proactiveCcDevtoolsBehavior importance="critical">\n${indentedContent}\n</proactiveCcDevtoolsBehavior>`;

      if (appendContent) {
        appendContent = appendContent.trimEnd() + '\n\n' + xmlWrappedContent;
      } else {
        appendContent = xmlWrappedContent;
      }
    }

    displayContent = appendContent;
  } else {
    // For create: add frontmatter + content (no XML wrapping for cc-devtools)
    const frontmatter = generateFrontmatter('cc-devtools-enhanced', enabled);
    let bodyContent = '';

    if (includeWorkflow && includeCcDevtools) {
      bodyContent = workflowContent.trimEnd() + '\n\n' + ccDevtoolsContent;
    } else if (includeWorkflow) {
      bodyContent = workflowContent;
    } else if (includeCcDevtools) {
      bodyContent = ccDevtoolsContent;
    }

    displayContent = frontmatter + bodyContent;
  }

  // Display the content
  const actionLabel = action === 'append' ? 'Content to Append' : 'New Output Style';
  console.log(`📝 ${actionLabel}:\n`);
  console.log('─'.repeat(80));
  console.log(displayContent);
  console.log('─'.repeat(80));

  // Ask if they want to save
  console.log();
  const shouldSave = await confirm('Save this output style?', true);

  if (!shouldSave) {
    console.log('\n💡 You can manually copy the content above to your output-style file.\n');
    return;
  }

  if (action === 'append') {
    // Let user select which output-style to append to
    const styleChoices = existingStyles.map(filename => ({
      name: filename.replace(/\.md$/, ''),
      value: filename,
    }));

    const selectedFile = await select('Select output-style to append to:', styleChoices);

    // Pass content directly (no frontmatter to strip since it was never added!)
    await appendToOutputStyle(
      includeCcDevtools ? ccDevtoolsContent : '',
      includeWorkflow ? workflowContent : '',
      selectedFile
    );
  } else {
    // Create new output-style
    const name = await input('Enter a name for the output style:', 'cc-devtools-enhanced');

    if (!name || name.trim() === '') {
      console.log('\n❌ Invalid name. Cancelled.\n');
      return;
    }

    // Update the name in the displayContent
    const finalContent = displayContent.replace(/^name: .+$/m, `name: ${name.trim()}`);

    await saveNewOutputStyle(finalContent, name.trim());
  }
}
