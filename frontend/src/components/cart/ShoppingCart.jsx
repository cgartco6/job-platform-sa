import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Card,
  CardContent,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Snackbar,
  Stepper,
  Step,
  StepLabel,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Remove,
  Delete,
  ShoppingCart as CartIcon,
  LocalOffer,
  Payment,
  CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ShoppingCart = () => {
  const [cart, setCart] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  const steps = ['Cart Review', 'Payment Method', 'Confirmation'];

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      // Mock cart data
      const mockCart = {
        id: 'CART12345',
        items: [
          {
            id: 'basic_ai_service',
            name: 'Basic AI Job Application',
            description: '30 days of AI job application service',
            price: 500,
            quantity: 1,
            total: 500,
            features: [
              'AI CV enhancement',
              'Job matching',
              'Auto-application (10/day)',
              'WhatsApp notifications'
            ]
          },
          {
            id: 'cv_rewrite',
            name: 'Professional CV Rewrite',
            description: 'One-time professional CV rewrite',
            price: 300,
            quantity: 1,
            total: 300,
            features: [
              'ATS optimization',
              'Industry-specific keywords'
            ]
          }
        ],
        totals: {
          subtotal: 800,
          discount: 0,
          vat: 120,
          total: 920
        },
        discount: null
      };

      setCart(mockCart);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cart:', error);
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId, delta) => {
    const updatedItems = cart.items.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          total: item.price * newQuantity
        };
      }
      return item;
    });

    updateCart(updatedItems);
  };

  const handleRemoveItem = (itemId) => {
    const updatedItems = cart.items.filter(item => item.id !== itemId);
    updateCart(updatedItems);
  };

  const updateCart = (updatedItems) => {
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const discount = cart.discount?.amount || 0;
    const taxable = Math.max(0, subtotal - discount);
    const vat = taxable * 0.15;
    const total = taxable + vat;

    setCart({
      ...cart,
      items: updatedItems,
      totals: { subtotal, discount, vat, total }
    });
  };

  const handleApplyDiscount = () => {
    if (!discountCode) {
      showSnackbar('Please enter a discount code', 'error');
      return;
    }

    // Mock discount application
    if (discountCode === 'WELCOME10') {
      const discountAmount = cart.totals.subtotal * 0.10;
      const taxable = cart.totals.subtotal - discountAmount;
      const vat = taxable * 0.15;
      const total = taxable + vat;

      setCart({
        ...cart,
        discount: {
          code: 'WELCOME10',
          amount: discountAmount,
          type: 'percentage',
          value: 10
        },
        totals: {
          ...cart.totals,
          discount: discountAmount,
          vat: vat,
          total: total
        }
      });

      showSnackbar('Discount applied successfully!', 'success');
      setDiscountCode('');
    } else {
      showSnackbar('Invalid discount code', 'error');
    }
  };

  const handleCheckout = () => {
    if (cart.items.length === 0) {
      showSnackbar('Your cart is empty', 'error');
      return;
    }

    setActiveStep(1);
  };

  const handlePaymentSelect = (method) => {
    // Process payment based on selected method
    console.log('Selected payment method:', method);
    setActiveStep(2);
    
    // Simulate payment processing
    setTimeout(() => {
      showSnackbar('Payment successful! Redirecting to dashboard...', 'success');
      setTimeout(() => navigate('/dashboard'), 2000);
    }, 2000);
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Cart Content */}
      {activeStep === 0 && (
        <>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CartIcon /> Shopping Cart
          </Typography>

          <Grid container spacing={3}>
            {/* Cart Items */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                {cart.items.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="h6" gutterBottom>
                      Your cart is empty
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => navigate('/services')}
                    >
                      Browse Services
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Items ({cart.items.length})
                    </Typography>
                    <List>
                      {cart.items.map((item) => (
                        <React.Fragment key={item.id}>
                          <ListItem>
                            <ListItemText
                              primary={
                                <Typography variant="subtitle1" fontWeight="medium">
                                  {item.name}
                                </Typography>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.description}
                                  </Typography>
                                  <Box sx={{ mt: 1 }}>
                                    {item.features?.map((feature, idx) => (
                                      <Chip
                                        key={idx}
                                        label={feature}
                                        size="small"
                                        sx={{ mr: 0.5, mb: 0.5 }}
                                      />
                                    ))}
                                  </Box>
                                </>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Box display="flex" alignItems="center">
                                <IconButton
                                  size="small"
                                  onClick={() => handleQuantityChange(item.id, -1)}
                                >
                                  <Remove />
                                </IconButton>
                                <Typography sx={{ mx: 2 }}>
                                  {item.quantity}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleQuantityChange(item.id, 1)}
                                >
                                  <Add />
                                </IconButton>
                                <Typography sx={{ mx: 2, minWidth: 80 }} align="right">
                                  R{item.total.toFixed(2)}
                                </Typography>
                                <IconButton
                                  color="error"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            </ListItemSecondaryAction>
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                  </>
                )}
              </Paper>

              {/* Discount Section */}
              <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalOffer /> Apply Discount
                </Typography>
                <Box display="flex" gap={2}>
                  <TextField
                    fullWidth
                    placeholder="Enter discount code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    size="small"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleApplyDiscount}
                    disabled={!discountCode}
                  >
                    Apply
                  </Button>
                </Box>
                {cart.discount && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Discount {cart.discount.code} applied! Saved R{cart.discount.amount.toFixed(2)}
                  </Alert>
                )}
              </Paper>
            </Grid>

            {/* Order Summary */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, position: 'sticky', top: 100 }}>
                <Typography variant="h6" gutterBottom>
                  Order Summary
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Subtotal</Typography>
                    <Typography>R{cart.totals.subtotal.toFixed(2)}</Typography>
                  </Box>
                  {cart.discount && (
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Discount ({cart.discount.code})</Typography>
                      <Typography color="success.main">
                        -R{cart.totals.discount.toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>VAT (15%)</Typography>
                    <Typography>R{cart.totals.vat.toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6">R{cart.totals.total.toFixed(2)}</Typography>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleCheckout}
                  disabled={cart.items.length === 0}
                >
                  Proceed to Checkout
                </Button>

                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                  Secure payment · 30-day service · Money-back guarantee
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {/* Payment Step */}
      {activeStep === 1 && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Select Payment Method
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Total Amount: <strong>R{cart.totals.total.toFixed(2)}</strong>
          </Typography>

          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Card
                variant="outlined"
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                onClick={() => handlePaymentSelect('payfast')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Payment sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    PayFast
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Credit/Debit Card, Instant EFT
                  </Typography>
                  <Chip label="Instant" color="success" size="small" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                variant="outlined"
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                onClick={() => handlePaymentSelect('fnb_eft')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Payment sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    FNB EFT
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bank Transfer (1-2 business days)
                  </Typography>
                  <Chip label="Secure" color="info" size="small" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                variant="outlined"
                sx={{
                  p: 3,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' }
                }}
                onClick={() => handlePaymentSelect('payshap')}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Payment sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    PayShap
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Real-time Bank Payment
                  </Typography>
                  <Chip label="Instant" color="success" size="small" sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
            >
              Back to Cart
            </Button>
          </Box>
        </Paper>
      )}

      {/* Confirmation Step */}
      {activeStep === 2 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 3 }} />
          <Typography variant="h4" gutterBottom>
            Payment Successful!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your order has been processed successfully.
          </Typography>
          <Typography variant="body1" gutterBottom>
            Order ID: <strong>ORD{Date.now().toString().slice(-8)}</strong>
          </Typography>
          <Typography variant="body1" gutterBottom>
            Amount: <strong>R{cart.totals.total.toFixed(2)}</strong>
          </Typography>
          <Typography variant="body1" gutterBottom>
            You will receive a confirmation email shortly.
          </Typography>

          <Box sx={{ mt: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Redirecting to dashboard...
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ShoppingCart;
