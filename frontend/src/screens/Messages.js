// src/screens/Messages.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { useCall } from '../context/CallContext';

export default function Messages() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { recipient } = route.params;

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [myId,     setMyId]     = useState(null);

  const flatRef  = useRef(null);
  const pollRef  = useRef(null);

  const { socketRef } = useCall();

  // ── Get local userId ───────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => { if (id) setMyId(id); });
  }, []);

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

  const handleCall = async () => {
    const [userId, userName] = await Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('userName'),
    ]);
    socketRef.current?.emit('call-offer', {
      to:         recipient._id,
      offer:      null,
      callerId:   userId,
      callerName: userName || 'Utilisateur',
    });
    navigation.navigate('Call', { recipient, isIncoming: false });
  };

  const renderItem = ({ item, index }) => {
    const isMe    = item.sender?._id === myId || item.sender === myId;
    const prev    = messages[index - 1];
    const showTime = !prev || new Date(item.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
    const timeStr = new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return (
      <View>
        {showTime && (
          <View style={styles.timeLabelRow}>
            <View style={styles.timeLabelLine} />
            <Text style={styles.timeLabel}>{timeStr}</Text>
            <View style={styles.timeLabelLine} />
          </View>
        )}
        <View style={[styles.bubbleRow, isMe ? styles.rowMe : styles.rowOther]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  const recipientName = `${recipient.prenom || ''} ${recipient.nom || ''}`.trim() || 'Contact';
  const initial = recipient.prenom?.[0]?.toUpperCase() || '?';

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{recipientName}</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerSub}>En ligne</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.7}>
            <FontAwesome6 name="phone" size={16} color="#2DBD7E" />
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2DBD7E" />
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={item => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIconWrap}>
                    <FontAwesome6 name="comments" size={38} color="#2DBD7E" />
                  </View>
                  <Text style={styles.emptyTitle}>Aucun message</Text>
                  <Text style={styles.emptyText}>Démarrez la conversation avec {recipientName}</Text>
                </View>
              }
            />
          )}

          {/* ── Input bar ── */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(45,189,126,0.12)', borderWidth: 1, borderColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  avatarLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  headerName:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  onlineRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2DBD7E' },
  headerSub:    { fontSize: 11, color: '#2DBD7E', fontWeight: '600' },

  // ── List
  listContent: { padding: 16, gap: 4, paddingBottom: 8 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  emptyText:  { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },

  // ── Time label
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12, paddingHorizontal: 8 },
  timeLabelLine:{ flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  timeLabel:    { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  // ── Bubbles
  bubbleRow:  { flexDirection: 'row', marginVertical: 2 },
  rowMe:      { justifyContent: 'flex-end' },
  rowOther:   { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleMe: {
    backgroundColor: '#2DBD7E', borderBottomRightRadius: 4,
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bubbleText:   { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  bubbleTextMe: { color: '#FFFFFF' },

  // ── Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 6,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#1A1A2E',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
});
