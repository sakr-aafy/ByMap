import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  SafeAreaView,
  PanResponder,
} from 'react-native';

const LOGO = require('../../assets/logo.png');
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { cachedGeocode, cachedZone, cachedSearch } from '../utils/cache';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { API_URL } from '../environments/environment';
// Location removed — Tunis used as default

const DEFAULT_COORDS = { latitude: 36.8065, longitude: 10.1815 };

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_SERVERS = [''];

// ─── Styles de carte disponibles ─────────────────────────────────────────────
const MAP_STYLES = [
  {
    key: 'street',
    label: 'Street',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
  },
  {
    key: 'satellite',
    label: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: [''],
    maxZoom: 19,
  },
  {
    key: 'relief',
    label: 'Relief',
    icon: '⛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    subdomains: [''],
    maxZoom: 13,
  },
  {
    key: 'topo',
    label: 'Topo',
    icon: '🏔️',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
  },
  {
    key: 'dark',
    label: 'Dark',
    icon: '🌑',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
  {
    key: 'clair',
    label: 'Clair',
    icon: '🌤️',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
];

// ─── Données Tunisie (gouvernorats depuis tunisia.json) ───────────────────────
import TUNISIA_DATA from '../../assets/tunisia.json';
const TUNISIA_GOVERNORATES = Object.keys(TUNISIA_DATA).sort();

// ─── Coordonnées des centres de gouvernorats ──────────────────────────────────
const GOVERNORATE_COORDS = {
  'Tunis':        { lat: 36.8065, lng: 10.1815 },
  'Ariana':       { lat: 36.8665, lng: 10.1647 },
  'Ben Arous':    { lat: 36.7474, lng: 10.2326 },
  'Manouba':      { lat: 36.8094, lng:  9.9799 },
  'Nabeul':       { lat: 36.4511, lng: 10.7357 },
  'Zaghouan':     { lat: 36.4029, lng: 10.1427 },
  'Bizerte':      { lat: 37.2744, lng:  9.8739 },
  'Béja':         { lat: 36.7254, lng:  9.1819 },
  'Jendouba':     { lat: 36.5011, lng:  8.7757 },
  'Kef':          { lat: 36.1826, lng:  8.7149 },
  'Siliana':      { lat: 36.0850, lng:  9.3708 },
  'Sousse':       { lat: 35.8283, lng: 10.6346 },
  'Monastir':     { lat: 35.7643, lng: 10.8113 },
  'Mahdia':       { lat: 35.5047, lng: 11.0622 },
  'Sfax':         { lat: 34.7399, lng: 10.7600 },
  'Kairouan':     { lat: 35.6781, lng: 10.0963 },
  'Kasserine':    { lat: 35.1676, lng:  8.8365 },
  'Sidi Bouzid':  { lat: 35.0382, lng:  9.4849 },
  'Gabès':        { lat: 33.8814, lng: 10.0982 },
  'Médenine':     { lat: 33.3550, lng: 10.5054 },
  'Tataouine':    { lat: 32.9211, lng: 10.4516 },
  'Gafsa':        { lat: 34.4250, lng:  8.7842 },
  'Tozeur':       { lat: 33.9197, lng:  8.1335 },
  'Kébili':       { lat: 33.7046, lng:  8.9690 },
};

const ZONE_RADII = [
  { label: '500 m',  value: 500   },
  { label: '1 km',   value: 1000  },
  { label: '2 km',   value: 2000  },
  { label: '5 km',   value: 5000  },
  { label: '10 km',  value: 10000 },
];

// ─── Globe 3D HTML ────────────────────────────────────────────────────────────
const buildGlobeHTML = (lat, lng) => {
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

  var SERVERS  = ${JSON.stringify(SATELLITE_SERVERS)};
  var BASE_URL = '${SATELLITE_URL}';

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

  // Touch
  var autoRotate=true, rotSpeed=0.0018;
  var dragging=false, lastX=0, lastY=0, lastPinchDist=0;
  var autoTimer=null, switchSent=false;

  renderer.domElement.addEventListener('touchstart', function(e) {
    if (autoTimer) clearTimeout(autoTimer);
    autoRotate=false; switchSent=false;
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
    if (autoRotate && !dragging) globe.rotation.y += rotSpeed;
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
const buildMapHTML = (lat, lng, pickMode = false, zoneRadius = 1000, styleKey = 'relief') => {
  const style = MAP_STYLES.find(s => s.key === styleKey) || MAP_STYLES[2];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="preconnect" href="https://server.arcgisonline.com"/>
<link rel="preconnect" href="https://a.tile.openstreetmap.org"/>
<link rel="preconnect" href="https://basemaps.cartocdn.com"/>
<link rel="preconnect" href="https://tile.opentopomap.org"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', {
  center:[${lat},${lng}], zoom:6,
  zoomControl:false, attributionControl:false, preferCanvas:true,
});
L.tileLayer('${style.url}', {
  subdomains:${JSON.stringify(style.subdomains)},
  maxZoom:${style.maxZoom}, minZoom:1, keepBuffer:6, updateWhenIdle:false, crossOrigin:true,
}).addTo(map);
window.centerOnUser = function(lat,lng) { map.setView([lat,lng], map.getZoom(), { animate:true, duration:0.5 }); };

// ── Zone Circle (pickMode) ───────────────────────────────────────────────────
var zoneCircle = null;
var isPickMode = ${pickMode ? 'true' : 'false'};
if (isPickMode) {
  zoneCircle = L.circle([${lat},${lng}], {
    radius: ${zoneRadius},
    color: '#1E90FF',
    fillColor: '#1E90FF',
    fillOpacity: 0.12,
    weight: 2.5,
    dashArray: '6,4',
  }).addTo(map);
}

window.updateZoneCircle = function(lat, lng, radius) {
  if (zoneCircle) {
    zoneCircle.setLatLng([lat, lng]);
    zoneCircle.setRadius(radius);
  }
};

map.on('moveend', function() {
  var c = map.getCenter();
  window.ReactNativeWebView.postMessage('MAP_CENTER:'+c.lat.toFixed(6)+':'+c.lng.toFixed(6));
  if (isPickMode && zoneCircle) {
    zoneCircle.setLatLng([c.lat, c.lng]);
  }
});
map.on('zoomend', function() {
  if (map.getZoom() <= 2) window.ReactNativeWebView.postMessage('SWITCH_TO_GLOBE');
});

// ── Points verts par zone ────────────────────────────────────────────────────
var zoneDotLayer = L.layerGroup().addTo(map);
window.addZoneDots = function(dots) {
  zoneDotLayer.clearLayers();
  dots.forEach(function(d) {
    var pulse = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#34C759;border:2px solid #fff;box-shadow:0 0 0 3px rgba(52,199,89,0.35);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    var m = L.marker([d.lat, d.lng], { icon: pulse });
    m.bindTooltip(
      '<b>' + d.name + '</b><br/>' +
      '<span style="color:#34C759">● ' + d.local + ' local</span>  ' +
      '<span style="color:#1E90FF">● ' + d.duo + ' duo</span>',
      { direction: 'top', offset: [0, -8] }
    );
    zoneDotLayer.addLayer(m);
  });
};

window.ReactNativeWebView.postMessage('READY');
</script>
</body>
</html>`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MapScreen() {
  const navigation = useNavigation();
  const route      = useRoute ? useRoute() : { params: {} };
  const pickMode   = route?.params?.pickMode === true; // mode sélection zone

  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);
  const [mode, setMode] = useState('map');
  const [mapCenter, setMapCenter] = useState(null);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [modeView,  setModeView]  = useState('local'); // 'local' | 'duo'
  const [mapStyle,  setMapStyle]  = useState('relief');
  const [pickedCenter, setPickedCenter] = useState(null);

  // ── Zone Circle (pickMode) ────────────────────────────────────────────────
  const [zoneRadius,       setZoneRadius]       = useState(1000);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [selectedGov,      setSelectedGov]      = useState('');
  const [selectedDeleg,    setSelectedDeleg]    = useState('');
  const [selectedLocale,   setSelectedLocale]   = useState('');
  const [showGovPicker,    setShowGovPicker]    = useState(false);
  const [showDelegPicker,  setShowDelegPicker]  = useState(false);
  const [showLocalePicker, setShowLocalePicker] = useState(false);
  const [detectedZone, setDetectedZone] = useState(''); // gouvernorat détecté par position
  const [zoneCounts,   setZoneCounts]   = useState({ local: 0, duo: 0 });

  const delegations = selectedGov ? [...new Set((TUNISIA_DATA[selectedGov] || []).map(e => e.delegation))].sort() : [];
  const locales = selectedGov && selectedDeleg ? (TUNISIA_DATA[selectedGov] || []).filter(e => e.delegation === selectedDeleg).map(e => e.localite).sort() : [];

  // Détecte le gouvernorat via Nominatim reverse geocode (avec cache)
  const detectZoneFromCoords = async (lat, lng) => {
    try {
      const zone = await cachedZone(lat, lng, async (la, lo) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=fr&zoom=8`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        const data = await res.json();

        // En Tunisie, Nominatim renvoie "Gouvernorat de Sidi Bouzid" dans state
        let raw =
          data.address?.county  ||
          data.address?.state   ||
          data.address?.region  ||
          data.address?.city    ||
          '';

        // Nettoie les préfixes arabes/français courants
        raw = raw
          .replace(/^gouvernorat\s+de\s+/i, '')
          .replace(/^wilaya\s+de\s+/i, '')
          .trim();

        // Cherche la correspondance exacte ou partielle dans les clés tunisia.json
        const match = TUNISIA_GOVERNORATES.find(g =>
          g.toLowerCase() === raw.toLowerCase()
        ) || TUNISIA_GOVERNORATES.find(g =>
          raw.toLowerCase().includes(g.toLowerCase()) ||
          g.toLowerCase().includes(raw.toLowerCase())
        );

        return match || raw || '—';
      });

      setDetectedZone(zone);
      if (zone && zone !== '—') fetchZoneCounts(zone);
    } catch {
      setDetectedZone('—');
    }
  };

  const fetchZoneCounts = async (zone) => {
    try {
      const [rLocal, rDuo] = await Promise.all([
        fetch(`${API_URL}/publications?ville=${encodeURIComponent(zone)}&mode=local&limit=200`),
        fetch(`${API_URL}/publications?ville=${encodeURIComponent(zone)}&mode=duo&limit=200`),
      ]);
      const [dLocal, dDuo] = await Promise.all([rLocal.json(), rDuo.json()]);
      setZoneCounts({
        local: dLocal.publications?.length ?? 0,
        duo:   dDuo.publications?.length ?? 0,
      });
    } catch {
      setZoneCounts({ local: 0, duo: 0 });
    }
  };

  const fetchAndInjectZoneDots = async () => {
    try {
      const res  = await fetch(`${API_URL}/publications?limit=500`);
      const data = await res.json();
      const pubs = data.publications || [];

      // Grouper par gouvernorat
      const counts = {};
      pubs.forEach(p => {
        const gov =
          p.localisation?.gouvernorat ||
          p.localisationDebut?.gouvernorat ||
          p.localisation?.ville ||
          p.localisationDebut?.ville;
        if (!gov) return;
        if (!counts[gov]) counts[gov] = { local: 0, duo: 0 };
        if (p.mode === 'local') counts[gov].local++;
        else                    counts[gov].duo++;
      });

      // Construire le tableau de points avec coordonnées
      const dots = Object.entries(counts)
        .map(([name, c]) => {
          // Chercher dans GOVERNORATE_COORDS (correspondance exacte ou partielle)
          let coords = GOVERNORATE_COORDS[name];
          if (!coords) {
            const key = Object.keys(GOVERNORATE_COORDS).find(
              k => k.toLowerCase().includes(name.toLowerCase()) ||
                   name.toLowerCase().includes(k.toLowerCase())
            );
            coords = key ? GOVERNORATE_COORDS[key] : null;
          }
          if (!coords) return null;
          return { name, lat: coords.lat, lng: coords.lng, local: c.local, duo: c.duo };
        })
        .filter(Boolean);

      if (webViewRef.current && dots.length > 0) {
        webViewRef.current.injectJavaScript(`addZoneDots(${JSON.stringify(dots)}); true;`);
      }
    } catch (e) {
      console.error('[ZONE DOTS]', e);
    }
  };

  const webViewRef = useRef(null);
  const locationSubscription = useRef(null);
  const isFollowing = useRef(true);
  const menuAnim = useRef(new Animated.Value(0)).current;

  // ── Radio Garden Joystick ─────────────────────────────────────────────────
  const RG_RADIUS    = 70; // rayon du grand cercle (moitié du diamètre 140)
  const joystickPan  = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [cityName,   setCityName]   = useState('Tunis — Ariana');
  const geocodeTimer = useRef(null);
  const detectTimer  = useRef(null);
  const moveInterval = useRef(null);
  const currentCenter = useRef(null);
  const joystickDelta = useRef({ dx: 0, dy: 0, active: false });

  const reverseGeocode = async (lat, lng) => {
    try {
      const city = await cachedGeocode(lat, lng, async (la, lo) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=fr`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        const data = await res.json();
        return (
          data.address?.city    ||
          data.address?.town    ||
          data.address?.village ||
          data.address?.county  ||
          data.display_name?.split(',')[0] || null
        );
      });
      if (city) setCityName(city);
    } catch {}
  };

  // Mouvement continu pendant que le pouce est tenu
  const startContinuousMove = () => {
    if (moveInterval.current) return;
    moveInterval.current = setInterval(() => {
      if (!joystickDelta.current.active || !webViewRef.current) return;
      const { dx, dy } = joystickDelta.current;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) return;
      const norm  = dist / RG_RADIUS; // 0..1
      const speed = 0.00015 * norm * norm; // accélération quadratique
      const angle = Math.atan2(dy, dx);
      const dlat  = -Math.sin(angle) * speed;
      const dlng  =  Math.cos(angle) * speed;
      webViewRef.current.injectJavaScript(
        `map.panTo([map.getCenter().lat+${dlat},map.getCenter().lng+${dlng}],{animate:false});true;`
      );
    }, 16); // ~60fps
  };

  const stopContinuousMove = () => {
    if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
    joystickDelta.current.active = false;
  };

  const joystickResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        joystickPan.setOffset({ x: joystickPan.x._value, y: joystickPan.y._value });
        joystickPan.setValue({ x: 0, y: 0 });
        joystickDelta.current.active = true;
        startContinuousMove();
      },
      onPanResponderMove: (_, gs) => {
        // Clamp pouce dans le cercle
        const dist  = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);
        const clamp = Math.min(dist, RG_RADIUS);
        const angle = Math.atan2(gs.dy, gs.dx);
        const cx = clamp * Math.cos(angle);
        const cy = clamp * Math.sin(angle);
        joystickPan.setValue({ x: cx, y: cy });
        joystickDelta.current = { dx: cx, dy: cy, active: true };

        // Geocodage différé
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(() => {
          if (currentCenter.current)
            reverseGeocode(currentCenter.current.latitude, currentCenter.current.longitude);
        }, 600);
      },
      onPanResponderRelease: () => {
        joystickPan.flattenOffset();
        Animated.spring(joystickPan, {
          toValue: { x: 0, y: 0 },
          tension: 120, friction: 7,
          useNativeDriver: false,
        }).start();
        stopContinuousMove();
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      },
    })
  ).current;


  // Recharge le user connecté à chaque fois qu'on revient sur la Map
  useFocusEffect(
    React.useCallback(() => {
      getCurrentUser().then(setCurrentUser);
    }, [])
  );

  // Géolocalisation désactivée — Tunis affiché par défaut

  useEffect(() => {
    if (!ready || !userCoords || !webViewRef.current) return;
    if (mode === 'globe') {
      webViewRef.current.injectJavaScript(`centerGlobe(${userCoords.latitude},${userCoords.longitude}); true;`);
    } else {
      if (isFollowing.current) {
        webViewRef.current.injectJavaScript(`centerOnUser(${userCoords.latitude},${userCoords.longitude}); true;`);
      }
    }
  }, [userCoords, ready]);

  // startLocationTracking supprimé

  // Injecter les points verts quand la carte est prête
  useEffect(() => {
    if (ready && mode === 'map' && !pickMode) fetchAndInjectZoneDots();
  }, [ready, mode]);

  // Mise à jour du cercle de zone quand le rayon change
  useEffect(() => {
    if (!ready || !webViewRef.current || mode !== 'map' || !pickMode) return;
    const c = pickedCenter || mapCenter || coords;
    webViewRef.current.injectJavaScript(
      `updateZoneCircle(${c.latitude},${c.longitude},${zoneRadius}); true;`
    );
  }, [zoneRadius, ready]);

  // Recherche Nominatim (avec cache)
  const searchPlace = async (query) => {
    setSearchQuery(query);
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const data = await cachedSearch(query, async (q) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=fr`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        return res.json();
      });
      setSuggestions(data || []);
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
    if (msg === 'READY') {
      setReady(true);
      // Déclenche la détection de zone dès l'ouverture de la carte
      if (pickMode) {
        const c = pickedCenter || mapCenter || DEFAULT_COORDS;
        detectZoneFromCoords(c.latitude, c.longitude);
      }
      return;
    }
    if (msg.startsWith('SWITCH_TO_MAP:')) {
      const parts = msg.split(':');
      setMapCenter({ latitude: parseFloat(parts[1]), longitude: parseFloat(parts[2]) });
      setReady(false);
      setMode('map');
      return;
    }
    if (msg === 'SWITCH_TO_GLOBE') { setReady(false); setMode('globe'); return; }
    if (msg.startsWith('MAP_CENTER:')) {
      const parts = msg.split(':');
      const c = { latitude: parseFloat(parts[1]), longitude: parseFloat(parts[2]) };
      setPickedCenter(c);
      currentCenter.current = c;
      if (detectTimer.current) clearTimeout(detectTimer.current);
      detectTimer.current = setTimeout(() => detectZoneFromCoords(c.latitude, c.longitude), 700);
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
    ? buildGlobeHTML(coords.latitude, coords.longitude)
    : buildMapHTML(center.latitude, center.longitude, pickMode, zoneRadius, mapStyle);

  return (
    <View style={styles.container}>

      {/* ── Carte / Globe ── */}
      <WebView
        key={mode + '-' + mapStyle}
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

        {/* ── Bandeau nom de zone ── */}
        {!menuOpen && suggestions.length === 0 && mode === 'map' && (
          <View style={styles.zoneBanner}>
            <Text style={styles.zoneBannerName} numberOfLines={1}>
              📍  {detectedZone || cityName || '…'}
            </Text>
          </View>
        )}

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

            {/* ── Profil utilisateur connecté ── */}
            {currentUser ? (
              <>
                <View style={styles.menuUserRow}>
                  <Text style={styles.menuUserAvatar}>👤</Text>
                  <View>
                    <Text style={styles.menuUserName}>
                      {currentUser.prenom || ''} {currentUser.nom || ''}
                    </Text>
                    <Text style={styles.menuUserEmail} numberOfLines={1}>
                      {currentUser.email || currentUser.phone || ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.menuSep} />
              </>
            ) : null}

            {/* ── Sélecteur de style de carte ── */}
            <View style={styles.menuStyleSection}>
              <Text style={styles.menuStyleTitle}>🗾 Style de carte</Text>
              <View style={styles.menuStyleGrid}>
                {MAP_STYLES.map(s => {
                  const active = mapStyle === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.menuStyleBtn, active && styles.menuStyleBtnActive]}
                      onPress={() => { setMapStyle(s.key); setReady(false); }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.menuStyleIcon}>{s.icon}</Text>
                      <Text style={[styles.menuStyleLabel, active && styles.menuStyleLabelActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.menuSep} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setMenuOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.menuRowIcon}>🌐</Text>
              <Text style={styles.menuRowText}>Langue</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />

            {currentUser ? (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={async () => {
                  setMenuOpen(false);
                  await apiLogout();
                  setCurrentUser(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.menuRowIcon}>🚪</Text>
                <Text style={[styles.menuRowText, { color: '#FF3B30' }]}>Déconnexion</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuOpen(false); navigation.navigate('Login'); }}
                activeOpacity={0.8}
              >
                <Text style={styles.menuRowIcon}>🔐</Text>
                <Text style={styles.menuRowText}>Connexion / Inscription</Text>
              </TouchableOpacity>
            )}

            <View style={styles.menuSep} />

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

      {/* ── Crosshair centré (mode carte normal) ── */}
      {!pickMode && mode === 'map' && (
        <View pointerEvents="box-none" style={styles.centerCircleWrap}>
          <TouchableOpacity
            style={styles.centerZoneClickable}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('Local', { zone: detectedZone || cityName })}
          >
            {/* Cercle */}
            <View style={styles.centerCircle} />
            {/* Point central */}
            <View style={styles.centerDot} />
            {/* Label zone 
            <View style={styles.centerZoneLabelWrap}>
              <Text style={styles.centerZoneLabelText} numberOfLines={1}>
                {detectedZone || cityName || '…'}
              </Text>
              {(zoneCounts.local > 0 || zoneCounts.duo > 0) && (
                <Text style={styles.centerZoneCountsText}>
                  <Text style={{ color: '#34C759' }}>{zoneCounts.local} local</Text>
                  {'  ·  '}
                  <Text style={{ color: '#5DB8FF' }}>{zoneCounts.duo} duo</Text>
                </Text>
              )}
            </View>*/}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Mode sélection zone (depuis Admin) ── */}
      {pickMode && mode === 'map' && (
        <>
          {/* ── Cercle blanc centré sur la carte ── */}
          <View pointerEvents="none" style={pickStyles.circleWrap}>
            <View style={pickStyles.circleOuter} />
            {/* Nom de la zone affiché juste sous le cercle */}
            <View style={pickStyles.zoneLabelWrap}>
              <Text style={pickStyles.zoneLabelText} numberOfLines={1}>
                {detectedZone || '…'}
              </Text>
            </View>
          </View>

          {/* Bandeau haut */}
          <View style={pickStyles.topBanner}>
            <TouchableOpacity style={pickStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={pickStyles.backText}>← Retour</Text>
            </TouchableOpacity>
            <Text style={pickStyles.hint}>Centrez le cercle sur la zone à indexer</Text>
          </View>


        </>
      )}

      {/* ── Bottom Tab Bar ── */}
      {!pickMode && (
        <View style={styles.tabBar}>

          {/* ── Tabs ── */}
          <View style={styles.tabRow}>

            {/* Globe */}
            <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
              <View style={styles.tabIconBoxActive}>
                <Text style={styles.tabIcon}>🌍</Text>
              </View>
              <Text style={styles.tabLabelActive}>Globe</Text>
            </TouchableOpacity>

            {/* Logo centré + badge */}
            <TouchableOpacity
              style={styles.tabLogoWrap}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Local', { zone: detectedZone || cityName })}
            >
              <Image source={LOGO} style={styles.tabLogoImg} resizeMode="contain" />
              {(zoneCounts.local + zoneCounts.duo) > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {zoneCounts.local + zoneCounts.duo}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Profil */}
            <TouchableOpacity
              style={styles.tabItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.tabIconBox}>
                <Text style={styles.tabIcon}>👤</Text>
              </View>
              <Text style={styles.tabLabel}>Profil</Text>
            </TouchableOpacity>

          </View>
        </View>
      )}
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

  // ── Bandeau zone sous la recherche ──────────────────────────────────────
  zoneBanner: {
    alignSelf: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(10,10,22,0.75)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  zoneBannerName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '1000',
    letterSpacing: 0.5,
    textAlign: 'center',
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
  menuUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuUserAvatar: { fontSize: 28 },
  menuUserName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  menuUserEmail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
    maxWidth: 180,
  },
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

  // ── Footer zone ──────────────────────────────────────────────────────────
  zoneFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: 'rgba(10,10,22,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  zoneFooterIcon: { fontSize: 16 },
  zoneFooterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

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

  // ── Cercle centré (mode carte normal) ──────────────────────────────────
  centerCircleWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerZoneClickable: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  crosshairH: {
    position: 'absolute',
    width: 30,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1.5,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  centerCircle: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  centerZoneLabelWrap: {
    position: 'absolute',
    top: '55%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  centerZoneLabelText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  centerZoneCountsText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
    opacity: 0.95,
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

  // ── Sélecteur style carte dans le menu ───────────────────────────────────
  menuStyleSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuStyleTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  menuStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuStyleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuStyleBtnActive: {
    backgroundColor: '#6C72CB',
    borderColor: '#6C72CB',
  },
  menuStyleIcon: { fontSize: 14 },
  menuStyleLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  menuStyleLabelActive: {
    color: '#ffffff',
  },

  // ── Bottom Tab Bar ────────────────────────────────────────────────────────
  tabBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#EEEFF5',
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem:          { flex: 1, alignItems: 'center', gap: 3 },
  tabIconBox:       { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  tabIconBoxActive: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  tabIcon:          { fontSize: 18 },
  tabLabel:         { fontSize: 11, color: '#999', fontWeight: '500' },
  tabLabelActive:   { fontSize: 11, color: '#111', fontWeight: '700' },

  // Logo central + badge notification
  tabLogoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLogoImg: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: '22%',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
// ─── Styles mode sélection zone ───────────────────────────────────────────────
const pickStyles = StyleSheet.create({

  // ── Cercle blanc centré ───────────────────────────────────────────────────
  circleWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOuter: {
    width: '70%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },

  // Nom de la zone flottant juste sous le cercle
  zoneLabelWrap: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  zoneLabelText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  // ── Bandeau haut ─────────────────────────────────────────────────────────
  topBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,30,0.82)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  hint: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },

  // ── Footer panel ─────────────────────────────────────────────────────────
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8,10,28,0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },

  // ── Carte de zone ────────────────────────────────────────────────────────
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  zoneCardLeft: { flex: 1, gap: 3 },
  zoneCardTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  zoneCardName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  zoneCardCoords: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  zoneCardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  zoneCardDotActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },

  // ── Bouton Indexer ───────────────────────────────────────────────────────
  indexBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  indexBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    elevation: 0,
  },
  indexBtnIcon: { fontSize: 18 },
  indexBtnText: {
    color: '#0a0a1e',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
// ─── Styles Radio Garden Joystick ────────────────────────────────────────────
const RG_SIZE = 140; // diamètre du grand cercle
const rgStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 170,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  outerRing: {
    width: RG_SIZE,
    height: RG_SIZE,
    borderRadius: RG_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  innerRing: {
    position: 'absolute',
    width: RG_SIZE * 0.45,
    height: RG_SIZE * 0.45,
    borderRadius: RG_SIZE * 0.225,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lineH: {
    position: 'absolute',
    width: RG_SIZE - 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  lineV: {
    position: 'absolute',
    width: 1,
    height: RG_SIZE - 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30,144,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
});