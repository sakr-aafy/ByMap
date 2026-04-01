// src/screens/AjoutPub.js
import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, KeyboardAvoidingView, Platform, Modal, FlatList,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TUNISIA from '../../assets/tunisia.json';
import { environment } from '../environments/environment.prod';
import { D, G, shadow, DarkBackground, GlassView } from '../theme/index';

const API_URL = environment.apiUrl;

// ── Helpers tunisia.json ──────────────────────────────────────────────────────
const GOUVERNORATS = Object.keys(TUNISIA).sort();
function getDelegations(gov) { if (!gov || !TUNISIA[gov]) return []; return [...new Set(TUNISIA[gov].map(r => r.delegation))].sort(); }
function getLocalites(gov, deleg) {
  if (!gov || !deleg || !TUNISIA[gov]) return [];
  return TUNISIA[gov].filter(r => r.delegation === deleg).map(r => r.localite).filter(Boolean).sort();
}

// ── MediaPicker ───────────────────────────────────────────────────────────────
function MediaPicker({ media, setMedia }) {
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
        { text: '📷  Photo', onPress: () => resolve('image') },
        { text: '🎬  Vidéo', onPress: () => resolve('video') },
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
    { text: '📷  Photos depuis la galerie', onPress: () => pickFromGallery('image') },
    { text: '🎬  Vidéos depuis la galerie', onPress: () => pickFromGallery('video') },
    { text: '📸  Prendre une photo / vidéo', onPress: pickFromCamera },
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
              {item.type === 'video' && <View style={styles.thumbPlayBadge}><Text style={styles.thumbPlayIcon}>▶</Text></View>}
              <TouchableOpacity style={styles.thumbRemove} onPress={() => removeMedia(i)}>
                <Text style={styles.thumbRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.thumbAdd} onPress={showOptions} activeOpacity={0.75}>
            <Text style={styles.thumbAddIcon}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {media.length === 0 && (
        <TouchableOpacity style={styles.photoBox} onPress={showOptions} activeOpacity={0.8}>
          <Text style={styles.photoIcon}>📷</Text>
          <View style={{ flex: 1 }}><Text style={styles.photoTitle}>Ajouter des médias</Text><Text style={styles.photoSub}>Photo ou vidéo (max 60s)</Text></View>
          <Text style={styles.photoArrow}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Selector ──────────────────────────────────────────────────────────────────
function Selector({ label, value, items, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => items.filter(i => i.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => { if (!disabled) { setSearch(''); setOpen(true); } }}
        activeOpacity={disabled ? 1 : 0.75}
      >
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>{value || placeholder}</Text>
        <Text style={styles.selectorChevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{label}</Text>
          <TextInput style={styles.modalSearch} placeholder="Rechercher..." placeholderTextColor={D.textFaint} value={search} onChangeText={setSearch} autoFocus />
          <FlatList
            data={filtered} keyExtractor={item => item} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.modalItem, item === value && styles.modalItemActive]} onPress={() => { onSelect(item); setOpen(false); }}>
                <Text style={[styles.modalItemText, item === value && styles.modalItemTextActive]}>{item}</Text>
                {item === value && <Text style={styles.modalCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>Aucun résultat</Text>}
          />
        </View>
      </Modal>
    </>
  );
}

// ── LocalisationBlock ─────────────────────────────────────────────────────────
function LocalisationBlock({ prefix, showDeleg, mode, loc, setLoc }) {
  const delegations = useMemo(() => getDelegations(loc.ville), [loc.ville]);
  const localites   = useMemo(() => getLocalites(loc.ville, loc.gouvernorat), [loc.ville, loc.gouvernorat]);
  const handleVille = (v) => setLoc({ ville: v, gouvernorat: '', delegation: '' });
  const handleGov   = (g) => setLoc(prev => ({ ...prev, gouvernorat: g, delegation: '' }));
  const handleDeleg = (d) => setLoc(prev => ({ ...prev, delegation: d }));
  const accentColor = mode === 'duo' ? D.blue : D.green;

  return (
    <View style={styles.locBlock}>
      {prefix ? <View style={[styles.locPrefixBar, { backgroundColor: accentColor }]}><Text style={styles.locPrefixText}>{prefix}</Text></View> : null}
      <View style={styles.locRow}>
        <Text style={styles.locLabel}>🏙️  Ville</Text>
        <Selector label="Choisir une ville" value={loc.ville} items={GOUVERNORATS} onSelect={handleVille} placeholder="Sélectionner..." />
      </View>
      <View style={[styles.locRow, !loc.ville && styles.locRowDisabled]}>
        <Text style={[styles.locLabel, !loc.ville && styles.locLabelDisabled]}>🗺️  Gouvernorat</Text>
        <Selector label="Choisir un gouvernorat" value={loc.gouvernorat} items={delegations} onSelect={handleGov} placeholder={loc.ville ? 'Sélectionner...' : "Choisir une ville d'abord"} disabled={!loc.ville} />
      </View>
      {showDeleg && (
        <View style={[styles.locRow, !loc.gouvernorat && styles.locRowDisabled]}>
          <View style={styles.locLabelRow}>
            <Text style={[styles.locLabel, !loc.gouvernorat && styles.locLabelDisabled]}>📌  Délégation</Text>
            <Text style={styles.locOptional}>(optionnel)</Text>
          </View>
          <Selector label="Choisir une délégation" value={loc.delegation} items={localites} onSelect={handleDeleg} placeholder={loc.gouvernorat ? 'Sélectionner...' : "Choisir un gouvernorat d'abord"} disabled={!loc.gouvernorat} />
        </View>
      )}
    </View>
  );
}

const Field = ({ label, icon, children }) => (
  <GlassView style={styles.fieldWrap}>
    <View style={styles.fieldLabelRow}><Text style={styles.fieldIcon}>{icon}</Text><Text style={styles.fieldLabel}>{label}</Text></View>
    {children}
  </GlassView>
);

const emptyLoc = () => ({ ville: '', gouvernorat: '', delegation: '' });

// ── Écran principal ───────────────────────────────────────────────────────────
export default function AjoutePub() {
  const navigation = useNavigation();

  const [mode,    setMode]    = useState('local');
  const [desc,    setDesc]    = useState('');
  const [media,   setMedia]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loc,      setLoc]      = useState(emptyLoc());
  const [locDebut, setLocDebut] = useState(emptyLoc());
  const [locFin,   setLocFin]   = useState(emptyLoc());

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
      Alert.alert('✅ Publication créée !', 'Votre annonce a bien été enregistrée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) { Alert.alert('Erreur réseau', 'Vérifiez votre connexion et réessayez.'); }
    finally { setLoading(false); }
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
          <Text style={styles.headerTitle}>Nouvelle publication</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Tabs LOCAL / DUO ── */}
        <View style={styles.tabsWrap}>
          <TouchableOpacity style={[styles.tab, mode === 'local' && styles.tabActive]} onPress={() => handleModeChange('local')} activeOpacity={0.85}>
            <Text style={[styles.tabText, mode === 'local' && styles.tabTextActive]}>📍  Publication locale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mode === 'duo' && styles.tabActiveDuo]} onPress={() => handleModeChange('duo')} activeOpacity={0.85}>
            <Text style={[styles.tabText, mode === 'duo' && styles.tabTextActive]}>🤝  Publication duo</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Field label="Description" icon="📝">
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Décrivez votre annonce..."
                placeholderTextColor={D.textFaint}
                value={desc} onChangeText={setDesc}
                multiline numberOfLines={4} textAlignVertical="top"
              />
            </Field>

            <Field label="Photo / Vidéo" icon="📷">
              <MediaPicker media={media} setMedia={setMedia} />
            </Field>

            {mode === 'local' ? (
              <Field label="Localisation" icon="📍">
                <LocalisationBlock showDeleg={true} mode="local" loc={loc} setLoc={setLoc} />
              </Field>
            ) : (
              <>
                <Field label="Localisation Début" icon="🚀">
                  <LocalisationBlock prefix="Début" showDeleg={false} mode="duo" loc={locDebut} setLoc={setLocDebut} />
                </Field>
                <Field label="Localisation Fin" icon="🏁">
                  <LocalisationBlock prefix="Fin" showDeleg={false} mode="duo" loc={locFin} setLoc={setLocFin} />
                </Field>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtnWrap, !canSubmit && { opacity: 0.5 }]}
              onPress={handleSubmit} activeOpacity={0.85} disabled={!canSubmit}
            >
              <LinearGradient colors={mode === 'duo' ? G.blue : G.green} style={styles.submitBtn}>
                {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.submitBtnText}>Publier</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
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
  backIcon:    { fontSize: 18, color: D.white, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: D.white, letterSpacing: -0.3 },

  tabsWrap: { flexDirection: 'row', margin: 16, backgroundColor: D.glass, borderRadius: 16, padding: 5, gap: 5, borderWidth: 1, borderColor: D.glassBorder },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive:        { backgroundColor: D.green, ...shadow.green },
  tabActiveDuo:     { backgroundColor: D.blue,  ...shadow.blue  },
  tabText:          { fontSize: 13, fontWeight: '700', color: D.textDim },
  tabTextActive:    { color: D.white, fontWeight: '800' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },

  fieldWrap:     { borderRadius: 16, padding: 14, marginBottom: 12 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fieldIcon:     { fontSize: 16 },
  fieldLabel:    { fontSize: 13, fontWeight: '800', color: D.white, letterSpacing: 0.2 },

  input:    { backgroundColor: D.glassInput, borderRadius: 10, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: D.white },
  textarea: { minHeight: 90, paddingTop: 11, textAlignVertical: 'top' },

  photoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.blueGlow, borderRadius: 10, borderWidth: 1.5, borderColor: D.blue, borderStyle: 'dashed', paddingHorizontal: 14, paddingVertical: 14 },
  photoIcon:  { fontSize: 24 },
  photoTitle: { fontSize: 14, fontWeight: '700', color: D.blue },
  photoSub:   { fontSize: 11, color: D.textDim, marginTop: 2 },
  photoArrow: { marginLeft: 'auto', fontSize: 22, color: D.blue, fontWeight: '300' },

  thumbRow: { marginBottom: 4 },
  thumbWrap: { width: 90, height: 90, borderRadius: 10, marginRight: 8, overflow: 'hidden', backgroundColor: D.navyLight },
  thumb: { width: '100%', height: '100%' },
  thumbPlayBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  thumbPlayIcon:  { color: D.white, fontSize: 10 },
  thumbRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  thumbRemoveText: { color: D.white, fontSize: 11, fontWeight: '700' },
  thumbAdd: { width: 90, height: 90, borderRadius: 10, backgroundColor: D.blueGlow, borderWidth: 1.5, borderColor: D.blue, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  thumbAddIcon: { fontSize: 28, color: D.blue },

  locBlock:       { gap: 10 },
  locPrefixBar:   { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 2 },
  locPrefixText:  { color: D.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  locRow:         { gap: 6 },
  locRowDisabled: { opacity: 0.45 },
  locLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locLabel:       { fontSize: 13, fontWeight: '700', color: D.white },
  locLabelDisabled: { color: D.textFaint },
  locOptional:    { fontSize: 11, color: D.textFaint, fontStyle: 'italic' },

  selector:            { flexDirection: 'row', alignItems: 'center', backgroundColor: D.glassInput, borderRadius: 10, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 14, paddingVertical: 12, minHeight: 46 },
  selectorDisabled:    { opacity: 0.5 },
  selectorText:        { flex: 1, fontSize: 14, color: D.white, fontWeight: '500' },
  selectorPlaceholder: { color: D.textFaint, fontWeight: '400' },
  selectorChevron:     { fontSize: 14, color: D.textDim, marginLeft: 8 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: D.navyMid, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32, maxHeight: '75%', borderWidth: 1, borderColor: D.glassBorder },
  modalHandle: { width: 40, height: 4, backgroundColor: D.glassBorder, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: D.white, marginBottom: 12, textAlign: 'center' },
  modalSearch: { backgroundColor: D.glassInput, borderRadius: 10, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: D.white, marginBottom: 10 },
  modalItem:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: D.glassBorder },
  modalItemActive:     { backgroundColor: D.blueGlow, borderRadius: 10, paddingHorizontal: 10 },
  modalItemText:       { flex: 1, fontSize: 14, color: D.white },
  modalItemTextActive: { fontWeight: '700', color: D.blue },
  modalCheck:          { fontSize: 16, color: D.blue, fontWeight: '700' },
  modalEmpty:          { textAlign: 'center', color: D.textDim, paddingVertical: 24, fontSize: 14 },

  submitBtnWrap: { marginTop: 8, borderRadius: 16, overflow: 'hidden', ...shadow.blue },
  submitBtn:     { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  submitBtnText: { color: D.white, fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },
});