/**
 * map.js - Leaflet map configuration (FIXED: high zoom satellite)
 */

let MAP, drawnItems, tileLayer;

const TILE_LAYERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 22, maxNativeZoom: 19, attribution: '© Esri, USGS, AeroGRID' }
  },
  satellite2: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    options: { maxZoom: 22, maxNativeZoom: 20, subdomains: ['0','1','2','3'], attribution: '© Google' }
  },
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: { maxZoom: 22, maxNativeZoom: 20, subdomains: ['0','1','2','3'], attribution: '© Google' }
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 22, maxNativeZoom: 17, attribution: '© OpenTopoMap' }
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: { maxZoom: 22, maxNativeZoom: 19, attribution: '© CartoDB' }
  }
};

function initMap() {
  MAP = L.map('map', {
    center: [31.7917, -7.0926],
    zoom: 6,
    maxZoom: 22,
    zoomControl: true,
    attributionControl: true,
    rotate: true,
    bearing: 0,
    rotateControl: {
      position: 'topleft',
      closeOnZeroBearing: false
    },
    touchRotate: true,
    shiftKeyRotate: true
  });

  // Default: Esri satellite (high res, no key needed)
  tileLayer = L.tileLayer(
    TILE_LAYERS.satellite.url,
    TILE_LAYERS.satellite.options
  ).addTo(MAP);

  drawnItems = new L.FeatureGroup();
  MAP.addLayer(drawnItems);

  initDrawControl();

  MAP.on('mousemove', function(e) {
    const epsg = document.getElementById('sel-projection').value;
    const coordHtml = formatCoords(e.latlng.lat, e.latlng.lng, epsg);
    document.getElementById('coord-display').innerHTML = coordHtml;
  });

  MAP.on('zoomend', function() {
    document.getElementById('status-zoom').textContent = 'Zoom: ' + MAP.getZoom();
  });

  document.getElementById('status-zoom').textContent = 'Zoom: ' + MAP.getZoom();
  return MAP;
}

function switchTileLayer(type) {
  if (!TILE_LAYERS[type]) return;
  if (tileLayer) MAP.removeLayer(tileLayer);
  const cfg = TILE_LAYERS[type];
  tileLayer = L.tileLayer(cfg.url, cfg.options).addTo(MAP);
}

function goToCountry(code) {
  const center = COUNTRY_CENTERS[code];
  if (center) MAP.setView([center[0], center[1]], center[2]);
}

function goToCoords(xStr, yStr, epsg) {
  const x = parseFloat(xStr.replace(',','.'));
  const y = parseFloat(yStr.replace(',','.'));
  if (isNaN(x) || isNaN(y)) { alert('Coordonnees invalides !'); return; }
  const wgs = toWGS84(x, y, epsg);
  if (!wgs) { alert('Erreur de conversion !'); return; }
  MAP.setView([wgs.lat, wgs.lng], 16);
  const marker = L.marker([wgs.lat, wgs.lng])
    .bindPopup('<b>Position</b><br>X: ' + x + '<br>Y: ' + y)
    .addTo(MAP).openPopup();
  setTimeout(() => MAP.removeLayer(marker), 5000);
}

function searchPlace(query) {
  if (!query.trim()) return;
  setStatus('Recherche: ' + query + '...');
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=5';
  fetch(url, { headers: { 'Accept-Language': 'fr' } })
    .then(r => r.json())
    .then(results => {
      if (!results.length) { alert('Lieu non trouve !'); setStatus('Pret.'); return; }
      const r = results[0];
      MAP.setView([parseFloat(r.lat), parseFloat(r.lon)], 14);
      setStatus('Trouve: ' + r.display_name);
    })
    .catch(() => { alert('Erreur reseau.'); setStatus('Pret.'); });
}
