// src/screens/ProfileScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, Switch, Alert, Modal,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { environment } from '../environments/environment';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, LANGUAGE_MAP, LANGUAGE_NAMES } from '../i18n/index';

const API_URL = environment.apiUrl;

// ── Palette mint clair ─────────────────────────────────────────────────────────
const C = {
  green:     '#2DBD7E', greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6', blueGlow:  'rgba(59,126,246,0.10)',
  red:       '#EF4444',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  cardBg:    '#FFFFFF',
};

// ── VIEW 900 — Profile principal ───────────────────────────────────────────────
function ProfileMain({ user, localCount, duoCount, onEditProfile, onSettings, onMyAds, onHelpSupport, onLogOut, onBuyPoints }) {
  const { t } = useTranslation();
  const solde = typeof user?.pointsSolde === 'number' ? user.pointsSolde : 100;
  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarCircle}>
        {user?.avatar
          ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          : <FontAwesome6 name="circle-user" size={52} color={C.green} />}
      </View>
      <Text style={styles.profileName}>{user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || t('profile.unknown') : t('profile.unknown')}</Text>
      <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || user?.phone || ''}</Text>

      {/* ── Solde de points ── */}
      <View style={styles.pointsBox}>
        <View style={styles.pointsBoxLeft}>
          <FontAwesome6 name="coins" size={16} color="#F59E0B" />
          <Text style={styles.pointsBoxLabel}>Solde de points</Text>
        </View>
        <View style={styles.pointsBoxRight}>
          <Text style={styles.pointsBoxValue}>{solde} pts</Text>
          {solde <= 0 && (
            <TouchableOpacity style={styles.buyPointsBtn} onPress={onBuyPoints} activeOpacity={0.85}>
              <Text style={styles.buyPointsBtnText}>+ Acheter</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.activeAdsBox}>
        <Text style={styles.activeAdsTitle}>{t('profile.activeAds')}</Text>
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

      <TouchableOpacity style={styles.viewMyAdsBtn} onPress={onMyAds} activeOpacity={0.85}>
        <Text style={styles.viewMyAdsBtnText}>{t('profile.viewMyAds')}</Text>
        <FontAwesome6 name="arrow-right" size={14} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.menuList}>
        <MenuRow icon="pen-to-square"      label={t('profile.editProfile')}  onPress={onEditProfile} />
        <MenuRow icon="gear"               label={t('profile.settings')}     onPress={onSettings}    />
        <MenuRow icon="clipboard-list"     label={t('profile.myAds')}        onPress={onMyAds}       />
        <MenuRow icon="circle-question"    label={t('profile.helpSupport')}  onPress={onHelpSupport} />
        <MenuRow icon="right-from-bracket" label={t('profile.logout')}       onPress={onLogOut} danger />
      </View>
    </ScrollView>
  );
}

