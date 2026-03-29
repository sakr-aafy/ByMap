// src/screens/PublicationDetail.js
import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  FlatList,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';

const { width } = Dimensions.get('window');

// Normalize media URL (replace any host with current server)
const SERVER_BASE = API_URL.replace('/api', '');
function fixMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) {
    try {
      const u = new URL(url);
      const base = new URL(SERVER_BASE);
      u.host = base.host;
      u.protocol = base.protocol;
      return u.toString();
    } catch {
      return url;
    }
  }
  return `${SERVER_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

const C = {
  local:      '#34C759',
  localLight: '#E8F9EE',
  duo:        '#1E90FF',
  duoLight:   '#EBF4FF',
  bg:         '#F5F6FA',
  white:      '#FFFFFF',
  border:     '#EEEFF5',
  text:       '#1a1a2e',
  grey:       '#888',
  red:        '#FF3B30',
};

// ── Carousel médias ───────────────────────────────────────────────────────────
function MediaCarousel({ medias }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const videoRefs = useRef({});

  if (!medias || medias.length === 0) return null;

  const handleVideoPress = () => {
    setPaused(prev => !prev);
  };

  return (
    <View>
      <FlatList
        data={medias}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
          // Pause video when scrolling away
          setPaused(true);
        }}
        renderItem={({ item }) => {
          const uri = fixMediaUrl(item.url);
          if (item.type === 'video') {
            return (
              <TouchableOpacity
                style={styles.mediaSlide}
                activeOpacity={0.9}
                onPress={handleVideoPress}
              >
                <Video
                  ref={ref => { videoRefs.current[i] = ref; }}
                  source={{ uri }}
                  style={styles.mediaImage}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={i === index && !paused}
                  isLooping
                  useNativeControls={false}
                />
                {paused && (
                  <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                      <Text style={styles.playIcon}>▶</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }
          return (
            <View style={styles.mediaSlide}>
              <Image
                source={{ uri }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
            </View>
          );
        }}
      />
      {medias.length > 1 && (
        <View style={styles.dotsRow}>
          {medias.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Ligne info ────────────────────────────────────────────────────────────────
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

// ── Écran ─────────────────────────────────────────────────────────────────────
export default function PublicationDetail() {
  const navigation = useNavigation();
  const route      = useRoute();
  const pub        = route.params?.publication;

  const [liked,    setLiked]    = useState(false);
  const [nbLikes,  setNbLikes]  = useState(pub?.nbLikes ?? pub?.likes?.length ?? 0);

  if (!pub) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: C.grey }}>
          Publication introuvable.
        </Text>
      </SafeAreaView>
    );
  }

  const isLocal  = pub.mode === 'local';
  const accent   = isLocal ? C.local : C.duo;
  const accentBg = isLocal ? C.localLight : C.duoLight;

  const formattedDate = pub.createdAt
    ? new Date(pub.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '';

  const handleLike = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('Connexion requise', 'Connectez-vous pour liker cette publication.');
        return;
      }
      const res = await fetch(`${API_URL}/publications/${pub._id}/like`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setNbLikes(data.nbLikes);
      }
    } catch {
      // silencieux
    }
  };

  const handleContact = () => {
    const phone = pub.auteur?.phone || pub.auteur?.telephone;
    const email = pub.auteur?.email;

    if (!phone && !email) {
      Alert.alert('Contact', 'Aucune coordonnée disponible pour cet auteur.');
      return;
    }

    const options = [];
    if (phone) {
      options.push({
        text: `📞 Appeler  ${phone}`,
        onPress: () => Linking.openURL(`tel:${phone}`),
      });
      options.push({
        text: `💬 WhatsApp`,
        onPress: () => Linking.openURL(`whatsapp://send?phone=${phone}`),
      });
    }
    if (email) {
      options.push({
        text: `✉️ Email  ${email}`,
        onPress: () => Linking.openURL(`mailto:${email}`),
      });
    }
    options.push({ text: 'Annuler', style: 'cancel' });

    Alert.alert(
      'Contacter l\'auteur',
      `${pub.auteur?.prenom || ''} ${pub.auteur?.nom || ''}`.trim() || 'Auteur',
      options,
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={[styles.modeBadge, { backgroundColor: accentBg }]}>
          <Text style={[styles.modeText, { color: accent }]}>
            {isLocal ? '📍 LOCAL' : '🤝 DUO'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ── Médias ── */}
        <MediaCarousel medias={pub.medias} />

        <View style={styles.body}>

          {/* ── Auteur + date ── */}
          <View style={styles.authorRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {pub.auteur?.prenom?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>
                {pub.auteur?.prenom || ''} {pub.auteur?.nom || 'Anonyme'}
              </Text>
              {formattedDate ? (
                <Text style={styles.authorDate}>{formattedDate}</Text>
              ) : null}
            </View>
            {/* Like */}
            <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.8}>
              <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={[styles.likeCount, liked && { color: C.red }]}>{nbLikes}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Description ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descText}>{pub.description}</Text>
          </View>

          {/* ── Localisation ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localisation</Text>

            {isLocal ? (
              <View style={styles.locCard}>
                <InfoRow icon="🏙️" label="Ville"        value={pub.localisation?.ville} />
                <InfoRow icon="🗺️" label="Gouvernorat"  value={pub.localisation?.gouvernorat} />
                <InfoRow icon="📌" label="Délégation"   value={pub.localisation?.delegation} />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={styles.locCard}>
                  <View style={[styles.locPrefixBar, { backgroundColor: accent }]}>
                    <Text style={styles.locPrefixText}>Début</Text>
                  </View>
                  <InfoRow icon="🏙️" label="Ville"       value={pub.localisationDebut?.ville} />
                  <InfoRow icon="🗺️" label="Gouvernorat" value={pub.localisationDebut?.gouvernorat} />
                </View>
                <View style={styles.locCard}>
                  <View style={[styles.locPrefixBar, { backgroundColor: accent }]}>
                    <Text style={styles.locPrefixText}>Fin</Text>
                  </View>
                  <InfoRow icon="🏙️" label="Ville"       value={pub.localisationFin?.ville} />
                  <InfoRow icon="🗺️" label="Gouvernorat" value={pub.localisationFin?.gouvernorat} />
                </View>
              </View>
            )}
          </View>

          {/* ── Stats ── */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pub.vues ?? 0}</Text>
              <Text style={styles.statLabel}>Vues</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{nbLikes}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pub.medias?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Médias</Text>
            </View>
          </View>

          {/* bottom spacing for footer */}
          <View style={{ height: 16 }} />
        </View>
      </ScrollView>

      {/* ── Footer contact ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: accent }]}
          onPress={handleContact}
          activeOpacity={0.85}
        >
          <Text style={styles.contactIcon}>📞</Text>
          <Text style={styles.contactText}>Contacter l'auteur</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0F1F8',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: C.text, fontWeight: '700' },
  modeBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  modeText: { fontSize: 13, fontWeight: '800' },

  // Carousel
  mediaSlide:  { width, height: 260, backgroundColor: '#eee' },
  mediaImage:  { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: { fontSize: 28, color: '#1a1a2e', marginLeft: 4 },
  dotsRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 5 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: C.duo, width: 16 },

  // Body
  body: { padding: 16, gap: 16 },

  // Author
  authorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.duo,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { color: C.white, fontWeight: '800', fontSize: 18 },
  authorName:   { fontSize: 15, fontWeight: '700', color: C.text },
  authorDate:   { fontSize: 12, color: C.grey, marginTop: 2 },
  likeBtn:      { alignItems: 'center', gap: 2 },
  likeIcon:     { fontSize: 22 },
  likeCount:    { fontSize: 12, fontWeight: '700', color: C.grey },

  // Section
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text },

  // Description
  descText: {
    fontSize: 14, color: C.text, lineHeight: 22,
    backgroundColor: C.white,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },

  // Localisation
  locCard: {
    backgroundColor: C.white,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
    gap: 10,
  },
  locPrefixBar: {
    alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  locPrefixText: { color: C.white, fontWeight: '800', fontSize: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon:  { fontSize: 16, marginTop: 2 },
  infoLabel: { fontSize: 11, color: C.grey, fontWeight: '600' },
  infoValue: { fontSize: 14, color: C.text, fontWeight: '600', marginTop: 1 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem:    { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel:   { fontSize: 12, color: C.grey, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },

  // Footer contact
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
  },
  contactIcon: { fontSize: 20 },
  contactText: { fontSize: 16, fontWeight: '800', color: C.white },
});
