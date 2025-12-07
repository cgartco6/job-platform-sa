const axios = require('axios');
const logger = require('../../utils/logger');

class AIJobOptimizer {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
  }
  
  async optimizeJobDescription(jobData) {
    try {
      const prompt = this.createOptimizationPrompt(jobData);
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: process.env.AI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert job description optimizer. Create compelling, SEO-friendly job descriptions that attract top talent.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const optimizedContent = response.data.choices[0].message.content;
      return this.parseOptimizedContent(optimizedContent);
      
    } catch (error) {
      logger.error('AI optimization error:', error);
      throw new Error('AI optimization failed');
    }
  }
  
  createOptimizationPrompt(jobData) {
    return `
    Optimize this job description for better visibility and candidate attraction:
    
    Original Title: ${jobData.title}
    Original Description: ${jobData.description}
    Requirements: ${jobData.requirements?.join(', ') || 'Not specified'}
    Responsibilities: ${jobData.responsibilities?.join(', ') || 'Not specified'}
    Location: ${jobData.location?.city || 'Not specified'}, ${jobData.location?.province || ''}
    Job Type: ${jobData.jobType || 'Not specified'}
    Salary Range: ${jobData.salary?.min || 'Not specified'} - ${jobData.salary?.max || 'Not specified'} ${jobData.salary?.currency || 'ZAR'}
    
    Please provide:
    1. An optimized job title (max 60 characters)
    2. An optimized job description with:
       - Compelling introduction
       - Clear responsibilities section
       - Clear requirements section
       - Benefits section
       - Company culture/values (if applicable)
       - Call to action
    3. SEO keywords for job boards
    4. Suggested tags
    
    Format your response as JSON:
    {
      "title": "optimized title",
      "description": "optimized description",
      "keywords": ["keyword1", "keyword2"],
      "tags": ["tag1", "tag2"]
    }
    `;
  }
  
  parseOptimizedContent(content) {
    try {
      // Try to parse as JSON
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/{[\s\S]*}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[0].replace(/```json\n|\n```/g, '');
        return JSON.parse(jsonStr);
      }
      
      // Fallback to manual parsing
      return {
        title: this.extractSection(content, 'Title:'),
        description: this.extractSection(content, 'Description:'),
        keywords: this.extractArray(content, 'Keywords:'),
        tags: this.extractArray(content, 'Tags:')
      };
      
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      return {
        title: '',
        description: content,
        keywords: [],
        tags: []
      };
    }
  }
  
  extractSection(content, sectionName) {
    const regex = new RegExp(`${sectionName}\\s*(.*?)(?=\\n\\n|\\n[A-Z]|$)`, 's');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }
  
  extractArray(content, sectionName) {
    const section = this.extractSection(content, sectionName);
    return section ? section.split(',').map(item => item.trim()) : [];
  }
  
  async generateInterviewQuestions(jobDescription, candidateResume) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: process.env.AI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert HR professional. Generate relevant interview questions based on job requirements and candidate profile.'
            },
            {
              role: 'user',
              content: `
              Job Description: ${jobDescription}
              Candidate Resume: ${candidateResume}
              
              Generate 10 relevant interview questions covering:
              1. Technical skills assessment
              2. Behavioral questions
              3. Situational questions
              4. Culture fit questions
              
              Also provide:
              1. What to look for in answers
              2. Red flags to watch out for
              3. Recommended scoring criteria
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      logger.error('AI interview questions error:', error);
      throw new Error('Failed to generate interview questions');
    }
  }
  
  async analyzeResume(resumeText, jobDescription) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: process.env.AI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert resume analyzer. Provide detailed analysis and suggestions for improvement.'
            },
            {
              role: 'user',
              content: `
              Resume: ${resumeText}
              Target Job: ${jobDescription}
              
              Please analyze and provide:
              1. Match score (0-100%)
              2. Key strengths matching the job
              3. Missing skills/experience
              4. Resume improvement suggestions
              5. Keywords to include
              6. Formatting suggestions
              7. ATS compatibility assessment
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      logger.error('AI resume analysis error:', error);
      throw new Error('Failed to analyze resume');
    }
  }
}

module.exports = new AIJobOptimizer();
