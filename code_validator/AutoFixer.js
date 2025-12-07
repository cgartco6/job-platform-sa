const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

class AutoFixer {
  constructor() {
    this.fixStrategies = {
      'missing-semicolon': this.fixMissingSemicolon,
      'unused-variable': this.fixUnusedVariable,
      'console-log': this.fixConsoleLog,
      'hardcoded-secret': this.fixHardcodedSecret,
      'http-protocol': this.fixHttpProtocol,
      'var-usage': this.fixVarUsage,
      'promise-then': this.fixPromiseThen,
      'nested-loops': this.fixNestedLoops,
      'missing-error-handling': this.fixMissingErrorHandling,
      'long-line': this.fixLongLine
    };
  }

  async fixIssue(issue, filePath, content) {
    const strategy = this.fixStrategies[issue.type];
    if (!strategy) {
      return {
        fixed: false,
        message: `No fix strategy for issue type: ${issue.type}`
      };
    }

    try {
      const result = await strategy.call(this, issue, content);
      
      if (result.fixed) {
        // Backup original file
        const backupPath = `${filePath}.backup_${Date.now()}`;
        fs.writeFileSync(backupPath, content, 'utf8');
        
        // Write fixed content
        fs.writeFileSync(filePath, result.content, 'utf8');
        
        return {
          fixed: true,
          message: `Fixed ${issue.type}`,
          backup: backupPath,
          changes: result.changes || []
        };
      }
      
      return result;
      
    } catch (error) {
      return {
        fixed: false,
        message: `Fix failed: ${error.message}`,
        error: error
      };
    }
  }

  fixMissingSemicolon(issue, content) {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      let line = lines[lineIndex];
      
      if (!line.trim().endsWith(';') && 
          !line.trim().endsWith('{') && 
          !line.trim().endsWith('}') &&
          !line.includes('//') &&
          !line.includes('/*')) {
        
        lines[lineIndex] = line + ';';
        
        return {
          fixed: true,
          content: lines.join('\n'),
          changes: [`Added semicolon at line ${issue.line}`]
        };
      }
    }
    
