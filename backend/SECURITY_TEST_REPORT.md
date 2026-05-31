# Rapport de Tests de Sécurité — ByMap Backend

| | |
|---|---|
| **Projet** | ByMap Backend API |
| **Version** | 1.0.0 |
| **Date** | 24 mai 2026 |
| **Auteur** | sakr-aafy |
| **Environnement** | Node.js / Express / MongoDB |
| **Outil de test** | Jest 30 + Supertest 7 + mongodb-memory-server 11 |
| **Commande** | `npm test` |

---

## Résumé Exécutif

| Métrique | Valeur |
|---|---|
| **Total des tests** | 84 |
| **Tests réussis** | ✅ 84 |
| **Tests échoués** | ❌ 0 |
| **Durée d'exécution** | 10,98 s |
| **Suites de tests** | 2 fichiers |
| **Couverture** | 7 types d'attaques + 5 flux OTP |

> **Résultat global : PASS — Aucune vulnérabilité détectée dans les scénarios testés.**

---

## 1. Tests de Sécurité — Middleware (`security.middleware.test.js`)

**58 tests — 58 réussis**

---

### 1.1 — Détection Scanner / Outil d'audit
*Objectif : Bloquer les requêtes émises par des outils de scan et d'audit automatisés.*

| # | User-Agent détecté | Statut attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | `sqlmap/1.7.10#stable` | 403 Forbidden | ✅ PASS | 16 ms |
| 2 | `Nikto/2.1.6` | 403 Forbidden | ✅ PASS | 16 ms |
| 3 | `nmap scripting engine` | 403 Forbidden | ✅ PASS | 11 ms |
| 4 | `nuclei/2.9.0` | 403 Forbidden | ✅ PASS | 8 ms |
| 5 | `Metasploit Framework/4.21` | 403 Forbidden | ✅ PASS | 17 ms |
| 6 | `gobuster/3.6` | 403 Forbidden | ✅ PASS | 13 ms |
| 7 | `DirBuster-1.0-RC1` | 403 Forbidden | ✅ PASS | 10 ms |
| 8 | `BurpSuite Enterprise/2023.10` | 403 Forbidden | ✅ PASS | 9 ms |
| 9 | Navigateur normal (`Mozilla/5.0`) | 200 OK | ✅ PASS | 12 ms |
| 10 | Alerte email envoyée à l'admin | Email déclenché | ✅ PASS | 12 ms |

**Mécanisme :** Regex sur le header `User-Agent`. Tout agent correspondant à une signature d'outil connu retourne immédiatement `403 Forbidden` et déclenche une notification email.

---

### 1.2 — Rate Limiting / Protection DDoS
*Objectif : Limiter à 150 requêtes par minute par adresse IP.*

| # | Scénario | Statut attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | 151 requêtes simultanées depuis la même IP | Contient 429 | ✅ PASS | 824 ms |
| 2 | 1 requête (en dessous de la limite) | 200 OK | ✅ PASS | 20 ms |
| 3 | Message d'erreur 429 (`réessayez dans 1 minute`) | Message correct | ✅ PASS | 977 ms |

**Mécanisme :** Compteur en mémoire par IP (`Map`), fenêtre glissante de 60 secondes. Au-delà de 150 req/min → `429 Too Many Requests`.

---

### 1.3 — Path Traversal
*Objectif : Bloquer les tentatives d'accès à des fichiers système via `..` dans l'URL.*

> ⚠️ **Note technique :** Ces tests utilisent des requêtes HTTP brutes (module `http` natif de Node.js) car les clients HTTP standard (ex : navigateurs, supertest) normalisent automatiquement `/../` → `/` avant l'envoi, masquant l'attaque. Un attaquant utilise des outils bas niveau qui envoient le chemin brut.

| # | Chemin testé | Description | Résultat | Durée |
|---|---|---|---|---|
| 1 | `/../etc/passwd` | Double point + slash | ✅ PASS | 25 ms |
| 2 | `/%2e%2e%2fetc%2fpasswd` | Encodage URL simple | ✅ PASS | 8 ms |
| 3 | `/test/..\\windows\\system32` | Anti-slash Windows | ✅ PASS | 10 ms |
| 4 | `/%2e%2e/etc/shadow` | Encodage mixte | ✅ PASS | 12 ms |
| 5 | `/%252e%252e%252fetc` | Double encodage (`%25` → `%`) | ✅ PASS | 10 ms |
| 6 | `/test` (chemin normal) | Doit passer | ✅ PASS | 10 ms |

