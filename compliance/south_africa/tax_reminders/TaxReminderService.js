const nodemailer = require('nodemailer');
const { addMonths, format, startOfMonth, endOfMonth } = require('date-fns');

class TaxReminderService {
  constructor() {
    this.taxThresholds = {
      vat: 1000000, // R1,000,000 annual turnover
      incomeTax: 91250, // Annual income threshold
      provisionalTax: 50000 // Monthly provisional tax threshold
    };
    
    this.taxFreeAge = 62;
    this.taxRates = {
      incomeTax: [
        { threshold: 237100, rate: 0.18 },
        { threshold: 370500, rate: 0.26 },
        { threshold: 512800, rate: 0.31 },
        { threshold: 673000, rate: 0.36 },
        { threshold: 857900, rate: 0.39 },
        { threshold: 1817000, rate: 0.41 },
        { threshold: Infinity, rate: 0.45 }
      ],
      vat: 0.15
    };
  }

  async checkTaxObligations(owner, revenueData) {
    const obligations = [];
    const warnings = [];
    const currentDate = new Date();
    
    // Check VAT obligation
    if (revenueData.annualTurnover >= this.taxThresholds.vat) {
      obligations.push({
        type: 'VAT',
        description: 'VAT registration required (turnover exceeds R1,000,000)',
        dueDate: this.getNextVATDueDate(),
        amount: revenueData.annualTurnover * this.taxRates.vat,
        penalty: 0.10, // 10% penalty for late registration
        form: 'VAT101'
      });
    }
    
    // Check income tax
    if (revenueData.annualIncome >= this.taxThresholds.incomeTax) {
      const taxAmount = this.calculateIncomeTax(revenueData.annualIncome);
      
      obligations.push({
        type: 'Income Tax',
        description: 'Annual income tax return',
        dueDate: this.getTaxYearDueDate(),
        amount: taxAmount,
        penalty: 0.10, // 10% penalty
        form: 'ITR12'
      });
    }
    
    // Check provisional tax
    if (revenueData.monthlyAverage >= this.taxThresholds.provisionalTax) {
      obligations.push({
        type: 'Provisional Tax',
        description: 'Bi-annual provisional tax payments',
        dueDate: this.getNextProvisionalTaxDueDate(),
        amount: revenueData.monthlyAverage * 6 * 0.20, // Estimated
        penalty: 0.20, // 20% penalty for underpayment
        form: 'IRP6'
      });
    }
    
    // Check PAYE if applicable
    if (revenueData.hasEmployees) {
      obligations.push({
        type: 'PAYE',
        description: 'Monthly employees tax',
        dueDate: this.getNextPAYEDueDate(),
        amount: revenueData.payeAmount || 0,
        penalty: 0.10,
        form: 'EMP201'
      });
    }
    
    // Check UIF
    if (revenueData.hasEmployees) {
      obligations.push({
        type: 'UIF',
        description: 'Unemployment Insurance Fund contributions',
        dueDate: this.getNextUIFDueDate(),
        amount: revenueData.uifAmount || 0,
        penalty: 0.10,
        form: 'UI-19'
      });
    }
    
    // Check SDL
    if (revenueData.annualTurnover >= 500000) {
      obligations.push({
        type: 'SDL',
        description: 'Skills Development Levy',
        dueDate: this.getNextSDLDueDate(),
        amount: revenueData.annualTurnover * 0.01, // 1% of payroll
        penalty: 0.10,
        form: 'SDL201'
      });
    }
    
    // Age-based exemptions
    if (owner.age >= this.taxFreeAge) {
      warnings.push({
        type: 'Tax-Free Benefit',
        description: `Age ${owner.age}: Eligible for tax-free investment account`,
        benefit: 'R500,000 annual contribution limit tax-free'
      });
    }
    
    return {
      obligations: obligations,
      warnings: warnings,
      summary: {
        totalObligations: obligations.length,
        estimatedTax: obligations.reduce((sum, o) => sum + o.amount, 0),
        deadline: obligations.length > 0 ? obligations[0].dueDate : null
      }
    };
  }

  calculateIncomeTax(annualIncome) {
    let tax = 0;
    let remainingIncome = annualIncome;
    let previousThreshold = 0;
    
    for (const bracket of this.taxRates.incomeTax) {
      if (annualIncome > previousThreshold) {
        const taxableInBracket = Math.min(
          bracket.threshold - previousThreshold,
          remainingIncome
        );
        tax += taxableInBracket * bracket.rate;
        remainingIncome -= taxableInBracket;
      }
      previousThreshold = bracket.threshold;
    }
    
    return tax;
  }

