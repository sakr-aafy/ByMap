// src/screens/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView,
  Animated, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  login as apiLogin,
  register as apiRegister,
  verifyEmail as apiVerifyEmail,
  resendVerification as apiResend,
} from '../utils/api';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  blue:      '#1E90FF', blueDark: '#0A6FCC', blueLight: '#E8F3FF',
  grey:      '#4A4A5A', greyDark: '#1E1E2E', greyLight: '#F5F6FA',
  border:    '#E2E4EF', white: '#FFFFFF',
  red:       '#FF3B30', green: '#34C759',
  facebook:  '#1877F2', google: '#EA4335', apple: '#000000',
};

// ─── Icônes Unicode ──────────────────────────────────────────────────────────
const ICONS = {
  envelope: '✉', phone: '📞', lock: '🔒', eye: '👁',
  'eye-slash': '🙈', 'arrow-left': '←', user: '👤', shield: '🛡',
};
const Icon = ({ name, size = 16, color = C.grey, style }) => (
  <Text style={[{ fontSize: size, color }, style]}>{ICONS[name] || '?'}</Text>
);

// ─── Texte d'erreur inline ───────────────────────────────────────────────────
const ErrText = ({ msg }) =>
  msg ? <Text style={styles.errText}>{msg}</Text> : null;

// ─── InputField ─────────────────────────────────────────────────────────────
const InputField = ({
  icon, placeholder, value, onChangeText,
  keyboardType = 'default', secureTextEntry = false,
  prefix, error, maxLength,
}) => {
  const [focused, setFocused] = useState(false);
  const [hidden,  setHidden]  = useState(secureTextEntry);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? C.red : C.border, error ? C.red : C.blue],
  });

  return (
    <View style={styles.inputGroup}>
      <Animated.View style={[
        styles.inputWrap,
        { borderColor },
        error && styles.inputWrapError,
      ]}>
        {icon && (
          <View style={styles.inputIconLeft}>
            <Icon name={icon} size={15} color={error ? C.red : (focused ? C.blue : C.grey)} />
          </View>
        )}
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={styles.inputText}
          placeholder={placeholder}
          placeholderTextColor="#B0B3C6"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          secureTextEntry={hidden}
          onFocus={onFocus}
          onBlur={onBlur}
          maxLength={maxLength}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.inputIconRight}>
            <Icon name={hidden ? 'eye' : 'eye-slash'} size={15} color={C.grey} />
          </TouchableOpacity>
        )}
      </Animated.View>
      <ErrText msg={error} />
    </View>
  );
};

