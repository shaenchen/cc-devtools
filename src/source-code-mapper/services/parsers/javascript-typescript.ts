/**
 * Parse JavaScript/TypeScript files with comprehensive regex patterns
 * Extracts: functions, arrow functions, classes, methods, interfaces, types, enums, constants
 */

import { matchAll, getLineNumber, getCapture, createSymbol, createImport } from './types.js';

import type { Parser, SymbolInfo, Import } from './types.js';

/**
 * Check if a position in the content is inside a class body.
 * Uses brace counting instead of regex to avoid catastrophic backtracking.
 */
function isInsideClass(content: string, position: number): boolean {
  const before = content.substring(0, position);

  // Find the last class declaration before this position
  const classPattern = /\bclass\s+\w+/g;
  let lastClassIndex = -1;
  let match;
  while ((match = classPattern.exec(before)) !== null) {
    lastClassIndex = match.index;
  }

  if (lastClassIndex === -1) return false;

  // Count braces between class keyword and current position
  // If braceCount > 0, we're inside the class body
  let braceCount = 0;
  for (let i = lastClassIndex; i < position; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
  }

  return braceCount > 0;
}

const parseJavaScriptTypeScript : Parser = (filePath, content, _lines) => {
  const symbols: SymbolInfo[] = [];
  const imports: Import[] = [];

  // Parse imports - enhanced to handle more patterns
  const importRegex = /^\s*import\s+(?:(?:{([^}]+)}|(\*\s+as\s+\w+|\w+))\s+from\s+)?['"]([^'"]+)['"]/gm;
  for (const match of matchAll(importRegex, content)) {
    const namedImports = getCapture(match, 1);
    const defaultImport = getCapture(match, 2);
    const source = getCapture(match, 3);

    const imported: string[] = [];
    if (namedImports) {
      imported.push(...namedImports.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()));
    }
    if (defaultImport) {
      imported.push(defaultImport.trim());
    }

    imports.push(createImport(source, imported));
  }

  // 1. Regular function declarations (including async, generator, and export variations)
  const functionRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)/gm;
  for (const match of matchAll(functionRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 1);
    const generics = getCapture(match, 2);
    const params = getCapture(match, 3);
    const startLine = getLineNumber(content, match.index);

    symbols.push(createSymbol(name, 'function', startLine, filePath, {
      isExported,
      signature: `${generics}(${params})`
    }));
  }

  // 2. Arrow functions (const/let/var with arrow function assignment)
  const arrowFunctionRegex = /^\s*(?:export\s+)?(const|let|var)\s+(\w+)\s*:\s*[^=]*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/gm;
  for (const match of matchAll(arrowFunctionRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 2);
    const params = getCapture(match, 3);
    const startLine = getLineNumber(content, match.index);

    const isDuplicate = symbols.some((s) => s.name === name && s.startLine === startLine);
    if (!isDuplicate) {
      symbols.push(createSymbol(name, 'function', startLine, filePath, {
        isExported,
        signature: `(${params})`
      }));
    }
  }

  // 2b. Arrow functions without type annotation
  const arrowFunctionSimpleRegex = /^\s*(?:export\s+)?(const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/gm;
  for (const match of matchAll(arrowFunctionSimpleRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 2);
    const params = getCapture(match, 3);
    const startLine = getLineNumber(content, match.index);

    const isDuplicate = symbols.some((s) => s.name === name && s.startLine === startLine);
    if (!isDuplicate) {
      symbols.push(createSymbol(name, 'function', startLine, filePath, {
        isExported,
        signature: `(${params})`
      }));
    }
  }

  // 3. Classes (including abstract and default export)
  const classRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+[\w<>,.]+)?(?:\s+implements\s+[\w<>,.]+)?\s*\{/gm;
  for (const match of matchAll(classRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 1);
    const startLine = getLineNumber(content, match.index);

    symbols.push(createSymbol(name, 'class', startLine, filePath, {
      isExported
    }));
  }

  // 4. Class methods (including static, async, getters, setters, constructors)
  const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(?:\b(get|set)\s+)?(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?\s*\{/gm;
  for (const match of matchAll(methodRegex, content)) {
    const getSetPrefix = getCapture(match, 1); // "get" or "set" or empty
    const baseName = getCapture(match, 2);
    const generics = getCapture(match, 3);
    const params = getCapture(match, 4);
    const startLine = getLineNumber(content, match.index);

    // Construct full name including get/set prefix
    const name = getSetPrefix ? `${getSetPrefix}${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}` : baseName;

    // Skip if it's likely a standalone function we already captured
    if (symbols.some((s) => s.name === name && s.type === 'function' && Math.abs(s.startLine - startLine) < 2)) {
      continue;
    }

    // Check if this is inside a class using efficient brace counting
    if (isInsideClass(content, match.index)) {
      const isPrivate = match[0].includes('private');
      symbols.push(createSymbol(name, 'function', startLine, filePath, {
        isExported: !isPrivate,
        signature: `${generics}(${params})`
      }));
    }
  }

  // 5. Interfaces
  const interfaceRegex = /^\s*(?:export\s+)?interface\s+(\w+)(<[^>]*>)?\s*(?:extends\s+[\w<>,.]+)?\s*\{/gm;
  for (const match of matchAll(interfaceRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 1);
    const generics = getCapture(match, 2);
    const startLine = getLineNumber(content, match.index);

    symbols.push(createSymbol(name, 'interface', startLine, filePath, {
      isExported,
      signature: generics
    }));
  }

  // 6. Type aliases
  const typeRegex = /^\s*(?:export\s+)?type\s+(\w+)(<[^>]*>)?\s*=/gm;
  for (const match of matchAll(typeRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 1);
    const generics = getCapture(match, 2);
    const startLine = getLineNumber(content, match.index);

    symbols.push(createSymbol(name, 'type', startLine, filePath, {
      isExported,
      signature: generics
    }));
  }

  // 7. Enums
  const enumRegex = /^\s*(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/gm;
  for (const match of matchAll(enumRegex, content)) {
    const isExported = match[0].includes('export');
    const name = getCapture(match, 1);
    const startLine = getLineNumber(content, match.index);

    symbols.push(createSymbol(name, 'enum', startLine, filePath, {
      isExported
    }));
  }

  // 8. Exported constants (but avoid duplicating functions)
  const constRegex = /^\s*export\s+(const|let|var)\s+(\w+)(?:\s*:\s*[^=]+)?\s*=/gm;
  for (const match of matchAll(constRegex, content)) {
    const name = getCapture(match, 2);
    if (!name) continue;
    const startLine = getLineNumber(content, match.index);

    // Skip if already captured as a function
    const isDuplicate = symbols.some((s) => s.name === name && Math.abs(s.startLine - startLine) < 2);
    if (!isDuplicate) {
      symbols.push(createSymbol(name, 'const', startLine, filePath, {
        isExported: true
      }));
    }
  }

  return { symbols, imports };
};

export default parseJavaScriptTypeScript;
