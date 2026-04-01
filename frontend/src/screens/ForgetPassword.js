// src/screens/ForgetPassword.js
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../environments/environment';
import { D, G, shadow, DarkBackground, GlassView } from '../theme/index';

// ── Alias palette ─────────────────────────────────────────────────────────────
const C = {
  blue:      D.blue,
  blueLight: D.blueGlow,
  white:     D.white,
  red:       D.red,
  green:     D.green,
  greyLight: D.textFaint,
};

// ── Champ de saisie ───────────────────────────────────────────────────────────
function Field({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, error }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.field, error && styles.fieldError]}>
        <Text style={styles.fieldIcon}>{icon}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={D.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow(s => !s)}>
            <Text style={styles.fieldIcon}>{show ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Code à 6 chiffres ─────────────────────────────────────────────────────────
function CodeInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, v) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[i]     = clean;
    onChange(next.join(''));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleBackspace = (i, v) => {
    if (!v && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      onChange(next.join(''));
      inputs.current[i - 1]?.focus();
    }
  };

  return (
    <View style={styles.codeRow}>
      {Array.from({ length: 6 }).map((_, i) => (
        <TextInput
          key={i}
          ref={r => { inputs.current[i] = r; }}
          style={[styles.codeBox, digits[i] && styles.codeBoxFilled]}
          value={digits[i] || ''}
          onChangeText={v => handleKey(i, v)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace') handleBackspace(i, digits[i]);
          }}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ForgetPassword() {
  const navigation = useNavigation();

  const [step,        setStep]        = useState('email');
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [countdown,   setCountdown]   = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email.trim()) { setError('Veuillez saisir votre email.'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      fadeAnim.setValue(0); setStep('code'); setCountdown(60);
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    finally  { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCountdown(60); setCode('');
    } finally { setLoading(false); }
  };

  const handleVerifyCode = () => {
    if (code.length < 6) { setError('Entrez les 6 chiffres du code.'); return; }
    setError(''); fadeAnim.setValue(0); setStep('password');
  };

  const handleReset = async () => {
    if (newPassword.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (newPassword !== confirm)  { setError('Les mots de passe ne correspondent pas.'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      fadeAnim.setValue(0); setStep('success');
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    finally  { setLoading(false); }
  };

  const meta = {
    email:    { title: 'Mot de passe oublié ?', sub: 'Entrez votre email pour recevoir un code de réinitialisation.', icon: '🔑' },
    code:     { title: 'Vérification',          sub: `Code envoyé à ${email}`,                                         icon: '📧' },
    password: { title: 'Nouveau mot de passe',  sub: 'Choisissez un mot de passe sécurisé.',                           icon: '🔒' },
    success:  { title: 'Mot de passe modifié !', sub: 'Vous pouvez maintenant vous connecter.',                        icon: '✅' },
  }[step];

  return (
    <DarkBackground style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

              {/* Icône */}
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>{meta.icon}</Text>
              </View>

              <Text style={styles.title}>{meta.title}</Text>
              <Text style={styles.subtitle}>{meta.sub}</Text>

              {/* Étape 1 — Email */}
              {step === 'email' && (
                <View style={styles.form}>
                  <Field
                    icon="✉"
                    placeholder="votre@email.com"
                    value={email}
                    onChangeText={v => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    error={error}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleSendCode} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>Envoyer le code</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Étape 2 — Code */}
              {step === 'code' && (
                <View style={styles.form}>
                  <CodeInput value={code} onChange={v => { setCode(v); setError(''); }} />
                  {error ? <Text style={[styles.errorText, { textAlign: 'center' }]}>{error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleVerifyCode} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>Vérifier le code</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResend} disabled={countdown > 0} activeOpacity={0.7}>
                    <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                      {countdown > 0 ? `Renvoyer le code dans ${countdown}s` : 'Renvoyer le code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Étape 3 — Nouveau mot de passe */}
              {step === 'password' && (
                <View style={styles.form}>
                  <Field icon="🔒" placeholder="Nouveau mot de passe"   value={newPassword} onChangeText={v => { setNewPassword(v); setError(''); }} secureTextEntry />
                  <Field icon="🔒" placeholder="Confirmer le mot de passe" value={confirm}  onChangeText={v => { setConfirm(v);    setError(''); }} secureTextEntry error={error} />
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleReset} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>Réinitialiser</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Succès */}
              {step === 'success' && (
                <View style={styles.form}>
                  <TouchableOpacity style={styles.primaryBtnWrap} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      <Text style={styles.primaryBtnText}>Se connecter</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },

  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: D.white, fontWeight: '700' },

  card: {
    backgroundColor: D.glassMid,
    borderRadius: 24, padding: 28, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: D.glassBorder,
    ...shadow.soft,
  },

  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: D.blueGlow,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    ...shadow.blue,
  },
  iconText: { fontSize: 34 },
  title:    { fontSize: 22, fontWeight: '800', color: D.white, textAlign: 'center' },
  subtitle: { fontSize: 13, color: D.textDim, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  form: { width: '100%', gap: 14 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.glassInput, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: D.glassBorder,
  },
  fieldError: { borderColor: D.red },
  fieldIcon:  { fontSize: 16 },
  fieldInput: { flex: 1, fontSize: 14, color: D.white },
  errorText:  { fontSize: 12, color: D.red, marginLeft: 4 },

  codeRow:      { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeBox: {
    flex: 1, height: 56, borderRadius: 12,
    backgroundColor: D.glassInput, borderWidth: 1.5, borderColor: D.glassBorder,
    fontSize: 22, fontWeight: '800', color: D.white,
  },
  codeBoxFilled: { borderColor: D.blue, backgroundColor: D.blueGlow },

  primaryBtnWrap: { borderRadius: 14, overflow: 'hidden', ...shadow.blue },
  primaryBtn:     { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: D.white, fontSize: 15, fontWeight: '800' },

  resendText:     { textAlign: 'center', fontSize: 13, color: D.blue, fontWeight: '600' },
  resendDisabled: { color: D.textFaint },
});