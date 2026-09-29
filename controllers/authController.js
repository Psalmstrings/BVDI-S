const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Token Generator Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'bvdi_super_secret_jwt_key_badagry_2026_secure', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// @desc    Login user (Admin or Recruiter)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email address and password.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Strict email format validation
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format. Please provide a valid email address with a recognized domain (e.g. name@example.com).',
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials. Only authorized accounts registered by the Administrator can sign in.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials. Please verify your email and password.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the administrator.',
      });
    }

    // Role check if specified by client portal
    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as a '${user.role.toUpperCase()}', not a '${role.toUpperCase()}'. Please use the correct login portal.`,
      });
    }

    const token = generateToken(user._id);

    // Audit log login
    await AuditLog.create({
      action: `${user.role.toUpperCase()}_LOGIN`,
      performedBy: user._id,
      userEmail: user.email,
      userRole: user.role,
      recruiterCode: user.recruiterCode || '',
      ipAddress: req.ip || '127.0.0.1',
    });

    // Remove password before response
    user.password = undefined;

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        assignedWard: user.assignedWard || null,
        recruiterCode: user.recruiterCode,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        assignedWard: user.assignedWard || null,
        recruiterCode: user.recruiterCode,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, logout, getMe };
