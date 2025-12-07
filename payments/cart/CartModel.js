const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  items: [{
    productId: String,
    name: String,
    description: String,
    price: Number,
    quantity: Number,
    total: Number,
    features: [String],
    category: String,
    addedAt: { type: Date, default: Date.now }
  }],
  
  totals: {
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  discount: {
    code: String,
    amount: Number,
    type: String,
    value: Number,
    appliedAt: Date
  },
  
  status: {
    type: String,
    enum: ['active', 'checked_out', 'abandoned', 'expired'],
    default: 'active'
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Cart', cartSchema);