**Mécanisme :** Décodage URL + regex `/\.\.[\\/]|%2e%2e[%2f%5c]/i` appliquée sur `req.originalUrl`.

---

### 1.4 — Payload Anormal (Protection taille)
*Objectif : Rejeter les requêtes dont le corps dépasse 2 Mo.*

| # | Content-Length | Résultat attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | 3 Mo | 413 Payload Too Large | ✅ PASS | 10 ms |
| 2 | 10 Mo | 413 Payload Too Large | ✅ PASS | 13 ms |
| 3 | Taille normale | 200 OK | ✅ PASS | 19 ms |

**Mécanisme :** Lecture du header `content-length` avant parsing du body. Seuil : `PAYLOAD_MAX = 2 MB`.

---

### 1.5 — Détection d'Injection
*Objectif : Identifier et bloquer les payloads malveillants dans le body et les query params.*

#### NoSQL Injection

| # | Opérateur | Payload testé | Résultat | Durée |
|---|---|---|---|---|
| 1 | `$where` | `{ search: "$where this.pass.length > 0" }` | ✅ 400 | 11 ms |
| 2 | `$ne` | `{ filter: "check $ne null" }` | ✅ 400 | 9 ms |
| 3 | `$regex` | `{ query: "pattern $regex .*admin.*" }` | ✅ 400 | 14 ms |
| 4 | `$or` | `{ input: "a $or b" }` | ✅ 400 | 11 ms |
| 5 | `$gt` | `{ condition: "age $gt 18" }` | ✅ 400 | 8 ms |
| 6 | `$ne` (query param) | `?search=$ne+null` | ✅ 400 | 12 ms |

#### SQL Injection

| # | Mot-clé | Payload testé | Résultat | Durée |
|---|---|---|---|---|
| 1 | `SELECT` | `1' OR SELECT * FROM users--` | ✅ 400 | 11 ms |
| 2 | `UNION` | `1 UNION SELECT username, password FROM users` | ✅ 400 | 6 ms |
| 3 | `DROP` | `'; DROP TABLE users; --` | ✅ 400 | 11 ms |
| 4 | `INSERT` | `'; INSERT INTO users VALUES ('hack','hack')--` | ✅ 400 | 11 ms |
| 5 | `EXEC` | `'; EXEC xp_cmdshell('dir')--` | ✅ 400 | 18 ms |

#### XSS — Cross-Site Scripting

| # | Vecteur | Payload testé | Résultat | Durée |
|---|---|---|---|---|
| 1 | `<script>` | `<script>alert(1)</script>` | ✅ 400 | 7 ms |
| 2 | `javascript:` | `javascript:alert(document.cookie)` | ✅ 400 | 10 ms |
| 3 | Handler `onerror` | `<img src=x onerror=alert(1)>` | ✅ 400 | 11 ms |
| 4 | `<iframe>` | `<iframe src="https://evil.com">` | ✅ 400 | 11 ms |
| 5 | `<svg>` | `<svg onload=alert(1)>` | ✅ 400 | 10 ms |
| 6 | Query param | `?q=<script>alert(1)</script>` (encodé) | ✅ 400 | 12 ms |

#### Command Injection

| # | Vecteur | Payload testé | Résultat | Durée |
|---|---|---|---|---|
| 1 | `;` + cat | `; cat /etc/passwd` | ✅ 400 | 8 ms |
| 2 | `\|` + whoami | `\| whoami` | ✅ 400 | 12 ms |
| 3 | `&` + ls | `& ls -la` | ✅ 400 | 11 ms |
| 4 | `\|` + bash | `\| bash -i` | ✅ 400 | 10 ms |

#### Code Injection

| # | Fonction | Payload testé | Résultat | Durée |
|---|---|---|---|---|
| 1 | `eval()` | `eval(require("child_process").execSync("id"))` | ✅ 400 | 9 ms |
| 2 | `exec()` | `exec("rm -rf /")` | ✅ 400 | 13 ms |
| 3 | `system()` | `system("reboot")` | ✅ 400 | 10 ms |
| 4 | `passthru()` | `passthru("cat /etc/shadow")` | ✅ 400 | 11 ms |

