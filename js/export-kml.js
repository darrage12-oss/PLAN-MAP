/**
 * export-kml.js - Export all drawn and imported elements to valid KML format
 * Fully compatible with Google Earth, Google Maps, QGIS, and ArcGIS.
 */

function exportKML() {
  const layers = drawnItems.getLayers();
  if (layers.length === 0) {
    alert('Aucun élément à exporter !');
    return;
  }

  const projectName = document.getElementById('project-name')?.value || 'Map_Tools_Export';
  const cleanName   = projectName.replace(/[\s\\/:"*?<>|]/g, '_');
  const now         = new Date().toISOString();

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapeKML(projectName)}</name>
    <description>Exporté par Map Tools le ${now}</description>

    <!-- Styles de base -->
    <Style id="sty-point">
      <IconStyle>
        <color>ff00aaff</color>
        <scale>1.1</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
        <hotSpot x="32" y="1" xunits="pixels" yunits="pixels"/>
      </IconStyle>
      <LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>

    <!-- Style PBA (Carré Noir) -->
    <Style id="sty-pba">
      <IconStyle>
        <color>ff000000</color>
        <scale>1.2</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/square.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.9</scale><color>ff0000ff</color></LabelStyle>
    </Style>

    <!-- Style P Acier (Cercle Noir) -->
    <Style id="sty-acier">
      <IconStyle>
        <color>ff000000</color>
        <scale>1.2</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.9</scale><color>ff0000ff</color></LabelStyle>
    </Style>

    <!-- Style Lignes / Tracés -->
    <Style id="sty-line">
      <LineStyle>
        <color>ff3366cc</color>
        <width>3.5</width>
      </LineStyle>
    </Style>

    <Style id="sty-piste">
      <LineStyle>
        <color>ff1e88e5</color>
        <width>3.0</width>
      </LineStyle>
    </Style>

    <Style id="sty-route">
      <LineStyle>
        <color>ff2e7d32</color>
        <width>4.0</width>
      </LineStyle>
    </Style>

    <!-- Style Ligne BT Neuve (Rouge) -->
    <Style id="sty-bt">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3.5</width>
      </LineStyle>
    </Style>

    <!-- Style BT Existant (Noir) -->
    <Style id="sty-btExt">
      <LineStyle>
        <color>ff000000</color>
        <width>3.0</width>
      </LineStyle>
    </Style>

    <!-- Style Ligne MT Neuve (Violet / Magenta) -->
    <Style id="sty-mt">
      <LineStyle>
        <color>ffad448e</color>
        <width>3.5</width>
      </LineStyle>
    </Style>

    <!-- Style MT Existant (Gris) -->
    <Style id="sty-mtExt">
      <LineStyle>
        <color>ff555555</color>
        <width>3.0</width>
      </LineStyle>
    </Style>

    <!-- Style Ligne Mixte BT + MT (Cyan) -->
    <Style id="sty-btmt">
      <LineStyle>
        <color>ffd8b400</color>
        <width>3.5</width>
      </LineStyle>
    </Style>

    <!-- Style Polygones -->
    <Style id="sty-polygon">
      <LineStyle>
        <color>ff1565c0</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>551565c0</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>

    <Style id="sty-foyer">
      <LineStyle>
        <color>ff0000cc</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>33ffffff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
`;

  let exportedCount = 0;

  layers.forEach(layer => {
    if (layer._isDistLabel || layer._elementType === 'dist-label' || layer._isCoordsMarker) return;
    const rawName = layer._elementName || layer._customTitle || 'Element';
    const name    = escapeKML(rawName);
    const type    = layer._elementType || '';

    /* ── 1. MARQUEURS / POINTS ── */
    if (layer instanceof L.Marker || (layer instanceof L.CircleMarker && !(layer instanceof L.Circle))) {
      const ll = layer.getLatLng ? layer.getLatLng() : null;
      if (!ll || isNaN(ll.lat) || isNaN(ll.lng)) return;

      const poleType = layer._poleType || (
        rawName.toLowerCase().includes('acier') || /\bac\b/i.test(rawName) || rawName.toLowerCase().endsWith('ac') ? 'P Acier' : 'PBA'
      );

      const styleId = (poleType === 'P Acier') ? '#sty-acier' : (poleType === 'PBA' ? '#sty-pba' : '#sty-point');
      const elemType    = type || 'marker';
      const netType     = layer._networkType || 'BT';

      const altVal = (layer._altitude !== undefined && layer._altitude !== null && !isNaN(layer._altitude)) ? parseFloat(layer._altitude).toFixed(1) : '0';

      kml += `    <Placemark>
      <name>${name}</name>
      <styleUrl>${styleId}</styleUrl>
      <ExtendedData>
        <Data name="elementType"><value>${escapeKML(elemType)}</value></Data>
        <Data name="poleType"><value>${escapeKML(poleType)}</value></Data>
        <Data name="networkType"><value>${escapeKML(netType)}</value></Data>
        <Data name="altitude"><value>${altVal}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${ll.lng.toFixed(8)},${ll.lat.toFixed(8)},${altVal}</coordinates>
      </Point>
    </Placemark>\n`;
      exportedCount++;
    }

    /* ── 2. POLYLINES / TRACÉS ── */
    else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const segments = extractPolylineSegments(layer.getLatLngs());
      if (segments.length === 0) return;

      let styleUrl = '#sty-line';
      const n = (rawName || '').toLowerCase();
      if (type === 'piste' || n.includes('piste')) styleUrl = '#sty-piste';
      else if (type === 'route' || n.includes('route')) styleUrl = '#sty-route';
      else if (type === 'btmt' || (n.includes('bt') && n.includes('mt')) || n.includes('mixte')) styleUrl = '#sty-btmt';
      else if (type === 'btExt' || (n.includes('bt') && n.includes('exist')) || n.includes('btext')) styleUrl = '#sty-btExt';
      else if (type === 'bt' || n.includes('bt neuf') || n.includes('bt_neuf') || (n.includes('bt') && !n.includes('exist'))) styleUrl = '#sty-bt';
      else if (type === 'mtExt' || (n.includes('mt') && n.includes('exist')) || n.includes('mtext')) styleUrl = '#sty-mtExt';
      else if (type === 'mt' || n.includes('mt neuf') || n.includes('mt_neuf') || (n.includes('mt') && !n.includes('exist'))) styleUrl = '#sty-mt';

      segments.forEach((seg, sIdx) => {
        if (seg.length < 2) return;
        const coordsStr = seg.map(pt => `${pt.lng.toFixed(8)},${pt.lat.toFixed(8)},0`).join(' ');
        const segName   = segments.length > 1 ? `${name} [Partie ${sIdx + 1}]` : name;

        kml += `    <Placemark>
      <name>${segName}</name>
      <styleUrl>${styleUrl}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordsStr}</coordinates>
      </LineString>
    </Placemark>\n`;
        exportedCount++;
      });
    }

    /* ── 3. CERCLES (convertis en polygone régulier) ── */
    else if (layer instanceof L.Circle) {
      const center = layer.getLatLng ? layer.getLatLng() : null;
      const radius = layer.getRadius ? layer.getRadius() : 0;
      if (!center || !radius) return;

      const circleCoords = circleToLinearRing(center.lat, center.lng, radius, 48);
      kml += `    <Placemark>
      <name>${name}</name>
      <styleUrl>#sty-polygon</styleUrl>
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${circleCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>\n`;
      exportedCount++;
    }

    /* ── 4. POLYGONES / SURFACES / FOYERS ── */
    else if (layer instanceof L.Polygon) {
      const rings = extractPolygonRings(layer.getLatLngs());
      if (rings.length === 0) return;

      const outerRing = rings[0];
      if (outerRing.length < 3) return;

      // Fermer le LinearRing (le premier et le dernier point doivent être identiques)
      const closed = [...outerRing];
      const first  = closed[0];
      const last   = closed[closed.length - 1];
      if (first.lat !== last.lat || first.lng !== last.lng) {
        closed.push(first);
      }
      if (closed.length < 4) return;

      const coordsStr = closed.map(pt => `${pt.lng.toFixed(8)},${pt.lat.toFixed(8)},0`).join(' ');
      const styleUrl  = (type === 'foyer') ? '#sty-foyer' : '#sty-polygon';

      kml += `    <Placemark>
      <name>${name}</name>
      <styleUrl>${styleUrl}</styleUrl>
      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>\n`;
      exportedCount++;
    }
  });

  kml += `  </Document>
</kml>`;

  // Téléchargement sécurisé du fichier KML
  const filename = `${cleanName}.kml`;
  downloadKMLFile(kml, filename);
  setStatus(`KML exporté avec succès : ${exportedCount} élément(s) enregistré(s).`);
}

/* ─── UTILITAIRES DE GÉOMÉTRIE & NETTOYAGE ───────────────────────────── */

/** Extrait proprement les segments d'une polyline, même imbriquée (MultiPolyline) */
function extractPolylineSegments(rawLls) {
  if (!rawLls || !Array.isArray(rawLls) || rawLls.length === 0) return [];

  const segments = [];

  function traverse(item) {
    if (!Array.isArray(item)) return;
    if (item.length === 0) return;

    if (item[0] && typeof item[0].lat === 'number' && typeof item[0].lng === 'number') {
      const valid = item.filter(pt => pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng));
      if (valid.length >= 2) segments.push(valid);
    } else {
      item.forEach(sub => traverse(sub));
    }
  }

  traverse(rawLls);
  return segments;
}

/** Extrait le contour d'un polygone, gérant les trous et MultiPolygons */
function extractPolygonRings(rawLls) {
  if (!rawLls || !Array.isArray(rawLls) || rawLls.length === 0) return [];

  const rings = [];

  function traverse(item) {
    if (!Array.isArray(item) || item.length === 0) return;
    if (item[0] && typeof item[0].lat === 'number' && typeof item[0].lng === 'number') {
      const valid = item.filter(pt => pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng));
      if (valid.length >= 3) rings.push(valid);
    } else {
      item.forEach(sub => traverse(sub));
    }
  }

  traverse(rawLls);
  return rings;
}

/** Génère un contour circulaire fermé conforme aux spécifications KML LinearRing */
function circleToLinearRing(lat, lng, radius, steps = 48) {
  const earthRadius = 6378137; // rayon Terre en mètres
  const pts = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat  = (radius * Math.cos(angle)) / earthRadius * (180 / Math.PI);
    const dLng  = (radius * Math.sin(angle)) / (earthRadius * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);
    pts.push(`${(lng + dLng).toFixed(8)},${(lat + dLat).toFixed(8)},0`);
  }

  return pts.join(' ');
}

/** Échappe les caractères réservés XML et filtre les caractères de contrôle invalides */
function escapeKML(str) {
  if (!str) return '';
  return String(str)
    .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g, '') // Supprimer caractères de contrôle corrompant l'XML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Téléchargement autonome du fichier KML (compatible avec tous les navigateurs) */
function downloadKMLFile(content, filename) {
  const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}
