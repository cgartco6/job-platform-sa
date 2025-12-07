const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analytics.service');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const analyticsService = new AnalyticsService();

// Revenue analytics
router.get('/revenue/daily', auth, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const revenueData = await analyticsService.getDailyRevenue(startDate, endDate);
    res.json(revenueData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/revenue/monthly', auth, admin, async (req, res) => {
  try {
    const revenueData = await analyticsService.getMonthlyRevenue();
    res.json(revenueData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User analytics
router.get('/users/active', auth, admin, async (req, res) => {
  try {
    const activeUsers = await analyticsService.getActiveUsers();
    res.json(activeUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/conversion', auth, admin, async (req, res) => {
  try {
    const conversionData = await analyticsService.getConversionMetrics();
    res.json(conversionData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Job application analytics
router.get('/applications/stats', auth, admin, async (req, res) => {
  try {
    const stats = await analyticsService.getApplicationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/applications/success-rate', auth, admin, async (req, res) => {
  try {
    const successRate = await analyticsService.getSuccessRate();
    res.json(successRate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Platform performance
router.get('/platforms/performance', auth, admin, async (req, res) => {
  try {
    const performance = await analyticsService.getPlatformPerformance();
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Target achievement tracking
router.get('/targets/achievement', auth, admin, async (req, res) => {
  try {
    const targetData = await analyticsService.getTargetAchievement();
    res.json(targetData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time dashboard
router.get('/dashboard/overview', auth, admin, async (req, res) => {
  try {
    const overview = await analyticsService.getDashboardOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data
router.get('/export/:type', auth, admin, async (req, res) => {
  try {
    const { type } = req.params;
    const data = await analyticsService.exportData(type);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${Date.now()}.csv`);
    
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
