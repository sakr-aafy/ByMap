// src/theme/index.js — ByMap Design System
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const { width: SW, height: SH } = Dimensions.get('window');

// ── Color tokens ──────────────────────────────────────────────────────────────
export const D = {
  // Brand
  navy:        '#0a1628',
  navyMid:     '#0f2040',
  navyLight:   '#1a3a5c',
  blue:        '#1E90FF',   // DUO accent
  blueDark:    '#0A6FCC',
  blueGlow:    'rgba(30,144,255,0.28)',
  green:       '#34C759',   // LOCAL accent
  greenGlow:   'rgba(52,199,89,0.28)',
  purple:      'rgba(120,60,220,0.18)',
  red:         '#FF3B30',

  // Light mode surfaces
  bgLight:     '#F0F2FA',
  cardLight:   '#FFFFFF',
  borderLight: 'rgba(0,0,0,0.07)',

  // Glass surfaces (on dark bg)
  glass:       'rgba(255,255,255,0.09)',
  glassMid:    'rgba(255,255,255,0.13)',
  glassHigh:   'rgba(255,255,255,0.18)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassInput:  'rgba(255,255,255,0.07)',

  // Text on dark
  white:       '#FFFFFF',
  textDim:     'rgba(255,255,255,0.58)',
  textFaint:   'rgba(255,255,255,0.35)',

  // Text on light
  textDark:    '#1a1a2e',
  textGrey:    '#7A7D9C',
};

// ── Gradient presets ──────────────────────────────────────────────────────────
export const G = {
  dark:  [D.navy, D.navyMid, '#0d1a30'],
  blue:  [D.blue, D.blueDark],
  green: [D.green, '#28A745'],
  card:  ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.07)'],
};

// ── Shared shadow presets ─────────────────────────────────────────────────────
export const shadow = {
  blue: {
    shadowColor: D.blue, shadowOpacity: 0.45,
    shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  green: {
    shadowColor: D.green, shadowOpacity: 0.4,
    shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  soft: {
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  card: {
    shadowColor: '#000', shadowOpacity: 0.07,
    shadowRadius: 8,  shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
};

// ── GlassView — frosted glass simulation ─────────────────────────────────────
export const GlassView = ({ style, children, level = 'mid', borderRadius = 16 }) => {
  const bg = level === 'low'  ? D.glass
           : level === 'mid'  ? D.glassMid
           :                    D.glassHigh;
  return (
    <View style={[
      {
        backgroundColor:  bg,
        borderWidth:      1,
        borderColor:      D.glassBorder,
        borderRadius,
        overflow:         'hidden',
      },
      style,
    ]}>
      {children}
    </View>
  );
};

// ── DarkBackground — gradient + color blobs ───────────────────────────────────
export const DarkBackground = ({ children, style }) => (
  <LinearGradient colors={G.dark} style={[{ flex: 1 }, style]}>
    {/* Blobs are pure Views — no native module needed */}
    <View style={[blob.base, blob.topRight, { backgroundColor: D.blueGlow }]} />
    <View style={[blob.base, blob.bottomLeft, { backgroundColor: D.greenGlow }]} />
    <View style={[blob.base, blob.center,    { backgroundColor: D.purple }]} />
    {children}
  </LinearGradient>
);

const blob = StyleSheet.create({
  base:        { position: 'absolute', borderRadius: 999 },
  topRight:    { width: 300, height: 300, top: -80,  right: -80  },
  bottomLeft:  { width: 260, height: 260, bottom: -60, left: -70  },
  center:      { width: 180, height: 180, top: '35%', left: '20%' },
});

// ── Common component styles ───────────────────────────────────────────────────
export const CS = StyleSheet.create({
  // Back button on dark bg
  backBtnDark: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: D.glass,
    borderWidth: 1, borderColor: D.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  backIconDark: { fontSize: 18, color: D.white, fontWeight: '700' },

  // Back button on light bg
  backBtnLight: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#ECEEF8',
    justifyContent: 'center', alignItems: 'center',
  },
  backIconLight: { fontSize: 18, color: D.textDark, fontWeight: '700' },

  // Glass input field
  inputDark: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.glassInput,
    borderWidth: 1, borderColor: D.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  inputLight: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F4F5FB',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },

  // Primary gradient button wrapper (use with LinearGradient inside)
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow.blue,
  },
  primaryBtnInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
    gap: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: D.white, letterSpacing: 0.2 },

  // Glass card
  glassCard: {
    backgroundColor: D.glassMid,
    borderWidth: 1, borderColor: D.glassBorder,
    borderRadius: 20,
    ...shadow.soft,
  },

  // Light card
  lightCard: {
    backgroundColor: D.cardLight,
    borderRadius: 18,
    borderWidth: 1, borderColor: D.borderLight,
    ...shadow.card,
  },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: '700', color: D.textDim, letterSpacing: 1, textTransform: 'uppercase' },

  // Avatar circle
  avatar: (color) => ({
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 999,
    backgroundColor: color || D.blue,
  }),
  avatarText: { color: D.white, fontWeight: '800' },
});
