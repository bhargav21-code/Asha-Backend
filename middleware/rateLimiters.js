
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { isIP } = require('node:net');

// Render terminates public traffic at its trusted reverse proxy.
// server.js sets Express trust proxy to one hop; use Express's resolved client IP
// rather than trusting a caller-supplied CF-Connecting-IP header.
const clientIpKeyGenerator = (req) => {
  const clientIp = req.ip || req.socket.remoteAddress;
  if (!clientIp || !isIP(clientIp)) {
    return 'unknown-client';
  }
  return ipKeyGenerator(clientIp, 56);
};

const createLimiter = ({ windowMs, limit, message, identifier }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: clientIpKeyGenerator,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        success: false,
        message,
      });
    },
  });

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  identifier: 'login',
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  identifier: 'forgot-password',
  message: 'Too many password reset requests. Please try again later.',
});

const verifyOtpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  identifier: 'verify-otp',
  message: 'Too many OTP attempts. Please try again later.',
});

const selfRegisterLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  identifier: 'self-registration',
  message: 'Too many registration attempts. Please try again later.',
});

module.exports = {
  clientIpKeyGenerator,
  loginLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
  selfRegisterLimiter,
};
