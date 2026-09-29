const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const Voter = require('../models/Voter');
const { WARD_ENUM } = require('../models/Voter');

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log('[Seed] Clearing existing seed test records...');
    await User.deleteMany({});
    await Voter.deleteMany({});

    console.log('[Seed] Creating System Admin Account...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bvdi.gov.ng';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@BVDI2026!';

    const admin = await User.create({
      firstName: 'Badagry',
      lastName: 'Administrator',
      email: adminEmail,
      phone: '+2348030001122',
      address: 'Badagry Local Government Secretariat, Ajara, Badagry',
      password: adminPassword,
      role: 'admin',
      status: 'active',
    });

    console.log(`[Seed] Admin created successfully: ${admin.email}`);

    console.log('[Seed] Creating Recruiters...');
    const recruitersData = [
      {
        firstName: 'Samuel',
        lastName: 'Akran',
        email: 'samuel.akran@bvdi.gov.ng',
        phone: '+2348023456789',
        address: '24 Marina Road, Badagry',
        assignedWard: 'Ward A: Jegba',
        password: 'Password123!',
        codePrefix: 'SAMUEL',
      },
      {
        firstName: 'Mary',
        lastName: 'Senu',
        email: 'mary.senu@bvdi.gov.ng',
        phone: '+2348034567890',
        address: '15 Topo Road, Badagry',
        assignedWard: 'Ward B: Posukoh',
        password: 'Password123!',
        codePrefix: 'MARY',
      },
      {
        firstName: 'John',
        lastName: 'Whetho',
        email: 'john.whetho@bvdi.gov.ng',
        phone: '+2348045678901',
        address: '8 Ajara Vetho Road, Badagry',
        assignedWard: 'Ward E: Ajara Vetho',
        password: 'Password123!',
        codePrefix: 'JOHN',
      },
    ];

    const createdRecruiters = [];
    for (const rData of recruitersData) {
      const code = await User.generateRecruiterCode(rData.firstName);
      const recruiter = await User.create({
        firstName: rData.firstName,
        lastName: rData.lastName,
        email: rData.email,
        phone: rData.phone,
        address: rData.address,
        password: rData.password,
        role: 'recruiter',
        assignedWard: rData.assignedWard,
        recruiterCode: code,
        status: 'active',
      });
      createdRecruiters.push(recruiter);
      console.log(`[Seed] Recruiter created: ${recruiter.firstName} ${recruiter.lastName} (Code: ${recruiter.recruiterCode}, Ward: ${recruiter.assignedWard})`);
    }

    console.log('[Seed] Creating Sample Voters across Badagry 10 Wards...');
    const sampleOccupations = ['Fisherman', 'Trader', 'Civil Servant', 'Teacher', 'Farmer', 'Artisan', 'Entrepreneur', 'Student', 'Health Worker', 'Driver'];

    const sampleVoters = [
      // Ward A: Jegba
      { name: 'Babatunde Hunsu', ward: 'Ward A: Jegba', age: 34, occ: 'Trader', pu: 'PU 001 - Jegba Primary School' },
      { name: 'Kofo Mawuyon', ward: 'Ward A: Jegba', age: 45, occ: 'Civil Servant', pu: 'PU 002 - Town Hall Jegba' },
      { name: 'Folake Whehingo', ward: 'Ward A: Jegba', age: 29, occ: 'Teacher', pu: 'PU 003 - Market Square' },
      // Ward B: Posukoh
      { name: 'Adekunle Sesi', ward: 'Ward B: Posukoh', age: 52, occ: 'Fisherman', pu: 'PU 001 - Posukoh Community Centre' },
      { name: 'Yetunde Viwanu', ward: 'Ward B: Posukoh', age: 24, occ: 'Entrepreneur', pu: 'PU 002 - Posukoh Waterfront' },
      { name: 'Sunday Agosu', ward: 'Ward B: Posukoh', age: 41, occ: 'Artisan', pu: 'PU 003 - Posukoh Junction' },
      // Ward C: Awanjigoh
      { name: 'David Tonado', ward: 'Ward C: Awanjigoh', age: 38, occ: 'Farmer', pu: 'PU 001 - Awanjigoh Open Space' },
      { name: 'Risiokat Posu', ward: 'Ward C: Awanjigoh', age: 60, occ: 'Trader', pu: 'PU 002 - St. Thomas Primary School' },
      // Ward D: Aovikoh
      { name: 'Olusegun Kiki', ward: 'Ward D: Aovikoh', age: 31, occ: 'Health Worker', pu: 'PU 001 - Aovikoh Health Center' },
      { name: 'Blessing Senayon', ward: 'Ward D: Aovikoh', age: 27, occ: 'Teacher', pu: 'PU 002 - Aovikoh Square' },
      // Ward E: Ajara Vetho
      { name: 'Emanuel Petu', ward: 'Ward E: Ajara Vetho', age: 48, occ: 'Civil Servant', pu: 'PU 001 - Ajara Grammar School' },
      { name: 'Grace Zannu', ward: 'Ward E: Ajara Vetho', age: 33, occ: 'Trader', pu: 'PU 002 - Vetho Junction' },
      // Ward F: Ajara Topa
      { name: 'Solomon Whesu', ward: 'Ward F: Ajara Topa', age: 39, occ: 'Driver', pu: 'PU 001 - Ajara Topa Primary School' },
      { name: 'Titilayo Gbededo', ward: 'Ward F: Ajara Topa', age: 22, occ: 'Student', pu: 'PU 002 - Community Hall' },
      // Ward G: Ajido
      { name: 'Michael Awhin', ward: 'Ward G: Ajido', age: 50, occ: 'Fisherman', pu: 'PU 001 - Ajido Sea Front' },
      { name: 'Victoria Sejiro', ward: 'Ward G: Ajido', age: 42, occ: 'Trader', pu: 'PU 002 - Ajido Market' },
      // Ward H: Iyafin
      { name: 'Paul Kowe', ward: 'Ward H: Iyafin', age: 36, occ: 'Farmer', pu: 'PU 001 - Iyafin Community School' },
      { name: 'Abigail Toyon', ward: 'Ward H: Iyafin', age: 28, occ: 'Health Worker', pu: 'PU 002 - Health Post' },
      // Ward I: Ikoga
      { name: 'Timothy Agba', ward: 'Ward I: Ikoga', age: 55, occ: 'Farmer', pu: 'PU 001 - Ikoga Zebbu Town Hall' },
      { name: 'Florence Ahissu', ward: 'Ward I: Ikoga', age: 44, occ: 'Civil Servant', pu: 'PU 002 - Ikoga Junction' },
      // Ward J: Topo-Idale
      { name: 'Benjamin Hunge', ward: 'Ward J: Topo-Idale', age: 30, occ: 'Entrepreneur', pu: 'PU 001 - Topo Coconut Farm Road' },
      { name: 'Dorcas Whegbe', ward: 'Ward J: Topo-Idale', age: 26, occ: 'Teacher', pu: 'PU 002 - Idale Primary School' },
    ];

    let vinCounter = 90001000200030;
    for (let i = 0; i < sampleVoters.length; i++) {
      const v = sampleVoters[i];
      const assignedRecruiter = createdRecruiters[i % createdRecruiters.length];
      vinCounter += i * 37 + 11;

      await Voter.create({
        fullName: v.name,
        address: `${10 + i} Community Road, Badagry, Lagos State`,
        vin: `90F9B${vinCounter}`,
        phoneNumber: `+234809${Math.floor(1000000 + Math.random() * 9000000)}`,
        age: v.age,
        occupation: v.occ,
        localGovernment: 'Badagry',
        ward: v.ward,
        pollingUnit: v.pu,
        consent: true,
        registeredBy: assignedRecruiter._id,
        recruiterCode: assignedRecruiter.recruiterCode,
        referenceCode: `BVDI-${100000 + i}`,
      });
    }

    console.log(`[Seed] Successfully seeded ${sampleVoters.length} voter records!`);
    console.log('[Seed] Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] ${error.message}`);
    process.exit(1);
  }
};

seedData();
