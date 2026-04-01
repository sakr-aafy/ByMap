// src/screens/ConversationsList.js
import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { D, shadow, DarkBackground } from '../theme/index';

const C = {
  bg:     D.navy,    white:  D.white,  border: D.glassBorder,
  text:   D.white,   grey:   D.textDim, blue: D.blue,
  green:  D.green,   unread: D.blue,
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function ConversationsList() {
  const navigation = useNavigation();
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConvs(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]));

  const renderItem = ({ item }) => {
    const contact = item.contact;
    const lastMsg = item.lastMessage;
    const unread  = item.unread ?? 0;
    const name    = `${contact?.prenom || ''} ${contact?.nom || ''}`.trim() || 'Inconnu';
    const initial = name[0]?.toUpperCase() || '?';
    const preview = lastMsg?.content || '';
    const time    = timeAgo(lastMsg?.createdAt);

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('Messages', { recipient: contact })}
        activeOpacity={0.75}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread > 0 && styles.nameBold]} numberOfLines={1}>{name}</Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewBold]} numberOfLines={1}>
              {preview || 'Démarrez la conversation'}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <DarkBackground style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={D.blue} />
          </View>
        ) : (
          <FlatList
            data={convs}
            keyExtractor={(item, i) => item.contact?._id || String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Aucune conversation</Text>
                <Text style={styles.emptySub}>
                  Contactez l'auteur d'une publication pour démarrer une conversation.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </DarkBackground>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: D.glass, borderBottomWidth: 1, borderBottomColor: D.glassBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon:    { fontSize: 18, color: D.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: D.white },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: D.glass, gap: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 82 },

  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: D.blue,
    justifyContent: 'center', alignItems: 'center',
    ...shadow.blue,
  },
  avatarLetter: { color: D.white, fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: D.green, borderWidth: 2, borderColor: D.navy,
  },

  rowBody:   { flex: 1, gap: 4 },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  name:        { fontSize: 15, color: D.white, fontWeight: '600', flex: 1 },
  nameBold:    { fontWeight: '800' },
  time:        { fontSize: 12, color: D.textFaint },
  preview:     { fontSize: 13, color: D.textDim, flex: 1 },
  previewBold: { color: D.white, fontWeight: '600' },

  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: D.blue, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: D.white, fontSize: 11, fontWeight: '800' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: D.white },
  emptySub:   { fontSize: 13, color: D.textDim, textAlign: 'center', lineHeight: 20 },
});