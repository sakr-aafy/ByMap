// src/screens/Messages.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, SafeAreaView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_URL } from '../environments/environment';
import { D, G, shadow, DarkBackground } from '../theme/index';

const SERVER_BASE = API_URL.replace('/api', '');

export default function Messages() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { recipient } = route.params;

  const [messages,     setMessages]     = useState([]);
  const [text,         setText]         = useState('');
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [myId,         setMyId]         = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const flatRef   = useRef(null);
  const pollRef   = useRef(null);
  const socketRef = useRef(null);

  // ── Init socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('userId').then(userId => {
      if (!userId) return;
      setMyId(userId);
      const socket = io(SERVER_BASE, { transports: ['websocket'] });
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('register', userId));
      socket.on('incoming-call', ({ callerName, from, offer }) => {
        if (!mounted) return;
        if (String(from) === String(recipient._id)) setIncomingCall({ callerName, offer });
      });
    });
    return () => { mounted = false; socketRef.current?.disconnect(); };
  }, [recipient._id]);

  // ── Fetch messages ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/messages/${recipient._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMessages(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [recipient._id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ── Envoyer ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: recipient._id, content: trimmed }),
      });
      if (res.ok) { const msg = await res.json(); setMessages(p => [...p, msg]); setText(''); }
    } catch {}
    finally { setSending(false); }
  };

  const handleCall   = () => navigation.navigate('Call', { recipient, isIncoming: false });
  const acceptCall   = () => { const offer = incomingCall.offer; setIncomingCall(null); navigation.navigate('Call', { recipient, isIncoming: true, offer }); };
  const rejectCall   = () => { socketRef.current?.emit('call-reject', { to: recipient._id }); setIncomingCall(null); };

  const renderItem = ({ item, index }) => {
    const isMe    = item.sender?._id === myId || item.sender === myId;
    const prev    = messages[index - 1];
    const showTime = !prev || new Date(item.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
    const timeStr = new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return (
      <View>
        {showTime && <Text style={styles.timeLabel}>{timeStr}</Text>}
        <View style={[styles.bubbleRow, isMe ? styles.rowMe : styles.rowOther]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  const recipientName = `${recipient.prenom || ''} ${recipient.nom || ''}`.trim() || 'Contact';

  return (
    <DarkBackground style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Bannière appel entrant ── */}
        {incomingCall && (
          <Modal transparent animationType="slide">
            <View style={styles.incomingOverlay}>
              <View style={styles.incomingCard}>
                <View style={styles.incomingAvatar}>
                  <Text style={styles.incomingLetter}>{recipient.prenom?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.incomingName}>{incomingCall.callerName || recipientName}</Text>
                <Text style={styles.incomingLabel}>Appel vocal entrant…</Text>
                <View style={styles.incomingBtns}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
                    <Text style={styles.callBtnIcon}>📵</Text>
                    <Text style={styles.callBtnLabel}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                    <Text style={styles.callBtnIcon}>📞</Text>
                    <Text style={styles.callBtnLabel}>Accepter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{recipient.prenom?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{recipientName}</Text>
              <Text style={styles.headerSub}>En ligne</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.7}>
            <Text style={styles.callIcon}>📞</Text>
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={D.blue} /></View>
          ) : (
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={item => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyText}>Démarrez la conversation avec {recipientName}</Text>}
            />
          )}

          {/* ── Input ── */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message…"
              placeholderTextColor={D.textFaint}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? <ActivityIndicator size="small" color={D.white} /> : <Text style={styles.sendIcon}>➤</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  incomingOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  incomingCard: {
    backgroundColor: D.navyMid,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: D.glassBorder,
    padding: 30, alignItems: 'center', gap: 10,
  },
  incomingAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: D.blue,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    ...shadow.blue,
  },
  incomingLetter:  { fontSize: 36, color: D.white, fontWeight: '800' },
  incomingName:    { fontSize: 22, fontWeight: '800', color: D.white },
  incomingLabel:   { fontSize: 13, color: D.textDim, marginBottom: 10 },
  incomingBtns:    { flexDirection: 'row', gap: 40, marginTop: 10 },
  rejectBtn:  { alignItems: 'center', gap: 6, backgroundColor: D.red,   width: 70, height: 70, borderRadius: 35, justifyContent: 'center' },
  acceptBtn:  { alignItems: 'center', gap: 6, backgroundColor: D.green, width: 70, height: 70, borderRadius: 35, justifyContent: 'center' },
  callBtnIcon:  { fontSize: 28 },
  callBtnLabel: { fontSize: 11, color: D.white, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: D.glass, borderBottomWidth: 1, borderBottomColor: D.glassBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon:  { fontSize: 18, color: D.white, fontWeight: '700' },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: D.greenGlow, borderWidth: 1, borderColor: D.green,
    justifyContent: 'center', alignItems: 'center',
  },
  callIcon: { fontSize: 18 },
  headerCenter:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: D.blue, justifyContent: 'center', alignItems: 'center',
    ...shadow.blue,
  },
  avatarLetter: { color: D.white, fontWeight: '800', fontSize: 16 },
  headerName:   { fontSize: 15, fontWeight: '700', color: D.white },
  headerSub:    { fontSize: 11, color: D.green },

  listContent: { padding: 16, gap: 4, paddingBottom: 8 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:   { textAlign: 'center', color: D.textDim, marginTop: 60, fontSize: 14 },
  timeLabel:   { textAlign: 'center', fontSize: 11, color: D.textFaint, marginVertical: 10 },

  bubbleRow:   { flexDirection: 'row', marginVertical: 2 },
  rowMe:       { justifyContent: 'flex-end' },
  rowOther:    { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
    ...shadow.soft,
  },
  bubbleMe:    { backgroundColor: D.blue, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: D.glassMid, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: D.glassBorder },
  bubbleText:  { fontSize: 14, color: D.white, lineHeight: 20 },
  bubbleTextMe:{ color: D.white },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: D.navyMid, borderTopWidth: 1, borderTopColor: D.glassBorder,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: D.glassInput, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: D.white,
    borderWidth: 1, borderColor: D.glassBorder,
  },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: D.blue, justifyContent: 'center', alignItems: 'center', ...shadow.blue },
  sendBtnDisabled: { backgroundColor: D.navyLight, shadowOpacity: 0 },
  sendIcon:        { fontSize: 18, color: D.white, marginLeft: 2 },
});