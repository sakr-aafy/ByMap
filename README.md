# ByMap — Application Mobile

Réseau social de proximité pour partager des publications locales et des trajets en Tunisie.

---

## Table des matières

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Frontend](#frontend)
- [Backend](#backend)
- [Base de données](#base-de-données)
- [API Endpoints](#api-endpoints)
- [Variables d'environnement](#variables-denvironnement)
- [Installation & Lancement](#installation--lancement)

---

## Aperçu

ByMap est une application mobile React Native permettant aux utilisateurs de :

- Visualiser une **carte interactive** (globe 3D + carte 2D Leaflet) avec 6 styles
- Publier des annonces en mode **LOCAL** (point unique) ou **DUO** (trajet A→B)
- Découvrir les publications de leur zone géographique
- Gérer leur profil, avatar, paramètres
- Les admins peuvent modérer les utilisateurs et publications

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Mobile | React Native 0.76 + Expo 52 |
| Navigation | React Navigation v7 (Stack) |
| Carte | Leaflet.js (WebView) + Three.js (Globe 3D) |
| Backend | Node.js + Express |
| Base de données | MongoDB + Mongoose |
| Authentification | JWT (access + refresh token) |
| Upload médias | Multer + Cloudinary (optionnel) |
| Email | Nodemailer (Gmail SMTP) |
| Cache | AsyncStorage + mémoire (frontend) |

---

## Structure du projet

```
ByMap/
├── frontend/                   # Application React Native
│   ├── App.js                  # Navigation principale (Stack)
│   ├── index.js
│   ├── app.json
│   ├── package.json
│   ├── assets/
│   │   ├── logo.png            # Logo de l'application
│   │   └── tunisia.json        # Données géographiques (gouvernorats, délégations, localités)
│   └── src/
│       ├── environments/
│       │   ├── environment.js         # Config développement
│       │   └── environment.prod.ts    # Config production
│       ├── screens/
│       │   ├── Welcome.js             # Splash screen
│       │   ├── LoginScreen.js         # Authentification
│       │   ├── MapScreen.js           # Carte principale
│       │   ├── LocalScreen.js         # Feed publications
│       │   ├── ProfileScreen.js       # Profil utilisateur
│       │   ├── AjoutPub.js            # Créer une publication
│       │   ├── PublicationDetail.js   # Détail d'une publication
│       │   └── admin/
│       │       └── AdminDashboard.js  # Panel admin
│       └── utils/
│           ├── api.js                 # Appels HTTP + gestion session
│           └── cache.js               # Cache geocodage + recherche
│
└── backend/                    # API Node.js
    ├── server.js               # Point d'entrée
    ├── .env                    # Variables d'environnement
    ├── package.json
    └── src/
        ├── config/
        │   ├── db.js           # Connexion MongoDB
        │   └── db.config.js
        ├── models/
        │   ├── User.model.js
        │   └── Publication.model.js
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── profile.controller.js
        │   ├── publication.controller.js
        │   └── admin.controller.js
        ├── routes/
        │   ├── auth.routes.js
        │   ├── user.routes.js
        │   ├── publication.routes.js
        │   └── admin.routes.js
        ├── middleware/
        │   ├── auth.middleware.js     # JWT protect + adminOnly
        │   └── upload.middleware.js   # Multer + Cloudinary
        └── services/
            └── email.service.js       # Envoi emails OTP
```

---

## Frontend

### Navigation (App.js)

```
Stack Navigator
├── Welcome           → Splash animé (3s) → redirige vers Map
├── Map               → Carte principale
├── Login             → Connexion / Inscription
├── Local             → Feed des publications
├── Profile           → Profil utilisateur
├── AdminDashboard    → Tableau de bord admin
├── AjoutePub         → Formulaire de publication
└── PublicationDetail → Détail d'une publication
```

---

### Écrans

#### Welcome.js
- Splash screen avec logo animé et barre de progression
- Animation fade-in + LinearGradient sombre
- Redirige automatiquement vers **Map** après 3 secondes

---

#### LoginScreen.js
- Deux onglets : **Connexion** et **Inscription**
- Connexion : Email ou téléphone + mot de passe
- Inscription : Prénom, Nom, Email, Téléphone, Mot de passe, Confirmation
- Vérification email avec **code OTP 6 chiffres** (expire en 10 min)
- Renvoi du code avec countdown 60 secondes
- Validation en temps réel des champs
- Redirection admin automatique après connexion

---

#### MapScreen.js
- Globe 3D interactif (Three.js via WebView)
- Carte 2D Leaflet avec **6 styles** :
  - 🗺️ Street (OpenStreetMap)
  - 🛰️ Satellite (ESRI World Imagery)
  - ⛰️ Relief (ESRI Shaded Relief) — défaut
  - 🏔️ Topo (OpenTopoMap)
  - 🌑 Dark (CartoDB Dark)
  - 🌤️ Clair (CartoDB Light)
- Changement de style via le menu hamburger
- Joystick style Radio Garden pour déplacer la carte
- Détection automatique de la zone (gouvernorat) via Nominatim
- Bandeau nom de zone centré sous la barre de recherche
- Points verts par gouvernorat avec compteurs local/duo
- Crosshair cliquable → navigue vers LocalScreen avec la zone
- Footer navbar : Globe (actif) | Logo + badge total posts | Profil
- Menu déroulant : profil, sélecteur de style, langue, connexion/déconnexion

**États internes :**
```
mode          : 'globe' | 'map'
mapStyle      : 'street' | 'satellite' | 'relief' | 'topo' | 'dark' | 'clair'
detectedZone  : string   (gouvernorat détecté)
cityName      : string   (ville détectée)
zoneCounts    : { local: number, duo: number }
pickMode      : boolean  (mode sélection zone admin)
```

---

#### LocalScreen.js
- Feed des publications avec filtres : **Tous / LOCAL / DUO**
- Filtre LOCAL → fond vert | Filtre DUO → fond bleu
- Bouton FAB : change de couleur et pulse lors du filtrage (vert/bleu)
- **PubCard** — carte de publication :

```
┌───────────────────────────────────┐
│ [A]  Nom Prénom   📍 Ville   2h   │  ← header (avatar + auteur + lieu + temps)
│                         [LOCAL]   │  ← badge mode
├───────────────────────────────────┤
│  Description du post...           │  ← texte
├───────────────────────────────────┤
│  [         Photo 200px        ]   │  ← photo pleine largeur
├───────────────────────────────────┤
│  ❤️ 4   👁 12   🖼 3               │  ← footer stats
└───────────────────────────────────┘
```

- Pagination infinie (10 posts/page)
- Pull-to-refresh
- Menu latéral avec 7 options (Accueil, Carte, Favoris, Mes annonces, Paramètres, Aide, Déconnexion)
- Barre de tabs : 🌍 Globe | 🔍 Publics | 👤 Profil
- Normalisation automatique des URLs d'images (correction IP serveur)
- Temps relatif : "30s", "2min", "3h", "1j"

---

#### ProfileScreen.js

4 vues internes :

| Vue | Contenu |
|-----|---------|
| **Main** | Avatar, nom, email, compteurs LOCAL/DUO actifs, mes annonces |
| **Modifier profil** | Prénom, Nom, Email, Téléphone, Zone préférée, Avatar |
| **Paramètres** | Langue, notifications, localisation, mot de passe, supprimer compte |
| **Mes annonces** | Liste des publications de l'utilisateur connecté |

---

#### AjoutPub.js
- Sélection du mode : **📍 LOCAL** (fond vert) ou **🤝 DUO** (fond bleu)
- **Mode LOCAL** : description + médias + ville / gouvernorat / délégation
- **Mode DUO** : description + médias + localisation Début → Fin
- Médias :
  - 📷 Photos depuis la galerie
  - 🎬 Vidéos depuis la galerie
  - 📸 Appareil photo → choix Photo ou Vidéo avant ouverture
- Sélecteurs hiérarchiques (Gouvernorat → Délégation → Localité)
- Aperçu miniature avec suppression individuelle
- Soumission via `multipart/form-data`

---

#### PublicationDetail.js
- Carousel médias horizontal avec pagination par points
- Infos auteur + date formatée (fr-FR)
- Like / Unlike (authentification requise)
- Localisation détaillée (ville, gouvernorat, délégation)
- Compteurs : Vues, Likes, Médias

---

#### AdminDashboard.js
- Statistiques globales (utilisateurs, lieux actifs)
- Liste des catégories (8 prédéfinies)
- Tableau des utilisateurs récents avec statuts (actif / bloqué / en attente)
- Modal d'ajout de lieu (nom, adresse, catégorie, coordonnées)
- Gestion utilisateurs : voir / bloquer / supprimer

---

### Utilitaires

#### src/utils/api.js
```javascript
saveSession(data)           // Sauvegarde tokens + user dans AsyncStorage
getAccessToken()            // Récupère le JWT access token
getCurrentUser()            // Récupère l'utilisateur courant depuis AsyncStorage
clearSession()              // Vide la session (logout)
register(data)              // POST /auth/register
verifyEmail(data)           // POST /auth/verify-email  (OTP)
resendVerification(data)    // POST /auth/resend-verification
login(data)                 // POST /auth/login
logout()                    // POST /auth/logout
```

#### src/utils/cache.js
Cache à deux niveaux : **mémoire session** + **AsyncStorage persistant**

| Fonction | TTL |
|----------|-----|
| `cachedGeocode(lat, lng, fn)` | 7 jours |
| `cachedZone(lat, lng, fn)` | 7 jours |
| `cachedSearch(query, fn)` | 1 heure |

---

### Dépendances Frontend

```json
"expo": "~52.0.49",
"react-native": "0.76.9",
"react": "18.3.1",
"@react-navigation/native": "^7.1.34",
"@react-navigation/stack": "^7.8.6",
"@react-native-async-storage/async-storage": "1.23.1",
"react-native-webview": "13.12.5",
"react-native-maps": "1.18.0",
"expo-image-picker": "~16.0.6",
"expo-location": "~18.0.10",
"expo-linear-gradient": "~14.0.2",
"expo-status-bar": "~2.0.1",
"react-native-paper": "^5.13.4",
"react-native-reanimated": "~3.16.1",
"react-native-gesture-handler": "~2.20.2",
"react-native-safe-area-context": "4.12.0",
"react-native-screens": "~4.4.0",
"react-native-vector-icons": "^10.3.0",
"axios": "^1.8.4",
"@react-native-picker/picker": "2.9.0"
```

---

## Backend

### Architecture

```
server.js
├── connectDB()          → MongoDB
├── helmet()             → Sécurité HTTP headers
├── cors()               → CLIENT_URL=*
├── express.json()
├── morgan('dev')        → Logs
├── /uploads             → Fichiers statiques (dev)
├── /api/auth            → authRoutes
├── /api/users           → userRoutes
├── /api/admin           → adminRoutes
├── /api/publications    → publicationRoutes
├── /health              → GET { status: 'OK' }
├── 404 handler
└── Error handler global
```

---

### Dépendances Backend

```
express, cors, helmet, morgan
mongoose
jsonwebtoken, bcryptjs
multer, cloudinary
nodemailer
dotenv
nodemon (dev)
```

---

## Base de données

### Modèle User

```javascript
{
  nom:              String,
  prenom:           String,
  email:            String (unique),
  phone:            String (unique),
  password:         String (bcrypt),
  role:             'user' | 'admin'       (défaut: 'user'),
  isActive:         Boolean                (défaut: true),
  refreshToken:     String,

  googleId:         String,
  facebookId:       String,
  appleId:          String,

  avatarUrl:        String,
  lastLogin:        Date,
  preferredZone:    String,

  settings: {
    language:       String   (défaut: 'العربية'),
    notifications:  Boolean  (défaut: true),
    locationAccess: Boolean  (défaut: true)
  },

  isDeleted:        Boolean,
  deletedAt:        Date,

  isEmailVerified:           Boolean (défaut: false),
  emailVerificationCode:     String,
  emailVerificationExpires:  Date,

  createdAt, updatedAt       (timestamps)
}
```

---

### Modèle Publication

```javascript
{
  auteur:      ObjectId → User     (required),
  mode:        'local' | 'duo'     (required),
  description: String              (required, max 1000 chars),

  medias: [{
    url:      String,              // URL Cloudinary ou /uploads/fichier
    type:     'image' | 'video',
    publicId: String               // ID Cloudinary pour suppression
  }],                              // max 10 médias

  localisation: {                  // mode 'local'
    ville, gouvernorat, delegation
  },

  localisationDebut: { ville, gouvernorat, delegation },  // mode 'duo'
  localisationFin:   { ville, gouvernorat, delegation },  // mode 'duo'

  statut:    'active' | 'archivee' | 'supprimee'  (défaut: 'active'),
  vues:      Number   (défaut: 0),
  likes:     [ObjectId → User],
  expiresAt: Date     (défaut: now + 24h),

  nbLikes:   Number   (virtuel = likes.length),

  createdAt, updatedAt  (timestamps)
}
```

**Index MongoDB :**
```
{ auteur: 1, createdAt: -1 }
{ statut: 1, createdAt: -1 }
{ 'localisation.ville': 1 }
{ mode: 1 }
```

---

## API Endpoints

### Auth — `/api/auth`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| POST | `/register` | Inscription | ❌ |
| POST | `/verify-email` | Vérifier OTP (6 chiffres) | ❌ |
| POST | `/resend-verification` | Renvoyer le code OTP | ❌ |
| POST | `/login` | Connexion (email ou téléphone) | ❌ |
| POST | `/refresh` | Rafraîchir l'access token | ❌ |
| POST | `/logout` | Déconnexion | ✅ |

---

### Utilisateur — `/api/users`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/me` | Profil courant | ✅ |
| PUT | `/me` | Modifier profil | ✅ |
| PUT | `/me/avatar` | Changer avatar (multipart) | ✅ |
| GET | `/me/settings` | Récupérer paramètres | ✅ |
| PUT | `/me/settings` | Modifier paramètres | ✅ |
| PUT | `/me/password` | Changer mot de passe | ✅ |
| DELETE | `/me` | Supprimer compte (soft delete) | ✅ |
| GET | `/me/ads` | Mes publications | ✅ |

---

### Publications — `/api/publications`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/` | Liste paginée + filtres | ❌ |
| GET | `/mes` | Mes publications | ✅ |
| GET | `/:id` | Détail (incrémente vues) | ❌ |
| POST | `/` | Créer (multipart, max 10 médias) | ✅ |
| PUT | `/:id` | Modifier | ✅ |
| DELETE | `/:id` | Supprimer | ✅ |
| POST | `/:id/like` | Liker / Unliker | ✅ |
| POST | `/:id/renew` | Prolonger de 24h | ✅ |

**Paramètres GET `/` :**
```
?page=1&limit=10&mode=local|duo&ville=Tunis&search=mot
```

---

### Admin — `/api/admin`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/stats` | Statistiques globales | ✅ Admin |
| GET | `/users` | Liste tous les utilisateurs | ✅ Admin |
| GET | `/users/:id` | Détail utilisateur | ✅ Admin |
| PUT | `/users/:id/toggle` | Activer / Bloquer | ✅ Admin |
| DELETE | `/users/:id` | Supprimer utilisateur | ✅ Admin |

---

### Santé

```
GET /health  →  { status: 'OK', timestamp: '...' }
```

---

## Variables d'environnement

### Frontend — `src/environments/environment.js`

```javascript
export const environment = {
  production: false,
  apiUrl: 'http://192.168.12.174:5000/api',
};
```

> Modifier l'IP selon le réseau local de la machine backend.

---

### Backend — `.env`

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=*

MONGO_URI=mongodb://localhost:27017/bymap

JWT_SECRET=bymap_super_secret_change_in_production
JWT_REFRESH_SECRET=bymap_refresh_secret_change_in_production
JWT_EXPIRES=7d

ADMIN_EMAIL=admin
ADMIN_PASSWORD=admin123

SMTP_USER=bymap216@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

BASE_URL=http://192.168.12.174:5000
```

---

## Installation & Lancement

### Backend

```bash
cd backend
npm install
# Configurer .env
node server.js
# ou avec rechargement automatique :
npx nodemon server.js
```

### Frontend

```bash
cd frontend
npm install
npx expo start --clear
```

> Scanner le QR code avec **Expo Go** sur le même réseau Wi-Fi.

---

## Upload des médias

| Mode | Comportement |
|------|-------------|
| `CLOUDINARY_CLOUD_NAME` défini | Upload Cloudinary → retourne `secure_url` |
| Non défini | Stockage local `/backend/uploads/` → URL = `BASE_URL/uploads/fichier` |

- Formats : `jpeg`, `png`, `webp`, `gif`, `mp4`, `quicktime`, `avi`
- Taille max : **100 MB** par fichier
- Max : **10 fichiers** par publication

---

## Flux d'authentification

```
1. POST /auth/register
2. POST /auth/verify-email   ← code OTP 6 chiffres (expire 10 min)
3. POST /auth/login
   ← { accessToken, refreshToken, user }
4. Requêtes → Header: Authorization: Bearer <accessToken>
5. POST /auth/refresh        ← si accessToken expiré
6. POST /auth/logout         ← invalide le refreshToken
```

---

## Données géographiques

`frontend/assets/tunisia.json` — Hiérarchie complète :
```
Gouvernorat → Délégation → Localité
```

Les **24 gouvernorats** tunisiens sont inclus avec leurs coordonnées GPS
pour l'affichage des marqueurs sur la carte.

---

*ByMap v1.0.0 — 2025*
