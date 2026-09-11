const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Models for public statistics
const Voter = require('./models/Voter');
const User = require('./models/User');
const { WARD_ENUM } = require('./models/Voter');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Dynamic CORS configuration allowing any localhost/127.0.0.1 origin on ANY port
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is localhost or 127.0.0.1 on any port (e.g. 5173, 5174, 5175, 3000, 5030, etc.)
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    
    // Default fallback: allow origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security Headers (configured to allow cross-origin requests)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiter for Authentication Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

app.use('/api/auth', authLimiter);

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/recruiter', require('./routes/recruiterRoutes'));

// Public Non-Sensitive Statistics Endpoint for Homepage
app.get('/api/public/stats', async (req, res, next) => {
  try {
    const totalVoters = await Voter.countDocuments();
    const activeRecruiters = await User.countDocuments({ role: 'recruiter', status: 'active' });
    const distinctWardsWithVoters = await Voter.distinct('ward');
    const wardsCoveredCount = distinctWardsWithVoters.length;
    const coveragePercentage = Math.round((wardsCoveredCount / WARD_ENUM.length) * 100);

    res.status(200).json({
      success: true,
      stats: {
        totalWards: WARD_ENUM.length,
        registeredRecords: totalVoters,
        activeRecruiters,
        wardsCoveredCount,
        coveragePercentage,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Public Official Wards List Endpoint
app.get('/api/public/wards', (req, res) => {
  res.status(200).json({
    success: true,
    wards: WARD_ENUM,
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    initiative: 'BADAGRY VOTERS DIGITIZATION INITIATIVE (BVDI)',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  BADAGRY VOTERS DIGITIZATION INITIATIVE (BVDI)   `);
  console.log(`  Backend Server Running on Port ${PORT}           `);
  console.log(`==================================================`);
});
