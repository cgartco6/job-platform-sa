import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Payment,
  ShoppingCart,
  AccountCircle,
  Notifications,
  Settings,
  Help,
  Logout,
  Home,
  Business,
  People,
  Analytics,
  Receipt,
  Security,
  Description
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const HamburgerMenu = ({ user, notifications, cartItems }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', badge: 0 },
    { text: 'Payment Methods', icon: <Payment />, path: '/payment', badge: 0 },
    { text: 'Shopping Cart', icon: <ShoppingCart />, path: '/cart', badge: cartItems },
    { text: 'My Profile', icon: <AccountCircle />, path: '/profile', badge: 0 },
    { text: 'Applications', icon: <Description />, path: '/applications', badge: 0 },
    { text: 'Revenue Analytics', icon: <Analytics />, path: '/analytics', badge: 0 },
    { text: 'Compliance', icon: <Security />, path: '/compliance', badge: 0 },
    { text: 'Tax Center', icon: <Receipt />, path: '/tax', badge: 0 },
    { text: 'Settings', icon: <Settings />, path: '/settings', badge: 0 },
    { text: 'Help & Support', icon: <Help />, path: '/help', badge: 0 },
  ];

  const adminMenuItems = [
    { text: 'Admin Dashboard', icon: <Business />, path: '/admin', badge: 0 },
    { text: 'User Management', icon: <People />, path: '/admin/users', badge: 0 },
    { text: 'Revenue Reports', icon: <Analytics />, path: '/admin/revenue', badge: 0 },
    { text: 'Payout Management', icon: <Payment />, path: '/admin/payouts', badge: 0 },
    { text: 'Compliance Center', icon: <Security />, path: '/admin/compliance', badge: 0 },
  ];

  const drawer = (
    <Box sx={{ width: 280 }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {user?.firstName?.charAt(0) || 'U'}
        </Avatar>
        <Box>
          <Typography variant="subtitle1">
            {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
      </Box>
      
      <Divider />
      
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                '&:hover': {
                  backgroundColor: 'primary.light',
                }
              }
            }}
          >
            <ListItemIcon>
              {item.badge > 0 ? (
                <Badge badgeContent={item.badge} color="error">
                  {item.icon}
                </Badge>
              ) : item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      
      {user?.role === 'admin' && (
        <>
          <Divider />
          <Typography variant="caption" sx={{ px: 3, py: 1, color: 'text.secondary' }}>
            ADMINISTRATION
          </Typography>
          <List>
            {adminMenuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </>
      )}
      
      <Divider />
      
      <List>
        <ListItem
          button
          onClick={() => {
            // Handle logout
            navigate('/logout');
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            JobAI South Africa
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton color="inherit" onClick={() => navigate('/cart')}>
              <Badge badgeContent={cartItems} color="error">
                <ShoppingCart />
              </Badge>
            </IconButton>
            
            <IconButton color="inherit" onClick={() => navigate('/notifications')}>
              <Badge badgeContent={notifications} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            
            <IconButton onClick={handleProfileMenuOpen} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                {user?.firstName?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
              <AccountCircle sx={{ mr: 1 }} /> Profile
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
              <Settings sx={{ mr: 1 }} /> Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { navigate('/logout'); handleProfileMenuClose(); }}>
              <Logout sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box component="nav">
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
              top: { xs: 0, md: 64 },
              height: { xs: '100%', md: 'calc(100% - 64px)' }
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
    </>
  );
};

export default HamburgerMenu;
