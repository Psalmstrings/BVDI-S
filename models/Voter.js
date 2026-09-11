const mongoose = require('mongoose');

const WARD_ENUM = [
  'Ward A: Jegba',
  'Ward B: Posukoh',
  'Ward C: Awanjigoh',
  'Ward D: Aovikoh',
  'Ward E: Ajara Vetho',
  'Ward F: Ajara Topa',
  'Ward G: Ajido',
  'Ward H: Iyafin',
  'Ward I: Ikoga',
  'Ward J: Topo-Idale',
];

const voterSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    vin: {
      type: String,
      required: [true, 'Voter Identification Number (VIN) is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [18, 'Voter must be at least 18 years old'],
      max: [120, 'Please enter a valid age'],
    },
    occupation: {
      type: String,
      required: [true, 'Occupation is required'],
      trim: true,
    },
    localGovernment: {
      type: String,
      default: 'Badagry',
      trim: true,
    },
    ward: {
      type: String,
      required: [true, 'Ward is required'],
      enum: {
        values: WARD_ENUM,
        message: 'Invalid ward selected. Must be one of Badagry official wards.',
      },
    },
    pollingUnit: {
      type: String,
      required: [true, 'Polling Unit is required'],
      trim: true,
    },
    consent: {
      type: Boolean,
      required: [true, 'Consent is required'],
      validate: {
        validator: function (v) {
          return v === true;
        },
        message: 'Explicit consent is mandatory for registration.',
      },
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recruiterCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    referenceCode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-performance server-side querying and filtering
voterSchema.index({ recruiterCode: 1 });
voterSchema.index({ ward: 1 });
voterSchema.index({ localGovernment: 1 });
voterSchema.index({ phoneNumber: 1 });
voterSchema.index({ createdAt: -1 });

// Helper to mask VIN
voterSchema.methods.getMaskedVIN = function () {
  if (!this.vin || this.vin.length <= 4) return '************';
  const lastFour = this.vin.slice(-4);
  return '*'.repeat(Math.max(8, this.vin.length - 4)) + lastFour;
};

module.exports = mongoose.model('Voter', voterSchema);
module.exports.WARD_ENUM = WARD_ENUM;
