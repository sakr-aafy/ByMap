// src/screens/DuoScreen.js
import React, { useState, useRef, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, Animated, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../utils/api';
import { environment } from '../environments/environment.prod';

const API_URL     = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');

const C = {
  local:       '#2DBD7E',
  localGlow:   'rgba(45,189,126,0.12)',
  duo:         '#3B7EF6',
  duoGlow:     'rgba(59,126,246,0.12)',
  intl:        '#7C3AED',
  intlGlow:    'rgba(124,58,237,0.10)',
  glassBorder: '#E5E7EB',
  textFaint:   '#9CA3AF',
  red:         '#EF4444',
};

// 3 niveaux
const LEVELS = [
  { key: 'entrants',      label: 'Entrants',      icon: 'arrow-right',    color: C.local, glow: C.localGlow },
  { key: 'sortants',      label: 'Sortants',      icon: 'arrow-left',     color: C.duo,   glow: C.duoGlow   },
  { key: 'international', label: 'International', icon: 'globe',          color: C.intl,  glow: C.intlGlow  },
];

const fixMediaUrl = (url) =>
  url ? url.replace(/^https?:\/\/[^/]+/, SERVER_BASE) : null;

const timeAgo = (d) => {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60)    return `${Math.floor(s)}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
};

// Catégorisation côté client
const matchZone = (str, zone) =>
  !!(str && zone && str.toLowerCase().includes(zone.toLowerCase()));

const getCategories = (pub, zone) => {
  const deb = pub.localisationDebut;
  const fin = pub.localisationFin;
  const inDeb = matchZone(deb?.ville, zone) || matchZone(deb?.gouvernorat, zone);
  const inFin = matchZone(fin?.ville, zone) || matchZone(fin?.gouvernorat, zone);
  const crossGov = deb?.gouvernorat && fin?.gouvernorat && deb.gouvernorat !== fin.gouvernorat;
  const cats = new Set();
  if (inFin && !inDeb)  cats.add('entrants');
  if (inDeb && !inFin)  cats.add('sortants');
  if (inDeb && inFin) { cats.add('entrants'); cats.add('sortants'); }
  if (crossGov && (inDeb || inFin)) cats.add('international');
  if (cats.size === 0) { cats.add('entrants'); cats.add('sortants'); }
  return cats;
};

// ─────────────────────────────────────────────────────────────────────────────
// PubCard
// ─────────────────────────────────────────────────────────────────────────────
const PubCard = ({ item, level, onPress, onContact, currentUser }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const [imgError,    setImgError]    = useState(false);
  const [imgLoading,  setImgLoading]  = useState(true);
  const [liked,       setLiked]       = useState(false);
  const [nbLikes,     setNbLikes]     = useState(item.nbLikes ?? item.likes?.length ?? 0);
  const [vues,        setVues]        = useState(item.vues ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const lvl = LEVELS.find(l => l.key === level) || LEVELS[0];
  const deb = item.localisationDebut;
  const fin = item.localisationFin;
  const routeLine = [deb?.ville, fin?.ville].filter(Boolean).join(' → ');
  const govLine   = (deb?.gouvernorat && fin?.gouvernorat && deb.gouvernorat !== fin.gouvernorat)
    ? `${deb.gouvernorat} → ${fin.gouvernorat}` : (deb?.gouvernorat || '');
  const authorName    = [item.auteur?.prenom, item.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const imageUri = fixMediaUrl(item.medias?.find(m => m.type === 'image')?.url);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const handleLike = async () => {
    if (likeLoading) return;
    if (!currentUser) { onContact(); return; }
    setLikeLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications/${item._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked); setNbLikes(data.nbLikes);
        Animated.sequence([
          Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 4 }),
          Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 6 }),
        ]).start();
      }
    } catch {}
    setLikeLoading(false);
  };

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { setVues(v => v + 1); onPress(); }}
        onPressIn={onPressIn} onPressOut={onPressOut}
      >
        <View style={[styles.cardAccentBar, { backgroundColor: lvl.color }]} />

        {/* Header */}
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={level === 'entrants' ? [C.local,'#28A745'] : level === 'sortants' ? [C.duo,'#0A6FCC'] : [C.intl,'#5B21B6']}
            style={styles.cardAvatar}
          >
            <Text style={styles.cardAvatarText}>{authorInitial}</Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardAuthorName} numberOfLines={1}>{authorName}</Text>
            {routeLine ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                <FontAwesome6 name="route" size={11} color={C.textFaint} />
                <Text style={styles.cardRoute} numberOfLines={1}>{routeLine}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            ) : null}
            {govLine ? (
              <Text style={[styles.cardGov, { color: lvl.color }]} numberOfLines={1}>{govLine}</Text>
            ) : null}
          </View>

          <View style={[styles.modeBadge, { backgroundColor: lvl.glow, borderColor: lvl.color }]}>
            <FontAwesome6 name={lvl.icon} size={10} color={lvl.color} />
            <Text style={[styles.modeText, { color: lvl.color }]}>{lvl.label.toUpperCase()}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
        ) : null}

        {imageUri && !imgError ? (
          <View style={styles.cardImageWrap}>
            <Image
              source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover"
              onLoadStart={() => setImgLoading(true)}
              onLoadEnd={() => setImgLoading(false)}
              onError={() => { setImgError(true); setImgLoading(false); }}
            />
            {imgLoading && (
              <View style={styles.cardImageLoader}>
                <ActivityIndicator size="small" color={lvl.color} />
              </View>
            )}
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.cardMetaStat} onPress={handleLike} activeOpacity={0.7}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Animated.View style={{ transform:[{ scale: heartScale }] }}>
              <FontAwesome6 name="heart" size={22} color={liked ? C.red : C.textFaint} solid={liked} />
            </Animated.View>
            <Text style={[styles.cardMetaText, liked && { color: C.red, fontWeight:'700' }]}>{nbLikes}</Text>
          </TouchableOpacity>

          <View style={styles.cardMetaStat}>
            <FontAwesome6 name="eye" size={20} color={C.textFaint} />
            <Text style={styles.cardMetaText}>{vues}</Text>
          </View>

          {item.medias?.length > 1 && (
            <View style={styles.cardMetaStat}>
              <FontAwesome6 name="images" size={18} color={C.textFaint} />
              <Text style={styles.cardMetaText}>{item.medias.length}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.contactBtn, { borderColor: lvl.color, backgroundColor: lvl.glow }]}
            onPress={onContact} activeOpacity={0.75}
          >
            <FontAwesome6 name="comment" size={15} color={lvl.color} style={{ marginRight:5 }} />
            <Text style={[styles.contactBtnText, { color: lvl.color }]}>Contacter</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function DuoScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const zoneName   = route.params?.zone || '';

  const [search,       setSearch]      = useState('');
  const [publications, setPubs]        = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRefreshing]  = useState(false);
  const [loadingMore,  setLoadingMore] = useState(false);
  const [page,         setPage]        = useState(1);
  const [hasMore,      setHasMore]     = useState(true);
  const [currentUser,  setCurrentUser] = useState(null);
  const [activeLevel,  setActiveLevel] = useState('entrants');

  useFocusEffect(useCallback(() => { getCurrentUser().then(setCurrentUser); }, []));

  const fetchPubs = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const params = new URLSearchParams({
        page: pageNum, limit: 50,
        mode: 'duo',
        ...(zoneName.trim() && { ville: zoneName.trim() }),
        ...(search.trim()   && { search: search.trim() }),
      });
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/publications?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = data.publications ?? [];
      setPubs(prev => pageNum === 1 ? list : [...prev, ...list]);
      setHasMore(pageNum < (data.pages ?? 1));
      setPage(pageNum);
    } catch {}
    finally {
      setLoading(false); setRefreshing(false); setLoadingMore(false);
    }
  }, [zoneName, search]);

  useFocusEffect(useCallback(() => { fetchPubs(1); }, [fetchPubs]));

  const onRefresh    = () => { setRefreshing(true); fetchPubs(1); };
  const onEndReached = () => { if (!loadingMore && hasMore) fetchPubs(page + 1); };

  // Filtrage par niveau
  const byLevel = (lvl) => publications.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(p.description?.toLowerCase().includes(q) ||
            p.localisationDebut?.ville?.toLowerCase().includes(q) ||
            p.localisationFin?.ville?.toLowerCase().includes(q))) return false;
    }
    return getCategories(p, zoneName).has(lvl);
  });

  const lists  = { entrants: byLevel('entrants'), sortants: byLevel('sortants'), international: byLevel('international') };
  const lvl    = LEVELS.find(l => l.key === activeLevel);
  const data   = lists[activeLevel];

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={20} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={C.textFaint}
              value={search} onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <FontAwesome6 name="xmark" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.menuBtn} onPress={() => navigation.navigate('Map')} activeOpacity={0.8}>
            <FontAwesome6 name="map" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Titre zone ── */}
        <View style={styles.zoneRow}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <View style={styles.countryBadge}>
              <Text style={styles.countryCode}>TN</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tunisia</Text>
              {zoneName ? (
                <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                  <FontAwesome6 name="location-dot" size={11} color={C.local} />
                  <Text style={styles.sectionZone}>{zoneName}</Text>
                </View>
              ) : null}
              <Text style={styles.sectionSub}>International DUO</Text>
            </View>
          </View>
          {/* ── Stats par niveau ── */}
          {!loading && (
            <View style={styles.statsRow}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.statChip, { borderColor: l.color, backgroundColor: activeLevel === l.key ? l.color : 'transparent' }]}
                  onPress={() => setActiveLevel(l.key)}
                  activeOpacity={0.75}
                >
                  <FontAwesome6 name={l.icon} size={11} color={activeLevel === l.key ? '#fff' : l.color} />
                  <Text style={[styles.statChipText, { color: activeLevel === l.key ? '#fff' : l.color }]}>
                    {lists[l.key]?.length ?? 0}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Tabs 3 niveaux ── */}
        <View style={styles.tabsRow}>
          {LEVELS.map((l) => {
            const active = activeLevel === l.key;
            const count  = lists[l.key]?.length ?? 0;
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.levelTab, active && { borderBottomColor: l.color, borderBottomWidth: 3 }]}
                onPress={() => setActiveLevel(l.key)}
                activeOpacity={0.75}
              >
                <FontAwesome6 name={l.icon} size={14} color={active ? l.color : '#9CA3AF'} />
                <Text style={[styles.levelTabText, active && { color: l.color, fontWeight:'800' }]}>
                  {l.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.levelBadge, { backgroundColor: active ? l.color : '#E5E7EB' }]}>
                    <Text style={[styles.levelBadgeText, active && { color:'#FFF' }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        

        {/* ── Liste ── */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={lvl.color} />
            <Text style={styles.loaderText}>Chargement…</Text>
          </View>
        ) : (
          <FlatList
            key={activeLevel}
            data={data}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lvl.color} />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical:16 }} color={lvl.color} /> : null}
            renderItem={({ item }) => (
              <PubCard
                item={item}
                level={activeLevel}
                currentUser={currentUser}
                onPress={() => navigation.navigate('PublicationDetail', { publication: item })}
                onContact={() => {
                  if (!currentUser) navigation.navigate('Login');
                  else navigation.navigate('Messages', { recipient: item.auteur });
                }}
              />
            )}
            
          />
        )}

        {/* ── Bottom Tab Bar ── */}
        <View style={styles.tabBar}>
          {[
            { key:'map',     label:'Carte',    icon:'globe',   screen:'Map'               },
            { key:'chat',    label:'Messages', icon:'message', screen:'ConversationsList', auth:true },
            { key:'profile', label:'Profil',   icon:'user',    screen:'Profile',           auth:true },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key} style={styles.tabItem} activeOpacity={0.8}
              onPress={() => {
                if (!tab.screen) return;
                if (tab.auth && !currentUser) { navigation.navigate('Login'); return; }
                navigation.navigate(tab.screen);
              }}
            >
              <View style={styles.tabIconBox}>
                <FontAwesome6 name={tab.icon} size={22} color="#9CA3AF" />
              </View>
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:'transparent' },

  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:14, paddingVertical:10,
    backgroundColor:'#FFFFFF',
    borderBottomWidth:1, borderBottomColor:'#F0F0F0', gap:10,
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.06, shadowRadius:8, elevation:4,
  },
  backBtn: {
    width:38, height:38, borderRadius:19,
    backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB',
    justifyContent:'center', alignItems:'center',
  },
  searchBox: {
    flex:1, flexDirection:'row', alignItems:'center',
    backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB',
    borderRadius:22, paddingHorizontal:12, paddingVertical:9, gap:6,
  },
  searchInput: { flex:1, fontSize:14, color:'#1A1A2E', padding:0 },
  menuBtn: {
    width:38, height:38, borderRadius:12, backgroundColor:'#2DBD7E',
    justifyContent:'center', alignItems:'center',
    shadowColor:'#2DBD7E', shadowOpacity:0.35, shadowRadius:8,
    shadowOffset:{width:0,height:3}, elevation:6,
  },

  zoneRow: {
    backgroundColor:'#FFFFFF', borderBottomWidth:1, borderBottomColor:'#F0F0F0',
    paddingHorizontal:16, paddingTop:12, paddingBottom:12,
  },
  countryBadge: {
    width:44, height:44, borderRadius:12,
    borderWidth:1.5, borderColor:'#2DBD7E',
    backgroundColor:'rgba(45,189,126,0.10)',
    justifyContent:'center', alignItems:'center',
  },
  countryCode:  { fontSize:16, fontWeight:'900', color:'#2DBD7E', letterSpacing:0.5 },
  sectionTitle: { fontSize:18, fontWeight:'800', color:'#1A1A2E', letterSpacing:-0.3 },
  sectionZone:  { fontSize:12, fontWeight:'700', color:'#2DBD7E' },
  sectionSub:   { fontSize:11, fontWeight:'600', color:'#3B7EF6', marginTop:2 },
  statsRow: {
    flexDirection:'row', gap:8, marginTop:10,
  },
  statChip: {
    flexDirection:'row', alignItems:'center', gap:5,
    borderRadius:20, borderWidth:1.5,
    paddingHorizontal:10, paddingVertical:5,
  },
  statChipText: { fontSize:12, fontWeight:'800' },

  // Tabs niveaux
  tabsRow: {
    flexDirection:'row', backgroundColor:'#FFFFFF',
    borderBottomWidth:1, borderBottomColor:'#F0F0F0',
  },
  levelTab: {
    flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
    paddingVertical:12, gap:5,
    borderBottomWidth:3, borderBottomColor:'transparent',
  },
  levelTabText: { fontSize:12, fontWeight:'600', color:'#9CA3AF' },
  levelBadge: {
    minWidth:18, height:18, borderRadius:9,
    justifyContent:'center', alignItems:'center', paddingHorizontal:5,
  },
  levelBadgeText: { fontSize:10, fontWeight:'800', color:'#6B7280' },

  levelBanner: {
    flexDirection:'row', alignItems:'center', gap:7,
    paddingHorizontal:16, paddingVertical:9,
  },
  levelBannerText: { fontSize:12, fontWeight:'600' },

  loaderBox:  { flex:1, justifyContent:'center', alignItems:'center', gap:12 },
  loaderText: { fontSize:14, color:'#6B7280' },
  listContent: { paddingHorizontal:16, paddingTop:14, paddingBottom:120, gap:14 },

  card: {
    backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#F0F0F0',
    borderRadius:20, overflow:'hidden',
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.07, shadowRadius:16, elevation:4,
  },
  cardAccentBar: { position:'absolute', left:0, top:0, bottom:0, width:4, borderRadius:2 },
  cardHeader: {
    flexDirection:'row', alignItems:'center', gap:10,
    paddingLeft:18, paddingRight:14, paddingTop:14, paddingBottom:10,
  },
  cardAvatar:     { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center' },
  cardAvatarText: { color:'#FFFFFF', fontWeight:'800', fontSize:17 },
  cardAuthorName: { fontSize:15, fontWeight:'700', color:'#1A1A2E' },
  cardRoute:      { fontSize:12, fontWeight:'600', color:'#4B5563', flex:1 },
  cardGov:        { fontSize:11, fontWeight:'500', marginTop:2 },
  cardTime:       { fontSize:11, color:'#9CA3AF', fontWeight:'500' },

  modeBadge: {
    flexDirection:'row', alignItems:'center', gap:4,
    borderRadius:20, borderWidth:1, paddingHorizontal:8, paddingVertical:4,
  },
  modeText: { fontSize:9, fontWeight:'800', letterSpacing:0.3 },

  cardDesc: { fontSize:14, color:'#4B5563', lineHeight:22, paddingLeft:18, paddingRight:14, paddingBottom:10 },
  cardImageWrap: { marginHorizontal:14, marginBottom:8, borderRadius:14, overflow:'hidden', height:200 },
  cardImage:     { width:'100%', height:'100%' },
  cardImageLoader: {
    position:'absolute', top:0, left:0, right:0, bottom:0,
    justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.06)',
  },

  cardFooter: {
    flexDirection:'row', alignItems:'center', gap:14,
    paddingLeft:18, paddingRight:14, paddingVertical:12,
    borderTopWidth:1, borderTopColor:'#F3F4F6', backgroundColor:'#FAFAFA',
  },
  cardMetaStat:   { flexDirection:'row', alignItems:'center', gap:4 },
  cardMetaText:   { fontSize:12, color:'#6B7280', fontWeight:'500' },
  contactBtn: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:14, paddingVertical:6,
    borderRadius:20, borderWidth:1.5,
  },
  contactBtnText: { fontSize:12, fontWeight:'700' },

  emptyBox:   { alignItems:'center', paddingTop:60, gap:10 },
  emptyTitle: { fontSize:18, fontWeight:'800', color:'#1A1A2E' },
  emptyText:  { fontSize:14, color:'#6B7280', lineHeight:22, textAlign:'center', paddingHorizontal:32 },

  fab: {
    position:'absolute', bottom:90, right:24,
    width:56, height:56, borderRadius:28,
    justifyContent:'center', alignItems:'center',
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.25, shadowRadius:16, elevation:12,
  },
  fabIcon: { fontSize:28, color:'#FFFFFF', fontWeight:'300', lineHeight:32 },

  tabBar: {
    flexDirection:'row', backgroundColor:'#FFFFFF',
    borderTopWidth:1, borderTopColor:'#F0F0F0',
    paddingBottom:8, paddingTop:10,
    shadowColor:'#000', shadowOffset:{width:0,height:-2},
    shadowOpacity:0.06, shadowRadius:8, elevation:10,
  },
  tabItem:          { flex:1, alignItems:'center', gap:4 },
  tabIconBox: { width:40, height:40, borderRadius:14, justifyContent:'center', alignItems:'center', backgroundColor:'transparent' },
  tabLabel:         { fontSize:11, color:'#9CA3AF', fontWeight:'500' },
});