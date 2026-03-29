// src/screens/ProfileScreen.js
// Wireframes 900 → 901 → 902 → 903
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { environment } from '../environments/environment.prod';

const API_URL = environment.apiUrl;

// ── Palette (cohérente avec LocalScreen) ─────────────────────────────────────
const C = {
  dark:   '#111',
  white:  '#FFFFFF',
  bg:     '#F5F6FA',
  border: '#EEEFF5',
  grey:   '#888',
  red:    '#FF3B30',
  green:  '#34C759',
  blue:   '#1E90FF',
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  900 — Profile (page principale)
// ─────────────────────────────────────────────────────────────────────────────
function ProfileMain({ user, localCount, duoCount, onEditProfile, onSettings, onMyAds, onHelpSupport, onLogOut }) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={styles.avatarCircle}>
        {user?.avatar
          ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          : <Text style={styles.avatarInitials}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}</Text>
        }
      </View>

      {/* Nom + email */}
      <Text style={styles.profileName}>
        {user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur'}
      </Text>
      <Text style={styles.profileEmail} numberOfLines={1}>
        {user?.email || user?.phone || ''}
      </Text>

      {/* ── My Active Ads (wireframe 600) ── */}
      <View style={styles.activeAdsBox}>
        <Text style={styles.activeAdsTitle}>My Active Ads</Text>
        <View style={styles.activeAdsRow}>
          <View style={[styles.activeAdsCard, { borderColor: C.green }]}>
            <Text style={[styles.activeAdsCount, { color: C.green }]}>{localCount}</Text>
            <Text style={styles.activeAdsLabel}>LOCAL</Text>
          </View>
          <View style={[styles.activeAdsCard, { borderColor: C.blue }]}>
            <Text style={[styles.activeAdsCount, { color: C.blue }]}>{duoCount}</Text>
            <Text style={styles.activeAdsLabel}>DUO</Text>
          </View>
        </View>
      </View>

      {/* VIEW MY ADS button */}
      <TouchableOpacity style={styles.viewMyAdsBtn} onPress={onMyAds} activeOpacity={0.85}>
        <Text style={styles.viewMyAdsBtnText}>VIEW MY ADS →</Text>
      </TouchableOpacity>

      {/* Items menu */}
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

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  901 — Edit Profile
// ─────────────────────────────────────────────────────────────────────────────
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
      {
        text: 'Galerie',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission refusée', 'Accès à la galerie requis.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) uploadAvatar(result.assets[0]);
        },
      },
      {
        text: 'Caméra',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission refusée', 'Accès à la caméra requis.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) uploadAvatar(result.assets[0]);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (asset) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('avatar', {
        uri:  asset.uri,
        name: `avatar_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (!res.ok) throw new Error('Échec du téléchargement');
      const data = await res.json();
      setAvatarUri(data.avatar || asset.uri);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible de changer la photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const [prenom, ...rest] = fullName.trim().split(' ');
      const nom = rest.join(' ');
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prenom, nom, phone, email, preferredZone }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      onSave();
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      {/* Avatar + change photo */}
      <View style={styles.avatarCircle}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>
            {(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.75} onPress={handleChangePhoto} disabled={uploading}>
        {uploading
          ? <ActivityIndicator size="small" color={C.dark} />
          : <Text style={styles.changePhotoText}>Change photo</Text>
        }
      </TouchableOpacity>

      {/* Fields */}
      <View style={styles.fieldList}>
        <Field label="Full name"      value={fullName}      onChangeText={setFullName}      placeholder="Full name" />
        <Field label="Phone number"   value={phone}         onChangeText={setPhone}          placeholder="Phone number"   keyboardType="phone-pad" />
        <Field label="Email address"  value={email}         onChangeText={setEmail}          placeholder="Email address"  keyboardType="email-address" />
        <Field label="Preferred zone" value={preferredZone} onChangeText={setPreferredZone}  placeholder="e.g. Ariana, Tunis…" />
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving
          ? <ActivityIndicator color={C.white} />
          : <Text style={styles.primaryBtnText}>SAVE CHANGES</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const LANGUAGES = ['العربية', 'Français', 'English'];

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  902 — Settings
// ─────────────────────────────────────────────────────────────────────────────
function SettingsView({ onChangePassword }) {
  const [language,       setLanguage]       = useState('العربية');
  const [notifications,  setNotifications]  = useState(true);
  const [locationAccess, setLocationAccess] = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [loadingSettings,setLoadingSettings]= useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // ── Charger les settings actuels ─────────────────────────────────────────
  React.useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res   = await fetch(`${API_URL}/users/me/settings?_t=${Date.now()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.language)       setLanguage(data.settings.language);
          if (data.settings?.notifications   !== undefined) setNotifications(data.settings.notifications);
          if (data.settings?.locationAccess  !== undefined) setLocationAccess(data.settings.locationAccess);
        }
      } catch {}
      finally { setLoadingSettings(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ language, notifications, locationAccess }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      Alert.alert('Succès', 'Paramètres enregistrés.');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingSettings) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>

      {/* ── Language picker modal ── */}
      {showLangPicker && (
        <View style={styles.langModal}>
          <View style={styles.langModalPanel}>
            <Text style={styles.langModalTitle}>Langue</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                onPress={() => { setLanguage(lang); setShowLangPicker(false); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.langOptionText, language === lang && { color: C.white }]}>{lang}</Text>
                {language === lang && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langCancelBtn} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.langCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Preferences ── */}
      <Text style={styles.sectionLabel}>Preferences</Text>
      <View style={styles.settingsGroup}>
        {/* Language */}
        <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLangPicker(true)} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Language</Text>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowValue}>{language}</Text>
            <Text style={styles.settingsChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Notifications */}
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
          <Text style={styles.settingsRowLabel}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications}
            trackColor={{ false: '#DDD', true: C.green }} thumbColor={C.white} />
        </View>

        {/* Location */}
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
          <Text style={styles.settingsRowLabel}>Location access</Text>
          <Switch value={locationAccess} onValueChange={setLocationAccess}
            trackColor={{ false: '#DDD', true: C.dark }} thumbColor={C.white} />
        </View>
      </View>

      {/* ── Account ── */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Account</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={onChangePassword} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Change password</Text>
          <Text style={styles.settingsChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>Privacy policy</Text>
          <Text style={styles.settingsChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}
          onPress={() => Alert.alert('Supprimer le compte', 'Êtes-vous sûr ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive' },
          ])}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingsRowLabel, { color: C.red }]}>Delete account</Text>
          <Text style={[styles.settingsChevron, { color: C.red }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>SAVE</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  902b — Change Password
// ─────────────────────────────────────────────────────────────────────────────
function ChangePasswordView({ onSuccess }) {
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentPwd || !newPwd || !confirmPwd)
      return Alert.alert('Erreur', 'Tous les champs sont requis.');
    if (newPwd.length < 6)
      return Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
    if (newPwd !== confirmPwd)
      return Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur serveur');
      Alert.alert('Succès', 'Mot de passe modifié.', [{ text: 'OK', onPress: onSuccess }]);
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const PwdField = ({ label, value, onChange, show, onToggle }) => (
    <View style={styles.pwdFieldWrap}>
      <TextInput
        style={styles.pwdField}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor="#B0B3C6"
        secureTextEntry={!show}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.pwdEye} onPress={onToggle}>
        <Text style={styles.pwdEyeIcon}>{show ? '🙈' : '👁'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pwdIconWrap}>
        <Text style={{ fontSize: 40 }}>🔒</Text>
      </View>
      <Text style={styles.pwdTitle}>Change password</Text>
      <Text style={styles.pwdSub}>Enter your current password and choose a new one.</Text>

      <View style={[styles.fieldList, { marginTop: 24 }]}>
        <PwdField label="Current password"  value={currentPwd} onChange={setCurrentPwd} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
        <PwdField label="New password"      value={newPwd}     onChange={setNewPwd}     show={showNew}     onToggle={() => setShowNew(v => !v)} />
        <PwdField label="Confirm password"  value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>SAVE PASSWORD</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  903 — Profile Updated ✓
// ─────────────────────────────────────────────────────────────────────────────
function ProfileUpdatedView({ user, onBackToProfile }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkIcon}>✓</Text>
      </View>
      <Text style={styles.updatedTitle}>Profile updated!</Text>

      {/* Mini avatar */}
      <View style={[styles.avatarCircle, { marginTop: 20, width: 64, height: 64, borderRadius: 32 }]}>
        <Text style={{ fontSize: 22 }}>
          {(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '👤'}
        </Text>
      </View>
      <Text style={[styles.profileName, { marginTop: 8 }]}>
        {user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur'}
      </Text>
      <Text style={styles.profileEmail}>{user?.email || ''}</Text>

      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }]} onPress={onBackToProfile} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>BACK TO PROFILE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  601 — My Ads
// ─────────────────────────────────────────────────────────────────────────────
function MyAdsView({ ads, loading, onSelectAd }) {
  const timeLeft = (pub) => {
    const exp = pub.expiresAt
      ? new Date(pub.expiresAt)
      : new Date(new Date(pub.createdAt).getTime() + 24 * 3600 * 1000);
    const diff = Math.max(0, Math.round((exp - Date.now()) / 3600000));
    return diff > 0 ? `${diff}h left` : 'Expiré';
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.blue} />;

  return (
    <FlatList
      data={ads}
      keyExtractor={item => item._id}
      contentContainerStyle={styles.adsList}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>Aucune annonce</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLocal  = item.mode === 'local';
        const accent   = isLocal ? C.green : C.blue;
        const left     = timeLeft(item);
        const expired  = left === 'Expiré';
        const firstImg = item.medias?.find(m => m.type === 'image');
        const locLine  = isLocal
          ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(', ')
          : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');

        return (
          <TouchableOpacity style={styles.adCard} onPress={() => onSelectAd(item)} activeOpacity={0.8}>
            {firstImg
              ? <Image source={{ uri: firstImg.url }} style={styles.adCardImage} />
              : <View style={[styles.adCardImagePlaceholder, { backgroundColor: isLocal ? '#E8F9EE' : '#EBF4FF' }]}>
                  <Text style={{ fontSize: 28 }}>{isLocal ? '📍' : '🤝'}</Text>
                </View>
            }
            <View style={styles.adCardBody}>
              <View style={[styles.adModeBadge, { backgroundColor: isLocal ? '#E8F9EE' : '#EBF4FF', borderColor: accent }]}>
                <Text style={[styles.adModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
              </View>
              <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>
              {!!locLine && <Text style={styles.adCardLoc} numberOfLines={1}>📍 {locLine}</Text>}
              <Text style={[styles.adCardTime, { color: expired ? C.red : '#FF9500' }]}>{left}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  602 — Ad Details
// ─────────────────────────────────────────────────────────────────────────────
function AdDetailView({ ad, onRenew, onDelete, renewing }) {
  const isLocal   = ad.mode === 'local';
  const accent    = isLocal ? C.green : C.blue;
  const exp       = ad.expiresAt
    ? new Date(ad.expiresAt)
    : new Date(new Date(ad.createdAt).getTime() + 24 * 3600 * 1000);
  const hoursLeft = Math.max(0, Math.round((exp - Date.now()) / 3600000));
  const firstImg  = ad.medias?.find(m => m.type === 'image');
  const locLabel  = isLocal
    ? [ad.localisation?.ville, ad.localisation?.gouvernorat].filter(Boolean).join(', ')
    : [ad.localisationDebut?.ville, '→', ad.localisationFin?.ville].filter(Boolean).join(' ');

  return (
    <ScrollView contentContainerStyle={styles.adDetailContent} showsVerticalScrollIndicator={false}>
      {firstImg
        ? <Image source={{ uri: firstImg.url }} style={styles.adDetailImage} />
        : <View style={[styles.adDetailImagePlaceholder, { backgroundColor: isLocal ? '#E8F9EE' : '#EBF4FF' }]}>
            <Text style={{ fontSize: 40 }}>{isLocal ? '📍' : '🤝'}</Text>
          </View>
      }

      {!!locLabel && (
        <View style={[styles.adDetailLocPill, { borderColor: accent }]}>
          <Text style={[styles.adDetailLocText, { color: accent }]}>📍 {locLabel}</Text>
        </View>
      )}

      <Text style={[styles.adDetailTime, { color: hoursLeft > 0 ? '#FF9500' : C.red }]}>
        {hoursLeft > 0 ? `${hoursLeft}h remaining` : 'Expiré'}
      </Text>

      <Text style={styles.adDetailDesc}>{ad.description}</Text>

      <Text style={styles.statsTitle}>Statistics</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{ad.vues ?? 0}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{ad.nbLikes ?? ad.likes?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Contacts</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.renewBtn} onPress={onRenew} activeOpacity={0.85} disabled={renewing}>
        {renewing
          ? <ActivityIndicator color={C.white} />
          : <Text style={styles.renewBtnText}>RENEW (+24h)</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAdBtn} onPress={onDelete} activeOpacity={0.85}>
        <Text style={styles.deleteAdBtnText}>DELETE AD</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  603 — Renewed!
// ─────────────────────────────────────────────────────────────────────────────
function RenewedView({ onBackToAds }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkIcon}>✓</Text>
      </View>
      <Text style={styles.updatedTitle}>Ad renewed!</Text>
      <Text style={styles.renewedSub}>Active for another 24h</Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32, width: '80%' }]} onPress={onBackToAds} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>BACK TO MY ADS</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW  604 — Delete Ad confirmation
// ─────────────────────────────────────────────────────────────────────────────
function DeleteAdView({ onCancel, onConfirmDelete, deleting }) {
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.deleteCircle}>
        <Text style={styles.deleteCircleIcon}>!</Text>
      </View>
      <Text style={styles.updatedTitle}>Delete this ad?</Text>
      <Text style={styles.deleteSub}>
        This action cannot be undone.{'\n'}The ad will be permanently removed.
      </Text>
      <View style={styles.deleteActionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onConfirmDelete} activeOpacity={0.85} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.confirmDeleteBtnText}>DELETE</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants utilitaires
// ─────────────────────────────────────────────────────────────────────────────
function MenuRow({ label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuRowLabel, danger && { color: C.red }]}>{label}</Text>
      <Text style={[styles.menuRowChevron, danger && { color: C.red }]}>›</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <TextInput
      style={styles.textField}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || label}
      placeholderTextColor="#B0B3C6"
      keyboardType={keyboardType || 'default'}
      autoCapitalize="none"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal — gère les 4 vues (900 / 901 / 902 / 903)
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const navigation = useNavigation();

  // 'main' | 'edit' | 'settings' | 'updated' | 'myads' | 'addetail' | 'renewed' | 'deleteconfirm'
  const [view,        setView]        = useState('main');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [myAds,       setMyAds]       = useState([]);
  const [adsLoading,  setAdsLoading]  = useState(false);
  const [selectedAd,  setSelectedAd]  = useState(null);
  const [renewing,    setRenewing]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const fetchMyAds = async () => {
    setAdsLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/ads?_t=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setMyAds(data.publications ?? data ?? []);
    } catch {
      setMyAds([]);
    } finally {
      setAdsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        getCurrentUser().then(setCurrentUser),
        fetchMyAds(),
      ]).finally(() => setLoading(false));
    }, [])
  );

  const goToMyAds = () => {
    fetchMyAds();
    setView('myads');
  };

  const handleRenew = async () => {
    if (!selectedAd) return;
    setRenewing(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      await fetch(`${API_URL}/publications/${selectedAd._id}/renew`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setView('renewed');
    } catch {
      Alert.alert('Erreur', 'Impossible de renouveler.');
    } finally {
      setRenewing(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedAd) return;
    setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/publications/${selectedAd._id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erreur ${res.status}`);
      }
      setSelectedAd(null);
      setView('myads');
      await fetchMyAds(); // rafraîchit la liste depuis le serveur
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible de supprimer.');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogOut = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => { await apiLogout(); navigation.navigate('Login'); },
      },
    ]);
  };

  const localCount = myAds.filter(a => a.mode === 'local').length;
  const duoCount   = myAds.filter(a => a.mode === 'duo').length;

  const TITLES = {
    main: 'Profile', edit: 'Edit Profile', settings: 'Settings',
    changepassword: 'Change Password',
    updated: 'Profile', myads: 'My Ads', addetail: 'Ad Details',
    renewed: 'Renewed!', deleteconfirm: 'Delete Ad',
  };

  const handleBack = () => {
    if (view === 'edit' || view === 'settings' || view === 'myads') setView('main');
    else if (view === 'changepassword') setView('settings');
    else if (view === 'addetail') setView('myads');
    else if (view === 'renewed') setView('myads');
    else if (view === 'deleteconfirm') setView('addetail');
    else navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TITLES[view]}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Contenu selon la vue ── */}
      {view === 'main' && (
        <ProfileMain
          user={currentUser}
          localCount={localCount}
          duoCount={duoCount}
          onEditProfile={() => setView('edit')}
          onSettings={() => setView('settings')}
          onMyAds={goToMyAds}
          onHelpSupport={() => {}}
          onLogOut={handleLogOut}
        />
      )}

      {view === 'edit' && (
        <EditProfileView
          user={currentUser}
          onBack={() => setView('main')}
          onSave={() => getCurrentUser().then(u => { setCurrentUser(u); setView('updated'); })}
        />
      )}

      {view === 'settings' && (
        <SettingsView onChangePassword={() => setView('changepassword')} />
      )}

      {view === 'changepassword' && (
        <ChangePasswordView onSuccess={() => setView('settings')} />
      )}

      {view === 'updated' && (
        <ProfileUpdatedView user={currentUser} onBackToProfile={() => setView('main')} />
      )}

      {view === 'myads' && (
        <MyAdsView
          ads={myAds}
          loading={adsLoading}
          onSelectAd={(ad) => { setSelectedAd(ad); setView('addetail'); }}
        />
      )}

      {view === 'addetail' && selectedAd && (
        <AdDetailView
          ad={selectedAd}
          renewing={renewing}
          onRenew={handleRenew}
          onDelete={() => setView('deleteconfirm')}
        />
      )}

      {view === 'renewed' && (
        <RenewedView onBackToAds={() => { fetchMyAds(); setView('myads'); }} />
      )}

      {view === 'deleteconfirm' && (
        <DeleteAdView
          deleting={deleting}
          onCancel={() => setView('addetail')}
          onConfirmDelete={handleDeleteConfirmed}
        />
      )}

      {/* ── Bottom Tab Bar ── */}
      <View style={styles.tabBar}>
        <TabItem icon="🌍" label="Globe"   onPress={() => navigation.navigate('Map')} />
        <TabItem icon="🔍" label="Search"  onPress={() => navigation.navigate('Local')} />
        <TabItem icon="👤" label="Profile" active />
      </View>
    </SafeAreaView>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 38, paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0F1F8',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon:    { fontSize: 18, color: C.dark, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.dark },

  // Page content
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
    alignItems: 'center',
  },

  // Avatar
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#D0E8FF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitials: { fontSize: 32, color: C.blue, fontWeight: '700' },
  avatarImage:    { width: 88, height: 88, borderRadius: 44 },

  // ── Active Ads box (view 600)
  activeAdsBox: {
    width: '100%', backgroundColor: C.white,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 16,
  },
  activeAdsTitle: { fontSize: 13, fontWeight: '700', color: C.grey, marginBottom: 12, letterSpacing: 0.3 },
  activeAdsRow:   { flexDirection: 'row', gap: 12 },
  activeAdsCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 12, borderWidth: 2,
    backgroundColor: C.bg,
  },
  activeAdsCount: { fontSize: 28, fontWeight: '900' },
  activeAdsLabel: { fontSize: 11, fontWeight: '700', color: C.grey, marginTop: 2, letterSpacing: 0.5 },

  // ── View My Ads button
  viewMyAdsBtn: {
    width: '100%', backgroundColor: C.dark,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 24,
  },
  viewMyAdsBtnText: { color: C.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // ── My Ads list (view 601)
  adsList:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 12 },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#555' },

  adCard: {
    flexDirection: 'row', backgroundColor: C.white,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', minHeight: 90,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  adCardImage: { width: 90, height: 90 },
  adCardImagePlaceholder: {
    width: 90, height: 90,
    justifyContent: 'center', alignItems: 'center',
  },
  adCardBody: {
    flex: 1, padding: 12, gap: 4,
    justifyContent: 'space-between',
  },
  adModeBadge: {
    alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  adModeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  adCardDesc:  { fontSize: 13, color: C.dark, fontWeight: '500' },
  adCardLoc:   { fontSize: 11, color: C.grey },
  adCardTime:  { fontSize: 11, fontWeight: '700' },

  // ── Ad Detail (view 602)
  adDetailContent: { paddingBottom: 120, paddingTop: 0 },
  adDetailImage:   { width: '100%', height: 220, resizeMode: 'cover' },
  adDetailImagePlaceholder: {
    width: '100%', height: 180,
    justifyContent: 'center', alignItems: 'center',
  },
  adDetailLocPill: {
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 14,
  },
  adDetailLocText: { fontSize: 13, fontWeight: '700' },
  adDetailTime:    { fontSize: 13, fontWeight: '700', marginHorizontal: 16, marginTop: 8 },
  adDetailDesc:    { fontSize: 14, color: '#444', lineHeight: 20, marginHorizontal: 16, marginTop: 10 },
  statsTitle: { fontSize: 15, fontWeight: '800', color: C.dark, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statsRow:   { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  statCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', paddingVertical: 14,
  },
  statCount: { fontSize: 26, fontWeight: '900', color: C.dark },
  statLabel: { fontSize: 11, color: C.grey, fontWeight: '600', marginTop: 2 },

  renewBtn: {
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: C.dark, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  renewBtnText: { color: C.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  deleteAdBtn: {
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, borderWidth: 2, borderColor: C.red,
    paddingVertical: 15, alignItems: 'center',
  },
  deleteAdBtnText: { color: C.red, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // ── Centered views (603 & 604) — reuse updatedCenter
  renewedSub:   { fontSize: 14, color: C.grey, marginTop: 8, textAlign: 'center' },

  deleteCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: C.red,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  deleteCircleIcon: { fontSize: 36, color: C.red, fontWeight: '700' },
  deleteSub: { fontSize: 13, color: C.grey, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  deleteActionsRow: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    paddingVertical: 15, alignItems: 'center', backgroundColor: C.white,
  },
  cancelBtnText:       { color: C.dark, fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn:    { flex: 1, borderRadius: 14, backgroundColor: C.red, paddingVertical: 15, alignItems: 'center' },
  confirmDeleteBtnText:{ color: C.white, fontWeight: '800', fontSize: 14 },

  // ── Settings language picker
  langModal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 999,
  },
  langModalPanel: {
    width: '80%', backgroundColor: C.white,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  langModalTitle: { fontSize: 16, fontWeight: '800', color: C.dark, marginBottom: 14, textAlign: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 6,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  langOptionActive:  { backgroundColor: C.dark, borderColor: C.dark },
  langOptionText:    { fontSize: 15, fontWeight: '600', color: C.dark },
  langCheck:         { fontSize: 16, color: C.white, fontWeight: '700' },
  langCancelBtn:     { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  langCancelText:    { fontSize: 14, color: C.grey, fontWeight: '600' },
  settingsRowRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Change Password
  pwdIconWrap:  { marginBottom: 12, alignItems: 'center' },
  pwdTitle:     { fontSize: 20, fontWeight: '800', color: C.dark, marginBottom: 6 },
  pwdSub:       { fontSize: 13, color: C.grey, textAlign: 'center', marginBottom: 4 },
  pwdFieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16,
  },
  pwdField: { flex: 1, fontSize: 14, color: C.dark, paddingVertical: 14 },
  pwdEye:   { padding: 8 },
  pwdEyeIcon: { fontSize: 16 },

  profileName:  { fontSize: 20, fontWeight: '800', color: C.dark, marginBottom: 4 },
  profileEmail: { fontSize: 13, color: C.grey, marginBottom: 24 },

  // Change photo
  changePhotoBtn: {
    backgroundColor: C.bg,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 20, paddingVertical: 9,
    marginBottom: 24,
  },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: C.dark },

  // Menu list (view 900)
  menuList: { width: '100%', gap: 0 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  menuRowLabel:   { fontSize: 15, fontWeight: '600', color: C.dark },
  menuRowChevron: { fontSize: 20, color: '#CCC' },

  // Field (view 901)
  fieldList: { width: '100%', gap: 12, marginBottom: 28 },
  textField: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: C.dark,
  },

  // Primary button
  primaryBtn: {
    width: '100%',
    backgroundColor: C.dark,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Settings (view 902)
  sectionLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: C.grey, marginBottom: 8, letterSpacing: 0.4 },
  settingsGroup: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingsRowLabel: { fontSize: 15, color: C.dark, fontWeight: '500' },
  settingsRowValue: { fontSize: 14, color: C.grey },
  settingsChevron:  { fontSize: 20, color: '#CCC' },

  // Updated (view 903)
  updatedCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: C.dark,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon:    { fontSize: 36, color: C.dark, fontWeight: '700' },
  updatedTitle: { fontSize: 20, fontWeight: '800', color: C.dark },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingBottom: 6, paddingTop: 8,
  },
  tabItem:          { flex: 1, alignItems: 'center', gap: 4 },
  tabIconBox:       { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tabIconBoxActive: { backgroundColor: C.dark },
  tabIcon:          { fontSize: 18 },
  tabLabel:         { fontSize: 11, color: '#999', fontWeight: '500' },
  tabLabelActive:   { color: C.dark, fontWeight: '700' },
});