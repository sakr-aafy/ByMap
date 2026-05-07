// src/screens/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../environments/environment';

const { width, height } = Dimensions.get('window');

// ─── Palette ByMap ───────────────────────────────────────────────────────────
const C = {
  blue:       '#1E90FF',
  blueDark:   '#0A6FCC',
  blueLight:  '#E8F3FF',
  grey:       '#4A4A5A',
  greyDark:   '#1E1E2E',
  greyLight:  '#F5F6FA',
  border:     '#E2E4EF',
  white:      '#FFFFFF',
  red:        '#FF3B30',
  green:      '#34C759',
  orange:     '#FF9500',
};

// ─── Config stats ────────────────────────────────────────────────────────────
const STAT_CONFIG = [
  { key: 'totalUsers',        label: 'Utilisateurs', icon: '👥', color: C.blue,   bg: C.blueLight },
  { key: 'totalPublications', label: 'Publications',  icon: '📝', color: C.orange, bg: '#FFF4E5'   },
  { key: 'lieux',             label: 'Lieux actifs',  icon: '📍', color: C.green,  bg: '#E8FAF0'   },
];

const CATEGORIES = ['Restaurant', 'Hôtel', 'Musée', 'Parc', 'Commerce', 'Sport', 'Santé', 'Autre'];


// ─── Composants utilitaires ───────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, bg, onPress }) => (
  <TouchableOpacity
    style={[styles.statCard, { backgroundColor: bg, borderLeftColor: color }]}
    onPress={onPress} activeOpacity={onPress ? 0.75 : 1}
  >
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {onPress && <Text style={[styles.statArrow, { color }]}>→</Text>}
  </TouchableOpacity>
);

const statusColor = (s) => {
  if (s === 'actif')  return C.green;
  if (s === 'bloqué') return C.red;
  return C.orange;
};

const UserRow = ({ item }) => (
  <View style={styles.userRow}>
    <View style={styles.userAvatar}>
      <Text style={styles.userAvatarText}>{item.name.charAt(0)}</Text>
    </View>
    <View style={styles.userInfo}>
      <Text style={styles.userName}>{item.name}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
    </View>
    <View style={styles.userMeta}>
      <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
        <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
      </View>
      <Text style={styles.userDate}>{item.date}</Text>
    </View>
  </View>
);

