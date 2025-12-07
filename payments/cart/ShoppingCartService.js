const mongoose = require('mongoose');

class ShoppingCartService {
  constructor() {
    this.products = {
      basic: {
        id: 'basic_ai_service',
        name: 'Basic AI Job Application',
        description: '30 days of AI job application service',
        price: 500,
        duration: 30,
        features: [
          'AI CV enhancement',
          'Job matching',
          'Auto-application (10/day)',
          'WhatsApp notifications',
          'Basic support'
        ],
        category: 'service'
      },
      premium: {
        id: 'premium_ai_service',
        name: 'Premium AI Job Application',
        description: '60 days premium service with priority',
        price: 900,
        duration: 60,
        features: [
          'Everything in Basic',
          'Priority job matching',
          'Unlimited applications',
          'Cover letter customization',
          'Interview preparation',
          'Priority support',
          'CV ATS optimization'
        ],
        category: 'service'
      },
      cv_rewrite: {
        id: 'cv_rewrite',
        name: 'Professional CV Rewrite',
        description: 'One-time professional CV rewrite',
        price: 300,
        features: [
          'ATS optimization',
          'Industry-specific keywords',
          'Achievement-focused formatting',
          'Professional template',
          'Unlimited revisions (7 days)'
        ],
        category: 'cv_service'
      },
      interview_coaching: {
        id: 'interview_coaching',
        name: 'AI Interview Coaching',
        description: 'AI-powered interview preparation',
        price: 400,
        features: [
          'Mock interview sessions',
          'Common questions database',
          'Answer optimization',
          'Body language analysis',
          'Salary negotiation tips'
        ],
        category: 'coaching'
      },
      linkedin_optimization: {
        id: 'linkedin_optimization',
        name: 'LinkedIn Profile Optimization',
        description: 'Complete LinkedIn profile makeover',
        price: 250,
        features: [
          'Profile headline optimization',
          'About section rewrite',
          'Experience enhancement',
          'Skills endorsement strategy',
          'Connection growth tips'
        ],
        category: 'profile_service'
      }
    };
    
    this.discounts = {
      'WELCOME10': { type: 'percentage', value: 10, minAmount: 500 },
      'FIRST50': { type: 'fixed', value: 50, minAmount: 1000 },
      'REFER20': { type: 'percentage', value: 20, minAmount: 0 }
    };
  }

  async createCart(userId) {
    const Cart = require('./CartModel');
    
    const cart = new Cart({
      userId: userId,
      sessionId: `CART${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      items: [],
      totals: {
        subtotal: 0,
        discount: 0,
        vat: 0,
        total: 0
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    await cart.save();
    return cart;
  }

  async addToCart(cartId, productId, quantity = 1) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    const product = this.products[productId];
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].total = 
        cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].price;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: quantity,
        total: product.price * quantity,
        features: product.features,
        category: product.category,
        addedAt: new Date()
      });
    }
    
    // Recalculate totals
    await this.calculateTotals(cart);
    
    await cart.save();
    return cart;
  }

  async removeFromCart(cartId, productId) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    cart.items = cart.items.filter(item => item.productId !== productId);
    
    // Recalculate totals
    await this.calculateTotals(cart);
    
    await cart.save();
    return cart;
  }

  async updateQuantity(cartId, productId, quantity) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].total = cart.items[itemIndex].price * quantity;
    }
    
    // Recalculate totals
    await this.calculateTotals(cart);
    
    await cart.save();
    return cart;
  }

  async applyDiscount(cartId, discountCode) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    const discount = this.discounts[discountCode];
    if (!discount) {
      throw new Error('Invalid discount code');
    }
    
    // Check minimum amount
    if (cart.totals.subtotal < discount.minAmount) {
      throw new Error(`Minimum amount of R${discount.minAmount} required for this discount`);
    }
    
    let discountAmount = 0;
    
    if (discount.type === 'percentage') {
      discountAmount = (cart.totals.subtotal * discount.value) / 100;
    } else if (discount.type === 'fixed') {
      discountAmount = discount.value;
    }
    
    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, cart.totals.subtotal);
    
    cart.discount = {
      code: discountCode,
      amount: discountAmount,
      type: discount.type,
      value: discount.value
    };
    
    // Recalculate totals
    await this.calculateTotals(cart);
    
    await cart.save();
    return cart;
  }

  async calculateTotals(cart) {
    // Calculate subtotal
    cart.totals.subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
    
    // Apply discount if exists
    const discountAmount = cart.discount?.amount || 0;
    
    // Calculate VAT (15% on discounted amount)
    const taxableAmount = cart.totals.subtotal - discountAmount;
    cart.totals.vat = taxableAmount * 0.15;
    
    // Calculate total
    cart.totals.total = taxableAmount + cart.totals.vat;
    
    return cart;
  }

  async checkout(cartId, userData, paymentMethod) {
    const Cart = require('./CartModel');
    const Order = require('./OrderModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    
    // Check if cart is expired
    if (new Date() > cart.expiresAt) {
      throw new Error('Cart has expired. Please create a new cart.');
    }
    
    // Create order
    const order = new Order({
      orderId: `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      userId: cart.userId,
      items: cart.items,
      totals: cart.totals,
      discount: cart.discount,
      userData: userData,
      paymentMethod: paymentMethod,
      status: 'pending',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours to pay
    });
    
    await order.save();
    
    // Clear cart
    cart.items = [];
    cart.totals = { subtotal: 0, discount: 0, vat: 0, total: 0 };
    cart.discount = null;
    await cart.save();
    
    return {
      order: order,
      paymentOptions: this.getPaymentOptions(order, paymentMethod)
    };
  }

