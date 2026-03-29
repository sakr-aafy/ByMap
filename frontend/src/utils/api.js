// src/utils/api.js — Service HTTP ByMap
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';

// ─── Helpers stockage token + user ───────────────────────────────────────────
export const saveSession = async (accessToken, refreshToken, user) => {
  await AsyncStorage.multiSet([
    ['accessToken',  accessToken],
    ['refreshToken', refreshToken],
    ['currentUser',  JSON.stringify(user)],
  ]);
};

export const getAccessToken = () => AsyncStorage.getItem('accessToken');

export const getCurrentUser = async () => {
  const raw = await AsyncStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
};

export const clearSession = async () => {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'currentUser']);
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

  if (!res.ok) throw new Error(data.message || 'Erreur connexion');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
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