#### deepScan — Injection dans structures imbriquées

| # | Scénario | Résultat | Durée |
|---|---|---|---|
| 1 | XSS dans objet imbriqué `user.profile.bio` | ✅ 400 | 11 ms |
| 2 | Command injection dans tableau `tags[1]` | ✅ 400 | 13 ms |

**Mécanisme :** Analyse récursive des valeurs string (`deepScan`) jusqu'à 6 niveaux de profondeur, testée contre 5 regex de patterns d'attaque. Alerte email envoyée à l'admin à la première détection.

---

### 1.6 — Méthodes HTTP non autorisées
*Objectif : Rejeter les méthodes HTTP non standards.*

| # | Méthode | Comportement attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | `TRACE` | 405 Method Not Allowed | ✅ PASS | 13 ms |
| 2 | `GET` | 200 OK (autorisée) | ✅ PASS | 11 ms |
| 3 | `POST` | 200 OK (autorisée) | ✅ PASS | 12 ms |
| 4 | `PUT` | 200 OK (autorisée) | ✅ PASS | 7 ms |
| 5 | `DELETE` | 200 OK (autorisée) | ✅ PASS | 9 ms |
| 6 | `PATCH` | 200 OK (autorisée) | ✅ PASS | 9 ms |

**Mécanisme :** Liste blanche `['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD']`. Toute autre méthode → `405 Method Not Allowed`.

---

### 1.7 — Détection Brute Force
*Objectif : Détecter et alerter lors de tentatives répétées de connexion échouées.*

| # | Scénario | Comportement attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | 8 tentatives `/login` échouées (401) | Alerte email Brute Force | ✅ PASS | 65 ms |
| 2 | 8 tentatives `/forgot-password` échouées (404) | Alerte email Brute Force | ✅ PASS | 65 ms |
| 3 | Détail de l'alerte contient le nombre de tentatives | Message correct | ✅ PASS | 64 ms |

**Mécanisme :** Interception de `res.json` sur les routes auth. Compteur par IP avec fenêtre de 5 minutes (`BRUTE_WIN = 300 000 ms`). Seuil : 8 échecs → alerte fire-and-forget à `sakr.aafy@gmail.com`.

---

## 2. Tests OTP / Authentification (`auth.otp.test.js`)

**26 tests — 26 réussis**  
*Base de données isolée via `mongodb-memory-server` — aucune connexion à la DB de production.*

---

### 2.1 — Envoi OTP Inscription (`POST /api/auth/send-register-otp`)

| # | Scénario | Code attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | Email absent | 400 Bad Request | ✅ PASS | 109 ms |
| 2 | Email déjà enregistré | 409 Conflict | ✅ PASS | 403 ms |
| 3 | Envoi réussi + appel `sendOtpEmail` | 200 OK | ✅ PASS | 42 ms |
| 4 | Code OTP stocké en base (6 chiffres) | Présent en DB | ✅ PASS | 40 ms |
| 5 | Suppression du précédent OTP avant création | 1 seul OTP en DB | ✅ PASS | 65 ms |
| 6 | Expiration dans 10 minutes | TTL correct | ✅ PASS | 36 ms |

### 2.2 — Vérification OTP Inscription (`POST /api/auth/verify-register-otp`)

| # | Scénario | Code attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | Code incorrect | 400 Bad Request | ✅ PASS | 32 ms |
| 2 | Code expiré | 400 Bad Request | ✅ PASS | 33 ms |
| 3 | Code valide → email vérifié + OTP supprimé | 200 OK | ✅ PASS | 36 ms |
| 4 | Code `reset` refusé pour vérification inscription | 400 Bad Request | ✅ PASS | 28 ms |

### 2.3 — Mot de passe oublié (`POST /api/auth/forgot-password`)

| # | Scénario | Code attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | Email absent | 400 Bad Request | ✅ PASS | 18 ms |
| 2 | Email non enregistré | 404 Not Found | ✅ PASS | 24 ms |
| 3 | Envoi OTP reset + appel `sendOtpEmail` | 200 OK | ✅ PASS | 341 ms |
| 4 | OTP de type `reset` stocké en DB | Présent en DB | ✅ PASS | 333 ms |

