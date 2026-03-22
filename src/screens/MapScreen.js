import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

const DEFAULT_COORDS = { latitude: 36.8065, longitude: 10.1815 };

const MAP_STYLES = [
  {
    name: 'Satellite', emoji: '🛰️', color: '#3D6B4F',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    servers: [''],
  },
  {
    name: 'Standard', emoji: '🗺️', color: '#6C72CB',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    servers: ['a', 'b', 'c'],
  },
  {
    name: 'Cycle', emoji: '🚴', color: '#50B478',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    servers: ['a', 'b', 'c'],
  },
  {
    name: 'Topo', emoji: '⛰️', color: '#8B5E3C',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    servers: ['a'],
  },
];

// ─── Globe 3D HTML ────────────────────────────────────────────────────────────
const buildGlobeHTML = (lat, lng, styleIndex) => {
  const style = MAP_STYLES[styleIndex];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="preconnect" href="https://cdnjs.cloudflare.com"/>
<link rel="preconnect" href="https://server.arcgisonline.com"/>
<link rel="preconnect" href="https://tile.openstreetmap.org"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000005;overflow:hidden}
canvas{display:block}
#loader{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  color:#fff;font-family:-apple-system,sans-serif;font-size:16px;
  display:flex;flex-direction:column;align-items:center;gap:12px}
.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);
  border-top-color:#6C72CB;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="loader"><div class="spinner"></div><span>Chargement...</span></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" crossorigin="anonymous" defer></script>
<script>
window.addEventListener('load', function() {
  document.getElementById('loader').style.display = 'none';
  initGlobe();
});

