const Voter = require('../models/Voter');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Helper to generate reference code
const generateRefCode = () => {
  const randomHex = Math.floor(100000 + Math.random() * 900000);
  return `BVDI-${randomHex}`;
};

// @desc    Get logged in recruiter profile & field stats
// @route   GET /api/recruiter/profile
// @access  Private (Recruiter)
const getProfile = async (req, res, next) => {
  try {
    const recruiter = await User.findById(req.user._id).select('-password');
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter profile not found.',
      });
    }

    const totalVoters = await Voter.countDocuments({ registeredBy: recruiter._id });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const todayCount = await Voter.countDocuments({
      registeredBy: recruiter._id,
      createdAt: { $gte: startOfToday },
    });

    const thisWeekCount = await Voter.countDocuments({
      registeredBy: recruiter._id,
      createdAt: { $gte: startOfWeek },
    });

    const wardBreakdown = await Voter.aggregate([
      { $match: { registeredBy: recruiter._id } },
      { $group: { _id: '$ward', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      recruiter: {
        id: recruiter._id,
        firstName: recruiter.firstName,
        lastName: recruiter.lastName,
        email: recruiter.email,
        phone: recruiter.phone,
        address: recruiter.address,
        recruiterCode: recruiter.recruiterCode,
        status: recruiter.status,
        stats: {
          totalVoters,
          todayCount,
          thisWeekCount,
          wardBreakdown,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new voter (Field registration)
// @route   POST /api/recruiter/voters
// @access  Private (Recruiter)
const registerVoter = async (req, res, next) => {
  try {
    const {
      fullName,
      address,
      vin,
      phoneNumber,
      age,
      occupation,
      localGovernment,
      ward,
      pollingUnit,
      consent,
    } = req.body;

    // Validate required fields
    if (
      !fullName ||
      !address ||
      !vin ||
      !phoneNumber ||
      !age ||
      !occupation ||
      !ward ||
      !pollingUnit
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required fields on the registration form.',
      });
    }

    if (!consent) {
      return res.status(400).json({
        success: false,
        message: 'Please confirm voter consent before submitting.',
      });
    }

    const cleanVin = vin.trim().toUpperCase();

    // Check duplicate VIN
    const existingVin = await Voter.findOne({ vin: cleanVin });
    if (existingVin) {
      return res.status(400).json({
        success: false,
        message: 'A voter record with this VIN already exists.',
      });
    }

    const referenceCode = generateRefCode();

    const voter = await Voter.create({
      fullName: fullName.trim(),
      address: address.trim(),
      vin: cleanVin,
      phoneNumber: phoneNumber.trim(),
      age: parseInt(age, 10),
      occupation: occupation.trim(),
      localGovernment: localGovernment || 'Badagry',
      ward,
      pollingUnit: pollingUnit.trim(),
      consent: true,
      registeredBy: req.user._id,
      recruiterCode: req.user.recruiterCode,
      referenceCode,
    });

    await AuditLog.create({
      action: 'VOTER_REGISTERED',
      performedBy: req.user._id,
      userEmail: req.user.email,
      userRole: 'recruiter',
      recruiterCode: req.user.recruiterCode,
      details: {
        voterId: voter._id,
        referenceCode,
        ward,
        localGovernment: voter.localGovernment,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: 'Voter registered successfully.',
      registration: {
        id: voter._id,
        referenceCode: voter.referenceCode,
        fullName: voter.fullName,
        ward: voter.ward,
        pollingUnit: voter.pollingUnit,
        localGovernment: voter.localGovernment,
        recruiterCode: voter.recruiterCode,
        recruiterName: `${req.user.firstName} ${req.user.lastName}`,
        date: voter.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get voters registered by current recruiter ONLY
// @route   GET /api/recruiter/voters
// @access  Private (Recruiter)
const getMyVoters = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, ward } = req.query;

    // STRICTOR Backend Security: enforce filtering ONLY by logged in recruiter ID
    const query = { registeredBy: req.user._id };

    if (ward && ward !== 'All') {
      query.ward = ward;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { vin: searchRegex },
        { phoneNumber: searchRegex },
        { pollingUnit: searchRegex },
        { referenceCode: searchRegex },
      ];
    }

    const total = await Voter.countDocuments(query);
    const voters = await Voter.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mask VIN for recruiter listing view
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

// @desc    Get single voter record registered by this recruiter
// @route   GET /api/recruiter/voters/:id
// @access  Private (Recruiter)
const getVoterById = async (req, res, next) => {
  try {
    const voter = await Voter.findOne({ _id: req.params.id, registeredBy: req.user._id });
    if (!voter) {
      return res.status(404).json({
        success: false,
        message: 'Voter record not found or access denied.',
      });
    }

    const obj = voter.toObject();
    obj.vin = voter.getMaskedVIN();

    res.status(200).json({
      success: true,
      voter: obj,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  registerVoter,
  getMyVoters,
  getVoterById,
};
