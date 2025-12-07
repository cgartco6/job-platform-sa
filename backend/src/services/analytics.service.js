const mongoose = require('mongoose');
const Applicant = require('../models/Applicant');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } = require('date-fns');

class AnalyticsService {
  constructor() {
    this.targets = {
      initial: {
        applicants: 5000,
        days: 10,
        revenue: 5000 * 500 // 2,500,000 ZAR
      },
      monthly: {
        applicants: 1000000,
        revenue: 1000000 * 500 // 500,000,000 ZAR
      }
    };
  }

  async getDailyRevenue(startDate = null, endDate = null) {
    const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate) : new Date();

    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
            day: { $dayOfMonth: '$paymentDate' }
          },
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          totalRevenue: 1,
          transactionCount: 1,
          averageAmount: 1
        }
      }
    ]);

    return revenueData;
  }

  async getMonthlyRevenue() {
    const sixMonthsAgo = subDays(new Date(), 180);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          newCustomers: {
            $addToSet: '$applicantId'
          }
        }
      },
      {
        $project: {
          month: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1
            }
          },
          totalRevenue: 1,
          transactionCount: 1,
          newCustomers: { $size: '$newCustomers' }
        }
      },
      {
        $sort: { month: -1 }
      }
    ]);

    return monthlyRevenue;
  }

  async getActiveUsers() {
    const thirtyDaysAgo = subDays(new Date(), 30);

    const activeUsers = await Applicant.aggregate([
      {
        $match: {
          status: 'active',
          updatedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalActive: { $sum: 1 },
          byLocation: {
            $push: {
              location: '$preferences.locations',
              count: 1
            }
          },
          byIndustry: {
            $push: {
              industry: '$preferences.industries',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          totalActive: 1,
          locationDistribution: {
            $reduce: {
              input: '$byLocation',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: { $arrayElemAt: ['$$this.location', 0] },
                          v: { $sum: ['$$this.count'] }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          },
          industryDistribution: {
            $reduce: {
              input: '$byIndustry',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: { $arrayElemAt: ['$$this.industry', 0] },
                          v: { $sum: ['$$this.count'] }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    return activeUsers[0] || { totalActive: 0 };
  }

  async getConversionMetrics() {
    const metrics = await Applicant.aggregate([
      {
        $facet: {
          totalRegistered: [
            { $count: 'count' }
          ],
          paidUsers: [
            { $match: { 'payment.status': 'completed' } },
            { $count: 'count' }
          ],
          activeUsers: [
            { $match: { status: 'active' } },
            { $count: 'count' }
          ],
          employedUsers: [
            { $match: { 'employmentStatus.employed': true } },
            { $count: 'count' }
          ],
          dailyRegistrations: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: -1 } },
            { $limit: 7 }
          ]
        }
      },
      {
        $project: {
          totalRegistered: { $arrayElemAt: ['$totalRegistered.count', 0] },
          paidUsers: { $arrayElemAt: ['$paidUsers.count', 0] },
          activeUsers: { $arrayElemAt: ['$activeUsers.count', 0] },
          employedUsers: { $arrayElemAt: ['$employedUsers.count', 0] },
          conversionRate: {
            $multiply: [
              {
                $divide: [
                  { $arrayElemAt: ['$paidUsers.count', 0] },
                  { $arrayElemAt: ['$totalRegistered.count', 0] }
                ]
              },
              100
            ]
          },
          employmentRate: {
            $multiply: [
              {
                $divide: [
                  { $arrayElemAt: ['$employedUsers.count', 0] },
                  { $arrayElemAt: ['$paidUsers.count', 0] }
                ]
              },
              100
            ]
          },
          dailyRegistrations: '$dailyRegistrations'
        }
      }
    ]);

    return metrics[0] || {};
  }

  async getApplicationStats() {
    const stats = await Applicant.aggregate([
      {
        $match: { 'applications.0': { $exists: true } }
      },
      {
        $unwind: '$applications'
      },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          applicationsByStatus: {
            $push: {
              status: '$applications.status',
              count: 1
            }
          },
          applicationsByPlatform: {
            $push: {
              platform: '$applications.platform',
              count: 1
            }
          },
          averageApplicationsPerUser: { $avg: { $size: '$applications' } },
          successfulApplications: {
            $sum: {
              $cond: [
                { $in: ['$applications.status', ['interview', 'offered']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          totalApplications: 1,
          averageApplicationsPerUser: 1,
          successfulApplications: 1,
          successRate: {
            $multiply: [
              { $divide: ['$successfulApplications', '$totalApplications'] },
              100
            ]
          },
          statusDistribution: {
            $reduce: {
              input: '$applicationsByStatus',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this.status',
                          v: { $sum: ['$$this.count'] }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          },
          platformDistribution: {
            $reduce: {
              input: '$applicationsByPlatform',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this.platform',
                          v: { $sum: ['$$this.count'] }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    return stats[0] || {};
  }

  async getSuccessRate() {
    const successData = await Applicant.aggregate([
      {
        $match: {
          'applications.0': { $exists: true },
          'payment.status': 'completed'
        }
      },
      {
        $project: {
          applicantId: 1,
          applications: 1,
          hasSuccess: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$applications',
                    as: 'app',
                    cond: { $in: ['$$app.status', ['interview', 'offered']] }
                  }
                }
              },
              0
            ]
          },
          isEmployed: '$employmentStatus.employed'
        }
      },
      {
        $group: {
          _id: null,
          totalApplicants: { $sum: 1 },
          applicantsWithInterviews: {
            $sum: { $cond: ['$hasSuccess', 1, 0] }
          },
          employedApplicants: {
            $sum: { $cond: ['$isEmployed', 1, 0] }
          }
        }
      },
      {
        $project: {
          totalApplicants: 1,
          interviewRate: {
            $multiply: [
              { $divide: ['$applicantsWithInterviews', '$totalApplicants'] },
              100
            ]
          },
          employmentRate: {
            $multiply: [
              { $divide: ['$employedApplicants', '$totalApplicants'] },
              100
            ]
          }
        }
      }
    ]);

    return successData[0] || {};
  }

  async getPlatformPerformance() {
    const performance = await Applicant.aggregate([
      {
        $unwind: '$applications'
      },
      {
        $group: {
          _id: '$applications.platform',
          totalApplications: { $sum: 1 },
          successfulApplications: {
            $sum: {
              $cond: [
                { $in: ['$applications.status', ['interview', 'offered']] },
                1,
                0
              ]
            }
          },
          averageResponseTime: {
            $avg: {
              $cond: [
                { $ne: ['$applications.responses', []] },
                {
                  $divide: [
                    {
                      $subtract: [
                        { $arrayElemAt: ['$applications.responses.date', 0] },
                        '$applications.appliedDate'
                      ]
                    },
                    1000 * 60 * 60 * 24 // Convert to days
                  ]
                },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          platform: '$_id',
          totalApplications: 1,
          successfulApplications: 1,
          successRate: {
            $multiply: [
              { $divide: ['$successfulApplications', '$totalApplications'] },
              100
            ]
          },
          averageResponseTime: 1
        }
      },
      {
        $sort: { successRate: -1 }
      }
    ]);

    return performance;
  }

  async getTargetAchievement() {
    const now = new Date();
    const tenDaysAgo = subDays(now, 10);
    const startOfCurrentMonth = startOfMonth(now);

    const [initialTarget, monthlyTarget] = await Promise.all([
      this._calculateTargetAchievement(tenDaysAgo, now, this.targets.initial),
      this._calculateTargetAchievement(startOfCurrentMonth, now, this.targets.monthly)
    ]);

    return {
      initialTarget,
      monthlyTarget,
      overallProgress: {
        applicants: await Applicant.countDocuments(),
        revenue: await this._getTotalRevenue(),
        timestamp: now
      }
    };
  }

  async _calculateTargetAchievement(startDate, endDate, target) {
    const [applicants, revenue] = await Promise.all([
      Applicant.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        'payment.status': 'completed'
      }),
      this._getRevenueInPeriod(startDate, endDate)
    ]);

    return {
      target: target.applicants,
      achieved: applicants,
      percentage: (applicants / target.applicants) * 100,
      revenueTarget: target.revenue,
      revenueAchieved: revenue,
      revenuePercentage: (revenue / target.revenue) * 100,
      period: { startDate, endDate }
    };
  }

  async _getRevenueInPeriod(startDate, endDate) {
    const result = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          paymentDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  async _getTotalRevenue() {
    const result = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  async getDashboardOverview() {
    const [
      revenueToday,
      revenueThisMonth,
      newRegistrationsToday,
      activeUsers,
      conversionMetrics,
      applicationStats,
      targetAchievement
    ] = await Promise.all([
      this._getRevenueInPeriod(startOfDay(new Date()), endOfDay(new Date())),
      this._getRevenueInPeriod(startOfMonth(new Date()), new Date()),
      Applicant.countDocuments({
        createdAt: { $gte: startOfDay(new Date()) }
      }),
      this.getActiveUsers(),
      this.getConversionMetrics(),
      this.getApplicationStats(),
      this.getTargetAchievement()
    ]);

    return {
      revenue: {
        today: revenueToday,
        thisMonth: revenueThisMonth,
        allTime: await this._getTotalRevenue()
      },
      users: {
        newToday: newRegistrationsToday,
        active: activeUsers.totalActive || 0,
        total: conversionMetrics.totalRegistered || 0,
        employed: conversionMetrics.employedUsers || 0
      },
      applications: {
        total: applicationStats.totalApplications || 0,
        successRate: applicationStats.successRate || 0,
        averagePerUser: applicationStats.averageApplicationsPerUser || 0
      },
      conversion: {
        rate: conversionMetrics.conversionRate || 0,
        employmentRate: conversionMetrics.employmentRate || 0
      },
      targets: targetAchievement,
      timestamp: new Date()
    };
  }

  async exportData(type) {
    let data;
    let headers;

    switch (type) {
      case 'applicants':
        data = await Applicant.find({}).lean();
        headers = [
          'Applicant ID', 'Name', 'Email', 'Phone', 'Status',
          'Payment Status', 'Registered Date', 'Applications Count',
          'Employed', 'Company'
        ];
        break;

      case 'payments':
        data = await Payment.find({}).lean();
        headers = [
          'Transaction ID', 'Applicant ID', 'Amount', 'Status',
          'Payment Date', 'Method', 'Reference'
        ];
        break;

      case 'applications':
        data = await Application.find({}).lean();
        headers = [
          'Application ID', 'Applicant ID', 'Job Title', 'Company',
          'Platform', 'Applied Date', 'Status', 'Responses Count'
        ];
        break;

      default:
        throw new Error('Invalid export type');
    }

    // Convert to CSV
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const item of data) {
      const row = headers.map(header => {
        const value = this._getNestedValue(item, header);
        return `"${value}"`;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  _getNestedValue(obj, path) {
    const keys = path.toLowerCase().split(' ');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return '';
      }
    }

    return value || '';
  }
}

module.exports = AnalyticsService;