// ─── Modal Ajouter un lieu ────────────────────────────────────────────────────
const AddLieuModal = ({ visible, onClose, navigation, initialCoords }) => {
  const [nom,         setNom]         = useState('');
  const [adresse,     setAdresse]     = useState('');
  const [categorie,   setCategorie]   = useState('');
  const [description, setDescription] = useState('');
  const [latitude,    setLatitude]    = useState('');
  const [longitude,   setLongitude]   = useState('');

  // Pré-remplir coords si reçues depuis la carte
  useEffect(() => {
    if (initialCoords) {
      setLatitude(initialCoords.latitude.toFixed(6));
      setLongitude(initialCoords.longitude.toFixed(6));
    }
  }, [initialCoords]);

  const reset = () => {
    setNom(''); setAdresse(''); setCategorie('');
    setDescription(''); setLatitude(''); setLongitude('');
  };

  const handlePickOnMap = () => {
    // Ferme le modal et navigue vers MapScreen en mode sélection
    onClose();
    navigation.navigate('Map', { pickMode: true });
  };

  const handleConfirm = () => {
    if (!nom.trim())     { Alert.alert('Erreur', 'Le nom du lieu est obligatoire.'); return; }
    if (!adresse.trim()) { Alert.alert('Erreur', "L'adresse est obligatoire."); return; }
    if (!categorie)      { Alert.alert('Erreur', 'Choisissez une catégorie.'); return; }
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Erreur', 'Choisissez une zone sur la carte.'); return;
    }
    Alert.alert('✅ Lieu ajouté', `"${nom}" a été ajouté à la carte avec succès.`, [
      { text: 'OK', onPress: () => { reset(); onClose(); } },
    ]);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modal.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          <View style={modal.sheet}>

            {/* En-tête */}
            <View style={modal.header}>
              <Text style={modal.title}>📍 Ajouter un lieu</Text>
              <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
                <Text style={modal.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>

              {/* Nom */}
              <Text style={modal.label}>Nom du lieu <Text style={modal.required}>*</Text></Text>
              <TextInput
                style={modal.input}
                placeholder="Ex: Café Central"
                placeholderTextColor="#B0B3C6"
                value={nom}
                onChangeText={setNom}
              />

              {/* Adresse */}
              <Text style={modal.label}>Adresse <Text style={modal.required}>*</Text></Text>
              <TextInput
                style={modal.input}
                placeholder="Ex: 12 Avenue Habib Bourguiba, Tunis"
                placeholderTextColor="#B0B3C6"
                value={adresse}
                onChangeText={setAdresse}
              />

              {/* Catégorie */}
              <Text style={modal.label}>Catégorie <Text style={modal.required}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[modal.catChip, categorie === cat && modal.catChipActive]}
                      onPress={() => setCategorie(cat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[modal.catText, categorie === cat && modal.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Description */}
              <Text style={modal.label}>Description</Text>
              <TextInput
                style={[modal.input, modal.textArea]}
                placeholder="Décrivez ce lieu..."
                placeholderTextColor="#B0B3C6"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              {/* Zone sur la carte */}
              <Text style={modal.label}>Zone sur la carte <Text style={modal.required}>*</Text></Text>

              {/* Bouton choisir sur la carte */}
              <TouchableOpacity style={modal.mapPickBtn} onPress={handlePickOnMap} activeOpacity={0.85}>
                <Text style={modal.mapPickIcon}>🗺️</Text>
                <Text style={modal.mapPickText}>Choisir la zone sur la carte</Text>
              </TouchableOpacity>

              {/* Affichage des coordonnées si déjà choisies */}
              {latitude !== '' && longitude !== '' && (
                <View style={modal.coordsResult}>
                  <Text style={modal.coordsResultIcon}>✅</Text>
                  <View>
                    <Text style={modal.coordsResultLabel}>Zone sélectionnée</Text>
                    <Text style={modal.coordsResultVal}>
                      {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setLatitude(''); setLongitude(''); }}>
                    <Text style={modal.coordsClear}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Boutons */}
              <View style={modal.btnRow}>
                <TouchableOpacity style={modal.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={modal.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={modal.confirmBtn} onPress={handleConfirm} activeOpacity={0.88}>
                  <Text style={modal.confirmText}>✓ Confirmer</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ─── Vue liste utilisateurs ───────────────────────────────────────────────────
function UsersListView({ onBack, onSelectUser }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(true);
  const [loadMore, setLoadMore] = useState(false);

  const fetchUsers = useCallback(async (p = 1, q = search, reset = false) => {
    try {
      const token   = await AsyncStorage.getItem('accessToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res     = await fetch(`${API_URL}/admin/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(prev => reset ? data.users : [...prev, ...data.users]);
      setHasMore(p < data.pages);
      setPage(p);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
      setLoadMore(false);
    }
  }, [search]);

  useEffect(() => { setLoading(true); fetchUsers(1, search, true); }, [search]);

  const toggleActive = async (user) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/admin/users/${user._id}/toggle`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.map(u =>
        u._id === user._id ? { ...u, isActive: !u.isActive } : u
      ));
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier le statut.');
    }
  };

  const deleteUser = (user) => {
    Alert.alert(
      'Supprimer',
      `Supprimer ${[user.prenom, user.nom].filter(Boolean).join(' ') || user.email} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            const res   = await fetch(`${API_URL}/admin/users/${user._id}`, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error();
            setUsers(prev => prev.filter(u => u._id !== user._id));
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
        }},
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.ulHeader}>
        <TouchableOpacity onPress={onBack} style={styles.ulBackBtn} activeOpacity={0.7}>
          <Text style={styles.ulBackIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.ulTitle}>Utilisateurs</Text>
        <View style={styles.ulCount}>
          <Text style={styles.ulCountText}>{users.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.ulSearchBox}>
        <Text style={styles.ulSearchIcon}>🔍</Text>
        <TextInput
          style={styles.ulSearchInput}
          placeholder="Rechercher par nom, email…"
          placeholderTextColor="#B0B3C6"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.ulClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.ulLoader}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.ulList}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent: e }) => {
            if (!hasMore || loadMore) return;
            if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 60) {
              setLoadMore(true);
              fetchUsers(page + 1, search, false);
            }
          }}
          scrollEventThrottle={200}
        >
          {users.length === 0 && (
            <View style={styles.ulEmpty}>
              <Text style={styles.ulEmptyIcon}>👤</Text>
              <Text style={styles.ulEmptyText}>Aucun utilisateur trouvé</Text>
            </View>
          )}
          {users.map((u) => {
            const name   = [u.prenom, u.nom].filter(Boolean).join(' ') || '—';
            const initia = name[0]?.toUpperCase() || '?';
            const active = u.isActive !== false;
            return (
              <TouchableOpacity key={u._id} style={styles.ulCard} onPress={() => onSelectUser(u)} activeOpacity={0.8}>
                <View style={[styles.ulAvatar, { backgroundColor: active ? C.blueLight : '#F5F5F5' }]}>
                  <Text style={[styles.ulAvatarText, { color: active ? C.blue : C.grey }]}>{initia}</Text>
                </View>
                <View style={styles.ulInfo}>
                  <Text style={styles.ulName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.ulEmail} numberOfLines={1}>{u.email || u.phone || '—'}</Text>
                  <View style={[styles.ulBadge, { backgroundColor: active ? C.green + '22' : C.red + '22' }]}>
                    <View style={[styles.ulBadgeDot, { backgroundColor: active ? C.green : C.red }]} />
                    <Text style={[styles.ulBadgeText, { color: active ? C.green : C.red }]}>
                      {active ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                </View>
                <View style={styles.ulActions}>
                  <TouchableOpacity
                    style={[styles.ulActionBtn, { backgroundColor: active ? C.orange + '18' : C.green + '18', borderColor: active ? C.orange : C.green }]}
                    onPress={(e) => { e.stopPropagation?.(); toggleActive(u); }} activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 14 }}>{active ? '🔒' : '🔓'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ulActionBtn, { backgroundColor: C.red + '15', borderColor: C.red }]}
                    onPress={(e) => { e.stopPropagation?.(); deleteUser(u); }} activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
          {loadMore && <ActivityIndicator color={C.blue} style={{ marginVertical: 12 }} />}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Vue publications d'un utilisateur ───────────────────────────────────────
function UserPostsView({ user, onBack }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_URL}/publications?auteur=${user._id}&limit=50`, { headers });
        if (res.ok) {
          const data = await res.json();
          setPosts(data.publications || data.pubs || data.data || []);
        }
      } catch {
        Alert.alert('Erreur', 'Impossible de charger les publications.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user._id]);

  const name = [user.prenom, user.nom].filter(Boolean).join(' ') || user.email || '—';

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.ulHeader}>
        <TouchableOpacity onPress={onBack} style={styles.ulBackBtn} activeOpacity={0.7}>
          <Text style={styles.ulBackIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.ulTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.upSubtitle}>Publications</Text>
        </View>
        <View style={styles.ulCount}>
          <Text style={styles.ulCountText}>{posts.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.ulLoader}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.ulEmpty}>
          <Text style={styles.ulEmptyIcon}>📭</Text>
          <Text style={styles.ulEmptyText}>Aucune publication</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.upList} showsVerticalScrollIndicator={false}>
          {posts.map((p) => {
            const isLocal = p.mode === 'local';
            const accent  = isLocal ? C.green : C.blue;
            const loc     = isLocal
              ? [p.localisation?.ville, p.localisation?.gouvernorat].filter(Boolean).join(', ')
              : [p.localisationDebut?.ville, '→', p.localisationFin?.ville].filter(Boolean).join(' ');
            const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : '';
            return (
              <View key={p._id} style={styles.upCard}>
                <View style={styles.upCardLeft}>
                  <View style={[styles.upModeBadge, { backgroundColor: accent + '20', borderColor: accent }]}>
                    <Text style={[styles.upModeText, { color: accent }]}>{isLocal ? '📍 LOCAL' : '🤝 DUO'}</Text>
                  </View>
                  <Text style={styles.upDesc} numberOfLines={2}>{p.description || '—'}</Text>
                  {!!loc && <Text style={styles.upLoc} numberOfLines={1}>📍 {loc}</Text>}
                </View>
                <View style={styles.upCardRight}>
                  <Text style={styles.upDate}>{date}</Text>
                  <Text style={styles.upLikes}>❤️ {p.nbLikes ?? p.likes?.length ?? 0}</Text>
                  <Text style={styles.upViews}>👁 {p.vues ?? 0}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigation = useNavigation();
  const route      = useRoute();

  const [view,         setView]         = useState('dashboard'); // 'dashboard' | 'users' | 'userPosts'
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pickedCoords, setPickedCoords] = useState(null);
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [recentUsers,  setRecentUsers]  = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`,       { headers }),
        fetch(`${API_URL}/admin/users?limit=5`, { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setRecentUsers(data.users || []);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les statistiques.');
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (route?.params?.pickedCoords) {
      setPickedCoords(route.params.pickedCoords);
      setModalVisible(true);
    }
  }, [route?.params?.pickedCoords]);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter du panneau admin ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: () => navigation.replace('Login') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <AddLieuModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setPickedCoords(null); }}
        navigation={navigation}
        initialCoords={pickedCoords}
      />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>🛡️ Admin Panel</Text>
          <Text style={styles.topBarSub}>ByMap — Tableau de bord</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* ── Vue utilisateurs ── */}
      {view === 'users' && (
        <UsersListView
          onBack={() => setView('dashboard')}
          onSelectUser={(u) => { setSelectedUser(u); setView('userPosts'); }}
        />
      )}

      {/* ── Vue publications d'un user ── */}
      {view === 'userPosts' && selectedUser && (
        <UserPostsView
          user={selectedUser}
          onBack={() => setView('users')}
        />
      )}

      {/* ── Dashboard principal ── */}
      {view === 'dashboard' && (
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor={C.blue} />}
      >
        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeTitle}>Bienvenue, Admin 👋</Text>
          <Text style={styles.welcomeSub}>Voici un aperçu de l'activité de la plateforme ByMap.</Text>
        </View>

        {/* ── Stats ── */}
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        {statsLoading ? (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {STAT_CONFIG.map((cfg) => (
              <StatCard
                key={cfg.key}
                label={cfg.label}
                value={stats ? String(stats[cfg.key] ?? 0) : '—'}
                icon={cfg.icon}
                color={cfg.color}
                bg={cfg.bg}
                onPress={cfg.key === 'totalUsers' ? () => setView('users') : undefined}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ─── Styles principaux ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.greyDark },
  topBar: {
    backgroundColor: C.greyDark,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: { fontSize: 18, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  topBarSub:   { fontSize: 12, color: '#8A8B9E', marginTop: 2 },
  logoutBtn: {
    backgroundColor: C.red + '22',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.red + '55',
  },
  logoutText: { color: C.red, fontWeight: '700', fontSize: 13 },
  content:    { flex: 1, backgroundColor: C.greyLight, paddingHorizontal: 16 },
  welcomeBox: {
    marginTop: 20, marginBottom: 8, padding: 18,
    backgroundColor: C.blue, borderRadius: 16,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: C.white },
  welcomeSub:   { fontSize: 13, color: '#D0E8FF', marginTop: 4 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: C.greyDark, marginTop: 20, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  seeAll:        { fontSize: 13, color: C.blue, fontWeight: '600' },
  statsLoading:  { paddingVertical: 32, alignItems: 'center' },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: (width - 44) / 2, padding: 16, borderRadius: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon:  { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: C.grey, marginTop: 2, fontWeight: '600' },
  statArrow: { fontSize: 12, fontWeight: '800', marginTop: 6, alignSelf: 'flex-end' },

  // ── UsersListView ─────────────────────────────────────────────────────────
  ulHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.greyDark },
  ulBackBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  ulBackIcon:  { fontSize: 18, color: C.white, fontWeight: '700' },
  ulTitle:     { fontSize: 18, fontWeight: '800', color: C.white, flex: 1 },
  ulCount:     { backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  ulCountText: { fontSize: 12, fontWeight: '800', color: C.white },
  ulSearchBox: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, gap: 8 },
  ulSearchIcon:  { fontSize: 15 },
  ulSearchInput: { flex: 1, fontSize: 14, color: C.greyDark, padding: 0 },
  ulClear:       { fontSize: 14, color: C.grey, fontWeight: '700', paddingHorizontal: 4 },
  ulLoader:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ulList:     { paddingHorizontal: 12, paddingBottom: 40, gap: 10 },
  ulEmpty:    { alignItems: 'center', paddingTop: 60, gap: 10 },
  ulEmptyIcon:{ fontSize: 48 },
  ulEmptyText:{ fontSize: 15, color: C.grey, fontWeight: '600' },
  ulCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, padding: 12, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  ulAvatar:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  ulAvatarText: { fontSize: 18, fontWeight: '800' },
  ulInfo:     { flex: 1, gap: 3 },
  ulName:     { fontSize: 14, fontWeight: '700', color: C.greyDark },
  ulEmail:    { fontSize: 11, color: C.grey },
  ulBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  ulBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  ulBadgeText:{ fontSize: 11, fontWeight: '700' },
  ulActions:  { gap: 6 },
  ulActionBtn:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },

  // ── UserPostsView ──────────────────────────────────────────────────────────
  upSubtitle:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  upList:      { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  upCard:      { flexDirection: 'row', backgroundColor: C.white, borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  upCardLeft:  { flex: 1, gap: 6 },
  upCardRight: { alignItems: 'flex-end', gap: 6, minWidth: 52 },
  upModeBadge: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 3 },
  upModeText:  { fontSize: 11, fontWeight: '800' },
  upDesc:      { fontSize: 13, color: C.greyDark, fontWeight: '500', lineHeight: 18 },
  upLoc:       { fontSize: 11, color: C.grey },
  upDate:      { fontSize: 11, color: C.grey, fontWeight: '600' },
  upLikes:     { fontSize: 12, color: C.grey },
  upViews:     { fontSize: 12, color: C.grey },
  tableCard: {
    backgroundColor: C.white, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  rowDivider:     { height: 1, backgroundColor: C.border, marginHorizontal: 14 },
  userAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueLight, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '800', color: C.blue },
  userInfo:       { flex: 1 },
  userName:       { fontSize: 14, fontWeight: '700', color: C.greyDark },
  userEmail:      { fontSize: 11, color: C.grey, marginTop: 1 },
  userMeta:       { alignItems: 'flex-end', gap: 4 },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  userDate:       { fontSize: 10, color: '#B0B3C6' },
  emptyTable:     { textAlign: 'center', padding: 20, color: C.grey, fontSize: 13 },
  actionsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionBtn: {
    width: (width - 44) / 2, backgroundColor: C.white, borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  actionIcon:  { fontSize: 26 },
  actionLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});

// ─── Styles Modal ─────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  sheet: {
    width: '100%', maxHeight: height * 0.88,
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:    { fontSize: 18, fontWeight: '800', color: C.greyDark },
  closeBtn: { padding: 6, backgroundColor: C.greyLight, borderRadius: 20 },
  closeX:   { fontSize: 14, color: C.grey, fontWeight: '700' },
  label:    { fontSize: 13, fontWeight: '700', color: C.grey, marginBottom: 6 },
  required: { color: C.red },
  input: {
    backgroundColor: C.greyLight, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.greyDark, marginBottom: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.greyLight, borderWidth: 1.5, borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  catText:       { fontSize: 13, color: C.grey, fontWeight: '600' },
  catTextActive: { color: C.blue },

  // Bouton choisir sur la carte
  mapPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.blueLight, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.blue,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12,
  },
  mapPickIcon: { fontSize: 20 },
  mapPickText: { fontSize: 14, color: C.blue, fontWeight: '700', flex: 1 },

  // Résultat coordonnées
  coordsResult: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E8FAF0', borderRadius: 12,
    borderWidth: 1.5, borderColor: C.green,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14,
  },
  coordsResultIcon:  { fontSize: 18 },
  coordsResultLabel: { fontSize: 12, color: C.grey, fontWeight: '600' },
  coordsResultVal:   { fontSize: 13, color: C.greyDark, fontWeight: '700', marginTop: 2 },
  coordsClear:       { fontSize: 16, color: C.grey, marginLeft: 'auto' },

  btnRow:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: C.greyLight, borderWidth: 1.5, borderColor: C.border,
  },
  cancelText:  { fontSize: 15, fontWeight: '700', color: C.grey },
  confirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: C.blue,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  confirmText: { fontSize: 15, fontWeight: '800', color: C.white, letterSpacing: 0.5 },
});