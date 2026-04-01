// src/screens/ProfileScreen.js
import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, SafeAreaView, Switch, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { environment } from '../environments/environment.prod';
import { D, G, shadow, DarkBackground, GlassView, CS } from '../theme/index';

const API_URL = environment.apiUrl;

// ── VIEW 900 — Profile principal ──────────────────────────────────────────────
function ProfileMain({ user, localCount, duoCount, onEditProfile, onSettings, onMyAds, onHelpSupport, onLogOut }) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarCircle}>
        {user?.avatar
          ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          : <Text style={styles.avatarInitials}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}</Text>}
      </View>
      <Text style={styles.profileName}>{user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur'}</Text>
      <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || user?.phone || ''}</Text>

      <GlassView style={styles.activeAdsBox}>
        <Text style={styles.activeAdsTitle}>My Active Ads</Text>
        <View style={styles.activeAdsRow}>
          <View style={[styles.activeAdsCard, { borderColor: D.green }]}>
            <Text style={[styles.activeAdsCount, { color: D.green }]}>{localCount}</Text>
            <Text style={styles.activeAdsLabel}>LOCAL</Text>
          </View>
          <View style={[styles.activeAdsCard, { borderColor: D.blue }]}>
            <Text style={[styles.activeAdsCount, { color: D.blue }]}>{duoCount}</Text>
            <Text style={styles.activeAdsLabel}>DUO</Text>
          </View>
        </View>
      </GlassView>

      <TouchableOpacity style={styles.viewMyAdsBtnWrap} onPress={onMyAds} activeOpacity={0.85}>
        <LinearGradient colors={G.blue} style={styles.viewMyAdsBtn}>
          <Text style={styles.viewMyAdsBtnText}>VIEW MY ADS →</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.menuList}>
        <MenuRow label="Edit Profile"   onPress={onEditProfile} />
        <MenuRow label="Settings"       onPress={onSettings}    />
        <MenuRow label="My Ads"         onPress={onMyAds}       />
        <MenuRow label="Help & Support" onPress={onHelpSupport} />
        <MenuRow label="Log Out"        onPress={onLogOut}      danger />
      </View>
    </ScrollView>
  );
}

