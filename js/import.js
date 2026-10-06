/**
 * import.js - File import handlers for KML, KMZ, GPX, TXT, CSV, DXF
 */

function handleFileImport(files) {
  Array.from(files).forEach(file => importFile(file));
}

function importFile(file) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();
  setStatus(`Import: ${file.name}...`);

  if (ext === 'kml') {
    readTextFile(file, importKML);
  } else if (ext === 'kmz') {
    importKMZ(file);
  } else if (ext === 'gpx') {
    readTextFile(file, importGPX);
  } else if (ext === 'txt' || ext === 'csv' || ext === 'dat') {
    readTextFile(file, (text) => importTXT(text, file.name));
  } else if (ext === 'dxf') {
    readTextFile(file, importDXF);
  } else {
    alert(`Format non supporte: .${ext}`);
    setStatus('Pret.');
  }
}

function readTextFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => callback(e.target.result);
  reader.onerror = () => { alert('Erreur de lecture du fichier.'); setStatus('Erreur import.'); };
  reader.readAsText(file, 'UTF-8');
}

/* ─── KML IMPORT ─────────────────────────────────────────────────────── */
function importKML(kmlText) {
  try {
    if (!kmlText || !kmlText.trim()) {
      alert('Le fichier KML est vide.');
      setStatus('Fichier KML vide.');
      return;
    }

    let cleanText = kmlText.trim().replace(/^\uFEFF/, '');
    // Neutraliser les déclarations d'encodage non-UTF8 qui font planter DOMParser dans les navigateurs
    cleanText = cleanText.replace(/<\?xml([^>]*?)encoding=["'][^"']+["']([^>]*?)\?>/i, '<?xml$1encoding="UTF-8"$2?>');
    // Échapper les esperluettes isolées qui ne sont pas des entités XML valides
    cleanText = cleanText.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-f0-9]+);)/gi, '&amp;');

    const parser = new DOMParser();
    let kmlDoc = parser.parseFromString(cleanText, 'text/xml');
    let err = kmlDoc.querySelector('parsererror');
    if (err) {
      console.warn('DOMParser text/xml error, essai application/xml:', err.textContent);
      kmlDoc = parser.parseFromString(cleanText, 'application/xml');
      err = kmlDoc.querySelector('parsererror');
    }

    if (typeof toGeoJSON === 'undefined') {
      alert('Bibliothèque toGeoJSON non disponible. Vérifiez le chargement des scripts.');
      return;
    }

    let geojson = null;
    if (!err) {
      try {
        geojson = toGeoJSON.kml(kmlDoc);
      } catch(eGeo) {
        console.warn('toGeoJSON.kml error:', eGeo);
      }
    }

    // Si DOMParser ou toGeoJSON a échoué ou retourné 0 entité, secours via extraction regex robuste
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn('toGeoJSON a retourné 0 entité, bascule sur parseur KML regex de secours.');
      geojson = parseKMLWithRegex(cleanText);
    }

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      alert('Aucune entité (point, ligne, polygone) n\'a pu être trouvée dans ce fichier KML.');
      setStatus('0 entité KML trouvée.');
      return;
    }

    renderGeoJSON(geojson, 'KML');
  } catch(e) {
    console.error('KML import error:', e);
    alert('Erreur lors de l\'import KML: ' + e.message);
    setStatus('Erreur import KML.');
  }
}

