import path from 'path';

import { findClosestMatch } from '../core/suggestions.js';

import { fileExists } from './fs-utils.js';

import type { FeatureValidationResult } from './types.js';

/**
 * Check if the current directory is a valid project root
 */
export function isValidProjectRoot(projectRoot: string = process.cwd()): boolean {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  return fileExists(packageJsonPath);
}

/**
 * Validate feature names
 */
export function validateFeatures(features: string[]): FeatureValidationResult {
  const validFeatures = ['kanban', 'memory', 'planner', 'source-code-mapper', 'documentation-indexer', 'clipboard', 'workflow'];
  const valid: string[] = [];
  const invalid: string[] = [];
  const suggestions: Record<string, string | null> = {};

  for (const feature of features) {
    if (validFeatures.includes(feature)) {
      valid.push(feature);
    } else {
      invalid.push(feature);
      const suggestion = findClosestMatch(feature, validFeatures);
      suggestions[feature] = suggestion?.match ?? null;
    }
  }

  return { valid, invalid, suggestions };
}

/**
 * Ensure we're in a valid project root
 */
export function ensureValidProjectRoot(projectRoot: string = process.cwd()): void {
  if (!isValidProjectRoot(projectRoot)) {
    console.error('Error: package.json not found in current directory');
    console.error('Please run this command from the root of your project');
    process.exit(1);
  }
}

/**
 * Check if cc-devtools is enabled in the current project
 * (checks for existence of cc-devtools directory)
 */
export function isCcDevtoolsEnabled(projectRoot: string = process.cwd()): boolean {
  const ccDevtoolsPath = path.join(projectRoot, 'cc-devtools');
  return fileExists(ccDevtoolsPath);
}

/**
 * Ensure cc-devtools is enabled in the current project
 * This should be called for all commands except setup and help
 */
export function ensureCcDevtoolsEnabled(projectRoot: string = process.cwd()): void {
  // First check if we're in a valid project root
  if (!isValidProjectRoot(projectRoot)) {
    console.error('ERROR: Not in a valid project directory');
    console.error('');
    console.error('Current directory:', projectRoot);
    console.error('');
    console.error('This command requires a package.json file.');
    console.error('Please run this command from your project root directory.');
    console.error('');
    process.exit(2);
  }

  // Then check if cc-devtools is enabled
  if (!isCcDevtoolsEnabled(projectRoot)) {
    console.error('ERROR: cc-devtools is not enabled in this project');
    console.error('');
    console.error('The cc-devtools directory was not found.');
    console.error('');
    console.error('Current directory:', projectRoot);
    console.error('');
    console.error('Solutions:');
    console.error('  1. If this is a new project, run: npx cc-devtools setup');
    console.error('  2. If you already set up cc-devtools, make sure you are in the project root directory');
    console.error('  3. Check that the cc-devtools/ directory exists in your project');
    console.error('');
    process.exit(2);
  }
}
