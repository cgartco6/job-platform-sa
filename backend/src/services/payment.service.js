const axios = require('axios');
const crypto = require('crypto');
const Applicant = require('../models/Applicant');

class PaymentService {
  constructor() {
    // Using PayFast for South African payments
    this.payfastConfig = {
      merchantId: process.env.PAYFAST_MERCHANT_ID,
      merchantKey: process.env.PAYFAST_MERCHANT_KEY,
      passPhrase: process.env.PAYFAST_PASSPHRASE,
      env: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      returnUrl: `${process.env.BASE_URL}/payment/success`,
      cancelUrl: `${process.env.BASE_URL}/payment/cancel`,
      notifyUrl: `${process.env.BASE_URL}/api/payment/notify`
    };
  }

  async initiatePayment(applicantId, amount = 500) {
    try {
      const applicant = await Applicant.findOne({ applicantId });
      if (!applicant) {
        throw new Error('Applicant not found');
      }

      // Generate payment reference
      const paymentReference = `JOBAPP-${applicantId}-${Date.now()}`;
      
      // Create payment data
      const paymentData = {
        merchant_id: this.payfastConfig.merchantId,
        merchant_key: this.payfastConfig.merchantKey,
        return_url: this.payfastConfig.returnUrl,
        cancel_url: this.payfastConfig.cancelUrl,
        notify_url: this.payfastConfig.notifyUrl,
        name_first: applicant.personalInfo.firstName,
        name_last: applicant.personalInfo.lastName,
        email_address: applicant.personalInfo.email,
        m_payment_id: paymentReference,
        amount: amount.toFixed(2),
        item_name: 'Job Application AI Service - 1 Month',
        item_description: 'AI CV enhancement, job matching, and auto-application service',
        custom_str1: applicantId
      };

      // Generate signature
      const signature = this.generateSignature(paymentData);
      paymentData.signature = signature;

      // Update applicant payment record
      applicant.payment = {
        amount,
        status: 'pending',
        reference: paymentReference,
        paymentDate: new Date()
      };
      await applicant.save();

      // Return payment URL
      const baseUrl = this.payfastConfig.env === 'production' 
        ? 'https://www.payfast.co.za/eng/process' 
        : 'https://sandbox.payfast.co.za/eng/process';

      return {
        paymentUrl: `${baseUrl}?${this.toUrlEncoded(paymentData)}`,
        reference: paymentReference
      };

    } catch (error) {
      console.error('Payment initiation error:', error);
      throw error;
    }
  }

  generateSignature(data) {
    // Create parameter string
    let pfOutput = '';
    Object.keys(data)
      .sort()
      .forEach(key => {
        if (data[key] !== '') {
          pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
        }
      });
    
    // Remove last ampersand
    pfOutput = pfOutput.slice(0, -1);
    
    if (this.payfastConfig.passPhrase) {
      pfOutput += `&passphrase=${encodeURIComponent(this.payfastConfig.passPhrase.trim()).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(pfOutput).digest('hex');
  }

  toUrlEncoded(obj) {
    return Object.keys(obj)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
      .join('&');
  }

  async verifyPayment(paymentData) {
    try {
      // Verify PayFast signature
      const localSignature = this.generateSignature(paymentData);
      
      if (localSignature !== paymentData.signature) {
        throw new Error('Invalid signature');
      }

      // Verify payment status
      if (paymentData.payment_status !== 'COMPLETE') {
        throw new Error(`Payment not complete: ${paymentData.payment_status}`);
      }

      // Update applicant status
      const applicant = await Applicant.findOne({ 
        applicantId: paymentData.custom_str1 
      });

      if (!applicant) {
        throw new Error('Applicant not found');
      }

      applicant.payment.status = 'completed';
      applicant.payment.transactionId = paymentData.pf_payment_id;
      applicant.payment.paymentMethod = paymentData.payment_method;
      applicant.status = 'active';
      
      // Log activity
      applicant.activityLog.push({
        action: 'payment_completed',
        timestamp: new Date(),
        details: {
          amount: paymentData.amount_gross,
          transactionId: paymentData.pf_payment_id
        }
      });

      await applicant.save();

      // Trigger AI processing
      await this.triggerAIProcessing(applicant);

      return {
        success: true,
        applicantId: applicant.applicantId
      };

    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  async triggerAIProcessing(applicant) {
    // Initialize AI services
    const cvProcessor = new CVProcessor();
    const jobScraper = new JobScraper();
    
    // Process CV
    const enhancedCV = await cvProcessor.enhanceCV(
      applicant.originalCV.fileUrl,
      applicant.personalInfo,
      applicant.qualifications
    );

    // Generate cover letter
    const coverLetter = await cvProcessor.generateCoverLetter(
      applicant.personalInfo,
      enhancedCV
    );

    // Update applicant with AI processed documents
    applicant.enhancedCV = {
      content: enhancedCV.content,
      fileUrl: enhancedCV.fileUrl,
      aiVersion: '2.1',
      generatedAt: new Date()
    };

    applicant.coverLetter = {
      content: coverLetter.content,
      fileUrl: coverLetter.fileUrl,
      generatedAt: new Date()
    };

    await applicant.save();

    // Start job search
    await jobScraper.startJobSearch(applicant);

    return true;
  }
}

module.exports = PaymentService;
