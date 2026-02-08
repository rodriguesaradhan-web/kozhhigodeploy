require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    const users = await User.find();
    console.log('\n📋 Users in Database:');
    console.log('═'.repeat(80));
    
    if (users.length === 0) {
      console.log('No users found');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name} | Email: ${user.email} | Role: ${user.role}`);
        console.log(`   Password Hash: ${user.password}`);
        console.log('');
      });
      console.log('Total users:', users.length);
    }
    
    console.log('═'.repeat(60));
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

checkUsers();
