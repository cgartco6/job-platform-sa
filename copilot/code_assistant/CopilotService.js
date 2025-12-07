const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CopilotService {
  constructor() {
    this.config = {
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      model: 'gpt-4-turbo-preview',
      temperature: 0.2,
      maxTokens: 4000
    };
    
    this.openai = new OpenAIApi(new Configuration({
      apiKey: this.config.openaiApiKey
    }));
    
    this.contextWindow = 8000; // tokens
    this.codePatterns = this.loadCodePatterns();
    this.errorPatterns = this.loadErrorPatterns();
  }

  loadCodePatterns() {
    return {
      'backend': {
        patterns: [
          { pattern: 'const.*=.*require\\(', language: 'javascript' },
          { pattern: 'module.exports', language: 'javascript' },
          { pattern: 'async function', language: 'javascript' },
          { pattern: 'class.*{', language: 'javascript' },
          { pattern: 'res\\.json\\(', language: 'javascript' }
        ],
        bestPractices: [
          'Use async/await for async operations',
          'Implement proper error handling',
          'Add input validation',
          'Use environment variables',
          'Add JSDoc comments'
        ]
      },
      'frontend': {
        patterns: [
          { pattern: 'import.*from', language: 'javascript' },
          { pattern: 'export.*default', language: 'javascript' },
          { pattern: 'useState\\(', language: 'javascript' },
          { pattern: 'useEffect\\(', language: 'javascript' },
          { pattern: '<div>', language: 'jsx' }
        ],
        bestPractices: [
          'Use React hooks properly',
          'Implement responsive design',
          'Add loading states',
          'Handle errors gracefully',
          'Optimize performance'
        ]
      },
      'python': {
        patterns: [
          { pattern: 'import.*', language: 'python' },
          { pattern: 'def.*\\(', language: 'python' },
          { pattern: 'class.*:', language: 'python' },
          { pattern: 'self\\.', language: 'python' }
        ],
        bestPractices: [
          'Add type hints',
          'Use docstrings',
          'Implement error handling',
          'Follow PEP 8',
          'Add unit tests'
        ]
      }
    };
  }

  loadErrorPatterns() {
    return {
      'ReferenceError': {
        pattern: 'ReferenceError.*is not defined',
        solution: 'Check variable declaration and scope',
        fix: 'Declare variable before use or import missing module'
      },
      'TypeError': {
        pattern: 'TypeError.*cannot read property',
        solution: 'Check object existence and property access',
        fix: 'Add null check or optional chaining'
      },
      'SyntaxError': {
        pattern: 'SyntaxError.*unexpected token',
        solution: 'Check syntax and brackets',
        fix: 'Fix syntax error at specified location'
      },
      'MongoError': {
        pattern: 'MongoError.*',
        solution: 'Database operation failed',
        fix: 'Check connection, query syntax, or permissions'
      },
      'NetworkError': {
        pattern: 'Network.*failed|timeout',
        solution: 'Network connectivity issue',
        fix: 'Check internet connection and API endpoints'
      }
    };
  }

  async analyzeCode(filePath, code) {
    try {
      const fileExt = path.extname(filePath);
      const language = this.getLanguageFromExtension(fileExt);
      
      const analysis = {
        filePath: filePath,
        language: language,
        issues: [],
        suggestions: [],
        complexity: 0,
        security: 'safe',
        performance: 'good'
      };
      
      // Analyze complexity
      analysis.complexity = this.calculateComplexity(code, language);
      
      // Check for issues
      analysis.issues = await this.findIssues(code, language);
      
      // Get suggestions
      analysis.suggestions = await this.getSuggestions(code, language);
      
      // Check security
      analysis.security = this.checkSecurity(code, language);
      
      // Check performance
      analysis.performance = this.checkPerformance(code, language);
      
      // Generate documentation
      analysis.documentation = await this.generateDocumentation(code, language);
      
      return analysis;
      
    } catch (error) {
      console.error('Code analysis error:', error);
      throw error;
    }
  }

  calculateComplexity(code, language) {
    let complexity = 0;
    
    switch(language) {
      case 'javascript':
        // Cyclomatic complexity approximation
        complexity += (code.match(/if\s*\(/g) || []).length;
        complexity += (code.match(/for\s*\(/g) || []).length;
        complexity += (code.match(/while\s*\(/g) || []).length;
        complexity += (code.match(/catch\s*\(/g) || []).length;
        complexity += (code.match(/\?\s*:/g) || []).length;
        break;
      case 'python':
        complexity += (code.match(/if\s+/g) || []).length;
        complexity += (code.match(/for\s+/g) || []).length;
        complexity += (code.match(/while\s+/g) || []).length;
        complexity += (code.match(/except\s+/g) || []).length;
        break;
    }
    
    return complexity;
  }

  async findIssues(code, language) {
    const issues = [];
    
    // Check for common issues
    const checks = [
      {
        pattern: /console\.log\(/g,
        issue: 'Console.log in production code',
        severity: 'warning',
        fix: 'Replace with proper logging system'
      },
      {
        pattern: /eval\(/g,
        issue: 'Use of eval() - security risk',
        severity: 'critical',
        fix: 'Find alternative implementation'
      },
      {
        pattern: /password.*=.*['"].*['"]/gi,
        issue: 'Hardcoded credentials',
        severity: 'critical',
        fix: 'Use environment variables'
      },
      {
        pattern: /\.then\(/g,
        issue: 'Promise.then() instead of async/await',
        severity: 'info',
        fix: 'Convert to async/await pattern'
      },
      {
        pattern: /var\s+\w+/g,
        issue: 'Use of var instead of let/const',
        severity: 'warning',
        fix: 'Replace var with let or const'
      }
    ];
    
    checks.forEach(check => {
      const matches = code.match(check.pattern);
      if (matches) {
        issues.push({
          type: check.issue,
          count: matches.length,
          severity: check.severity,
          fix: check.fix,
          pattern: check.pattern.toString()
        });
      }
    });
    
    return issues;
  }

  async getSuggestions(code, language) {
    const prompt = `
    Analyze the following ${language} code and provide improvement suggestions:
    
    ${code.substring(0, 2000)}
    
    Provide suggestions in this format:
    1. [Category]: [Suggestion] - [Reason]
    
    Categories: Performance, Security, Readability, Maintainability, Best Practices
    
    Focus on:
    - Code optimization
    - Security improvements
    - Better error handling
    - Code organization
    - Documentation needs
    `;
    
    try {
      const response = await this.openai.createChatCompletion({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are an expert code reviewer specializing in clean, secure, and efficient code.' },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });
      
      const suggestions = response.data.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());
      
      return suggestions;
      
    } catch (error) {
      console.error('AI suggestion error:', error);
      return ['Unable to generate suggestions at this time.'];
    }
  }

  checkSecurity(code, language) {
    const securityPatterns = [
      { pattern: /\.innerHTML\s*=/g, issue: 'XSS vulnerability' },
      { pattern: /eval\(/g, issue: 'Code injection risk' },
      { pattern: /password.*['"].*['"]/gi, issue: 'Hardcoded secret' },
      { pattern: /sql.*string.*concatenation/gi, issue: 'SQL injection risk' },
      { pattern: /http:\/\//g, issue: 'Insecure HTTP protocol' }
    ];
    
    let issues = [];
    securityPatterns.forEach(pattern => {
      if (code.match(pattern.pattern)) {
        issues.push(pattern.issue);
      }
    });
    
    return issues.length === 0 ? 'safe' : 'risky';
  }

  checkPerformance(code, language) {
    const performancePatterns = [
      { pattern: /\.map\(.*=>.*\.map\(/g, issue: 'Nested loops' },
      { pattern: /JSON\.parse\(.*JSON\.stringify\(/g, issue: 'Deep copy overhead' },
      { pattern: /for.*in.*object/g, issue: 'Slow object iteration' },
      { pattern: /synchronous.*fs.*read/g, issue: 'Blocking I/O' }
    ];
    
    let issues = [];
    performancePatterns.forEach(pattern => {
      if (code.match(pattern.pattern)) {
        issues.push(pattern.issue);
      }
    });
    
    return issues.length === 0 ? 'good' : 'needs_optimization';
  }

  async generateDocumentation(code, language) {
    const prompt = `
    Generate comprehensive documentation for this ${language} code:
    
    ${code.substring(0, 3000)}
    
    Include:
    1. Function/Class purpose
    2. Parameters and return values
    3. Example usage
    4. Any dependencies
    5. Error handling
    
    Format in Markdown.
    `;
    
    try {
      const response = await this.openai.createChatCompletion({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are a technical documentation expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('Documentation generation error:', error);
      return 'Documentation generation failed.';
    }
  }

  async autoComplete(code, cursorPosition) {
    const context = this.getContextAroundCursor(code, cursorPosition);
    
    const prompt = `
    Complete the code at the cursor position. Context:
    
    ${context.before}
    [CURSOR]
    ${context.after}
    
    Provide only the completion code, no explanations.
    `;
    
    try {
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.2
      });
      
      return response.data.choices[0].text.trim();
      
    } catch (error) {
      console.error('Auto-complete error:', error);
      return '';
    }
  }

  getContextAroundCursor(code, cursorPosition) {
    const before = code.substring(Math.max(0, cursorPosition - 500), cursorPosition);
    const after = code.substring(cursorPosition, Math.min(code.length, cursorPosition + 200));
    
    return { before, after };
  }

  getLanguageFromExtension(ext) {
    const extensions = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };
    
    return extensions[ext.toLowerCase()] || 'unknown';
  }

  async generateTestCases(code, language) {
    const prompt = `
    Generate comprehensive test cases for this ${language} code:
    
    ${code.substring(0, 4000)}
    
    Include:
    1. Unit tests
    2. Integration tests
    3. Edge cases
    4. Error scenarios
    
    Format: Describe each test case with input, expected output, and purpose.
    `;
    
    try {
      const response = await this.openai.createChatCompletion({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are a QA engineer and testing expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      });
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('Test case generation error:', error);
      return 'Test case generation failed.';
    }
  }

  async refactorCode(code, language, goal) {
    const prompt = `
    Refactor the following ${language} code with this goal: ${goal}
    
    Original code:
    ${code.substring(0, 4000)}
    
    Refactored code with explanations of changes.
    `;
    
    try {
      const response = await this.openai.createChatCompletion({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are a senior software engineer specializing in code refactoring.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('Refactoring error:', error);
      return 'Refactoring failed.';
    }
  }
}

module.exports = CopilotService;