function initGlobe() {
  var W = window.innerWidth, H = window.innerHeight;
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, W/H, 0.01, 1000);
  camera.position.z = 2.6;
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  document.body.appendChild(renderer.domElement);

  var minZ = 0.85, maxZ = 5.0;

  // Étoiles
  var starPos = new Float32Array(6000 * 3);
  for (var i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 400;
  var sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xffffff, size:0.15, transparent:true, opacity:0.6 })));

  // Texture tuiles
  var ZOOM = 3, TILE_COUNT = 8, TILE_SIZE = 128, TEX_SIZE = 1024;
  var texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = TEX_SIZE;
  var ctx = texCanvas.getContext('2d');
  ctx.fillStyle = '#aad3df';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  var mapTex = new THREE.CanvasTexture(texCanvas);
  mapTex.generateMipmaps = true;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;

  var SERVERS  = ${JSON.stringify(style.servers)};
  var BASE_URL = '${style.url}';

  function getTileUrl(x, y) {
    var s = SERVERS[0] !== '' ? SERVERS[x % SERVERS.length] : '';
    return BASE_URL.replace('{s}',s).replace('{z}',ZOOM).replace('{x}',x).replace('{y}',y);
  }

  function loadTiles() {
    ctx.fillStyle = '#aad3df';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    var tiles = [];
    for (var tx = 0; tx < TILE_COUNT; tx++)
      for (var ty = 0; ty < TILE_COUNT; ty++)
        tiles.push([tx, ty]);
    var BATCH = 8, idx = 0;
    function loadBatch() {
      var batch = tiles.slice(idx, idx + BATCH); idx += BATCH;
      if (!batch.length) return;
      var done = 0;
      batch.forEach(function(t) {
        var img = new Image(); img.crossOrigin = 'anonymous';
        img.src = getTileUrl(t[0], t[1]);
        img.onload = function() {
          ctx.drawImage(img, t[0]*TILE_SIZE, t[1]*TILE_SIZE, TILE_SIZE, TILE_SIZE);
          mapTex.needsUpdate = true;
          if (++done === batch.length) loadBatch();
        };
        img.onerror = function() { if (++done === batch.length) loadBatch(); };
      });
    }
    loadBatch();
  }
  loadTiles();

  // Globe
  var globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 48, 48),
    new THREE.MeshPhongMaterial({ map: mapTex, specular: new THREE.Color(0x111122), shininess: 6 })
  );
  scene.add(globe);

  // Atmosphère
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 32, 32),
    new THREE.MeshBasicMaterial({ color:0x1a44cc, transparent:true, opacity:0.07, side:THREE.BackSide })
  ));

  // Lumières
  scene.add(new THREE.AmbientLight(0x445566, 1.2));
  var sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(5,3,5); scene.add(sun);

  function orientTo(lat, lng) {
    globe.rotation.y = -(lng+180)*Math.PI/180;
    globe.rotation.x = -lat*Math.PI/180*0.6;
  }
  orientTo(${lat}, ${lng});

  // Intro : 3s rotation → zoom vers Tunis → carte 2D
  var introStartTime=null, introDone=false, introZooming=false;
  var TUNIS_LAT=36.8065, TUNIS_LNG=10.1815, INTRO_DURATION=3000;

  // Touch
  var autoRotate=true, rotSpeed=0.0018;
  var dragging=false, lastX=0, lastY=0, lastPinchDist=0;
  var autoTimer=null, switchSent=false;

  renderer.domElement.addEventListener('touchstart', function(e) {
    if (autoTimer) clearTimeout(autoTimer);
    autoRotate=false; switchSent=false; introDone=true;
    if (e.touches.length===1) { dragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; }
    else if (e.touches.length===2) { dragging=false; lastPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); }
  }, { passive:true });

  renderer.domElement.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (e.touches.length===1 && dragging) {
      var dx=e.touches[0].clientX-lastX, dy=e.touches[0].clientY-lastY;
      globe.rotation.y+=dx*0.006; globe.rotation.x+=dy*0.006;
      globe.rotation.x=Math.max(-1.2,Math.min(1.2,globe.rotation.x));
      lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    } else if (e.touches.length===2) {
      var dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      camera.position.z=Math.max(minZ,Math.min(maxZ,camera.position.z+(lastPinchDist-dist)*0.008));
      lastPinchDist=dist;
      if (camera.position.z<=minZ+0.02 && !switchSent) {
        switchSent=true;
        var cLng=-(globe.rotation.y*180/Math.PI)-180;
        var cLat=-(globe.rotation.x/0.6)*180/Math.PI;
        window.ReactNativeWebView.postMessage('SWITCH_TO_MAP:'+cLat.toFixed(5)+':'+cLng.toFixed(5));
      }
    }
  }, { passive:false });

  renderer.domElement.addEventListener('touchend', function() {
    dragging=false;
    autoTimer=setTimeout(function(){ autoRotate=true; }, 4000);
  }, { passive:true });

  window.centerGlobe = function(lat, lng) { orientTo(lat, lng); };
  window.reloadStyle = function(baseUrl, servers) { BASE_URL=baseUrl; SERVERS=servers; loadTiles(); };
  window.orientTo    = function(lat, lng) { orientTo(lat, lng); };

  // Animation
  var lastFrame = 0;
  function animate(ts) {
    requestAnimationFrame(animate);
    if (ts - lastFrame < 16) return;
    lastFrame = ts;
    if (!introDone) {
      if (!introStartTime) introStartTime = ts;
      var elapsed = ts - introStartTime;
      if (elapsed < INTRO_DURATION) {
        globe.rotation.y += 0.008;
      } else if (!introZooming) {
        introZooming=true; autoRotate=false; orientTo(TUNIS_LAT, TUNIS_LNG);
      } else {
        camera.position.z -= 0.025;
        if (camera.position.z <= 0.85) {
          camera.position.z=0.85; introDone=true;
          window.ReactNativeWebView.postMessage('SWITCH_TO_MAP:'+TUNIS_LAT.toFixed(5)+':'+TUNIS_LNG.toFixed(5));
        }
      }
    } else {
      if (autoRotate && !dragging) globe.rotation.y += rotSpeed;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  window.addEventListener('resize', function() {
    W=window.innerWidth; H=window.innerHeight;
    camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H);
  });

  window.ReactNativeWebView.postMessage('READY');
}
</script>
</body>
</html>`;
};

// ─── Carte 2D Leaflet ─────────────────────────────────────────────────────────
const buildMapHTML = (lat, lng, styleIndex) => {
  const style = MAP_STYLES[styleIndex];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="preconnect" href="https://server.arcgisonline.com"/>
<link rel="preconnect" href="https://a.tile.openstreetmap.org"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
.user-marker{
  width:20px;height:20px;background:#6C72CB;
  border:3px solid white;border-radius:50%;
  animation:pulse 2s infinite
}
@keyframes pulse{
  0%  {box-shadow:0 0 0 0 rgba(108,114,203,0.6)}
  70% {box-shadow:0 0 0 14px rgba(108,114,203,0)}
  100%{box-shadow:0 0 0 0 rgba(108,114,203,0)}
}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', {
  center:[${lat},${lng}], zoom:13,
  zoomControl:false, attributionControl:false, preferCanvas:true,
});
L.tileLayer('${style.url}', {
  subdomains:${JSON.stringify(style.servers)},
  maxZoom:19, minZoom:1, keepBuffer:6, updateWhenIdle:false, crossOrigin:true,
}).addTo(map);
var userIcon = L.divIcon({ html:'<div class="user-marker"></div>', className:'', iconSize:[20,20], iconAnchor:[10,10] });
var marker   = L.marker([${lat},${lng}], { icon:userIcon }).addTo(map);
window.updateLocation = function(lat,lng) { marker.setLatLng([lat,lng]); };
window.centerOnUser   = function(lat,lng) { map.setView([lat,lng], map.getZoom(), { animate:true, duration:0.5 }); };
map.on('zoomend', function() {
  if (map.getZoom() <= 2) window.ReactNativeWebView.postMessage('SWITCH_TO_GLOBE');
});
window.ReactNativeWebView.postMessage('READY');
</script>
</body>
</html>`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MapScreen() {
  const navigation = useNavigation();
  const [userCoords, setUserCoords] = useState(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const [mode, setMode] = useState('globe');
  const [mapCenter, setMapCenter] = useState(null);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [modeView,  setModeView]  = useState('local'); // 'local' | 'duo'

  const webViewRef = useRef(null);
  const locationSubscription = useRef(null);
  const isFollowing = useRef(true);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startLocationTracking();
    return () => { if (locationSubscription.current) locationSubscription.current.remove(); };
  }, []);

  useEffect(() => {
    if (!ready || !userCoords || !webViewRef.current) return;
    if (mode === 'globe') {
      webViewRef.current.injectJavaScript(`centerGlobe(${userCoords.latitude},${userCoords.longitude}); true;`);
    } else {
      webViewRef.current.injectJavaScript(`updateLocation(${userCoords.latitude},${userCoords.longitude}); true;`);
      if (isFollowing.current) {
        webViewRef.current.injectJavaScript(`centerOnUser(${userCoords.latitude},${userCoords.longitude}); true;`);
      }
    }
  }, [userCoords, ready]);

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErrorMsg('Permission GPS refusée'); setUserCoords(DEFAULT_COORDS); return; }
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000)),
        ]);
        setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch { setUserCoords(DEFAULT_COORDS); }
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (loc) => { setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }); setErrorMsg(null); }
      );
    } catch { setUserCoords(DEFAULT_COORDS); }
  };

  // Recherche Nominatim
  const searchPlace = async (query) => {
    setSearchQuery(query);
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=fr`,
        { headers: { 'User-Agent': 'ByMap/1.0' } }
      );
      const data = await res.json();
      setSuggestions(data);
    } catch { setSuggestions([]); }
  };

  const goToPlace = (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setSearchQuery(place.display_name.split(',')[0]);
    setSuggestions([]);
    Keyboard.dismiss();
    setMapCenter({ latitude: lat, longitude: lng });
    setReady(false);
    setMode('map');
  };

  const toggleMenu = () => {
    const toValue = menuOpen ? 0 : 1;
    setMenuOpen(!menuOpen);
    Animated.spring(menuAnim, { toValue, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const onMessage = (e) => {
    const msg = e.nativeEvent.data;
    if (msg === 'READY') { setReady(true); return; }
    if (msg.startsWith('SWITCH_TO_MAP:')) {
      const parts = msg.split(':');
      setMapCenter({ latitude: parseFloat(parts[1]), longitude: parseFloat(parts[2]) });
      setReady(false);
      setMode('map');
      return;
    }
    if (msg === 'SWITCH_TO_GLOBE') { setReady(false); setMode('globe'); }
  };

  const selectStyle = (index) => {
    if (index === styleIndex) return;
    setStyleIndex(index);
    if (mode === 'globe' && webViewRef.current) {
      const s = MAP_STYLES[index];
      webViewRef.current.injectJavaScript(`reloadStyle('${s.url}',${JSON.stringify(s.servers)}); true;`);
    } else {
      setReady(false);
    }
  };

  const centerOnUser = () => {
    isFollowing.current = true;
    if (!ready || !userCoords || !webViewRef.current) return;
    const fn = mode === 'globe'
      ? `centerGlobe(${userCoords.latitude},${userCoords.longitude})`
      : `centerOnUser(${userCoords.latitude},${userCoords.longitude})`;
    webViewRef.current.injectJavaScript(`${fn}; true;`);
  };

  const coords = userCoords || DEFAULT_COORDS;
  const center = mapCenter || coords;
  const html = mode === 'globe'
    ? buildGlobeHTML(coords.latitude, coords.longitude, styleIndex)
    : buildMapHTML(center.latitude, center.longitude, styleIndex);

  return (
    <View style={styles.container}>

      {/* ── Carte / Globe ── */}
      <WebView
        key={mode + '-' + styleIndex}
        ref={webViewRef}
        style={styles.map}
        source={{ html }}
        onMessage={onMessage}
        onTouchStart={() => { isFollowing.current = false; }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        setSupportMultipleWindows={false}
      />

      {/* Overlay chargement */}
      {!ready && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>
            {mode === 'globe' ? '🌍 Chargement...' : '🗺️ Chargement...'}
          </Text>
        </View>
      )}

      {/* ── Header : Logo + Recherche + Menu ── */}
      <SafeAreaView style={styles.headerOverlay}>
        {/* Barre principale */}
        <View style={styles.headerBar}>

          {/* Logo 
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>ByMap</Text>
          </View>*/}

          {/* Champ de recherche */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un lieu..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={searchQuery}
              onChangeText={searchPlace}
              returnKeyType="search"
              onSubmitEditing={() => suggestions.length > 0 && goToPlace(suggestions[0])}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); }}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bouton menu hamburger */}
          <TouchableOpacity style={styles.menuBtn} onPress={toggleMenu} activeOpacity={0.8}>
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>

        {/* Suggestions de recherche */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
                onPress={() => goToPlace(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionIcon}>📍</Text>
                <View style={styles.suggestionTexts}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.display_name.split(',').slice(1, 3).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu déroulant */}
        {menuOpen && (
          <Animated.View style={[
            styles.menuDropdown,
            {
              opacity: menuAnim,
              transform: [{
                translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              }],
            },
          ]}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setMenuOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.menuRowIcon}>🌐</Text>
              <Text style={styles.menuRowText}>Langue</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { setMenuOpen(false); navigation.navigate('Login'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.menuRowIcon}>🔐</Text>
              <Text style={styles.menuRowText}>Connexion / Inscription</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />
            {/*
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => { centerOnUser(); setMenuOpen(false); }}
            >
              <Text style={styles.menuRowIcon}>📍</Text>
              <Text style={styles.menuRowText}>Ma position</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                setMode(mode === 'globe' ? 'map' : 'globe');
                setReady(false);
                setMenuOpen(false);
              }}
            >
              <Text style={styles.menuRowIcon}>{mode === 'globe' ? '🗺️' : '🌍'}</Text>
              <Text style={styles.menuRowText}>{mode === 'globe' ? 'Vue carte' : 'Vue globe'}</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />*/}
            <TouchableOpacity style={styles.menuRow} onPress={() => setMenuOpen(false)}>
              <Text style={styles.menuRowIcon}>ℹ️</Text>
              <Text style={styles.menuRowText}>À propos de ByMap</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* Erreur GPS */}
      {errorMsg && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        </View>
      )}

      {/* ── Footer : Titre + Boutons LOCAL / DUO ── */}
      <View style={styles.footer}>
        {/* Titre centré dynamique selon la position */}
        <Text style={styles.footerTitle}>
          Tunis — Ariana
        </Text>

        {/* Boutons */}
        <View style={styles.footerBtns}>
          {/* LOCAL — noir plein quand actif */}
          <TouchableOpacity
            style={[styles.footerBtn, modeView === 'local' && styles.footerBtnActive]}
            onPress={() => { setModeView('local'); navigation.navigate('Local'); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.footerBtnText, modeView === 'local' && styles.footerBtnTextActive]}>
              LOCAL
            </Text>
          </TouchableOpacity>

          {/* DUO — contour quand inactif */}
          <TouchableOpacity
            style={[styles.footerBtn, modeView === 'duo' && styles.footerBtnActive]}
            onPress={() => { setModeView('duo'); navigation.navigate('Duo'); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.footerBtnText, modeView === 'duo' && styles.footerBtnTextActive]}>
              DUO
            </Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000005',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { fontSize: 18, color: '#ffffff', fontWeight: '600' },

  // ── Header ────────────────────────────────────────────────────────────────
  headerOverlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 12,
    gap: 8,
  },
  logoBox: {
    backgroundColor: 'rgba(108,114,203,0.92)',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,20,0.72)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchIcon: { fontSize: 13 },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    padding: 0,
    margin: 0,
  },
  clearBtn: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    paddingHorizontal: 2,
  },
  menuBtn: {
    width: 42,
    height: 42,
    backgroundColor: 'rgba(10,10,20,0.72)',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },

  // ── Suggestions ─────────────────────────────────────────────────────────
  suggestionsBox: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: 'rgba(10,10,22,0.97)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  suggestionIcon: { fontSize: 15 },
  suggestionTexts: { flex: 1 },
  suggestionTitle: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  suggestionSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },

  // ── Menu déroulant ───────────────────────────────────────────────────────
  menuDropdown: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: 'rgba(10,10,22,0.97)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuRowIcon: { fontSize: 18 },
  menuRowText: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  menuSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 14,
  },

  // ── Erreur ───────────────────────────────────────────────────────────────
  errorBadge: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(200,60,60,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  errorText: { color: 'white', fontSize: 12, fontWeight: '600' },

  // ── Balles de style ──────────────────────────────────────────────────────
  ballsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 14,
  },
  ballWrapper: { alignItems: 'center', gap: 5 },
  ball: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  ballActive: {
    width: 66, height: 66, borderRadius: 33,
    borderWidth: 3, borderColor: 'white',
    elevation: 12, shadowOpacity: 0.5, shadowRadius: 10,
  },
  ballEmoji: { fontSize: 24 },
  ballLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  ballLabelActive: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  ballDot: { width: 6, height: 6, borderRadius: 3 },

  // ── FAB centrer ──────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: 160, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(108,114,203,0.95)',
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabText: { fontSize: 22 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#ffffff',
  },
  footerBtnActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 1.5,
    textDecorationLine: 'none',
  },
  footerBtnTextActive: {
    color: '#ffffff',
  },

  // ── Attribution ──────────────────────────────────────────────────────────
  attribution: {
    position: 'absolute', bottom: 8, left: 12, pointerEvents: 'none',
  },
  attributionText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
});