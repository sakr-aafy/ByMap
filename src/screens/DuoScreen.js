import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const CARD_W = width - 48;

// ── Données fictives d'annonces ───────────────────────────────────────────────
const ADS = [
  {
    id: '1',
    title: 'Appartement F3 à Tunis',
    subtitle: 'Centre ville · 850 DT/mois',
    type: 'image',
    tag: 'Immobilier',
    tagColor: '#1E90FF',
  },
  {
    id: '2',
    title: 'Samsung Galaxy S24 Ultra',
    subtitle: 'Ariana · 2 800 DT',
    type: 'slide',
    slideText: 'Écran 6.8" · 200MP · Neuf sous emballage',
    tag: 'Électronique',
    tagColor: '#FF6B35',
  },
  {
    id: '3',
    title: 'Voiture Clio 5 · 2022',
    subtitle: 'La Marsa · 32 000 DT',
    type: 'image',
    tag: 'Véhicules',
    tagColor: '#34C759',
  },
  {
    id: '4',
    title: 'Canapé angle moderne',
    subtitle: 'Manouba · 1 200 DT',
    type: 'slide',
    slideText: 'Très bon état · Livraison possible',
    tag: 'Mobilier',
    tagColor: '#AF52DE',
  },
  {
    id: '5',
    title: 'Villa avec piscine',
    subtitle: 'Hammamet · 450 000 DT',
    type: 'image',
    tag: 'Immobilier',
    tagColor: '#1E90FF',
  },
];

// ── Composant Card ─────────────────────────────────────────────────────────────
const AdCard = ({ item, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Tag catégorie */}
        <View style={[styles.cardTag, { backgroundColor: item.tagColor + '18' }]}>
          <View style={[styles.tagDot, { backgroundColor: item.tagColor }]} />
          <Text style={[styles.tagText, { color: item.tagColor }]}>{item.tag}</Text>
        </View>

        {/* Titre */}
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>

        {/* Contenu : image ou slide texte */}
        {item.type === 'image' ? (
          <View style={styles.cardImageBox}>
            <View style={styles.cardImagePlaceholder}>
              <Text style={styles.cardImageIcon}>🖼️</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cardSlideBox}>
            <Text style={styles.cardSlideText}>{item.slideText}</Text>
          </View>
        )}

        {/* Sous-titre */}
        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Bottom Tab Bar ─────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: 'globe',   label: 'Globe',   icon: '🌍' },
  { key: 'search',  label: 'Search',  icon: '🔍' },
  { key: 'profile', label: 'Profile', icon: '👤' },
];

// ── Écran principal ────────────────────────────────────────────────────────────
export default function DuoScreen() {
  const navigation  = useNavigation();
  const [activeTab, setActiveTab] = useState('globe');
  const [search,    setSearch]    = useState('');
  const [ads,       setAds]       = useState(ADS);

  const filtered = ads.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleTab = (key) => {
    setActiveTab(key);
    if (key === 'globe') navigation.navigate('Map');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        {/* Barre de recherche */}
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
      </View>

      {/* ── Titre section ── */}
      <Text style={styles.sectionTitle}>LOCAL ADS</Text>

      {/* ── Liste des annonces ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            onPress={() => {/* TODO: navigate to detail */}}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Aucune annonce trouvée</Text>
          </View>
        }
      />

      {/* ── Bouton + flottant ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => {/* TODO: ajouter annonce */}}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* ── Bottom Tab Bar ── */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleTab(tab.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.tabIconBox, isActive && styles.tabIconBoxActive]}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },

  // Header
  header: {
    top:30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF5',
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F1F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: '#222', fontWeight: '600' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F1F8',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  clearBtn:    { color: '#aaa', fontSize: 13, paddingHorizontal: 2 },

  // Titre
  sectionTitle: {
    top:20,
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
    paddingVertical: 14,
    letterSpacing: 1,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF5',
  },

  // Liste
  listContent: {
    top:5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EEEFF5',
  },
  cardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    marginBottom: 8,
  },
  tagDot:  { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 10,
  },

  // Zone image
  cardImageBox: {
    height: 110,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E8F0FE',
    marginBottom: 10,
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImageIcon: { fontSize: 32, opacity: 0.4 },

  // Zone slide texte
  cardSlideBox: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C5D8FF',
    borderStyle: 'dashed',
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  cardSlideText: {
    fontSize: 13,
    color: '#7A9CC6',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  // Empty
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#aaa', fontWeight: '500' },

  // FAB +
  fab: {
    position: 'absolute',
    bottom: 88,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 32,
  },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    paddingBottom: 6,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabIconBoxActive: {
    backgroundColor: '#111',
  },
  tabIcon: {
    fontSize: 18,
  },
  tabIconActive: {
    fontSize: 18,
  },
  tabLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#111',
    fontWeight: '700',
  },
});
