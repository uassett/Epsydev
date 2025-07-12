const { logger } = require('../utils/logger');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        player: req.player ? req.player.id : 'anonymous'
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: isDevelopment ? err.details : undefined
        });
    }

    if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }

    if (err.name === 'ForbiddenError') {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }

    if (err.name === 'NotFoundError') {
        return res.status(404).json({
            success: false,
            error: 'Resource not found'
        });
    }

    // Database errors
    if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint violations
        return res.status(400).json({
            success: false,
            error: 'Database constraint violation',
            details: isDevelopment ? err.detail : undefined
        });
    }

    // Default server error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: isDevelopment ? err.message : undefined,
        stack: isDevelopment ? err.stack : undefined
    });
};

// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Custom error classes
class ValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

class NotFoundError extends Error {
    constructor(message = 'Not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

module.exports = {
    errorHandler,
    asyncHandler,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError
};