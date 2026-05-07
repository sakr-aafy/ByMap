// src/screens/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  Animated, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  login as apiLogin,
  register as apiRegister,
  verifyEmail as apiVerifyEmail,
  resendVerification as apiResend,
  verifyLoginOtp as apiVerifyLoginOtp,
  socialLogin as apiSocialLogin,
} from '../utils/api';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  FACEBOOK_APP_ID,
} from '../config/oauth';
import { useCall } from '../context/CallContext';
import { useTranslation } from 'react-i18next';

// Nécessaire pour que le redirect OAuth fonctionne dans Expo Go
WebBrowser.maybeCompleteAuthSession();

// ─── Palette mint clair ──────────────────────────────────────────────────────
const C = {
  green:     '#2DBD7E', greenDark: '#22A06B', greenLight: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6', blueLight: 'rgba(59,126,246,0.10)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  red:       '#EF4444',
  facebook:  '#1877F2', google: '#EA4335', apple: '#000000',
};

// ─── Texte d'erreur inline ───────────────────────────────────────────────────
const ErrText = ({ msg }) =>
  msg ? <Text style={styles.errText}>{msg}</Text> : null;

// ─── InputField ─────────────────────────────────────────────────────────────
const InputField = ({
  iconName, placeholder, value, onChangeText,
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
    outputRange: [error ? C.red : C.border, error ? C.red : C.green],
  });

  return (
    <View style={styles.inputGroup}>
      <Animated.View style={[
        styles.inputWrap,
        { borderColor },
        error && styles.inputWrapError,
      ]}>
        {iconName && (
          <View style={styles.inputIconLeft}>
            <FontAwesome6
              name={iconName}
              size={14}
              color={error ? C.red : (focused ? C.green : C.textFaint)}
            />
          </View>
        )}
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={styles.inputText}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
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
            <FontAwesome6
              name={hidden ? 'eye' : 'eye-slash'}
              size={14}
              color={C.textFaint}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      <ErrText msg={error} />
    </View>
  );
};

