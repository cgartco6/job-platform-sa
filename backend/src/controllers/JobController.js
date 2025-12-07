const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const AIJobOptimizer = require('../services/ai_services/AIJobOptimizer');
const cache = require('../utils/cache');

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Employer)
exports.createJob = asyncHandler(async (req, res, next) => {
  const user = req.user;
  
  // Check if user is employer
  if (user.role !== 'employer' && user.role !== 'admin') {
    return next(new ErrorResponse('Only employers can post jobs', 403));
  }
  
  // Check subscription limits
  if (user.subscription.plan === 'free' && user.stats.jobsPosted >= 3) {
    return next(new ErrorResponse('Free plan limit reached. Upgrade to post more jobs.', 403));
  }
  
  const jobData = {
    ...req.body,
    company: user._id,
    companyName: user.company?.name || user.fullName
  };
  
  // AI optimization if enabled
  if (req.body.aiOptimize) {
    try {
      const optimizedJob = await AIJobOptimizer.optimizeJobDescription(jobData);
      jobData.description = optimizedJob.description;
      jobData.title = optimizedJob.title;
      jobData.aiOptimized = {
        title: true,
        description: true,
        optimizedAt: new Date()
      };
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  }
  
  const job = await Job.create(jobData);
  
  // Update user stats
  await User.findByIdAndUpdate(user._id, {
    $inc: { 'stats.jobsPosted': 1 }
  });
  
  // Clear cache
  cache.del('jobs:*');
  
  res.status(201).json({
    success: true,
    data: job
  });
});

// @desc    Get all jobs with filters
// @route   GET /api/jobs
// @access  Public
exports.getJobs = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search,
    location,
    jobType,
    experienceLevel,
    salaryMin,
    salaryMax,
    remote,
    industry,
    sort = '-createdAt'
  } = req.query;
  
  const cacheKey = `jobs:${JSON.stringify(req.query)}`;
  const cachedData = await cache.get(cacheKey);
  
  if (cachedData) {
    return res.json({
      success: true,
      fromCache: true,
      ...cachedData
    });
  }
  
  let query = { status: 'active' };
  
  // Search
  if (search) {
    query.$text = { $search: search };
  }
  
  // Filters
  if (location) {
    query['location.city'] = new RegExp(location, 'i');
  }
  
  if (jobType) {
    query.jobType = jobType;
  }
  
  if (experienceLevel) {
    query.experienceLevel = experienceLevel;
  }
  
  if (salaryMin || salaryMax) {
    query['salary.min'] = {};
    if (salaryMin) query['salary.min'].$gte = Number(salaryMin);
    if (salaryMax) query['salary.min'].$lte = Number(salaryMax);
  }
  
  if (remote !== undefined) {
    query['location.remote'] = remote === 'true';
  }
  
  if (industry) {
    query.industry = new RegExp(industry, 'i');
  }
  
  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  
  // Execute query
  const jobs = await Job.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate('company', 'company.name profilePicture');
  
  const total = await Job.countDocuments(query);
  
  const result = {
    success: true,
    count: jobs.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    data: jobs
  };
  
  // Cache for 5 minutes
  await cache.set(cacheKey, result, 300);
  
  res.json(result);
});

// @desc    Get job by ID
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id)
    .populate('company', 'company.name profile.email profile.phone company.website');
  
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  
  // Increment views
  job.incrementViews();
  
  res.json({
    success: true,
    data: job
  });
});

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private (Employer)
exports.updateJob = asyncHandler(async (req, res, next) => {
  let job = await Job.findById(req.params.id);
  
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  
  // Check ownership
  if (job.company.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this job', 403));
  }
  
  // AI optimization if requested
  if (req.body.aiOptimize) {
    try {
      const optimizedJob = await AIJobOptimizer.optimizeJobDescription({
        ...job.toObject(),
        ...req.body
      });
      req.body.description = optimizedJob.description;
      req.body.title = optimizedJob.title;
      req.body.aiOptimized = {
        ...job.aiOptimized,
        optimizedAt: new Date()
      };
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  }
  
  job = await Job.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  // Clear cache
  cache.del('jobs:*');
  
  res.json({
    success: true,
    data: job
  });
});

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private (Employer/Admin)
exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);
  
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  
  // Check ownership
  if (job.company.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this job', 403));
  }
  
  await job.remove();
  
  // Update user stats
  await User.findByIdAndUpdate(req.user.id, {
    $inc: { 'stats.jobsPosted': -1 }
  });
  
  // Clear cache
  cache.del('jobs:*');
  
  res.json({
    success: true,
    message: 'Job deleted successfully'
  });
});

// @desc    Get employer's jobs
// @route   GET /api/jobs/employer/my-jobs
// @access  Private (Employer)
exports.getEmployerJobs = asyncHandler(async (req, res, next) => {
  const jobs = await Job.find({ company: req.user.id })
    .sort('-createdAt')
    .populate('applications');
  
  const stats = {
    total: jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    closed: jobs.filter(j => j.status === 'closed').length,
    draft: jobs.filter(j => j.status === 'draft').length,
    totalApplications: jobs.reduce((sum, job) => sum + job.applications.length, 0),
    totalViews: jobs.reduce((sum, job) => sum + job.views, 0)
  };
  
  res.json({
    success: true,
    stats,
    data: jobs
  });
});

// @desc    Get job analytics
// @route   GET /api/jobs/:id/analytics
// @access  Private (Employer)
exports.getJobAnalytics = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id)
    .populate({
      path: 'applications',
      populate: {
        path: 'applicant',
        select: 'firstName lastName email profile.title'
      }
    });
  
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  
  if (job.company.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized', 403));
  }
  
  const analytics = {
    views: job.views,
    totalApplications: job.applications.length,
    applicationSources: job.applications.reduce((acc, app) => {
      acc[app.source] = (acc[app.source] || 0) + 1;
      return acc;
    }, {}),
    statusDistribution: job.applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {}),
    topSkills: job.applications.reduce((acc, app) => {
      if (app.applicant?.profile?.skills) {
        app.applicant.profile.skills.forEach(skill => {
          acc[skill] = (acc[skill] || 0) + 1;
        });
      }
      return acc;
    }, {}),
    timeline: job.applications.reduce((acc, app) => {
      const date = app.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {})
  };
  
  res.json({
    success: true,
    data: analytics
  });
});
