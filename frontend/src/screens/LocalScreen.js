// src/screens/LocalScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser, logout as apiLogout, checkFavorite, toggleFavorite } from '../utils/api';
import { useTranslation } from 'react-i18next';
import { environment } from '../environments/environment';
const API_URL = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');
const { width } = Dimensions.get('window');

const fixMediaUrl = (url) => {
  if (!url) return null;
  return url.replace(/^https?:\/\/[^/]+/, SERVER_BASE);
};

// Temps relatif : "2min", "3h", "1j"
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
};

// Temps restant avant expiration
const timeLeft = (expiresAt, now) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { label: 'Expiré', urgent: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return { label: `${Math.floor(h / 24)}j restants`, urgent: false };
  if (h > 0)   return { label: `${h}h ${m}min`, urgent: h < 3 };
  return { label: `${m}min`, urgent: true };
};

// ── Couleurs — thème clair mint ───────────────────────────────────────────────
const C = {
  local:       '#2DBD7E',
  localGlow:   'rgba(45,189,126,0.12)',
  duo:         '#3B7EF6',
  duoGlow:     'rgba(59,126,246,0.12)',
  navy:        '#FFFFFF',
  navyMid:     '#F8FAFB',
  navyLight:   '#2DBD7E',
  glass:       '#FFFFFF',
  glassMid:    '#E8F5EE',
  glassBorder: '#E5E7EB',
  white:       '#1A1A2E',
  textDim:     '#4B5563',
  textFaint:   '#9CA3AF',
  red:         '#EF4444',
};

// ── Menu items ────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { key: 'home',      tKey: 'common.home',        icon: 'house' },
  { key: 'map',       tKey: 'profile.tabMap',     icon: 'map' },
  { key: 'favorites', tKey: 'map.myFavorites',    icon: 'heart' },
  { key: 'myads',     tKey: 'profile.myAds',      icon: 'clipboard-list' },
  { key: 'settings',  tKey: 'profile.settings',   icon: 'gear' },
  { key: 'help',      tKey: 'profile.helpSupport', icon: 'circle-question' },
  { key: 'logout',    tKey: 'profile.logout',     icon: 'right-from-bracket', danger: true },
];

