// src/screens/AjoutPub.js
import React, { useState, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TUNISIA from '../../assets/tunisia.json';
import { environment } from '../environments/environment';

const API_URL = environment.apiUrl;

// ── Palette mint clair ─────────────────────────────────────────────────────────
const C = {
  green:     '#2DBD7E', greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6', blueGlow:  'rgba(59,126,246,0.10)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  red:       '#EF4444',
};

// ── Helpers tunisia.json ───────────────────────────────────────────────────────
const GOUVERNORATS = Object.keys(TUNISIA).sort();
function getDelegations(gov) { if (!gov || !TUNISIA[gov]) return []; return [...new Set(TUNISIA[gov].map(r => r.delegation))].sort(); }
function getLocalites(gov, deleg) {
  if (!gov || !deleg || !TUNISIA[gov]) return [];
  return TUNISIA[gov].filter(r => r.delegation === deleg).map(r => r.localite).filter(Boolean).sort();
}

// ── MediaPicker ────────────────────────────────────────────────────────────────
function MediaPicker({ media, setMedia, accent }) {
  const pickFromGallery = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les paramètres."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? ['videos'] : ['images'],
      allowsMultipleSelection: true, quality: 0.85, videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const added = result.assets.map(a => ({ uri: a.uri, type: a.type || type, fileName: a.fileName || `media_${Date.now()}`, mimeType: a.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg') }));
      setMedia(prev => [...prev, ...added]);
    }
  };
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les paramètres."); return; }
    const type = await new Promise((resolve) => {
      Alert.alert('Appareil photo', 'Que voulez-vous capturer ?', [
        { text: 'Photo',  onPress: () => resolve('image') },
        { text: 'Vidéo',  onPress: () => resolve('video') },
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!type) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: type === 'video' ? ['videos'] : ['images'], quality: 0.85, videoMaxDuration: 60 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia(prev => [...prev, { uri: asset.uri, type, fileName: asset.fileName || `media_${Date.now()}`, mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg') }]);
    }
  };
  const showOptions = () => Alert.alert('Ajouter des médias', '', [
    { text: 'Photos depuis la galerie',    onPress: () => pickFromGallery('image') },
    { text: 'Vidéos depuis la galerie',    onPress: () => pickFromGallery('video') },
    { text: 'Prendre une photo / vidéo',   onPress: pickFromCamera },
    { text: 'Annuler', style: 'cancel' },
  ]);
  const removeMedia = (index) => setMedia(prev => prev.filter((_, i) => i !== index));

  return (
    <View>
      {media.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {media.map((item, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {item.type === 'video' && (
                <View style={styles.thumbPlayBadge}>
                  <FontAwesome6 name="play" size={8} color="#FFFFFF" />
                </View>
              )}
              <TouchableOpacity style={styles.thumbRemove} onPress={() => removeMedia(i)}>
                <FontAwesome6 name="xmark" size={10} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.thumbAdd, { borderColor: accent, backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]} onPress={showOptions} activeOpacity={0.75}>
            <FontAwesome6 name="plus" size={22} color={accent} />
          </TouchableOpacity>
        </ScrollView>
      )}
      {media.length === 0 && (
        <TouchableOpacity style={[styles.photoBox, { borderColor: accent, backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]} onPress={showOptions} activeOpacity={0.8}>
          <View style={[styles.photoIconWrap, { backgroundColor: accent === C.green ? 'rgba(45,189,126,0.15)' : 'rgba(59,126,246,0.12)' }]}>
            <FontAwesome6 name="camera" size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.photoTitle, { color: accent }]}>Ajouter des médias</Text>
            <Text style={styles.photoSub}>Photo ou vidéo (max 60s)</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={14} color={accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Selector ───────────────────────────────────────────────────────────────────
function Selector({ label, value, items, onSelect, placeholder, disabled, accent }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => items.filter(i => i.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled, value && { borderColor: accent }]}
        onPress={() => { if (!disabled) { setSearch(''); setOpen(true); } }}
        activeOpacity={disabled ? 1 : 0.75}
      >
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder, value && { color: C.text }]}>
          {value || placeholder}
        </Text>
        <FontAwesome6 name="chevron-down" size={13} color={value ? accent : C.textFaint} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{label}</Text>
          <View style={styles.modalSearchWrap}>
            <FontAwesome6 name="magnifying-glass" size={13} color={C.textFaint} />
            <TextInput
              style={styles.modalSearch}
              placeholder="Rechercher..."
              placeholderTextColor={C.textFaint}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered} keyExtractor={item => item} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item === value && { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow, borderRadius: 10 }]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[styles.modalItemText, item === value && { fontWeight: '700', color: accent }]}>{item}</Text>
                {item === value && <FontAwesome6 name="check" size={14} color={accent} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>Aucun résultat</Text>}
          />
        </View>
      </Modal>
    </>
  );
}

// ── LocalisationBlock ──────────────────────────────────────────────────────────
function LocalisationBlock({ prefix, showDeleg, mode, loc, setLoc }) {
  const delegations = useMemo(() => getDelegations(loc.ville), [loc.ville]);
  const localites   = useMemo(() => getLocalites(loc.ville, loc.gouvernorat), [loc.ville, loc.gouvernorat]);
  const handleVille = (v) => setLoc({ ville: v, gouvernorat: '', delegation: '' });
  const handleGov   = (g) => setLoc(prev => ({ ...prev, gouvernorat: g, delegation: '' }));
  const handleDeleg = (d) => setLoc(prev => ({ ...prev, delegation: d }));
  const accent = mode === 'duo' ? C.blue : C.green;

  return (
    <View style={styles.locBlock}>
      {prefix && (
        <View style={[styles.locPrefixBar, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow, borderColor: accent }]}>
          <FontAwesome6 name={prefix === 'Début' ? 'rocket' : 'flag-checkered'} size={11} color={accent} />
          <Text style={[styles.locPrefixText, { color: accent }]}>{prefix}</Text>
        </View>
      )}
      <View style={styles.locRow}>
        <View style={styles.locLabelRow}>
          <FontAwesome6 name="city" size={12} color={C.textDim} />
          <Text style={styles.locLabel}>Ville</Text>
        </View>
        <Selector label="Choisir une ville" value={loc.ville} items={GOUVERNORATS} onSelect={handleVille} placeholder="Sélectionner..." accent={accent} />
      </View>
      <View style={[styles.locRow, !loc.ville && styles.locRowDisabled]}>
        <View style={styles.locLabelRow}>
          <FontAwesome6 name="map" size={12} color={!loc.ville ? C.textFaint : C.textDim} />
          <Text style={[styles.locLabel, !loc.ville && styles.locLabelDisabled]}>Gouvernorat</Text>
        </View>
        <Selector label="Choisir un gouvernorat" value={loc.gouvernorat} items={delegations} onSelect={handleGov} placeholder={loc.ville ? 'Sélectionner...' : "Choisir une ville d'abord"} disabled={!loc.ville} accent={accent} />
      </View>
      {showDeleg && (
        <View style={[styles.locRow, !loc.gouvernorat && styles.locRowDisabled]}>
          <View style={styles.locLabelRow}>
            <FontAwesome6 name="location-pin" size={12} color={!loc.gouvernorat ? C.textFaint : C.textDim} />
            <Text style={[styles.locLabel, !loc.gouvernorat && styles.locLabelDisabled]}>Délégation</Text>
            <Text style={styles.locOptional}>(optionnel)</Text>
          </View>
          <Selector label="Choisir une délégation" value={loc.delegation} items={localites} onSelect={handleDeleg} placeholder={loc.gouvernorat ? 'Sélectionner...' : "Choisir un gouvernorat d'abord"} disabled={!loc.gouvernorat} accent={accent} />
        </View>
      )}
    </View>
  );
}

// ── Field card ─────────────────────────────────────────────────────────────────
const Field = ({ label, iconName, accent, children }) => (
  <View style={styles.fieldWrap}>
    <View style={styles.fieldLabelRow}>
      <View style={[styles.fieldIconBox, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]}>
        <FontAwesome6 name={iconName} size={14} color={accent} />
      </View>
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
    {children}
  </View>
);

const emptyLoc = () => ({ ville: '', gouvernorat: '', delegation: '' });

// ── Écran principal ────────────────────────────────────────────────────────────
export default function AjoutePub() {
  const navigation = useNavigation();
  const route      = useRoute();

  // Si un filtre (local/duo) est passé depuis LocalScreen, on le pré-sélectionne
  const initialMode = route.params?.mode && route.params.mode !== 'all'
    ? route.params.mode
    : 'local';

  const [mode,    setMode]    = useState(initialMode);
  const [desc,    setDesc]    = useState('');
  const [media,   setMedia]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loc,      setLoc]      = useState(emptyLoc());
  const [locDebut, setLocDebut] = useState(emptyLoc());
  const [locFin,   setLocFin]   = useState(emptyLoc());

  const accent    = mode === 'duo' ? C.blue : C.green;
  const accentGlow = mode === 'duo' ? C.blueGlow : C.greenGlow;

  const handleModeChange = (m) => { setMode(m); setLoc(emptyLoc()); setLocDebut(emptyLoc()); setLocFin(emptyLoc()); };
  const canSubmit = desc.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { Alert.alert('Session expirée', 'Veuillez vous reconnecter pour publier.', [{ text: 'Se connecter', onPress: () => navigation.replace('Login') }]); return; }
      const formData = new FormData();
      formData.append('mode', mode);
      formData.append('description', desc.trim());
      if (mode === 'local') { formData.append('ville', loc.ville); formData.append('gouvernorat', loc.gouvernorat); formData.append('delegation', loc.delegation); }
      else {
        formData.append('debut_ville', locDebut.ville); formData.append('debut_gouvernorat', locDebut.gouvernorat);
        formData.append('fin_ville', locFin.ville); formData.append('fin_gouvernorat', locFin.gouvernorat);
      }
      media.forEach((item, index) => {
        const ext = item.uri.split('.').pop() || 'jpg';
        formData.append('medias', { uri: item.uri, type: item.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'), name: item.fileName || `media_${index}.${ext}` });
      });
      const response = await fetch(`${API_URL}/publications`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await response.json();
      if (!response.ok) { Alert.alert('Erreur', data.message || 'Impossible de publier'); return; }
      Alert.alert('Publication créée !', 'Votre annonce a bien été enregistrée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch { Alert.alert('Erreur réseau', 'Vérifiez votre connexion et réessayez.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Nouvelle publication</Text>
            <View style={[styles.headerModeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
              <View style={[styles.headerModeDot, { backgroundColor: accent }]} />
              <Text style={[styles.headerModeText, { color: accent }]}>{mode === 'local' ? 'LOCAL' : 'DUO'}</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Tabs LOCAL / DUO ── */}
        <View style={styles.tabsWrap}>
          <TouchableOpacity
            style={[styles.tab, mode === 'local' && styles.tabActiveLocal]}
            onPress={() => handleModeChange('local')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="location-dot" size={14} color={mode === 'local' ? '#FFFFFF' : C.textFaint} />
            <Text style={[styles.tabText, mode === 'local' && styles.tabTextActive]}>Publication locale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'duo' && styles.tabActiveDuo]}
            onPress={() => handleModeChange('duo')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="handshake" size={14} color={mode === 'duo' ? '#FFFFFF' : C.textFaint} />
            <Text style={[styles.tabText, mode === 'duo' && styles.tabTextActive]}>Publication duo</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Field label="Description" iconName="pen-to-square" accent={accent}>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Décrivez votre annonce..."
                placeholderTextColor={C.textFaint}
                value={desc} onChangeText={setDesc}
                multiline numberOfLines={4} textAlignVertical="top"
              />
            </Field>

            <Field label="Photo / Vidéo" iconName="camera" accent={accent}>
              <MediaPicker media={media} setMedia={setMedia} accent={accent} />
            </Field>

            {mode === 'local' ? (
              <Field label="Localisation" iconName="location-dot" accent={accent}>
                <LocalisationBlock showDeleg={true} mode="local" loc={loc} setLoc={setLoc} />
              </Field>
            ) : (
              <>
                <Field label="Localisation Début" iconName="rocket" accent={accent}>
                  <LocalisationBlock prefix="Début" showDeleg={false} mode="duo" loc={locDebut} setLoc={setLocDebut} />
                </Field>
                <Field label="Localisation Fin" iconName="flag-checkered" accent={accent}>
                  <LocalisationBlock prefix="Fin" showDeleg={false} mode="duo" loc={locFin} setLoc={setLocFin} />
                </Field>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: accent }, !canSubmit && { opacity: 0.5 }]}
              onPress={handleSubmit} activeOpacity={0.85} disabled={!canSubmit}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <>
                    <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Publier</Text>
                  </>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
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
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  headerModeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  headerModeDot:   { width: 6, height: 6, borderRadius: 3 },
  headerModeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // ── Tabs
  tabsWrap: {
    flexDirection: 'row', margin: 16,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 5, gap: 5,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 7,
  },
  tabActiveLocal: {
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  tabActiveDuo: {
    backgroundColor: '#3B7EF6',
    shadowColor: '#3B7EF6', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  tabText:       { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // ── Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },

  // ── Field card
  fieldWrap: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  fieldIconBox:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  fieldLabel:    { fontSize: 14, fontWeight: '800', color: '#1A1A2E', letterSpacing: 0.1 },

  // ── Input
  input: {
    backgroundColor: '#F8FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1A1A2E',
  },
  textarea: { minHeight: 90, paddingTop: 11, textAlignVertical: 'top' },

  // ── Media picker
  photoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  photoIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  photoTitle:    { fontSize: 14, fontWeight: '700' },
  photoSub:      { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  thumbRow:  { marginBottom: 4 },
  thumbWrap: {
    width: 90, height: 90, borderRadius: 12, marginRight: 8,
    overflow: 'hidden', backgroundColor: '#E5E7EB',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlayBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  thumbAdd: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Localisation
  locBlock:         { gap: 12 },
  locPrefixBar:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 2 },
  locPrefixText:    { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  locRow:           { gap: 6 },
  locRowDisabled:   { opacity: 0.4 },
  locLabelRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locLabel:         { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  locLabelDisabled: { color: '#9CA3AF' },
  locOptional:      { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },

  // ── Selector
  selector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  selectorDisabled:    { opacity: 0.45 },
  selectorText:        { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  selectorPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  // ── Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 32, maxHeight: '75%',
    borderTopWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 16,
  },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 12, textAlign: 'center' },
  modalSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, marginBottom: 10 },
  modalSearch:  { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1A1A2E' },
  modalItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText:{ flex: 1, fontSize: 14, color: '#1A1A2E' },
  modalEmpty:   { textAlign: 'center', color: '#9CA3AF', paddingVertical: 24, fontSize: 14 },

  // ── Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 8, borderRadius: 16, paddingVertical: 17,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
