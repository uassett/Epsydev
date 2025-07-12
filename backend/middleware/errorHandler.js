const { logger } = require('./logger');

const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    type: 'unhandled_error',
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id || null,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let error = {
    message: 'Internal Server Error',
    code: 'EPO_INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  };

  // Handle different error types
  if (err.name === 'ValidationError') {
    error = {
      message: 'Validation Error',
      code: 'EPO_VALIDATION_ERROR',
      details: err.details,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(400).json(error);
  }

  if (err.name === 'UnauthorizedError') {
    error = {
      message: 'Unauthorized',
      code: 'EPO_UNAUTHORIZED',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(401).json(error);
  }

  if (err.name === 'ForbiddenError') {
    error = {
      message: 'Forbidden',
      code: 'EPO_FORBIDDEN',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(403).json(error);
  }

  if (err.name === 'NotFoundError') {
    error = {
      message: 'Resource not found',
      code: 'EPO_NOT_FOUND',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(404).json(error);
  }

  if (err.name === 'ConflictError') {
    error = {
      message: 'Conflict',
      code: 'EPO_CONFLICT',
      details: err.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(409).json(error);
  }

  if (err.name === 'RateLimitError') {
    error = {
      message: 'Rate limit exceeded',
      code: 'EPO_RATE_LIMIT',
      retryAfter: err.retryAfter,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(429).json(error);
  }

  // Database errors
  if (err.code === '23505') { // PostgreSQL unique constraint violation
    error = {
      message: 'Resource already exists',
      code: 'EPO_DUPLICATE_RESOURCE',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(409).json(error);
  }

  if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    error = {
      message: 'Referenced resource not found',
      code: 'EPO_FOREIGN_KEY_VIOLATION',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      code: 'EPO_INVALID_TOKEN',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      code: 'EPO_TOKEN_EXPIRED',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(401).json(error);
  }

  // Custom Epo errors
  if (err.code && err.code.startsWith('EPO_')) {
    error = {
      message: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    };
    return res.status(err.statusCode || 500).json(error);
  }

  // Hide stack traces in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json(error);
  }

  // Include stack trace in development
  error.stack = err.stack;
  error.details = err.message;
  
  res.status(500).json(error);
};

// Custom error classes
class EpoError extends Error {
  constructor(message, code, statusCode = 500, details = null) {
    super(message);
    this.name = 'EpoError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends EpoError {
  constructor(message, details = null) {
    super(message, 'EPO_VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends EpoError {
  constructor(message = 'Unauthorized') {
    super(message, 'EPO_UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends EpoError {
  constructor(message = 'Forbidden') {
    super(message, 'EPO_FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends EpoError {
  constructor(message = 'Resource not found') {
    super(message, 'EPO_NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends EpoError {
  constructor(message = 'Conflict') {
    super(message, 'EPO_CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends EpoError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 'EPO_RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

module.exports = {
  errorHandler,
  EpoError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError
};