import React, { useState } from 'react';
import {
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Alert,
  LinearProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Components
import Step1PersonalInfo from '../components/registration/Step1PersonalInfo';
import Step2Documents from '../components/registration/Step2Documents';
import Step3Preferences from '../components/registration/Step3Preferences';
import Step4Payment from '../components/registration/Step4Payment';
import Step5Confirmation from '../components/registration/Step5Confirmation';

// Services
import AuthService from '../services/auth.service';
import FileService from '../services/file.service';

const steps = [
  'Personal Information',
  'Upload Documents',
  'Job Preferences',
  'Payment',
  'Confirmation'
];

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  borderRadius: theme.spacing(2),
}));

const RegistrationPage = ({ onLogin }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
    
    // Documents
    cvFile: null,
    photoFile: null,
    qualificationFiles: [],
    
    // Preferences
    industries: [],
    jobTitles: [],
    locations: [],
    salaryRange: { min: '', max: '' },
    employmentTypes: [],
    remotePreference: 'any',
    
    // Payment
    paymentMethod: 'card',
    
    // Processing
    processing: false,
    error: null,
    success: false
  });

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleFormDataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = async (fileType, file) => {
    try {
      setFormData(prev => ({ ...prev, processing: true, error: null }));
      
      const uploadedFile = await FileService.uploadFile(file, fileType);
      
      setFormData(prev => ({
        ...prev,
        [fileType]: uploadedFile,
        processing: false
      }));
      
      return uploadedFile;
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        error: error.message,
        processing: false
      }));
      throw error;
    }
  };

  const handleSubmitRegistration = async () => {
    try {
      setFormData(prev => ({ ...prev, processing: true, error: null }));
      
      // Create applicant account
      const applicantData = {
        personalInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          whatsappNumber: formData.whatsappNumber,
          idNumber: formData.idNumber
        },
        password: formData.password,
        preferences: {
          industries: formData.industries,
          jobTitles: formData.jobTitles,
          locations: formData.locations,
          salaryRange: formData.salaryRange,
          employmentTypes: formData.employmentTypes,
          remotePreference: formData.remotePreference
        }
      };
      
      const response = await AuthService.register(applicantData);
      
      // Upload documents
      if (formData.cvFile) {
        await FileService.uploadApplicantDocument(
          response.applicantId,
          formData.cvFile,
          'cv'
        );
      }
      
      if (formData.photoFile) {
        await FileService.uploadApplicantDocument(
          response.applicantId,
          formData.photoFile,
          'photo'
        );
      }
      
      if (formData.qualificationFiles.length > 0) {
        for (const qualFile of formData.qualificationFiles) {
          await FileService.uploadApplicantDocument(
            response.applicantId,
            qualFile,
            'qualification'
          );
        }
      }
      
      // Initialize AI processing
      await AuthService.initiateAIProcessing(response.applicantId);
      
      // Login user
      const loginResponse = await AuthService.login(
        formData.email,
        formData.password
      );
      
      onLogin(loginResponse.user);
      
      setFormData(prev => ({
        ...prev,
        processing: false,
        success: true
      }));
      
      handleNext();
      
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        error: error.message,
        processing: false
      }));
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Step1PersonalInfo
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <Step2Documents
            formData={formData}
            onFileUpload={handleFileUpload}
            onBack={handleBack}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <Step3Preferences
            formData={formData}
            onChange={handleFormDataChange}
            onBack={handleBack}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <Step4Payment
            formData={formData}
            onChange={handleFormDataChange}
            onBack={handleBack}
            onSubmit={handleSubmitRegistration}
          />
        );
      case 4:
        return (
          <Step5Confirmation
            formData={formData}
            onComplete={() => window.location.href = '/dashboard'}
          />
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 6, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>
          Join JobAI South Africa
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Let AI power your job search. Get hired faster.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          One-time payment of R500 for 1 month of AI-powered job application service
        </Typography>
      </Box>

      <StyledPaper elevation={3}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {formData.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {formData.error}
          </Alert>
        )}

        {formData.processing && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Processing...
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          {getStepContent(activeStep)}
        </Box>
      </StyledPaper>

      {/* Trust indicators */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Trusted by South African job seekers
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 2 }}>
          <Box>
            <Typography variant="h4" color="primary">5,000+</Typography>
            <Typography variant="body2">Successful Applicants</Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="primary">85%</Typography>
            <Typography variant="body2">Interview Rate</Typography>
          </Box>
          <Box>
            <Typography variant="h4" color="primary">24/7</Typography>
            <Typography variant="body2">AI Job Search</Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default RegistrationPage;
