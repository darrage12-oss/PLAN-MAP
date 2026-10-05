/**
 * coordinates.js - Coordinate system definitions, conversions using proj4js,
 * geodesic area calculation, and elevation services.
 */

const PROJECTIONS = {
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  // Lambert Maroc (Merchich datum)
  'EPSG:26191': '+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs',
  'EPSG:26192': '+proj=lcc +lat_1=29.7 +lat_0=29.7 +lon_0=-5.4 +k_0=0.9996155271 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs',
  'EPSG:26194': '+proj=lcc +lat_1=26.1 +lat_0=26.1 +lon_0=-5.4 +k_0=0.9996 +x_0=1200000 +y_0=400000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs',
  'EPSG:26195': '+proj=lcc +lat_1=22.5 +lat_0=22.5 +lon_0=-5.4 +k_0=0.9996 +x_0=1500000 +y_0=400000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs',
  // France (Lambert 93 & Lambert II Étendu)
  'EPSG:2154': '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:27572': '+proj=lcc +lat_0=46.8 +lon_0=2.33722917 +k_0=0.99987742 +x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs',
  // UTM Zones
  'EPSG:32628': '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs',
  'EPSG:32629': '+proj=utm +zone=29 +datum=WGS84 +units=m +no_defs',
  'EPSG:32630': '+proj=utm +zone=30 +datum=WGS84 +units=m +no_defs',
  'EPSG:32631': '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs',
  'EPSG:32632': '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs',
  'EPSG:32633': '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
};

function initProjections() {
  if (typeof proj4 === 'undefined') return;
  for (const [code, def] of Object.entries(PROJECTIONS)) {
    proj4.defs(code, def);
  }
}

function toWGS84(x, y, fromEpsg) {
  if (fromEpsg === 'EPSG:4326') return { lat: y, lng: x };
  if (typeof proj4 === 'undefined') return null;
  try {
    const [lng, lat] = proj4(fromEpsg, 'EPSG:4326', [x, y]);
    return { lat, lng };
  } catch (e) { console.error('Coord conversion error:', e); return null; }
}

function fromWGS84(lat, lng, toEpsg) {
  if (toEpsg === 'EPSG:4326') return { x: lng, y: lat };
  if (typeof proj4 === 'undefined') return null;
  try {
    const [x, y] = proj4('EPSG:4326', toEpsg, [lng, lat]);
    return { x, y };
  } catch (e) { console.error('Coord conversion error:', e); return null; }
}

function formatCoords(lat, lng, epsg) {
  const isGeo = epsg === 'EPSG:4326';
  const angleUnit = document.querySelector('input[name="angle-unit"]:checked')?.value || 'deg';
  if (isGeo) {
    if (angleUnit === 'rad') {
      const xr = (lng * Math.PI / 180).toFixed(8);
      const yr = (lat * Math.PI / 180).toFixed(8);
      return `X: ${xr} rad &nbsp; Y: ${yr} rad`;
    }
    return `X: ${lng.toFixed(6)}&deg; &nbsp; Y: ${lat.toFixed(6)}&deg;`;
  } else {
    const proj = fromWGS84(lat, lng, epsg);
    if (!proj) return 'X: -- Y: --';
    return `X: ${proj.x.toFixed(3)} m &nbsp; Y: ${proj.y.toFixed(3)} m`;
  }
}

function getUnitLabel(epsg) {
  return epsg === 'EPSG:4326' ? 'deg' : 'm';
}

const COUNTRY_CENTERS = {
  'MA': [31.7917, -7.0926, 6],
  'DZ': [28.0339,  1.6596, 5],
  'TN': [33.8869,  9.5375, 7],
  'FR': [46.2276,  2.2137, 6],
  'ES': [40.4637, -3.7492, 6],
  'MR': [21.0079,-10.9408, 6],
  'SN': [14.4974,-14.4524, 7],
  'LY': [26.3351, 17.2283, 5],
};

/* ─── COORDINATE UTILS (GLOBAL) ───────────────────────────────────────── */
function latlon2proj(lat, lng, epsg) {
  if (!epsg || epsg === 'EPSG:4326') return { x: lng, y: lat };
  return fromWGS84(lat, lng, epsg);
}
window.latlon2proj = latlon2proj;

function latlngs2proj(lls, epsg) {
  if (Array.isArray(lls[0])) lls = lls[0];
  return lls.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
}
window.latlngs2proj = latlngs2proj;

/* ─── CALCUL DE SURFACE GÉODÉSIQUE AUTONOME (FALLBACK L.GeometryUtil) ─── */
function calculateGeodesicArea(latlngs) {
  if (!latlngs || latlngs.length < 3) return 0;
  if (Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0])) latlngs = latlngs[0];
  if (Array.isArray(latlngs[0])) latlngs = latlngs[0];
  const R = 6378137;
  let area = 0;
  const len = latlngs.length;
  for (let i = 0; i < len; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % len];
    const lat1 = (p1.lat !== undefined ? p1.lat : p1[0]) * Math.PI / 180;
    const lat2 = (p2.lat !== undefined ? p2.lat : p2[0]) * Math.PI / 180;
    const lon1 = (p1.lng !== undefined ? p1.lng : p1[1]) * Math.PI / 180;
    const lon2 = (p2.lng !== undefined ? p2.lng : p2[1]) * Math.PI / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * R * R / 4);
}
window.calculateGeodesicArea = calculateGeodesicArea;

// Assurer la présence de L.GeometryUtil.geodesicArea
if (typeof window !== 'undefined') {
  if (typeof L !== 'undefined') {
    if (!L.GeometryUtil) L.GeometryUtil = {};
    if (!L.GeometryUtil.geodesicArea) L.GeometryUtil.geodesicArea = calculateGeodesicArea;
  }
}

/* ─── SERVICE D'ALTITUDE / ÉLÉVATION (OPEN-METEO) ─────────────────────── */
async function fetchElevation(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.elevation ? data.elevation[0] : null;
  } catch (err) {
    console.warn('Erreur API Altitude:', err);
    return null;
  }
}
window.fetchElevation = fetchElevation;

async function fetchElevationsBatch(coords) {
  if (!coords || coords.length === 0) return [];
  try {
    const lats = coords.map(c => (c.lat !== undefined ? c.lat : c[0])).join(',');
    const lons = coords.map(c => (c.lng !== undefined ? c.lng : c[1])).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
    const res = await fetch(url);
    if (!res.ok) return coords.map(() => null);
    const data = await res.json();
    return data.elevation || coords.map(() => null);
  } catch (err) {
    console.warn('Erreur API Altitude Batch:', err);
    return coords.map(() => null);
  }
}
window.fetchElevationsBatch = fetchElevationsBatch;
