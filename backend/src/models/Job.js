const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: [String],
  responsibilities: [String],
  benefits: [String],
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  location: {
    city: String,
    province: String,
    country: {
      type: String,
      default: 'South Africa'
    },
    remote: {
      type: Boolean,
      default: false
    },
    hybrid: {
      type: Boolean,
      default: false
    }
  },
  salary: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'ZAR'
    },
    period: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'monthly'
    },
    negotiable: {
      type: Boolean,
      default: false
    }
  },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'remote'],
    default: 'full-time'
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'executive'],
    default: 'mid'
  },
  industry: String,
  category: String,
  tags: [String],
  applicationDeadline: Date,
  status: {
    type: String,
    enum: ['active', 'closed', 'draft', 'expired'],
    default: 'active'
  },
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  }],
  views: {
    type: Number,
    default: 0
  },
  aiOptimized: {
    title: Boolean,
    description: Boolean,
    optimizedAt: Date
  },
  metadata: {
    lastRefreshed: Date,
    autoRenew: {
      type: Boolean,
      default: false
    },
    featured: {
      type: Boolean,
      default: false
    },
    urgent: {
      type: Boolean,
      default: false
    }
  },
  compliance: {
    eeChecked: Boolean,
    bbbeeLevel: String,
    taxCompliant: Boolean,
    verified: Boolean
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search
jobSchema.index({
  title: 'text',
  description: 'text',
  companyName: 'text',
  location: 'text',
  tags: 'text'
});

// Update views
jobSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
};

module.exports = mongoose.model('Job', jobSchema);
