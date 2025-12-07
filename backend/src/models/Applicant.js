const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const applicantSchema = new mongoose.Schema({
  applicantId: {
    type: String,
    default: () => `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    unique: true
  },
  personalInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^(\+27|0)[6-8][0-9]{8}$/.test(v);
        },
        message: props => `${props.value} is not a valid South African phone number!`
      }
    },
    whatsappNumber: String,
    idNumber: {
      type: String,
      validate: {
        validator: function(v) {
          return /^[0-9]{13}$/.test(v);
        },
        message: props => `${props.value} is not a valid South African ID number!`
      }
    }
  },
  
  // Uploaded documents
  originalCV: {
    fileUrl: String,
    fileName: String,
    fileType: String,
    uploadedAt: Date
  },
  photo: {
    fileUrl: String,
    fileName: String,
    verified: { type: Boolean, default: false },
    aiVerified: { type: Boolean, default: false }
  },
  qualifications: [{
    name: String,
    institution: String,
    year: Number,
    fileUrl: String,
    verified: { type: Boolean, default: false }
  }],
  
  // AI processed documents
  enhancedCV: {
    content: String,
    fileUrl: String,
    aiVersion: String,
    generatedAt: Date,
    downloadCount: { type: Number, default: 0 }
  },
  coverLetter: {
    content: String,
    fileUrl: String,
    generatedAt: Date,
    customizations: [{
      jobId: String,
      content: String,
      appliedAt: Date
    }]
  },
  
  // Payment info
  payment: {
    amount: { type: Number, default: 500.00 },
    currency: { type: String, default: 'ZAR' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    reference: String,
    paymentMethod: String,
    transactionId: String,
    paymentDate: Date
  },
  
  // Job preferences
  preferences: {
    industries: [String],
    jobTitles: [String],
    locations: [String],
    salaryRange: {
      min: Number,
      max: Number,
      currency: { type: String, default: 'ZAR' }
    },
    employmentTypes: [String],
    remotePreference: {
      type: String,
      enum: ['onsite', 'remote', 'hybrid', 'any'],
      default: 'any'
    }
  },
  
  // Application tracking
  applications: [{
    jobId: String,
    jobTitle: String,
    company: String,
    platform: String,
    appliedDate: Date,
    status: {
      type: String,
      enum: ['applied', 'viewed', 'shortlisted', 'interview', 'rejected', 'offered'],
      default: 'applied'
    },
    applicationMethod: String,
    trackingId: String,
    responses: [{
      type: { type: String, enum: ['email', 'call', 'whatsapp'] },
      content: String,
      date: Date,
      direction: { type: String, enum: ['incoming', 'outgoing'] }
    }]
  }],
  
  // Communication settings
  notifications: {
    whatsapp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    interviewReminders: { type: Boolean, default: true },
    jobMatches: { type: Boolean, default: true },
    applicationUpdates: { type: Boolean, default: true }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['registered', 'payment_pending', 'active', 'paused', 'employed', 'inactive'],
    default: 'registered'
  },
  employmentStatus: {
    employed: { type: Boolean, default: false },
    employmentStartDate: Date,
    company: String,
    position: String
  },
  
  // Analytics
  activityLog: [{
    action: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // Security
  password: { type: String, required: true },
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
applicantSchema.index({ 'personalInfo.email': 1 });
applicantSchema.index({ 'applicantId': 1 });
applicantSchema.index({ 'status': 1 });
applicantSchema.index({ 'payment.status': 1 });
applicantSchema.index({ 'applications.appliedDate': -1 });

// Pre-save middleware
applicantSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Methods
applicantSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

applicantSchema.methods.incrementLoginAttempts = function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
  }
  return this.save();
};

applicantSchema.methods.resetLoginAttempts = function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return this.save();
};

module.exports = mongoose.model('Applicant', applicantSchema);