/* Parseur regex de secours pour les KML mal formés */
function parseKMLWithRegex(kmlStr) {
  const features = [];
  const pmRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
  let pmMatch;

  while ((pmMatch = pmRegex.exec(kmlStr)) !== null) {
    const pmText = pmMatch[0];
    const nameMatch = pmText.match(/<name>([\s\S]*?)<\/name>/i);
    const descMatch = pmText.match(/<description>([\s\S]*?)<\/description>/i);
    const styleMatch = pmText.match(/<styleUrl>([\s\S]*?)<\/styleUrl>/i);

    const name = nameMatch ? nameMatch[1].trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    const styleUrl = styleMatch ? styleMatch[1].trim() : '';
    const props = { name, description, styleUrl };

    // Point
    const ptMatch = pmText.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i);
    if (ptMatch) {
      const parts = ptMatch[1].trim().split(/\s*,\s*|\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: props
          });
          continue;
        }
      }
    }

    // LineString
    const lineMatch = pmText.match(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i);
    if (lineMatch) {
      const coordPairs = lineMatch[1].trim().split(/\s+/).filter(Boolean);
      const coords = [];
      coordPairs.forEach(cp => {
        const xy = cp.split(',');
        if (xy.length >= 2) {
          const x = parseFloat(xy[0]), y = parseFloat(xy[1]);
          if (!isNaN(x) && !isNaN(y)) coords.push([x, y]);
        }
      });
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: props
        });
        continue;
      }
    }

    // Polygon
    const polyMatch = pmText.match(/<Polygon[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/i);
    if (polyMatch) {
      const coordPairs = polyMatch[1].trim().split(/\s+/).filter(Boolean);
      const coords = [];
      coordPairs.forEach(cp => {
        const xy = cp.split(',');
        if (xy.length >= 2) {
          const x = parseFloat(xy[0]), y = parseFloat(xy[1]);
          if (!isNaN(x) && !isNaN(y)) coords.push([x, y]);
        }
      });
      if (coords.length >= 3) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: props
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

/* ─── KMZ IMPORT ─────────────────────────────────────────────────────── */
function importKMZ(file) {
  if (typeof JSZip === 'undefined') {
    alert('JSZip non disponible.');
    return;
  }
  JSZip.loadAsync(file).then(zip => {
    const kmlFile = Object.values(zip.files).find(f =>
      f.name.toLowerCase().endsWith('.kml')
    );
    if (!kmlFile) { alert('Pas de fichier KML dans ce KMZ.'); return; }
    kmlFile.async('string').then(kmlText => importKML(kmlText));
  }).catch(e => {
    console.error('KMZ error:', e);
    alert('Erreur lecture KMZ: ' + e.message);
  });
}

/* ─── GPX IMPORT ─────────────────────────────────────────────────────── */
function importGPX(gpxText) {
  try {
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxText, 'application/xml');
    const geojson = toGeoJSON.gpx(gpxDoc);
    renderGeoJSON(geojson, 'GPX');
  } catch(e) {
    alert('Erreur import GPX: ' + e.message);
    setStatus('Erreur import GPX.');
  }
}

/* ─── TXT / CSV IMPORT ───────────────────────────────────────────────── */
function importTXT(text, filename) {
  const epsg = document.getElementById('sel-projection').value;
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//'));

  let points = [];
  let sep = detectSeparator(lines[0] || '');

  for (const line of lines) {
    const parts = line.trim().split(sep).map(p => p.trim().replace(/,/g, '.'));
    if (parts.length < 2) continue;

    let x, y, name = '', alt = null;

    // Try to detect if first column is a name/ID
    const f0 = parseFloat(parts[0]);
    if (isNaN(f0) && parts.length >= 3) {
      name = parts[0];
      x = parseFloat(parts[1]);
      y = parseFloat(parts[2]);
      if (parts[3]) alt = parseFloat(parts[3]);
    } else {
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
      if (parts[2]) alt = parseFloat(parts[2]);
    }

    if (isNaN(x) || isNaN(y)) continue;
    points.push({ x, y, name, alt });
  }

  if (points.length === 0) {
    alert('Aucun point trouve dans le fichier. Verifiez le format (X Y ou X;Y ou X,Y par ligne).');
    return;
  }

  let added = 0;
  const txtMarkerLayers = [];
  points.forEach((pt, i) => {
    const wgs = toWGS84(pt.x, pt.y, epsg);
    if (!wgs) return;

    elementCounter++;
    const label = pt.name || `Point ${i+1}`;
    const poleType = (typeof getPoleTypeFromName === 'function') ? getPoleTypeFromName(label) : 'PBA';
    const marker = L.marker([wgs.lat, wgs.lng], { icon: createPoleIcon(poleType) });

    marker._elementType = 'marker';
    marker._elementId = elementCounter;
    marker._elementName = label;
    marker._poleType = poleType;
    marker._isPole = true;
    marker._altitude = pt.alt;
    marker._isImported = true;
    const chkGlobalMap = document.getElementById('chk-coords-map');
    const isMapChecked = (chkGlobalMap && chkGlobalMap.checked) || !!window.SHOW_COORDS_MAP;
    marker._showCoordsMap = isMapChecked;
    marker._showCoordsDXF = false;

    drawnItems.addLayer(marker);
    if (typeof updateSupportDisplay === 'function') updateSupportDisplay(marker);
    if (typeof updateSupportPopup === 'function') updateSupportPopup(marker);

    if (marker.dragging) {
      try {
        marker.dragging.enable();
        marker.on('drag', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
        });
        marker.on('dragend', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
          if (typeof updateSupportPopup === 'function') updateSupportPopup(marker);
          if (typeof updateSupportDisplay === 'function') updateSupportDisplay(marker);
          if (typeof refreshPointsList === 'function') refreshPointsList();
        });
      } catch(e){}
    }

    undoStack.push(marker);
    txtMarkerLayers.push(marker);
    added++;
  });

  // If more than 2 points, connect with a line
  if (points.length > 1) {
    const latlngs = points.map(pt => {
      const wgs = toWGS84(pt.x, pt.y, epsg);
      return wgs ? [wgs.lat, wgs.lng] : null;
    }).filter(Boolean);

    if (latlngs.length > 1) {
      elementCounter++;
      const polyline = L.polyline(latlngs, {
        color: STYLES.lineColor,
        weight: STYLES.weight,
        opacity: 0.85
      });
      polyline.bindPopup(`<b>Trace TXT</b><br>${latlngs.length} points<br>Longueur: ${formatDistance(getLayerLength(polyline))}`);
      polyline._elementType = 'polyline';
      polyline._elementId = elementCounter;
      polyline._elementName = `Trace ${filename}`;
      polyline._isImported = true;
      drawnItems.addLayer(polyline);
    }
  }

  MAP.fitBounds(drawnItems.getBounds(), { padding: [30, 30] });
  if (txtMarkerLayers.length > 0) {
    if (!window._lastImportedPointsLayers) window._lastImportedPointsLayers = [];
    txtMarkerLayers.forEach(l => window._lastImportedPointsLayers.push(l));
    if (typeof refreshPointsList === 'function') refreshPointsList();
    const sb = document.getElementById('left-sidebar');
    if (sb) sb.style.display = 'flex';
  }

  updateElementCount();
  updateInfoPanel();
  setStatus(`TXT/CSV/DAT importé: ${added} point(s) ajouté(s).`);
}

function detectSeparator(line) {
  if (line.includes('\t')) return /\t/;
  if (line.includes(';')) return /;/;
  return /\s+/;
}

