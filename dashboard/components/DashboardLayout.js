import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Button,
  Chip,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Download,
  Email,
  Phone,
  LocationOn,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import HamburgerMenu from './HamburgerMenu';
import DataVisualization from './DataVisualization';
import ProvinceTracker from '../analytics/ProvinceTracker';

const DashboardLayout = ({ user }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [notifications, setNotifications] = useState(5);
  const [cartItems, setCartItems] = useState(3);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Mock data - in production, fetch from API
      const mockData = {
        kpis: {
          totalRevenue: 1250000,
          revenueGrowth: 15.5,
          activeUsers: 5423,
          newUsersToday: 234,
          applicationsSubmitted: 12890,
          successRate: 42.5,
          arpu: 850.75,
          arpuTarget: 900
        },
        charts: {
          revenueTrend: [
            { month: 'Jan', revenue: 850000, target: 800000 },
            { month: 'Feb', revenue: 920000, target: 850000 },
            { month: 'Mar', revenue: 1050000, target: 900000 },
            { month: 'Apr', revenue: 980000, target: 950000 },
            { month: 'May', revenue: 1120000, target: 1000000 },
            { month: 'Jun', revenue: 1250000, target: 1100000 }
          ],
          provinceDistribution: [
            { province: 'Gauteng', value: 2450 },
            { province: 'Western Cape', value: 1560 },
            { province: 'KwaZulu-Natal', value: 890 },
            { province: 'Eastern Cape', value: 420 },
            { province: 'Limpopo', value: 380 },
            { province: 'Mpumalanga', value: 310 },
            { province: 'North West', value: 280 },
            { province: 'Free State', value: 240 },
            { province: 'Northern Cape', value: 120 }
          ],
          paymentMethods: [
            { name: 'PayFast', value: 850000 },
            { name: 'FNB EFT', value: 250000 },
            { name: 'PayShap', value: 150000 }
          ],
          topCities: [
            { name: 'Johannesburg', province: 'Gauteng', users: 1850, revenue: 650000, growth: 12.5 },
            { name: 'Cape Town', province: 'Western Cape', users: 1420, revenue: 520000, growth: 18.2 },
            { name: 'Durban', province: 'KwaZulu-Natal', users: 890, revenue: 310000, growth: 8.7 },
            { name: 'Pretoria', province: 'Gauteng', users: 760, revenue: 280000, growth: 10.3 },
            { name: 'Port Elizabeth', province: 'Eastern Cape', users: 420, revenue: 150000, growth: 5.4 },
            { name: 'Bloemfontein', province: 'Free State', users: 240, revenue: 85000, growth: 7.2 }
          ],
          ageDistribution: [
            { range: '18-24', count: 1250 },
            { range: '25-34', count: 2350 },
            { range: '35-44', count: 980 },
            { range: '45-54', count: 520 },
            { range: '55+', count: 320 }
          ],
          employmentStatus: [
            { name: 'Employed', value: 45 },
            { name: 'Unemployed', value: 35 },
            { name: 'Student', value: 12 },
            { name: 'Self-employed', value: 8 }
          ]
        }
      };

      setDashboardData(mockData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleFilterChange = (filter, value) => {
    // Handle filter changes
    console.log(`Filter changed: ${filter} = ${value}`);
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <HamburgerMenu 
        user={user} 
        notifications={notifications}
        cartItems={cartItems}
      />
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - 280px)` },
          ml: { md: '280px' },
          mt: 8
        }}
      >
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h4">
                Dashboard Overview
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  sx={{ mr: 2 }}
                >
                  Export Report
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                >
                  Refresh Data
                </Button>
              </Box>
            </Box>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Tax Reminder:</strong> VAT payment due by 25th of next month. 
                {user.age >= 62 && ' Your account is eligible for tax-free status.'}
              </Typography>
            </Alert>
          </Box>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Overview" />
              <Tab label="Revenue Analytics" />
              <Tab label="User Analytics" />
              <Tab label="Province Tracking" />
              <Tab label="Payment Reports" />
              <Tab label="Tax Center" />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 0 && (
            <Box>
              <DataVisualization 
                data={dashboardData}
                filters={{}}
                onFilterChange={handleFilterChange}
              />
              
              {/* Quick Actions */}
              <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Button variant="contained" color="primary">
                    Process Weekly Payout
                  </Button>
                  <Button variant="outlined">
                    Send Tax Reminders
                  </Button>
                  <Button variant="outlined">
                    Generate Compliance Report
                  </Button>
                  <Button variant="outlined">
                    Update Bank Details
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h5" gutterBottom>
                Revenue Analytics
              </Typography>
              {/* Revenue-specific components would go here */}
            </Box>
          )}

          {activeTab === 3 && (
            <ProvinceTracker />
          )}

          {/* Contact Information Section */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contact Information by Province
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              {dashboardData.charts.topCities.map((city) => (
                <Paper
                  key={city.name}
                  variant="outlined"
                  sx={{ p: 2, minWidth: 250 }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    <LocationOn sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {city.name}, {city.province}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <Phone sx={{ fontSize: 14, mr: 1 }} />
                    +27 11 123 4567
                  </Typography>
                  <Typography variant="body2">
                    <Email sx={{ fontSize: 14, mr: 1 }} />
                    {city.name.toLowerCase().replace(' ', '')}@jobai.co.za
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip 
                      label={`${city.users} users`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip 
                      label={`R${city.revenue.toLocaleString()}`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
};

export default DashboardLayout;
