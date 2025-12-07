const twilio = require('twilio');
const { Vonage } = require('@vonage/server-sdk');
const axios = require('axios');

class WhatsAppService {
  constructor() {
    // Twilio for WhatsApp Business
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Vonage as backup
    this.vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    });
    
    // WhatsApp Cloud API (Meta)
    this.whatsappCloudConfig = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      version: 'v18.0'
    };
  }

  async sendMessage(phoneNumber, message, templateName = null, templateParams = null) {
    // Format South African phone number
    const formattedNumber = this.formatSouthAfricanNumber(phoneNumber);
    
    try {
      // Try WhatsApp Cloud API first
      if (templateName) {
        return await this.sendTemplateMessage(formattedNumber, templateName, templateParams);
      } else {
        return await this.sendCustomMessage(formattedNumber, message);
      }
    } catch (error) {
      console.error('WhatsApp Cloud API failed, trying Twilio:', error);
      
      // Fallback to Twilio
      try {
        return await this.sendViaTwilio(formattedNumber, message);
      } catch (twilioError) {
        console.error('Twilio failed, trying Vonage:', twilioError);
        
        // Fallback to Vonage
        return await this.sendViaVonage(formattedNumber, message);
      }
    }
  }

  formatSouthAfricanNumber(phoneNumber) {
    // Ensure number is in international format
    let cleaned = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('0')) {
      return '+27' + cleaned.substring(1);
    } else if (cleaned.startsWith('27')) {
      return '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      return '+27' + cleaned;
    }
    
    return cleaned;
  }

  async sendTemplateMessage(phoneNumber, templateName, templateParams) {
    const url = `https://graph.facebook.com/${this.whatsappCloudConfig.version}/${this.whatsappCloudConfig.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en'
        },
        components: []
      }
    };

    // Add parameters if provided
    if (templateParams && templateParams.length > 0) {
      payload.template.components.push({
        type: 'body',
        parameters: templateParams.map(param => ({
          type: 'text',
          text: param
        }))
      });
    }

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.whatsappCloudConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async sendCustomMessage(phoneNumber, message) {
    const url = `https://graph.facebook.com/${this.whatsappCloudConfig.version}/${this.whatsappCloudConfig.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.whatsappCloudConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async sendViaTwilio(phoneNumber, message) {
    return await this.twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phoneNumber}`
    });
  }

  async sendViaVonage(phoneNumber, message) {
    return await this.vonage.sms.send({
      to: phoneNumber,
      from: process.env.VONAGE_BRAND_NAME,
      text: message
    });
  }

  // Predefined templates for various scenarios
  getTemplates() {
    return {
      // Interview templates
      INTERVIEW_INVITATION: {
        name: 'interview_invitation',
        params: ['Company Name', 'Position', 'Date', 'Time', 'Location/Link']
      },
      INTERVIEW_REMINDER: {
        name: 'interview_reminder',
        params: ['Company Name', 'Position', 'Date', 'Time', 'Location/Link']
      },
      
      // Application status templates
      APPLICATION_SUBMITTED: {
        name: 'application_submitted',
        params: ['Company Name', 'Position']
      },
      APPLICATION_SHORTLISTED: {
        name: 'application_shortlisted',
        params: ['Company Name', 'Position']
      },
      APPLICATION_REJECTED: {
        name: 'application_rejected',
        params: ['Company Name', 'Position', 'Next Steps']
      },
      JOB_OFFER: {
        name: 'job_offer',
        params: ['Company Name', 'Position', 'Salary', 'Start Date']
      },
      
      // Job match templates
      NEW_JOB_MATCH: {
        name: 'new_job_match',
        params: ['Job Title', 'Company', 'Location', 'Salary Range']
      },
      
      // System notifications
      CV_ENHANCED: {
        name: 'cv_enhanced',
        params: []
      },
      PAYMENT_CONFIRMED: {
        name: 'payment_confirmed',
        params: ['Amount', 'Reference']
      },
      PROFILE_INCOMPLETE: {
        name: 'profile_incomplete',
        params: ['Missing Items']
      }
    };
  }

  async sendInterviewInvitation(applicant, interviewDetails) {
    const template = this.getTemplates().INTERVIEW_INVITATION;
    
    return await this.sendMessage(
      applicant.personalInfo.whatsappNumber || applicant.personalInfo.phone,
      null,
      template.name,
      [
        interviewDetails.company,
        interviewDetails.position,
        interviewDetails.date,
        interviewDetails.time,
        interviewDetails.location || interviewDetails.link
      ]
    );
  }

  async sendDailyUpdate(applicant, stats) {
    const message = `📊 Daily Job Search Update:
    
✅ Applications Submitted: ${stats.applicationsSubmitted}
👁️ Jobs Viewed: ${stats.jobsViewed}
🎯 New Matches: ${stats.newMatches}
📈 Profile Views: ${stats.profileViews}
💼 Interviews Scheduled: ${stats.interviewsScheduled}

Keep up the great work! Your next opportunity is just around the corner.

Reply STOP to pause updates.`;

    return await this.sendMessage(
      applicant.personalInfo.whatsappNumber || applicant.personalInfo.phone,
      message
    );
  }

  async sendApplicationStatus(applicant, application) {
    let template;
    let params = [application.company, application.jobTitle];
    
    switch (application.status) {
      case 'shortlisted':
        template = this.getTemplates().APPLICATION_SHORTLISTED;
        break;
      case 'rejected':
        template = this.getTemplates().APPLICATION_REJECTED;
        params.push('We found 5 new matches that might be better suited for you.');
        break;
      case 'offered':
        template = this.getTemplates().JOB_OFFER;
        params.push(`R${application.offerDetails?.salary || 'Negotiable'}`);
        params.push(application.offerDetails?.startDate || 'To be discussed');
        break;
      default:
        return null;
    }
    
    return await this.sendMessage(
      applicant.personalInfo.whatsappNumber || applicant.personalInfo.phone,
      null,
      template.name,
      params
    );
  }
}

module.exports = WhatsAppService;