/* ─── DXF IMPORT (complet : POINT, TEXT, LWPOLYLINE, POLYLINE, SOLID, CIRCLE) ── */
function importDXF(text) {
  const lines = text.split(/\r?\n/);
  const n = lines.length;

  /* ── Structures de données ── */
  let points    = [];   // { x, y, layer, name }
  let polylines = [];   // { pts:[{x,y}], layer, closed, name }
  let circles   = [];   // { x, y, r, layer }
  let texts     = [];   // { x, y, value, layer }

  let currentEntity = '';
  let cur = {};   // proprietes de l'entite en cours
  let activePolyline = null;
  let curVertex = {};

  function saveEntity() {
    const e = cur;
    if (currentEntity === 'POINT') {
      if (e.x !== undefined && e.y !== undefined)
        points.push({ x: e.x, y: e.y, layer: e.layer || '', name: '' });
    } else if (currentEntity === 'TEXT' || currentEntity === 'MTEXT') {
      if (e.x !== undefined && e.y !== undefined && e.text)
        texts.push({ x: e.x, y: e.y, value: e.text.replace(/\\P/g,'\n').replace(/\{.*?\}/g,'').trim(), layer: e.layer || '' });
    } else if (currentEntity === 'LWPOLYLINE') {
      if (e.pts && e.pts.length >= 2)
        polylines.push({ pts: e.pts, layer: e.layer || '', closed: !!(e.flag & 1), name: '' });
    } else if (currentEntity === 'CIRCLE') {
      if (e.x !== undefined && e.y !== undefined && e.r)
        circles.push({ x: e.x, y: e.y, r: e.r, layer: e.layer || '' });
    } else if (currentEntity === 'LINE') {
      if (e.x !== undefined && e.y !== undefined && e.x2 !== undefined && e.y2 !== undefined)
        polylines.push({ pts: [{x:e.x,y:e.y},{x:e.x2,y:e.y2}], layer: e.layer || '', closed: false, name: '' });
    } else if (currentEntity === 'SOLID') {
      if (e.x !== undefined && e.y !== undefined && e.x2 !== undefined && e.y2 !== undefined) {
        const cx = (e.x + e.x2 + (e.x3 !== undefined ? e.x3 : e.x2) + (e.x4 !== undefined ? e.x4 : e.x)) / 4;
        const cy = (e.y + e.y2 + (e.y3 !== undefined ? e.y3 : e.y2) + (e.y4 !== undefined ? e.y4 : e.y)) / 4;
        points.push({ x: cx, y: cy, layer: e.layer || '', name: '' });
      }
    }
    cur = {};
  }

  let i = 0;
  while (i < n - 1) {
    const code = parseInt(lines[i].trim(), 10);
    const val  = (lines[i + 1] || '').trim();
    i += 2;

    if (isNaN(code)) continue;

    /* Début d'une nouvelle entité */
    if (code === 0) {
      const nextEnt = val.toUpperCase();
      if (currentEntity === 'VERTEX') {
        if (curVertex.x !== undefined && curVertex.y !== undefined && activePolyline) {
          activePolyline.pts.push({ x: curVertex.x, y: curVertex.y });
        }
        curVertex = {};
        if (nextEnt === 'VERTEX') {
          continue;
        } else {
          // Fin de la polyligne
          if (activePolyline && activePolyline.pts.length >= 2) {
            polylines.push(activePolyline);
          }
          activePolyline = null;
        }
      }

      saveEntity();
      currentEntity = nextEnt;

      if (currentEntity === 'POLYLINE') {
        activePolyline = { pts: [], layer: '', flag: 0, closed: false };
      } else if (currentEntity === 'LWPOLYLINE') {
        cur.pts = [];
      }
      continue;
    }

    if (currentEntity === 'VERTEX') {
      if (code === 10) curVertex.x = parseFloat(val);
      else if (code === 20) curVertex.y = parseFloat(val);
      continue;
    }

    /* Propriétés de la polyligne active ou entité courante */
    if (currentEntity === 'POLYLINE' && activePolyline) {
      if (code === 8) activePolyline.layer = val;
      else if (code === 70) {
        const flag = parseInt(val, 10);
        activePolyline.flag = flag;
        activePolyline.closed = !!(flag & 1);
      }
      continue;
    }

    /* Propriétés communes */
    switch (code) {
      case  8: cur.layer = val; break;
      case 10: {
        const v = parseFloat(val);
        if (currentEntity === 'LWPOLYLINE') {
          if (!cur._pendingX) cur._pendingX = v;
        } else if (currentEntity === 'LINE' && cur.x !== undefined) {
          cur.x2 = v;
        } else {
          cur.x = v;
        }
        break;
      }
      case 20: {
        const v = parseFloat(val);
        if (currentEntity === 'LWPOLYLINE') {
          if (cur._pendingX !== undefined) {
            cur.pts.push({ x: cur._pendingX, y: v });
            delete cur._pendingX;
          }
        } else if (currentEntity === 'LINE' && cur.y !== undefined) {
          cur.y2 = v;
        } else {
          cur.y = v;
        }
        break;
      }
      case 11:
        if (currentEntity === 'LINE' || currentEntity === 'SOLID') cur.x2 = parseFloat(val);
        break;
      case 21:
        if (currentEntity === 'LINE' || currentEntity === 'SOLID') cur.y2 = parseFloat(val);
        break;
      case 12:
        if (currentEntity === 'SOLID') cur.x3 = parseFloat(val);
        break;
      case 22:
        if (currentEntity === 'SOLID') cur.y3 = parseFloat(val);
        break;
      case 13:
        if (currentEntity === 'SOLID') cur.x4 = parseFloat(val);
        break;
      case 23:
        if (currentEntity === 'SOLID') cur.y4 = parseFloat(val);
        break;
      case 40:
        if (currentEntity === 'CIRCLE') cur.r = parseFloat(val);
        break;
      case 70:
        cur.flag = parseInt(val, 10);
        break;
      case  1: cur.text = val; break;
      case  3: cur.text = (cur.text || '') + val; break;
    }
  }

  if (currentEntity === 'VERTEX' && curVertex.x !== undefined && curVertex.y !== undefined && activePolyline) {
    activePolyline.pts.push({ x: curVertex.x, y: curVertex.y });
  }
  if (activePolyline && activePolyline.pts.length >= 2) {
    polylines.push(activePolyline);
  }
  saveEntity();

  /* ── Associer les textes aux points proches (distance < 50 m) ── */
  const epsg = document.getElementById('sel-projection').value;

  function approxDistMeters(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  texts.forEach(txt => {
    let bestDist = Infinity, bestPt = null;
    points.forEach(pt => {
      const d = approxDistMeters(txt, pt);
      if (d < bestDist) { bestDist = d; bestPt = pt; }
    });
    if (bestPt && bestDist < 50) {
      bestPt.name = bestPt.name ? bestPt.name + '\n' + txt.value : txt.value;
    }
  });

  /* ── Déduire la couleur selon la couche DXF ── */
  function layerColor(layerName) {
    const l = (layerName || '').toUpperCase();
    if (l.includes('PISTE') && (l.includes('PIETON') || l.includes('SENTIER'))) return '#8e44ad';
    if (l.includes('PISTE'))    return '#f39c12';
    if (l.includes('ROUTE'))    return '#27ae60';
    if (l.includes('BT') || l.includes('LIGNE')) return '#e74c3c';
    if (l.includes('FOYER'))    return '#000000';
    if (l.includes('ZONE'))     return '#2980b9';
    if (l.includes('COORD'))    return '#8e44ad';
    return STYLES.lineColor;
  }

  let added = 0;
  const dxfMarkerLayers = [];

  /* ── Ajouter les POINTS / SUPPORTS ── */
  points.forEach((pt, idx) => {
    const wgs = toWGS84(pt.x, pt.y, epsg);
    if (!wgs) return;
    const label = pt.name || `Support #${idx + 1}`;
    const poleType = (typeof getPoleTypeFromName === 'function') ? getPoleTypeFromName(label) : 'PBA';
    const icon = (typeof createPoleIcon === 'function') ? createPoleIcon(poleType) : undefined;
    const marker = L.marker([wgs.lat, wgs.lng], icon ? { icon } : {});

    marker._poleType = poleType;
    marker._isPole = true;
    marker._elementType = 'marker';
    marker._elementName = label;
    marker._elementId = ++elementCounter;
    const chkGlobalMap = document.getElementById('chk-coords-map');
    const isMapChecked = (chkGlobalMap && chkGlobalMap.checked) || !!window.SHOW_COORDS_MAP;
    marker._showCoordsMap = isMapChecked;
    marker._showCoordsDXF = false;
    marker._showCoords = false;
    const numMatch = label.match(/\b(?:N°|#)?(\d+)\b/i);
    if (numMatch) {
      marker._supportNumber = parseInt(numMatch[1], 10);
    }

    const nLow = label.toLowerCase();
    if (nLow.includes('mt') && !nLow.includes('bt')) marker._networkType = 'MT';
    else if (nLow.includes('bt') && nLow.includes('mt')) marker._networkType = 'BT_MT';
    else marker._networkType = 'BT';

    if (typeof updateSupportDisplay === 'function') {
      updateSupportDisplay(marker);
    } else {
      marker.bindTooltip(label, {
        permanent: true, direction: 'top', offset: [0, -8], className: 'kml-label kml-label-top'
      });
    }

    if (typeof updateSupportPopup === 'function') updateSupportPopup(marker);
    if (marker.dragging) {
      try {
        marker.dragging.enable();
        marker.on('drag', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
        });
        marker.on('dragend', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
          if (typeof updateSupportPopup === 'function') updateSupportPopup(marker);
          if (typeof updateSupportDisplay === 'function') updateSupportDisplay(marker);
          if (typeof refreshPointsList === 'function') refreshPointsList();
          if (typeof adjustOverlappingTooltips === 'function') adjustOverlappingTooltips();
        });
      } catch(e) {}
    }

    drawnItems.addLayer(marker);
    if (typeof updateSupportDisplay === 'function') updateSupportDisplay(marker);
    undoStack.push(marker);
    dxfMarkerLayers.push(marker);
    added++;
  });

  /* ── Ajouter les POLYLINES ── */
  polylines.forEach((pl, idx) => {
    const latlngs = pl.pts.map(pt => {
      const wgs = toWGS84(pt.x, pt.y, epsg);
      return wgs ? [wgs.lat, wgs.lng] : null;
    }).filter(Boolean);
    if (latlngs.length < 2) return;

    if (pl.closed && latlngs.length >= 3) latlngs.push(latlngs[0]);

    const color = layerColor(pl.layer);
    const poly  = pl.closed
      ? L.polygon(latlngs, { color, weight: 2, fillColor: color, fillOpacity: 0.15 })
      : L.polyline(latlngs, { color, weight: 2 });

    const layerLabel = pl.layer || `Ligne DXF ${idx + 1}`;
    const label = pl.name || layerLabel;
    poly.bindPopup(`<b>${label}</b><br>Couche: ${pl.layer || 'N/A'}<br>${latlngs.length} sommets`);

    if (pl.layer && !pl.layer.match(/^0$/)) {
      poly.bindTooltip(pl.layer, {
        permanent: false, sticky: true, className: 'kml-label'
      });
    }

    elementCounter++;
    poly._elementType  = pl.closed ? 'polygon' : 'polyline';
    poly._elementId    = elementCounter;
    poly._elementName  = label;
    poly._isImported   = true;
    drawnItems.addLayer(poly);
    undoStack.push(poly);
    added++;
  });

  /* ── Ajouter les CIRCLES ── */
  circles.forEach((c, idx) => {
    const wgs = toWGS84(c.x, c.y, epsg);
    if (!wgs) return;
    const circle = L.circle([wgs.lat, wgs.lng], {
      radius: c.r, color: layerColor(c.layer), weight: 2, fillOpacity: 0.1
    });
    const label = `Cercle DXF ${idx + 1}`;
    circle.bindPopup(`<b>${label}</b><br>Couche: ${c.layer}<br>Rayon: ${c.r.toFixed(3)} m`);
    elementCounter++;
    circle._elementType = 'circle';
    circle._elementId   = elementCounter;
    circle._elementName = label;
    circle._isImported  = true;
    drawnItems.addLayer(circle);
    undoStack.push(circle);
    added++;
  });

  /* ── Ajouter les TEXT orphelins (pas encore associés à un point) ── */
  texts.forEach((txt, idx) => {
    const wgs = toWGS84(txt.x, txt.y, epsg);
    if (!wgs) return;

    let attached = false;
    points.forEach(pt => {
      if (pt.name && pt.name.includes(txt.value)) attached = true;
    });
    if (attached) return;

    const label = txt.value || `Texte DXF ${idx + 1}`;
    const marker = L.marker([wgs.lat, wgs.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div class="dxf-text-label">${label.replace(/\n/g, '<br>')}</div>`,
        iconSize: null, iconAnchor: [0, 10]
      })
    });
    marker.bindPopup(`<b>${label}</b><br>Couche: ${txt.layer || 'N/A'}<br>X: ${txt.x.toFixed(3)}<br>Y: ${txt.y.toFixed(3)}`);
    elementCounter++;
    marker._elementType = 'text';
    marker._elementId   = elementCounter;
    marker._elementName = label;
    drawnItems.addLayer(marker);
    undoStack.push(marker);
    added++;
  });

  if (dxfMarkerLayers.length > 0) {
    window._lastImportedPointsLayers = dxfMarkerLayers;
    if (typeof refreshPointsList === 'function') refreshPointsList();
    const sb = document.getElementById('left-sidebar');
    if (sb) sb.style.display = 'flex';
  }

  if (typeof adjustOverlappingTooltips === 'function') {
    adjustOverlappingTooltips();
  }

  if (added > 0) {
    try {
      MAP.fitBounds(drawnItems.getBounds(), { padding: [30, 30] });
    } catch(e) {}
  } else {
    alert('Aucun élément DXF n\'a pu être converti avec le système de projection actuel (' + epsg + '). Vérifiez le choix du système de projection en haut à gauche.');
  }

  updateElementCount();
  if (typeof updateInfoPanel === 'function') updateInfoPanel();
  setStatus(`DXF importé: ${added} élément(s) — Supports: ${dxfMarkerLayers.length}, Lignes: ${polylines.length}, Cercles: ${circles.length}.`);
}

/* ─── RENDER GEOJSON ─────────────────────────────────────────────────── */
function getLayerLength(layer) {
  if (!layer) return 0;
  let lls = layer.getLatLngs ? layer.getLatLngs() : layer;
  if (!lls || !Array.isArray(lls)) return 0;
  if (Array.isArray(lls[0])) lls = lls[0];
  let total = 0;
  for (let i = 1; i < lls.length; i++) {
    if (lls[i-1] && lls[i] && lls[i-1].distanceTo) {
      total += lls[i-1].distanceTo(lls[i]);
    }
  }
  return total;
}

function getPoleTypeFromName(name) {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('pba')) return 'PBA';
  if (n.includes('acier') || /\bac\b/i.test(n) || n.endsWith('ac') || n.includes(' ac') || n.includes('/ac') || n.includes('-ac')) return 'P Acier';
  return 'PBA';
}

function createPoleIcon(poleType) {
  if (poleType === 'P Acier') {
    // P Acier : Cercle noir plein réduit
    return L.divIcon({
      className: 'pole-icon-container',
      html: '<div style="width:12px;height:12px;background:#000000;border:1px solid #222222;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.6);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  } else {
    // PBA : Carre noir plein réduit
    return L.divIcon({
      className: 'pole-icon-container',
      html: '<div style="width:12px;height:12px;background:#000000;border:1px solid #222222;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.6);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  }
}

function renderGeoJSON(geojson, sourceName) {
  let count = 0;
  const epsg = document.getElementById('sel-projection').value;

  try {
    const geoLayer = L.geoJSON(geojson, {
      style: function(feature) {
        if (!feature || !feature.geometry) return {};
        const props  = feature.properties || {};
        const name   = (props.name || props.Name || '').toLowerCase();
        const style  = (props.styleUrl || '').toLowerCase();
        const stroke = props.stroke;
        const t = feature.geometry.type;

        if (t === 'LineString' || t === 'MultiLineString') {
          let color = stroke || STYLES.lineColor;
          let weight = STYLES.weight || 3;
          if (name.includes('pieton') || name.includes('piéton') || name.includes('sentier') || style.includes('pieton')) { color = '#8e44ad'; weight = 3.5; }
          else if (name.includes('route') || style.includes('route')) { color = '#27ae60'; weight = 4; }
          else if (name.includes('piste') || style.includes('piste')) { color = '#FF6600'; weight = 3; }
          else if (name.includes('bt neuf') || name.includes('bt_neuf') || (name.includes('bt') && !name.includes('exist')) || style.includes('bt')) { color = '#e74c3c'; weight = 3; }
          else if (name.includes('exist') || style.includes('btext')) { color = '#111111'; weight = 3; }
          return { color: color, weight: weight, opacity: 0.9 };
        }
        if (t === 'Polygon' || t === 'MultiPolygon') {
          let color = STYLES.polygonColor;
          let fill = STYLES.polygonColor;
          let fillOp = STYLES.fillOpacity;
          if (name.includes('foyer') || style.includes('foyer')) {
            color = '#111111';
            fill = '#ffffff';
            fillOp = 0.1;
          }
          return { color: color, weight: STYLES.weight, fillColor: fill, fillOpacity: fillOp };
        }
        return {};
      },
      pointToLayer: function(feature, latlng) {
        const props = (feature && feature.properties) || {};
        const name  = props.name || props.Name || props.NAME || '';
        const poleType = (typeof getPoleTypeFromName === 'function') ? getPoleTypeFromName(name) : 'PBA';
        const icon = (typeof createPoleIcon === 'function') ? createPoleIcon(poleType) : undefined;
        const marker = L.marker(latlng, icon ? { icon } : {});
        marker._poleType = poleType;
        return marker;
      },
      onEachFeature: function(feature, layer) {
        if (!feature || !feature.geometry) return;
        const props = feature.properties || {};
        const name  = props.name || props.Name || props.NAME || `Element ${++count}`;
        if (!props.name && !props.Name && !props.NAME) count = count;
        else count++;

        let prefixedName = name;
        let popup = `<b>${name}</b>`;
        if (props.description) popup += `<br><small>${props.description}</small>`;

        const t = feature.geometry.type;
        if (t === 'Point') {
          const coords = feature.geometry.coordinates;
          if (coords && coords.length >= 2) {
            popup += `<br>Lon: ${coords[0].toFixed(6)}&deg;<br>Lat: ${coords[1].toFixed(6)}&deg;`;
            if (coords[2] !== undefined && coords[2] !== null) {
              const altNum = parseFloat(coords[2]);
              if (!isNaN(altNum)) {
                popup += `<br>Alt: ${altNum.toFixed(1)} m`;
                layer._altitude = altNum;
              }
            } else if (props.altitude || props.elevation) {
              const altNum = parseFloat(props.altitude || props.elevation);
              if (!isNaN(altNum)) {
                popup += `<br>Alt: ${altNum.toFixed(1)} m`;
                layer._altitude = altNum;
              }
            }
          }

          // Determiner le type de poteau
          // Priorité 1 : ExtendedData sauvegardé lors du dernier export KML
          const savedPoleType = props.poleType || props['poleType'];
          const savedElemType = props.elementType || props['elementType'];
          const savedNetType  = props.networkType || props['networkType'];

          const poleType = savedPoleType || layer._poleType || ((typeof getPoleTypeFromName === 'function') ? getPoleTypeFromName(name) : 'PBA');
          layer._poleType = poleType;
          // Restaurer l'icône correcte selon le type sauvegardé
          if (typeof createPoleIcon === 'function') {
            layer.setIcon(createPoleIcon(poleType));
          }

          // Restaurer le type d'élément exact (bt-support, mt-support, marker, coord, etc.)
          layer._elementType = savedElemType || 'marker';
          layer._isPole = true;

          // Réseau
          if (savedNetType) {
            layer._networkType = savedNetType;
          } else {
            const nLow = (name || '').toLowerCase();
            if (nLow.includes('mt') && !nLow.includes('bt')) layer._networkType = 'MT';
            else if (nLow.includes('bt') && nLow.includes('mt')) layer._networkType = 'BT_MT';
            else layer._networkType = 'BT';
          }

          // Garder le nom exact du KML sans l'écraser
          let finalName = (name || '').trim();
          if (!finalName || finalName.startsWith('Element ')) {
            finalName = (poleType === 'P Acier' ? 'P Acier #' : 'PBA #') + count;
          }
          layer._elementName = finalName;
          layer._isImportedKML = true;
          layer._isImported = true;
          const chkGlobalMap = document.getElementById('chk-coords-map');
          const isMapChecked = (chkGlobalMap && chkGlobalMap.checked) || !!window.SHOW_COORDS_MAP;
          layer._showCoordsMap = isMapChecked;
          layer._showCoordsDXF = false;
          layer._showCoords = false;
          const numMatch = finalName.match(/\b(?:N°|#)?(\d+)\b/i);
          if (numMatch) {
            layer._supportNumber = parseInt(numMatch[1], 10);
          }

          /* ── LABEL PERMANENT visible sur la carte : TITRE EN HAUT ── */
          if (typeof updateSupportDisplay === 'function') {
            updateSupportDisplay(layer);
          } else if (finalName) {
            layer.bindTooltip(finalName, {
              permanent:  true,
              direction:  'top',
              offset:     [0, -8],
              className:  'kml-label kml-label-top'
            });
          }
        } else if (t === 'LineString' || t === 'MultiLineString') {
          if (typeof getLayerLength === 'function' && typeof formatDistance === 'function') {
            popup += `<br>Longueur: ${formatDistance(getLayerLength(layer))}`;
          }
          const cleanLineName = name.replace(/\s*\([gd]\)$/i, '');
          layer._elementName = cleanLineName;

          const n = cleanLineName.toLowerCase();
          const s = (props.styleUrl || '').toLowerCase();
          if (n.includes('pieton') || n.includes('piéton') || n.includes('sentier') || s.includes('pieton')) layer._elementType = 'piste_pieton';
          else if (n.includes('piste') || s.includes('piste')) layer._elementType = 'piste';
          else if (n.includes('route') || s.includes('route')) layer._elementType = 'route';
          else if (n.includes('btmt') || (n.includes('bt') && n.includes('mt')) || s.includes('btmt')) layer._elementType = 'btmt';
          else if ((n.includes('bt') && n.includes('exist')) || s.includes('btext')) layer._elementType = 'btExt';
          else if (n.includes('bt') || s.includes('#sty-bt')) layer._elementType = 'bt';
          else if ((n.includes('mt') && n.includes('exist')) || s.includes('mtext')) layer._elementType = 'mtExt';
          else if (n.includes('mt') || s.includes('#sty-mt')) layer._elementType = 'mt';
          else layer._elementType = 'polyline';
        } else if (t === 'Polygon' || t === 'MultiPolygon') {
          layer._elementName = name;
          const n = name.toLowerCase();
          const s = (props.styleUrl || '').toLowerCase();
          if (n.includes('foyer') || s.includes('foyer')) layer._elementType = 'foyer';
          else layer._elementType = 'polygon';

          if (L.GeometryUtil && typeof formatArea === 'function') {
            const lls = layer.getLatLngs ? (layer.getLatLngs()[0] || []) : [];
            if (lls.length > 0) {
              const area = L.GeometryUtil.geodesicArea(lls);
              popup += `<br>Surface: ${formatArea(area)}`;
            }
          }
          if (name && !name.startsWith('Element')) {
            layer.bindTooltip(name, {
              permanent: true,
              direction: 'center',
              className: 'kml-label'
            });
          }
        }

        layer.bindPopup(popup);
        elementCounter++;
        if (!layer._elementType) {
          layer._elementType  = t === 'Point' ? 'marker' :
                                 t.includes('Line') ? 'polyline' : 'polygon';
        }
        layer._elementId      = elementCounter;
        if (!layer._elementName) {
          layer._elementName  = (t === 'Point') ? prefixedName : name;
        }
        layer._isImportedKML  = true;
        undoStack.push(layer);
      }
    });

    /* ── Ajouter TOUTES les couches (marqueurs, lignes, polygones) a la carte sans rien omettre ── */
    const uniqueMarkers = [];
    let importedLinesCount = 0;
    let importedPolygonsCount = 0;

    function addImportedLayer(layer) {
      if (layer instanceof L.LayerGroup && !(layer instanceof L.Polyline) && !(layer instanceof L.Polygon)) {
        layer.eachLayer(addImportedLayer);
        return;
      }
      if (layer instanceof L.Marker) {
        uniqueMarkers.push(layer);
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        importedLinesCount++;
      } else if (layer instanceof L.Polygon) {
        importedPolygonsCount++;
      }

      layer._isImportedKML = true;
      layer._isImported    = true;
      drawnItems.addLayer(layer);
    }

    geoLayer.eachLayer(addImportedLayer);

    // Ajuster l'orientation des étiquettes superposées pour éviter les chevauchements
    if (typeof adjustOverlappingTooltips === 'function') {
      adjustOverlappingTooltips();
    }

    // Activer le dragging et le popup enrichi pour tous les marqueurs apres ajout sur la carte
    uniqueMarkers.forEach(function(layer) {
      if (layer.dragging) {
        try {
          layer.dragging.enable();
          layer.on('drag', function() {
            if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
          });
          layer.on('dragend', function() {
            if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
            if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
            if (typeof updateSupportDisplay === 'function') updateSupportDisplay(layer);
            if (typeof refreshPointsList === 'function') refreshPointsList();
            if (typeof adjustOverlappingTooltips === 'function') adjustOverlappingTooltips();
          });
        } catch(e) { console.warn('drag enable error:', e); }
      }
      if (typeof updateSupportDisplay === 'function') {
        updateSupportDisplay(layer);
      }
      if (typeof updateSupportPopup === 'function') {
        try { updateSupportPopup(layer); } catch(e) { console.warn('updateSupportPopup error:', e); }
      }
      layer.on('click', function() {
        if (typeof highlightPointInSidebar === 'function') {
          highlightPointInSidebar(layer);
        }
      });
    });

    try {
      if (drawnItems.getLayers().length > 0) {
        const bounds = drawnItems.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          MAP.fitBounds(bounds, { padding: [30, 30] });
        }
      }
    } catch(err) {
      console.warn('fitBounds error:', err);
    }

    updateElementCount();
    const statusParts = [];
    if (uniqueMarkers.length > 0) statusParts.push(`${uniqueMarkers.length} support(s)`);
    if (importedLinesCount > 0) statusParts.push(`${importedLinesCount} tracé(s)`);
    if (importedPolygonsCount > 0) statusParts.push(`${importedPolygonsCount} polygone(s)`);
    const statusDetails = statusParts.length > 0 ? statusParts.join(', ') : `${count} élément(s)`;
    setStatus(`${sourceName} importé avec succès : ${statusDetails}.`);

    /* ── Mettre a jour le panneau lateral de gauche avec les points UNIQUES ── */
    window._lastImportedPointsLayers = uniqueMarkers;
    if (typeof refreshPointsList === 'function') refreshPointsList();
    if (uniqueMarkers.length > 0) {
      document.getElementById('left-sidebar').style.display = 'flex';
    }

  } catch(e) {
    console.error('GeoJSON render error:', e);
    alert('Erreur lors de l affichage: ' + e.message);
    setStatus('Erreur affichage GeoJSON.');
  }
}

/* ─── GESTION CENTRALISÉE DE LA LISTE DES SUPPORTS / POINTS ────────────── */
function refreshPointsList() {
  const pointsListEl = document.getElementById('points-list');
  if (!pointsListEl) return;

  const layers = window._lastImportedPointsLayers || [];
  const epsg = document.getElementById('sel-projection').value;

  const sidebarCount = document.getElementById('sidebar-count');
  if (sidebarCount) sidebarCount.textContent = layers.length;

  const countBadge = document.getElementById('points-count-badge');
  if (countBadge) {
    countBadge.textContent = layers.length;
    countBadge.style.display = layers.length > 0 ? 'inline-block' : 'none';
  }

  if (layers.length === 0) {
    pointsListEl.innerHTML = `
      <div style="text-align:center;color:#64748b;padding:24px 12px;font-size:12px;">
        <i class="fa fa-info-circle fa-2x" style="margin-bottom:8px;color:#94a3b8;display:block;"></i>
        Aucun support sur la carte.<br>
        Cliquez sur <b>■ PBA</b> ou <b>● Acier</b> pour en ajouter un.
      </div>
    `;
    return;
  }

  let html = '';
  layers.forEach(function(layer, idx) {
    const ll = layer.getLatLng ? layer.getLatLng() : null;
    if (!ll) return;
    const proj = latlon2proj(ll.lat, ll.lng, epsg);
    const xVal = proj ? proj.x.toFixed(3) : '--';
    let displayName = layer._elementName || 'Support #' + (idx + 1);
    if (typeof splitSupportNameLines === 'function') {
      const parts = splitSupportNameLines(displayName);
      if (parts.length > 1) {
        displayName = parts.join('\n');
      }
    }
    const safeName = String(displayName).replace(/"/g, '&quot;');
    const poleType = layer._poleType || (
      safeName.toLowerCase().includes('acier') ? 'P Acier' : 'PBA'
    );
    layer._poleType = poleType;
    const netType = layer._networkType || 'BT';
    layer._networkType = netType;

    const supNum = (layer._supportNumber !== undefined && layer._supportNumber !== null && layer._supportNumber !== '') ? layer._supportNumber : (idx + 1);
    const showCoordsMap = (typeof shouldShowSupportMapCoords === 'function') ? shouldShowSupportMapCoords(layer) : !!layer._showCoordsMap;
    const showCoordsDxf = !!layer._showCoordsDXF;
    const showCoordsBoth = (showCoordsMap && showCoordsDxf);
    const layerStamp = (typeof L !== 'undefined' && L.Util && L.Util.stamp) ? L.Util.stamp(layer) : idx;

    html += `<div class="point-item" data-idx="${idx}" data-layer-id="${layerStamp}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;padding:3px 6px;background:#f1f5f9;border-radius:4px;">
        <span style="font-weight:800;font-size:11px;color:#1e3a8a;">Support N° ${supNum}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="display:flex;align-items:center;gap:2px;cursor:pointer;font-size:10px;font-weight:700;color:${showCoordsMap ? '#0284c7' : '#64748b'};margin:0;" title="Afficher coordonnées X/Y sur la carte">
            <input type="checkbox" class="point-chk-coords-map" data-idx="${idx}" ${showCoordsMap ? 'checked' : ''} style="cursor:pointer;" />
            <span>Map</span>
          </label>
          <label style="display:flex;align-items:center;gap:2px;cursor:pointer;font-size:10px;font-weight:700;color:${showCoordsDxf ? '#16a34a' : '#64748b'};margin:0;" title="Exporter coordonnées X/Y dans le DXF">
            <input type="checkbox" class="point-chk-coords-dxf" data-idx="${idx}" ${showCoordsDxf ? 'checked' : ''} style="cursor:pointer;" />
            <span>DXF</span>
          </label>
          <label style="display:flex;align-items:center;gap:2px;cursor:pointer;font-size:10px;font-weight:700;color:${showCoordsBoth ? '#9333ea' : '#64748b'};margin:0;" title="Activer / désactiver les coordonnées à la fois sur Map et DXF pour ce support">
            <input type="checkbox" class="point-chk-coords-both" data-idx="${idx}" ${showCoordsBoth ? 'checked' : ''} style="cursor:pointer;" />
            <span>Tous</span>
          </label>
        </div>
      </div>
      <div class="point-item-header">
        <select class="pole-type-select" data-idx="${idx}" title="Type : PBA = Carré, P Acier = Cercle">
          <option value="PBA" ${poleType === 'PBA' ? 'selected' : ''}>■ PBA</option>
          <option value="P Acier" ${poleType === 'P Acier' ? 'selected' : ''}>● P Acier</option>
        </select>
        <select class="pole-net-select" data-idx="${idx}" title="Réseau : BT, MT ou Mixte (BT+MT)">
          <option value="BT" ${netType === 'BT' ? 'selected' : ''}>BT</option>
          <option value="MT" ${netType === 'MT' ? 'selected' : ''}>MT</option>
          <option value="BT_MT" ${netType === 'BT_MT' ? 'selected' : ''}>BT+MT</option>
        </select>
        <textarea class="point-name-input" rows="2" title="Modifier le nom du support (1 ou 2 lignes)" data-idx="${idx}" placeholder="Nom (1 ou 2 lignes)">${safeName}</textarea>
        <button class="point-delete-btn" data-idx="${idx}" title="Supprimer ce support">
          <i class="fa fa-trash"></i>
        </button>
      </div>
      <div class="point-coords-row" style="font-size:10px;color:#64748b;display:flex;align-items:center;justify-content:space-between;padding:3px 4px 1px 4px;margin-top:2px;background:#f8fafc;border-radius:3px;">
        <div style="display:flex;gap:8px;">
          <span>X: <b>${xVal}</b></span>
          <span>Y: <b>${yVal}</b></span>
          ${(layer._altitude !== undefined && layer._altitude !== null && layer._altitude !== '') ? `<span style="color:#16a34a;font-weight:700;">Z: ${(typeof layer._altitude === 'number' ? layer._altitude.toFixed(1) : layer._altitude)}m</span>` : ''}
        </div>
        <button type="button" class="point-btn-toggle-coords-quick" data-idx="${idx}" style="padding:1px 6px;font-size:9.5px;font-weight:700;border-radius:3px;border:1px solid ${showCoordsMap ? '#0284c7' : '#cbd5e1'};background:${showCoordsMap ? '#0284c7' : '#ffffff'};color:${showCoordsMap ? '#ffffff' : '#64748b'};cursor:pointer;display:flex;align-items:center;gap:3px;" title="${showCoordsMap ? 'Coordonnées AFFICHÉES sur la carte (cliquer pour masquer)' : 'Cliquer pour afficher les coordonnées de CE support sur la carte'}">
          <i class="fa ${showCoordsMap ? 'fa-eye' : 'fa-eye-slash'}"></i>
          <span>${showCoordsMap ? 'Visible' : 'Afficher'}</span>
        </button>
      </div>
    </div>`;
  });

  pointsListEl.innerHTML = html;

  // Changement du type de poteau (PBA <=> P Acier)
  pointsListEl.querySelectorAll('.pole-type-select').forEach(function(sel) {
    sel.addEventListener('change', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const newType = this.value;
      const lyr = layers[i];
      if (lyr) {
        lyr._poleType = newType;
        lyr.setIcon(createPoleIcon(newType));

        const inp = pointsListEl.querySelector(`.point-name-input[data-idx="${i}"]`);
        if (inp) {
          let curVal = inp.value.trim();
          curVal = curVal.replace(/^(PBA|P\s*Acier|PACIER)\s+/i, '');
          const updatedVal = (newType === 'PBA' ? 'PBA ' : 'P Acier ') + curVal;
          inp.value = updatedVal;
          lyr._elementName = updatedVal;
          if (typeof updateSupportDisplay === 'function') {
            updateSupportDisplay(lyr);
          } else if (lyr.getTooltip && lyr.getTooltip()) {
            lyr.setTooltipContent(typeof formatSupportTooltipText === 'function' ? formatSupportTooltipText(lyr) : updatedVal);
          }
        }
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
        if (typeof adjustOverlappingTooltips === 'function') adjustOverlappingTooltips();
      }
    });
  });

  // Changement du réseau (BT / MT / BT+MT)
  pointsListEl.querySelectorAll('.pole-net-select').forEach(function(sel) {
    sel.addEventListener('change', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        lyr._networkType = this.value;
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
      }
    });
  });

  // Modification directe du nom en temps réel
  pointsListEl.querySelectorAll('.point-name-input').forEach(function(inp) {
    // Prevent parent elements from intercepting Enter — let browser insert \n naturally
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.stopPropagation();
      }
    });
    inp.addEventListener('input', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      // Do NOT trim — trimming removes the \n the user just typed with Enter
      const newName = this.value;
      const lyr = layers[i];
      if (lyr) {
        lyr._elementName = newName;
        if (typeof updateSupportDisplay === 'function') {
          updateSupportDisplay(lyr);
        } else if (lyr.getTooltip && lyr.getTooltip()) {
          lyr.setTooltipContent(typeof formatSupportTooltipText === 'function' ? formatSupportTooltipText(lyr) : newName);
        }
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
        if (typeof adjustOverlappingTooltips === 'function') adjustOverlappingTooltips();
      }
    });
  });

  function syncPointBothCheckbox(pointItemEl, lyr) {
    if (!pointItemEl || !lyr) return;
    const bothChk = pointItemEl.querySelector('.point-chk-coords-both');
    if (!bothChk) return;
    const m = !!lyr._showCoordsMap;
    const d = !!lyr._showCoordsDXF;
    bothChk.checked = (m && d);
    bothChk.indeterminate = (m !== d);
    const lbl = bothChk.closest('label');
    if (lbl) lbl.style.color = (m && d) ? '#9333ea' : ((m || d) ? '#d97706' : '#64748b');
  }

  // Case à cocher : Coordonnées sur Map
  pointsListEl.querySelectorAll('.point-chk-coords-map').forEach(function(chk) {
    chk.addEventListener('change', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        lyr._showCoordsMap = this.checked;
        if (typeof updateSupportDisplay === 'function') {
          updateSupportDisplay(lyr);
        } else if (lyr.getTooltip && lyr.getTooltip()) {
          lyr.setTooltipContent(typeof formatSupportTooltipText === 'function' ? formatSupportTooltipText(lyr) : (lyr._elementName || ''));
        }
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
        const lbl = this.closest('label');
        if (lbl) lbl.style.color = this.checked ? '#0284c7' : '#64748b';
        syncPointBothCheckbox(this.closest('.point-item'), lyr);
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      }
    });
  });

  // Case à cocher : Coordonnées sur DXF
  pointsListEl.querySelectorAll('.point-chk-coords-dxf').forEach(function(chk) {
    chk.addEventListener('change', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        lyr._showCoordsDXF = this.checked;
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
        const lbl = this.closest('label');
        if (lbl) lbl.style.color = this.checked ? '#16a34a' : '#64748b';
        syncPointBothCheckbox(this.closest('.point-item'), lyr);
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      }
    });
  });

  // Case à cocher : Coordonnées TOUS (Map + DXF) pour ce point individuel
  pointsListEl.querySelectorAll('.point-chk-coords-both').forEach(function(chk) {
    chk.addEventListener('change', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        const val = this.checked;
        lyr._showCoordsMap = val;
        lyr._showCoordsDXF = val;

        const parentItem = this.closest('.point-item');
        if (parentItem) {
          const mapChk = parentItem.querySelector('.point-chk-coords-map');
          if (mapChk) {
            mapChk.checked = val;
            const lbl = mapChk.closest('label');
            if (lbl) lbl.style.color = val ? '#0284c7' : '#64748b';
          }
          const dxfChk = parentItem.querySelector('.point-chk-coords-dxf');
          if (dxfChk) {
            dxfChk.checked = val;
            const lbl = dxfChk.closest('label');
            if (lbl) lbl.style.color = val ? '#16a34a' : '#64748b';
          }
          const lblBoth = this.closest('label');
          if (lblBoth) lblBoth.style.color = val ? '#9333ea' : '#64748b';
        }

        if (typeof updateSupportDisplay === 'function') {
          updateSupportDisplay(lyr);
        } else if (lyr.getTooltip && lyr.getTooltip()) {
          lyr.setTooltipContent(typeof formatSupportTooltipText === 'function' ? formatSupportTooltipText(lyr) : (lyr._elementName || ''));
        }
        if (typeof updateSupportPopup === 'function') updateSupportPopup(lyr);
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      }
    });
  });

  // Bouton direct "Afficher / Visible" sous chaque support
  pointsListEl.querySelectorAll('.point-btn-toggle-coords-quick').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        if (typeof toggleSupportCoordsMap === 'function') {
          toggleSupportCoordsMap(lyr);
        } else {
          lyr._showCoordsMap = !lyr._showCoordsMap;
          if (typeof updateSupportDisplay === 'function') updateSupportDisplay(lyr);
          refreshPointsList();
        }
      }
    });
  });

  // Initialiser l'état indéterminé / coché pour les cases Tous
  pointsListEl.querySelectorAll('.point-item').forEach(function(item) {
    const i = parseInt(item.getAttribute('data-idx'), 10);
    const lyr = layers[i];
    if (lyr) syncPointBothCheckbox(item, lyr);
  });

  // Suppression d'un support depuis la liste
  pointsListEl.querySelectorAll('.point-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr) {
        if (confirm(`Supprimer le support "${lyr._elementName || 'Support'}" ?`)) {
          if (typeof deleteSupportPoint === 'function') {
            deleteSupportPoint(lyr);
          } else {
            drawnItems.removeLayer(lyr);
            layers.splice(i, 1);
            refreshPointsList();
          }
        }
      }
    });
  });

  // Clic sur un point pour zoomer dessus sur la carte et le mettre en valeur dans la liste
  pointsListEl.querySelectorAll('.point-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.closest('button'))) return;
      const i = parseInt(this.getAttribute('data-idx'), 10);
      const lyr = layers[i];
      if (lyr && lyr.getLatLng) {
        document.querySelectorAll('#points-list .point-item.point-item-selected').forEach(it => it.classList.remove('point-item-selected'));
        this.classList.add('point-item-selected');
        MAP.setView(lyr.getLatLng(), Math.max(MAP.getZoom(), 17));
        if (lyr.openPopup) lyr.openPopup();
      }
    });
  });

  if (typeof updateSelectAllCheckboxesState === 'function') {
    updateSelectAllCheckboxesState();
  }
}
window.refreshPointsList = refreshPointsList;
