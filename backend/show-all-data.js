require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Ride = require('./models/Ride');
const StudentRegistration = require('./models/StudentRegistration');
const DriverApplication = require('./models/DriverApplication');

async function showAllData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLETE DATABASE STRUCTURE');
    console.log('='.repeat(80));
    
    // Show Users
    console.log('\n👥 USERS COLLECTION:');
    console.log('-'.repeat(80));
    const users = await User.find();
    if (users.length === 0) {
      console.log('  (empty)');
    } else {
      users.forEach((user, i) => {
        console.log(`\n  [${i + 1}] User Document:`);
        console.log(JSON.stringify(user.toObject(), null, 2).split('\n').map(line => '    ' + line).join('\n'));
      });
    }
    console.log(`\n  Total: ${users.length} users`);
    
    // Show Rides
    console.log('\n\n🚗 RIDES COLLECTION:');
    console.log('-'.repeat(80));
    const rides = await Ride.find().populate('driver', 'name email').populate('passengers.user', 'name email');
    if (rides.length === 0) {
      console.log('  (empty)');
    } else {
      rides.forEach((ride, i) => {
        console.log(`\n  [${i + 1}] Ride Document:`);
        console.log(JSON.stringify(ride.toObject(), null, 2).split('\n').map(line => '    ' + line).join('\n'));
      });
    }
    console.log(`\n  Total: ${rides.length} rides`);
    
    // Show Student Registrations
    console.log('\n\n📝 STUDENT REGISTRATIONS COLLECTION:');
    console.log('-'.repeat(80));
    const registrations = await StudentRegistration.find();
    if (registrations.length === 0) {
      console.log('  (empty)');
    } else {
      registrations.forEach((reg, i) => {
        console.log(`\n  [${i + 1}] Registration Document:`);
        console.log(JSON.stringify(reg.toObject(), null, 2).split('\n').map(line => '    ' + line).join('\n'));
      });
    }
    console.log(`\n  Total: ${registrations.length} pending registrations`);
    
    // Show Driver Applications
    console.log('\n\n🚙 DRIVER APPLICATIONS COLLECTION:');
    console.log('-'.repeat(80));
    const applications = await DriverApplication.find().populate('userId', 'name email');
    if (applications.length === 0) {
      console.log('  (empty)');
    } else {
      applications.forEach((app, i) => {
        console.log(`\n  [${i + 1}] Application Document:`);
        console.log(JSON.stringify(app.toObject(), null, 2).split('\n').map(line => '    ' + line).join('\n'));
      });
    }
    console.log(`\n  Total: ${applications.length} pending applications`);
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`  Users: ${users.length}`);
    console.log(`  Rides: ${rides.length}`);
    console.log(`  Pending Student Registrations: ${registrations.length}`);
    console.log(`  Pending Driver Applications: ${applications.length}`);
    console.log('='.repeat(80) + '\n');
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

showAllData();
