const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { startOfWeek, endOfWeek, subWeeks, format } = require('date-fns');

class WeeklyPayoutService {
  constructor() {
    // Payout distribution percentages
    this.payoutDistribution = {
      fnb_owner: 0.40,      // 40% to FNB account (main owner)
      african_bank: 0.15,   // 15% to African Bank account
      ai_fnb: 0.20,         // 20% to AI FNB account
      reserve_fnb: 0.15,    // 15% to reserve FNB account
      // 10% stays and grows in account
    };
    
    // Bank account details (should be in env in production)
    this.bankAccounts = {
      fnb_owner: {
        bank: 'First National Bank',
        accountName: 'Main Owner Name',
        accountNumber: process.env.FNB_OWNER_ACCOUNT,
        branchCode: '250655',
        swiftCode: 'FIRNZAJJ',
        reference: 'JOBAI-OWNER'
      },
      african_bank: {
        bank: 'African Bank',
        accountName: 'JobAI Operations',
        accountNumber: process.env.AFRICAN_BANK_ACCOUNT,
        branchCode: '430000',
        reference: 'JOBAI-OPS'
      },
      ai_fnb: {
        bank: 'First National Bank',
        accountName: 'JobAI AI Development',
        accountNumber: process.env.AI_FNB_ACCOUNT,
        branchCode: '250655',
        reference: 'JOBAI-AI'
      },
      reserve_fnb: {
        bank: 'First National Bank',
        accountName: 'JobAI Reserve Fund',
        accountNumber: process.env.RESERVE_FNB_ACCOUNT,
        branchCode: '250655',
        reference: 'JOBAI-RESERVE'
      }
    };
    
    this.reserveAccount = {
      balance: 0,
      weeklyGrowthRate: 0.10, // 10% weekly growth
      neverWithdrawn: true
    };
  }

