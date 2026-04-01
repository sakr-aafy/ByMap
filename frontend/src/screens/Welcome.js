// src/screens/Welcome.js — Splash screen
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Image, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const LOGO = require('../../assets/logo.png');

export default function Welcome() {
  const navigation = useNavigation();
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(0.8)).current;
  const progress      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade-in + scale
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    // Progress bar
    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    // Auto-navigate
    const t = setTimeout(() => navigation.replace('Map'), 3200);
    return () => clearTimeout(t);
  }, []);

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <LinearGradient colors={['#0a1628', '#0f2040', '#0d1a30']} style={styles.root}>
      <StatusBar style="light" />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* Loading bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: progressWidth }]}>
          <LinearGradient
            colors={['#34C759', '#1E90FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  logo: {
    width: width * 0.55,
    height: width * 0.55,
  },
  barTrack: {
    position: 'absolute',
    bottom: 60,
    left: 48,
    right: 48,
    height: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
});
