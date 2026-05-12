// src/screens/WelcomeNewUser.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const C = {
  green:     '#2DBD7E',
  greenDark: '#22A06B',
  greenGlow: 'rgba(45,189,126,0.14)',
  blue:      '#3B7EF6',
  blueGlow:  'rgba(59,126,246,0.12)',
  orange:    '#F97316',
  orangeGlow:'rgba(249,115,22,0.14)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
};

export default function WelcomeNewUser() {
  const navigation = useNavigation();
  const route      = useRoute();
  const user       = route.params?.user ?? {};

  const prenom = user.prenom || 'Bienvenu';
  const points = user.pointsSolde ?? 100;

  // Animations
  const fadeIn     = useRef(new Animated.Value(0)).current;
  const slideUp    = useRef(new Animated.Value(40)).current;
  const scalePts   = useRef(new Animated.Value(0.5)).current;
  const rotateStar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scalePts, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(rotateStar, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const starRotate = rotateStar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={s.root}>
      {/* Background blobs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={s.blobTop} />
        <View style={s.blobBottom} />
      </View>

      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />

        <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Logo */}
          <View style={s.logoRow}>
            <LinearGradient colors={[C.green, C.greenDark]} style={s.logo}>
              <FontAwesome6 name="location-dot" size={22} color="#fff" />
            </LinearGradient>
            <Text style={s.appName}>ByMap</Text>
          </View>

          {/* Avatar initiale */}
          <LinearGradient colors={[C.green, C.greenDark]} style={s.avatar}>
            <Text style={s.avatarText}>{prenom[0]?.toUpperCase() || 'B'}</Text>
          </LinearGradient>

          {/* Texte bienvenue */}
          <Text style={s.welcome}>Bienvenue,</Text>
          <Text style={s.name}>{prenom} !</Text>
          <Text style={s.subtitle}>Ton compte ByMap est prêt.{'\n'}Explore ta ville, partage des moments.</Text>

          {/* Carte points */}
          <Animated.View style={[s.pointsCard, { transform: [{ scale: scalePts }] }]}>
            <LinearGradient
              colors={['#FFF7ED', '#FFEDD5']}
              style={s.pointsGrad}
            >
              <Animated.View style={{ transform: [{ rotate: starRotate }] }}>
                <FontAwesome6 name="star" size={28} color={C.orange} solid />
              </Animated.View>
              <View style={s.pointsTextBlock}>
                <Text style={s.pointsLabel}>Points de départ</Text>
                <Text style={s.pointsValue}>{points} pts</Text>
              </View>
              <View style={[s.pointsBadge, { backgroundColor: C.orangeGlow }]}>
                <Text style={[s.pointsBadgeText, { color: C.orange }]}>Offerts</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Avantages rapides */}
          <View style={s.perksRow}>
            {[
              { icon: 'map-location-dot', label: 'Explorer la carte', color: C.blue },
              { icon: 'users',            label: 'Rejoindre la comm.',  color: C.green },
              { icon: 'newspaper',        label: 'Publier des posts',  color: C.orange },
            ].map((p) => (
              <View key={p.icon} style={s.perk}>
                <View style={[s.perkIcon, { backgroundColor: p.color + '18' }]}>
                  <FontAwesome6 name={p.icon} size={18} color={p.color} />
                </View>
                <Text style={s.perkLabel}>{p.label}</Text>
              </View>
            ))}
          </View>

          {/* Bouton commencer */}
          <TouchableOpacity
            style={s.btn}
            onPress={() => navigation.replace('Map')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[C.green, C.greenDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnGrad}
            >
              <Text style={s.btnText}>Commencer l'aventure</Text>
              <FontAwesome6 name="arrow-right" size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  blobTop: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 999,
    backgroundColor: 'rgba(45,189,126,0.12)',
  },
  blobBottom: {
    position: 'absolute', bottom: -80, left: -80,
    width: 260, height: 260, borderRadius: 999,
    backgroundColor: 'rgba(59,126,246,0.08)',
  },

  content: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16,
  },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32,
  },
  logo: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  appName: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  avatar: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: C.green, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  avatarText: { fontSize: 40, fontWeight: '800', color: '#fff' },

  welcome: { fontSize: 20, fontWeight: '600', color: C.textDim, marginBottom: 2 },
  name:    { fontSize: 34, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 10 },
  subtitle:{
    fontSize: 14, color: C.textFaint, textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },

  pointsCard: {
    width: width - 48, borderRadius: 20,
    overflow: 'hidden', marginBottom: 24,
    shadowColor: C.orange, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 5,
  },
  pointsGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 18,
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.20)', borderRadius: 20,
  },
  pointsTextBlock: { flex: 1 },
  pointsLabel: { fontSize: 12, color: C.orange, fontWeight: '600', marginBottom: 2 },
  pointsValue: { fontSize: 26, fontWeight: '800', color: C.text },
  pointsBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  pointsBadgeText: { fontSize: 12, fontWeight: '700' },

  perksRow: {
    flexDirection: 'row', gap: 10, marginBottom: 32,
  },
  perk: { flex: 1, alignItems: 'center', gap: 8 },
  perkIcon: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  perkLabel: { fontSize: 11, color: C.textDim, fontWeight: '600', textAlign: 'center' },

  btn: {
    width: width - 48, borderRadius: 18, overflow: 'hidden',
    shadowColor: C.green, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  btnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
