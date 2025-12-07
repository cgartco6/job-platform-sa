const crypto = require('crypto');
const axios = require('axios');

class PayShapService {
  constructor() {
    this.config = {
      apiKey: process.env.PAYSHAP_API_KEY,
      apiSecret: process.env.PAYSHAP_API_SECRET,
      env: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      baseUrl: process.env.NODE_ENV === 'production' 
        ? 'https://api.payshap.com/v1'
        : 'https://api.sandbox.payshap.com/v1',
      webhookUrl: `${process.env.BASE_URL}/api/payment/payshap/webhook`,
      redirectUrl: `${process.env.BASE_URL}/payment/payshap/callback`
    };
    
    this.banks = {
      'fnb': 'First National Bank',
      'absa': 'ABSA',
      'standard': 'Standard Bank',
      'nedbank': 'Nedbank',
      'capitec': 'Capitec Bank',
      'bidvest': 'Bidvest Bank'
    };
  }

  async initiatePayment(applicant, amount = 500, bank = 'fnb') {
    try {
      const paymentId = `PS${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const paymentData = {
        payment_id: paymentId,
        amount: amount * 100, // PayShap uses cents
        currency: 'ZAR',
        description: 'AI Job Application Service - 30 Days',
        reference: `JOBAPP-${applicant.applicantId}`,
        customer: {
          id: applicant.applicantId,
          name: `${applicant.personalInfo.firstName} ${applicant.personalInfo.lastName}`,
          email: applicant.personalInfo.email,
          phone: applicant.personalInfo.phone
        },
        bank_code: this.getBankCode(bank),
        redirect_url: this.config.redirectUrl,
        webhook_url: this.config.webhookUrl,
        metadata: {
          applicant_id: applicant.applicantId,
          service_type: 'ai_job_application',
          duration_days: 30,
          version: 'v1.0'
        }
      };
      
      // Generate signature
      const signature = this.generateSignature(paymentData);
      
      const response = await axios.post(
        `${this.config.baseUrl}/payments`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Signature': signature,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        paymentId: paymentId,
        paymentUrl: response.data.payment_url,
        qrCode: response.data.qr_code_url,
        expiresAt: response.data.expires_at,
        instructions: response.data.instructions,
        rawResponse: response.data
      };
      
    } catch (error) {
      console.error('PayShap initiation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        fallback: true // Use fallback method
      };
    }
  }

  generateSignature(data) {
    const timestamp = Date.now();
    const payload = JSON.stringify(data);
    const stringToSign = `${timestamp}.${payload}`;
    
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(stringToSign)
      .digest('hex');
  }

  getBankCode(bankName) {
    const bankCodes = {
      'fnb': '580105',
      'absa': '632005',
      'standard': '051001',
      'nedbank': '198765',
      'capitec': '470010',
      'bidvest': '462005'
    };
    
    return bankCodes[bankName.toLowerCase()] || bankCodes.fnb;
  }

  async verifyPayment(paymentId) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        status: response.data.status,
        verified: response.data.status === 'completed',
        amount: response.data.amount / 100, // Convert cents to rand
        completedAt: response.data.completed_at,
        rawData: response.data
      };
      
    } catch (error) {
      console.error('PayShap verification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleWebhook(webhookData, signature) {
    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(JSON.stringify(webhookData))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }
      
      const event = webhookData.event;
      const paymentData = webhookData.data;
      
      switch (event) {
        case 'payment.completed':
          return await this.handlePaymentCompleted(paymentData);
          
        case 'payment.failed':
          return await this.handlePaymentFailed(paymentData);
          
        case 'payment.expired':
          return await this.handlePaymentExpired(paymentData);
          
        default:
          console.log(`Unhandled webhook event: ${event}`);
          return { processed: false, event: event };
      }
      
    } catch (error) {
      console.error('Webhook handling error:', error);
      return { processed: false, error: error.message };
    }
  }

  async handlePaymentCompleted(paymentData) {
    // Update transaction in database
    const PayShapTransaction = require('./PayShapModel');
    
    await PayShapTransaction.findOneAndUpdate(
      { paymentId: paymentData.payment_id },
      {
        status: 'completed',
        completedAt: new Date(paymentData.completed_at),
        amount: paymentData.amount / 100,
        bankReference: paymentData.bank_reference,
        rawResponse: paymentData
      },
      { new: true }
    );
    
    // Activate applicant service
    const Applicant = require('../../../backend/src/models/Applicant');
    const applicantId = paymentData.metadata?.applicant_id || 
                      paymentData.reference?.split('-')[1];
    
    if (applicantId) {
      await Applicant.findOneAndUpdate(
        { applicantId: applicantId },
        {
          'payment.status': 'completed',
          'payment.transactionId': paymentData.payment_id,
          'payment.paymentMethod': 'payshap',
          status: 'active',
          'service.active': true,
          'service.activatedAt': new Date(),
          'service.expiresAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      );
    }
    
    return {
      processed: true,
      paymentId: paymentData.payment_id,
      amount: paymentData.amount / 100,
      applicantId: applicantId
    };
  }

  generateQRCodePayment(paymentData) {
    // Generate QR code for SnapScan/PayShap
    const qrData = {
      v: 1,
      id: paymentData.paymentId,
      am: paymentData.amount,
      cu: 'ZAR',
      tr: paymentData.reference,
      tn: paymentData.description,
      bn: this.getBankCode(paymentData.bank)
    };
    
    const qrString = Object.entries(qrData)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`;
  }

  getBankList() {
    return Object.entries(this.banks).map(([code, name]) => ({
      code: code,
      name: name,
      icon: `/bank-icons/${code}.png`,
      color: this.getBankColor(code)
    }));
  }

  getBankColor(bankCode) {
    const colors = {
      'fnb': '#0033A0',
      'absa': '#FF0000',
      'standard': '#0033A0',
      'nedbank': '#00853E',
      'capitec': '#FF6B00',
      'bidvest': '#0033A0'
    };
    return colors[bankCode] || '#000000';
  }

  async generatePaymentLink(applicant, amount = 500) {
    // Alternative: Generate payment link for sharing
    const paymentId = `LINK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const linkData = {
      payment_id: paymentId,
      amount: amount * 100,
      description: 'JobAI South Africa - AI Job Application Service',
      reference: `JOBAPP-${applicant.applicantId}`,
      customer_email: applicant.personalInfo.email,
      customer_name: `${applicant.personalInfo.firstName} ${applicant.personalInfo.lastName}`,
      expires_hours: 72,
      metadata: {
        applicant_id: applicant.applicantId,
        service: 'ai_job_application'
      }
    };
    
    const signature = this.generateSignature(linkData);
    
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/payment-links`,
        linkData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Signature': signature,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        paymentLink: response.data.link_url,
        paymentId: paymentId,
        expiresAt: response.data.expires_at,
        qrCode: response.data.qr_code,
        instructions: 'Share this link or scan QR code to pay'
      };
      
    } catch (error) {
      console.error('Payment link generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PayShapService;
