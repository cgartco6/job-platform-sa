import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Search,
  FilterList,
  Download,
  Phone,
  Email,
  LocationOn,
  Person
} from '@mui/icons-material';

const ProvinceTracker = () => {
  const [provinces, setProvinces] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProvinceData();
  }, []);

  const fetchProvinceData = async () => {
    // Mock data - in production, fetch from API
    const mockData = [
      {
        id: 1,
        name: 'Gauteng',
        users: 2450,
        revenue: 850000,
        growth: 15.5,
        topCities: ['Johannesburg', 'Pretoria', 'Sandton'],
        contacts: [
          { name: 'John Smith', phone: '+27 11 123 4567', email: 'johannesburg@jobai.co.za', role: 'Regional Manager' },
          { name: 'Sarah Johnson', phone: '+27 12 345 6789', email: 'pretoria@jobai.co.za', role: 'Operations Lead' }
        ]
      },
      {
        id: 2,
        name: 'Western Cape',
        users: 1560,
        revenue: 520000,
        growth: 18.2,
        topCities: ['Cape Town', 'Stellenbosch', 'Paarl'],
        contacts: [
          { name: 'Michael Brown', phone: '+27 21 987 6543', email: 'capetown@jobai.co.za', role: 'Regional Manager' }
        ]
      },
      {
        id: 3,
        name: 'KwaZulu-Natal',
        users: 890,
        revenue: 310000,
        growth: 8.7,
        topCities: ['Durban', 'Pietermaritzburg', 'Ballito'],
        contacts: [
          { name: 'Lisa Williams', phone: '+27 31 456 7890', email: 'durban@jobai.co.za', role: 'Regional Manager' }
        ]
      },
      {
        id: 4,
        name: 'Eastern Cape',
        users: 420,
        revenue: 150000,
        growth: 5.4,
        topCities: ['Port Elizabeth', 'East London', 'Grahamstown'],
        contacts: [
          { name: 'David Wilson', phone: '+27 41 234 5678', email: 'pe@jobai.co.za', role: 'Operations Lead' }
        ]
      },
      {
        id: 5,
        name: 'Limpopo',
        users: 380,
        revenue: 120000,
        growth: 12.3,
        topCities: ['Polokwane', 'Thohoyandou', 'Modimolle'],
        contacts: [
          { name: 'Patricia Mokoena', phone: '+27 15 876 5432', email: 'limpopo@jobai.co.za', role: 'Regional Manager' }
        ]
      },
      {
        id: 6,
        name: 'Mpumalanga',
        users: 310,
        revenue: 98000,
        growth: 9.8,
        topCities: ['Nelspruit', 'Witbank', 'Secunda'],
        contacts: [
          { name: 'Thomas van der Merwe', phone: '+27 13 654 3210', email: 'mpumalanga@jobai.co.za', role: 'Operations Lead' }
        ]
      },
      {
        id: 7,
        name: 'North West',
        users: 280,
        revenue: 85000,
        growth: 7.2,
        topCities: ['Rustenburg', 'Mahikeng', 'Potchefstroom'],
        contacts: [
          { name: 'Grace Moloi', phone: '+27 18 765 4321', email: 'northwest@jobai.co.za', role: 'Regional Manager' }
        ]
      },
      {
        id: 8,
        name: 'Free State',
        users: 240,
        revenue: 75000,
        growth: 6.5,
        topCities: ['Bloemfontein', 'Welkom', 'Bethlehem'],
        contacts: [
          { name: 'Robert de Beer', phone: '+27 51 321 0987', email: 'freestate@jobai.co.za', role: 'Operations Lead' }
        ]
      },
      {
        id: 9,
        name: 'Northern Cape',
        users: 120,
        revenue: 45000,
        growth: 4.2,
        topCities: ['Kimberley', 'Upington', 'Springbok'],
        contacts: [
          { name: 'Susan Petersen', phone: '+27 53 987 0123', email: 'northerncape@jobai.co.za', role: 'Regional Manager' }
        ]
      }
    ];

    setProvinces(mockData);
    setLoading(false);
  };

  const filteredProvinces = provinces.filter(province =>
    province.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    province.topCities.some(city => city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getGrowthColor = (growth) => {
    if (growth >= 15) return 'success.main';
    if (growth >= 10) return 'info.main';
    if (growth >= 5) return 'warning.main';
    return 'error.main';
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Province Analytics & Contact Management
        </Typography>
        <Box>
          <TextField
            size="small"
            placeholder="Search provinces or cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mr: 2, width: 300 }}
          />
          <IconButton>
            <FilterList />
          </IconButton>
          <IconButton>
            <Download />
          </IconButton>
        </Box>
      </Box>

      {/* Province Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {filteredProvinces.map((province) => (
          <Grid item xs={12} md={6} lg={4} key={province.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6">
                    {province.name}
                  </Typography>
                  <Chip
                    label={`${province.growth}%`}
                    size="small"
                    sx={{
                      backgroundColor: getGrowthColor(province.growth),
                      color: 'white'
                    }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Users
                    </Typography>
                    <Typography variant="h6">
                      {province.users.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Revenue
                    </Typography>
                    <Typography variant="h6">
                      R{province.revenue.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Top Cities:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {province.topCities.map((city, index) => (
                    <Chip
                      key={index}
                      label={city}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Contacts:
                </Typography>
                {province.contacts.map((contact, index) => (
                  <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Person sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="subtitle2">
                        {contact.name}
                      </Typography>
                      <Chip
                        label={contact.role}
                        size="small"
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                    <Box display="flex" alignItems="center" mb={0.5}>
                      <Phone sx={{ mr: 1, fontSize: 14 }} />
                      <Typography variant="body2">
                        {contact.phone}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <Email sx={{ mr: 1, fontSize: 14 }} />
                      <Typography variant="body2">
                        {contact.email}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Detailed Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Province Performance Details
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Province</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Growth</TableCell>
                  <TableCell>Top City</TableCell>
                  <TableCell>Contact Person</TableCell>
                  <TableCell>Contact Number</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProvinces.map((province) => (
                  <TableRow key={province.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
                        {province.name}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {province.users.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        R{province.revenue.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${province.growth}%`}
                        size="small"
                        sx={{
                          backgroundColor: getGrowthColor(province.growth),
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>{province.topCities[0]}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Person sx={{ mr: 1, fontSize: 16 }} />
                        {province.contacts[0].name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Phone sx={{ mr: 1, fontSize: 14 }} />
                        {province.contacts[0].phone}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Email sx={{ mr: 1, fontSize: 14 }} />
                        {province.contacts[0].email}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProvinceTracker;
