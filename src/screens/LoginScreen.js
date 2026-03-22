// src/screens/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Image,
  Animated,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// ─── Couleurs extraites du logo ByMap ───────────────────────────────────────
const C = {
  blue:       '#1E90FF',
  blueDark:   '#0A6FCC',
  blueLight:  '#E8F3FF',
  grey:       '#4A4A5A',
  greyDark:   '#1E1E2E',
  greyLight:  '#F5F6FA',
  border:     '#E2E4EF',
  white:      '#FFFFFF',
  red:        '#FF3B30',
  green:      '#34C759',
  facebook:   '#1877F2',
  google:     '#EA4335',
  apple:      '#000000',
};

// ─── FontAwesome via CDN — on utilise Unicode directement ──────────────────
// Icônes en Text UTF-8 (compatibles sans lib native)
const Icon = ({ name, size = 16, color = C.grey, style }) => {
  const icons = {
    'envelope':       '✉',
    'phone':          '📞',
    'lock':           '🔒',
    'eye':            '👁',
    'eye-slash':      '🙈',
    'arrow-left':     '←',
    'google':         'G',
    'apple':          '',
    'facebook':       'f',
    'map-marker':     '📍',
    'check-circle':   '✓',
    'times-circle':   '✗',
    'user':           '👤',
    'flag':           '🏳',
  };
  return (
    <Text style={[{ fontSize: size, color }, style]}>
      {icons[name] || '?'}
    </Text>
  );
};

// ─── Composant Input stylisé ────────────────────────────────────────────────
const InputField = ({
  icon, placeholder, value, onChangeText,
  keyboardType = 'default', secureTextEntry = false,
  prefix, suffix,
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
    inputRange: [0, 1], outputRange: [C.border, C.blue],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      {icon && (
        <View style={styles.inputIconLeft}>
          <Icon name={icon} size={15} color={focused ? C.blue : C.grey} />
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
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.inputIconRight}>
          <Icon name={hidden ? 'eye' : 'eye-slash'} size={15} color={C.grey} />
        </TouchableOpacity>
      )}
      {suffix}
    </Animated.View>
  );
};