// ─── Bouton social ───────────────────────────────────────────────────────────
const SocialBtn = ({ label, faIcon, iconColor, onPress }) => (
  <TouchableOpacity style={styles.socialBtn} onPress={onPress} activeOpacity={0.85}>
    <FontAwesome6 name={faIcon} size={18} color={iconColor} />
    <Text style={styles.socialLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Composant principal ─────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { connect }  = useCall();
  const { t }        = useTranslation();
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
  const [step,         setStep]         = useState('auth');
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
      e.emailOrPhone = t('login.errEmailPhone');
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      e.email = t('login.errEmailFormat');
    if (phone && !/^\d{8}$/.test(phone))
      e.phone = t('login.errPhone');
    if (!password)
      e.password = t('login.errPassword');
    return e;
  };

  const validateSignUp = () => {
    const e = {};
    if (name && name.trim().length < 2)
      e.name = t('login.errMin2');
    if (prenom && prenom.trim().length < 2)
      e.prenom = t('login.errMin2');
    if (!email)
      e.email = t('login.errEmailRequired');
    else if (!/^\S+@\S+\.\S+$/.test(email))
      e.email = t('login.errEmailFormat');
    if (phone && !/^\d{8}$/.test(phone))
      e.phone = t('login.errPhone');
    if (!password)
      e.password = t('login.errPassword');
    else if (password.length < 6)
      e.password = t('login.errMin6');
    if (!confirm)
      e.confirm = t('login.errConfirmPassword');
    else if (password !== confirm)
      e.confirm = t('login.errPasswordMatch');
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
      await connect();
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
      } else if (err.loginOtpRequired) {
        setPendingEmail(err.email);
        setDigits(['','','','','','']);
        setVerifyError('');
        setCountdown(60);
        setStep('loginOtp');
      } else {
        setErrors({ global: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Vérification OTP connexion ───────────────────────────────────────────
  const handleVerifyLoginOtp = async () => {
    const code = digits.join('');
    if (code.length < 6) { setVerifyError(t('login.errCode')); return; }
    setVerifyError('');
    setLoading(true);
    try {
      const data = await apiVerifyLoginOtp({ email: pendingEmail, code });
      await connect();
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

  const handleResendLoginOtp = async () => {
    if (countdown > 0) return;
    try {
      await apiLogin({ email: pendingEmail, password });
      setCountdown(60);
      setDigits(['','','','','','']);
      setVerifyError('');
    } catch {
      // silencieux
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
      setVerifyError(t('login.errCode'));
      return;
    }
    setVerifyError('');
    setLoading(true);
    try {
      const data = await apiVerifyEmail({ email: pendingEmail, code });
      await connect();
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

  // ─── Social login hooks ───────────────────────────────────────────────────
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });
  const [, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const token = googleResponse.authentication?.id_token || googleResponse.authentication?.access_token;
      setLoading(true);
      apiSocialLogin({ provider: 'google', token })
        .then(async () => { await connect(); navigation.replace('Map'); })
        .catch(err => Alert.alert('Erreur Google', err.message))
        .finally(() => setLoading(false));
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const token = fbResponse.authentication?.access_token;
      setLoading(true);
      apiSocialLogin({ provider: 'facebook', token })
        .then(async () => { await connect(); navigation.replace('Map'); })
        .catch(err => Alert.alert('Erreur Facebook', err.message))
        .finally(() => setLoading(false));
    }
  }, [fbResponse]);

  const handleGoogle   = () => googlePromptAsync();
  const handleFacebook = () => fbPromptAsync();
  const handleApple    = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      setLoading(true);
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean).join(' ');
      await apiSocialLogin({
        provider: 'apple',
        token:    credential.identityToken,
        name,
        email:    credential.email,
      });
      await connect();
      navigation.replace('Map');
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Erreur Apple', 'Connexion Apple échouée.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── ÉCRAN VÉRIFICATION ───────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              {/* Back */}
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('auth')} activeOpacity={0.7}>
                <View style={styles.backCircle}>
                  <FontAwesome6 name="arrow-left" size={16} color={C.text} />
                </View>
              </TouchableOpacity>

              {/* Icon & titre */}
              <View style={styles.verifyHeader}>
                <View style={styles.verifyIconWrap}>
                  <FontAwesome6 name="envelope" size={34} color={C.green} />
                </View>
                <Text style={styles.verifyTitle}>{t('login.verifyEmail')}</Text>
                <Text style={styles.verifySubtitle}>
                  {t('login.codeSentTo')}{'\n'}
                  <Text style={{ color: C.green, fontWeight: '700' }}>{pendingEmail}</Text>
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
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>{t('login.verifyBtn')}</Text>
                }
              </TouchableOpacity>

              {/* Renvoi */}
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>{t('login.noCode')} </Text>
                <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
                  <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0 ? t('login.resendIn', { countdown }) : t('login.resend')}
                  </Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ─── ÉCRAN OTP CONNEXION ─────────────────────────────────────────────────
  if (step === 'loginOtp') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('auth')} activeOpacity={0.7}>
                <View style={styles.backCircle}>
                  <FontAwesome6 name="arrow-left" size={16} color={C.text} />
                </View>
              </TouchableOpacity>

              <View style={styles.verifyHeader}>
                <View style={styles.verifyIconWrap}>
                  <FontAwesome6 name="lock" size={34} color={C.green} />
                </View>
                <Text style={styles.verifyTitle}>{t('login.loginVerification')}</Text>
                <Text style={styles.verifySubtitle}>
                  {t('login.codeSentTo')}{'\n'}
                  <Text style={{ color: C.green, fontWeight: '700' }}>{pendingEmail}</Text>
                </Text>
              </View>

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

              {verifyError ? <Text style={styles.verifyError}>{verifyError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleVerifyLoginOtp}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>{t('login.confirmLogin')}</Text>
                }
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>{t('login.codeNotReceived')} </Text>
                <TouchableOpacity onPress={handleResendLoginOtp} disabled={countdown > 0}>
                  <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0 ? t('login.resendIn', { countdown }) : t('login.resend')}
                  </Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ─── ÉCRAN AUTH ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Blobs décoratifs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.blobTopRight} />
        <View style={styles.blobBottomLeft} />
      </View>

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
                  <FontAwesome6 name="arrow-left" size={16} color={C.text} />
                </View>
              </TouchableOpacity>
              <View style={styles.brandRow}>
                <FontAwesome6 name="location-dot" size={22} color={C.green} />
                <Text style={styles.brandName}>ByMap</Text>
              </View>
            </Animated.View>

            {/* Tabs */}
            <Animated.View style={[styles.tabBar, { opacity: fadeAnim }]}>
              <Animated.View style={[styles.tabIndicatorWrapper, { left: indicatorLeft }]}>
                <View style={styles.tabIndicator} />
              </Animated.View>
              <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('login')} activeOpacity={0.8}>
                <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>{t('login.tabLogin')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signup')} activeOpacity={0.8}>
                <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>{t('login.tabRegister')}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Erreur globale */}
            {errors.global ? (
              <View style={styles.globalErrBox}>
                <FontAwesome6 name="circle-exclamation" size={14} color={C.red} style={{ marginRight: 6 }} />
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
                  iconName="envelope"
                  placeholder={t('login.email')}
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
                  iconName="phone"
                  placeholder={t('login.phone')}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, phone: '', emailOrPhone: '' })); }}
                  keyboardType="phone-pad"
                  prefix="+216  "
                  error={errors.phone}
                  maxLength={8}
                />

                <InputField
                  iconName="lock"
                  placeholder={t('login.password')}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                  secureTextEntry
                  error={errors.password}
                />

                <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7} onPress={() => navigation.navigate('ForgetPassword')}>
                  <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>{t('login.loginBtn')}</Text>
                  }
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── Formulaire SIGNUP ── */}
            {tab === 'signup' && (
              <Animated.View style={[styles.form, { opacity: fadeAnim }]}>
                <InputField
                  iconName="user"
                  placeholder={t('login.lastName')}
                  value={name}
                  onChangeText={(v) => { setName(v); setErrors(p => ({ ...p, name: '' })); }}
                  error={errors.name}
                />
                <InputField
                  iconName="user"
                  placeholder={t('login.firstName')}
                  value={prenom}
                  onChangeText={(v) => { setPrenom(v); setErrors(p => ({ ...p, prenom: '' })); }}
                  error={errors.prenom}
                />
                <InputField
                  iconName="envelope"
                  placeholder={t('login.email')}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, email: '' })); }}
                  keyboardType="email-address"
                  error={errors.email}
                />
                <InputField
                  iconName="phone"
                  placeholder={t('login.phone')}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, phone: '' })); }}
                  keyboardType="phone-pad"
                  prefix="+216  "
                  error={errors.phone}
                  maxLength={8}
                />
                <InputField
                  iconName="lock"
                  placeholder={t('login.passwordMin')}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                  secureTextEntry
                  error={errors.password}
                />
                <InputField
                  iconName="lock"
                  placeholder={t('login.confirmPassword')}
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
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>{t('login.registerBtn')}</Text>
                  }
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Séparateur social */}
            <View style={styles.socialDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('login.continueWith')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Boutons sociaux */}
            <View style={styles.socialGrid}>
              <SocialBtn label="Google"   faIcon="google"    iconColor={C.google}   onPress={handleGoogle} />
              <SocialBtn label="Facebook" faIcon="facebook"  iconColor={C.facebook} onPress={handleFacebook} />
              <SocialBtn label="Apple"    faIcon="apple"     iconColor={C.apple}    onPress={handleApple} />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles — thème clair mint ────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: 'transparent' },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },

  // Background blobs
  blobTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 999,
    backgroundColor: 'rgba(45,189,126,0.12)',
  },
  blobBottomLeft: {
    position: 'absolute', bottom: -60, left: -70,
    width: 240, height: 240, borderRadius: 999,
    backgroundColor: 'rgba(59,126,246,0.08)',
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 12 },
  backBtn: {},
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandName: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 4, marginBottom: 24,
    borderWidth: 1, borderColor: '#E5E7EB',
    position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tabIndicatorWrapper: {
    position: 'absolute', top: 4, bottom: 4, width: '48%', borderRadius: 13, overflow: 'hidden',
  },
  tabIndicator: {
    flex: 1, borderRadius: 13,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  tabBtn:        { flex: 1, paddingVertical: 12, alignItems: 'center', zIndex: 2 },
  tabText:       { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  tabTextActive: { color: '#FFFFFF' },

  // Form
  form: { gap: 12, marginBottom: 8 },

  // Input group
  inputGroup: { gap: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB',
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 2, minHeight: 52,
  },
  inputWrapError: { backgroundColor: 'rgba(239,68,68,0.06)' },
  inputIconLeft:  { marginRight: 10 },
  inputIconRight: { marginLeft: 8, padding: 4 },
  inputPrefix:    { fontSize: 14, color: '#2DBD7E', fontWeight: '700', marginRight: 4 },
  inputText:      { flex: 1, fontSize: 15, color: '#1A1A2E', paddingVertical: 12 },
  errText:        { fontSize: 12, color: '#EF4444', marginLeft: 4, marginTop: 2 },

  // Global error
  globalErrBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)',
  },
  globalErrText: { fontSize: 13, color: '#EF4444', fontWeight: '500', flex: 1 },

  // Dividers
  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  socialDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 16 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText:   { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Forgot
  forgotBtn:  { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: '#2DBD7E', fontWeight: '600' },

  // Primary button
  primaryBtn: {
    borderRadius: 14, paddingVertical: 16, marginTop: 8,
    alignItems: 'center', backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },

  // Social
  socialGrid: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  socialLabel: { fontSize: 11, fontWeight: '600', color: '#4B5563' },

  // ── Vérification email ────────────────────────────────────────────────────
  verifyHeader: { alignItems: 'center', marginTop: 60, marginBottom: 40 },
  verifyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(45,189,126,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  verifyTitle: {
    fontSize: 22, fontWeight: '800', color: '#1A1A2E',
    marginBottom: 10, letterSpacing: -0.3,
  },
  verifySubtitle: {
    fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22,
  },

  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  otpBox: {
    width: 46, height: 58, borderRadius: 14,
    borderWidth: 2, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF', fontSize: 22, fontWeight: '800',
    color: '#1A1A2E', textAlign: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#2DBD7E', backgroundColor: 'rgba(45,189,126,0.08)',
  },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.06)' },

  verifyError: {
    fontSize: 13, color: '#EF4444', textAlign: 'center',
    marginBottom: 12, fontWeight: '500',
  },

  // Resend
  resendRow:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  resendLabel:    { fontSize: 13, color: '#9CA3AF' },
  resendLink:     { fontSize: 13, color: '#2DBD7E', fontWeight: '700' },
  resendDisabled: { color: '#D1D5DB' },
});
