import React, { useEffect, useRef } from 'react';
import {StyleSheet,View,Image,Animated,Easing,} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const LOADING_DURATION = 3000; // 3 secondes

export default function Welcome() {
  const navigation  = useNavigation();
  const progress    = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // 1. Apparition du logo (fade + scale)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Barre de progression sur 3 secondes
    Animated.timing(progress, {
      toValue: 1,
      duration: LOADING_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    // 3. Naviguer vers Map après 3 secondes
    const timer = setTimeout(() => {
      navigation.replace('Map');
    }, LOADING_DURATION);

    return () => clearTimeout(timer);
  }, []);

  const progressWidth = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={['#0a0a1a', '#0d1020', '#050510']}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Logo animé centré */}
      <Animated.View style={[
        styles.logoContainer,
        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Barre de chargement bleue */}
      <View style={styles.loaderWrapper}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderFill, { width: progressWidth }]} />
        </View>
      </View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 280,
    height: 280,
  },
  loaderWrapper: {
    position: 'absolute',
    bottom: 80,
    left: 50,
    right: 50,
  },
  loaderTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    backgroundColor: '#1E90FF',
    borderRadius: 4,
    elevation: 2,
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
});