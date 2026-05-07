# ByMap — Backend Node.js / MongoDB

## Structure du projet

```
bymap-backend/
├── server.js                        ← Point d'entrée (npm start)
├── package.json
├── .env.example                     ← Copier en .env
└── src/
    ├── models/
    │   └── User.model.js            ← Schéma Mongoose utilisateur
    ├── controllers/
    │   ├── auth.controller.js       ← register / login / refresh / logout
    │   ├── user.controller.js       ← profil / mot de passe
    │   └── admin.controller.js      ← gestion utilisateurs (admin)
    ├── routes/
    │   ├── auth.routes.js
    │   ├── user.routes.js
    │   └── admin.routes.js
    └── middleware/
        └── auth.middleware.js       ← protect (JWT) + adminOnly
```

---

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec votre URI MongoDB et vos secrets JWT

# 3. Lancer en développement (nodemon)
npm run dev

# 4. Lancer en production
npm start
```

---

## Endpoints API

### Auth  `POST /api/auth/...`

| Méthode | Route              | Corps                                | Auth  |
|---------|--------------------|--------------------------------------|-------|
| POST    | `/register`        | `{ nom, prenom, email, phone, password }` | ✗ |
| POST    | `/login`           | `{ email?, phone?, password }`       | ✗     |
| POST    | `/refresh`         | `{ refreshToken }`                   | ✗     |
| POST    | `/logout`          | —                                    | ✅ JWT |

### Utilisateur  `/api/users/...`  *(JWT requis)*

| Méthode | Route         | Description              |
|---------|---------------|--------------------------|
| GET     | `/`           | Mon profil               |
| PUT     | `/`           | Mettre à jour le profil  |
| PUT     | `/password`   | Changer le mot de passe  |

### Admin  `/api/admin/...`  *(JWT + rôle admin)*

| Méthode | Route                    | Description                |
|---------|--------------------------|----------------------------|
| GET     | `/stats`                 | Statistiques utilisateurs  |
| GET     | `/users`                 | Liste paginée              |
| GET     | `/users/:id`             | Détail d'un utilisateur    |
| PUT     | `/users/:id/toggle`      | Activer / désactiver       |
| DELETE  | `/users/:id`             | Supprimer                  |

---

## Intégration avec LoginScreen.js (React Native)

Remplacer les fonctions `handleLogin` et `handleSignUp` :

```js
// handleLogin
const res = await fetch('http://YOUR_IP:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, phone, password }),
});
const data = await res.json();
if (!res.ok) { Alert.alert('Erreur', data.message); return; }

// Stocker le token (AsyncStorage ou SecureStore)
await AsyncStorage.setItem('token', data.accessToken);

data.user.role === 'admin'
  ? navigation.replace('AdminDashboard')
  : navigation.replace('Map');

// handleSignUp
const res = await fetch('http://YOUR_IP:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nom: name, prenom, email, phone, password }),
});
const data = await res.json();
if (!res.ok) { Alert.alert('Erreur', data.message); return; }
await AsyncStorage.setItem('token', data.accessToken);
navigation.replace('Map');
```

---

## Variables d'environnement (.env)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/bymap
JWT_SECRET=change_this_in_production
JWT_REFRESH_SECRET=change_this_too
JWT_EXPIRES=7d
ADMIN_EMAIL=admin
ADMIN_PASSWORD=admin123
```
