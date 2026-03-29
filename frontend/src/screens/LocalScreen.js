// src/screens/LocalScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  FlatList,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { environment } from '../environments/environment.prod';
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

// ── Couleurs ──────────────────────────────────────────────────────────────────
const C = {
  local:      '#34C759',   // vert  → LOCAL
  localLight: '#E8F9EE',
  localBorder:'#A8E6BA',
  duo:        '#1E90FF',   // bleu  → DUO
  duoLight:   '#EBF4FF',
  duoBorder:  '#A0CAFF',
  bg:         '#F5F6FA',
  white:      '#FFFFFF',
  border:     '#EEEFF5',
  text:       '#1a1a2e',
  grey:       '#888',
  dark:       '#111',
};

// ── Menu items ────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { key: 'home',      label: 'Accueil',       icon: '🏠' },
  { key: 'map',       label: 'Carte',          icon: '🗺️' },
  { key: 'favorites', label: 'Mes favoris',    icon: '❤️' },
  { key: 'myads',     label: 'Mes annonces',   icon: '📋' },
  { key: 'settings',  label: 'Paramètres',     icon: '⚙️' },
  { key: 'help',      label: 'Aide & Support', icon: '💬' },
  { key: 'logout',    label: 'Déconnexion',    icon: '🚪', danger: true },
];

