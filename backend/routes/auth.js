const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { requestLogger } = require('../middleware/logger');

// Apply request logging to all auth routes
router.use(requestLogger);

// Register new user
router.post('/register', validateUserRegistration, async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', validateUserLogin, async (req, res, next) => {
  try {
    const result = await authService.login(req.body, req.ip);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }
    
    const result = await authService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Logout user
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const { userId } = req.body;
    
    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Token and user ID are required'
      });
    }
    
    const result = await authService.logout(userId, token);
    
    res.json({
      success: true,
      message: 'Logout successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Forgot password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const result = await authService.forgotPassword(email);
    
    res.json({
      success: true,
      message: 'Password reset instructions sent',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }
    
    const result = await authService.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password reset successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Verify email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }
    
    const result = await authService.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile (protected route)
router.get('/profile', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    // Simple token verification for this route
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await authService.getUserProfile(decoded.userId);
    
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Change password (protected route)
router.post('/change-password', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }
    
    // Simple token verification for this route
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await authService.changePassword(decoded.userId, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Password changed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Check authentication status
router.get('/check', async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        userId: decoded.userId,
        valid: true
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

module.exports = router;