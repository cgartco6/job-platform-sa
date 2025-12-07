const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: {
    type: String,
    required: true,
    unique: true
  },
  
  period: {
    start: Date,
    end: Date,
    weekNumber: Number,
    year: Number
  },
  
  revenue: {
    gross: Number,
    vat: Number,
    net: Number,
    transactionCount: Number
  },
  
  distribution: {
    fnb_owner: { amount: Number, percentage: Number },
    african_bank: { amount: Number, percentage: Number },
    ai_fnb: { amount: Number, percentage: Number },
    reserve_fnb: { amount: Number, percentage: Number },
    reserve_growth: { amount: Number, percentage: Number }
  },
  
  instructions: [{
    bank: String,
    accountName: String,
    accountNumber: String,
    branchCode: String,
    amount: Number,
    reference: String,
    status: String
  }],
  
  results: {
    successful: [{
      reference: String,
      amount: Number,
      bank: String,
      transactionId: String,
      timestamp: Date
    }],
    failed: [{
      reference: String,
      amount: Number,
      bank: String,
      error: String,
      timestamp: Date
    }],
    logs: [{
      timestamp: Date,
      action: String,
      details: mongoose.Schema.Types.Mixed,
      result: String
    }]
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
    default: 'pending'
  },
  
  executedBy: String,
  executedAt: Date,
  completedAt: Date,
  
  // Audit trail
  createdBy: String,
  updatedBy: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payout', payoutSchema);