// ── VIEW 901 — Edit Profile ───────────────────────────────────────────────────
function EditProfileView({ user, onBack, onSave }) {
  const [fullName,      setFullName]      = useState(`${user?.prenom || ''} ${user?.nom || ''}`.trim());
  const [phone,         setPhone]         = useState(user?.phone || '');
  const [email,         setEmail]         = useState(user?.email || '');
  const [preferredZone, setPreferredZone] = useState(user?.preferredZone || '');
  const [saving,        setSaving]        = useState(false);
  const [avatarUri,     setAvatarUri]     = useState(user?.avatar || null);
  const [uploading,     setUploading]     = useState(false);

  const handleChangePhoto = () => {
    Alert.alert('Changer la photo', 'Choisir une source', [
      { text: 'Galerie', onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission refusée', 'Accès à la galerie requis.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: 'Caméra', onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission refusée', 'Accès à la caméra requis.'); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (asset) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('avatar', { uri: asset.uri, name: `avatar_${Date.now()}.jpg`, type: 'image/jpeg' });
      const res = await fetch(`${API_URL}/users/me/avatar`, { method: 'PUT', headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      if (!res.ok) throw new Error('Échec du téléchargement');
      const data = await res.json();
      setAvatarUri(data.avatar || asset.uri);
    } catch (err) { Alert.alert('Erreur', err.message || 'Impossible de changer la photo'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const [prenom, ...rest] = fullName.trim().split(' ');
      const nom = rest.join(' ');
      const res = await fetch(`${API_URL}/users/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ prenom, nom, phone, email, preferredZone }) });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      onSave();
    } catch (err) { Alert.alert('Erreur', err.message || 'Impossible de sauvegarder'); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarCircle}>
        {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}</Text>}
      </View>
      <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.75} onPress={handleChangePhoto} disabled={uploading}>
        {uploading ? <ActivityIndicator size="small" color={D.white} /> : <Text style={styles.changePhotoText}>Change photo</Text>}
      </TouchableOpacity>
      <View style={styles.fieldList}>
        <Field label="Full name"      value={fullName}      onChangeText={setFullName}     placeholder="Full name" />
        <Field label="Phone number"   value={phone}         onChangeText={setPhone}         placeholder="Phone number" keyboardType="phone-pad" />
        <Field label="Email address"  value={email}         onChangeText={setEmail}         placeholder="Email address" keyboardType="email-address" />
        <Field label="Preferred zone" value={preferredZone} onChangeText={setPreferredZone} placeholder="e.g. Ariana, Tunis…" />
      </View>
      <TouchableOpacity style={styles.primaryBtnWrap} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        <LinearGradient colors={G.blue} style={styles.primaryBtn}>
          {saving ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>SAVE CHANGES</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const LANGUAGES = ['العربية', 'Français', 'English'];

// ── VIEW 902 — Settings ───────────────────────────────────────────────────────
function SettingsView({ onChangePassword }) {
  const [language,        setLanguage]        = useState('العربية');
  const [notifications,   setNotifications]   = useState(true);
  const [locationAccess,  setLocationAccess]  = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showLangPicker,  setShowLangPicker]  = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res   = await fetch(`${API_URL}/users/me/settings?_t=${Date.now()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.language) setLanguage(data.settings.language);
          if (data.settings?.notifications  !== undefined) setNotifications(data.settings.notifications);
          if (data.settings?.locationAccess !== undefined) setLocationAccess(data.settings.locationAccess);
        }
      } catch {}
      finally { setLoadingSettings(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/users/me/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ language, notifications, locationAccess }) });
      if (!res.ok) throw new Error('Erreur serveur');
      Alert.alert('Succès', 'Paramètres enregistrés.');
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
    finally { setSaving(false); }
  };

  if (loadingSettings) return <ActivityIndicator style={{ flex: 1 }} color={D.blue} />;

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {showLangPicker && (
        <View style={styles.langModal}>
          <View style={styles.langModalPanel}>
            <Text style={styles.langModalTitle}>Langue</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} style={[styles.langOption, language === lang && styles.langOptionActive]} onPress={() => { setLanguage(lang); setShowLangPicker(false); }} activeOpacity={0.8}>
                <Text style={[styles.langOptionText, language === lang && { color: D.white }]}>{lang}</Text>
                {language === lang && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langCancelBtn} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.langCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Preferences</Text>
      <GlassView style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLangPicker(true)} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Language</Text>
          <View style={styles.settingsRowRight}><Text style={styles.settingsRowValue}>{language}</Text><Text style={styles.settingsChevron}>›</Text></View>
        </TouchableOpacity>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: D.glassBorder }]}>
          <Text style={styles.settingsRowLabel}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: D.glass, true: D.green }} thumbColor={D.white} />
        </View>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: D.glassBorder }]}>
          <Text style={styles.settingsRowLabel}>Location access</Text>
          <Switch value={locationAccess} onValueChange={setLocationAccess} trackColor={{ false: D.glass, true: D.blue }} thumbColor={D.white} />
        </View>
      </GlassView>

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Account</Text>
      <GlassView style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={onChangePassword} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Change password</Text><Text style={styles.settingsChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: D.glassBorder }]} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Privacy policy</Text><Text style={styles.settingsChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: D.glassBorder }]}
          onPress={() => Alert.alert('Supprimer le compte', 'Êtes-vous sûr ?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive' }])} activeOpacity={0.7}>
          <Text style={[styles.settingsRowLabel, { color: D.red }]}>Delete account</Text>
          <Text style={[styles.settingsChevron, { color: D.red }]}>›</Text>
        </TouchableOpacity>
      </GlassView>

      <TouchableOpacity style={[styles.primaryBtnWrap, { marginTop: 32 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        <LinearGradient colors={G.blue} style={styles.primaryBtn}>
          {saving ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>SAVE</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 902b — Change Password ───────────────────────────────────────────────
function ChangePasswordView({ onSuccess }) {
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) return Alert.alert('Erreur', 'Tous les champs sont requis.');
    if (newPwd.length < 6) return Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
    if (newPwd !== confirmPwd) return Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur serveur');
      Alert.alert('Succès', 'Mot de passe modifié.', [{ text: 'OK', onPress: onSuccess }]);
    } catch (err) { Alert.alert('Erreur', err.message); }
    finally { setSaving(false); }
  };

  const PwdField = ({ label, value, onChange, show, onToggle }) => (
    <View style={styles.pwdFieldWrap}>
      <TextInput style={styles.pwdField} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={D.textFaint} secureTextEntry={!show} autoCapitalize="none" />
      <TouchableOpacity style={styles.pwdEye} onPress={onToggle}><Text style={styles.pwdEyeIcon}>{show ? '🙈' : '👁'}</Text></TouchableOpacity>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pwdIconWrap}><Text style={{ fontSize: 40 }}>🔒</Text></View>
      <Text style={styles.pwdTitle}>Change password</Text>
      <Text style={styles.pwdSub}>Enter your current password and choose a new one.</Text>
      <View style={[styles.fieldList, { marginTop: 24 }]}>
        <PwdField label="Current password" value={currentPwd} onChange={setCurrentPwd} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
        <PwdField label="New password"     value={newPwd}     onChange={setNewPwd}     show={showNew}     onToggle={() => setShowNew(v => !v)} />
        <PwdField label="Confirm password" value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
      </View>
      <TouchableOpacity style={styles.primaryBtnWrap} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        <LinearGradient colors={G.blue} style={styles.primaryBtn}>
          {saving ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>SAVE PASSWORD</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 903 — Profile Updated ────────────────────────────────────────────────
function ProfileUpdatedView({ user, onBackToProfile }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}><Text style={styles.checkIcon}>✓</Text></View>
      <Text style={styles.updatedTitle}>Profile updated!</Text>
      <View style={[styles.avatarCircle, { marginTop: 20, width: 64, height: 64, borderRadius: 32 }]}>
        <Text style={{ fontSize: 22 }}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}</Text>
      </View>
      <Text style={[styles.profileName, { marginTop: 8 }]}>{user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur'}</Text>
      <Text style={styles.profileEmail}>{user?.email || ''}</Text>
      <TouchableOpacity style={[styles.primaryBtnWrap, { marginTop: 32, width: '100%' }]} onPress={onBackToProfile} activeOpacity={0.85}>
        <LinearGradient colors={G.blue} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>BACK TO PROFILE</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 601 — My Ads ─────────────────────────────────────────────────────────
function MyAdsView({ ads, loading, onSelectAd }) {
  const timeLeft = (pub) => {
    const exp  = pub.expiresAt ? new Date(pub.expiresAt) : new Date(new Date(pub.createdAt).getTime() + 24 * 3600 * 1000);
    const diff = Math.max(0, Math.round((exp - Date.now()) / 3600000));
    return diff > 0 ? `${diff}h left` : 'Expiré';
  };
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={D.blue} />;
  return (
    <FlatList
      data={ads} keyExtractor={item => item._id}
      contentContainerStyle={styles.adsList} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyIcon}>📭</Text><Text style={styles.emptyTitle}>Aucune annonce</Text></View>}
      renderItem={({ item }) => {
        const isLocal = item.mode === 'local';
        const accent  = isLocal ? D.green : D.blue;
        const left    = timeLeft(item);
        const expired = left === 'Expiré';
        const firstImg = item.medias?.find(m => m.type === 'image');
        const locLine  = isLocal
          ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(', ')
          : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');
        return (
          <TouchableOpacity style={styles.adCard} onPress={() => onSelectAd(item)} activeOpacity={0.8}>
            {firstImg
              ? <Image source={{ uri: firstImg.url }} style={styles.adCardImage} />
              : <View style={[styles.adCardImagePlaceholder, { backgroundColor: isLocal ? D.greenGlow : D.blueGlow }]}><Text style={{ fontSize: 28 }}>{isLocal ? '📍' : '🤝'}</Text></View>}
            <View style={styles.adCardBody}>
              <View style={[styles.adModeBadge, { backgroundColor: isLocal ? D.greenGlow : D.blueGlow, borderColor: accent }]}>
                <Text style={[styles.adModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
              </View>
              <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>
              {!!locLine && <Text style={styles.adCardLoc} numberOfLines={1}>📍 {locLine}</Text>}
              <Text style={[styles.adCardTime, { color: expired ? D.red : '#FF9500' }]}>{left}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── VIEW 602 — Ad Detail ──────────────────────────────────────────────────────
function AdDetailView({ ad, onRenew, onDelete, renewing }) {
  const isLocal   = ad.mode === 'local';
  const accent    = isLocal ? D.green : D.blue;
  const exp       = ad.expiresAt ? new Date(ad.expiresAt) : new Date(new Date(ad.createdAt).getTime() + 24 * 3600 * 1000);
  const hoursLeft = Math.max(0, Math.round((exp - Date.now()) / 3600000));
  const firstImg  = ad.medias?.find(m => m.type === 'image');
  const locLabel  = isLocal ? [ad.localisation?.ville, ad.localisation?.gouvernorat].filter(Boolean).join(', ') : [ad.localisationDebut?.ville, '→', ad.localisationFin?.ville].filter(Boolean).join(' ');
  return (
    <ScrollView contentContainerStyle={styles.adDetailContent} showsVerticalScrollIndicator={false}>
      {firstImg ? <Image source={{ uri: firstImg.url }} style={styles.adDetailImage} /> : <View style={[styles.adDetailImagePlaceholder, { backgroundColor: isLocal ? D.greenGlow : D.blueGlow }]}><Text style={{ fontSize: 40 }}>{isLocal ? '📍' : '🤝'}</Text></View>}
      {!!locLabel && <View style={[styles.adDetailLocPill, { borderColor: accent }]}><Text style={[styles.adDetailLocText, { color: accent }]}>📍 {locLabel}</Text></View>}
      <Text style={[styles.adDetailTime, { color: hoursLeft > 0 ? '#FF9500' : D.red }]}>{hoursLeft > 0 ? `${hoursLeft}h remaining` : 'Expiré'}</Text>
      <Text style={styles.adDetailDesc}>{ad.description}</Text>
      <Text style={styles.statsTitle}>Statistics</Text>
      <View style={styles.statsRow}>
        <GlassView style={styles.statCard}><Text style={styles.statCount}>{ad.vues ?? 0}</Text><Text style={styles.statLabel}>Views</Text></GlassView>
        <GlassView style={styles.statCard}><Text style={styles.statCount}>{ad.nbLikes ?? ad.likes?.length ?? 0}</Text><Text style={styles.statLabel}>Contacts</Text></GlassView>
      </View>
      <TouchableOpacity style={styles.renewBtnWrap} onPress={onRenew} activeOpacity={0.85} disabled={renewing}>
        <LinearGradient colors={G.blue} style={styles.renewBtn}>
          {renewing ? <ActivityIndicator color={D.white} /> : <Text style={styles.renewBtnText}>RENEW (+24h)</Text>}
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAdBtn} onPress={onDelete} activeOpacity={0.85}>
        <Text style={styles.deleteAdBtnText}>DELETE AD</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 603 — Renewed ────────────────────────────────────────────────────────
function RenewedView({ onBackToAds }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}><Text style={styles.checkIcon}>✓</Text></View>
      <Text style={styles.updatedTitle}>Ad renewed!</Text>
      <Text style={styles.renewedSub}>Active for another 24h</Text>
      <TouchableOpacity style={[styles.primaryBtnWrap, { marginTop: 32, width: '80%' }]} onPress={onBackToAds} activeOpacity={0.85}>
        <LinearGradient colors={G.blue} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>BACK TO MY ADS</Text></LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 604 — Delete Confirm ─────────────────────────────────────────────────
function DeleteAdView({ onCancel, onConfirmDelete, deleting }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.deleteCircle}><Text style={styles.deleteCircleIcon}>!</Text></View>
      <Text style={styles.updatedTitle}>Delete this ad?</Text>
      <Text style={styles.deleteSub}>This action cannot be undone.{'\n'}The ad will be permanently removed.</Text>
      <View style={styles.deleteActionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}><Text style={styles.cancelBtnText}>CANCEL</Text></TouchableOpacity>
        <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onConfirmDelete} activeOpacity={0.85} disabled={deleting}>
          {deleting ? <ActivityIndicator color={D.white} /> : <Text style={styles.confirmDeleteBtnText}>DELETE</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function MenuRow({ label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuRowLabel, danger && { color: D.red }]}>{label}</Text>
      <Text style={[styles.menuRowChevron, danger && { color: D.red }]}>›</Text>
    </TouchableOpacity>
  );
}
function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <TextInput
      style={styles.textField} value={value} onChangeText={onChangeText}
      placeholder={placeholder || label} placeholderTextColor={D.textFaint}
      keyboardType={keyboardType || 'default'} autoCapitalize="none"
    />
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const navigation = useNavigation();
  const [view,       setView]       = useState('main');
  const [currentUser,setCurrentUser]= useState(null);
  const [loading,    setLoading]    = useState(true);
  const [myAds,      setMyAds]      = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [renewing,   setRenewing]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const fetchMyAds = async () => {
    setAdsLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/ads?_t=${Date.now()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data  = await res.json();
      const ads   = data.publications ?? data;
      setMyAds(Array.isArray(ads) ? ads : []);
    } catch { setMyAds([]); }
    finally { setAdsLoading(false); }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([getCurrentUser().then(setCurrentUser), fetchMyAds()]).finally(() => setLoading(false));
  }, []));

  const goToMyAds = () => { fetchMyAds(); setView('myads'); };

  const handleRenew = async () => {
    if (!selectedAd) return; setRenewing(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      await fetch(`${API_URL}/publications/${selectedAd._id}/renew`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setView('renewed');
    } catch { Alert.alert('Erreur', 'Impossible de renouveler.'); }
    finally { setRenewing(false); }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedAd) return; setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/publications/${selectedAd._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `Erreur ${res.status}`); }
      setSelectedAd(null); setView('myads'); await fetchMyAds();
    } catch (err) { Alert.alert('Erreur', err.message || 'Impossible de supprimer.'); }
    finally { setDeleting(false); }
  };

  const handleLogOut = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await apiLogout(); navigation.navigate('Login'); } },
    ]);
  };

  const localCount = myAds.filter(a => a.mode === 'local').length;
  const duoCount   = myAds.filter(a => a.mode === 'duo').length;

  const TITLES = { main: 'Profile', edit: 'Edit Profile', settings: 'Settings', changepassword: 'Change Password', updated: 'Profile', myads: 'My Ads', addetail: 'Ad Details', renewed: 'Renewed!', deleteconfirm: 'Delete Ad' };

  const handleBack = () => {
    if (view === 'edit' || view === 'settings' || view === 'myads') setView('main');
    else if (view === 'changepassword') setView('settings');
    else if (view === 'addetail') setView('myads');
    else if (view === 'renewed') setView('myads');
    else if (view === 'deleteconfirm') setView('addetail');
    else navigation.goBack();
  };

  if (loading) return <DarkBackground style={{ flex: 1 }}><SafeAreaView style={{ flex: 1 }}><ActivityIndicator style={{ flex: 1 }} size="large" color={D.blue} /></SafeAreaView></DarkBackground>;

  return (
    <DarkBackground style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{TITLES[view]}</Text>
          <View style={{ width: 36 }} />
        </View>

        {view === 'main'          && <ProfileMain user={currentUser} localCount={localCount} duoCount={duoCount} onEditProfile={() => setView('edit')} onSettings={() => setView('settings')} onMyAds={goToMyAds} onHelpSupport={() => {}} onLogOut={handleLogOut} />}
        {view === 'edit'          && <EditProfileView user={currentUser} onBack={() => setView('main')} onSave={() => getCurrentUser().then(u => { setCurrentUser(u); setView('updated'); })} />}
        {view === 'settings'      && <SettingsView onChangePassword={() => setView('changepassword')} />}
        {view === 'changepassword'&& <ChangePasswordView onSuccess={() => setView('settings')} />}
        {view === 'updated'       && <ProfileUpdatedView user={currentUser} onBackToProfile={() => setView('main')} />}
        {view === 'myads'         && <MyAdsView ads={myAds} loading={adsLoading} onSelectAd={(ad) => { setSelectedAd(ad); setView('addetail'); }} />}
        {view === 'addetail' && selectedAd && <AdDetailView ad={selectedAd} renewing={renewing} onRenew={handleRenew} onDelete={() => setView('deleteconfirm')} />}
        {view === 'renewed'       && <RenewedView onBackToAds={() => { fetchMyAds(); setView('myads'); }} />}
        {view === 'deleteconfirm' && <DeleteAdView deleting={deleting} onCancel={() => setView('addetail')} onConfirmDelete={handleDeleteConfirmed} />}

        {/* ── Bottom Tab Bar ── */}
        <View style={styles.tabBar}>
          <TabItem icon="🌍" label="Globe"   onPress={() => navigation.navigate('Map')} />
          <TabItem icon="💬" label="messages"  onPress={() => navigation.navigate('ConversationsList')} />
          <TabItem icon="👤" label="Profile" active />
        </View>
      </SafeAreaView>
    </DarkBackground>
  );
}

function TabItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tabIconBox, active && styles.tabIconBoxActive]}>
        <Text style={styles.tabIcon}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 38, paddingBottom: 12,
    backgroundColor: D.glass, borderBottomWidth: 1, borderBottomColor: D.glassBorder,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder, justifyContent: 'center', alignItems: 'center' },
  backIcon:    { fontSize: 18, color: D.white, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: D.white },

  pageContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120, alignItems: 'center' },

  avatarCircle:   { width: 88, height: 88, borderRadius: 44, backgroundColor: D.blueGlow, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: D.blue },
  avatarInitials: { fontSize: 32, color: D.blue, fontWeight: '700' },
  avatarImage:    { width: 88, height: 88, borderRadius: 44 },

  activeAdsBox:   { width: '100%', borderRadius: 16, padding: 16, marginBottom: 16 },
  activeAdsTitle: { fontSize: 13, fontWeight: '700', color: D.textDim, marginBottom: 12, letterSpacing: 0.3 },
  activeAdsRow:   { flexDirection: 'row', gap: 12 },
  activeAdsCard:  { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.2)' },
  activeAdsCount: { fontSize: 28, fontWeight: '900' },
  activeAdsLabel: { fontSize: 11, fontWeight: '700', color: D.textDim, marginTop: 2, letterSpacing: 0.5 },

  viewMyAdsBtnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 24, ...shadow.blue },
  viewMyAdsBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  viewMyAdsBtnText: { color: D.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  adsList:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 12 },
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle:{ fontSize: 16, fontWeight: '700', color: D.textDim },

  adCard: { flexDirection: 'row', backgroundColor: D.glass, borderRadius: 16, borderWidth: 1, borderColor: D.glassBorder, overflow: 'hidden', minHeight: 90, ...shadow.soft },
  adCardImage: { width: 90, height: 90 },
  adCardImagePlaceholder: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  adCardBody:  { flex: 1, padding: 12, gap: 4, justifyContent: 'space-between' },
  adModeBadge: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 3 },
  adModeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  adCardDesc:  { fontSize: 13, color: D.white, fontWeight: '500' },
  adCardLoc:   { fontSize: 11, color: D.textDim },
  adCardTime:  { fontSize: 11, fontWeight: '700' },

  adDetailContent: { paddingBottom: 120, paddingTop: 0 },
  adDetailImage:   { width: '100%', height: 220, resizeMode: 'cover' },
  adDetailImagePlaceholder: { width: '100%', height: 180, justifyContent: 'center', alignItems: 'center' },
  adDetailLocPill: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 6, marginHorizontal: 16, marginTop: 14 },
  adDetailLocText: { fontSize: 13, fontWeight: '700' },
  adDetailTime:    { fontSize: 13, fontWeight: '700', marginHorizontal: 16, marginTop: 8 },
  adDetailDesc:    { fontSize: 14, color: D.textDim, lineHeight: 20, marginHorizontal: 16, marginTop: 10 },
  statsTitle:      { fontSize: 15, fontWeight: '800', color: D.white, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statsRow:        { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  statCard:        { flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
  statCount:       { fontSize: 26, fontWeight: '900', color: D.white },
  statLabel:       { fontSize: 11, color: D.textDim, fontWeight: '600', marginTop: 2 },

  renewBtnWrap: { marginHorizontal: 16, marginTop: 24, borderRadius: 14, overflow: 'hidden', ...shadow.blue },
  renewBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  renewBtnText: { color: D.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  deleteAdBtn:  { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 2, borderColor: D.red, paddingVertical: 15, alignItems: 'center' },
  deleteAdBtnText: { color: D.red, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  renewedSub:   { fontSize: 14, color: D.textDim, marginTop: 8, textAlign: 'center' },
  deleteCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: D.red, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteCircleIcon: { fontSize: 36, color: D.red, fontWeight: '700' },
  deleteSub:    { fontSize: 13, color: D.textDim, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  deleteActionsRow: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  cancelBtn:    { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: D.glassBorder, paddingVertical: 15, alignItems: 'center', backgroundColor: D.glass },
  cancelBtnText:{ color: D.white, fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn:     { flex: 1, borderRadius: 14, backgroundColor: D.red, paddingVertical: 15, alignItems: 'center' },
  confirmDeleteBtnText: { color: D.white, fontWeight: '800', fontSize: 14 },

  langModal:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  langModalPanel: { width: '80%', backgroundColor: D.navyMid, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: D.glassBorder, ...shadow.soft },
  langModalTitle: { fontSize: 16, fontWeight: '800', color: D.white, marginBottom: 14, textAlign: 'center' },
  langOption:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder },
  langOptionActive:  { backgroundColor: D.blue, borderColor: D.blue },
  langOptionText:    { fontSize: 15, fontWeight: '600', color: D.white },
  langCheck:         { fontSize: 16, color: D.white, fontWeight: '700' },
  langCancelBtn:     { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  langCancelText:    { fontSize: 14, color: D.textDim, fontWeight: '600' },
  settingsRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },

  pwdIconWrap: { marginBottom: 12, alignItems: 'center' },
  pwdTitle:    { fontSize: 20, fontWeight: '800', color: D.white, marginBottom: 6 },
  pwdSub:      { fontSize: 13, color: D.textDim, textAlign: 'center', marginBottom: 4 },
  pwdFieldWrap:{ flexDirection: 'row', alignItems: 'center', backgroundColor: D.glassInput, borderRadius: 12, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 16 },
  pwdField:    { flex: 1, fontSize: 14, color: D.white, paddingVertical: 14 },
  pwdEye:      { padding: 8 },
  pwdEyeIcon:  { fontSize: 16 },

  profileName:  { fontSize: 20, fontWeight: '800', color: D.white, marginBottom: 4 },
  profileEmail: { fontSize: 13, color: D.textDim, marginBottom: 24 },

  changePhotoBtn:  { backgroundColor: D.glass, borderRadius: 10, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 20, paddingVertical: 9, marginBottom: 24 },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: D.white },

  menuList: { width: '100%', gap: 0 },
  menuRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: D.glass, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: D.glassBorder },
  menuRowLabel:   { fontSize: 15, fontWeight: '600', color: D.white },
  menuRowChevron: { fontSize: 20, color: D.textFaint },

  fieldList:  { width: '100%', gap: 12, marginBottom: 28 },
  textField:  { width: '100%', backgroundColor: D.glassInput, borderRadius: 12, borderWidth: 1, borderColor: D.glassBorder, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: D.white },

  primaryBtnWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', ...shadow.blue },
  primaryBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: D.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  sectionLabel:  { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: D.textDim, marginBottom: 8, letterSpacing: 0.4 },
  settingsGroup: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  settingsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowLabel: { fontSize: 15, color: D.white, fontWeight: '500' },
  settingsRowValue: { fontSize: 14, color: D.textDim },
  settingsChevron:  { fontSize: 20, color: D.textFaint },

  updatedCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  checkCircle:   { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: D.blue, justifyContent: 'center', alignItems: 'center', marginBottom: 16, ...shadow.blue },
  checkIcon:     { fontSize: 36, color: D.blue, fontWeight: '700' },
  updatedTitle:  { fontSize: 20, fontWeight: '800', color: D.white },

  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(10,22,40,0.96)', borderTopWidth: 1, borderTopColor: D.glassBorder, paddingBottom: 6, paddingTop: 8 },
  tabItem:          { flex: 1, alignItems: 'center', gap: 4 },
  tabIconBox:       { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tabIconBoxActive: { backgroundColor: D.blueGlow },
  tabIcon:          { fontSize: 18 },
  tabLabel:         { fontSize: 11, color: D.textFaint, fontWeight: '500' },
  tabLabelActive:   { color: D.blue, fontWeight: '700' },
});