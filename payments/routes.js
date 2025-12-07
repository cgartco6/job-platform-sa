const express = require('express');
const router = express.Router();
const FNBEFTService = require('./fnb_eft/FNBEFTService');
const PayFastService = require('./payfast/PayFastService');
const PayShapService = require('./payshap/PayShapService');
const ShoppingCartService = require('./cart/ShoppingCartService');
const WeeklyPayoutService = require('./payout/WeeklyPayoutService');
const auth = require('../../backend/src/middleware/auth');

const fnbService = new FNBEFTService();
const payfastService = new PayFastService();
const payshapService = new PayShapService();
const cartService = new ShoppingCartService();
const payoutService = new WeeklyPayoutService();

// FNB EFT Routes
router.post('/fnb/generate-invoice', auth, async (req, res) => {
  try {
    const invoice = await fnbService.createEFTInvoice(req.user, req.body.amount || 500);
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/fnb/upload-proof', auth, async (req, res) => {
  try {
    const { reference, file } = req.body;
    const verification = await fnbService.verifyPayment(file, reference);
    res.json({ success: true, verification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PayFast Routes
router.post('/payfast/initiate', auth, async (req, res) => {
  try {
    const paymentData = payfastService.generatePaymentData(req.user, req.body.amount || 500);
    const paymentUrl = payfastService.getPaymentUrl(paymentData);
    res.json({ success: true, paymentUrl, paymentData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payfast/notify', async (req, res) => {
  try {
    const result = await payfastService.handleITN(req.body);
    res.status(200).send('OK');
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PayShap Routes
router.post('/payshap/initiate', auth, async (req, res) => {
  try {
    const result = await payshapService.initiatePayment(
      req.user,
      req.body.amount || 500,
      req.body.bank || 'fnb'
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payshap/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-payshap-signature'];
    const result = await payshapService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shopping Cart Routes
router.post('/cart/create', auth, async (req, res) => {
  try {
    const cart = await cartService.createCart(req.user.applicantId);
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cart/add', auth, async (req, res) => {
  try {
    const { cartId, productId, quantity } = req.body;
    const cart = await cartService.addToCart(cartId, productId, quantity || 1);
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cart/remove', auth, async (req, res) => {
  try {
    const { cartId, productId } = req.body;
    const cart = await cartService.removeFromCart(cartId, productId);
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cart/checkout', auth, async (req, res) => {
  try {
    const { cartId, paymentMethod } = req.body;
    const result = await cartService.checkout(cartId, req.user, paymentMethod);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Weekly Payout Routes (Admin only)
router.post('/payout/calculate', auth, async (req, res) => {
  try {
    const weeklyRevenue = await payoutService.calculateWeeklyRevenue(req.body.startDate);
    const payoutData = await payoutService.calculatePayouts(weeklyRevenue);
    const instructions = await payoutService.generatePayoutInstructions(payoutData);
    res.json({ success: true, payoutData, instructions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payout/execute', auth, async (req, res) => {
  try {
    const results = await payoutService.executePayouts(req.body.instructions);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/payout/history', auth, async (req, res) => {
  try {
    const history = await payoutService.getPayoutHistory(req.query.limit || 10);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/payout/reserve', auth, async (req, res) => {
  try {
    const status = await payoutService.getReserveAccountStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
