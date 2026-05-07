// src/utils/api.js — Service HTTP ByMap
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';

// ─── Helpers stockage token + user ───────────────────────────────────────────
export const saveSession = async (accessToken, refreshToken, user) => {
  await AsyncStorage.multiSet([
    ['accessToken',  accessToken],
    ['refreshToken', refreshToken],
    ['currentUser',  JSON.stringify(user)],
    ['userId',       String(user._id || '')],
    ['userName',     `${user.prenom || ''} ${user.nom || ''}`.trim()],
  ]);
};

export const getAccessToken  = () => AsyncStorage.getItem('accessToken');
export const getRefreshToken = () => AsyncStorage.getItem('refreshToken');

// Refreshes the access token silently; throws if refresh token is also expired.
async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('Session expirée');
  const res  = await fetch(`${API_URL}/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) { await clearSession(); throw new Error('Session expirée'); }
  await AsyncStorage.multiSet([
    ['accessToken',  data.accessToken],
    ['refreshToken', data.refreshToken],
  ]);
  return data.accessToken;
}

// Authenticated fetch that retries once after refreshing on 401.
async function authFetch(url, options = {}) {
  let token = await getAccessToken();
  const makeHeaders = (t) => ({
    ...options.headers,
    Authorization: `Bearer ${t}`,
  });

  let res = await fetch(url, { ...options, headers: makeHeaders(token) });
  if (res.status === 401) {
    token = await refreshAccessToken();
    res   = await fetch(url, { ...options, headers: makeHeaders(token) });
  }
  return res;
}

export const getCurrentUser = async () => {
  const raw = await AsyncStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
};

export const clearSession = async () => {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'currentUser', 'userId', 'userName']);
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export async function register({ nom, prenom, email, phone, password }) {
  const res  = await fetch(`${API_URL}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ nom, prenom, email, phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur inscription');
  // Pas de session ici — l'utilisateur doit d'abord vérifier son email
  return data; // { message, emailVerificationRequired, user }
}

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
export async function verifyEmail({ email, code }) {
  const res  = await fetch(`${API_URL}/auth/verify-email`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Code invalide');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
export async function resendVerification({ email }) {
  const res  = await fetch(`${API_URL}/auth/resend-verification`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur renvoi');
  return data;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login({ email, phone, password }) {
  const res  = await fetch(`${API_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, phone, password }),
  });
  const data = await res.json();

  // Cas spécial : email non vérifié
  if (res.status === 403 && data.emailVerificationRequired) {
    const err = new Error(data.message);
    err.emailVerificationRequired = true;
    err.email = data.email || email;
    throw err;
  }

  // OTP de connexion requis (credentials corrects, email envoyé)
  if (res.ok && data.loginOtpRequired) {
    const err = new Error(data.message);
    err.loginOtpRequired = true;
    err.email = data.email;
    throw err;
  }

  if (!res.ok) throw new Error(data.message || 'Erreur connexion');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/verify-login-otp ─────────────────────────────────────────
export async function verifyLoginOtp({ email, code }) {
  const res  = await fetch(`${API_URL}/auth/verify-login-otp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Code invalide');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/social ───────────────────────────────────────────────────
export async function socialLogin({ provider, token, name, email }) {
  const res  = await fetch(`${API_URL}/auth/social`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ provider, token, name, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Connexion ${provider} échouée`);
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export async function getFavorites() {
  const res  = await authFetch(`${API_URL}/favorites`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur favoris');
  return data;
}

export async function checkFavorite(zoneName) {
  const res  = await authFetch(`${API_URL}/favorites/check?zoneName=${encodeURIComponent(zoneName)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur vérification favori');
  return data.favorited;
}

export async function toggleFavorite(zoneName, lat, lng) {
  const res  = await authFetch(`${API_URL}/favorites/toggle`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ zoneName, lat, lng }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur toggle favori');
  return data.favorited;
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export async function logout() {
  const token = await getAccessToken();
  await fetch(`${API_URL}/auth/logout`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  await clearSession();
}
