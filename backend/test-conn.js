require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('MongoDB connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection failed:');
    console.error(err);
    process.exit(1);
  });
