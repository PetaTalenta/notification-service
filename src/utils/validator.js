const Joi = require('joi');
const logger = require('./logger');

// Enhanced notification schema for Phase 4 - optimized webhook payloads
const analysisStartedSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  jobId: Joi.string().uuid().required(),
  status: Joi.string().valid('processing', 'started').required(),
  assessment_name: Joi.string().required(),
  message: Joi.string().optional()
});

const analysisCompleteSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  jobId: Joi.string().uuid().required(),
  result_id: Joi.string().uuid().required(),
  status: Joi.string().valid('berhasil', 'completed', 'success').required(),
  assessment_name: Joi.string().required(),
  message: Joi.string().optional()
});

const analysisFailedSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  jobId: Joi.string().uuid().required(),
  status: Joi.string().valid('gagal', 'failed', 'error').required(),
  assessment_name: Joi.string().required(),
  error_message: Joi.string().required(),
  message: Joi.string().optional()
});

// New schema for unknown assessment type scenarios
const analysisUnknownSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  jobId: Joi.string().uuid().required(),
  status: Joi.string().valid('gagal', 'failed', 'error', 'unknown').required(),
  assessment_name: Joi.string().required(),
  error_message: Joi.string().required(),
  message: Joi.string().optional()
});

const validateNotification = (req, res, next) => {
  let schema;

  if (req.path === '/analysis-started') {
    schema = analysisStartedSchema;
  } else if (req.path === '/analysis-complete') {
    schema = analysisCompleteSchema;
  } else if (req.path === '/analysis-failed') {
    schema = analysisFailedSchema;
  } else if (req.path === '/analysis-unknown') {
    schema = analysisUnknownSchema;
  } else {
    return next();
  }

  const { error, value } = schema.validate(req.body);

  if (error) {
    logger.warn('Notification validation failed', {
      path: req.path,
      error: error.details[0].message,
      body: req.body
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message
      }
    });
  }

  req.body = value;
  next();
};

module.exports = { 
  validateNotification,
  analysisStartedSchema,
  analysisCompleteSchema,
  analysisFailedSchema,
  analysisUnknownSchema
};