// ── VIEW 901 — Edit Profile ────────────────────────────────────────────────────
function EditProfileView({ user, onSave }) {
  const { t } = useTranslation();
  const [fullName,      setFullName]      = useState(`${user?.prenom || ''} ${user?.nom || ''}`.trim());
  const [phone,         setPhone]         = useState(user?.phone || '');
  const [email,         setEmail]         = useState(user?.email || '');
  const [preferredZone, setPreferredZone] = useState(user?.preferredZone || '');
  const [saving,        setSaving]        = useState(false);
  const [avatarUri,     setAvatarUri]     = useState(user?.avatar || null);
  const [uploading,     setUploading]     = useState(false);

  const handleChangePhoto = () => {
    Alert.alert(t('profile.changePhoto'), t('profile.chooseSource'), [
      { text: t('profile.gallery'), onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert(t('profile.permissionDenied'), t('profile.galleryPermission')); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: t('profile.camera'), onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert(t('profile.permissionDenied'), t('profile.cameraPermission')); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (asset) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('avatar', { uri: asset.uri, name: `avatar_${Date.now()}.jpg`, type: 'image/jpeg' });
      const res = await fetch(`${API_URL}/users/me/avatar`, { method: 'PUT', headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      if (!res.ok) throw new Error(t('profile.uploadFailed'));
      const data = await res.json();
      setAvatarUri(data.avatar || asset.uri);
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.changePhotoFailed')); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const [prenom, ...rest] = fullName.trim().split(' ');
      const nom = rest.join(' ');
      const res = await fetch(`${API_URL}/users/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ prenom, nom, phone, email, preferredZone }) });
      if (!res.ok) throw new Error(t('profile.updateError'));
      onSave();
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarCircle}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          : <FontAwesome6 name="circle-user" size={52} color={C.green} />}
      </View>
      <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.75} onPress={handleChangePhoto} disabled={uploading}>
        {uploading
          ? <ActivityIndicator size="small" color={C.green} />
          : <>
              <FontAwesome6 name="camera" size={13} color={C.green} />
              <Text style={styles.changePhotoText}>{t('profile.changePhoto')}</Text>
            </>}
      </TouchableOpacity>
      <View style={styles.fieldList}>
        <Field label={t('profile.fullName')}      value={fullName}      onChangeText={setFullName}     placeholder={t('profile.fullName')} />
        <Field label={t('profile.phone')}         value={phone}         onChangeText={setPhone}         placeholder={t('login.phone')} keyboardType="phone-pad" />
        <Field label={t('profile.email')}         value={email}         onChangeText={setEmail}         placeholder={t('login.email')} keyboardType="email-address" />
        <Field label={t('profile.preferredZone')} value={preferredZone} onChangeText={setPreferredZone} placeholder={t('profile.preferredZonePlaceholder')} />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('profile.saveProfile')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const LANGUAGES = ['العربية', 'Français', 'English'];

// ── VIEW 902 — Settings ────────────────────────────────────────────────────────
function SettingsView({ onChangePassword }) {
  const { t, i18n } = useTranslation();
  const [language,        setLanguage]        = useState(LANGUAGE_NAMES[i18n.language] || 'Français');
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

  const handleSelectLanguage = async (lang) => {
    setLanguage(lang);
    setShowLangPicker(false);
    const code = LANGUAGE_MAP[lang] || 'fr';
    await changeAppLanguage(code);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/users/me/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ language, notifications, locationAccess }) });
      if (!res.ok) throw new Error();
      Alert.alert(t('common.success'), t('profile.settingsSaved'));
    } catch { Alert.alert(t('common.error'), t('common.networkError')); }
    finally { setSaving(false); }
  };

  if (loadingSettings) return <ActivityIndicator style={{ flex: 1 }} color={C.green} />;

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {showLangPicker && (
        <View style={styles.langModal}>
          <View style={styles.langModalPanel}>
            <Text style={styles.langModalTitle}>{t('profile.language')}</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} style={[styles.langOption, language === lang && styles.langOptionActive]} onPress={() => handleSelectLanguage(lang)} activeOpacity={0.8}>
                <Text style={[styles.langOptionText, language === lang && { color: '#FFFFFF' }]}>{lang}</Text>
                {language === lang && <FontAwesome6 name="check" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langCancelBtn} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('profile.preferences')}</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLangPicker(true)} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.language')}</Text>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowValue}>{language}</Text>
            <FontAwesome6 name="chevron-right" size={13} color={C.textFaint} />
          </View>
        </TouchableOpacity>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
          <Text style={styles.settingsRowLabel}>{t('profile.notifications')}</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: C.border, true: C.green }} thumbColor="#FFFFFF" />
        </View>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
          <Text style={styles.settingsRowLabel}>{t('profile.locationAccess')}</Text>
          <Switch value={locationAccess} onValueChange={setLocationAccess} trackColor={{ false: C.border, true: C.blue }} thumbColor="#FFFFFF" />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('profile.account')}</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={onChangePassword} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.changePassword')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={C.textFaint} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.privacy')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={C.textFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: C.border }]}
          onPress={() => Alert.alert(t('profile.deleteAccount'), t('profile.areYouSure'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive' }])}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingsRowLabel, { color: C.red }]}>{t('profile.deleteAccount')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={C.red} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('common.save').toUpperCase()}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 902b — Change Password ────────────────────────────────────────────────
function ChangePasswordView({ onSuccess }) {
  const { t } = useTranslation();
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) return Alert.alert(t('common.error'), t('profile.allFieldsRequired'));
    if (newPwd.length < 6) return Alert.alert(t('common.error'), t('forgetPassword.errMin6'));
    if (newPwd !== confirmPwd) return Alert.alert(t('common.error'), t('forgetPassword.errMatch'));
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.message || t('common.error'));
      Alert.alert(t('common.success'), t('profile.passwordChanged'), [{ text: 'OK', onPress: onSuccess }]);
    } catch (err) { Alert.alert(t('common.error'), err.message); }
    finally { setSaving(false); }
  };

  const PwdField = ({ label, value, onChange, show, onToggle }) => (
    <View style={styles.pwdFieldWrap}>
      <FontAwesome6 name="lock" size={14} color={C.textFaint} style={{ marginRight: 10 }} />
      <TextInput style={styles.pwdField} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={C.textFaint} secureTextEntry={!show} autoCapitalize="none" />
      <TouchableOpacity style={styles.pwdEye} onPress={onToggle}>
        <FontAwesome6 name={show ? 'eye-slash' : 'eye'} size={14} color={C.textFaint} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pwdIconWrap}>
        <View style={styles.pwdIconCircle}>
          <FontAwesome6 name="lock" size={32} color={C.green} />
        </View>
      </View>
      <Text style={styles.pwdTitle}>{t('profile.changePasswordTitle')}</Text>
      <Text style={styles.pwdSub}>{t('profile.changePasswordSub')}</Text>
      <View style={[styles.fieldList, { marginTop: 24 }]}>
        <PwdField label={t('profile.currentPassword')} value={currentPwd} onChange={setCurrentPwd} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
        <PwdField label={t('profile.newPassword')}     value={newPwd}     onChange={setNewPwd}     show={showNew}     onToggle={() => setShowNew(v => !v)} />
        <PwdField label={t('profile.confirmPassword')} value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('profile.saveProfile')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 903 — Profile Updated ─────────────────────────────────────────────────
function ProfileUpdatedView({ user, onBackToProfile }) {
  const { t } = useTranslation();
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <FontAwesome6 name="check" size={32} color={C.green} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.profileUpdated')}</Text>
      <View style={[styles.avatarCircle, { marginTop: 20, width: 64, height: 64, borderRadius: 32 }]}>
        <Text style={{ fontSize: 22, color: C.green, fontWeight: '700' }}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '?'}</Text>
      </View>
      <Text style={[styles.profileName, { marginTop: 8 }]}>{user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || t('profile.unknown') : t('profile.unknown')}</Text>
      <Text style={styles.profileEmail}>{user?.email || ''}</Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32, width: '100%' }]} onPress={onBackToProfile} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{t('profile.backToProfile')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 601 — My Ads ──────────────────────────────────────────────────────────
function MyAdsView({ ads, loading, onSelectAd, onRenew, onDelete, renewing, user }) {
  const { t } = useTranslation();
  const [qrItem, setQrItem] = useState(null);
  const qrViewRef = useRef(null);

  const buildQrFile = async () => {
    const fileUri = await qrViewRef.current.capture();
    return fileUri;
  };

  const handleShare = async () => {
    try {
      const fileUri = await buildQrFile();
      await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: qrItem.description || 'QR Code' });
    } catch (e) { Alert.alert(t('common.error'), t('profile.qrShareError')); }
  };

  const getTimeLeft = (pub) => {
    const exp  = pub.expiresAt ? new Date(pub.expiresAt) : new Date(new Date(pub.createdAt).getTime() + 24 * 3600 * 1000);
    const diff = Math.max(0, Math.round((exp - Date.now()) / 3600000));
    return { diff, label: diff > 0 ? t('profile.hoursLeft', { diff }) : t('profile.expired') };
  };
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.green} />;
  return (
    <>
      {/* Carte A4 hors-écran pour capture */}
      <ViewShot ref={qrViewRef} options={{ format: 'jpg', quality: 1 }} style={styles.qrHidden}>
        <View style={styles.qrA4Card}>
          {/* Logo + nom de l'appli */}
          <View style={styles.qrA4Header}>
            <Image source={require('../../assets/logo.png')} style={styles.qrA4Logo} resizeMode="contain" />
            <Text style={styles.qrA4Brand}>BYMAP</Text>
          </View>

          <View style={styles.qrA4Sep} />

          {/* Nom de l'utilisateur */}
          <Text style={styles.qrA4Name}>
            {`${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Utilisateur'}
          </Text>

          {/* QR Code */}
          <View style={styles.qrA4QrWrap}>
            {!!qrItem && (
              <QRCode
                value={`${API_URL}/publications/${qrItem._id}/scan`}
                size={180}
                color="#1A1A2E"
                backgroundColor="#FFFFFF"
              />
            )}
          </View>

          <View style={styles.qrA4Sep} />

          {/* Phrase d'accueil */}
          <Text style={styles.qrA4Welcome}>Bienvenue sur mon espace !</Text>
        </View>
      </ViewShot>

      <Modal visible={!!qrItem} transparent animationType="fade" onRequestClose={() => setQrItem(null)}>
        <TouchableOpacity style={styles.qrOverlay} onPress={() => setQrItem(null)} activeOpacity={1}>
          <TouchableOpacity style={styles.qrCard} onPress={() => {}} activeOpacity={1}>
            <Text style={styles.qrAdTitle} numberOfLines={2}>
              {qrItem?.description || `#${qrItem?._id?.slice(-6)?.toUpperCase()}`}
            </Text>
            <View style={styles.qrCodeWrap}>
              {!!qrItem && (
                <QRCode
                  value={`${API_URL}/publications/${qrItem._id}/scan`}
                  size={200}
                  color="#1A1A2E"
                  backgroundColor="#FFFFFF"
                />
              )}
            </View>
            <TouchableOpacity style={styles.qrShareBtn} onPress={handleShare} activeOpacity={0.82}>
              <FontAwesome6 name="share-nodes" size={20} color="#FFFFFF" />
              <Text style={styles.qrShareBtnText}>{t('profile.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrItem(null)} activeOpacity={0.85}>
              <Text style={styles.qrCloseBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <FlatList
        data={ads} keyExtractor={item => item._id}
        contentContainerStyle={styles.adsList} showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.adsListHeader}>
          <Text style={styles.adsListTitle}>{t('profile.myAds')}</Text>
          <View style={styles.adsListCount}><Text style={styles.adsListCountText}>{ads.length}</Text></View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <FontAwesome6 name="inbox" size={52} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('profile.noAds')}</Text>
          <Text style={styles.emptyText}>{t('profile.noAdsSub')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLocal  = item.mode === 'local';
        const accent   = isLocal ? C.green : C.blue;
        const accentGlow = isLocal ? C.greenGlow : C.blueGlow;
        const { diff: hoursLeft, label: left } = getTimeLeft(item);
        const expired  = hoursLeft <= 0;
        const firstImg = item.medias?.find(m => m.type === 'image');
        const locLine  = isLocal
          ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(', ')
          : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');
        return (
          <TouchableOpacity style={styles.adCard} onPress={() => onSelectAd(item)} activeOpacity={0.92}>
            {/* ── Cover image ── */}
            <View style={styles.adCardCover}>
              {firstImg
                ? <Image source={{ uri: firstImg.url }} style={styles.adCardCoverImg} resizeMode="cover" />
                : <View style={[styles.adCardCoverPlaceholder, { backgroundColor: accentGlow }]}>
                    <FontAwesome6 name={isLocal ? 'location-dot' : 'handshake'} size={42} color={accent} />
                  </View>
              }
              {/* Mode badge — top left */}
              <View style={[styles.adModeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
                <View style={[styles.adModeDot, { backgroundColor: accent }]} />
                <Text style={[styles.adModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
              </View>
              {/* Time badge — top right */}
              <View style={[styles.adTimeBadge, {
                backgroundColor: expired ? 'rgba(239,68,68,0.12)' : 'rgba(255,149,0,0.12)',
                borderColor: expired ? C.red : '#FF9500',
              }]}>
                <FontAwesome6
                  name={expired ? 'triangle-exclamation' : 'clock'}
                  size={10}
                  color={expired ? C.red : '#FF9500'}
                />
                <Text style={[styles.adTimeBadgeText, { color: expired ? C.red : '#FF9500' }]}>
                  {` ${left}`}
                </Text>
              </View>
            </View>

            {/* ── Body ── */}
            <View style={styles.adCardBody}>
              {!!item.description && (
                <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              {!!locLine && (
                <View style={styles.adCardLocRow}>
                  <FontAwesome6 name="location-dot" size={11} color={C.textFaint} />
                  <Text style={styles.adCardLoc} numberOfLines={1}>{locLine}</Text>
                </View>
              )}
            </View>

            {/* ── Divider ── */}
            <View style={styles.adCardDivider} />

            {/* ── Actions ── */}
            <View style={styles.adCardActions}>
              <TouchableOpacity style={styles.adRenewBtn} onPress={() => onRenew(item)} activeOpacity={0.8} disabled={renewing}>
                <FontAwesome6 name="rotate" size={13} color={C.blue} style={{ marginRight: 6 }} />
                <Text style={styles.adRenewBtnText}>{renewing ? '…' : t('profile.renew')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adQrBtn} onPress={() => setQrItem(item)} activeOpacity={0.8}>
                <FontAwesome6 name="qrcode" size={16} color={C.green} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.adDeleteBtn} onPress={() => onDelete(item)} activeOpacity={0.8}>
                <FontAwesome6 name="trash" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
    </>
  );
}

// ── VIEW 602 — Ad Detail ───────────────────────────────────────────────────────
function AdDetailView({ ad, onRenew, onDelete, renewing }) {
  const { t } = useTranslation();
  const isLocal   = ad.mode === 'local';
  const accent    = isLocal ? C.green : C.blue;
  const accentGlow = isLocal ? C.greenGlow : C.blueGlow;
  const exp       = ad.expiresAt ? new Date(ad.expiresAt) : new Date(new Date(ad.createdAt).getTime() + 24 * 3600 * 1000);
  const hoursLeft = Math.max(0, Math.round((exp - Date.now()) / 3600000));
  const firstImg  = ad.medias?.find(m => m.type === 'image');
  const locLabel  = isLocal ? [ad.localisation?.ville, ad.localisation?.gouvernorat].filter(Boolean).join(', ') : [ad.localisationDebut?.ville, '→', ad.localisationFin?.ville].filter(Boolean).join(' ');
  return (
    <ScrollView contentContainerStyle={styles.adDetailContent} showsVerticalScrollIndicator={false}>
      {firstImg
        ? <Image source={{ uri: firstImg.url }} style={styles.adDetailImage} />
        : <View style={[styles.adDetailImagePlaceholder, { backgroundColor: accentGlow }]}>
            <FontAwesome6 name={isLocal ? 'location-dot' : 'handshake'} size={40} color={accent} />
          </View>}
      {!!locLabel && (
        <View style={[styles.adDetailLocPill, { borderColor: accent, backgroundColor: accentGlow }]}>
          <FontAwesome6 name="location-dot" size={12} color={accent} />
          <Text style={[styles.adDetailLocText, { color: accent }]}> {locLabel}</Text>
        </View>
      )}
      <Text style={[styles.adDetailTime, { color: hoursLeft > 0 ? '#FF9500' : C.red }]}>
        {hoursLeft > 0 ? t('profile.hoursLeft', { diff: hoursLeft }) : t('profile.expired')}
      </Text>
      <Text style={styles.adDetailDesc}>{ad.description}</Text>
      <Text style={styles.statsTitle}>{t('profile.stats')}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{ad.vues ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.views')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{ad.nbLikes ?? ad.likes?.length ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.contacts')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{ad.nbScans ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.scans')}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.primaryBtn, { marginHorizontal: 16, marginTop: 24 }, renewing && { opacity: 0.7 }]} onPress={onRenew} activeOpacity={0.85} disabled={renewing}>
        {renewing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('profile.renew24')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAdBtn} onPress={onDelete} activeOpacity={0.85}>
        <Text style={styles.deleteAdBtnText}>{t('profile.deleteAd')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 603 — Renewed ─────────────────────────────────────────────────────────
function RenewedView({ onBackToAds }) {
  const { t } = useTranslation();
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <FontAwesome6 name="check" size={32} color={C.green} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.renewed')}</Text>
      <Text style={styles.renewedSub}>{t('profile.renewedSub')}</Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32, width: '80%' }]} onPress={onBackToAds} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{t('profile.backToAds')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 604 — Delete Confirm ──────────────────────────────────────────────────
function DeleteAdView({ onCancel, onConfirmDelete, deleting }) {
  const { t } = useTranslation();
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.deleteCircle}>
        <FontAwesome6 name="triangle-exclamation" size={32} color={C.red} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.deleteAdConfirm')}</Text>
      <Text style={styles.deleteSub}>{t('profile.deleteAdSub')}{'\n'}{t('profile.deleteAdFinal')}</Text>
      <View style={styles.deleteActionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>{t('common.cancel').toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onConfirmDelete} activeOpacity={0.85} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteBtnText}>{t('common.delete').toUpperCase()}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── VIEW 905 — Acheter des points ──────────────────────────────────────────────
const BUY_PACKAGES = [
  { pts: 10,  prix: 1  },
  { pts: 50,  prix: 5  },
  { pts: 100, prix: 10 },
  { pts: 200, prix: 20 },
];

function BuyPointsView({ user, onSuccess }) {
  const [selected, setSelected] = useState(null);
  const [buying,   setBuying]   = useState(false);
  const solde = typeof user?.pointsSolde === 'number' ? user.pointsSolde : 100;

  const handleBuy = async () => {
    if (!selected) return;
    setBuying(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/users/me/points/buy`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ quantite: selected.pts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      Alert.alert(
        'Succès',
        `${selected.pts} points ajoutés !\nNouveau solde : ${data.pointsSolde} pts`,
        [{ text: 'OK', onPress: () => onSuccess(data.user) }]
      );
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Erreur réseau');
    } finally {
      setBuying(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pointsIconCircle}>
        <FontAwesome6 name="coins" size={36} color="#F59E0B" />
      </View>
      <Text style={styles.buyTitle}>Acheter des points</Text>
      <Text style={styles.buySub}>
        Solde actuel : <Text style={{ color: '#F59E0B', fontWeight: '800' }}>{solde} pts</Text>
      </Text>
      <Text style={[styles.buySub, { marginTop: 4 }]}>10 points = 1 dinar</Text>

      <View style={{ width: '100%', gap: 12, marginTop: 24, marginBottom: 32 }}>
        {BUY_PACKAGES.map(pkg => (
          <TouchableOpacity
            key={pkg.pts}
            style={[styles.pkgCard, selected?.pts === pkg.pts && styles.pkgCardSelected]}
            onPress={() => setSelected(pkg)}
            activeOpacity={0.85}
          >
            <View style={styles.pkgLeft}>
              <FontAwesome6 name="coins" size={18} color={selected?.pts === pkg.pts ? '#FFFFFF' : '#F59E0B'} />
              <Text style={[styles.pkgPts, selected?.pts === pkg.pts && { color: '#FFFFFF' }]}>
                {pkg.pts} points
              </Text>
            </View>
            <Text style={[styles.pkgPrix, selected?.pts === pkg.pts && { color: '#FFFFFF' }]}>
              {pkg.prix} TND
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: '#F59E0B' }, (!selected || buying) && { opacity: 0.6 }]}
        onPress={handleBuy}
        activeOpacity={0.85}
        disabled={!selected || buying}
      >
        {buying
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.primaryBtnText}>
              {selected
                ? `Acheter ${selected.pts} pts — ${selected.prix} TND`
                : 'Sélectionnez un forfait'}
            </Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Utilitaires ────────────────────────────────────────────────────────────────
function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuRowLeft}>
        <View style={[styles.menuRowIconBox, danger && { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
          <FontAwesome6 name={icon} size={15} color={danger ? C.red : C.textDim} />
        </View>
        <Text style={[styles.menuRowLabel, danger && { color: C.red }]}>{label}</Text>
      </View>
      <FontAwesome6 name="chevron-right" size={13} color={danger ? C.red : C.textFaint} />
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <TextInput
      style={styles.textField} value={value} onChangeText={onChangeText}
      placeholder={placeholder || label} placeholderTextColor={C.textFaint}
      keyboardType={keyboardType || 'default'} autoCapitalize="none"
    />
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const navigation = useNavigation();
  const { t }      = useTranslation();
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
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res   = await fetch(`${API_URL}/users/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setCurrentUser({ ...u, avatar: u.avatarUrl });
          await AsyncStorage.setItem('currentUser', JSON.stringify(u));
        } else {
          const cached = await getCurrentUser();
          setCurrentUser(cached);
        }
      } catch {
        const cached = await getCurrentUser();
        setCurrentUser(cached);
      }
    };
    Promise.all([fetchUser(), fetchMyAds()]).finally(() => setLoading(false));
  }, []));

  const goToMyAds = () => { fetchMyAds(); setView('myads'); };

  const handleRenew = async (ad) => {
    const target = ad || selectedAd;
    if (!target) return; setRenewing(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      await fetch(`${API_URL}/publications/${target._id}/renew`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setView('renewed');
    } catch { Alert.alert(t('common.error'), t('profile.renewError')); }
    finally { setRenewing(false); }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedAd) return; setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/publications/${selectedAd._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `${t('common.error')} ${res.status}`); }
      setSelectedAd(null); setView('myads'); await fetchMyAds();
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.deleteError')); }
    finally { setDeleting(false); }
  };

  const handleBuyPointsSuccess = async (updatedUser) => {
    setCurrentUser({ ...updatedUser, avatar: updatedUser.avatarUrl });
    await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setView('main');
  };

  const handleLogOut = async () => {
    Alert.alert(t('common.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: async () => { await apiLogout(); navigation.navigate('Login'); } },
    ]);
  };

  const localCount = myAds.filter(a => a.mode === 'local').length;
  const duoCount   = myAds.filter(a => a.mode === 'duo').length;

  const TITLES = {
    main:          t('common.profile'),
    edit:          t('profile.editProfile'),
    settings:      t('profile.settings'),
    changepassword:t('profile.changePasswordTitle'),
    updated:       t('common.profile'),
    myads:         t('profile.myAds'),
    addetail:      t('profile.adDetailTitle'),
    renewed:       t('profile.renewed'),
    deleteconfirm: t('common.delete'),
    buypoints:     'Acheter des points',
  };

  const handleBack = () => {
    if (view === 'edit' || view === 'settings' || view === 'myads' || view === 'buypoints') setView('main');
    else if (view === 'changepassword') setView('settings');
    else if (view === 'addetail') setView('myads');
    else if (view === 'renewed') setView('myads');
    else if (view === 'deleteconfirm') setView('addetail');
    else navigation.goBack();
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{TITLES[view]}</Text>
          <View style={{ width: 40 }} />
        </View>

        {view === 'main'          && <ProfileMain user={currentUser} localCount={localCount} duoCount={duoCount} onEditProfile={() => setView('edit')} onSettings={() => setView('settings')} onMyAds={goToMyAds} onHelpSupport={() => {}} onLogOut={handleLogOut} onBuyPoints={() => setView('buypoints')} />}
        {view === 'buypoints'     && <BuyPointsView user={currentUser} onSuccess={handleBuyPointsSuccess} />}
        {view === 'edit'          && <EditProfileView user={currentUser} onSave={() => getCurrentUser().then(u => { setCurrentUser(u); setView('updated'); })} />}
        {view === 'settings'      && <SettingsView onChangePassword={() => setView('changepassword')} />}
        {view === 'changepassword'&& <ChangePasswordView onSuccess={() => setView('settings')} />}
        {view === 'updated'       && <ProfileUpdatedView user={currentUser} onBackToProfile={() => setView('main')} />}
        {view === 'myads'         && <MyAdsView ads={myAds} loading={adsLoading} renewing={renewing} user={currentUser} onSelectAd={(ad) => { setSelectedAd(ad); setView('addetail'); }} onRenew={(ad) => { setSelectedAd(ad); handleRenew(ad); }} onDelete={(ad) => { setSelectedAd(ad); setView('deleteconfirm'); }} />}
        {view === 'addetail' && selectedAd && <AdDetailView ad={selectedAd} renewing={renewing} onRenew={handleRenew} onDelete={() => setView('deleteconfirm')} />}
        {view === 'renewed'       && <RenewedView onBackToAds={() => { fetchMyAds(); setView('myads'); }} />}
        {view === 'deleteconfirm' && <DeleteAdView deleting={deleting} onCancel={() => setView('addetail')} onConfirmDelete={handleDeleteConfirmed} />}

        {/* ── Bottom Tab Bar ── */}
        <View style={styles.tabBar}>
          <TabItem iconName="globe"    label={t('profile.tabMap')}    onPress={() => navigation.navigate('Map')} />
          <TabItem iconName="message"  label={t('common.messages')}   onPress={() => navigation.navigate('ConversationsList')} />
          <TabItem iconName="user"     label={t('common.profile')}    active />
        </View>
      </SafeAreaView>
    </View>
  );
}

function TabItem({ iconName, label, onPress, active }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tabIconBox, active && styles.tabIconBoxActive]}>
        <FontAwesome6 name={iconName} size={20} color={active ? '#2DBD7E' : '#9CA3AF'} />
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles — thème clair mint ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },

  pageContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120, alignItems: 'center' },

  // Avatar
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2, borderColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },

  profileName:  { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#9CA3AF', marginBottom: 24 },

  // Active Ads Box
  activeAdsBox: {
    width: '100%', borderRadius: 18, padding: 16, marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  activeAdsTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 12, letterSpacing: 0.3 },
  activeAdsRow:   { flexDirection: 'row', gap: 12 },
  activeAdsCard:  {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 2,
    backgroundColor: '#F8FAFB',
  },
  activeAdsCount: { fontSize: 28, fontWeight: '900' },
  activeAdsLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginTop: 2, letterSpacing: 0.5 },

  // View My Ads Button
  viewMyAdsBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 16, marginBottom: 24,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  viewMyAdsBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Menu list
  menuList: { width: '100%', gap: 8 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuRowLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  menuRowLabel:   { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },

  // Field list
  fieldList: { width: '100%', gap: 12, marginBottom: 28 },
  textField: {
    width: '100%', backgroundColor: '#F8FAFB',
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: '#1A1A2E',
  },

  // Change photo button
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#F3F4F6', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 20, paddingVertical: 9, marginBottom: 24,
  },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: '#2DBD7E' },

  // Primary button
  primaryBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Section label
  sectionLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.4 },

  // Settings
  settingsGroup: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowLabel: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  settingsRowValue: { fontSize: 14, color: '#9CA3AF' },
  settingsRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Password change view
  pwdIconWrap: { marginBottom: 12, alignItems: 'center' },
  pwdIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(45,189,126,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  pwdTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  pwdSub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 4 },
  pwdFieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14,
  },
  pwdField: { flex: 1, fontSize: 14, color: '#1A1A2E', paddingVertical: 14 },
  pwdEye:   { padding: 8 },

  // Updated center
  updatedCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#2DBD7E',
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  updatedTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },

  // My Ads list
  adsList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, gap: 16 },
  adsListHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  adsListTitle:  { fontSize: 18, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  adsListCount:  { backgroundColor: '#2DBD7E', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  adsListCountText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:{ fontSize: 16, fontWeight: '700', color: '#4B5563' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  // Ad card
  adCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  adCardCover:            { height: 160, width: '100%' },
  adCardCoverImg:         { width: '100%', height: '100%' },
  adCardCoverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  adModeBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  adModeDot:  { width: 6, height: 6, borderRadius: 3 },
  adModeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  adTimeBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4,
  },
  adTimeBadgeText: { fontSize: 11, fontWeight: '700' },
  adCardBody:    { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 6 },
  adCardDesc:    { fontSize: 14, color: '#1A1A2E', fontWeight: '600', lineHeight: 20 },
  adCardLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  adCardLoc:     { fontSize: 12, color: '#9CA3AF', flex: 1 },
  adCardDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },
  adCardActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  adRenewBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, paddingVertical: 10,
    backgroundColor: 'rgba(59,126,246,0.08)', borderWidth: 1.5, borderColor: '#3B7EF6',
  },
  adRenewBtnText: { fontSize: 13, color: '#3B7EF6', fontWeight: '700' },
  adQrBtn: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(45,189,126,0.08)', borderWidth: 1.5, borderColor: '#2DBD7E',
  },
  adDeleteBtn: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1.5, borderColor: '#EF4444',
  },

  // QR modal
  qrHidden: { position: 'absolute', left: -2000, top: 0 },

  // Carte A4 hors-écran
  qrA4Card: {
    width: 300,
    backgroundColor: '#FFFFFF',
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  qrA4Header: { alignItems: 'center', marginBottom: 4 },
  qrA4Logo:   { width: 64, height: 64, marginBottom: 6 },
  qrA4Brand:  { fontSize: 24, fontWeight: '900', color: '#2DBD7E', letterSpacing: 5 },
  qrA4Sep:    { width: '70%', height: 1.5, backgroundColor: '#2DBD7E', marginVertical: 18 },
  qrA4Name:   { fontSize: 20, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 18 },
  qrA4QrWrap: {
    padding: 14, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  qrA4Welcome: { fontSize: 15, color: '#4B5563', textAlign: 'center', fontStyle: 'italic' },
  qrOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  qrCard: {
    width: 280, backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  qrAdTitle: {
    fontSize: 14, fontWeight: '700', color: '#1A1A2E',
    textAlign: 'center', lineHeight: 20,
  },
  qrCodeWrap: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  qrShareBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38, shadowRadius: 14, elevation: 10,
  },
  qrShareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },
  qrCloseBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  qrCloseBtnText: { color: '#6B7280', fontWeight: '700', fontSize: 14 },
  adCardImage:            { width: 90, height: 90 },
  adCardImagePlaceholder: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },

  // Ad detail
  adDetailContent: { paddingBottom: 120, paddingTop: 0 },
  adDetailImage:   { width: '100%', height: 220, resizeMode: 'cover' },
  adDetailImagePlaceholder: { width: '100%', height: 180, justifyContent: 'center', alignItems: 'center' },
  adDetailLocPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 14,
  },
  adDetailLocText: { fontSize: 13, fontWeight: '700' },
  adDetailTime:    { fontSize: 13, fontWeight: '700', marginHorizontal: 16, marginTop: 8 },
  adDetailDesc:    { fontSize: 14, color: '#4B5563', lineHeight: 20, marginHorizontal: 16, marginTop: 10 },
  statsTitle:      { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statsRow:        { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  statCard: {
    flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statCount: { fontSize: 26, fontWeight: '900', color: '#1A1A2E' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  deleteAdBtn:     { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 2, borderColor: '#EF4444', paddingVertical: 15, alignItems: 'center' },
  deleteAdBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  renewedSub: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  deleteCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 3, borderColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  deleteSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  deleteActionsRow:    { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  cancelBtn:           { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 15, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelBtnText:       { color: '#4B5563', fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn:    { flex: 1, borderRadius: 14, backgroundColor: '#EF4444', paddingVertical: 15, alignItems: 'center' },
  confirmDeleteBtnText:{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // Language modal
  langModal:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  langModalPanel: {
    width: '80%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  langModalTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 14, textAlign: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    backgroundColor: '#F8FAFB', borderWidth: 1, borderColor: '#E5E7EB',
  },
  langOptionActive:  { backgroundColor: '#2DBD7E', borderColor: '#2DBD7E' },
  langOptionText:    { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  langCancelBtn:     { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  langCancelText:    { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },

  // Points solde (vue 900)
  pointsBox: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1.5, borderColor: '#F59E0B',
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  pointsBoxLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsBoxLabel: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  pointsBoxRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsBoxValue: { fontSize: 16, fontWeight: '900', color: '#F59E0B' },
  buyPointsBtn:   { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  buyPointsBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // Buy points view (vue 905)
  pointsIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  buyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  buySub:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  pkgCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1.5, borderColor: '#F59E0B',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  pkgCardSelected: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  pkgLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pkgPts:  { fontSize: 15, fontWeight: '800', color: '#92400E' },
  pkgPrix: { fontSize: 15, fontWeight: '700', color: '#92400E' },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingBottom: 8, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 10,
  },
  tabItem:          { flex: 1, alignItems: 'center', gap: 4 },
  tabIconBox:       { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  tabIconBoxActive: { backgroundColor: 'rgba(45,189,126,0.12)' },
  tabLabel:         { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive:   { color: '#2DBD7E', fontWeight: '700' },
});
