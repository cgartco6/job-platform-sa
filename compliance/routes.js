const express = require('express');
const router = express.Router();
const POPIACompliance = require('./south_africa/POPIACompliance');
const TaxReminderService = require('./tax_reminders/TaxReminderService');
const auth = require('../../backend/src/middleware/auth');
const admin = require('../../backend/src/middleware/admin');

const popiaService = new POPIACompliance();
const taxService = new TaxReminderService();

// POPIA Compliance Routes
router.post('/popia/consent', auth, async (req, res) => {
  try {
    const consent = await popiaService.validateConsent(req.body);
    res.json({ success: true, consent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/popia/privacy-policy', async (req, res) => {
  try {
    const policy = popiaService.generatePrivacyPolicy();
    res.json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/popia/data-report/:userId', auth, async (req, res) => {
  try {
    const report = await popiaService.generateDataReport(req.params.userId);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/popia/delete-request', auth, async (req, res) => {
  try {
    const request = await popiaService.handleDataDeletionRequest(
      req.user.applicantId,
      req.body.reason
    );
    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tax Compliance Routes
router.get('/tax/obligations', auth, async (req, res) => {
  try {
    const owner = {
      name: req.user.personalInfo.firstName + ' ' + req.user.personalInfo.lastName,
      email: req.user.personalInfo.email,
      phone: req.user.personalInfo.phone,
      age: req.user.personalInfo.age || 0
    };
    
    const revenueData = {
      annualTurnover: req.body.annualTurnover || 0,
      annualIncome: req.body.annualIncome || 0,
      monthlyAverage: req.body.monthlyAverage || 0,
      hasEmployees: req.body.hasEmployees || false,
      payeAmount: req.body.payeAmount || 0,
      uifAmount: req.body.uifAmount || 0
    };
    
    const obligations = await taxService.checkTaxObligations(owner, revenueData);
    res.json({ success: true, obligations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tax/send-reminder', auth, admin, async (req, res) => {
  try {
    const reminder = await taxService.sendTaxReminder(req.body.owner, req.body.taxReport);
    res.json({ success: true, reminder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tax/certificate', auth, async (req, res) => {
  try {
    const owner = {
      name: req.user.personalInfo.firstName + ' ' + req.user.personalInfo.lastName,
      age: req.user.personalInfo.age || 0
    };
    
    const certificate = await taxService.generateTaxCertificate(owner, req.body.period);
    res.json({ success: true, certificate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tax/schedule', auth, admin, async (req, res) => {
  try {
    const schedule = await taxService.scheduleMonthlyReminders();
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Age Compliance Check
router.get('/compliance/age-check', auth, async (req, res) => {
  try {
    const userAge = req.user.personalInfo.age || 0;
    const compliance = await popiaService.checkAgeCompliance(userAge);
    res.json({ success: true, compliance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate Compliance Certificate
router.get('/compliance/certificate', auth, admin, async (req, res) => {
  try {
    const certificate = popiaService.generateComplianceCertificate();
    res.json({ success: true, certificate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