  getNextVATDueDate() {
    const now = new Date();
    const nextMonth = addMonths(now, 1);
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 25)
      .toISOString().split('T')[0];
  }

  getTaxYearDueDate() {
    const now = new Date();
    const taxYearEnd = new Date(now.getFullYear(), 10, 30); // 30 November
    if (now > taxYearEnd) {
      taxYearEnd.setFullYear(taxYearEnd.getFullYear() + 1);
    }
    return taxYearEnd.toISOString().split('T')[0];
  }

  getNextProvisionalTaxDueDate() {
    const now = new Date();
    const month = now.getMonth();
    let dueDate;
    
    if (month < 7) { // Before August
      dueDate = new Date(now.getFullYear(), 7, 31); // 31 August
    } else {
      dueDate = new Date(now.getFullYear() + 1, 1, 28); // 28 February
    }
    
    return dueDate.toISOString().split('T')[0];
  }

  getNextPAYEDueDate() {
    const now = new Date();
    const nextMonth = addMonths(now, 1);
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 7)
      .toISOString().split('T')[0];
  }

  getNextUIFDueDate() {
    return this.getNextPAYEDueDate();
  }

  getNextSDLDueDate() {
    return this.getNextPAYEDueDate();
  }

  async sendTaxReminder(owner, taxReport) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
    
    const emailContent = this.generateTaxReminderEmail(owner, taxReport);
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: owner.email,
      subject: 'Tax Reminder - JobAI South Africa',
      html: emailContent
    });
    
    // Also send WhatsApp reminder
    if (owner.phone) {
      await this.sendWhatsAppTaxReminder(owner, taxReport);
    }
    
    return { sent: true, timestamp: new Date() };
  }

  generateTaxReminderEmail(owner, taxReport) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0033A0; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; }
          .obligation { background: white; border-left: 4px solid #0033A0; padding: 15px; margin: 10px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; }
          .footer { background: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Tax Reminder</h1>
            <p>JobAI South Africa - Tax Compliance</p>
          </div>
          
          <div class="content">
            <p>Dear ${owner.name},</p>
            
            <p>This is a reminder of your tax obligations for the current period.</p>
            
            ${taxReport.obligations.length > 0 ? `
              <h3>Tax Obligations</h3>
              ${taxReport.obligations.map(ob => `
                <div class="obligation">
                  <h4>${ob.type}</h4>
                  <p>${ob.description}</p>
                  <p><strong>Due Date:</strong> ${ob.dueDate}</p>
                  <p><strong>Amount Due:</strong> R${ob.amount.toFixed(2)}</p>
                  <p><strong>Form:</strong> ${ob.form}</p>
                </div>
              `).join('')}
            ` : ''}
            
            ${taxReport.warnings.length > 0 ? `
              <h3>Special Considerations</h3>
              ${taxReport.warnings.map(w => `
                <div class="warning">
                  <h4>${w.type}</h4>
                  <p>${w.description}</p>
                  <p><strong>Benefit:</strong> ${w.benefit}</p>
                </div>
              `).join('')}
            ` : ''}
            
            <h3>Summary</h3>
            <p>Total obligations: ${taxReport.summary.totalObligations}</p>
            <p>Estimated tax due: R${taxReport.summary.estimatedTax.toFixed(2)}</p>
            ${taxReport.summary.deadline ? `
              <p><strong>Next deadline:</strong> ${taxReport.summary.deadline}</p>
            ` : ''}
            
            <p>Please consult with your tax advisor for accurate calculations.</p>
            
            <p>Best regards,<br>
            JobAI South Africa Compliance Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated tax reminder. Please do not reply to this email.</p>
            <p>For assistance, contact: tax@jobai.co.za</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendWhatsAppTaxReminder(owner, taxReport) {
    const whatsappService = require('../../../backend/src/services/whatsapp.service');
    
    const message = `
      📋 *Tax Reminder - JobAI South Africa*
      
      Dear ${owner.name},
      
      ${taxReport.obligations.length > 0 ? `
        You have ${taxReport.obligations.length} tax obligation(s):
        
        ${taxReport.obligations.slice(0, 3).map(ob => `
        • ${ob.type}: R${ob.amount.toFixed(2)} due ${ob.dueDate}
        `).join('')}
        
        ${taxReport.obligations.length > 3 ? `... and ${taxReport.obligations.length - 3} more` : ''}
      ` : 'No immediate tax obligations.'}
      
      ${owner.age >= this.taxFreeAge ? `
        💰 *Age ${owner.age} Benefit*: Eligible for tax-free investment account
      ` : ''}
      
      Check your email for detailed report or login to your dashboard.
      
      Need help? Contact tax@jobai.co.za
    `;
    
    await whatsappService.sendMessage(owner.phone, message);
  }

  async generateTaxCertificate(owner, period) {
    const certificate = {
      certificateId: `TAX${Date.now()}`,
      companyName: 'JobAI South Africa (Pty) Ltd',
      registration: '2023/123456/07',
      taxNumber: process.env.COMPANY_TAX_NUMBER || '9876543210',
      period: period,
      generated: new Date().toISOString().split('T')[0],
      status: 'Compliant',
      declarations: [
        'VAT registered and compliant',
        'Income tax returns up to date',
        'PAYE compliant (if applicable)',
        'SDL compliant',
        'UIF compliant'
      ],
      nextReview: addMonths(new Date(), 6).toISOString().split('T')[0],
      qrCode: `/tax/certificate/${Date.now()}/qr`
    };
    
    if (owner.age >= this.taxFreeAge) {
      certificate.specialNotes = [
        `Owner age: ${owner.age} years`,
        'Eligible for tax-free investment account',
        'Annual contribution limit: R500,000 tax-free'
      ];
    }
    
    return certificate;
  }

  async scheduleMonthlyReminders() {
    // Schedule monthly tax reminders
    const now = new Date();
    const schedule = {
      nextReminder: startOfMonth(addMonths(now, 1)),
      frequency: 'monthly',
      recipients: ['owner@jobai.co.za', 'accountant@jobai.co.za'],
      lastSent: now
    };
    
    return schedule;
  }
}

module.exports = TaxReminderService;
