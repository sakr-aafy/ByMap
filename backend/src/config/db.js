const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI ||
    `mongodb+srv://bymap216_db_user:${process.env.DB_PASSWORD}@cluster0.zga1ti8.mongodb.net/bymap?retryWrites=true&w=majority&appName=Cluster0`;

  if (!uri || uri.includes('undefined')) {
    console.error('❌  MONGO_URI ou DB_PASSWORD manquant dans les variables d\'environnement');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log(`✅  Mongoose connecté : ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌  Erreur MongoDB :', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
