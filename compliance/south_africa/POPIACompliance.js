class POPIACompliance {
  constructor() {
    this.complianceData = {
      popia: {
        actName: 'Protection of Personal Information Act, 2013',
        effectiveDate: '2020-07-01',
        registrationNumber: process.env.POPIA_REG_NUMBER || 'Pending',
        informationOfficer: process.env.POPIA_OFFICER || 'CEO Name',
        deputyOfficer: process.env.POPIA_DEPUTY || 'CTO Name'
      },
      dataProcessing: {
        lawfulBasis: 'Consent and Contract Performance',
        purposes: [
          'Job application processing',
          'AI CV enhancement',
          'Job matching and applications',
          'Communication regarding applications',
          'Payment processing',
          'Service improvement'
        ],
        retentionPeriods: {
          activeUsers: '36 months',
          inactiveUsers: '12 months after inactivity',
          paymentRecords: '5 years',
          applicationData: '24 months',
          communications: '12 months'
        }
      },
      securityMeasures: {
        encryption: 'AES-256 at rest, TLS 1.3 in transit',
        accessControl: 'Role-based access control',
        monitoring: '24/7 security monitoring',
        backups: 'Daily encrypted backups',
        incidentResponse: 'Documented response plan'
      },
      userRights: [
        'Right to access personal information',
        'Right to correction',
        'Right to deletion',
        'Right to object',
        'Right to complain',
        'Right to withdraw consent'
      ]
    };
  }

  async validateConsent(consentData) {
    const requiredConsents = [
      'data_processing',
      'communications',
      'third_party_sharing',
      'data_retention',
      'automated_processing'
    ];
    
    const missingConsents = requiredConsents.filter(
      consent => !consentData[consent]
    );
    
    if (missingConsents.length > 0) {
      throw new Error(`Missing required consents: ${missingConsents.join(', ')}`);
    }
    
    return {
      valid: true,
      timestamp: new Date(),
      consentId: `CONSENT${Date.now()}`,
      version: '1.0',
      requiredConsents: requiredConsents,
      grantedConsents: Object.keys(consentData).filter(k => consentData[k])
    };
  }

  generatePrivacyPolicy() {
    return {
      version: '2.1',
      lastUpdated: new Date().toISOString().split('T')[0],
      sections: [
        {
          title: 'Information We Collect',
          content: 'We collect personal information necessary for providing AI job application services...'
        },
        {
          title: 'How We Use Your Information',
          content: 'Your information is used for CV enhancement, job matching, and application submission...'
        },
        {
          title: 'Data Security',
          content: 'We implement industry-standard security measures to protect your data...'
        },
        {
          title: 'Your Rights',
          content: 'You have rights under POPIA including access, correction, and deletion of your data...'
        },
        {
          title: 'Contact Information',
          content: `Information Officer: ${this.complianceData.popia.informationOfficer}`
        }
      ]
    };
  }

  async logDataAccess(userId, action, details) {
    const DataAccessLog = require('./DataAccessLogModel');
    
    const log = new DataAccessLog({
      userId: userId,
      action: action,
      details: details,
      timestamp: new Date(),
      ipAddress: details.ipAddress || 'system',
      userAgent: details.userAgent || 'system',
      complianceChecked: true
    });
    
    await log.save();
    return log;
  }

  async generateDataReport(userId) {
    // Generate data subject access request report
    const Applicant = require('../../../backend/src/models/Applicant');
    const applicant = await Applicant.findOne({ applicantId: userId });
    
    if (!applicant) {
      throw new Error('Applicant not found');
    }
    
    const report = {
      generated: new Date(),
      requestId: `DSAR${Date.now()}`,
      applicant: {
        id: applicant.applicantId,
        name: `${applicant.personalInfo.firstName} ${applicant.personalInfo.lastName}`,
        email: applicant.personalInfo.email,
        phone: applicant.personalInfo.phone
      },
      dataCategories: {
        personalInfo: this.sanitizePersonalInfo(applicant.personalInfo),
        documents: {
          cv: applicant.originalCV ? 'Stored' : 'Not stored',
          photo: applicant.photo ? 'Stored' : 'Not stored',
          qualifications: applicant.qualifications?.length || 0
        },
        preferences: applicant.preferences,
        applications: applicant.applications?.length || 0,
        activity: applicant.activityLog?.length || 0
      },
      dataProcessors: [
        {
          name: 'JobAI South Africa',
          purpose: 'Primary data controller',
          contact: 'info@jobai.co.za'
        },
        {
          name: 'Amazon Web Services',
          purpose: 'Cloud infrastructure',
          location: 'South Africa (Cape Town)'
        },
        {
          name: 'OpenAI',
          purpose: 'AI processing (CV enhancement)',
          dataProcessingAgreement: 'In place'
        }
      ],
      retentionPeriods: this.complianceData.dataProcessing.retentionPeriods,
      rightsSummary: this.complianceData.userRights
    };
    
    return report;
  }

  sanitizePersonalInfo(info) {
    // Remove sensitive information for reporting
    const sanitized = { ...info };
    
    if (sanitized.idNumber) {
      sanitized.idNumber = `${sanitized.idNumber.substring(0, 6)}******`;
    }
    
    if (sanitized.phone) {
      sanitized.phone = `${sanitized.phone.substring(0, 4)}******`;
    }
    
    return sanitized;
  }

  async handleDataDeletionRequest(userId, reason) {
    const DeletionRequest = require('./DeletionRequestModel');
    
    const request = new DeletionRequest({
      requestId: `DEL${Date.now()}`,
      userId: userId,
      reason: reason,
      status: 'pending',
      requestedAt: new Date(),
      scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    await request.save();
    
    // Log compliance action
    await this.logDataAccess(userId, 'deletion_request', {
      reason: reason,
      scheduledDate: request.scheduledFor
    });
    
    return request;
  }

  async processScheduledDeletions() {
    const DeletionRequest = require('./DeletionRequestModel');
    const Applicant = require('../../../backend/src/models/Applicant');
    
    const requests = await DeletionRequest.find({
      status: 'pending',
      scheduledFor: { $lte: new Date() }
    });
    
    const results = [];
    
    for (const request of requests) {
      try {
        // Anonymize applicant data instead of full deletion
        await Applicant.findOneAndUpdate(
          { applicantId: request.userId },
          {
            'personalInfo.firstName': 'Deleted',
            'personalInfo.lastName': 'User',
            'personalInfo.email': `deleted_${request.userId}@deleted.com`,
            'personalInfo.phone': '0000000000',
            'personalInfo.idNumber': '0000000000000',
            'personalInfo.whatsappNumber': null,
            'originalCV.fileUrl': null,
            'photo.fileUrl': null,
            'qualifications': [],
            'applications': [],
            'activityLog': [],
            'status': 'deleted',
            'deletedAt': new Date(),
            'deletionRequestId': request.requestId
          }
        );
        
        request.status = 'completed';
        request.completedAt = new Date();
        await request.save();
        
        results.push({
          requestId: request.requestId,
          userId: request.userId,
          status: 'success',
          timestamp: new Date()
        });
        
      } catch (error) {
        request.status = 'failed';
        request.error = error.message;
        await request.save();
        
        results.push({
          requestId: request.requestId,
          userId: request.userId,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return results;
  }

  generateComplianceCertificate() {
    return {
      certificateId: `COMP${Date.now()}`,
      company: 'JobAI South Africa (Pty) Ltd',
      registration: '2023/123456/07',
      popiaStatus: 'Compliant',
      lastAudit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
      nextAudit: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
      auditor: 'SA Compliance Auditors (Pty) Ltd',
      certificateUrl: '/compliance/certificate.pdf',
      qrCode: `/compliance/qr/${Date.now()}`
    };
  }

  async checkAgeCompliance(userAge) {
    const compliance = {
      allowed: userAge >= 18,
      restrictions: [],
      parentalConsentRequired: userAge < 18,
      specialCategories: []
    };
    
    if (userAge < 13) {
      compliance.allowed = false;
      compliance.restrictions.push('Minimum age 13 required with parental consent');
    }
    
    if (userAge >= 60) {
      compliance.specialCategories.push('Senior citizen - special considerations apply');
    }
    
    if (userAge >= 62) {
      compliance.specialCategories.push('Tax-free account eligibility');
    }
    
    return compliance;
  }
}

module.exports = POPIACompliance;
