const User = require('../models/User');
const Voter = require('../models/Voter');
const AuditLog = require('../models/AuditLog');
const { WARD_ENUM } = require('../models/Voter');
const { Parser } = require('json2csv');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// @desc    Register a new Recruiter
// @route   POST /api/admin/recruiters
// @access  Private (Admin)
const createRecruiter = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, address, password, confirmPassword, assignedWard } = req.body;

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required recruiter fields: First name, Last name, Email, Phone, Password, and Assigned Ward.',
      });
    }

    if (!assignedWard || !WARD_ENUM.includes(assignedWard.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid Badagry ward to assign this recruiter to.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Strict email format verification
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address with a recognized domain (e.g. name@example.com).',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Generate unique recruiter code (e.g. SAMUEL7XQ9)
    const recruiterCode = await User.generateRecruiterCode(firstName);

    const recruiter = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      address: address ? address.trim() : '',
      password,
      role: 'recruiter',
      assignedWard: assignedWard.trim(),
      recruiterCode,
      status: 'active',
    });

    await AuditLog.create({
      action: 'RECRUITER_CREATED',
      performedBy: req.user._id,
      userEmail: req.user.email,
      userRole: 'admin',
      recruiterCode: recruiter.recruiterCode,
      details: {
        recruiterEmail: recruiter.email,
        recruiterName: `${firstName} ${lastName}`,
        assignedWard: recruiter.assignedWard,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: 'Recruiter created successfully.',
      recruiter: {
        id: recruiter._id,
        firstName: recruiter.firstName,
        lastName: recruiter.lastName,
        email: recruiter.email,
        phone: recruiter.phone,
        address: recruiter.address,
        role: recruiter.role,
        assignedWard: recruiter.assignedWard,
        recruiterCode: recruiter.recruiterCode,
        status: recruiter.status,
        createdAt: recruiter.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all recruiters with search, ward filter, and pagination
// @route   GET /api/admin/recruiters
// @access  Private (Admin)
const getRecruiters = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, status, ward } = req.query;

    const query = { role: 'recruiter' };

    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    if (ward && ward !== 'All') {
      query.assignedWard = ward;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { recruiterCode: searchRegex },
        { assignedWard: searchRegex },
      ];
    }

    const total = await User.countDocuments(query);
    const recruiters = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Aggregate voters count for each recruiter
    const recruiterCodes = recruiters.map((r) => r.recruiterCode).filter(Boolean);
    const voterCounts = await Voter.aggregate([
      { $match: { recruiterCode: { $in: recruiterCodes } } },
      { $group: { _id: '$recruiterCode', totalVoters: { $sum: 1 } } },
    ]);

    const countMap = {};
    voterCounts.forEach((item) => {
      countMap[item._id] = item.totalVoters;
    });

    const enrichedRecruiters = recruiters.map((r) => ({
      ...r.toObject(),
      votersCount: countMap[r.recruiterCode] || 0,
    }));

    res.status(200).json({
      success: true,
      count: enrichedRecruiters.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      recruiters: enrichedRecruiters,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single recruiter details & stats
// @route   GET /api/admin/recruiters/:id
// @access  Private (Admin)
const getRecruiterById = async (req, res, next) => {
  try {
    const recruiter = await User.findById(req.query.id || req.params.id).select('-password');
    if (!recruiter || recruiter.role !== 'recruiter') {
      return res.status(404).json({
        success: false,
        message: 'Recruiter not found.',
      });
    }

    const totalVoters = await Voter.countDocuments({ recruiterCode: recruiter.recruiterCode });
    const wardBreakdown = await Voter.aggregate([
      { $match: { recruiterCode: recruiter.recruiterCode } },
      { $group: { _id: '$ward', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const recentVoters = await Voter.find({ recruiterCode: recruiter.recruiterCode })
      .sort({ createdAt: -1 })
      .limit(10);

    const maskedRecent = recentVoters.map((v) => {
      const obj = v.toObject();
      obj.vin = v.getMaskedVIN();
      return obj;
    });

    res.status(200).json({
      success: true,
      recruiter: {
        ...recruiter.toObject(),
        totalVoters,
        wardBreakdown,
        recentVoters: maskedRecent,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate/Deactivate recruiter
// @route   PATCH /api/admin/recruiters/:id/status
// @access  Private (Admin)
const toggleRecruiterStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be active or inactive.',
      });
    }

    const recruiter = await User.findById(req.params.id);
    if (!recruiter || recruiter.role !== 'recruiter') {
      return res.status(404).json({
        success: false,
        message: 'Recruiter not found.',
      });
    }

    recruiter.status = status;
    await recruiter.save();

    await AuditLog.create({
      action: `RECRUITER_${status.toUpperCase()}`,
      performedBy: req.user._id,
      userEmail: req.user.email,
      userRole: 'admin',
      recruiterCode: recruiter.recruiterCode,
      details: { recruiterEmail: recruiter.email, newStatus: status },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Recruiter status updated to ${status}.`,
      recruiter: {
        id: recruiter._id,
        recruiterCode: recruiter.recruiterCode,
        status: recruiter.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recruiter details (e.g. assignedWard, phone, address, name)
// @route   PATCH /api/admin/recruiters/:id
// @access  Private (Admin)
const updateRecruiter = async (req, res, next) => {
  try {
    const { assignedWard, phone, address, firstName, lastName } = req.body;

    const recruiter = await User.findById(req.params.id);
    if (!recruiter || recruiter.role !== 'recruiter') {
      return res.status(404).json({
        success: false,
        message: 'Recruiter not found.',
      });
    }

    if (assignedWard !== undefined) {
      if (assignedWard && !WARD_ENUM.includes(assignedWard.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ward selected. Must be one of the 10 official Badagry wards.',
        });
      }
      recruiter.assignedWard = assignedWard ? assignedWard.trim() : null;
    }

    if (phone) recruiter.phone = phone.trim();
    if (address !== undefined) recruiter.address = address.trim();
    if (firstName) recruiter.firstName = firstName.trim();
    if (lastName) recruiter.lastName = lastName.trim();

    await recruiter.save();

    await AuditLog.create({
      action: 'RECRUITER_UPDATED',
      performedBy: req.user._id,
      userEmail: req.user.email,
      userRole: 'admin',
      recruiterCode: recruiter.recruiterCode,
      details: {
        recruiterEmail: recruiter.email,
        assignedWard: recruiter.assignedWard,
        phone: recruiter.phone,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Recruiter details updated successfully.',
      recruiter: {
        id: recruiter._id,
        firstName: recruiter.firstName,
        lastName: recruiter.lastName,
        email: recruiter.email,
        phone: recruiter.phone,
        address: recruiter.address,
        role: recruiter.role,
        assignedWard: recruiter.assignedWard,
        recruiterCode: recruiter.recruiterCode,
        status: recruiter.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get master voters directory with search & filters
// @route   GET /api/admin/voters
// @access  Private (Admin)
const getVoters = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { search, ward, recruiterCode, localGovernment, occupation, minAge, maxAge, startDate, endDate } = req.query;

    const query = {};

    if (localGovernment) {
      query.localGovernment = localGovernment;
    }

    if (ward && ward !== 'All') {
      query.ward = ward;
    }

    if (recruiterCode && recruiterCode !== 'All') {
      query.recruiterCode = recruiterCode.toUpperCase();
    }

    if (occupation) {
      query.occupation = new RegExp(occupation.trim(), 'i');
    }

    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = parseInt(minAge, 10);
      if (maxAge) query.age.$lte = parseInt(maxAge, 10);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { vin: searchRegex },
        { phoneNumber: searchRegex },
        { recruiterCode: searchRegex },
        { pollingUnit: searchRegex },
      ];
    }

    const total = await Voter.countDocuments(query);
    const voters = await Voter.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('registeredBy', 'firstName lastName email recruiterCode');

    // Mask VIN by default for protection
    const maskedVoters = voters.map((v) => {
      const obj = v.toObject();
      obj.vin = v.getMaskedVIN();
      return obj;
    });

    res.status(200).json({
      success: true,
      count: maskedVoters.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      voters: maskedVoters,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single voter record details
// @route   GET /api/admin/voters/:id
// @access  Private (Admin)
const getVoterById = async (req, res, next) => {
  try {
    const voter = await Voter.findById(req.params.id).populate('registeredBy', 'firstName lastName email phone recruiterCode');
    if (!voter) {
      return res.status(404).json({
        success: false,
        message: 'Voter record not found.',
      });
    }

    // Mask VIN unless explicitly authorized
    const obj = voter.toObject();
    obj.maskedVin = voter.getMaskedVIN();

    res.status(200).json({
      success: true,
      voter: obj,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard analytics and chart metrics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
const getAnalytics = async (req, res, next) => {
  try {
    const totalVoters = await Voter.countDocuments();
    const totalRecruiters = await User.countDocuments({ role: 'recruiter' });
    const activeRecruiters = await User.countDocuments({ role: 'recruiter', status: 'active' });

    // Wards with at least 1 registered voter
    const wardsWithVoters = await Voter.distinct('ward');
    const wardsCovered = wardsWithVoters.length;

    // Date bounds for today and this week
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const todayRegistrations = await Voter.countDocuments({ createdAt: { $gte: startOfToday } });
    const thisWeekRegistrations = await Voter.countDocuments({ createdAt: { $gte: startOfWeek } });

    // Chart 1: Voters by Ward (all 10 wards guaranteed)
    const wardCountsRaw = await Voter.aggregate([
      { $group: { _id: '$ward', count: { $sum: 1 } } },
    ]);
    const wardMap = {};
    wardCountsRaw.forEach((w) => {
      wardMap[w._id] = w.count;
    });

    const votersByWard = WARD_ENUM.map((w) => ({
      ward: w,
      shortWard: w.split(':')[0].trim(),
      wardName: w.split(':')[1] ? w.split(':')[1].trim() : w,
      count: wardMap[w] || 0,
    }));

    // Chart 2: Top Recruiters
    const recruiterCounts = await Voter.aggregate([
      { $group: { _id: '$recruiterCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const topRecruiterCodes = recruiterCounts.map((r) => r._id);
    const recruitersInfo = await User.find({ recruiterCode: { $in: topRecruiterCodes } }).select('firstName lastName recruiterCode');
    const recNameMap = {};
    recruitersInfo.forEach((r) => {
      recNameMap[r.recruiterCode] = `${r.firstName} ${r.lastName}`;
    });

    const registrationsByRecruiter = recruiterCounts.map((r) => ({
      recruiterCode: r._id,
      name: recNameMap[r._id] || r._id,
      count: r.count,
    }));

    // Chart 3: Registration Trend over time (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const trendRaw = await Voter.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Chart 4: Voter Age Distribution
    const ageRanges = [
      { label: '18-25', min: 18, max: 25 },
      { label: '26-35', min: 26, max: 35 },
      { label: '36-50', min: 36, max: 50 },
      { label: '51-65', min: 51, max: 65 },
      { label: '66+', min: 66, max: 120 },
    ];

    const ageDistribution = await Promise.all(
      ageRanges.map(async (range) => {
        const count = await Voter.countDocuments({ age: { $gte: range.min, $lte: range.max } });
        return { range: range.label, count };
      })
    );

    // Recruiters assigned per ward breakdown
    const recruitersByWard = await Promise.all(
      WARD_ENUM.map(async (w) => {
        const count = await User.countDocuments({ role: 'recruiter', assignedWard: w });
        return {
          ward: w,
          shortWard: w.split(':')[0].trim(),
          wardName: w.split(':')[1] ? w.split(':')[1].trim() : w,
          recruitersCount: count,
        };
      })
    );

    res.status(200).json({
      success: true,
      stats: {
        totalVoters,
        totalRecruiters,
        activeRecruiters,
        wardsCovered,
        totalWards: WARD_ENUM.length,
        todayRegistrations,
        thisWeekRegistrations,
      },
      charts: {
        votersByWard,
        recruitersByWard,
        registrationsByRecruiter,
        registrationTrend: trendRaw,
        ageDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ward performance breakdown
// @route   GET /api/admin/analytics/wards
// @access  Private (Admin)
const getWardAnalytics = async (req, res, next) => {
  try {
    const wardStats = await Promise.all(
      WARD_ENUM.map(async (wardName) => {
        const totalVoters = await Voter.countDocuments({ ward: wardName });
        const recruitersActive = await Voter.distinct('recruiterCode', { ward: wardName });
        const assignedRecruitersCount = await User.countDocuments({ role: 'recruiter', assignedWard: wardName });
        const recentRegistrations = await Voter.countDocuments({
          ward: wardName,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        });

        return {
          ward: wardName,
          code: wardName.split(':')[0].trim(),
          name: wardName.split(':')[1] ? wardName.split(':')[1].trim() : wardName,
          totalVoters,
          assignedRecruitersCount,
          activeRecruitersCount: recruitersActive.length,
          recentRegistrations,
        };
      })
    );

    res.status(200).json({
      success: true,
      wardStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recruiter performance analytics
// @route   GET /api/admin/analytics/recruiters
// @access  Private (Admin)
const getRecruiterAnalytics = async (req, res, next) => {
  try {
    const recruiters = await User.find({ role: 'recruiter' }).select('firstName lastName email phone recruiterCode assignedWard status createdAt');
    
    const performance = await Promise.all(
      recruiters.map(async (rec) => {
        const totalVoters = await Voter.countDocuments({ recruiterCode: rec.recruiterCode });
        const lastVoter = await Voter.findOne({ recruiterCode: rec.recruiterCode }).sort({ createdAt: -1 });
        const wardsWorked = await Voter.distinct('ward', { recruiterCode: rec.recruiterCode });

        return {
          id: rec._id,
          name: `${rec.firstName} ${rec.lastName}`,
          email: rec.email,
          phone: rec.phone,
          recruiterCode: rec.recruiterCode,
          assignedWard: rec.assignedWard || null,
          status: rec.status,
          totalVoters,
          wardsWorkedCount: wardsWorked.length,
          lastRegistrationDate: lastVoter ? lastVoter.createdAt : null,
          joinedDate: rec.createdAt,
        };
      })
    );

    // Sort by total voters descending
    performance.sort((a, b) => b.totalVoters - a.totalVoters);

    res.status(200).json({
      success: true,
      recruiters: performance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export filtered voters as CSV
// @route   POST /api/admin/voters/export
// @access  Private (Admin)
const exportVoters = async (req, res, next) => {
  try {
    const { ward, recruiterCode, localGovernment, startDate, endDate } = req.body;

    const query = {};
    if (localGovernment) query.localGovernment = localGovernment;
    if (ward && ward !== 'All') query.ward = ward;
    if (recruiterCode && recruiterCode !== 'All') query.recruiterCode = recruiterCode.toUpperCase();

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const voters = await Voter.find(query).sort({ createdAt: -1 });

    const fields = [
      { label: 'Full Name', value: 'fullName' },
      { label: 'Ward', value: 'ward' },
      { label: 'Polling Unit', value: 'pollingUnit' },
      { label: 'Local Government', value: 'localGovernment' },
      { label: 'Phone', value: 'phoneNumber' },
      { label: 'Age', value: 'age' },
      { label: 'Occupation', value: 'occupation' },
      { label: 'Recruiter Code', value: 'recruiterCode' },
      { label: 'Registration Date', value: (row) => new Date(row.createdAt).toLocaleDateString() },
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(voters);

    await AuditLog.create({
      action: 'VOTER_DATA_EXPORTED',
      performedBy: req.user._id,
      userEmail: req.user.email,
      userRole: 'admin',
      details: { totalRecordsExported: voters.length, filterUsed: { ward, recruiterCode } },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=BVDI_Voters_Export_${Date.now()}.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const skip = (page - 1) * limit;

    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .populate('performedBy', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRecruiter,
  getRecruiters,
  getRecruiterById,
  toggleRecruiterStatus,
  updateRecruiter,
  getVoters,
  getVoterById,
  getAnalytics,
  getWardAnalytics,
  getRecruiterAnalytics,
  exportVoters,
  getAuditLogs,
};
