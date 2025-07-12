const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { securityLogger } = require('../middleware/logger');
const { 
  UnauthorizedError, 
  ConflictError, 
  NotFoundError, 
  ValidationError 
} = require('../middleware/errorHandler');

class EpoAuthService {
  constructor() {
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  // User registration
  async register(userData) {
    const { username, email, password, hwid } = userData;
    
    try {
      // Check if user already exists
      const existingUser = await db('users')
        .where('username', username)
        .orWhere('email', email)
        .first();
      
      if (existingUser) {
        throw new ConflictError(
          existingUser.username === username 
            ? 'Username already exists' 
            : 'Email already exists'
        );
      }

      // Check HWID ban
      const hwidBan = await db('hwid_bans')
        .where('hwid', hwid)
        .where('expires_at', '>', new Date())
        .first();
      
      if (hwidBan) {
        throw new UnauthorizedError('Hardware ID is banned');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
      
      // Create user
      const userId = uuidv4();
      const user = await db('users').insert({
        id: userId,
        username,
        email,
        password: hashedPassword,
        hwid,
        epo_level: 1,
        vbucks: 0,
        is_premium: false,
        role: 'user',
        is_active: true,
        is_banned: false,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      // Create player profile
      await db('player_profiles').insert({
        id: uuidv4(),
        user_id: userId,
        display_name: username,
        avatar_url: null,
        level: 1,
        experience: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        matches_played: 0,
        settings: JSON.stringify({
          graphics: 'medium',
          sound: 100,
          controls: 'default'
        }),
        created_at: new Date(),
        updated_at: new Date()
      });

      // Generate tokens
      const tokens = await this.generateTokens(userId);
      
      // Log registration
      securityLogger.loginAttempt(username, 'registration', true);
      
      return {
        user: {
          id: userId,
          username,
          email,
          epo_level: 1,
          vbucks: 0,
          is_premium: false,
          role: 'user'
        },
        tokens
      };
    } catch (error) {
      securityLogger.loginAttempt(username, 'registration', false, error.message);
      throw error;
    }
  }

  // User login
  async login(credentials, ip) {
    const { username, password, hwid } = credentials;
    
    try {
      // Find user
      const user = await db('users')
        .where('username', username)
        .first();
      
      if (!user) {
        throw new UnauthorizedError('Invalid username or password');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid username or password');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new UnauthorizedError('Account is deactivated');
      }

      // Check if user is banned
      if (user.is_banned) {
        throw new UnauthorizedError('Account is banned');
      }

      // Check HWID ban
      const hwidBan = await db('hwid_bans')
        .where('hwid', hwid)
        .where('expires_at', '>', new Date())
        .first();
      
      if (hwidBan) {
        throw new UnauthorizedError('Hardware ID is banned');
      }

      // Check HWID mismatch (if HWID tracking is enabled)
      if (process.env.HWID_TRACKING_ENABLED === 'true' && user.hwid !== hwid) {
        securityLogger.suspiciousActivity(
          user.id, 
          'hwid_mismatch', 
          { stored_hwid: user.hwid, provided_hwid: hwid }
        );
        
        // Update HWID or reject based on security policy
        await db('users')
          .where('id', user.id)
          .update({ hwid, updated_at: new Date() });
      }

      // Update last login
      await db('users')
        .where('id', user.id)
        .update({ 
          last_login: new Date(),
          last_activity: new Date(),
          login_count: user.login_count + 1
        });

      // Generate tokens
      const tokens = await this.generateTokens(user.id);
      
      // Log successful login
      securityLogger.loginAttempt(username, ip, true);
      
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          epo_level: user.epo_level,
          vbucks: user.vbucks,
          is_premium: user.is_premium,
          role: user.role
        },
        tokens
      };
    } catch (error) {
      securityLogger.loginAttempt(username, ip, false, error.message);
      throw error;
    }
  }

  // Generate JWT tokens
  async generateTokens(userId) {
    const payload = { userId };
    
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
    
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.jwtRefreshExpiresIn
    });

    // Store refresh token in Redis
    await redisHelper.setex(
      `refresh_token:${userId}`, 
      30 * 24 * 60 * 60, // 30 days
      refreshToken
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn
    };
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
      const userId = decoded.userId;
      
      // Check if refresh token exists in Redis
      const storedToken = await redisHelper.get(`refresh_token:${userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Check if user still exists and is active
      const user = await db('users')
        .where('id', userId)
        .where('is_active', true)
        .first();
      
      if (!user) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(userId);
      
      return tokens;
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  // Logout user
  async logout(userId, accessToken) {
    try {
      // Add access token to blacklist
      await redisHelper.setex(
        `blacklist:${accessToken}`, 
        7 * 24 * 60 * 60, // 7 days
        'blacklisted'
      );

      // Remove refresh token
      await redisHelper.del(`refresh_token:${userId}`);

      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new Error('Logout failed');
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first();
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
      
      // Update password
      await db('users')
        .where('id', userId)
        .update({ 
          password: hashedNewPassword,
          updated_at: new Date()
        });

      // Invalidate all existing tokens
      await this.invalidateAllTokens(userId);

      return { message: 'Password changed successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Forgot password
  async forgotPassword(email) {
    try {
      const user = await db('users')
        .where('email', email)
        .first();
      
      if (!user) {
        // Return success even if user doesn't exist (security)
        return { message: 'Password reset instructions sent to email' };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await db('password_resets').insert({
        id: uuidv4(),
        user_id: user.id,
        token: resetToken,
        expires_at: resetTokenExpiry,
        created_at: new Date()
      });

      // TODO: Send email with reset link
      // await emailService.sendPasswordReset(user.email, resetToken);

      return { message: 'Password reset instructions sent to email' };
    } catch (error) {
      throw error;
    }
  }

  // Reset password
  async resetPassword(token, newPassword) {
    try {
      const resetRecord = await db('password_resets')
        .where('token', token)
        .where('expires_at', '>', new Date())
        .first();
      
      if (!resetRecord) {
        throw new UnauthorizedError('Invalid or expired reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
      
      // Update password
      await db('users')
        .where('id', resetRecord.user_id)
        .update({ 
          password: hashedPassword,
          updated_at: new Date()
        });

      // Delete reset token
      await db('password_resets')
        .where('id', resetRecord.id)
        .del();

      // Invalidate all existing tokens
      await this.invalidateAllTokens(resetRecord.user_id);

      return { message: 'Password reset successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Invalidate all tokens for a user
  async invalidateAllTokens(userId) {
    try {
      // Remove refresh token
      await redisHelper.del(`refresh_token:${userId}`);
      
      // Add user to token invalidation list
      await redisHelper.setex(
        `invalidate_tokens:${userId}`, 
        7 * 24 * 60 * 60, // 7 days
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Error invalidating tokens:', error);
    }
  }

  // Verify email
  async verifyEmail(token) {
    try {
      const user = await db('users')
        .where('email_verification_token', token)
        .first();
      
      if (!user) {
        throw new UnauthorizedError('Invalid verification token');
      }

      await db('users')
        .where('id', user.id)
        .update({ 
          email_verified: true,
          email_verification_token: null,
          updated_at: new Date()
        });

      return { message: 'Email verified successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const user = await db('users')
        .select('id', 'username', 'email', 'epo_level', 'vbucks', 'is_premium', 'role', 'created_at', 'last_login')
        .where('id', userId)
        .first();
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const profile = await db('player_profiles')
        .where('user_id', userId)
        .first();

      return {
        ...user,
        profile: profile || null
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EpoAuthService();