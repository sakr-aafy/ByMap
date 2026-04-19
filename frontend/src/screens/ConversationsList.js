// src/screens/ConversationsList.js
import React, { useState, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { useTranslation } from 'react-i18next';

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
  const { t }      = useTranslation();
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
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, unread > 0 && styles.avatarUnread]}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>

        {/* Body */}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread > 0 && styles.nameBold]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.time, unread > 0 && { color: '#2DBD7E', fontWeight: '700' }]}>{time}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewBold]} numberOfLines={1}>
              {preview || t('conversations.startConversation')}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

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
            <Text style={styles.headerTitle}>{t('conversations.title')}</Text>
            {convs.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{convs.length}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2DBD7E" />
          </View>
        ) : (
          <FlatList
            data={convs}
            keyExtractor={(item, i) => item.contact?._id || String(i)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <FontAwesome6 name="comments" size={38} color="#2DBD7E" />
                </View>
                <Text style={styles.emptyTitle}>{t('conversations.noConversations')}</Text>
                <Text style={styles.emptySub}>{t('conversations.noConversationsSub')}</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  headerBadge:  { backgroundColor: '#2DBD7E', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // ── List
  listContent: { paddingVertical: 8, paddingHorizontal: 0 },

  // ── Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', gap: 14,
  },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },

  // ── Avatar
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  avatarUnread: {
    backgroundColor: '#3B7EF6',
    shadowColor: '#3B7EF6',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#2DBD7E', borderWidth: 2, borderColor: '#FFFFFF',
  },

  // ── Row body
  rowBody:   { flex: 1, gap: 4 },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  name:        { fontSize: 15, color: '#1A1A2E', fontWeight: '600', flex: 1 },
  nameBold:    { fontWeight: '800', color: '#1A1A2E' },
  time:        { fontSize: 12, color: '#9CA3AF' },
  preview:     { fontSize: 13, color: '#9CA3AF', flex: 1 },
  previewBold: { color: '#4B5563', fontWeight: '600' },

  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // ── Empty state
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  emptySub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