// ─── Bouton social ───────────────────────────────────────────────────────────
const SocialBtn = ({ label, iconName, iconColor, bgColor, textColor, onPress }) => (
  <TouchableOpacity style={[styles.socialBtn, { backgroundColor: bgColor }]} onPress={onPress} activeOpacity={0.85}>
    <Text style={[styles.socialIcon, { color: iconColor, fontWeight: '900' }]}>{iconName}</Text>
    <Text style={[styles.socialLabel, { color: textColor }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Composant principal ─────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const initTab    = route.params?.tab || 'login';

  // ── Auth state ────────────────────────────────────────────────────────────
  const [tab,      setTab]      = useState(initTab);
  const [name,     setName]     = useState('');
  const [prenom,   setPrenom]   = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);

  // ── Verification state ────────────────────────────────────────────────────
  const [step,         setStep]         = useState('auth');   // 'auth' | 'verify'
  const [pendingEmail, setPendingEmail] = useState('');
  const [digits,       setDigits]       = useState(['','','','','','']);
  const [countdown,    setCountdown]    = useState(0);
  const [verifyError,  setVerifyError]  = useState('');
  const digitRef0 = useRef(null);
  const digitRef1 = useRef(null);
  const digitRef2 = useRef(null);
  const digitRef3 = useRef(null);
  const digitRef4 = useRef(null);
  const digitRef5 = useRef(null);
  const digitRefs = [digitRef0, digitRef1, digitRef2, digitRef3, digitRef4, digitRef5];

  // ── Animations ────────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const tabIndicX = useRef(new Animated.Value(tab === 'login' ? 0 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // Countdown resend
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const switchTab = (t) => {
    setTab(t);
    setErrors({});
    Animated.spring(tabIndicX, {
      toValue: t === 'login' ? 0 : 1,
      tension: 80, friction: 12, useNativeDriver: false,
    }).start();
  };

  const indicatorLeft = tabIndicX.interpolate({
    inputRange: [0, 1], outputRange: ['2%', '50%'],
  });

  // ─── Validation ───────────────────────────────────────────────────────────
  const validateLogin = () => {
    const e = {};
    if (!email && !phone)
      e.emailOrPhone = 'Entrez votre email ou téléphone';
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      e.email = 'Format email invalide';
    if (phone && !/^\d{8}$/.test(phone))
      e.phone = 'Numéro invalide (8 chiffres)';
    if (!password)
      e.password = 'Mot de passe requis';
    return e;
  };

  const validateSignUp = () => {
    const e = {};
    if (name && name.trim().length < 2)
      e.name = 'Minimum 2 caractères';
    if (prenom && prenom.trim().length < 2)
      e.prenom = 'Minimum 2 caractères';
    if (!email)
      e.email = 'Email requis';
    else if (!/^\S+@\S+\.\S+$/.test(email))
      e.email = 'Format email invalide';
    if (phone && !/^\d{8}$/.test(phone))
      e.phone = 'Numéro invalide (8 chiffres)';
    if (!password)
      e.password = 'Mot de passe requis';
    else if (password.length < 6)
      e.password = 'Minimum 6 caractères';
    if (!confirm)
      e.confirm = 'Confirmez le mot de passe';
    else if (password !== confirm)
      e.confirm = 'Les mots de passe ne correspondent pas';
    return e;
  };

  // ─── Connexion ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const e = validateLogin();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = await apiLogin({
        email:    email || undefined,
        phone:    phone || undefined,
        password,
      });
      if (data.user?.role === 'admin') {
        navigation.replace('AdminDashboard');
      } else {
        navigation.replace('Map');
      }
    } catch (err) {
      if (err.emailVerificationRequired) {
        setPendingEmail(err.email || email);
        setDigits(['','','','','','']);
        setVerifyError('');
        setCountdown(60);
        setStep('verify');
      } else {
        setErrors({ global: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Inscription ──────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    const e = validateSignUp();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      await apiRegister({ nom: name, prenom, email, phone: phone || undefined, password });
      setPendingEmail(email);
      setDigits(['','','','','','']);
      setVerifyError('');
      setCountdown(60);
      setStep('verify');
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Vérification email ───────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < 6) {
      setVerifyError('Entrez le code à 6 chiffres');
      return;
    }
    setVerifyError('');
    setLoading(true);
    try {
      const data = await apiVerifyEmail({ email: pendingEmail, code });
      if (data.user?.role === 'admin') {
        navigation.replace('AdminDashboard');
      } else {
        navigation.replace('Map');
      }
    } catch (err) {
      setVerifyError(err.message);
      setDigits(['','','','','','']);
      digitRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      await apiResend({ email: pendingEmail });
      setCountdown(60);
      setVerifyError('');
      Alert.alert('Code envoyé', `Un nouveau code a été envoyé à ${pendingEmail}`);
    } catch (err) {
      Alert.alert('Erreur', err.message);
    }
  };

  // OTP digit input
  const handleDigit = (val, idx) => {
    const clean = val.replace(/[^0-9]/g, '').slice(-1);
    const next  = [...digits];
    next[idx]   = clean;
    setDigits(next);
    if (clean && idx < 5) digitRefs[idx + 1].current?.focus();
  };

  const handleDigitKey = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      digitRefs[idx - 1].current?.focus();
    }
  };

  const handleGoogle   = () => Alert.alert('Google', 'Connexion Google à intégrer');
  const handleFacebook = () => Linking.openURL('https://www.facebook.com/login').catch(() => {});
  const handleApple    = () => Alert.alert('Apple', 'Connexion Apple à intégrer');

  // ─── ÉCRAN VÉRIFICATION ───────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('auth')} activeOpacity={0.7}>
              <View style={styles.backCircle}>
                <Icon name="arrow-left" size={20} color={C.greyDark} style={{ top: -5 }} />
              </View>
            </TouchableOpacity>

            {/* Icon & titre */}
            <View style={styles.verifyHeader}>
              <View style={styles.verifyIconWrap}>
                <Text style={{ fontSize: 40 }}>✉️</Text>
              </View>
              <Text style={styles.verifyTitle}>Vérifiez votre email</Text>
              <Text style={styles.verifySubtitle}>
                Un code à 6 chiffres a été envoyé à{'\n'}
                <Text style={{ color: C.blue, fontWeight: '700' }}>{pendingEmail}</Text>
              </Text>
            </View>

            {/* OTP boxes */}
            <View style={styles.otpRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={digitRefs[i]}
                  style={[
                    styles.otpBox,
                    d ? styles.otpBoxFilled : null,
                    verifyError ? styles.otpBoxError : null,
                  ]}
                  value={d}
                  onChangeText={(v) => handleDigit(v, i)}
                  onKeyPress={(e) => handleDigitKey(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>

            {verifyError ? (
              <Text style={styles.verifyError}>{verifyError}</Text>
            ) : null}

            {/* Bouton vérifier */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color={C.white} />
                : <Text style={styles.primaryBtnText}>VÉRIFIER</Text>
              }
            </TouchableOpacity>

            {/* Renvoi */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Vous n'avez pas reçu le code ? </Text>
              <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
                <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                  {countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer'}
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── ÉCRAN AUTH ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View style={[styles.header, {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim.interpolate({ inputRange: [0,1], outputRange: [-20,0] }) }],
          }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <View style={styles.backCircle}>
                <Icon name="arrow-left" size={20} color={C.greyDark} style={{ top: -5 }} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Tabs */}
          <Animated.View style={[styles.tabBar, { opacity: fadeAnim }]}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('login')} activeOpacity={0.8}>
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Connexion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signup')} activeOpacity={0.8}>
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Inscription</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Erreur globale */}
          {errors.global ? (
            <View style={styles.globalErrBox}>
              <Text style={styles.globalErrText}>{errors.global}</Text>
            </View>
          ) : null}

          {/* ── Formulaire LOGIN ── */}
          {tab === 'login' && (
            <Animated.View style={[styles.form, { opacity: fadeAnim }]}>

              {errors.emailOrPhone ? (
                <View style={styles.globalErrBox}>
                  <Text style={styles.globalErrText}>{errors.emailOrPhone}</Text>
                </View>
              ) : null}

              <InputField
                icon="envelope"
                placeholder="Adresse email"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, email: '', emailOrPhone: '' })); }}
                keyboardType="email-address"
                error={errors.email}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <InputField
                icon="phone"
                placeholder="Numéro de téléphone"
                value={phone}
                onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, phone: '', emailOrPhone: '' })); }}
                keyboardType="phone-pad"
                prefix="+216  "
                error={errors.phone}
                maxLength={8}
              />

              <InputField
                icon="lock"
                placeholder="Mot de passe"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                secureTextEntry
                error={errors.password}
              />

              <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={styles.primaryBtnText}>SE CONNECTER</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Formulaire SIGNUP ── */}
          {tab === 'signup' && (
            <Animated.View style={[styles.form, { opacity: fadeAnim }]}>
              <InputField
                icon="user"
                placeholder="Nom"
                value={name}
                onChangeText={(v) => { setName(v); setErrors(p => ({ ...p, name: '' })); }}
                error={errors.name}
              />
              <InputField
                icon="user"
                placeholder="Prénom"
                value={prenom}
                onChangeText={(v) => { setPrenom(v); setErrors(p => ({ ...p, prenom: '' })); }}
                error={errors.prenom}
              />
              <InputField
                icon="envelope"
                placeholder="Adresse email"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, email: '' })); }}
                keyboardType="email-address"
                error={errors.email}
              />
              <InputField
                icon="phone"
                placeholder="Numéro de téléphone"
                value={phone}
                onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, phone: '' })); }}
                keyboardType="phone-pad"
                prefix="+216  "
                error={errors.phone}
                maxLength={8}
              />
              <InputField
                icon="lock"
                placeholder="Mot de passe (min. 6 caractères)"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                secureTextEntry
                error={errors.password}
              />
              <InputField
                icon="lock"
                placeholder="Confirmer le mot de passe"
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setErrors(p => ({ ...p, confirm: '' })); }}
                secureTextEntry
                error={errors.confirm}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={styles.primaryBtnText}>CRÉER MON COMPTE</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Séparateur social */}
          <View style={styles.socialDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Boutons sociaux */}
          <View style={styles.socialGrid}>
            <SocialBtn label="Google"   iconName="G" iconColor={C.google}   bgColor={C.white}    textColor={C.greyDark} onPress={handleGoogle} />
            <SocialBtn label="Facebook" iconName="f" iconColor={C.white}    bgColor={C.facebook} textColor={C.white}    onPress={handleFacebook} />
            <SocialBtn label="Apple"    iconName="A" iconColor={C.white}    bgColor={C.apple}    textColor={C.white}    onPress={handleApple} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.white },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  backBtn:   { marginRight: 12 },
  backCircle: {
    top: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.greyLight, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  // Tabs
  tabBar: {
    top: 20, flexDirection: 'row', backgroundColor: C.greyLight,
    borderRadius: 14, padding: 4, marginBottom: 28,
    position: 'relative', overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4, width: '48%',
    backgroundColor: C.blue, borderRadius: 11,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  tabBtn:        { flex: 1, paddingVertical: 12, alignItems: 'center', zIndex: 2 },
  tabText:       { fontSize: 14, fontWeight: '700', color: C.grey },
  tabTextActive: { color: C.white },

  // Form
  form: { gap: 12, marginBottom: 8 },

  // Input group
  inputGroup: { gap: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.greyLight,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 2, minHeight: 52,
  },
  inputWrapError: { backgroundColor: '#FFF5F5' },
  inputIconLeft:  { marginRight: 10 },
  inputIconRight: { marginLeft: 8, padding: 4 },
  inputPrefix:    { fontSize: 14, color: C.blue, fontWeight: '700', marginRight: 4 },
  inputText:      { flex: 1, fontSize: 15, color: C.greyDark, paddingVertical: 12 },
  errText:        { fontSize: 12, color: C.red, marginLeft: 4, marginTop: 2 },

  // Global error
  globalErrBox: {
    backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  globalErrText: { fontSize: 13, color: C.red, fontWeight: '500' },

  // Dividers
  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  socialDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 16 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:   { fontSize: 13, color: '#B0B3C6', fontWeight: '500' },

  // Forgot
  forgotBtn:  { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: C.blue, fontWeight: '600' },

  // Primary button
  primaryBtn: {
    backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },

  // Social
  socialGrid: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 4,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  socialIcon:  { fontSize: 20, fontWeight: '900' },
  socialLabel: { fontSize: 11, fontWeight: '600' },

  // ── Vérification email ────────────────────────────────────────────────────
  verifyHeader: { alignItems: 'center', marginTop: 60, marginBottom: 40 },
  verifyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.blueLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  verifyTitle: {
    fontSize: 22, fontWeight: '800', color: C.greyDark,
    marginBottom: 10, letterSpacing: -0.3,
  },
  verifySubtitle: {
    fontSize: 14, color: C.grey, textAlign: 'center', lineHeight: 22,
  },

  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  otpBox: {
    width: 46, height: 58, borderRadius: 12,
    borderWidth: 2, borderColor: C.border,
    backgroundColor: C.greyLight, fontSize: 24, fontWeight: '700',
    color: C.greyDark, textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: C.blue, backgroundColor: C.blueLight,
  },
  otpBoxError: { borderColor: C.red, backgroundColor: '#FFF5F5' },

  verifyError: {
    fontSize: 13, color: C.red, textAlign: 'center',
    marginBottom: 12, fontWeight: '500',
  },

  // Resend
  resendRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  resendLabel:   { fontSize: 13, color: C.grey },
  resendLink:    { fontSize: 13, color: C.blue, fontWeight: '700' },
  resendDisabled:{ color: '#B0B3C6' },
});
