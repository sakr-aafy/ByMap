// src/screens/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

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

// ─── Données ─────────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Utilisateurs', value: '1 284', icon: '👥', color: C.blue,  bg: C.blueLight },
  { label: 'Lieux actifs', value: '3 471', icon: '📍', color: C.green, bg: '#E8FAF0'   },
];

const CATEGORIES = ['Restaurant', 'Hôtel', 'Musée', 'Parc', 'Commerce', 'Sport', 'Santé', 'Autre'];

const RECENT_USERS = [
  { id: 1, name: 'Amine Trabelsi',  email: 'amine@example.com',   status: 'actif',      date: '22/03/2026' },
  { id: 2, name: 'Sara Ben Salah',  email: 'sara@example.com',    status: 'actif',      date: '21/03/2026' },
  { id: 3, name: 'Karim Mansour',   email: 'karim@example.com',   status: 'bloqué',     date: '20/03/2026' },
  { id: 4, name: 'Nour Khalil',     email: 'nour@example.com',    status: 'actif',      date: '19/03/2026' },
  { id: 5, name: 'Yassine Amri',    email: 'yassine@example.com', status: 'en attente', date: '18/03/2026' },
];

// ─── Composants utilitaires ───────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, bg }) => (
  <View style={[styles.statCard, { backgroundColor: bg, borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
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

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const [modalVisible, setModalVisible] = useState(false);
  const [pickedCoords, setPickedCoords] = useState(null);

  // Réception des coordonnées depuis MapScreen après sélection
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

      {/* ── Contenu principal ── */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeTitle}>Bienvenue, Admin 👋</Text>
          <Text style={styles.welcomeSub}>Voici un aperçu de l'activité de la plateforme ByMap.</Text>
        </View>

        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        <View style={styles.statsGrid}>
          {STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Utilisateurs récents</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Voir tout →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableCard}>
          {RECENT_USERS.map((u, idx) => (
            <View key={u.id}>
              <UserRow item={u} />
              {idx < RECENT_USERS.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={[styles.actionLabel, { color: C.blue }]}>Ajouter un lieu</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: (width - 44) / 2, padding: 16, borderRadius: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon:  { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: C.grey, marginTop: 2, fontWeight: '600' },
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