  async calculateWeeklyRevenue(weekStartDate = null) {
    const startDate = weekStartDate ? new Date(weekStartDate) : startOfWeek(new Date(), { weekStartsOn: 1 });
    const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
    
    const Payment = require('../../backend/src/models/Payment');
    
    const weeklyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          byPaymentMethod: {
            $push: {
              method: '$paymentMethod',
              amount: '$amount'
            }
          }
        }
      }
    ]);
    
    const revenue = weeklyRevenue[0]?.totalRevenue || 0;
    
    return {
      period: {
        start: startDate,
        end: endDate,
        weekNumber: this.getWeekNumber(startDate)
      },
      revenue: revenue,
      transactionCount: weeklyRevenue[0]?.transactionCount || 0,
      averageAmount: weeklyRevenue[0]?.averageAmount || 0,
      paymentMethods: this.groupByPaymentMethod(weeklyRevenue[0]?.byPaymentMethod || [])
    };
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  groupByPaymentMethod(methodData) {
    const grouped = {};
    methodData.forEach(item => {
      if (!grouped[item.method]) {
        grouped[item.method] = { total: 0, count: 0 };
      }
      grouped[item.method].total += item.amount;
      grouped[item.method].count += 1;
    });
    return grouped;
  }

  async calculatePayouts(weeklyRevenue) {
    const grossRevenue = weeklyRevenue.revenue;
    
    // Calculate VAT (15%)
    const vat = grossRevenue * 0.15;
    const netRevenue = grossRevenue - vat;
    
    // Calculate payouts
    const payouts = {};
    
    for (const [account, percentage] of Object.entries(this.payoutDistribution)) {
      const amount = netRevenue * percentage;
      payouts[account] = {
        percentage: percentage * 100,
        amount: amount,
        bankDetails: this.bankAccounts[account]
      };
    }
    
    // Calculate reserve growth
    const reserveAmount = netRevenue * 0.10; // 10% stays in account
    const growth = this.reserveAccount.balance * this.reserveAccount.weeklyGrowthRate;
    this.reserveAccount.balance += reserveAmount + growth;
    
    return {
      period: weeklyRevenue.period,
      grossRevenue: grossRevenue,
      vat: vat,
      netRevenue: netRevenue,
      payouts: payouts,
      reserve: {
        amountAdded: reserveAmount,
        growth: growth,
        newBalance: this.reserveAccount.balance,
        weeklyGrowthRate: this.reserveAccount.weeklyGrowthRate * 100
      },
      summary: {
        totalPayout: Object.values(payouts).reduce((sum, p) => sum + p.amount, 0),
        reserveHolding: this.reserveAccount.balance,
        vatPayable: vat
      }
    };
  }

  async generatePayoutInstructions(payoutData) {
    const instructions = {
      date: new Date().toISOString().split('T')[0],
      reference: `PAYOUT-${payoutData.period.weekNumber}-${new Date().getFullYear()}`,
      totalAmount: payoutData.summary.totalPayout,
      instructions: [],
      bankFiles: []
    };
    
    // Generate individual bank instructions
    for (const [account, payout] of Object.entries(payoutData.payouts)) {
      const bankInstruction = {
        bank: payout.bankDetails.bank,
        accountName: payout.bankDetails.accountName,
        accountNumber: payout.bankDetails.accountNumber,
        branchCode: payout.bankDetails.branchCode,
        amount: payout.amount,
        reference: `${payout.bankDetails.reference}-W${payoutData.period.weekNumber}`,
        description: `Weekly payout ${payout.percentage}% - Week ${payoutData.period.weekNumber}`
      };
      
      instructions.instructions.push(bankInstruction);
      
      // Generate bank file for bulk payment
      const bankFile = this.generateBankFile(bankInstruction, account);
      instructions.bankFiles.push(bankFile);
    }
    
    // Generate VAT payment instruction
    if (payoutData.vat > 0) {
      const vatInstruction = {
        bank: 'South African Revenue Service',
        accountName: 'SARS VAT Account',
        accountNumber: '9090909090',
        branchCode: '198765',
        amount: payoutData.vat,
        reference: `VAT-${new Date().getFullYear()}-${payoutData.period.weekNumber}`,
        description: 'VAT Payment - JobAI South Africa',
        dueDate: this.getVATDueDate()
      };
      
      instructions.vatPayment = vatInstruction;
      instructions.instructions.push(vatInstruction);
    }
    
    return instructions;
  }

  generateBankFile(instruction, accountType) {
    // Format for FNB bulk payment file
    const format = accountType.includes('fnb') ? 'FNB' : 'Standard';
    
    const fields = [
      instruction.accountNumber.padEnd(20, ' '),
      instruction.amount.toFixed(2).padStart(15, '0'),
      instruction.reference.padEnd(30, ' '),
      instruction.accountName.padEnd(50, ' '),
      new Date().toISOString().split('T')[0].replace(/-/g, ''),
      format
    ];
    
    return {
      format: format,
      content: fields.join('|'),
      filename: `${instruction.reference}_${format}_${Date.now()}.txt`
    };
  }

  getVATDueDate() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    // VAT due on 25th of following month
    let dueMonth = month + 1;
    let dueYear = year;
    
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear = year + 1;
    }
    
    return new Date(dueYear, dueMonth, 25).toISOString().split('T')[0];
  }

  async executePayouts(payoutInstructions) {
    // In production, this would integrate with bank APIs
    // For now, we'll simulate and log
    
    const results = {
      executed: new Date(),
      successful: [],
      failed: [],
      logs: []
    };
    
    for (const instruction of payoutInstructions.instructions) {
      try {
        // Simulate bank transfer
        const transferResult = await this.simulateBankTransfer(instruction);
        
        if (transferResult.success) {
          results.successful.push({
            reference: instruction.reference,
            amount: instruction.amount,
            bank: instruction.bank,
            transactionId: transferResult.transactionId
          });
          
          results.logs.push({
            timestamp: new Date(),
            action: 'payout_executed',
            details: instruction,
            result: 'success'
          });
        } else {
          results.failed.push({
            reference: instruction.reference,
            amount: instruction.amount,
            bank: instruction.bank,
            error: transferResult.error
          });
          
          results.logs.push({
            timestamp: new Date(),
            action: 'payout_failed',
            details: instruction,
            result: 'failed',
            error: transferResult.error
          });
        }
        
        // Wait between transfers to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.failed.push({
          reference: instruction.reference,
          amount: instruction.amount,
          bank: instruction.bank,
          error: error.message
        });
        
        results.logs.push({
          timestamp: new Date(),
          action: 'payout_error',
          details: instruction,
          result: 'error',
          error: error.message
        });
      }
    }
    
    // Save payout record
    await this.savePayoutRecord(payoutInstructions, results);
    
    // Send email notification
    await this.sendPayoutNotification(payoutInstructions, results);
    
    return results;
  }

  async simulateBankTransfer(instruction) {
    // Simulate bank transfer with 95% success rate
    const success = Math.random() > 0.05; // 5% failure rate
    
    if (success) {
      return {
        success: true,
        transactionId: `TRX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        timestamp: new Date(),
        bankReference: `BANK${Date.now().toString().slice(-8)}`,
        message: 'Transfer successful'
      };
    } else {
      return {
        success: false,
        error: 'Insufficient funds or bank error',
        timestamp: new Date()
      };
    }
  }

  async savePayoutRecord(payoutInstructions, results) {
    const PayoutRecord = require('./PayoutModel');
    
    const record = new PayoutRecord({
      payoutId: `PYT${Date.now()}`,
      period: payoutInstructions.date,
      totalAmount: payoutInstructions.totalAmount,
      successfulTransfers: results.successful.length,
      failedTransfers: results.failed.length,
      instructions: payoutInstructions.instructions,
      results: results,
      status: results.failed.length === 0 ? 'completed' : 'partial',
      executedBy: 'system_auto',
      executedAt: new Date()
    });
    
    await record.save();
    return record;
  }

  async sendPayoutNotification(payoutInstructions, results) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
    
    const emailContent = `
      <h2>Weekly Payout Report - Week ${payoutInstructions.reference.split('-')[1]}</h2>
      
      <p><strong>Date:</strong> ${payoutInstructions.date}</p>
      <p><strong>Total Payout:</strong> R${payoutInstructions.totalAmount.toFixed(2)}</p>
      <p><strong>Successful Transfers:</strong> ${results.successful.length}</p>
      <p><strong>Failed Transfers:</strong> ${results.failed.length}</p>
      
      <h3>Successful Transfers:</h3>
      <table border="1" cellpadding="5" style="border-collapse: collapse;">
        <tr>
          <th>Reference</th>
          <th>Amount</th>
          <th>Bank</th>
          <th>Transaction ID</th>
        </tr>
        ${results.successful.map(t => `
          <tr>
            <td>${t.reference}</td>
            <td>R${t.amount.toFixed(2)}</td>
            <td>${t.bank}</td>
            <td>${t.transactionId}</td>
          </tr>
        `).join('')}
      </table>
      
      ${results.failed.length > 0 ? `
        <h3>Failed Transfers:</h3>
        <table border="1" cellpadding="5" style="border-collapse: collapse;">
          <tr>
            <th>Reference</th>
            <th>Amount</th>
            <th>Bank</th>
            <th>Error</th>
          </tr>
          ${results.failed.map(t => `
            <tr>
              <td>${t.reference}</td>
              <td>R${t.amount.toFixed(2)}</td>
              <td>${t.bank}</td>
              <td>${t.error}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}
      
      <h3>Reserve Account Status:</h3>
      <p>Balance: R${this.reserveAccount.balance.toFixed(2)}</p>
      <p>Weekly Growth Rate: ${this.reserveAccount.weeklyGrowthRate * 100}%</p>
      
      <p>Please log in to the admin dashboard for detailed reports.</p>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `Weekly Payout Report - ${payoutInstructions.date}`,
      html: emailContent
    });
  }

  async getPayoutHistory(limit = 10) {
    const PayoutRecord = require('./PayoutModel');
    
    return await PayoutRecord.find()
      .sort({ executedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getReserveAccountStatus() {
    const PayoutRecord = require('./PayoutModel');
    
    const totalPayouts = await PayoutRecord.aggregate([
      {
        $group: {
          _id: null,
          totalPayout: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return {
      currentBalance: this.reserveAccount.balance,
      weeklyGrowthRate: this.reserveAccount.weeklyGrowthRate,
      neverWithdrawn: this.reserveAccount.neverWithdrawn,
      projectedBalance: this.reserveAccount.balance * Math.pow(1 + this.reserveAccount.weeklyGrowthRate, 52), // 1 year projection
      totalPayouts: totalPayouts[0]?.totalPayout || 0,
      totalTransactions: totalPayouts[0]?.count || 0
    };
  }
}

module.exports = WeeklyPayoutService;