// ── Bottom Tab Bar items ───────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: 'globe',   label: 'Globe',   icon: '🌍' },
  { key: 'search',  label: 'Search',  icon: '🔍' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant PubCard — carte LOCAL (vert) ou DUO (bleu)
// Correspond exactement au wireframe 003 / 003b
// ─────────────────────────────────────────────────────────────────────────────
const PubCard = ({ item, onPress }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const [imgError,   setImgError]   = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const isLocal      = item.mode === 'local';
  const accent       = isLocal ? C.local : C.duo;
  const accentBg     = isLocal ? C.localLight : C.duoLight;
  const accentBorder = isLocal ? C.localBorder : C.duoBorder;

  const authorName = [item.auteur?.prenom, item.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const locLine = isLocal
    ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(' · ')
    : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');

  const firstImage = item.medias?.find(m => m.type === 'image');
  const imageUri   = firstImage ? fixMediaUrl(firstImage.url) : null;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>

        {/* ── Header : avatar + nom + temps + badge ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardAvatar, { backgroundColor: accent }]}>
            <Text style={styles.cardAvatarText}>{authorInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardAuthorName} numberOfLines={1}>{authorName}</Text>
            <View style={styles.cardMetaRow}>
              {locLine ? <Text style={styles.cardLocation} numberOfLines={1}>📍 {locLine}</Text> : null}
              <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: accentBg, borderColor: accentBorder }]}>
            <View style={[styles.modeDot, { backgroundColor: accent }]} />
            <Text style={[styles.modeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
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

        {/* ── Footer : likes + vues ── */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardMetaText}>❤️ {item.nbLikes ?? item.likes?.length ?? 0}</Text>
          <Text style={styles.cardMetaText}>👁 {item.vues ?? 0}</Text>
          {item.medias?.length > 1 && (
            <Text style={styles.cardMetaText}>🖼 {item.medias.length}</Text>
          )}
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function LocalScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
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
  const [hasNewPost, setHasNewPost] = useState(false);
  const prevPubsCount = useRef(0);

  // ── Animation FAB ──────────────────────────────────────────────────────────
  const fabPulse    = useRef(new Animated.Value(1)).current;
  const fabAnim     = useRef(null);

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
      getCurrentUser().then(setCurrentUser);
    }, [])
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

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleMenuItem = async (key) => {
    closeMenu();
    if (key === 'map')    { navigation.navigate('Map'); return; }
    if (key === 'logout') { await apiLogout(); setCurrentUser(null); return; }
  };

  const handleTab = (key) => {
    setActiveTab(key);
    if (key === 'globe') navigation.navigate('Map');
    if (key === 'profile') navigation.navigate('Profile');
  };

  const handleFabPress = () => {
    if (!currentUser) navigation.navigate('Login');
    else navigation.navigate('AjoutePub');
  };

  // ── Compteurs local / duo ─────────────────────────────────────────────────
  const localCount = publications.filter(p => p.mode === 'local').length;
  const duoCount   = publications.filter(p => p.mode === 'duo').length;

  // ── Filtrer côté client par recherche texte ───────────────────────────────
  const filtered = publications.filter(p => {
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#B0B3C6"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cercles LOCAL (vert) et DUO (bleu) — wireframe 003 header icons */}
        <View style={styles.headerDots}>
          <TouchableOpacity
            onPress={() => setModeFilter(modeFilter === 'local' ? 'all' : 'local')}
            activeOpacity={0.8}
          >
            <View style={[
              styles.headerDot,
              { backgroundColor: C.local },
              modeFilter !== 'local' && styles.headerDotDimmed,
            ]} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setModeFilter(modeFilter === 'duo' ? 'all' : 'duo')}
            activeOpacity={0.8}
          >
            <View style={[
              styles.headerDot,
              { backgroundColor: C.duo },
              modeFilter !== 'duo' && styles.headerDotDimmed,
            ]} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.8}>
          <View style={styles.menuLine} />
          <View style={[styles.menuLine, { width: 14 }]} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </View>

      {/* ── Nom de la zone ── */}
      <View style={styles.zoneRow}>
        <View style={styles.zoneTitleRow}>
          <Text style={styles.sectionTitle}>
            {zoneName ? `📍 ${zoneName}` : 'Toutes les publications'}
          </Text>
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
                ? { backgroundColor: C.dark, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 }
                : { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.dark, opacity: 0.55 },
            ]}
            onPress={() => setModeFilter('all')}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 18 }}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: C.local },
              modeFilter === 'local' && { shadowColor: C.local, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
              modeFilter !== 'local' && { opacity: 0.55 },
            ]}
            onPress={() => setModeFilter(modeFilter === 'local' ? 'all' : 'local')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, { color: C.white, fontWeight: '900' }]}>LOCAL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { backgroundColor: C.duo },
              modeFilter === 'duo' && { shadowColor: C.duo, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
              modeFilter !== 'duo' && { opacity: 0.55 },
            ]}
            onPress={() => setModeFilter(modeFilter === 'duo' ? 'all' : 'duo')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, { color: C.white, fontWeight: '900' }]}>DUO</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Liste des publications ── */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={C.duo} />
          <Text style={styles.loaderText}>Chargement des publications…</Text>
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
              onPress={() => navigation.navigate('PublicationDetail', { publication: item })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune publication</Text>
              <Text style={styles.emptyText}>
                {zoneName
                  ? `Aucune publication dans la zone « ${zoneName} »`
                  : 'Soyez le premier à publier !'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── FAB + ── */}
      <Animated.View style={[styles.fab, { transform: [{ scale: fabPulse }] }]}>
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
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => handleTab(tab.key)} activeOpacity={0.8}>
              <View style={[styles.tabIconBox, isActive && styles.tabIconBoxActive]}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
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
                <Text style={styles.menuLogoText}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuAppName}>ByMap</Text>
                <Text style={styles.menuAppSub}>{currentUser ? '✅ Connecté' : '🔒 Non connecté'}</Text>
              </View>
              <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
                <Text style={styles.menuCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {currentUser ? (
              <View style={styles.menuUserCard}>
                <Text style={styles.menuUserAvatar}>👤</Text>
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
                <Text style={styles.menuLoginBannerText}>Se connecter / S'inscrire →</Text>
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
                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                    <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                      {item.label}
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
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: 38,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0F1F8',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: C.dark, fontWeight: '600' },
  searchBox: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F1F8',
    borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9, gap: 6,
  },
  searchIcon:  { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, color: C.dark, padding: 0 },
  clearBtn:    { color: '#aaa', fontSize: 13, paddingHorizontal: 2 },

  // Cercles LOCAL/DUO dans le header
  headerDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  headerDot: {
    width: 18, height: 18, borderRadius: 9,
  },
  headerDotDimmed: { opacity: 0.3 },

  menuBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0F1F8',
    justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 8,
  },
  menuLine: { width: 20, height: 2, backgroundColor: C.dark, borderRadius: 2 },

  // ── Zone + filtres
  zoneRow: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.dark,
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row', gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  // ── Loader
  loaderBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 14, color: C.grey },

  // ── Liste
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 12,
  },

  // ── Card
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Header : avatar + auteur + temps + badge
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 12, paddingBottom: 8,
  },
  cardAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  cardAvatarText: { color: C.white, fontWeight: '800', fontSize: 16 },
  cardAuthorName: { fontSize: 14, fontWeight: '700', color: C.dark },
  cardMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardLocation:   { fontSize: 11, color: C.grey, flex: 1 },
  cardTime:       { fontSize: 11, color: C.grey, fontWeight: '500' },

  // Badge LOCAL / DUO
  modeBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
    gap: 4,
  },
  modeDot:  { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Description
  cardDesc: {
    fontSize: 13, color: '#444',
    lineHeight: 20,
    paddingHorizontal: 12, paddingBottom: 10,
  },

  // Image
  cardImageWrap: {
    width: '100%', height: 200, overflow: 'hidden',
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

  // Ligne localisation (conservé pour compatibilité)
  locLine: { fontSize: 11, color: C.grey },

  // Footer : likes + vues
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cardAuthor:   { fontSize: 12, color: C.grey, fontWeight: '500', flex: 1 },
  cardMeta:     { flexDirection: 'row', gap: 10 },
  cardMetaText: { fontSize: 12, color: C.grey, fontWeight: '500' },

  // ── Empty
  emptyBox:   { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#555' },
  emptyText:  { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 32 },

  // ── FAB
  fab: {
    position: 'absolute', bottom: 88, right: 24,
    width: 56, height: 56, borderRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 10,
  },
  fabInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.dark,
    justifyContent: 'center', alignItems: 'center',
  },
  fabIcon: { fontSize: 28, color: C.white, fontWeight: '300', lineHeight: 32 },

  // ── Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingBottom: 6, paddingTop: 8,
  },
  tabItem:          { flex: 1, alignItems: 'center', gap: 4 },
  tabIconBox:       { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  tabIconBoxActive: { backgroundColor: C.dark },
  tabIcon:          { fontSize: 18 },
  tabIconActive:    { fontSize: 18 },
  tabLabel:         { fontSize: 11, color: '#999', fontWeight: '500' },
  tabLabelActive:   { color: C.dark, fontWeight: '700' },

  // ════ MENU LATÉRAL ════
  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  menuPanel: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: width * 0.72, backgroundColor: C.white,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  menuLogo: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#1E90FF18',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLogoText: { fontSize: 22 },
  menuAppName:  { fontSize: 17, fontWeight: '800', color: C.dark, letterSpacing: -0.3 },
  menuAppSub:   { fontSize: 12, color: C.grey, marginTop: 1 },
  menuClose: {
    marginLeft: 'auto', width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F0F1F8', justifyContent: 'center', alignItems: 'center',
  },
  menuCloseIcon:  { fontSize: 13, color: '#555', fontWeight: '700' },
  menuUserCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#F5F6FA', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
    borderWidth: 1, borderColor: C.border,
  },
  menuUserAvatar: { fontSize: 28 },
  menuUserName:   { fontSize: 15, fontWeight: '700', color: C.dark },
  menuUserEmail:  { fontSize: 12, color: C.grey, marginTop: 2 },
  menuLoginBanner: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: C.duo, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  menuLoginBannerText: { color: C.white, fontWeight: '700', fontSize: 14 },
  menuItemsList:  { flex: 1, paddingTop: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
    borderRadius: 12, marginHorizontal: 8, marginBottom: 2,
  },
  menuItemDanger:      { marginTop: 8 },
  menuItemIcon:        { fontSize: 20, width: 28, textAlign: 'center' },
  menuItemLabel:       { fontSize: 15, color: '#222', fontWeight: '600' },
  menuItemLabelDanger: { color: '#FF3B30' },
  menuFooter: {
    textAlign: 'center', color: '#ccc',
    fontSize: 12, paddingBottom: 32, paddingTop: 12,
  },

  // ── Zone title row (with green dot)
  zoneTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greenDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.local,
    shadowColor: C.local, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4, elevation: 4,
  },
  zoneSubtitle: { fontSize: 12, color: C.grey, fontWeight: '600', marginTop: 1 },
  zoneSubLocal: { color: C.local, fontWeight: '700' },
  zoneSubDuo:   { color: C.duo,   fontWeight: '700' },

});