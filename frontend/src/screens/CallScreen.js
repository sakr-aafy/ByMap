// src/screens/CallScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { D, shadow } from '../theme/index';

const SERVER_BASE = API_URL.replace('/api', '');

export default function CallScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { recipient, isIncoming } = route.params;

  const [status,   setStatus]   = useState(isIncoming ? 'incoming' : 'calling');
  const [muted,    setMuted]    = useState(false);
  const [duration, setDuration] = useState(0);

  const socketRef = useRef(null);
  const timerRef  = useRef(null);

  const startTimer = () => { timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); };

  const formatDuration = (s) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('userId').then(userId => {
      if (!userId) return;
      const socket = io(SERVER_BASE, { transports: ['websocket'] });
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('register', userId));

      if (!isIncoming) {
        AsyncStorage.getItem('userName').then(name => {
          socket.emit('call-offer', { to: recipient._id, offer: null, callerId: userId, callerName: name || 'Utilisateur' });
        });
        const timeout = setTimeout(() => {
          if (mounted && status === 'calling') { setStatus('unavailable'); setTimeout(() => navigation.goBack(), 1500); }
        }, 30000);
        socket.on('call-answered', () => { if (!mounted) return; clearTimeout(timeout); setStatus('connected'); startTimer(); });
        socket.on('call-rejected', () => { if (!mounted) return; clearTimeout(timeout); setStatus('rejected'); setTimeout(() => navigation.goBack(), 1500); });
        socket.on('call-ended', () => { if (mounted) hangUp(false); });
      } else {
        socket.emit('call-answer', { to: recipient._id, answer: null });
        setStatus('connected'); startTimer();
        socket.on('call-ended', () => { if (mounted) hangUp(false); });
      }
    });
    return () => { mounted = false; clearInterval(timerRef.current); socketRef.current?.disconnect(); };
  }, []);

  const hangUp = (notify = true) => {
    clearInterval(timerRef.current);
    if (notify) socketRef.current?.emit('call-end', { to: recipient._id });
    socketRef.current?.disconnect();
    navigation.goBack();
  };

  const openPhoneCall = () => { if (recipient.phone) Linking.openURL(`tel:${recipient.phone}`); };

  const recipientName = `${recipient.prenom || ''} ${recipient.nom || ''}`.trim() || 'Contact';

  const statusLabel = {
    calling:     'Appel en cours…',
    incoming:    'Appel vocal',
    connected:   formatDuration(duration),
    rejected:    'Appel refusé',
    unavailable: 'Pas de réponse',
  }[status];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.top}>
        <View style={[styles.bigAvatar, status === 'connected' && styles.bigAvatarActive]}>
          <Text style={styles.bigLetter}>{recipient.prenom?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{recipientName}</Text>
        <Text style={[
          styles.statusText,
          status === 'connected'  && styles.statusConnected,
          (status === 'rejected' || status === 'unavailable') && styles.statusError,
        ]}>
          {statusLabel}
        </Text>
      </View>

      <View style={styles.controls}>
        {status === 'calling' || status === 'connected' ? (
          <View style={styles.activeRow}>
            <TouchableOpacity style={[styles.roundBtn, muted && styles.roundBtnActive]} onPress={() => setMuted(m => !m)}>
              <Text style={styles.roundIcon}>{muted ? '🔇' : '🎙️'}</Text>
              <Text style={styles.roundLabel}>{muted ? 'Muet' : 'Micro'}</Text>
            </TouchableOpacity>
            {recipient.phone ? (
              <TouchableOpacity style={styles.roundBtn} onPress={openPhoneCall}>
                <Text style={styles.roundIcon}>📱</Text>
                <Text style={styles.roundLabel}>GSM</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 72 }} />}
            <TouchableOpacity style={[styles.roundBtn, styles.hangupBtn]} onPress={() => hangUp(true)}>
              <Text style={styles.roundIcon}>📵</Text>
              <Text style={styles.roundLabel}>Fin</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D.navy, justifyContent: 'space-between' },
  top:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },

  bigAvatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: D.blue,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    ...shadow.blue,
  },
  bigAvatarActive: {
    ...shadow.green,
    borderWidth: 3, borderColor: D.green,
  },
  bigLetter:       { fontSize: 48, color: D.white, fontWeight: '800' },
  name:            { fontSize: 26, fontWeight: '800', color: D.white },
  statusText:      { fontSize: 15, color: D.textDim, marginTop: 4 },
  statusConnected: { color: D.green, fontWeight: '700' },
  statusError:     { color: D.red },

  controls:  { paddingBottom: 50, paddingHorizontal: 30 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },

  roundBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: D.glass,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: D.glassBorder,
  },
  roundBtnActive: { backgroundColor: D.glassMid },
  hangupBtn:      { backgroundColor: D.red, borderColor: D.red },
  roundIcon:      { fontSize: 26 },
  roundLabel:     { fontSize: 11, color: D.white, fontWeight: '600' },

  backBtn: {
    alignSelf: 'center',
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30,
  },
  backBtnText: { color: D.white, fontSize: 16, fontWeight: '700' },
});