// ── Bottom Tab Bar items ───────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: 'globe',    tKey: 'common.globe',    icon: 'globe',   authRequired: false },
  { key: 'messages', tKey: 'common.messages', icon: 'message', authRequired: true  },
  { key: 'profile',  tKey: 'common.profile',  icon: 'user',    authRequired: true  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant PubCard — carte LOCAL (vert) ou DUO (bleu)
// ─────────────────────────────────────────────────────────────────────────────
const PubCard = ({ item, onPress, onContact, currentUser, now, onRenew }) => {
  const { t }      = useTranslation();
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const [imgError,   setImgError]   = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [liked,      setLiked]      = useState(false);
  const [nbLikes,    setNbLikes]    = useState(item.nbLikes ?? item.likes?.length ?? 0);
  const [vues,       setVues]       = useState(item.vues ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const handleLike = async () => {
    if (likeLoading) return;
    if (!currentUser) { onContact(); return; } // redirige vers Login
    setLikeLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications/${item._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setNbLikes(data.nbLikes);
        Animated.sequence([
          Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 4 }),
          Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 6 }),
        ]).start();
      }
    } catch {}
    setLikeLoading(false);
  };

  const handleCardPress = () => {
    setVues(v => v + 1);
    onPress();
  };

  const isLocal      = item.mode === 'local';
  const accent       = isLocal ? C.local : C.duo;
  const accentGlow   = isLocal ? C.localGlow : C.duoGlow;

  const expiry       = timeLeft(item.expiresAt, now);
  const isAuthor     = currentUser && item.auteur?._id?.toString() === currentUser._id?.toString();

  const authorName = [item.auteur?.prenom, item.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const locLine = isLocal
    ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(' · ')
    : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');

  const firstImage = item.medias?.find(m => m.type === 'image');
  const imageUri   = firstImage ? fixMediaUrl(firstImage.url) : null;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={handleCardPress} onPressIn={onPressIn} onPressOut={onPressOut}>

        {/* Barre d'accent latérale */}
        <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />

        {/* ── Header : avatar + nom + temps + badge ── */}
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={isLocal ? [C.local, '#28A745'] : [C.duo, '#0A6FCC']}
            style={styles.cardAvatar}
          >
            <Text style={styles.cardAvatarText}>{authorInitial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardAuthorName} numberOfLines={1}>{authorName}</Text>
            <View style={styles.cardMetaRow}>
              {locLine ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <FontAwesome6 name="location-dot" size={13} color="#9CA3AF" />
                  <Text style={styles.cardLocation} numberOfLines={1}>{locLine}</Text>
                </View>
              ) : null}
              <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.modeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
              <View style={[styles.modeDot, { backgroundColor: accent }]} />
              <Text style={[styles.modeText, { color: accent }]}>{isLocal ? t('common.local') : t('common.duo')}</Text>
            </View>
            {expiry && (
              <View style={[styles.expiryBadge, { backgroundColor: expiry.urgent ? 'rgba(239,68,68,0.10)' : 'rgba(107,114,128,0.08)' }]}>
                <FontAwesome6 name="clock" size={9} color={expiry.urgent ? C.red : '#9CA3AF'} />
                <Text style={[styles.expiryText, { color: expiry.urgent ? C.red : '#9CA3AF' }]}>{expiry.label}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Description ── */}
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
        ) : null}

        {/* ── Photo ── */}
        {imageUri && !imgError ? (
          <View style={styles.cardImageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              resizeMode="cover"
              onLoadStart={() => setImgLoading(true)}
              onLoadEnd={() => setImgLoading(false)}
              onError={() => { setImgError(true); setImgLoading(false); }}
            />
            {imgLoading && (
              <View style={styles.cardImageLoader}>
                <ActivityIndicator size="small" color={accent} />
              </View>
            )}
          </View>
        ) : null}

        {/* ── Footer : likes + vues + contact ── */}
        <View style={styles.cardFooter}>

          {/* Jadore */}
          <TouchableOpacity
            style={styles.cardMetaStat}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <FontAwesome6
                name="heart"
                size={22}
                color={liked ? C.red : '#9CA3AF'}
                solid={liked}
              />
            </Animated.View>
            <Text style={[styles.cardMetaText, liked && { color: C.red, fontWeight: '700' }]}>
              {nbLikes}
            </Text>
          </TouchableOpacity>

          {/* Vues */}
          <View style={styles.cardMetaStat}>
            <FontAwesome6 name="eye" size={20} color="#9CA3AF" />
            <Text style={styles.cardMetaText}>{vues}</Text>
          </View>

          {item.medias?.length > 1 && (
            <View style={styles.cardMetaStat}>
              <FontAwesome6 name="images" size={18} color="#9CA3AF" />
              <Text style={styles.cardMetaText}>{item.medias.length}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.contactBtn, { borderColor: accent, backgroundColor: accentGlow }]}
            onPress={onContact} activeOpacity={0.75}
          >
            <FontAwesome6 name="comment" size={17} color={accent} style={{ marginRight: 5 }} />
            <Text style={[styles.contactBtnText, { color: accent }]}>{t('local.contact')}</Text>
          </TouchableOpacity>
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function LocalScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { t }      = useTranslation();
  const zoneName   = route.params?.zone || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('globe');
  const [search,      setSearch]      = useState('');
  const [publications,setPubs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [modeFilter,  setModeFilter]  = useState('all'); // 'all' | 'local' | 'duo'
  const [currentUser, setCurrentUser] = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNewPost,  setHasNewPost]  = useState(false);
  const [isFavorite,  setIsFavorite]  = useState(false);
  const [now,         setNow]         = useState(Date.now());
  const prevPubsCount = useRef(0);

  // Tick every minute to refresh countdowns and drop expired cards
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Animation FAB ──────────────────────────────────────────────────────────
  const fabPulse    = useRef(new Animated.Value(1)).current;
  const fabAnim     = useRef(null);

  // ── Scanner QR ────────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned,     setScanned]     = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (fabAnim.current) fabAnim.current.stop();
    if (modeFilter === 'local' || modeFilter === 'duo') {
      fabAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fabPulse, { toValue: 1.18, duration: 380, useNativeDriver: true }),
          Animated.timing(fabPulse, { toValue: 1,    duration: 380, useNativeDriver: true }),
        ])
      );
      fabAnim.current.start();
    } else {
      Animated.spring(fabPulse, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => { if (fabAnim.current) fabAnim.current.stop(); };
  }, [modeFilter]);

  // ── Menu latéral ───────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim   = useRef(new Animated.Value(width * 0.72)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: 0,   useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 1,   duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: width * 0.72, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  // ── Charger l'utilisateur connecté ────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      getCurrentUser().then(u => {
        setCurrentUser(u);
        if (u && zoneName) {
          checkFavorite(zoneName).then(setIsFavorite).catch(() => setIsFavorite(false));
        } else {
          setIsFavorite(false);
        }
      });
    }, [zoneName])
  );

  // ── Fetch publications depuis le backend ───────────────────────────────────
  const fetchPubs = useCallback(async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);

      const params = new URLSearchParams({
        page:  pageNum,
        limit: 10,
        ...(modeFilter !== 'all' && { mode: modeFilter }),
        ...(zoneName             && { ville: zoneName }),
        ...(search.trim()        && { search: search.trim() }),
      });

      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();

      const incoming = data.publications ?? [];
      setPubs(prev => {
        const next = reset || pageNum === 1 ? incoming : [...prev, ...incoming];
        if (next.length > prevPubsCount.current) {
          setHasNewPost(true);
        }
        prevPubsCount.current = next.length;
        return next;
      });
      setHasMore(pageNum < data.pages);
      setPage(pageNum);
    } catch (err) {
      console.error('[FETCH PUBS]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [modeFilter, zoneName, search]);

  // Charger au montage et quand les filtres changent
  useEffect(() => {
    fetchPubs(1, true);
  }, [fetchPubs]);

  // Pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchPubs(1, true);
  };

  // Pagination infinie
  const onEndReached = () => {
    if (!loadingMore && hasMore) fetchPubs(page + 1);
  };

  // ── Scanner QR — ouvrir et gérer le scan ─────────────────────────────────
  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(t('common.error'), t('profile.cameraPermission'));
        return;
      }
    }
    setScanned(false);
    setScannerOpen(true);
  };

  const handleScan = async ({ data: qrData }) => {
    if (scanned) return;
    setScanned(true);
    setScannerOpen(false);
    const match = qrData.match(/publications\/([a-f0-9]{24})(?:\/scan)?/i);
    if (!match) {
      Alert.alert('QR invalide', 'Ce QR code ne correspond pas à une publication ByMap.');
      setScanned(false);
      return;
    }
    const pubId = match[1];
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications/${pubId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        navigation.navigate('PublicationDetail', { publication: json.publication });
      } else {
        Alert.alert(t('common.error'), 'Publication introuvable.');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.networkError'));
    }
    setScanned(false);
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleMenuItem = async (key) => {
    closeMenu();
    if (key === 'map')       { navigation.navigate('Map');       return; }
    if (key === 'favorites') { navigation.navigate('Favorites'); return; }
    if (key === 'logout')    { await apiLogout(); setCurrentUser(null); return; }
  };

  const handleTab = (key) => {
    const item = TAB_ITEMS.find(t => t.key === key);
    if (item?.authRequired && !currentUser) {
      navigation.navigate('Login');
      return;
    }
    setActiveTab(key);
    if (key === 'globe')    navigation.navigate('Map');
    if (key === 'messages') navigation.navigate('ConversationsList');
    if (key === 'profile')  navigation.navigate(currentUser?.role === 'admin' ? 'AdminDashboard' : 'Profile');
  };

  const handleFabPress = () => {
    if (!currentUser) navigation.navigate('Login');
    else navigation.navigate('AjoutePub', {
      mode:     modeFilter !== 'all' ? modeFilter : undefined,
      zoneName: zoneName || undefined,
    });
  };

  // ── Renouveler un poste (+24h) ────────────────────────────────────────────
  const handleRenew = async (item) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications/${item._id}/renew`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setPubs(prev => prev.map(p =>
          p._id === item._id
            ? { ...p, expiresAt: data.expiresAt, statut: 'active' }
            : p
        ));
      } else {
        Alert.alert('Erreur', 'Impossible de renouveler.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de renouveler.');
    }
  };

  // ── Compteurs local / duo ─────────────────────────────────────────────────
  const localCount = publications.filter(p => p.mode === 'local').length;
  const duoCount   = publications.filter(p => p.mode === 'duo').length;

  // ── Filtrer côté client : expiré + recherche texte ───────────────────────
  const filtered = publications.filter(p => {
    if (p.expiresAt && new Date(p.expiresAt).getTime() <= now) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.description?.toLowerCase().includes(q) ||
      p.localisation?.ville?.toLowerCase().includes(q) ||
      p.localisationDebut?.ville?.toLowerCase().includes(q) ||
      p.localisationFin?.ville?.toLowerCase().includes(q)
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Map')} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={20} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('common.search')}
              placeholderTextColor={C.textFaint}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <FontAwesome6 name="xmark" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.8}>
            <FontAwesome6 name="qrcode" size={18} color="#1A1A2E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.8}>
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>

        {/* ── Nom de la zone ── */}
        <View style={styles.zoneRow}>
          <View style={styles.zoneTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              {zoneName ? <FontAwesome6 name="location-dot" size={18} color={C.local} /> : null}
              <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1}>
                {zoneName || t('local.allPubs')}
              </Text>
              {currentUser && zoneName ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={async () => {
                    try {
                      const next = await toggleFavorite(zoneName);
                      setIsFavorite(next);
                    } catch (_) {}
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome6
                    name="heart"
                    size={18}
                    color={isFavorite ? '#FF4C6A' : '#D1D5DB'}
                    solid={isFavorite}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            {hasNewPost && <View style={styles.greenDot} />}
          </View>
          {publications.length > 0 && (
            <Text style={styles.zoneSubtitle}>
              <Text style={styles.zoneSubLocal}>{localCount} local</Text>
              {'  ·  '}
              <Text style={styles.zoneSubDuo}>{duoCount} duo</Text>
            </Text>
          )}

          {/* Pills filtre LOCAL / DUO / TOUS */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                modeFilter === 'all'
                  ? { backgroundColor: C.glassMid, borderColor: C.glassBorder, borderWidth: 1 }
                  : { backgroundColor: C.glass,    borderColor: C.glassBorder, borderWidth: 1, opacity: 0.6 },
              ]}
              onPress={() => setModeFilter('all')}
              activeOpacity={0.75}
            >
              <FontAwesome6 name="globe" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterPill,
                modeFilter === 'local'
                  ? { backgroundColor: C.localGlow, borderColor: C.local, borderWidth: 1.5, shadowColor: C.local, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }
                  : { backgroundColor: C.glass,     borderColor: C.glassBorder, borderWidth: 1, opacity: 0.6 },
              ]}
              onPress={() => setModeFilter(modeFilter === 'local' ? 'all' : 'local')}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterText, { color: C.local, fontWeight: '900' }]}>LOCAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterPill,
                modeFilter === 'duo'
                  ? { backgroundColor: C.duoGlow, borderColor: C.duo, borderWidth: 1.5, shadowColor: C.duo, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }
                  : { backgroundColor: C.glass,   borderColor: C.glassBorder, borderWidth: 1, opacity: 0.6 },
              ]}
              onPress={() => setModeFilter(modeFilter === 'duo' ? 'all' : 'duo')}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterText, { color: C.duo, fontWeight: '900' }]}>DUO</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Liste des publications ── */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={C.duo} />
            <Text style={styles.loaderText}>{t('local.loadingPubs')}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.duo} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={C.duo} />
              ) : null
            }
            renderItem={({ item }) => (
              <PubCard
                item={item}
                currentUser={currentUser}
                now={now}
                onRenew={() => handleRenew(item)}
                onPress={() => navigation.navigate('PublicationDetail', { publication: item })}
                onContact={() => {
                  if (!currentUser) navigation.navigate('Login');
                  else navigation.navigate('Messages', { recipient: item.auteur });
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <FontAwesome6 name="inbox" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{t('local.noPubs')}</Text>
                <Text style={styles.emptyText}>
                  {zoneName
                    ? t('local.noPubsZone', { zone: zoneName })
                    : t('local.beFirst')}
                </Text>
              </View>
            }
          />
        )}

        {/* ── FAB + ── */}
        <Animated.View style={[
          styles.fab,
          modeFilter === 'local' && { shadowColor: C.local, shadowOpacity: 0.5 },
          modeFilter === 'duo'   && { shadowColor: C.duo,   shadowOpacity: 0.5 },
          { transform: [{ scale: fabPulse }] },
        ]}>
          <TouchableOpacity
            style={[
              styles.fabInner,
              modeFilter === 'local' && { backgroundColor: C.local },
              modeFilter === 'duo'   && { backgroundColor: C.duo   },
            ]}
            activeOpacity={0.85}
            onPress={handleFabPress}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Bottom Tab Bar ── */}
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((tab) => {
            const isActive  = activeTab === tab.key;
            const isLocked  = tab.authRequired && !currentUser;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isLocked && { opacity: 0.35 }]}
                onPress={() => handleTab(tab.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.tabIconBox, isActive && !isLocked && styles.tabIconBoxActive]}>
                  <FontAwesome6
                    name={tab.icon}
                    size={24}
                    color={isActive && !isLocked ? '#2DBD7E' : '#9CA3AF'}
                  />
                </View>
                <Text style={[styles.tabLabel, isActive && !isLocked && styles.tabLabelActive]}>
                  {t(tab.tKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ════════ MENU LATÉRAL ════════ */}
        {menuOpen && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.menuOverlay, { opacity: overlayAnim }]}>
              <TouchableWithoutFeedback onPress={closeMenu}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
            </Animated.View>

            <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuAnim }] }]}>
              <View style={styles.menuHeader}>
                <View style={styles.menuLogo}>
                  <FontAwesome6 name="location-dot" size={26} color={C.local} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuAppName}>ByMap</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <FontAwesome6
                      name={currentUser ? 'circle-check' : 'lock'}
                      size={11}
                      color={currentUser ? C.local : '#FF6B6B'}
                    />
                    <Text style={[styles.menuAppSub, { color: currentUser ? C.local : '#FF6B6B' }]}>
                      {currentUser ? 'Connecté' : 'Non connecté'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
                  <FontAwesome6 name="xmark" size={16} color="#1A1A2E" />
                </TouchableOpacity>
              </View>

              {currentUser ? (
                <View style={styles.menuUserCard}>
                  <FontAwesome6 name="circle-user" size={38} color="#9CA3AF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuUserName}>{currentUser.prenom || ''} {currentUser.nom || ''}</Text>
                    <Text style={styles.menuUserEmail} numberOfLines={1}>{currentUser.email || currentUser.phone || ''}</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.menuLoginBanner}
                  onPress={() => { closeMenu(); navigation.navigate('Login'); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.menuLoginBannerText}>{t('map.loginRegister')} →</Text>
                </TouchableOpacity>
              )}

              <ScrollView style={styles.menuItemsList} showsVerticalScrollIndicator={false}>
                {MENU_ITEMS.map((item) => {
                  if (item.key === 'logout' && !currentUser) return null;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.menuItem, item.danger && styles.menuItemDanger]}
                      onPress={() => handleMenuItem(item.key)}
                      activeOpacity={0.75}
                    >
                      <FontAwesome6
                        name={item.icon}
                        size={22}
                        color={item.danger ? '#EF4444' : '#6B7280'}
                        style={{ width: 28, textAlign: 'center' }}
                      />
                      <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                        {t(item.tKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.menuFooter}>ByMap v1.0.0</Text>
            </Animated.View>
          </View>
        )}

      </SafeAreaView>

      {/* ── QR Scanner ── */}
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerContainer}>
          {permission?.granted && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleScan}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          )}

          {/* Masques semi-transparents autour du viseur */}
          <View style={styles.scannerMask}>
            <View style={styles.scannerMaskRow}>
              <View style={styles.scannerMaskSide} />
              <View style={styles.scannerViewfinder}>
                <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
              </View>
              <View style={styles.scannerMaskSide} />
            </View>
          </View>

          <Text style={styles.scannerHint}>
            {t('local.scanHint')}
          </Text>

          <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerOpen(false)} activeOpacity={0.8}>
            <FontAwesome6 name="xmark" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

// ── Styles — thème clair mint ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: '#1A1A2E', fontWeight: '600' },
  searchBox: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9, gap: 6,
  },
  searchIcon:  { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E', padding: 0 },
  clearBtn:    { color: '#9CA3AF', fontSize: 13, paddingHorizontal: 2 },

  headerDots:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  headerDot:       { width: 18, height: 18, borderRadius: 9 },
  headerDotDimmed: { opacity: 0.25 },

  scanBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  menuBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 8,
    shadowColor: '#2DBD7E', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  menuLine: { width: 20, height: 2, backgroundColor: '#FFFFFF', borderRadius: 2 },

  // ── QR Scanner
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  scannerMaskRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerMaskSide: {
    flex: 1, height: 260,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scannerViewfinder: {
    width: 260, height: 260,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 36, height: 36,
    borderColor: '#2DBD7E', borderWidth: 4,
  },
  scannerCornerTL: { top: 0,    left: 0,   borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  scannerCornerTR: { top: 0,    right: 0,  borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 10 },
  scannerCornerBL: { bottom: 0, left: 0,   borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 10 },
  scannerCornerBR: { bottom: 0, right: 0,  borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 10 },
  scannerHint: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
    overflow: 'hidden',
  },
  scannerClose: {
    position: 'absolute', top: 56, right: 24,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Zone + filtres
  zoneRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20, fontWeight: '800',
    color: '#1A1A2E', letterSpacing: -0.3,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  filterText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  // ── Loader
  loaderBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 14, color: '#6B7280' },

  // ── Liste
  listContent: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120, gap: 14,
  },

  // ── Card blanche
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  cardAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, borderRadius: 2,
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 18, paddingRight: 14, paddingTop: 14, paddingBottom: 10,
  },
  cardAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  cardAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  cardAuthorName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  cardMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardLocation:   { fontSize: 12, color: '#6B7280', flex: 1 },
  cardTime:       { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  modeBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4, gap: 4,
  },
  modeDot:  { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  cardDesc: {
    fontSize: 14, color: '#4B5563',
    lineHeight: 22,
    paddingLeft: 18, paddingRight: 14, paddingBottom: 10,
  },

  cardImageWrap: {
    marginHorizontal: 14, marginBottom: 8,
    borderRadius: 14, overflow: 'hidden', height: 200,
  },
  cardImage: { width: '100%', height: '100%' },
  cardImageLoader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cardImagePlaceholder: {},
  cardImageIcon:        {},
  cardImageHint:        {},

  locLine: { fontSize: 11, color: '#9CA3AF' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingLeft: 18, paddingRight: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  cardAuthor:    { fontSize: 12, color: '#6B7280', fontWeight: '500', flex: 1 },
  cardMeta:      { flexDirection: 'row', gap: 10 },
  cardMetaStat:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText:  { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: '#3B7EF6', backgroundColor: 'rgba(59,126,246,0.08)',
  },
  contactBtnText: { fontSize: 12, color: '#3B7EF6', fontWeight: '700' },

  expiryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  expiryText: { fontSize: 9, fontWeight: '700' },

  renewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.10)',
    marginRight: 4,
  },
  renewBtnText: { fontSize: 11, color: '#F97316', fontWeight: '700' },

  // ── Empty
  emptyBox:   { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  emptyText:  { fontSize: 14, color: '#6B7280', lineHeight: 22, textAlign: 'center', paddingHorizontal: 32 },

  // ── FAB
  fab: {
    position: 'absolute', bottom: 130, right: 24,
    width: 56, height: 56, borderRadius: 28,
    shadowColor: '#2DBD7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  fabInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', fontWeight: '300', lineHeight: 32 },

  // ── Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 8, paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 10,
  },
  tabItem:          { flex: 1, alignItems: 'center', gap: 4 },
  tabIconBox:       { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  tabIconBoxActive: { backgroundColor: 'rgba(45,189,126,0.12)' },
  tabIcon:          { fontSize: 20 },
  tabIconActive:    { fontSize: 20 },
  tabLabel:         { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive:   { color: '#2DBD7E', fontWeight: '700' },

  // ════ MENU LATÉRAL ════
  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  menuPanel: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: width * 0.72, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: '#F8FAFB',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  menuLogo: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(45,189,126,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLogoText: { fontSize: 22 },
  menuAppName:  { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  menuAppSub:   { fontSize: 12, marginTop: 1 },
  menuClose: {
    marginLeft: 'auto', width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  menuCloseIcon:  { fontSize: 13, color: '#1A1A2E', fontWeight: '700' },
  menuUserCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#F8FAFB', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  menuUserAvatar: { fontSize: 28 },
  menuUserName:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  menuUserEmail:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  menuLoginBanner: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#2DBD7E', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  menuLoginBannerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  menuItemsList:  { flex: 1, paddingTop: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
    borderRadius: 12, marginHorizontal: 8, marginBottom: 2,
  },
  menuItemDanger:      { marginTop: 8 },
  menuItemIcon:        { fontSize: 22, width: 28, textAlign: 'center' },
  menuItemLabel:       { fontSize: 15, color: '#1A1A2E', fontWeight: '600' },
  menuItemLabelDanger: { color: '#EF4444' },
  menuFooter: {
    textAlign: 'center', color: '#9CA3AF',
    fontSize: 12, paddingBottom: 32, paddingTop: 12,
  },

  // ── Zone title row
  zoneTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greenDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6, elevation: 4,
  },
  zoneSubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginTop: 1 },
  zoneSubLocal: { color: '#2DBD7E', fontWeight: '700' },
  zoneSubDuo:   { color: '#3B7EF6', fontWeight: '700' },
});