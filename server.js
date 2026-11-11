const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const { clientIpKeyGenerator } = require('./middleware/rateLimiters');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const ashaRoutes = require('./routes/asha');
const adminRoutes = require('./routes/admin');
const visitRoutes = require('./routes/visits');
const womanRoutes = require('./routes/women');
const childRoutes = require('./routes/children');
const familyRoutes = require('./routes/families');
const reportRoutes = require('./routes/reports');
const anganwadiRoutes  = require('./routes/anganwadi');
const surveyFormRoutes = require('./routes/surveyForms');
const followUpRoutes   = require('./routes/followUps');

const app = express();

// Render traffic can pass through Cloudflare and Render load balancers.
// Do not guess the forwarding depth: set TRUST_PROXY_HOPS only after measuring
// the X-Forwarded-For chain on the deployed service. Refuse production startup
// when it is missing or invalid so rate limits cannot silently share one proxy IP.
const trustProxyHopsRaw = process.env.TRUST_PROXY_HOPS;
const trustProxyHops = trustProxyHopsRaw === undefined
  ? (process.env.NODE_ENV === 'production' ? NaN : 0)
  : Number(trustProxyHopsRaw);

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('Set TRUST_PROXY_HOPS to the verified number of trusted reverse-proxy hops.');
}

app.set('trust proxy', trustProxyHops);

// Security & middleware
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  keyGenerator: clientIpKeyGenerator,
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/asha', ashaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/women', womanRoutes);
app.use('/api/children', childRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/anganwadi', anganwadiRoutes);
app.use('/api/survey-forms', surveyFormRoutes);
app.use('/api/followups',    followUpRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);

  const statusCode = err.status || 500;

  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : (err.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    message,
  });
});

// DB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch(err => { console.error('❌ DB connection failed:', err); process.exit(1); });

// Daily pre-aggregation cron job (midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Running midnight analytics pre-aggregation...');
  // Extend here with BullMQ workers for heavy analytics
});

module.exports = app;
