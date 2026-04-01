// src/screens/PublicationDetail.js
import React, { useState, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  SafeAreaView, Image, FlatList, Dimensions, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { D, shadow, DarkBackground, GlassView } from '../theme/index';

const { width } = Dimensions.get('window');
const SERVER_BASE = API_URL.replace('/api', '');

function fixMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) {
    try {
      const u = new URL(url); const base = new URL(SERVER_BASE);
      u.host = base.host; u.protocol = base.protocol; return u.toString();
    } catch { return url; }
  }
  return `${SERVER_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function MediaCarousel({ medias }) {
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(true);
  const videoRefs = useRef({});
  if (!medias || medias.length === 0) return null;

  return (
    <View>
      <FlatList
        data={medias} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => { setIndex(Math.round(e.nativeEvent.contentOffset.x / width)); setPaused(true); }}
        renderItem={({ item, index: i }) => {
          const uri = fixMediaUrl(item.url);
          if (item.type === 'video') return (
            <TouchableOpacity style={styles.mediaSlide} activeOpacity={0.9} onPress={() => setPaused(p => !p)}>
              <Video ref={r => { videoRefs.current[i] = r; }} source={{ uri }} style={styles.mediaImage}
                resizeMode={ResizeMode.COVER} shouldPlay={i === index && !paused} isLooping useNativeControls={false} />
              {paused && <View style={styles.playOverlay}><View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View></View>}
            </TouchableOpacity>
          );
          return <View style={styles.mediaSlide}><Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" /></View>;
        }}
      />
      {medias.length > 1 && (
        <View style={styles.dotsRow}>
          {medias.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotActive]} />)}
        </View>
      )}
    </View>
  );
}

const InfoRow = ({ icon, label, value }) =>
  value ? (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  ) : null;

export default function PublicationDetail() {
  const navigation = useNavigation();
  const route      = useRoute();
  const pub        = route.params?.publication;

  const [liked,   setLiked]   = useState(false);
  const [nbLikes, setNbLikes] = useState(pub?.nbLikes ?? pub?.likes?.length ?? 0);

  if (!pub) return (
    <DarkBackground style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: D.textDim }}>Publication introuvable.</Text>
      </SafeAreaView>
    </DarkBackground>
  );

  const isLocal  = pub.mode === 'local';
  const accent   = isLocal ? D.green : D.blue;
  const accentBg = isLocal ? D.greenGlow : D.blueGlow;

  const formattedDate = pub.createdAt
    ? new Date(pub.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const handleLike = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { Alert.alert('Connexion requise', 'Connectez-vous pour liker cette publication.'); return; }
      const res = await fetch(`${API_URL}/publications/${pub._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const data = await res.json(); setLiked(data.liked); setNbLikes(data.nbLikes); }
    } catch {}
  };

  const handleContact = () => {
    if (!pub.auteur?._id) { Alert.alert('Contact', 'Aucune information disponible pour cet auteur.'); return; }
    navigation.navigate('Messages', { recipient: { _id: pub.auteur._id, prenom: pub.auteur.prenom || '', nom: pub.auteur.nom || '', phone: pub.auteur.phone || pub.auteur.telephone || '' } });
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
          <View style={[styles.modeBadge, { backgroundColor: accentBg, borderColor: accent }]}>
            <Text style={[styles.modeText, { color: accent }]}>{isLocal ? '📍 LOCAL' : '🤝 DUO'}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <MediaCarousel medias={pub.medias} />

          <View style={styles.body}>
            {/* ── Auteur ── */}
            <GlassView style={styles.authorRow}>
              <View style={[styles.avatarCircle, { backgroundColor: accent }]}>
                <Text style={styles.avatarLetter}>{pub.auteur?.prenom?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName}>{pub.auteur?.prenom || ''} {pub.auteur?.nom || 'Anonyme'}</Text>
                {formattedDate ? <Text style={styles.authorDate}>{formattedDate}</Text> : null}
              </View>
              <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.8}>
                <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
                <Text style={[styles.likeCount, liked && { color: D.red }]}>{nbLikes}</Text>
              </TouchableOpacity>
            </GlassView>

            {/* ── Description ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <GlassView style={styles.descCard}>
                <Text style={styles.descText}>{pub.description}</Text>
              </GlassView>
            </View>

            {/* ── Localisation ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Localisation</Text>
              {isLocal ? (
                <GlassView style={styles.locCard}>
                  <InfoRow icon="🏙️" label="Ville"       value={pub.localisation?.ville} />
                  <InfoRow icon="🗺️" label="Gouvernorat" value={pub.localisation?.gouvernorat} />
                  <InfoRow icon="📌" label="Délégation"  value={pub.localisation?.delegation} />
                </GlassView>
              ) : (
                <View style={{ gap: 10 }}>
                  <GlassView style={styles.locCard}>
                    <View style={[styles.locPrefixBar, { backgroundColor: accent }]}><Text style={styles.locPrefixText}>Début</Text></View>
                    <InfoRow icon="🏙️" label="Ville"       value={pub.localisationDebut?.ville} />
                    <InfoRow icon="🗺️" label="Gouvernorat" value={pub.localisationDebut?.gouvernorat} />
                  </GlassView>
                  <GlassView style={styles.locCard}>
                    <View style={[styles.locPrefixBar, { backgroundColor: accent }]}><Text style={styles.locPrefixText}>Fin</Text></View>
                    <InfoRow icon="🏙️" label="Ville"       value={pub.localisationFin?.ville} />
                    <InfoRow icon="🗺️" label="Gouvernorat" value={pub.localisationFin?.gouvernorat} />
                  </GlassView>
                </View>
              )}
            </View>

            {/* ── Stats ── */}
            <GlassView style={styles.statsRow}>
              <View style={styles.statItem}><Text style={styles.statValue}>{pub.vues ?? 0}</Text><Text style={styles.statLabel}>Vues</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statValue}>{nbLikes}</Text><Text style={styles.statLabel}>Likes</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statValue}>{pub.medias?.length ?? 0}</Text><Text style={styles.statLabel}>Médias</Text></View>
            </GlassView>
            <View style={{ height: 16 }} />
          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: accent }]} onPress={handleContact} activeOpacity={0.85}>
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactText}>Contacter l'auteur</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </DarkBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

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
  modeBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  modeText:  { fontSize: 13, fontWeight: '800' },

  mediaSlide:  { width, height: 260, backgroundColor: D.navyMid },
  mediaImage:  { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  playCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: D.glassMid, borderWidth: 1, borderColor: D.glassBorder, justifyContent: 'center', alignItems: 'center' },
  playIcon:    { fontSize: 28, color: D.white, marginLeft: 4 },
  dotsRow:     { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 5 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: D.glassBorder },
  dotActive:   { backgroundColor: D.blue, width: 16 },

  body: { padding: 16, gap: 16 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: D.white, fontWeight: '800', fontSize: 18 },
  authorName:   { fontSize: 15, fontWeight: '700', color: D.white },
  authorDate:   { fontSize: 12, color: D.textDim, marginTop: 2 },
  likeBtn:      { alignItems: 'center', gap: 2 },
  likeIcon:     { fontSize: 22 },
  likeCount:    { fontSize: 12, fontWeight: '700', color: D.textDim },

  section:      { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: D.white },

  descCard: { borderRadius: 14, padding: 14 },
  descText: { fontSize: 14, color: D.textDim, lineHeight: 22 },

  locCard:       { borderRadius: 14, padding: 14, gap: 10 },
  locPrefixBar:  { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  locPrefixText: { color: D.white, fontWeight: '800', fontSize: 12 },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { fontSize: 16, marginTop: 2 },
  infoLabel:{ fontSize: 11, color: D.textFaint, fontWeight: '600' },
  infoValue:{ fontSize: 14, color: D.white, fontWeight: '600', marginTop: 1 },

  statsRow: { flexDirection: 'row', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'space-around' },
  statItem:    { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: 20, fontWeight: '800', color: D.white },
  statLabel:   { fontSize: 12, color: D.textDim, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: D.glassBorder },

  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: D.glass, borderTopWidth: 1, borderTopColor: D.glassBorder },
  contactBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 16, ...shadow.blue },
  contactIcon: { fontSize: 20 },
  contactText: { fontSize: 16, fontWeight: '800', color: D.white },
});