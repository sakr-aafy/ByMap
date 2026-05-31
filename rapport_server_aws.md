# Rapport de Déploiement — ByMap Backend sur AWS EC2

**Date :** 31 Mai 2026  
**Instance :** `backend-bymap` — `i-0356762bda057dd92`  
**IP Publique :** `18.219.204.29`  
**Région :** us-east-2 (Ohio)  
**Type :** t3.micro  
**OS :** Amazon Linux 2  
**DNS Public :** `ec2-18-219-204-29.us-east-2.compute.amazonaws.com`

---

## 1. Architecture du Déploiement

```
[Mobile App - Expo Go]
        │
        │ HTTPS
        ▼
[Nginx : port 443 / 80]   ← 18.219.204.29.nip.io
        │
        │ proxy_pass
        ▼
[Node.js / Express : port 5000]
        │
        ▼
[MongoDB Atlas]
```

---

## 2. Configuration AWS Security Group

**Security Group :** `sg-03d03497fd1977357 - default`

| Règle | Type | Protocole | Port | Source |
|-------|------|-----------|------|--------|
| sgr-028c87cdc80bb5e70 | HTTP | TCP | 80 | 0.0.0.0/0 |
| sgr-043abf8ef4f7f9eb2 | HTTPS | TCP | 443 | 0.0.0.0/0 |
| sgr-02956d6d9779fc629 | SSH | TCP | 22 | 0.0.0.0/0 |
| sgr-07466a7b6c6e081ad | Tous les TCP | TCP | 0–65535 | 0.0.0.0/0 |
| sgr-05a47fe0790f4fb7a | TCP personnalisé | TCP | 5000 | 0.0.0.0/0 |

---

## 3. Connexion SSH à l'Instance

```bash
ssh -i "C:\Users\DELL\Downloads\bymap.pem" ec2-user@ec2-18-219-204-29.us-east-2.compute.amazonaws.com
```

---

## 4. Déploiement du Backend Node.js

### 4.1 Prérequis installés sur EC2

```bash
# Vérifier Node.js
node -v
npm -v
```

### 4.2 Démarrage avec PM2

```bash
cd ~/backend

# Démarrer le serveur
pm2 start server.js --name server

# Sauvegarder la liste des processus (redémarrage auto au boot)
pm2 save

# Configurer PM2 au démarrage système
pm2 startup
# Exécuter la commande générée par PM2 :
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

### 4.3 Commandes PM2 utiles

```bash
pm2 status                    # Voir l'état des processus
pm2 logs server --lines 50    # Voir les 50 dernières lignes de logs
pm2 restart server            # Redémarrer le backend
pm2 stop server               # Arrêter le backend
pm2 delete server             # Supprimer le processus PM2
```

### 4.4 Variables d'environnement (.env)

Fichier : `/home/ec2-user/backend/.env`

```env
PORT=5000
NODE_ENV=production
CLIENT_URL=*

DB_PASSWORD=IDAKRRyNg02frq6c
MONGO_ATLAS_URI=mongodb+srv://bymap216_db_user:${DB_PASSWORD}@cluster0.zga1ti8.mongodb.net/?appName=Cluster0

JWT_SECRET=bymap_super_secret_change_in_production
JWT_REFRESH_SECRET=bymap_refresh_secret_change_in_production
JWT_EXPIRES=7d

RESEND_API_KEY=re_e4wHyEC6_Adp2iaqLYdTCMoMJZ3rhDKEu

SMTP_USER=bymap216@gmail.com
SMTP_PASS=shxj pzmc jyhn xoun

BASE_URL=http://18.219.204.29:5000
```

---

## 5. Installation et Configuration Nginx

### 5.1 Installation

```bash
# Amazon Linux 2
sudo yum install nginx -y

# Démarrer et activer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

### 5.2 Configuration Reverse Proxy

Fichier : `/etc/nginx/conf.d/bymap.conf`

