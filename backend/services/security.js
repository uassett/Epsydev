const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { securityLogger } = require('../middleware/logger');
const { 
  NotFoundError, 
  ValidationError,
  UnauthorizedError,
  ForbiddenError 
} = require('../middleware/errorHandler');

class EpoSecurityService {
  constructor() {
    this.antiCheatEnabled = process.env.ANTICHEAT_ENABLED === 'true';
    this.hwidTrackingEnabled = process.env.HWID_TRACKING_ENABLED === 'true';
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
    
    this.suspiciousActivities = [
      'multiple_accounts_same_hwid',
      'rapid_fire_requests',
      'impossible_stats',
      'hwid_mismatch',
      'vpn_usage',
      'suspicious_gameplay'
    ];
    
    this.banTypes = {
      'temporary': { max_duration: 365 }, // days
      'permanent': { max_duration: null },
      'hwid': { affects_hardware: true }
    };
  }

  // Report suspicious activity
  async reportSuspiciousActivity(userId, activity, details = {}) {
    try {
      const reportId = uuidv4();
      
      await db('security_reports').insert({
        id: reportId,
        user_id: userId,
        activity_type: activity,
        details: JSON.stringify(details),
        severity: this.calculateSeverity(activity),
        status: 'pending',
        created_at: new Date()
      });

      // Log the activity
      securityLogger.suspiciousActivity(userId, activity, details);

      // Auto-action based on severity
      if (this.shouldAutoAction(activity)) {
        await this.autoActionUser(userId, activity, details);
      }

      return { report_id: reportId, message: 'Suspicious activity reported' };
    } catch (error) {
      throw error;
    }
  }

  // Calculate severity score
  calculateSeverity(activity) {
    const severityMap = {
      'multiple_accounts_same_hwid': 7,
      'rapid_fire_requests': 5,
      'impossible_stats': 9,
      'hwid_mismatch': 6,
      'vpn_usage': 4,
      'suspicious_gameplay': 8
    };

    return severityMap[activity] || 5;
  }

  // Check if activity should trigger auto-action
  shouldAutoAction(activity) {
    const autoActionActivities = [
      'impossible_stats',
      'suspicious_gameplay'
    ];

    return autoActionActivities.includes(activity);
  }