### 2.4 — Vérification code reset (`POST /api/auth/verify-reset-code`)

| # | Scénario | Code attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | Code invalide | 400 Bad Request | ✅ PASS | 33 ms |
| 2 | Code expiré | 400 Bad Request | ✅ PASS | 29 ms |
| 3 | Code valide | 200 OK | ✅ PASS | 35 ms |

### 2.5 — Réinitialisation mot de passe (`POST /api/auth/reset-password`)

| # | Scénario | Code attendu | Résultat | Durée |
|---|---|---|---|---|
| 1 | Mot de passe < 6 caractères | 400 Bad Request | ✅ PASS | 20 ms |
| 2 | Code invalide | 400 Bad Request | ✅ PASS | 331 ms |
| 3 | Code expiré | 400 Bad Request | ✅ PASS | 325 ms |
| 4 | Réinitialisation réussie + OTP supprimé | 200 OK | ✅ PASS | 686 ms |
| 5 | Nouveau mot de passe fonctionne à la connexion | 200 OK | ✅ PASS | 1 016 ms |
| 6 | Ancien mot de passe rejeté après reset | 401 Unauthorized | ✅ PASS | 934 ms |

### 2.6 — Flux complets de bout en bout

| # | Flux | Étapes | Résultat | Durée |
|---|---|---|---|---|
| 1 | **Inscription avec OTP** | Envoi OTP → Vérification → Création compte | ✅ PASS | 369 ms |
| 2 | **Réinitialisation mot de passe** | Forgot → Verify → Reset → Login | ✅ PASS | 991 ms |

---

## 3. Synthèse par Type d'Attaque

| Type d'attaque | Tests | Réussis | Taux |
|---|---|---|---|
| Scanner / Outil d'audit | 10 | 10 | 100% |
| Rate Limit / DDoS | 3 | 3 | 100% |
| Path Traversal | 6 | 6 | 100% |
| Payload Anormal | 3 | 3 | 100% |
| NoSQL Injection | 7 | 7 | 100% |
| SQL Injection | 5 | 5 | 100% |
| XSS | 6 | 6 | 100% |
| Command Injection | 4 | 4 | 100% |
| Code Injection | 4 | 4 | 100% |
| deepScan (imbriqué) | 2 | 2 | 100% |
| Méthodes HTTP | 6 | 6 | 100% |
| Brute Force | 3 | 3 | 100% |
| **OTP Authentification** | **26** | **26** | **100%** |
| **TOTAL** | **84** | **84** | **100%** |

---

## 4. Configuration du Middleware de Sécurité

| Paramètre | Valeur |
|---|---|
| Rate limit | 150 requêtes / minute / IP |
| Fenêtre brute force | 5 minutes |
| Seuil brute force | 8 tentatives échouées |
| Taille max payload | 2 Mo |
| Cooldown alerte email | 10 minutes par (IP, type) |
| Destinataire alertes | sakr.aafy@gmail.com |
| Profondeur deepScan | 6 niveaux |
| Expiration OTP | 10 minutes (TTL MongoDB) |

---

## 5. Limitations et Observations

| Observation | Détail |
|---|---|
| **NoSQL injection via clés JSON** | `{ "password": { "$ne": "" } }` — l'opérateur est dans la clé, pas dans la valeur. `deepScan` analyse les valeurs uniquement. Ce pattern d'attaque n'est pas intercepté par le middleware actuel. |
| **Rate limit en mémoire** | Le compteur est stocké en RAM. En cas de redémarrage du serveur ou de déploiement multi-instances, le compteur est remis à zéro. Solution recommandée : Redis. |
| **Path traversal normalisé** | Les navigateurs et clients HTTP standards normalisent `/../` avant l'envoi. L'attaque requiert un client bas niveau (ex : `curl --path-as-is`, Burp Suite). |
| **Alerte email fire-and-forget** | L'alerte Brute Force est envoyée sans `await` pour ne pas bloquer la réponse. Un échec d'envoi est loggué mais n'affecte pas le flux utilisateur. |

---

*Rapport généré le 24 mai 2026 — ByMap Security Testing Suite v1.0*
