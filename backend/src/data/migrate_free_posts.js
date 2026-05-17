// Script de migration : ajoute 10 posts gratuits aux utilisateurs existants
// Utilisation : node src/data/migrate_free_posts.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI =
  process.env.MONGO_URI ||
  `mongodb+srv://waelwbouazizi_db_user:${process.env.DB_PASSWORD}@cluster0.e0hlyy1.mongodb.net/bymap?retryWrites=true&w=majority&appName=Cluster0`;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  // Met à jour uniquement les users sans freePostsRemaining (champ absent ou null)
  const result = await mongoose.connection
    .collection('users')
    .updateMany(
      { freePostsRemaining: { $exists: false } },
      { $set: { freePostsRemaining: 10 } }
    );

  console.log(`✅ ${result.modifiedCount} utilisateur(s) mis à jour avec 10 posts gratuits`);

  // Vérification : compter ceux qui ont encore le champ manquant
  const remaining = await mongoose.connection
    .collection('users')
    .countDocuments({ freePostsRemaining: { $exists: false } });

  if (remaining === 0) {
    console.log('✅ Tous les utilisateurs ont maintenant freePostsRemaining');
  } else {
    console.log(`⚠️  ${remaining} utilisateur(s) sans freePostsRemaining (vérifier manuellement)`);
  }

  await mongoose.disconnect();
  console.log('🔌 Déconnecté');
}

run().catch(err => {
  console.error('❌ Erreur migration :', err.message);
  process.exit(1);
});