// ─── Bouton social ──────────────────────────────────────────────────────────
const SocialBtn = ({ label, iconName, iconColor, bgColor, textColor, onPress }) => (
  <TouchableOpacity style={[styles.socialBtn, { backgroundColor: bgColor }]} onPress={onPress} activeOpacity={0.85}>
    <Text style={[styles.socialIcon, { color: iconColor, fontWeight: '900' }]}>{iconName}</Text>
    <Text style={[styles.socialLabel, { color: textColor }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Composant principal ────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const initTab    = route.params?.tab || 'login';

  const [tab,      setTab]      = useState(initTab);
  const [name,     setName]     = useState('');
  const [prenom,setPrenom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  const slideAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const tabIndicX  = useRef(new Animated.Value(tab === 'login' ? 0 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const switchTab = (t) => {
    setTab(t);
    Animated.spring(tabIndicX, {
      toValue: t === 'login' ? 0 : 1,
      tension: 80, friction: 12,
      useNativeDriver: false,
    }).start();
  };

  const indicatorLeft = tabIndicX.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '50%'],
  });

  const handleLogin = () => {
    if (!email && !phone) { Alert.alert('Erreur', 'Entrez votre email ou téléphone'); return; }
    if (!password)        { Alert.alert('Erreur', 'Entrez votre mot de passe'); return; }
    navigation.replace('Map');
  };

  const handleSignUp = () => {
    if (!email)    { Alert.alert('Erreur', 'Entrez votre email'); return; }
    if (!password) { Alert.alert('Erreur', 'Entrez un mot de passe'); return; }
    if (password !== confirm) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    navigation.replace('Map');
  };

  const handleGoogle   = () => Alert.alert('Google', 'Connexion Google à intégrer (Firebase Auth)');
  const handleFacebook = () => Linking.openURL('https://www.facebook.com/login').catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir Facebook'));
  const handleApple    = () => Alert.alert('Apple', 'Connexion Apple à intégrer (expo-apple-authentication)');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Animated.View style={[styles.header, {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim.interpolate({ inputRange: [0,1], outputRange: [-20, 0] }) }],
          }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <View style={styles.backCircle}>
                <Icon name="arrow-left" size={20} color={C.greyDark} style={{top:-5}} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Tabs ── */}
          <Animated.View style={[styles.tabBar, { opacity: fadeAnim }]}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('login')} activeOpacity={0.8}>
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Connexion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signup')} activeOpacity={0.8}>
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>Inscription</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Formulaire LOGIN ── */}
          {tab === 'login' && (
            <Animated.View style={[styles.form, { opacity: fadeAnim }]}>
              <InputField
                icon="envelope"
                placeholder="Adresse email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
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
                onChangeText={setPhone}
                keyboardType="phone-pad"
                prefix="+216  "
              />

              <InputField
                icon="lock"
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} activeOpacity={0.88}>
                <Text style={styles.primaryBtnText}>SE CONNECTER</Text>
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
                onChangeText={setName}
                keyboardType="Name"
              />
              <InputField
                icon="user"
                placeholder="Prénom"
                value={prenom}
                onChangeText={setPrenom}
                keyboardType="prenom"
              />
              <InputField
                icon="envelope"
                placeholder="Adresse email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <View style={styles.phoneRow}>
                <View style={styles.flagPill}>
                  <Icon name="flag" size={13} color={C.blue} />
                  <Text style={styles.flagCode}>+216</Text>
                  <Text style={styles.flagCaret}>▾</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    icon="phone"
                    placeholder="Téléphone"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <InputField
                icon="lock"
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <InputField
                icon="lock"
                placeholder="Confirmer le mot de passe"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSignUp} activeOpacity={0.88}>
                <Text style={styles.primaryBtnText}>CRÉER MON COMPTE</Text>
              </TouchableOpacity>

            </Animated.View>
          )}

          {/* ── Séparateur social ── */}
          <View style={styles.socialDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Boutons sociaux ── */}
          <View style={styles.socialGrid}>
            <SocialBtn
              label="Google"
              iconName="G"
              iconColor={C.google}
              bgColor={C.white}
              textColor={C.greyDark}
              onPress={handleGoogle}
            />
            <SocialBtn
              label="Facebook"
              iconName="f"
              iconColor={C.white}
              bgColor={C.facebook}
              textColor={C.white}
              onPress={handleFacebook}
            />
            <SocialBtn
              label="Apple"
              iconName="A"
              iconColor={C.white}
              bgColor={C.apple}
              textColor={C.white}
              onPress={handleApple}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.white },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  backBtn: { marginRight: 12 },
  backCircle: {
    top:20,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: C.greyLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Titre
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.greyDark,
    marginTop: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.grey,
    marginTop: 4,
    marginBottom: 28,
  },

  // Tabs
  tabBar: {
    top: 20,
    flexDirection: 'row',
    backgroundColor: C.greyLight,
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4, bottom: 4,
    width: '48%',
    backgroundColor: C.blue,
    borderRadius: 11,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.grey,
  },
  tabTextActive: {
    color: C.white,
  },

  // Formulaire
  form: { gap: 12, marginBottom: 8 },

  // Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greyLight,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
    minHeight: 52,
  },
  inputIconLeft:  { marginRight: 10 },
  inputIconRight: { marginLeft: 8, padding: 4 },
  inputPrefix: {
    fontSize: 14,
    color: C.blue,
    fontWeight: '700',
    marginRight: 4,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: C.greyDark,
    paddingVertical: 12,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: '#B0B3C6', fontWeight: '500' },

  // Forgot
  forgotBtn: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: C.blue, fontWeight: '600' },

  // Bouton principal
  primaryBtn: {
    backgroundColor: C.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // CGU
  cguText:  { fontSize: 12, color: C.grey, textAlign: 'center', marginTop: 8 },
  cguLink:  { color: C.blue, fontWeight: '600' },

  // Téléphone
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
    borderWidth: 1.5,
    borderColor: C.blue,
    height: 52,
  },
  flagCode:  { fontSize: 14, color: C.blue, fontWeight: '700' },
  flagCaret: { fontSize: 10, color: C.blue },

  // Boutons sociaux
  socialGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIcon:  { fontSize: 20, fontWeight: '900' },
  socialLabel: { fontSize: 11, fontWeight: '600' },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  switchText: { fontSize: 14, color: C.grey },
  switchLink: { fontSize: 14, color: C.blue, fontWeight: '700' },
});