  // Auto-action user based on suspicious activity
  async autoActionUser(userId, activity, details) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) return;

      // Get user's previous violations
      const previousViolations = await db('security_reports')
        .where('user_id', userId)
        .where('severity', '>=', 7)
        .count('* as count')
        .first();

      const violationCount = parseInt(previousViolations.count);

      // Determine action based on violation count
      let action = 'warning';
      let duration = 0;

      if (violationCount >= 3) {
        action = 'permanent_ban';
      } else if (violationCount >= 2) {
        action = 'temporary_ban';
        duration = 7; // 7 days
      } else if (violationCount >= 1) {
        action = 'temporary_ban';
        duration = 1; // 1 day
      }

      if (action !== 'warning') {
        await this.banUser(userId, 'system', `Auto-ban for ${activity}`, duration, false);
      }

      // Record the action
      await db('security_actions').insert({
        id: uuidv4(),
        user_id: userId,
        action_type: action,
        reason: `Auto-action for ${activity}`,
        duration: duration,
        administered_by: 'system',
        created_at: new Date()
      });

    } catch (error) {
      console.error('Error in auto-action:', error);
    }
  }

  // Ban user
  async banUser(userId, adminId, reason, duration = null, isHwidBan = false) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Calculate ban expiration
      const banExpires = duration ? 
        new Date(Date.now() + (duration * 24 * 60 * 60 * 1000)) : 
        null;

      // Update user ban status
      await db('users')
        .where('id', userId)
        .update({
          is_banned: true,
          ban_reason: reason,
          ban_expires: banExpires,
          banned_by: adminId,
          banned_at: new Date()
        });

      // Create ban record
      const banId = uuidv4();
      await db('bans').insert({
        id: banId,
        user_id: userId,
        admin_id: adminId,
        reason,
        ban_type: duration ? 'temporary' : 'permanent',
        duration: duration,
        expires_at: banExpires,
        is_active: true,
        created_at: new Date()
      });

      // HWID ban if requested
      if (isHwidBan && user.hwid) {
        await this.banHwid(user.hwid, adminId, reason, duration);
      }

      // Log the ban
      securityLogger.banAction(adminId, userId, reason, duration);

      return {
        ban_id: banId,
        message: `User banned ${duration ? `for ${duration} days` : 'permanently'}`
      };
    } catch (error) {
      throw error;
    }
  }

  // Ban HWID
  async banHwid(hwid, adminId, reason, duration = null) {
    try {
      const banExpires = duration ? 
        new Date(Date.now() + (duration * 24 * 60 * 60 * 1000)) : 
        null;

      await db('hwid_bans').insert({
        id: uuidv4(),
        hwid,
        admin_id: adminId,
        reason,
        expires_at: banExpires,
        is_active: true,
        created_at: new Date()
      });

      return { message: 'HWID banned successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Unban user
  async unbanUser(userId, adminId, reason) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (!user.is_banned) {
        throw new ValidationError('User is not banned');
      }

      // Update user
      await db('users')
        .where('id', userId)
        .update({
          is_banned: false,
          ban_reason: null,
          ban_expires: null,
          banned_by: null,
          banned_at: null
        });

      // Deactivate ban records
      await db('bans')
        .where('user_id', userId)
        .where('is_active', true)
        .update({
          is_active: false,
          revoked_by: adminId,
          revoked_at: new Date(),
          revoke_reason: reason
        });

      return { message: 'User unbanned successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Check if user is banned
  async checkUserBan(userId) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first();

      if (!user) {
        return { is_banned: false };
      }

      // Check if temporary ban has expired
      if (user.is_banned && user.ban_expires && user.ban_expires < new Date()) {
        await this.unbanUser(userId, 'system', 'Temporary ban expired');
        return { is_banned: false };
      }

      return {
        is_banned: user.is_banned,
        ban_reason: user.ban_reason,
        ban_expires: user.ban_expires,
        banned_at: user.banned_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Check if HWID is banned
  async checkHwidBan(hwid) {
    try {
      const ban = await db('hwid_bans')
        .where('hwid', hwid)
        .where('is_active', true)
        .first();

      if (!ban) {
        return { is_banned: false };
      }

      // Check if temporary ban has expired
      if (ban.expires_at && ban.expires_at < new Date()) {
        await db('hwid_bans')
          .where('id', ban.id)
          .update({
            is_active: false,
            revoked_at: new Date(),
            revoke_reason: 'Temporary ban expired'
          });

        return { is_banned: false };
      }

      return {
        is_banned: true,
        reason: ban.reason,
        expires_at: ban.expires_at,
        created_at: ban.created_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Track login attempt
  async trackLoginAttempt(username, ip, success, reason = null) {
    try {
      const attemptId = uuidv4();
      
      await db('login_attempts').insert({
        id: attemptId,
        username,
        ip_address: ip,
        success,
        failure_reason: reason,
        user_agent: '', // Would get from request
        created_at: new Date()
      });

      // Check for brute force attempts
      if (!success) {
        await this.checkBruteForce(username, ip);
      }

      return { attempt_id: attemptId };
    } catch (error) {
      throw error;
    }
  }

  // Check for brute force attempts
  async checkBruteForce(username, ip) {
    try {
      const timeWindow = new Date(Date.now() - this.lockoutDuration);
      
      // Check failed attempts for this username
      const usernameAttempts = await db('login_attempts')
        .where('username', username)
        .where('success', false)
        .where('created_at', '>=', timeWindow)
        .count('* as count')
        .first();

      // Check failed attempts for this IP
      const ipAttempts = await db('login_attempts')
        .where('ip_address', ip)
        .where('success', false)
        .where('created_at', '>=', timeWindow)
        .count('* as count')
        .first();

      if (usernameAttempts.count >= this.maxLoginAttempts) {
        await this.lockAccount(username, 'too_many_failed_attempts');
      }

      if (ipAttempts.count >= this.maxLoginAttempts * 2) {
        await this.blockIp(ip, 'brute_force_attempt');
      }
    } catch (error) {
      console.error('Error checking brute force:', error);
    }
  }

  // Lock account temporarily
  async lockAccount(username, reason) {
    try {
      const lockExpires = new Date(Date.now() + this.lockoutDuration);
      
      await redisHelper.setex(
        `locked_account:${username}`,
        this.lockoutDuration / 1000,
        { reason, expires: lockExpires.toISOString() }
      );

      return { message: 'Account temporarily locked' };
    } catch (error) {
      throw error;
    }
  }

  // Block IP temporarily
  async blockIp(ip, reason) {
    try {
      const blockExpires = new Date(Date.now() + this.lockoutDuration);
      
      await redisHelper.setex(
        `blocked_ip:${ip}`,
        this.lockoutDuration / 1000,
        { reason, expires: blockExpires.toISOString() }
      );

      return { message: 'IP temporarily blocked' };
    } catch (error) {
      throw error;
    }
  }

  // Check if account is locked
  async checkAccountLock(username) {
    try {
      const lock = await redisHelper.get(`locked_account:${username}`);
      return lock !== null;
    } catch (error) {
      return false;
    }
  }

  // Check if IP is blocked
  async checkIpBlock(ip) {
    try {
      const block = await redisHelper.get(`blocked_ip:${ip}`);
      return block !== null;
    } catch (error) {
      return false;
    }
  }

  // Report player
  async reportPlayer(reporterId, reportedUserId, reason, description, evidence = []) {
    try {
      const reportId = uuidv4();
      
      await db('player_reports').insert({
        id: reportId,
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        description,
        evidence: JSON.stringify(evidence),
        status: 'pending',
        created_at: new Date()
      });

      // Track report for spam prevention
      await this.trackPlayerReport(reporterId, reportedUserId);

      return { report_id: reportId, message: 'Player reported successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Track player reports to prevent spam
  async trackPlayerReport(reporterId, reportedUserId) {
    try {
      const key = `reports:${reporterId}:${reportedUserId}`;
      const reportCount = await redisHelper.incr(key);
      
      if (reportCount === 1) {
        await redisHelper.setex(key, 24 * 60 * 60, reportCount); // 24 hours
      }
      
      // Flag for spam if too many reports
      if (reportCount > 5) {
        await this.reportSuspiciousActivity(reporterId, 'report_spam', {
          reported_user: reportedUserId,
          report_count: reportCount
        });
      }
    } catch (error) {
      console.error('Error tracking player report:', error);
    }
  }

  // Get security reports
  async getSecurityReports(filters = {}) {
    try {
      let query = db('security_reports')
        .join('users', 'security_reports.user_id', 'users.id')
        .select(
          'security_reports.*',
          'users.username'
        );

      if (filters.status) {
        query = query.where('security_reports.status', filters.status);
      }

      if (filters.activity_type) {
        query = query.where('security_reports.activity_type', filters.activity_type);
      }

      if (filters.severity) {
        query = query.where('security_reports.severity', '>=', filters.severity);
      }

      const reports = await query.orderBy('security_reports.created_at', 'desc');
      
      return reports.map(report => ({
        ...report,
        details: JSON.parse(report.details)
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get player reports
  async getPlayerReports(filters = {}) {
    try {
      let query = db('player_reports')
        .join('users as reporters', 'player_reports.reporter_id', 'reporters.id')
        .join('users as reported', 'player_reports.reported_user_id', 'reported.id')
        .select(
          'player_reports.*',
          'reporters.username as reporter_username',
          'reported.username as reported_username'
        );

      if (filters.status) {
        query = query.where('player_reports.status', filters.status);
      }

      if (filters.reason) {
        query = query.where('player_reports.reason', filters.reason);
      }

      const reports = await query.orderBy('player_reports.created_at', 'desc');
      
      return reports.map(report => ({
        ...report,
        evidence: JSON.parse(report.evidence)
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get ban history
  async getBanHistory(userId) {
    try {
      const bans = await db('bans')
        .join('users as admins', 'bans.admin_id', 'admins.id')
        .where('bans.user_id', userId)
        .select(
          'bans.*',
          'admins.username as admin_username'
        )
        .orderBy('bans.created_at', 'desc');

      return bans;
    } catch (error) {
      throw error;
    }
  }

  // Get security statistics
  async getSecurityStats() {
    try {
      const stats = await db('security_reports')
        .select(
          db.raw('COUNT(*) as total_reports'),
          db.raw('COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_reports'),
          db.raw('COUNT(CASE WHEN severity >= 8 THEN 1 END) as high_severity_reports'),
          db.raw('AVG(severity) as avg_severity')
        )
        .first();

      const banStats = await db('bans')
        .select(
          db.raw('COUNT(*) as total_bans'),
          db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_bans'),
          db.raw('COUNT(CASE WHEN ban_type = "permanent" THEN 1 END) as permanent_bans')
        )
        .first();

      const activityStats = await db('security_reports')
        .select('activity_type')
        .count('* as count')
        .groupBy('activity_type');

      return {
        ...stats,
        ...banStats,
        avg_severity: parseFloat(stats.avg_severity || 0).toFixed(2),
        activity_breakdown: activityStats.reduce((acc, item) => {
          acc[item.activity_type] = parseInt(item.count);
          return acc;
        }, {})
      };
    } catch (error) {
      throw error;
    }
  }

  // Generate security token
  generateSecurityToken(data) {
    const timestamp = Date.now();
    const payload = JSON.stringify({ ...data, timestamp });
    const signature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY)
      .update(payload)
      .digest('hex');
    
    return Buffer.from(JSON.stringify({ payload, signature })).toString('base64');
  }

  // Verify security token
  verifySecurityToken(token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const { payload, signature } = decoded;
      
      const expectedSignature = crypto
        .createHmac('sha256', process.env.ENCRYPTION_KEY)
        .update(payload)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid signature' };
      }
      
      const data = JSON.parse(payload);
      const age = Date.now() - data.timestamp;
      
      if (age > 300000) { // 5 minutes
        return { valid: false, reason: 'Token expired' };
      }
      
      return { valid: true, data };
    } catch (error) {
      return { valid: false, reason: 'Invalid token format' };
    }
  }
}

module.exports = new EpoSecurityService();