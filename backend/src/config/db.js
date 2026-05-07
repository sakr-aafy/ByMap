const mongoose = require('mongoose');
const { MongoClient, ServerApiVersion } = require('mongodb');

const connectDB = async () => {
  const uri = `mongodb+srv://waelwbouazizi_db_user:${process.env.DB_PASSWORD}@cluster0.e0hlyy1.mongodb.net/?appName=Cluster0`;

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
    await client.close();

    await mongoose.connect(uri);
    console.log(`✅  Mongoose connecté : ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌  Erreur MongoDB :', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
