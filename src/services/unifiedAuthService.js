const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const AUTH_V2_SERVICE_URL = process.env.AUTH_V2_SERVICE_URL || 'http://localhost:3008';
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Create axios instances
const authClient = axios.create({
  baseURL: AUTH_SERVICE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

const authV2Client = axios.create({
  baseURL: AUTH_V2_SERVICE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Detect token type (JWT or Firebase)
 * @param {String} token - Token to detect
 * @returns {String} - 'jwt' or 'firebase'
 */
const detectTokenType = (token) => {
  try {
    // Try to decode as JWT without verification
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      // If can't decode as JWT, assume it's Firebase
      return 'firebase';
    }
    
    // Check if it has JWT structure (header, payload, signature)
    if (decoded.header && decoded.payload) {
      // Check if it's a Firebase token by looking at the issuer
      if (decoded.payload.iss && decoded.payload.iss.includes('securetoken.google.com')) {
        return 'firebase';
      }
      
      // Check if it has typical JWT fields from our auth-service
      if (decoded.payload.id || decoded.payload.userId) {
        return 'jwt';
      }
    }
    
    // Default to firebase for longer tokens
    if (token.length > 500) {
      return 'firebase';
    }
    
    return 'jwt';
  } catch (error) {
    // If any error, assume firebase
    logger.debug('Token type detection error, assuming firebase', { error: error.message });
    return 'firebase';
  }
};

/**
 * Verify JWT token with old auth-service
 * @param {String} token - JWT token
 * @returns {Promise<Object|null>} - User object or null
 */
const verifyJwtToken = async (token) => {
  try {
    // First verify the JWT signature locally
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Then get user info from auth service
    const response = await authClient.get('/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success && response.data.data.user) {
      const user = response.data.data.user;
      
      logger.debug('JWT token verified successfully', {
        userId: user.id,
        email: user.email,
        tokenType: 'jwt'
      });

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        user_type: user.user_type,
        is_active: user.is_active,
        token_balance: user.token_balance,
        auth_provider: 'local',
        tokenType: 'jwt'
      };
    }

    return null;
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.debug('JWT token verification failed', { error: error.message });
      return null;
    }
    
    if (error.response && error.response.status === 401) {
      return null;
    }
    
    if (error.request) {
      logger.error('Auth service unreachable', { error: error.message });
      // Don't throw, return null to allow fallback
      return null;
    }
    
    throw error;
  }
};

/**
 * Verify Firebase token with auth-v2-service
 * @param {String} token - Firebase token
 * @returns {Promise<Object|null>} - User object or null
 */
const verifyFirebaseToken = async (token) => {
  try {
    const response = await authV2Client.post('/v1/token/verify', {
      token: token
    });

    if (response.data.success && response.data.data.valid && response.data.data.user) {
      const user = response.data.data.user;
      
      logger.debug('Firebase token verified successfully', {
        userId: user.id,
        email: user.email,
        tokenType: 'firebase'
      });

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        user_type: user.user_type,
        is_active: user.is_active,
        token_balance: user.token_balance,
        auth_provider: user.auth_provider,
        firebase_uid: user.firebase_uid,
        tokenType: 'firebase'
      };
    }

    return null;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logger.debug('Firebase token verification failed', { error: error.message });
      return null;
    }
    
    if (error.request) {
      logger.error('Auth-v2 service unreachable', { error: error.message });
      // Fallback: Don't throw error, return null to allow JWT fallback
      return null;
    }
    
    logger.error('Firebase token verification error', { error: error.message });
    return null;
  }
};

/**
 * Unified token verification - supports both JWT and Firebase tokens
 * @param {String} token - Token to verify
 * @returns {Promise<Object|null>} - User object or null
 */
const verifyToken = async (token) => {
  try {
    // Detect token type
    const tokenType = detectTokenType(token);
    
    logger.debug('Token type detected', { tokenType, tokenLength: token.length });
    
    // Try to verify based on detected type
    if (tokenType === 'firebase') {
      const user = await verifyFirebaseToken(token);
      if (user) return user;
      
      // Fallback to JWT if Firebase verification fails
      logger.debug('Firebase verification failed, trying JWT fallback');
      return await verifyJwtToken(token);
    } else {
      const user = await verifyJwtToken(token);
      if (user) return user;
      
      // Fallback to Firebase if JWT verification fails
      logger.debug('JWT verification failed, trying Firebase fallback');
      return await verifyFirebaseToken(token);
    }
  } catch (error) {
    logger.error('Token verification error', { error: error.message });
    throw error;
  }
};

/**
 * Check auth services health
 * @returns {Promise<Object>} - Health status
 */
const checkHealth = async () => {
  const health = {
    authService: false,
    authV2Service: false
  };

  try {
    const response = await authClient.get('/health', { timeout: 5000 });
    health.authService = response.status === 200;
  } catch (error) {
    logger.debug('Auth service health check failed', { error: error.message });
  }

  try {
    const response = await authV2Client.get('/health', { timeout: 5000 });
    health.authV2Service = response.status === 200;
  } catch (error) {
    logger.debug('Auth-v2 service health check failed', { error: error.message });
  }

  return health;
};

module.exports = {
  verifyToken,
  detectTokenType,
  checkHealth
};