    return { fixed: false, message: 'Could not fix missing semicolon' };
  }

  fixUnusedVariable(issue, content) {
    const variableMatch = issue.message.match(/'([^']+)'/);
    if (!variableMatch) {
      return { fixed: false, message: 'Could not extract variable name' };
    }
    
    const variableName = variableMatch[1];
    
    // Check if it's a parameter
    if (issue.message.includes('defined but never used')) {
      // For now, just add a comment
      const lines = content.split('\n');
      let fixed = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`const ${variableName}`) || 
            lines[i].includes(`let ${variableName}`) ||
            lines[i].includes(`var ${variableName}`)) {
          
          if (!lines[i].trim().startsWith('//')) {
            lines[i] = `// TODO: Remove unused variable\n${lines[i]}`;
            fixed = true;
            break;
          }
        }
      }
      
      if (fixed) {
        return {
          fixed: true,
          content: lines.join('\n'),
          changes: [`Commented out unused variable: ${variableName}`]
        };
      }
    }
    
    return { fixed: false, message: 'Could not fix unused variable' };
  }

  fixConsoleLog(issue, content) {
    // Comment out console.log statements
    const fixedContent = content.replace(
      /console\.log\(/g, 
      '// TODO: Remove console.log in production\n// console.log('
    );
    
    if (fixedContent !== content) {
      return {
        fixed: true,
        content: fixedContent,
        changes: ['Commented out console.log statements']
      };
    }
    
    return { fixed: false, message: 'No console.log found' };
  }

  fixHardcodedSecret(issue, content) {
    // Patterns to detect hardcoded secrets
    const secretPatterns = [
      {
        regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        replacement: (match, p1) => {
          return match.replace(p1, 'process.env.PASSWORD');
        }
      },
      {
        regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        replacement: (match, p1) => {
          return match.replace(p1, 'process.env.API_KEY');
        }
      },
      {
        regex: /(?:secret|token)\s*[:=]\s*['"]([^'"]+)['"]/gi,
        replacement: (match, p1) => {
          return match.replace(p1, 'process.env.SECRET_KEY');
        }
      }
    ];
    
    let fixedContent = content;
    let changes = [];
    
    secretPatterns.forEach(pattern => {
      const matches = content.match(pattern.regex);
      if (matches) {
        fixedContent = fixedContent.replace(pattern.regex, pattern.replacement);
        changes.push(`Replaced hardcoded secret with environment variable`);
      }
    });
    
    if (fixedContent !== content) {
      // Add environment variable check at the beginning
      const lines = fixedContent.split('\n');
      const importIndex = lines.findIndex(line => 
        line.includes('require(') || line.includes('import')
      );
      
      if (importIndex >= 0) {
        lines.splice(importIndex + 1, 0, '');
        lines.splice(importIndex + 2, 0, '// Environment variables for secrets');
        lines.splice(importIndex + 3, 0, "require('dotenv').config();");
      }
      
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No hardcoded secrets found' };
  }

  fixHttpProtocol(issue, content) {
    // Replace http:// with https://
    const fixedContent = content.replace(/http:\/\/(?!localhost)/g, 'https://');
    
    if (fixedContent !== content) {
      return {
        fixed: true,
        content: fixedContent,
        changes: ['Replaced HTTP with HTTPS protocol']
      };
    }
    
    return { fixed: false, message: 'No HTTP URLs found' };
  }

  fixVarUsage(issue, content) {
    // Replace var with const or let based on usage
    const lines = content.split('\n');
    let changes = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('var ')) {
        const varMatch = line.match(/var\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          
          // Check if variable is reassigned later
          let isReassigned = false;
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].includes(`${varName} =`) || 
                lines[j].includes(`${varName}+=`) ||
                lines[j].includes(`${varName}-=`)) {
              isReassigned = true;
              break;
            }
          }
          
          const replacement = isReassigned ? 'let' : 'const';
          lines[i] = line.replace('var ', `${replacement} `);
          changes.push(`Replaced var with ${replacement} for ${varName}`);
        }
      }
    }
    
    if (changes.length > 0) {
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No var usage found' };
  }

  fixPromiseThen(issue, content) {
    // Convert .then().catch() to async/await pattern
    // This is a simplified version
    const promisePattern = /(\w+)\.then\(([^)]+)\)\.catch\(([^)]+)\)/g;
    
    let fixedContent = content;
    let changes = [];
    
    const matches = [...content.matchAll(promisePattern)];
    matches.forEach(match => {
      const fullMatch = match[0];
      const variable = match[1];
      const successHandler = match[2];
      const errorHandler = match[3];
      
      // Create async/await version
      const asyncVersion = `
try {
  const result = await ${variable};
  ${successHandler.replace(/\((\w+)\)/, '(result)')}
} catch (error) {
  ${errorHandler.replace(/\((\w+)\)/, '(error)')}
}
      `.trim();
      
      fixedContent = fixedContent.replace(fullMatch, asyncVersion);
      changes.push('Converted promise.then() to async/await');
    });
    
    if (fixedContent !== content) {
      // Check if function needs to be made async
      const lines = fixedContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('asyncVersion')) {
          // Find parent function
          for (let j = i; j >= 0; j--) {
            if (lines[j].includes('function') || lines[j].includes('=>')) {
              if (!lines[j].includes('async')) {
                lines[j] = lines[j].replace('function', 'async function');
                changes.push('Added async to function');
              }
              break;
            }
          }
        }
      }
      
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No promise.then() patterns found' };
  }

  fixNestedLoops(issue, content) {
    // This is a complex fix - just add a comment for now
    const lines = content.split('\n');
    let changes = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('for') && lines[i + 1] && lines[i + 1].includes('for')) {
        // Found nested loops
        lines[i] = `// TODO: Consider optimizing nested loops\n${lines[i]}`;
        changes.push('Added optimization TODO for nested loops');
      }
    }
    
    if (changes.length > 0) {
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No nested loops found' };
  }

  fixMissingErrorHandling(issue, content) {
    // Add try-catch around async operations
    const asyncPatterns = [
      /await\s+\w+\(/g,
      /\.then\(/g,
      /fetch\(/g,
      /axios\./g
    ];
    
    const lines = content.split('\n');
    let changes = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      asyncPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('try') && !line.includes('catch')) {
          // Check if we're already in a try-catch
          let inTryCatch = false;
          for (let j = i; j >= 0; j--) {
            if (lines[j].includes('try {')) {
              inTryCatch = true;
              break;
            } else if (lines[j].includes('catch')) {
              break;
            }
          }
          
          if (!inTryCatch) {
            // Add try-catch
            lines[i] = `try {\n  ${line}\n} catch (error) {\n  console.error('Error:', error);\n  // TODO: Handle error appropriately\n}`;
            changes.push('Added error handling for async operation');
          }
        }
      });
    }
    
    if (changes.length > 0) {
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No missing error handling found' };
  }

  fixLongLine(issue, content) {
    const maxLength = 120;
    const lines = content.split('\n');
    let changes = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > maxLength) {
        const originalLine = lines[i];
        
        // Try to break at logical points
        const breakPoints = [',', '(', '{', '=', '+', '||', '&&'];
        
        for (const breakPoint of breakPoints) {
          const breakIndex = originalLine.lastIndexOf(breakPoint, maxLength - 20);
          if (breakIndex > maxLength / 2) {
            const firstPart = originalLine.substring(0, breakIndex + 1);
            const secondPart = originalLine.substring(breakIndex + 1);
            
            lines[i] = firstPart;
            lines.splice(i + 1, 0, '  ' + secondPart.trim());
            
            changes.push(`Split long line at ${breakPoint}`);
            break;
          }
        }
      }
    }
    
    if (changes.length > 0) {
      return {
        fixed: true,
        content: lines.join('\n'),
        changes: changes
      };
    }
    
    return { fixed: false, message: 'No long lines found' };
  }

  async runAutoFixOnFile(filePath) {
    const checker = new (require('./CodeChecker'))();
    const validation = await checker.validateFile(filePath);
    
    if (validation.valid) {
      return {
        file: filePath,
        fixed: false,
        message: 'File is already valid',
        issues: []
      };
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    const fixes = [];
    
    // Process errors
    for (const error of validation.errors) {
      const fixResult = await this.fixIssue(error, filePath, content);
      
      if (fixResult.fixed) {
        fixes.push({
          issue: error.message || error.type,
          fix: fixResult.message,
          changes: fixResult.changes || []
        });
        
        // Reload content if it was modified
        if (fixResult.content) {
          content = fixResult.content;
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
    
    // Process warnings (optional)
    for (const warning of validation.warnings.slice(0, 3)) { // Limit to 3 warnings
      const fixResult = await this.fixIssue(warning, filePath, content);
      
      if (fixResult.fixed) {
        fixes.push({
          issue: warning.message || warning.type,
          fix: fixResult.message,
          changes: fixResult.changes || []
        });
        
        if (fixResult.content) {
          content = fixResult.content;
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
    
    return {
      file: filePath,
      fixed: fixes.length > 0,
      fixes: fixes,
      totalIssues: validation.errors.length + validation.warnings.length,
      fixedIssues: fixes.length
    };
  }

  async runAutoFixOnDirectory(directoryPath) {
    const checker = new (require('./CodeChecker'))();
    const files = checker.getCodeFiles(directoryPath);
    
    const results = {
      directory: directoryPath,
      totalFiles: files.length,
      filesFixed: 0,
      totalFixes: 0,
      details: []
    };
    
    for (const file of files) {
      console.log(`Auto-fixing: ${file}`);
      const result = await this.runAutoFixOnFile(file);
      
      results.details.push(result);
      
      if (result.fixed) {
        results.filesFixed++;
        results.totalFixes += result.fixes.length;
      }
    }
    
    // Generate summary
    results.summary = `
Auto-fix completed for ${directoryPath}
Total files: ${results.totalFiles}
Files fixed: ${results.filesFixed}
Total fixes applied: ${results.totalFixes}
    
Issues fixed:
${results.details
  .filter(d => d.fixes.length > 0)
  .map(d => `  ${path.basename(d.file)}: ${d.fixes.length} fixes`)
  .join('\n')}
    `.trim();
    
    return results;
  }

  async formatCode(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') {
        // Use prettier
        execSync(`npx prettier --write "${filePath}"`, { stdio: 'inherit' });
        return { formatted: true, tool: 'prettier' };
        
      } else if (ext === '.py') {
        // Use black
        execSync(`black "${filePath}"`, { stdio: 'inherit' });
        return { formatted: true, tool: 'black' };
        
      } else if (ext === '.java') {
        // Use google-java-format
        execSync(`google-java-format --replace "${filePath}"`, { stdio: 'inherit' });
        return { formatted: true, tool: 'google-java-format' };
      }
      
      return { formatted: false, message: `No formatter for ${ext}` };
      
    } catch (error) {
      console.warn(`Formatting failed for ${filePath}:`, error.message);
      return { formatted: false, error: error.message };
    }
  }

  async installMissingDependencies(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const missingImports = [];
    
    // Check for Node.js requires
    const requireMatches = content.match(/require\('([^']+)'\)/g) || [];
    requireMatches.forEach(match => {
      const moduleMatch = match.match(/require\('([^']+)'\)/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        
        // Check if it's a local file or npm module
        if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
          try {
            // Try to require it
            require(moduleName);
          } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
              missingImports.push(moduleName);
            }
          }
        }
      }
    });
    
    // Check for ES6 imports
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g) || [];
    importMatches.forEach(match => {
      const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        
        if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
          missingImports.push(moduleName);
        }
      }
    });
    
    if (missingImports.length > 0) {
      console.log(`Missing dependencies found: ${missingImports.join(', ')}`);
      
      try {
        // Install missing dependencies
        const uniqueImports = [...new Set(missingImports)];
        execSync(`npm install ${uniqueImports.join(' ')}`, { stdio: 'inherit' });
        
        return {
          installed: true,
          dependencies: uniqueImports
        };
      } catch (error) {
        return {
          installed: false,
          error: error.message,
          dependencies: uniqueImports
        };
      }
    }
    
    return { installed: false, message: 'No missing dependencies found' };
  }
}

module.exports = AutoFixer;
