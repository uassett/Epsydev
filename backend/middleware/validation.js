const Joi = require('joi');
const { ValidationError } = require('./errorHandler');

// Common validation schemas
const schemas = {
  // User validation
  userRegistration: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(20)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must not exceed 20 characters'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    hwid: Joi.string()
      .required()
      .messages({
        'any.required': 'Hardware ID is required'
      })
  }),

  userLogin: Joi.object({
    username: Joi.string()
      .required(),
    password: Joi.string()
      .required(),
    hwid: Joi.string()
      .required()
  }),

  // Player validation
  playerUpdate: Joi.object({
    display_name: Joi.string()
      .min(3)
      .max(30)
      .optional(),
    avatar_url: Joi.string()
      .uri()
      .optional(),
    settings: Joi.object()
      .optional()
  }),

  // Economy validation
  vbucksPurchase: Joi.object({
    package_id: Joi.string()
      .required(),
    payment_method: Joi.string()
      .valid('stripe', 'paypal')
      .required()
  }),

  itemPurchase: Joi.object({
    item_id: Joi.string()
      .required(),
    quantity: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(1)
  }),

  // Matchmaking validation
  joinQueue: Joi.object({
    game_mode: Joi.string()
      .valid('solo', 'duo', 'squad', 'ltm')
      .required(),
    region: Joi.string()
      .valid('na', 'eu', 'oce', 'asia')
      .required(),
    skill_level: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional()
  }),

  // Content validation
  contentUpload: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .required(),
    description: Joi.string()
      .max(500)
      .optional(),
    type: Joi.string()
      .valid('skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music')
      .required(),
    rarity: Joi.string()
      .valid('common', 'uncommon', 'rare', 'epic', 'legendary')
      .required(),
    price: Joi.number()
      .integer()
      .min(0)
      .max(10000)
      .required()
  }),

  // Admin validation
  banUser: Joi.object({
    user_id: Joi.string()
      .required(),
    reason: Joi.string()
      .min(5)
      .max(500)
      .required(),
    duration: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .required(), // days
    hwid_ban: Joi.boolean()
      .default(false)
  }),

  // Security validation
  reportPlayer: Joi.object({
    reported_user_id: Joi.string()
      .required(),
    reason: Joi.string()
      .valid('cheating', 'harassment', 'inappropriate_name', 'griefing', 'other')
      .required(),
    description: Joi.string()
      .min(10)
      .max(1000)
      .required(),
    evidence: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional()
  }),

  // Common schemas
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
  }),

  uuid: Joi.string()
    .guid({ version: 'uuidv4' })
    .required(),

  objectId: Joi.string()
    .required()
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      throw new ValidationError('Validation failed', details);
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

// Specific validation middlewares
const validateUserRegistration = validate(schemas.userRegistration);
const validateUserLogin = validate(schemas.userLogin);
const validatePlayerUpdate = validate(schemas.playerUpdate);
const validateVbucksPurchase = validate(schemas.vbucksPurchase);
const validateItemPurchase = validate(schemas.itemPurchase);
const validateJoinQueue = validate(schemas.joinQueue);
const validateContentUpload = validate(schemas.contentUpload);
const validateBanUser = validate(schemas.banUser);
const validateReportPlayer = validate(schemas.reportPlayer);
const validatePagination = validate(schemas.pagination, 'query');
const validateUuid = (field) => validate(schemas.uuid, field);
const validateObjectId = (field) => validate(schemas.objectId, field);

// Custom validation helpers
const validateHwid = (hwid) => {
  // Basic HWID validation - should be a hash of hardware components
  const hwidRegex = /^[a-fA-F0-9]{64}$/;
  return hwidRegex.test(hwid);
};

const validateEpoLevel = (level) => {
  return Number.isInteger(level) && level >= 1 && level <= 100;
};

const validateGameMode = (mode) => {
  const validModes = ['solo', 'duo', 'squad', 'ltm', 'creative', 'playground'];
  return validModes.includes(mode);
};

const validateRegion = (region) => {
  const validRegions = ['na', 'eu', 'oce', 'asia', 'brazil', 'japan'];
  return validRegions.includes(region);
};

const validateItemType = (type) => {
  const validTypes = [
    'skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music', 
    'loading_screen', 'spray', 'banner', 'emoticon'
  ];
  return validTypes.includes(type);
};

const validateRarity = (rarity) => {
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  return validRarities.includes(rarity);
};

module.exports = {
  schemas,
  validate,
  validateUserRegistration,
  validateUserLogin,
  validatePlayerUpdate,
  validateVbucksPurchase,
  validateItemPurchase,
  validateJoinQueue,
  validateContentUpload,
  validateBanUser,
  validateReportPlayer,
  validatePagination,
  validateUuid,
  validateObjectId,
  validateHwid,
  validateEpoLevel,
  validateGameMode,
  validateRegion,
  validateItemType,
  validateRarity
};