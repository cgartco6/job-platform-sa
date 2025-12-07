const fs = require('fs');
const path = require('path');
const esprima = require('esprima');
const eslint = require('eslint');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class CodeChecker {
  constructor() {
    this.rules = {
      syntax: true,
      security: true,
      performance: true,
      style: true,
      bestPractices: true,
      complexity: true
    };
    
    this.thresholds = {
      maxComplexity: 10,
      maxLinesPerFunction: 50,
      maxFileSizeKB: 500,
      maxDepth: 4,
      maxParams: 5
    };
    
    this.eslintConfig = {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      rules: {
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-unused-vars': 'warn',
        'no-undef': 'error',
        'eqeqeq': 'error',
        'curly': 'error',
        'semi': ['error', 'always'],
        'indent': ['error', 2],
        'quotes': ['error', 'single'],
        'no-var': 'error',
        'prefer-const': 'warn',
        'no-eval': 'error',
        'no-alert': 'error'
      }
    };
  }

  async validateFile(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeKB = stats.size / 1024;
      
      if (fileSizeKB > this.thresholds.maxFileSizeKB) {
        return {
          valid: false,
          errors: [`File too large: ${fileSizeKB.toFixed(2)}KB exceeds ${this.thresholds.maxFileSizeKB}KB limit`]
        };
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      
      const results = {
        filePath,
        valid: true,
        warnings: [],
        errors: [],
        metrics: {},
        suggestions: []
      };
      
      // Check syntax
      if (this.rules.syntax) {
        const syntaxCheck = await this.checkSyntax(content, ext);
        results.valid = results.valid && syntaxCheck.valid;
        results.errors.push(...syntaxCheck.errors);
      }
      
      // Check for security issues
      if (this.rules.security) {
        const securityCheck = this.checkSecurity(content, ext);
        results.errors.push(...securityCheck.errors);
        results.warnings.push(...securityCheck.warnings);
      }
      
      // Check complexity
      if (this.rules.complexity && (ext === '.js' || ext === '.jsx')) {
        const complexityCheck = this.checkComplexity(content);
        results.metrics.complexity = complexityCheck.complexity;
        results.metrics.functions = complexityCheck.functions;
        
        if (complexityCheck.complexity > this.thresholds.maxComplexity) {
          results.warnings.push(`High complexity: ${complexityCheck.complexity} (max: ${this.thresholds.maxComplexity})`);
        }
      }
      
      // Run ESLint for JavaScript files
      if ((ext === '.js' || ext === '.jsx') && this.rules.style) {
        const eslintResults = await this.runESLint(content);
        results.errors.push(...eslintResults.errors);
        results.warnings.push(...eslintResults.warnings);
      }
      
      // Check for TypeScript if applicable
      if (ext === '.ts' || ext === '.tsx') {
        const tsCheck = await this.checkTypeScript(filePath);
        results.errors.push(...tsCheck.errors);
        results.warnings.push(...tsCheck.warnings);
      }
      
      // Check for Python files
      if (ext === '.py') {
        const pythonCheck = await this.checkPython(content);
        results.errors.push(...pythonCheck.errors);
        results.warnings.push(...pythonCheck.warnings);
      }
      
      // Generate suggestions
      results.suggestions = await this.generateSuggestions(content, ext, results);
      
      // Update validity based on errors
      results.valid = results.errors.length === 0;
      
      return results;
      
    } catch (error) {
      return {
        filePath,
        valid: false,
        errors: [`File read/parse error: ${error.message}`],
        warnings: [],
        metrics: {},
        suggestions: []
      };
    }
  }

  async checkSyntax(content, extension) {
    const result = { valid: true, errors: [] };
    
    try {
      switch(extension) {
        case '.js':
        case '.jsx':
          esprima.parseScript(content, { tolerant: false });
          break;
          
        case '.json':
          JSON.parse(content);
          break;
          
        default:
          // For other file types, basic validation
          if (content.includes('\u0000')) {
            result.errors.push('File contains null bytes');
            result.valid = false;
          }
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Syntax error: ${error.message}`);
    }
    
    return result;
  }

  checkSecurity(content, extension) {
    const result = { errors: [], warnings: [] };
    
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        message: 'eval() usage - potential code injection',
        severity: 'error'
      },
      {
        pattern: /Function\s*\(/g,
        message: 'Function constructor - potential code injection',
        severity: 'error'
      },
      {
        pattern: /\.innerHTML\s*=\s*[^'"]*['"][^'"]*['"]/g,
        message: 'Direct innerHTML assignment - XSS risk',
        severity: 'error'
      },
      {
        pattern: /password\s*=\s*['"][^'"]*['"]/gi,
        message: 'Hardcoded password/secret',
        severity: 'error'
      },
      {
        pattern: /secret\s*=\s*['"][^'"]*['"]/gi,
        message: 'Hardcoded secret',
        severity: 'error'
      },
      {
        pattern: /apiKey\s*=\s*['"][^'"]*['"]/gi,
        message: 'Hardcoded API key',
        severity: 'error'
      },
      {
        pattern: /http:\/\//g,
        message: 'Insecure HTTP protocol',
        severity: 'warning'
      },
      {
        pattern: /\.exec\s*\(/g,
        message: 'Shell command execution',
        severity: 'warning'
      }
    ];
    
    securityPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        const issue = {
          pattern: pattern.pattern.toString(),
          count: matches.length,
          message: pattern.message
        };
        
        if (pattern.severity === 'error') {
          result.errors.push(issue);
        } else {
          result.warnings.push(issue);
        }
      }
    });
    
    return result;
  }

  checkComplexity(content) {
    const ast = esprima.parseScript(content, { tolerant: true });
    let complexity = 0;
    const functions = [];
    
    function traverse(node) {
      if (!node) return;
      
      // Count decision points
      if (node.type === 'IfStatement' ||
          node.type === 'ForStatement' ||
          node.type === 'WhileStatement' ||
          node.type === 'DoWhileStatement' ||
          node.type === 'SwitchStatement' ||
          node.type === 'ConditionalExpression' ||
          node.type === 'TryStatement' ||
          node.type === 'CatchClause') {
        complexity++;
      }
      
      // Track functions
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        const func = {
          name: node.id ? node.id.name : 'anonymous',
          params: node.params.length,
          depth: 0
        };
        
        // Calculate function depth
        let currentDepth = 0;
        function calculateDepth(n, depth) {
          if (n.type === 'BlockStatement') {
            depth++;
            currentDepth = Math.max(currentDepth, depth);
          }
          
          for (const key in n) {
            if (n[key] && typeof n[key] === 'object') {
              if (Array.isArray(n[key])) {
                n[key].forEach(child => calculateDepth(child, depth));
              } else {
                calculateDepth(n[key], depth);
              }
            }
          }
        }
        
        calculateDepth(node.body, 0);
        func.depth = currentDepth;
        functions.push(func);
      }
      
      // Recursively traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => traverse(child));
          } else {
            traverse(node[key]);
          }
        }
      }
    }
    
    traverse(ast);
    
    return {
      complexity,
      functions,
      averageParams: functions.length > 0 
        ? functions.reduce((sum, f) => sum + f.params, 0) / functions.length
        : 0,
      maxDepth: functions.length > 0
        ? Math.max(...functions.map(f => f.depth))
        : 0
    };
  }

  async runESLint(content) {
    const result = { errors: [], warnings: [] };
    
    try {
      const linter = new eslint.ESLint({
        useEslintrc: false,
        baseConfig: this.eslintConfig
      });
      
      const results = await linter.lintText(content, { filePath: 'temp.js' });
      
      if (results && results[0]) {
        results[0].messages.forEach(message => {
          const issue = {
            line: message.line,
            column: message.column,
            message: message.message,
            rule: message.ruleId
          };
          
          if (message.severity === 2) {
            result.errors.push(issue);
          } else if (message.severity === 1) {
            result.warnings.push(issue);
          }
        });
      }
    } catch (error) {
      result.errors.push({
        line: 0,
        column: 0,
        message: `ESLint error: ${error.message}`,
        rule: 'internal'
      });
    }
    
    return result;
  }

  async checkTypeScript(filePath) {
    const result = { errors: [], warnings: [] };
    
    try {
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const tsc = spawn('npx', ['tsc', '--noEmit', filePath]);
        let output = '';
        
        tsc.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        tsc.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        tsc.on('close', (code) => {
          if (code !== 0) {
            const lines = output.split('\n').filter(line => line.trim());
            lines.forEach(line => {
              result.errors.push({
                message: line.trim(),
                rule: 'typescript'
              });
            });
          }
          resolve(result);
        });
      });
    } catch (error) {
      result.errors.push({
        message: `TypeScript check failed: ${error.message}`,
        rule: 'internal'
      });
      return result;
    }
  }

  async checkPython(content) {
    const result = { errors: [], warnings: [] };
    
    const pythonPatterns = [
      {
        pattern: /except\s*:/g,
        message: 'Bare except clause - catch specific exceptions',
        severity: 'warning'
      },
      {
        pattern: /print\s*\(/g,
        message: 'print() in production code - use logging',
        severity: 'warning'
      },
      {
        pattern: /exec\s*\(/g,
        message: 'exec() usage - security risk',
        severity: 'error'
      },
      {
        pattern: /eval\s*\(/g,
        message: 'eval() usage - security risk',
        severity: 'error'
      },
      {
        pattern: /import\s*\*/g,
        message: 'Wildcard import - import specific modules',
        severity: 'warning'
      }
    ];
    
    pythonPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        const issue = {
          count: matches.length,
          message: pattern.message
        };
        
        if (pattern.severity === 'error') {
          result.errors.push(issue);
        } else {
          result.warnings.push(issue);
        }
      }
    });
    
    return result;
  }

  async generateSuggestions(content, extension, validationResults) {
    const suggestions = [];
    
    // Based on validation results
    if (validationResults.metrics.complexity > this.thresholds.maxComplexity) {
      suggestions.push({
        type: 'complexity',
        suggestion: 'Refactor code to reduce cyclomatic complexity',
        priority: 'high'
      });
    }
    
    if (validationResults.metrics.functions) {
      validationResults.metrics.functions.forEach(func => {
        if (func.params > this.thresholds.maxParams) {
          suggestions.push({
            type: 'function',
            suggestion: `Function "${func.name}" has ${func.params} parameters (max: ${this.thresholds.maxParams}). Consider using an options object.`,
            priority: 'medium'
          });
        }
        
        if (func.depth > this.thresholds.maxDepth) {
          suggestions.push({
            type: 'nesting',
            suggestion: `Function "${func.name}" has nesting depth ${func.depth} (max: ${this.thresholds.maxDepth}). Reduce nesting for better readability.`,
            priority: 'medium'
          });
        }
      });
    }
    
    // Line length check
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.length > 120) {
        suggestions.push({
          type: 'formatting',
          suggestion: `Line ${index + 1} exceeds 120 characters (${line.length} chars). Consider breaking it up.`,
          priority: 'low'
        });
      }
    });
    
    // Check for missing error handling
    if (!content.includes('try') && !content.includes('catch') && !content.includes('catch(')) {
      if (content.includes('async') || content.includes('.then(')) {
        suggestions.push({
          type: 'error-handling',
          suggestion: 'Add error handling for async operations',
          priority: 'medium'
        });
      }
    }
    
    // Check for hardcoded values
    const hardcodedPatterns = [
      /['"]https?:\/\/[^'"]*['"]/g,
      /['"]\d{3,}['"]/g, // Numbers with 3+ digits
      /['"][A-Za-z0-9]{20,}['"]/g // Long strings (possible tokens)
    ];
    
    hardcodedPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length > 3) {
        suggestions.push({
          type: 'configuration',
          suggestion: 'Consider moving hardcoded values to configuration files',
          priority: 'medium'
        });
      }
    });
    
    return suggestions;
  }

  async validateDirectory(directoryPath) {
    const results = {
      directory: directoryPath,
      files: [],
      summary: {
        totalFiles: 0,
        validFiles: 0,
        invalidFiles: 0,
        totalErrors: 0,
        totalWarnings: 0
      }
    };
    
    try {
      const files = this.getCodeFiles(directoryPath);
      results.summary.totalFiles = files.length;
      
      for (const file of files) {
        console.log(`Validating: ${file}`);
        const validation = await this.validateFile(file);
        
        results.files.push(validation);
        
        if (validation.valid) {
          results.summary.validFiles++;
        } else {
          results.summary.invalidFiles++;
        }
        
        results.summary.totalErrors += validation.errors.length;
        results.summary.totalWarnings += validation.warnings.length;
      }
      
      return results;
      
    } catch (error) {
      console.error('Directory validation error:', error);
      throw error;
    }
  }

  getCodeFiles(directoryPath) {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py',
      '.java', '.cpp', '.c', '.cs', '.go',
      '.rb', '.php', '.rs', '.swift', '.kt'
    ];
    
    const files = [];
    
    function traverse(dir) {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!item.includes('node_modules') && 
              !item.includes('.git') && 
              !item.includes('dist') && 
              !item.includes('build')) {
            traverse(fullPath);
          }
        } else {
          const ext = path.extname(item).toLowerCase();
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      });
    }
    
    traverse(directoryPath);
    return files;
  }

  generateReport(validationResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: validationResults.summary,
      files: []
    };
    
    validationResults.files.forEach(fileResult => {
      const fileReport = {
        path: fileResult.filePath,
        valid: fileResult.valid,
        errorCount: fileResult.errors.length,
        warningCount: fileResult.warnings.length,
        metrics: fileResult.metrics,
        topIssues: fileResult.errors.slice(0, 3).map(e => e.message || e),
        suggestions: fileResult.suggestions.slice(0, 5)
      };
      
      report.files.push(fileReport);
    });
    
    return report;
  }

  async autoFixFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const validation = await this.validateFile(filePath);
      
      if (validation.valid) {
        return {
          fixed: false,
          message: 'File is already valid',
          original: content,
          fixedContent: content
        };
      }
      
      let fixedContent = content;
      
      // Apply automatic fixes
      validation.errors.forEach(error => {
        if (error.message.includes('Missing semicolon')) {
          fixedContent = this.fixMissingSemicolons(fixedContent);
        } else if (error.message.includes('Unexpected console')) {
          fixedContent = this.fixConsoleLogs(fixedContent);
        } else if (error.message.includes('Hardcoded password')) {
          fixedContent = this.fixHardcodedSecrets(fixedContent);
        }
      });
      
      // Format code
      fixedContent = await this.formatCode(fixedContent, path.extname(filePath));
      
      // Write fixed content
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      
      return {
        fixed: true,
        message: 'File automatically fixed',
        original: content,
        fixedContent: fixedContent
      };
      
    } catch (error) {
      return {
        fixed: false,
        message: `Auto-fix failed: ${error.message}`,
        error: error
      };
    }
  }

  fixMissingSemicolons(content) {
    // Simple semicolon insertion at end of lines that look like statements
    const lines = content.split('\n');
    const fixedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('/*') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('import ') &&
          !trimmed.startsWith('export ') &&
          !trimmed.includes('if (') &&
          !trimmed.includes('for (') &&
          !trimmed.includes('while (') &&
          !trimmed.includes('function') &&
          !trimmed.includes('=>')) {
        return line + ';';
      }
      return line;
    });
    
    return fixedLines.join('\n');
  }

  fixConsoleLogs(content) {
    // Comment out console.log statements
    return content.replace(/console\.log\(/g, '// console.log(');
  }

  fixHardcodedSecrets(content) {
    // Replace hardcoded secrets with environment variable placeholders
    let fixed = content;
    
    // Simple pattern matching for common secrets
    const patterns = [
      { 
        regex: /password\s*=\s*['"]([^'"]*)['"]/gi, 
        replacement: 'password = process.env.PASSWORD || \'$1\'' 
      },
      { 
        regex: /apiKey\s*=\s*['"]([^'"]*)['"]/gi, 
        replacement: 'apiKey = process.env.API_KEY || \'$1\'' 
      },
      { 
        regex: /secret\s*=\s*['"]([^'"]*)['"]/gi, 
        replacement: 'secret = process.env.SECRET || \'$1\'' 
      }
    ];
    
    patterns.forEach(pattern => {
      fixed = fixed.replace(pattern.regex, pattern.replacement);
    });
    
    return fixed;
  }

  async formatCode(content, extension) {
    if (extension === '.js' || extension === '.jsx') {
      try {
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
          const prettier = spawn('npx', ['prettier', '--stdin-filepath', 'temp.js']);
          let formatted = '';
          let error = '';
          
          prettier.stdin.write(content);
          prettier.stdin.end();
          
          prettier.stdout.on('data', (data) => {
            formatted += data.toString();
          });
          
          prettier.stderr.on('data', (data) => {
            error += data.toString();
          });
          
          prettier.on('close', (code) => {
            if (code === 0) {
              resolve(formatted);
            } else {
              console.warn('Prettier failed, using original:', error);
              resolve(content);
            }
          });
        });
      } catch (error) {
        console.warn('Prettier not available:', error.message);
        return content;
      }
    }
    
    return content;
  }
}

module.exports = CodeChecker;
