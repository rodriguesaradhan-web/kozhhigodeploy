require('dotenv').config();
const mongoose = require('mongoose');

async function list() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:');
    dbs.databases.forEach(d => console.log(' -', d.name));

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in current DB (%s):', db.databaseName);
    collections.forEach(c => console.log(' -', c.name));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error listing DBs/collections:');
    console.error(err);
    process.exitCode = 1;
  }
}

list();
