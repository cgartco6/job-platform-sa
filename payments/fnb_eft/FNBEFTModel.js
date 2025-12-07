const mongoose = require('mongoose');

const fnbEFTTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    default: () => `FNB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    unique: true
  },
  
  applicantId: {
    type: String,
    required: true,
    index: true
  },
  
  reference: {
    type: String,
    required: true,
    unique: true
  },
  
  invoiceNumber: {
    type: String,
    required: true
  },
  
  amount: {
    type: Number,
    required: true,
    default: 500.00
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'verified', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  paymentDetails: {
    proofOfPayment: {
      fileUrl: String,
      fileName: String,
      uploadedAt: Date
    },
    bankReference: String,
    paymentDate: Date,
    bankName: String,
    accountHolder: String,
    notes: String
  },
  
  verification: {
    verifiedBy: String,
    verifiedAt: Date,
    method: {
      type: String,
      enum: ['manual', 'ocr', 'statement', 'admin']
    },
    confidence: Number, // 0-100
    notes: String
  },
  
  serviceActivation: {
    activated: { type: Boolean, default: false },
    activatedAt: Date,
    expiresAt: Date,
    durationDays: { type: Number, default: 30 }
  },
  
  // Audit trail
  createdBy: String,
  updatedBy: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiryDate: {
    type: Date,
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
  }
}, {
  timestamps: true
});

// Indexes
fnbEFTTransactionSchema.index({ reference: 1 });
fnbEFTTransactionSchema.index({ applicantId: 1, status: 1 });
fnbEFTTransactionSchema.index({ expiryDate: 1 });
fnbEFTTransactionSchema.index({ 'serviceActivation.expiresAt': 1 });

// Methods
fnbEFTTransactionSchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

fnbEFTTransactionSchema.methods.activateService = function() {
  this.serviceActivation = {
    activated: true,
    activatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    durationDays: 30
  };
  
  this.status = 'verified';
  return this.save();
};

fnbEFTTransactionSchema.methods.getDaysRemaining = function() {
  if (!this.serviceActivation.activated) return 0;
  
  const now = new Date();
  const expires = new Date(this.serviceActivation.expiresAt);
  const diffTime = expires - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

fnbEFTTransactionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'verified') {
    this.serviceActivation.activated = true;
    this.serviceActivation.activatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('FNBEFTTransaction', fnbEFTTransactionSchema);
