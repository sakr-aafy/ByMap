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
- [Modifications récentes](#modifications-récentes)

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
| Temps réel | Socket.IO |

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
│   │   └── tunisia.json        # 4868 localités avec coordonnées GPS (lat/lng)
│   └── src/
│       ├── environments/
│       │   ├── environment.js         # Config développement
│       │   └── environment.prod.ts    # Config production
│       ├── screens/
│       │   ├── Welcome.js             # Splash screen (logo + barre de chargement)
│       │   ├── LoginScreen.js         # Authentification
│       │   ├── MapScreen.js           # Carte principale
│       │   ├── LocalScreen.js         # Feed publications
│       │   ├── ProfileScreen.js       # Profil utilisateur
│       │   ├── AjoutPub.js            # Créer une publication
│       │   ├── PublicationDetail.js   # Détail d'une publication
│       │   ├── ConversationsList.js   # Liste des conversations
│       │   ├── Messages.js            # Messagerie en temps réel
│       │   ├── CallScreen.js          # Écran d'appel
│       │   └── ForgetPassword.js      # Réinitialisation mot de passe
│       ├── theme/
│       │   └── index.js               # Design tokens partagés (couleurs, ombres)
│       └── utils/
│           ├── api.js                 # Appels HTTP + gestion session
│           └── cache.js               # Cache geocodage + recherche
│
└── backend/                    # API Node.js
    ├── server.js               # Point d'entrée (Express + Socket.IO)
    ├── .env                    # Variables d'environnement
    ├── package.json
    ├── uploads/                # Médias uploadés en local
    └── src/
        ├── config/
        │   ├── db.js           # Connexion MongoDB
        │   └── db.config.js
        ├── models/
        │   ├── User.model.js
        │   ├── Publication.model.js
        │   └── Message.model.js
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── profile.controller.js
        │   ├── publication.controller.js
        │   ├── message.controller.js
        │   └── admin.controller.js
        ├── routes/
        │   ├── auth.routes.js
        │   ├── user.routes.js
        │   ├── publication.routes.js
        │   ├── message.routes.js
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
├── Welcome           → Splash (logo + barre de chargement) → redirige vers Map
├── Map               → Carte principale
├── Login             → Connexion / Inscription
├── Local             → Feed des publications
├── Profile           → Profil utilisateur
├── AdminDashboard    → Tableau de bord admin
├── AjoutePub         → Formulaire de publication
├── PublicationDetail → Détail d'une publication
├── ConversationsList → Liste des conversations
├── Messages          → Messagerie
└── ForgetPassword    → Réinitialisation mot de passe
```

---

### Écrans

#### Welcome.js
- Splash screen minimaliste : **logo centré** + **barre de chargement** uniquement
- Animation fade-in + scale du logo au démarrage
- Barre de progression dégradé vert → bleu (3 secondes)
- Redirige automatiquement vers **Map** après 3,2 secondes
- Fond gradient sombre `#0a1628 → #0f2040`

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
- **Points verts par zone** (délégation / ville / gouvernorat) avec compteurs local/duo
- Coordonnées des zones résolues depuis `tunisia.json` (hors ligne, instantané)
- **Pull-to-refresh** (glisser vers le bas depuis le haut) pour actualiser les points
- Crosshair cliquable → navigue vers LocalScreen avec la zone
- Footer navbar : Globe (actif) | Logo + badge total posts | Profil
- **Bouton Profil** : redirige vers Login si non connecté, vers Profile si connecté
- Menu déroulant : profil, sélecteur de style, langue, connexion/déconnexion

**États internes :**
```
mode          : 'globe' | 'map'
mapStyle      : 'street' | 'satellite' | 'relief' | 'topo' | 'dark' | 'clair'
detectedZone  : string   (gouvernorat détecté)
cityName      : string   (ville détectée)
zoneCounts    : { local: number, duo: number }
pickMode      : boolean  (mode sélection zone admin)
refreshingDots: boolean  (chargement points en cours)
```

---

#### LocalScreen.js
- Feed des publications avec filtres : **Tous / LOCAL / DUO**
- Filtre LOCAL → fond vert | Filtre DUO → fond bleu
- **Bouton point vert (header)** : animation bounce + ripple au clic
  - Spring scale 1 → 1,6 → 1 avec onde de propagation qui s'estompe
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

#### ConversationsList.js
- Liste des conversations actives de l'utilisateur connecté
- Temps du dernier message relatif
- Navigation vers l'écran Messages

---

#### Messages.js
- Messagerie en temps réel via **Socket.IO**
- Bulles de messages envoyés / reçus
- Envoi de texte + horodatage

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

#### src/theme/index.js
Design tokens partagés entre les écrans :
- Couleurs (`D.navy`, `D.blue`, `D.green`, …)
- Ombres (`shadow`)

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
"@react-native-picker/picker": "2.9.0",
"socket.io-client": "^4.x"
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
├── Socket.IO            → Messagerie temps réel
├── /uploads             → Fichiers statiques (dev)
├── /api/auth            → authRoutes
├── /api/users           → userRoutes
├── /api/admin           → adminRoutes
├── /api/publications    → publicationRoutes
├── /api/messages        → messageRoutes
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
socket.io
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

### Modèle Message

```javascript
{
  conversationId: String,
  expediteur:     ObjectId → User,
  destinataire:   ObjectId → User,
  contenu:        String,
  lu:             Boolean (défaut: false),
  createdAt, updatedAt (timestamps)
}
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
| GET | `/zone-dots` | Zones groupées avec compteurs local/duo | ❌ |
| GET | `/mes` | Mes publications | ✅ |
| GET | `/:id` | Détail (incrémente vues) | ❌ |
| POST | `/` | Créer (multipart, max 10 médias) | ✅ |
| PUT | `/:id` | Modifier | ✅ |
| DELETE | `/:id` | Supprimer | ✅ |
| POST | `/:id/like` | Liker / Unliker | ✅ |
| POST | `/:id/renew` | Prolonger de 24h | ✅ |

**Paramètres GET `/` :**
```
?page=1&limit=10&mode=local|duo&ville=Tunis&auteur=<id>
```

**Réponse GET `/zone-dots` :**
```json
{
  "zones": [
    { "name": "Ariana Ville", "gouvernorat": "Ariana", "local": 3, "duo": 1 },
    { "name": "Sfax", "gouvernorat": "Sfax", "local": 0, "duo": 2 }
  ]
}
```

---

### Messages — `/api/messages`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|:----:|
| GET | `/conversations` | Liste des conversations | ✅ |
| GET | `/:conversationId` | Messages d'une conversation | ✅ |
| POST | `/` | Envoyer un message | ✅ |

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
export const API_URL = 'http://192.168.x.x:5000/api';
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

BASE_URL=http://192.168.x.x:5000
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

`frontend/assets/tunisia.json` — **4868 localités** avec coordonnées GPS :

```json
{
  "Ariana": [
    { "delegation": "Ariana Ville", "localite": "Residence Kortoba", "cp": "2058", "lat": 36.8665, "lng": 10.1647 },
    ...
  ],
  "Tunis": [...],
  ...
}
```

Structure : **Gouvernorat → [ { delegation, localite, cp, lat, lng } ]**

- 24 gouvernorats
- 261 délégations
- 4868 localités
- Chaque entrée possède des coordonnées `lat` / `lng`
- Utilisé par MapScreen pour la résolution des coordonnées de zones **hors ligne** (sans appel Nominatim)

---

## Modifications récentes

### Welcome.js — Splash simplifié
- Suppression de tous les éléments décoratifs (blobs, chips, carte, boutons, textes)
- Interface réduite à : **logo centré** + **barre de chargement** uniquement
- Animation d'entrée du logo (fade + spring scale)
- Barre de progression dégradé vert → bleu sur 3 secondes

### MapScreen.js — Points de zones

**Endpoint léger `/zone-dots` :**
- Remplacement de `GET /publications?limit=500` (document complets) par `GET /publications/zone-dots`
- Réponse : zones groupées avec compteurs `local` / `duo` uniquement (pas de contenu publication)
- Gain de performance significatif (~10× moins de données transférées)

**Coordonnées depuis `tunisia.json` (hors ligne) :**
- Construction d'un index `TUNISIA_ZONE_COORDS` au chargement du module depuis `tunisia.json`
- `getZoneCoords()` est désormais **synchrone** (suppression de l'appel Nominatim)
- Ordre de résolution : exact → insensible à la casse → partiel → `GOVERNORATE_COORDS`
- Plus aucun risque de rate-limit ou d'erreur réseau pour la géocodification

**Actualisation manuelle (pull-to-refresh) :**
- Suppression du `setInterval` toutes les 2 secondes
- Remplacement par un geste **glisser vers le bas** depuis le haut de la carte
- Indicateur visuel animé (flèche ↓ + spinner `ActivityIndicator`)

**Taille des points :**
- Points de zone réduits de 16 px à 10 px dans le HTML Leaflet

**Redirection profil :**
- Bouton profil (footer navbar) : si non connecté → `Login`, si connecté → `Profile`

### LocalScreen.js — Animation point vert
- Clic sur le point vert du header : animation **bounce** (spring scale 1 → 1,6 → 1)
- Effet **ripple** : onde circulaire qui s'agrandit et disparaît en 500 ms

### Backend — `GET /api/publications/zone-dots`
- Nouvel endpoint optimisé : récupère uniquement les champs de localisation
- Agrégation serveur : retourne `{ zones: [{ name, gouvernorat, local, duo }] }`
- Priorité de nom : `delegation > ville > gouvernorat`
- Les publications **DUO** sont comptées dans **les deux zones** (début ET fin)

### Backend — `GET /api/publications` (filtre ville)
- Filtre `ville` étendu pour inclure le champ `gouvernorat` dans la recherche `$or`
- Couvre : `localisation.gouvernorat`, `localisationDebut.gouvernorat`, `localisationFin.gouvernorat`

### tunisia.json — Coordonnées GPS
- Ajout des champs `lat` et `lng` sur chacune des **4868 entrées**
- Permet la résolution de coordonnées côté frontend sans appel réseau

---

*ByMap v2.0.0 — 2026*