```bash
sudo tee /etc/nginx/conf.d/bymap.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name 18.219.204.29.nip.io;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Vérifier la syntaxe
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 6. Configuration HTTPS avec Let's Encrypt (nip.io)

> **Pourquoi nip.io ?**  
> Android 9+ bloque les requêtes HTTP non chiffrées. Let's Encrypt nécessite un nom de domaine.  
> `18.219.204.29.nip.io` est un service DNS public qui résout automatiquement vers l'IP `18.219.204.29`, permettant d'obtenir un certificat SSL sans acheter un domaine.

### 6.1 Installer Certbot

```bash
# Amazon Linux 2
sudo amazon-linux-extras install epel -y
sudo yum install -y certbot python3-certbot-nginx

# Amazon Linux 2023
sudo dnf install -y certbot python3-certbot-nginx
```

### 6.2 Obtenir le Certificat SSL

```bash
sudo certbot --nginx -d 18.219.204.29.nip.io \
  --non-interactive --agree-tos -m bymap216@gmail.com
```

### 6.3 Renouvellement automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# Le cron est automatiquement créé par certbot
# Vérification : /etc/cron.d/certbot
```

### 6.4 Vérification HTTPS

```bash
curl https://18.219.204.29.nip.io/health
# Résultat attendu : {"status":"OK","timestamp":"..."}
```

---

## 7. Tests de Validation

### 7.1 Backend direct (port 5000)

```bash
# Depuis l'EC2
curl http://localhost:5000/health
# → {"status":"OK","timestamp":"2026-05-31T00:20:12.586Z"}
```

### 7.2 Via Nginx (port 80)

```bash
curl http://18.219.204.29/health
# → {"status":"OK","timestamp":"..."}
```

### 7.3 Endpoints API

```bash
curl http://18.219.204.29/api/zones
# → {"zones":[]}

curl http://18.219.204.29/api/publications/zone-dots
# → {"zones":[]}
```

---

## 8. Configuration Frontend

### 8.1 environment.js (développement)

```js
// frontend/src/environments/environment.js
export const environment = {
  production: false,
  apiUrl: 'https://18.219.204.29.nip.io/api',
};
export const API_URL = environment.apiUrl;
```

### 8.2 environment.prod.ts (production)

```ts
// frontend/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://18.219.204.29.nip.io/api',
};
export const API_URL = environment.apiUrl;
```

### 8.3 app.json — Android HTTP (développement uniquement)

```json
"android": {
  "usesCleartextTraffic": true,
  ...
}
```

---

## 9. Bugs Identifiés et Corrigés

### Bug 1 — `ReferenceError: warning is not defined`

**Fichier :** `backend/src/controllers/publication.controller.js` ligne 144  
**Cause :** Variable `warning` utilisée mais jamais déclarée (résidu de refactoring)  
**Fix :**
```js
// Avant (cassé)
res.status(201).json({ message: 'Publication créée', publication: pub, ...(warning && { warning }) });

// Après (corrigé)
res.status(201).json({ message: 'Publication créée', publication: pub });
```

### Bug 2 — `TypeError: Network request failed`

**Cause :** Android 9+ bloque le trafic HTTP non chiffré (cleartext)  
**Fix :** Configuration HTTPS via Let's Encrypt + nip.io

### Bug 3 — PM2 vide après reboot

**Cause :** `pm2 startup` non exécuté correctement  
**Fix :** Relancer `pm2 start server.js --name server && pm2 save`

---

## 10. Résumé des URLs

| Environnement | URL |
|---|---|
| Backend direct | `http://18.219.204.29:5000` |
| Backend via Nginx (HTTP) | `http://18.219.204.29` |
| Backend via Nginx (HTTPS) | `https://18.219.204.29.nip.io` |
| API Frontend | `https://18.219.204.29.nip.io/api` |
| Health Check | `https://18.219.204.29.nip.io/health` |
| Render (backup) | `https://backend-bymap.onrender.com/api` |

---

## 11. Commandes de Monitoring

```bash
# État PM2
pm2 status

# Logs en temps réel
pm2 logs server

# État Nginx
sudo systemctl status nginx

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Utilisation mémoire/CPU
pm2 monit

# Connexions réseau actives
sudo netstat -tlnp | grep -E '80|443|5000'
```
