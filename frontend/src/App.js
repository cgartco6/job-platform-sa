import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';
import DashboardPage from './pages/DashboardPage';
import PaymentPage from './pages/PaymentPage';
import ProfilePage from './pages/ProfilePage';
import JobsPage from './pages/JobsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import CVEnhancementPage from './pages/CVEnhancementPage';
import AdminPage from './pages/AdminPage';

// Services
import AuthService from './services/auth.service';
import { AppProvider } from './context/AppContext';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2E5BFF',
      light: '#E0E7FF',
      dark: '#1A3D8F',
    },
    secondary: {
      main: '#00C9A7',
      light: '#E6F8F5',
      dark: '#008F7A',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2D3748',
      secondary: '#718096',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E2E8F0',
        },
      },
    },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <AppProvider>
        <CssBaseline />
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar user={user} onLogout={handleLogout} />
            <Container maxWidth="xl" sx={{ flexGrow: 1, py: 4 }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/register" element={<RegistrationPage onLogin={handleLogin} />} />
                <Route 
                  path="/dashboard" 
                  element={
                    user ? <DashboardPage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/payment" 
                  element={
                    user ? <PaymentPage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    user ? <ProfilePage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/jobs" 
                  element={
                    user ? <JobsPage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/applications" 
                  element={
                    user ? <ApplicationsPage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/cv-enhancement" 
                  element={
                    user ? <CVEnhancementPage user={user} /> : <Navigate to="/register" />
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    user && user.role === 'admin' ? <AdminPage /> : <Navigate to="/" />
                  } 
                />
              </Routes>
            </Container>
            <Footer />
          </Box>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