  getPaymentOptions(order, preferredMethod) {
    const options = {
      fnb_eft: {
        method: 'fnb_eft',
        name: 'FNB EFT Payment',
        description: 'Bank transfer to FNB account',
        instructions: 'Make EFT payment and upload proof',
        amount: order.totals.total,
        reference: order.orderId,
        validity: '3 days'
      },
      payfast: {
        method: 'payfast',
        name: 'PayFast Online Payment',
        description: 'Secure online payment via card/instant EFT',
        instructions: 'Redirect to PayFast secure payment page',
        amount: order.totals.total,
        instant: true,
        methods: ['card', 'instant_eft', 'ozow', 'snapscan']
      },
      payshap: {
        method: 'payshap',
        name: 'PayShap Instant Payment',
        description: 'Real-time payment via banking app',
        instructions: 'Scan QR code or use payment link',
        amount: order.totals.total,
        instant: true,
        qrCode: true
      }
    };
    
    return preferredMethod ? [options[preferredMethod]] : Object.values(options);
  }

  async getOrderStatus(orderId) {
    const Order = require('./OrderModel');
    
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      throw new Error('Order not found');
    }
    
    return {
      orderId: order.orderId,
      status: order.status,
      total: order.totals.total,
      items: order.items,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      paymentMethod: order.paymentMethod,
      isExpired: new Date() > order.expiresAt
    };
  }

  async cancelOrder(orderId) {
    const Order = require('./OrderModel');
    
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.status !== 'pending') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }
    
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    
    return order;
  }

  async getProductRecommendations(userId) {
    // Based on user profile and previous purchases
    const recommendations = [];
    
    // Always recommend basic service
    recommendations.push(this.products.basic);
    
    // If user is in IT/tech, recommend premium
    // This would query user profile in production
    recommendations.push(this.products.premium);
    
    // Recommend CV rewrite if no recent purchase
    recommendations.push(this.products.cv_rewrite);
    
    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }

  async getCartSummary(cartId) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      return null;
    }
    
    return {
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.totals.subtotal,
      discount: cart.totals.discount,
      vat: cart.totals.vat,
      total: cart.totals.total,
      items: cart.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      expiresIn: Math.max(0, cart.expiresAt - new Date())
    };
  }

  async validateCart(cartId) {
    const Cart = require('./CartModel');
    
    const cart = await Cart.findOne({ sessionId: cartId });
    if (!cart) {
      return { valid: false, error: 'Cart not found' };
    }
    
    if (new Date() > cart.expiresAt) {
      return { valid: false, error: 'Cart expired' };
    }
    
    if (cart.items.length === 0) {
      return { valid: false, error: 'Cart is empty' };
    }
    
    // Validate all products still exist
    for (const item of cart.items) {
      if (!this.products[item.productId]) {
        return { valid: false, error: `Product ${item.name} no longer available` };
      }
    }
    
    return { valid: true, cart: cart };
  }
}

module.exports = ShoppingCartService;
