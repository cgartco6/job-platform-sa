const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FNBEFTService {
  constructor() {
    this.bankDetails = {
      bankName: 'First National Bank (FNB)',
      accountName: 'JobAI South Africa (Pty) Ltd',
      accountNumber: process.env.FNB_ACCOUNT_NUMBER || '6284 1234 567',
      branchCode: '250655', // Universal branch code
      branchName: 'Sandton City',
      accountType: 'Business Current Account',
      swiftCode: 'FIRNZAJJ',
      bankAddress: '1 First Place, Bank City, Johannesburg, 2000',
      taxNumber: process.env.COMPANY_TAX_NUMBER || '9876543210'
    };
    
    this.referenceFormat = 'JOBAPP{applicantId}{timestamp}';
    this.paymentInstructions = this.generatePaymentInstructions();
  }

  generatePaymentInstructions() {
    return {
      step1: 'Log into your FNB Internet Banking',
      step2: 'Go to "Payments" → "Pay Beneficiary"',
      step3: `Add new beneficiary: Account Name: "${this.bankDetails.accountName}"`,
      step4: `Account Number: ${this.bankDetails.accountNumber}`,
      step5: `Branch Code: ${this.bankDetails.branchCode}`,
      step6: 'Account Type: Current Account',
      step7: 'Save beneficiary',
      step8: 'Make payment with correct reference',
      step9: 'Upload proof of payment in application',
      importantNotes: [
        'Use exact reference number provided',
        'Keep proof of payment (PDF/PNG)',
        'Processing time: 1-2 business days',
        'Weekend payments processed Monday',
        'Contact: payments@jobai.co.za for issues'
      ]
    };
  }

  generatePaymentReference(applicantId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    return `JOBAPP${applicantId.slice(-4)}${timestamp}${random}`;
  }

  async createEFTInvoice(applicantData, amount = 500) {
    const reference = this.generatePaymentReference(applicantData.applicantId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3 days validity
    
    const invoice = {
      invoiceNumber: `INV-${reference}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      applicant: {
        id: applicantData.applicantId,
        name: `${applicantData.personalInfo.firstName} ${applicantData.personalInfo.lastName}`,
        email: applicantData.personalInfo.email,
        phone: applicantData.personalInfo.phone
      },
      amount: {
        total: amount,
        currency: 'ZAR',
        vat: amount * 0.15, // 15% VAT
        net: amount * 0.85
      },
      reference: reference,
      bankDetails: this.bankDetails,
      instructions: this.paymentInstructions,
      terms: [
        'Payment secures 30 days of AI job application service',
        'Non-refundable after AI processing begins',
        'Valid for 3 days from issue date',
        'Include reference in all communications'
      ]
    };
    
    // Generate PDF invoice
    const pdfPath = await this.generatePDFInvoice(invoice);
    invoice.pdfUrl = pdfPath;
    
    return invoice;
  }

  async generatePDFInvoice(invoiceData) {
    // In production, use a PDF generation library like pdfkit
    const invoiceTemplate = `
    ===========================================
              JOBAI SOUTH AFRICA
           OFFICIAL PAYMENT INVOICE
    ===========================================
    
    Invoice Number: ${invoiceData.invoiceNumber}
    Date: ${invoiceData.date}
    Due Date: ${invoiceData.dueDate}
    
    Bill To:
    ${invoiceData.applicant.name}
    ${invoiceData.applicant.email}
    ${invoiceData.applicant.phone}
    
    ===========================================
    Description                     Amount (ZAR)
    ===========================================
    AI Job Application Service        R${invoiceData.amount.total.toFixed(2)}
    VAT (15%)                         R${invoiceData.amount.vat.toFixed(2)}
    -------------------------------------------
    TOTAL DUE                        R${invoiceData.amount.total.toFixed(2)}
    
    ===========================================
    PAYMENT INSTRUCTIONS
    ===========================================
    Bank: ${this.bankDetails.bankName}
    Account Name: ${this.bankDetails.accountName}
    Account Number: ${this.bankDetails.accountNumber}
    Branch Code: ${this.bankDetails.branchCode}
    Reference: ${invoiceData.reference}
    
    IMPORTANT: Include reference in payment
    Processing: 1-2 business days
    
    ===========================================
    TERMS & CONDITIONS
    ===========================================
    1. 30 days AI job application service
    2. Non-refundable after processing
    3. Valid for 3 days
    4. Upload proof of payment
    
    Contact: payments@jobai.co.za
    Support: +27 11 123 4567
    `;
    
    const fileName = `invoice_${invoiceData.reference}.txt`;
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'invoices', fileName);
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, invoiceTemplate);
    
    return `/uploads/invoices/${fileName}`;
  }

  async verifyPayment(proofOfPaymentFile, reference) {
    // Manual verification process
    // In production, this would involve:
    // 1. OCR reading of proof of payment
    // 2. Manual admin verification
    // 3. Bank statement matching
    
    const verificationResult = {
      reference: reference,
      status: 'pending',
      verifiedBy: null,
      verifiedAt: null,
      amountVerified: null,
      bankReference: null,
      notes: ''
    };
    
    // Simulate verification process
    return new Promise((resolve) => {
      setTimeout(() => {
        // In reality, this would be done by admin
        verificationResult.status = 'verified';
        verificationResult.verifiedBy = 'admin_system';
        verificationResult.verifiedAt = new Date();
        verificationResult.amountVerified = 500.00;
        verificationResult.bankReference = `FNB${Date.now().toString().slice(-8)}`;
        verificationResult.notes = 'Payment verified via manual check';
        
        resolve(verificationResult);
      }, 5000);
    });
  }

  generateBankStatementUploadForm() {
    return {
      title: 'Upload Proof of Payment',
      instructions: [
        'Take screenshot of successful payment',
        'OR download bank statement PDF',
        'File types: PNG, JPG, PDF',
        'Max size: 10MB',
        'Must show: Amount, Reference, Date'
      ],
      acceptedFormats: ['.png', '.jpg', '.jpeg', '.pdf'],
      maxSizeMB: 10
    };
  }

  async sendPaymentConfirmation(applicantData, paymentDetails) {
    // Send email confirmation
    const emailService = require('../../backend/src/services/email.service');
    
    const emailContent = {
      subject: 'Payment Received - JobAI South Africa',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Received Confirmation</h2>
          <p>Dear ${applicantData.personalInfo.firstName},</p>
          
          <p>We have received your payment of <strong>R${paymentDetails.amount}</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Payment Details</h3>
            <p><strong>Reference:</strong> ${paymentDetails.reference}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-ZA')}</p>
            <p><strong>Amount:</strong> R${paymentDetails.amount}</p>
            <p><strong>Status:</strong> ${paymentDetails.status}</p>
          </div>
          
          <p>Your AI job application service has been activated for 30 days.</p>
          <p>You will receive your enhanced CV within 24 hours.</p>
          
          <p>Best regards,<br>
          JobAI South Africa Team</p>
        </div>
      `
    };
    
    await emailService.sendEmail(
      applicantData.personalInfo.email,
      emailContent.subject,
      emailContent.html
    );
    
    // Send WhatsApp confirmation
    const whatsappService = require('../../backend/src/services/whatsapp.service');
    await whatsappService.sendMessage(
      applicantData.personalInfo.phone,
      `✅ Payment confirmed! R${paymentDetails.amount} received. Reference: ${paymentDetails.reference}. Your AI job search starts now!`
    );
    
    return true;
  }
}

module.exports = FNBEFTService;
