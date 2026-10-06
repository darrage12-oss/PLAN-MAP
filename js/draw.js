/**
 * draw.js - Outils de dessin avec lignes paralleles et gestion des limites de foyers & coordonnees X/Y
 *  - Foyer   : Trace la limite du foyer (polygone) + etiquette Nom (rouge) et Coordonnees X/Y (noir)
 *  - Coord   : Affiche les coordonnees X/Y de n'importe quel point choisi par l'utilisateur
 *  - Piste   : 2 traits paralleles espaces de 4 m
 *  - Route   : 2 traits paralleles espaces de 7 m
 *  - BT      : Ligne rouge pointillee + supports numerotes
 *  - BT Ext  : Reseau existant en noir plein
 */

let drawControl = null;
let currentDrawHandler = null;
let activeTool = null;
let elementCounter = 0;
let undoStack = [];

/* ─── OPTION : SUPPORTS PBA CARRES & DISTANCES AUTOMATIQUES EN TRACE RESEAU ─── */
let AUTO_POLES_AND_DISTANCES = true;
let tempTraceSpanLabels = []; // Étiquettes temporaires live pendant le tracé
window.AUTO_POLES_AND_DISTANCES = AUTO_POLES_AND_DISTANCES;

let STYLES = {
  lineColor:    '#3a86ff',
  pointColor:   '#FF0000',
  polygonColor: '#0066FF',
  routeColor:   '#27ae60',
  pisteColor:   '#f39c12',
  pistePietonColor: '#8e44ad',
  btColor:      '#e74c3c',
  btExtColor:   '#000000',
  mtColor:      '#8e44ad',
  mtExtColor:   '#555555',
  btmtColor:    '#00b4d8',
  foyerColor:   '#000000',
  weight:   3,
  fillOpacity: 0.2
};

/* ─── VOIES & PISTES CONFIG ────────────────────────────────────────────── */
let CURRENT_ROUTE_WIDTH  = 10;   // metres entre les 2 traits de route (8m à 30m)
let CURRENT_PISTE_WIDTH  = 4;    // metres entre les 2 traits de piste (2m à 8m)
let CURRENT_PIETON_WIDTH = 1.5;  // metres entre les 2 traits de piste piétons (1m à 2m)
let LAST_ACTIVE_TRACK_TOOL = 'route';

window.CURRENT_ROUTE_WIDTH  = CURRENT_ROUTE_WIDTH;
window.CURRENT_PISTE_WIDTH  = CURRENT_PISTE_WIDTH;
window.CURRENT_PIETON_WIDTH = CURRENT_PIETON_WIDTH;

function setTrackWidth(type, width) {
  width = parseFloat(width);
  if (isNaN(width) || width <= 0) return;
  if (type === 'route') {
    CURRENT_ROUTE_WIDTH = width;
    window.CURRENT_ROUTE_WIDTH = width;
  } else if (type === 'piste') {
    CURRENT_PISTE_WIDTH = width;
    window.CURRENT_PISTE_WIDTH = width;
  } else if (type === 'piste_pieton') {
    CURRENT_PIETON_WIDTH = width;
    window.CURRENT_PIETON_WIDTH = width;
  }
  updateWidthUI();
}
window.setTrackWidth = setTrackWidth;

function updateWidthUI() {
  const badgeRoute = document.getElementById('badge-route-w');
  if (badgeRoute) badgeRoute.textContent = CURRENT_ROUTE_WIDTH + 'm';
  const badgePiste = document.getElementById('badge-piste-w');
  if (badgePiste) badgePiste.textContent = CURRENT_PISTE_WIDTH + 'm';
  const badgePieton = document.getElementById('badge-pieton-w');
  if (badgePieton) badgePieton.textContent = CURRENT_PIETON_WIDTH + 'm';

  const settingRoute = document.getElementById('setting-route-width');
  if (settingRoute) settingRoute.value = CURRENT_ROUTE_WIDTH;
  const settingPiste = document.getElementById('setting-piste-width');
  if (settingPiste) settingPiste.value = CURRENT_PISTE_WIDTH;
  const settingPieton = document.getElementById('setting-pieton-width');
  if (settingPieton) settingPieton.value = CURRENT_PIETON_WIDTH;

  const mode = (activeTool === 'route' || activeTool === 'piste' || activeTool === 'piste_pieton') ? activeTool : LAST_ACTIVE_TRACK_TOOL;
  renderTrackWidthSelect(mode);
}
window.updateWidthUI = updateWidthUI;

function renderTrackWidthSelect(mode) {
  const sel = document.getElementById('sel-road-width');
  const label = document.getElementById('road-width-label');
  const modeName = document.getElementById('road-width-mode');
  if (!sel) return;

  mode = mode || 'route';
  LAST_ACTIVE_TRACK_TOOL = mode;

  if (label && modeName) {
    label.className = 'road-width-label';
    if (mode === 'route') {
      modeName.textContent = 'Route';
    } else if (mode === 'piste') {
      label.classList.add('mode-piste');
      modeName.textContent = 'Piste';
    } else if (mode === 'piste_pieton') {
      label.classList.add('mode-pieton');
      modeName.textContent = 'Piétons';
    }
  }

  let options = [];
  let currentVal = 10;
  if (mode === 'route') {
    currentVal = CURRENT_ROUTE_WIDTH;
    const presets = [8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 22, 25, 30];
    if (!presets.includes(currentVal)) presets.push(currentVal);
    presets.sort((a,b) => a - b);
    options = presets.map(w => ({ value: w, text: `${w} m` + (w === 10 ? ' (std)' : '') }));
  } else if (mode === 'piste') {
    currentVal = CURRENT_PISTE_WIDTH;
    const presets = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8];
    if (!presets.includes(currentVal)) presets.push(currentVal);
    presets.sort((a,b) => a - b);
    options = presets.map(w => ({ value: w, text: `${w} m` + (w === 4 ? ' (std)' : '') }));
  } else if (mode === 'piste_pieton') {
    currentVal = CURRENT_PIETON_WIDTH;
    const presets = [1.0, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0];
    if (!presets.includes(currentVal)) presets.push(currentVal);
    presets.sort((a,b) => a - b);
    options = presets.map(w => ({ value: w, text: `${w} m` + (w === 1.5 ? ' (std)' : '') }));
  }

  sel.innerHTML = options.map(o => `<option value="${o.value}" ${Math.abs(o.value - currentVal) < 0.01 ? 'selected' : ''}>${o.text}</option>`).join('') +
    `<option value="custom">Autre / Saisir...</option>`;
}
window.renderTrackWidthSelect = renderTrackWidthSelect;

/* ─── HELPER ETIQUETTE DE DISTANCE ENTRE DEUX POTEAUX (SUR LA CARTE) ─── */
function createDistanceLabelIcon(distMeters, networkType) {
  const distText = distMeters < 1000 ? (distMeters.toFixed(1) + ' m') : ((distMeters / 1000).toFixed(3) + ' km');
  let extraClass = '';
  const net = String(networkType || '').toLowerCase();
  if (net.includes('mt') && !net.includes('bt')) extraClass = 'span-dist-mt';
  else if (net.includes('bt') && net.includes('mt')) extraClass = 'span-dist-btmt';
  else if (net.includes('btext')) extraClass = 'span-dist-btext';
  else if (net.includes('mtext')) extraClass = 'span-dist-mtext';

  return L.divIcon({
    className: 'span-dist-container',
    html: `<div class="span-dist-pill ${extraClass}"><span>${distText}</span></div>`,
    iconSize: [60, 20],
    iconAnchor: [30, 10]
  });
}
window.createDistanceLabelIcon = createDistanceLabelIcon;

/* ─── INIT ────────────────────────────────────────────────────────────── */
function initDrawControl() {
  drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: false,  // On utilise nos propres boutons pour dessiner
    edit: { 
      featureGroup: drawnItems, 
      remove: true 
    }
  });
  MAP.addControl(drawControl);
}

/* ─── DRAW OPTIONS ────────────────────────────────────────────────────── */
function getPoleTypeFromName(name) {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('pba')) return 'PBA';
  if (n.includes('acier') || /\bac\b/i.test(n) || n.endsWith('ac') || n.includes(' ac') || n.includes('/ac') || n.includes('-ac')) return 'P Acier';
  return 'PBA';
}
window.getPoleTypeFromName = getPoleTypeFromName;

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
window.createPoleIcon = createPoleIcon;

function getDrawOptions(type) {
  const pbaIcon = createPoleIcon('PBA');
  const opts = {
    foyer:   { shapeOptions: { color: STYLES.foyerColor, weight: 2.5, fillColor: '#ffffff', fillOpacity: 0.25 }, showArea: true, metric: true },
    coord:   { icon: createCoordIcon() },
    pba:     { icon: createPoleIcon('PBA') },
    acier:   { icon: createPoleIcon('P Acier') },
    point:   { icon: createCoordIcon() },
    line:    { shapeOptions: { color: STYLES.lineColor,    weight: STYLES.weight, opacity: 0.9 }, showLength: true, metric: true },
    route:   { shapeOptions: { color: STYLES.routeColor,   weight: 4,             opacity: 0.95 }, showLength: true, metric: true },
    piste:   { shapeOptions: { color: STYLES.pisteColor,   weight: 3,             opacity: 0.9, dashArray: '10,6' }, showLength: true, metric: true },
    piste_pieton: { shapeOptions: { color: STYLES.pistePietonColor || '#8e44ad', weight: 3.5, opacity: 0.95, dashArray: '1,7', lineCap: 'round', lineJoin: 'round' }, showLength: true, metric: true },
    polygon: { shapeOptions: { color: STYLES.polygonColor, weight: STYLES.weight, fillColor: STYLES.polygonColor, fillOpacity: STYLES.fillOpacity }, showArea: true, metric: true },
    circle:  { shapeOptions: { color: STYLES.polygonColor, weight: STYLES.weight, fillColor: STYLES.polygonColor, fillOpacity: STYLES.fillOpacity }, showRadius: true, metric: true },
    bt:      { icon: pbaIcon, shapeOptions: { color: STYLES.btColor,      weight: 2.5, opacity: 1, dashArray: '8,4' }, showLength: true, metric: true },
    btExt:   { icon: pbaIcon, shapeOptions: { color: STYLES.btExtColor,   weight: 2.5, opacity: 1 }, showLength: true, metric: true },
    mt:      { icon: pbaIcon, shapeOptions: { color: STYLES.mtColor,      weight: 2.5, opacity: 1, dashArray: '8,4' }, showLength: true, metric: true },
    mtExt:   { icon: pbaIcon, shapeOptions: { color: STYLES.mtExtColor,   weight: 2.5, opacity: 1 }, showLength: true, metric: true },
    btmt:    { icon: pbaIcon, shapeOptions: { color: STYLES.btmtColor,    weight: 3,   opacity: 1, dashArray: '6,3' }, showLength: true, metric: true },
  };
  return opts[type] || {};
}

function createCoordIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;border:2px solid #8e44ad;border-radius:50%;background:#ffffff;box-shadow:0 0 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><div style="width:4px;height:4px;background:#8e44ad;border-radius:50%;"></div></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function createBTSupportIcon(num) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#e74c3c;border:2px solid #fff;border-radius:3px;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">' + num + '</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function createMTSupportIcon(num) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#8e44ad;border:2px solid #fff;border-radius:3px;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">' + num + '</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function createBTMTSupportIcon(num) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#00b4d8;border:2px solid #fff;border-radius:3px;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">' + num + '</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

/* ─── TOOL CONTROL ────────────────────────────────────────────────────── */
function stopCurrentDraw() {
  if (currentDrawHandler) {
    try { currentDrawHandler.disable(); } catch(e) {}
    currentDrawHandler = null;
  }
  // Nettoyer les étiquettes de portée temporaires du tracé
  if (tempTraceSpanLabels && tempTraceSpanLabels.length > 0) {
    tempTraceSpanLabels.forEach(m => { try { MAP.removeLayer(m); } catch(e){} });
    tempTraceSpanLabels = [];
  }
  const hud = document.getElementById('live-measure-hud');
  if (hud) hud.classList.add('hidden');

  activeTool = null;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
}

function startDraw(type) {
  stopCurrentDraw();
  const opts = getDrawOptions(type);
  let handler;
  switch(type) {
    case 'foyer':   handler = new L.Draw.Polygon(MAP, opts); break;
    case 'coord':   handler = new L.Draw.Marker(MAP, opts); break;
    case 'pba':     handler = new L.Draw.Marker(MAP, opts); break;
    case 'acier':   handler = new L.Draw.Marker(MAP, opts); break;
    case 'point':   handler = new L.Draw.Marker(MAP, opts); break;
    case 'line':    handler = new L.Draw.Polyline(MAP, opts); break;
    case 'route':   handler = new L.Draw.Polyline(MAP, opts); break;
    case 'piste':   handler = new L.Draw.Polyline(MAP, opts); break;
    case 'piste_pieton': handler = new L.Draw.Polyline(MAP, opts); break;
    case 'polygon': handler = new L.Draw.Polygon(MAP, opts); break;
    case 'circle':  handler = new L.Draw.Circle(MAP, opts); break;
    case 'bt':      handler = new L.Draw.Polyline(MAP, opts); break;
    case 'btExt':   handler = new L.Draw.Polyline(MAP, opts); break;
    case 'mt':      handler = new L.Draw.Polyline(MAP, opts); break;
    case 'mtExt':   handler = new L.Draw.Polyline(MAP, opts); break;
    case 'btmt':    handler = new L.Draw.Polyline(MAP, opts); break;
    default: return;
  }
  handler.enable();
  currentDrawHandler = handler;
  activeTool = type;

  if (type === 'route' || type === 'piste' || type === 'piste_pieton') {
    renderTrackWidthSelect(type);
  }

  const isNet = (type === 'bt' || type === 'mt' || type === 'btmt' || type === 'btExt' || type === 'mtExt');
  const hud = document.getElementById('live-measure-hud');
  if (isNet && hud && AUTO_POLES_AND_DISTANCES) {
    hud.classList.remove('hidden');
    const badge = document.getElementById('hud-network-type');
    if (badge) {
      badge.className = 'hud-type-badge ' + ((type === 'mt' || type === 'mtExt') ? 'hud-mt' : ((type === 'btmt') ? 'hud-btmt' : ''));
      badge.textContent = (type === 'mt' || type === 'mtExt') ? 'MT 22kV' : ((type === 'btmt') ? 'BT+MT' : (type === 'btExt' ? 'BT Exist' : 'BT Neuf'));
    }
    const liveEl = document.getElementById('hud-live-dist');
    if (liveEl) liveEl.textContent = '0.0 m';
    const totalEl = document.getElementById('hud-total-dist');
    if (totalEl) totalEl.textContent = '0.0 m';
    const polesEl = document.getElementById('hud-poles-count');
    if (polesEl) polesEl.textContent = '0';
  } else if (hud) {
    hud.classList.add('hidden');
  }

  const btnMap = {
    foyer:'tool-foyer', coord:'tool-coord', pba:'tool-pba', acier:'tool-acier',
    line:'tool-line', route:'tool-route', piste:'tool-piste', piste_pieton:'tool-piste-pieton',
    polygon:'tool-polygon', circle:'tool-circle', bt:'tool-bt', btExt:'tool-btExt',
    mt:'tool-mt', mtExt:'tool-mtExt', btmt:'tool-btmt'
  };
  const labels = {
    foyer:'Limite Foyer (cliquez les coins du batiment, double-clic pour fermer)',
    coord:'Afficher Coordonnees X/Y (cliquez sur la position)',
    pba:'Support PBA (Carré Noir) — Cliquez sur la carte pour placer. [Echap] pour quitter',
    acier:'Support Acier (Cercle Noir) — Cliquez sur la carte pour placer. [Echap] pour quitter',
    line:'Ligne',
    route:`Route (${CURRENT_ROUTE_WIDTH}m - traits pleins) : Cliquez les points de l'axe, double-clic pour terminer`,
    piste:`Piste (${CURRENT_PISTE_WIDTH}m - traits tiretés) : Cliquez les points de l'axe, double-clic pour terminer`,
    piste_pieton:`Piste Piétons (${CURRENT_PIETON_WIDTH}m - deux rangées de pointillés) : Cliquez l'axe, double-clic pour terminer`,
    polygon:'Polygone / Zone',
    circle:'Cercle',
    bt:'Ligne BT : Cliquez chaque support (carré PBA automatique + distance live, double-clic pour valider)',
    btExt:'Reseau BT existant',
    mt:'Ligne MT Neuve 22kV : Cliquez chaque support (carré PBA automatique + distance live, double-clic pour valider)',
    mtExt:'Reseau MT existant',
    btmt:'Ligne Mixte BT + MT : Cliquez chaque support (carré PBA automatique + distance live, double-clic pour valider)'
  };
  const btn = document.getElementById(btnMap[type]);
  if (btn) btn.classList.add('active');
  setStatus('Mode: ' + (labels[type] || type));
}

/* ─── DRAW EVENTS ─────────────────────────────────────────────────────── */
function setupDrawEvents() {
  /* Option globale : Afficher ou masquer PBA / Acier dans le nom des supports */
  const chkShowPoleType = document.getElementById('chk-show-pole-type');
  if (chkShowPoleType) {
    chkShowPoleType.addEventListener('change', function() {
      const show = this.checked;
      window.SHOW_POLE_TYPE_IN_NAME = show;
      drawnItems.eachLayer(layer => {
        if (layer instanceof L.Marker && (layer._isPole || layer._elementType === 'marker')) {
          const pType = (layer._poleType === 'P Acier') ? 'ACIER' : 'PBA';
          let curName = (layer._elementName || '').trim();
          if (show) {
            // Ajouter PBA ou ACIER au début si absent
            if (!/^(PBA|P\s*Acier|ACIER)\b/i.test(curName)) {
              layer._elementName = `${pType} ${curName}`;
            }
          } else {
            // Retirer PBA ou ACIER au début si présent
            if (/^(PBA|P\s*Acier|ACIER)\s+/i.test(curName)) {
              layer._elementName = curName.replace(/^(PBA|P\s*Acier|ACIER)\s+/i, '');
            }
          }
          if (layer.getTooltip && layer.getTooltip()) {
            layer.setTooltipContent(formatSupportTooltipText(layer));
          }
          updateSupportPopup(layer);
        }
      });
      if (window.refreshPointsList) window.refreshPointsList();
      adjustOverlappingTooltips();
    });
  }

  /* ── BASCULE RAPIDE DES COORDONNÉES D'UN SUPPORT INDIVIDUEL (AU CHOIX) ── */
  function toggleSupportCoordsMap(layer) {
    if (!layer) return;
    const current = shouldShowSupportMapCoords(layer);
    const next = !current;
    layer._showCoordsMap = next;
    updateSupportDisplay(layer);
    updateSupportPopup(layer);
    if (window.refreshPointsList) window.refreshPointsList();
    if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
    if (typeof setStatus === 'function') {
      const name = layer._elementName || 'Support';
      setStatus(`Support ${name} : Coordonnées X/Y ${next ? 'AFFICHÉES sous le point' : 'MASQUÉES'}.`);
    }
  }
  window.toggleSupportCoordsMap = toggleSupportCoordsMap;

  /* ── FONCTIONS CENTRALISÉES : SÉLECTION TOUS MAP / TOUS DXF / TOUT (MAP+DXF) ── */
  function setAllCoordsMap(show) {
    window.SHOW_COORDS_MAP = show;
    const chkGlobal = document.getElementById('chk-coords-map');
    if (chkGlobal) chkGlobal.checked = show;
    const chkSidebar = document.getElementById('chk-select-all-map');
    if (chkSidebar) { chkSidebar.checked = show; chkSidebar.indeterminate = false; }

    drawnItems.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel) {
        layer._showCoordsMap = show;
        updateSupportDisplay(layer);
        if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
      }
    });

    const list = window._lastImportedPointsLayers || [];
    list.forEach(layer => {
      layer._showCoordsMap = show;
    });

    // Mettre à jour les cases individuelles dans la liste latérale
    const chks = document.querySelectorAll('.point-chk-coords-map');
    chks.forEach(c => {
      c.checked = show;
      const lbl = c.closest('label');
      if (lbl) lbl.style.color = show ? '#0284c7' : '#64748b';
    });

    updateSelectAllCheckboxesState();
    adjustOverlappingTooltips();
    if (typeof setStatus === 'function') {
      setStatus(`Coordonnées Map : tous les supports ${show ? 'activés (affichés sous les points)' : 'masqués'}.`);
    }
  }
  window.setAllCoordsMap = setAllCoordsMap;

  function setAllCoordsDXF(show) {
    window.SHOW_COORDS_DXF = show;
    const chkGlobal = document.getElementById('chk-coords-dxf');
    if (chkGlobal) chkGlobal.checked = show;
    const chkSidebar = document.getElementById('chk-select-all-dxf');
    if (chkSidebar) { chkSidebar.checked = show; chkSidebar.indeterminate = false; }

    drawnItems.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel) {
        layer._showCoordsDXF = show;
        if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
      }
    });

    const list = window._lastImportedPointsLayers || [];
    list.forEach(layer => {
      layer._showCoordsDXF = show;
    });

    // Mettre à jour les cases individuelles dans la liste latérale
    const chks = document.querySelectorAll('.point-chk-coords-dxf');
    chks.forEach(c => {
      c.checked = show;
      const lbl = c.closest('label');
      if (lbl) lbl.style.color = show ? '#16a34a' : '#64748b';
    });

    updateSelectAllCheckboxesState();
    if (typeof setStatus === 'function') {
      setStatus(`Coordonnées DXF : tous les supports ${show ? 'sélectionnés pour l\'export DXF' : 'désactivés de l\'export DXF'}.`);
    }
  }
  window.setAllCoordsDXF = setAllCoordsDXF;

  function setAllCoordsBoth(show) {
    window.SHOW_COORDS_MAP = show;
    window.SHOW_COORDS_DXF = show;

    const chkMapTop = document.getElementById('chk-coords-map');
    if (chkMapTop) chkMapTop.checked = show;
    const chkMapSide = document.getElementById('chk-select-all-map');
    if (chkMapSide) { chkMapSide.checked = show; chkMapSide.indeterminate = false; }

    const chkDxfTop = document.getElementById('chk-coords-dxf');
    if (chkDxfTop) chkDxfTop.checked = show;
    const chkDxfSide = document.getElementById('chk-select-all-dxf');
    if (chkDxfSide) { chkDxfSide.checked = show; chkDxfSide.indeterminate = false; }

    const chkBothTop = document.getElementById('chk-coords-both');
    if (chkBothTop) { chkBothTop.checked = show; chkBothTop.indeterminate = false; }
    const chkBothSide = document.getElementById('chk-select-all-both');
    if (chkBothSide) { chkBothSide.checked = show; chkBothSide.indeterminate = false; }

    drawnItems.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel) {
        layer._showCoordsMap = show;
        layer._showCoordsDXF = show;
        updateSupportDisplay(layer);
        if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
      }
    });

    const list = window._lastImportedPointsLayers || [];
    list.forEach(layer => {
      layer._showCoordsMap = show;
      layer._showCoordsDXF = show;
    });

    document.querySelectorAll('.point-chk-coords-map').forEach(c => {
      c.checked = show;
      const lbl = c.closest('label');
      if (lbl) lbl.style.color = show ? '#0284c7' : '#64748b';
    });
    document.querySelectorAll('.point-chk-coords-dxf').forEach(c => {
      c.checked = show;
      const lbl = c.closest('label');
      if (lbl) lbl.style.color = show ? '#16a34a' : '#64748b';
    });
    document.querySelectorAll('.point-chk-coords-both').forEach(c => {
      c.checked = show;
      c.indeterminate = false;
      const lbl = c.closest('label');
      if (lbl) lbl.style.color = show ? '#9333ea' : '#64748b';
    });

    adjustOverlappingTooltips();
    if (typeof setStatus === 'function') {
      setStatus(`Coordonnées Tout (Map + DXF) : tous les supports ${show ? 'activés (carte et export DXF)' : 'masqués et exclus du DXF'}.`);
    }
  }
  window.setAllCoordsBoth = setAllCoordsBoth;

  function updateSelectAllCheckboxesState() {
    const mapChks = Array.from(document.querySelectorAll('.point-chk-coords-map'));
    const dxfChks = Array.from(document.querySelectorAll('.point-chk-coords-dxf'));
    const bothChks = Array.from(document.querySelectorAll('.point-chk-coords-both'));

    const chkMapTop = document.getElementById('chk-coords-map');
    const chkMapSide = document.getElementById('chk-select-all-map');
    if (mapChks.length > 0) {
      const checkedCount = mapChks.filter(c => c.checked).length;
      const allChecked = (checkedCount === mapChks.length);
      const someChecked = (checkedCount > 0 && !allChecked);
      if (chkMapSide) {
        chkMapSide.checked = allChecked;
        chkMapSide.indeterminate = someChecked;
      }
      if (chkMapTop) {
        chkMapTop.checked = allChecked;
        chkMapTop.indeterminate = someChecked;
      }
    }

    const chkDxfTop = document.getElementById('chk-coords-dxf');
    const chkDxfSide = document.getElementById('chk-select-all-dxf');
    if (dxfChks.length > 0) {
      const checkedCount = dxfChks.filter(c => c.checked).length;
      const allChecked = (checkedCount === dxfChks.length);
      const someChecked = (checkedCount > 0 && !allChecked);
      if (chkDxfSide) {
        chkDxfSide.checked = allChecked;
        chkDxfSide.indeterminate = someChecked;
      }
      if (chkDxfTop) {
        chkDxfTop.checked = allChecked;
        chkDxfTop.indeterminate = someChecked;
      }
    }

    const chkBothTop = document.getElementById('chk-coords-both');
    const chkBothSide = document.getElementById('chk-select-all-both');
    if (mapChks.length > 0 && dxfChks.length > 0) {
      const mapChecked = mapChks.filter(c => c.checked).length;
      const dxfChecked = dxfChks.filter(c => c.checked).length;
      const allBoth = (mapChecked === mapChks.length && dxfChecked === dxfChks.length);
      const someBoth = ((mapChecked > 0 || dxfChecked > 0) && !allBoth);
      if (chkBothSide) {
        chkBothSide.checked = allBoth;
        chkBothSide.indeterminate = someBoth;
      }
      if (chkBothTop) {
        chkBothTop.checked = allBoth;
        chkBothTop.indeterminate = someBoth;
      }
    }

    // Synchroniser l'état indéterminé / coché pour chaque ligne individuelle
    bothChks.forEach(c => {
      const i = parseInt(c.getAttribute('data-idx'), 10);
      const lyr = (window._lastImportedPointsLayers || [])[i];
      if (lyr) {
        const m = !!lyr._showCoordsMap;
        const d = !!lyr._showCoordsDXF;
        c.checked = (m && d);
        c.indeterminate = (m !== d);
        const lbl = c.closest('label');
        if (lbl) lbl.style.color = (m && d) ? '#9333ea' : ((m || d) ? '#d97706' : '#64748b');
      }
    });
  }
  window.updateSelectAllCheckboxesState = updateSelectAllCheckboxesState;

  /* ── MISE EN VALEUR D'UN SUPPORT DANS LE TABLEAU LATÉRAL GAUCHE ── */
  function highlightPointInSidebar(layer) {
    if (!layer) return;
    const sidebar = document.getElementById('left-sidebar');
    if (sidebar) {
      sidebar.style.display = 'flex';
    }

    if (!window._lastImportedPointsLayers) {
      window._lastImportedPointsLayers = [];
    }
    let idx = window._lastImportedPointsLayers.indexOf(layer);
    if (idx === -1 && (layer._isPole || layer._elementType === 'marker' || layer._elementType === 'bt-support' || layer._elementType === 'mt-support' || layer._elementType === 'btmt-support')) {
      window._lastImportedPointsLayers.push(layer);
      idx = window._lastImportedPointsLayers.length - 1;
      if (window.refreshPointsList) window.refreshPointsList();
    }

    const layerId = (typeof L !== 'undefined' && L.Util && L.Util.stamp) ? L.Util.stamp(layer) : null;
    let el = layerId ? document.querySelector(`.point-item[data-layer-id="${layerId}"]`) : null;
    if (!el && idx !== -1) {
      el = document.querySelector(`.point-item[data-idx="${idx}"]`);
    }

    if (el) {
      // Si masqué par le filtre de recherche, réinitialiser le filtre
      if (el.style.display === 'none') {
        const filterInput = document.getElementById('filter-points-input');
        if (filterInput && filterInput.value) {
          filterInput.value = '';
          document.querySelectorAll('#points-list .point-item').forEach(p => p.style.display = '');
        }
      }

      // Enlever la sélection précédente
      document.querySelectorAll('#points-list .point-item.point-item-selected').forEach(it => {
        it.classList.remove('point-item-selected');
      });

      // Appliquer la mise en surbrillance
      el.classList.add('point-item-selected');
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(err) {
        el.scrollIntoView();
      }
    }
  }
  window.highlightPointInSidebar = highlightPointInSidebar;

  /* Écouteurs pour les cases globales (Topbar et Sidebar) */
  const chkCoordsMap = document.getElementById('chk-coords-map');
  if (chkCoordsMap) {
    chkCoordsMap.addEventListener('change', function() {
      setAllCoordsMap(this.checked);
    });
  }
  const chkSelectAllMap = document.getElementById('chk-select-all-map');
  if (chkSelectAllMap) {
    chkSelectAllMap.addEventListener('change', function() {
      setAllCoordsMap(this.checked);
    });
  }

  const chkCoordsDxf = document.getElementById('chk-coords-dxf');
  if (chkCoordsDxf) {
    chkCoordsDxf.addEventListener('change', function() {
      setAllCoordsDXF(this.checked);
    });
  }
  const chkSelectAllDxf = document.getElementById('chk-select-all-dxf');
  if (chkSelectAllDxf) {
    chkSelectAllDxf.addEventListener('change', function() {
      setAllCoordsDXF(this.checked);
    });
  }

  const chkCoordsBoth = document.getElementById('chk-coords-both');
  if (chkCoordsBoth) {
    chkCoordsBoth.addEventListener('change', function() {
      setAllCoordsBoth(this.checked);
    });
  }
  const chkSelectAllBoth = document.getElementById('chk-select-all-both');
  if (chkSelectAllBoth) {
    chkSelectAllBoth.addEventListener('change', function() {
      setAllCoordsBoth(this.checked);
    });
  }

  /* Écouteurs de clics sur les marqueurs pour ouvrir et afficher dans le tableau Supports/Points */
  drawnItems.on('click', function(e) {
    const l = e.layer;
    if (l instanceof L.Marker && !l._isCoordsMarker && !l._isDistLabel) {
      highlightPointInSidebar(l);
    }
  });

  /* Clic droit sur un support : afficher / masquer instantanément ses coordonnées */
  drawnItems.on('contextmenu', function(e) {
    const l = e.layer;
    if (l instanceof L.Marker && !l._isCoordsMarker && !l._isDistLabel && (l._isPole || l._elementType === 'marker' || l._elementType === 'bt-support' || l._elementType === 'mt-support' || l._elementType === 'btmt-support')) {
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
      }
      toggleSupportCoordsMap(l);
    }
  });

  MAP.on('popupopen', function(e) {
    if (e && e.popup && e.popup._source && (e.popup._source instanceof L.Marker)) {
      highlightPointInSidebar(e.popup._source);
    }
  });

  /* Événement : Sommet ajouté en direct (clic pendant le tracé) */
  MAP.on(L.Draw.Event.DRAWVERTEX, function(e) {
    const isNet = (activeTool === 'bt' || activeTool === 'mt' || activeTool === 'btmt' || activeTool === 'btExt' || activeTool === 'mtExt');
    if (!isNet || !AUTO_POLES_AND_DISTANCES || !currentDrawHandler || !currentDrawHandler._markers) return;

    const markers = currentDrawHandler._markers;
    const count = markers.length;
    const hud = document.getElementById('live-measure-hud');
    if (hud) {
      const pEl = document.getElementById('hud-poles-count');
      if (pEl) pEl.textContent = count;
    }

    // Si on vient d'ajouter le 2e sommet ou plus : afficher la portée sur ce segment
    if (count >= 2) {
      const pPrev = markers[count - 2].getLatLng();
      const pCurr = markers[count - 1].getLatLng();
      const spanDist = pPrev.distanceTo(pCurr);
      const mid = L.latLng((pPrev.lat + pCurr.lat) / 2, (pPrev.lng + pCurr.lng) / 2);
      const netType = (activeTool === 'mt' || activeTool === 'mtExt') ? 'MT' : ((activeTool === 'btmt') ? 'BT_MT' : 'BT');

      const tempLbl = L.marker(mid, {
        icon: createDistanceLabelIcon(spanDist, netType),
        interactive: false
      }).addTo(MAP);
      tempTraceSpanLabels.push(tempLbl);

      let cumDist = 0;
      for (let i = 1; i < count; i++) {
        cumDist += markers[i - 1].getLatLng().distanceTo(markers[i].getLatLng());
      }
      if (hud) {
        const totalEl = document.getElementById('hud-total-dist');
        if (totalEl) totalEl.textContent = formatDistance(cumDist);
        const liveEl = document.getElementById('hud-live-dist');
        if (liveEl) liveEl.textContent = '0.0 m';
      }
    }
  });

  /* Événement : Déplacement souris pour affichage distance live en temps réel */
  MAP.on('mousemove', function(e) {
    if (!currentDrawHandler || !currentDrawHandler._markers || currentDrawHandler._markers.length === 0) return;
    const isNet = (activeTool === 'bt' || activeTool === 'mt' || activeTool === 'btmt' || activeTool === 'btExt' || activeTool === 'mtExt');
    if (!isNet || !AUTO_POLES_AND_DISTANCES) return;

    const markers = currentDrawHandler._markers;
    const lastPt = markers[markers.length - 1].getLatLng();
    const liveDist = lastPt.distanceTo(e.latlng);

    let cumDist = 0;
    for (let i = 1; i < markers.length; i++) {
      cumDist += markers[i - 1].getLatLng().distanceTo(markers[i].getLatLng());
    }
    const total = cumDist + liveDist;

    const liveEl = document.getElementById('hud-live-dist');
    if (liveEl) liveEl.textContent = liveDist.toFixed(1) + ' m';
    const totalEl = document.getElementById('hud-total-dist');
    if (totalEl) totalEl.textContent = formatDistance(total);

    if (currentDrawHandler._tooltip) {
      currentDrawHandler._tooltip.updateContent({
        text: 'Cliquez pour poser un support PBA (Double-clic pour valider)',
        subtext: '📏 Portée live : ' + liveDist.toFixed(1) + ' m  |  Total : ' + formatDistance(total)
      });
    }
  });

  /* Événement : Arrêt ou annulation du dessin */
  MAP.on(L.Draw.Event.DRAWSTOP, function(e) {
    if (tempTraceSpanLabels && tempTraceSpanLabels.length > 0) {
      tempTraceSpanLabels.forEach(m => { try { MAP.removeLayer(m); } catch(err){} });
      tempTraceSpanLabels = [];
    }
    const hud = document.getElementById('live-measure-hud');
    if (hud) hud.classList.add('hidden');
  });

  MAP.on(L.Draw.Event.CREATED, function(e) {
    const layer = e.layer;
    const tool  = activeTool;
    elementCounter++;

    // Nettoyer les étiquettes temporaires live
    if (tempTraceSpanLabels && tempTraceSpanLabels.length > 0) {
      tempTraceSpanLabels.forEach(m => { try { MAP.removeLayer(m); } catch(err){} });
      tempTraceSpanLabels = [];
    }
    const hud = document.getElementById('live-measure-hud');
    if (hud) hud.classList.add('hidden');

    if (tool === 'piste') {
      addDoubleLinePiste(layer);
    } else if (tool === 'route') {
      addDoubleLineRoute(layer);
    } else if (tool === 'piste_pieton') {
      addDoubleLinePistePieton(layer);
    } else if (tool === 'bt' || tool === 'btExt' || tool === 'mt' || tool === 'mtExt' || tool === 'btmt') {
      addNetworkLineWithPoles(layer, tool);
    } else if (tool === 'foyer') {
      let defaultName = 'Foyer #' + elementCounter;
      let name = prompt('Nom / Repere du Foyer (optionnel) :', defaultName);
      if (name === null || !name.trim()) name = defaultName;

      layer._elementType = 'foyer';
      layer._elementId   = elementCounter;
      layer._elementName = name.trim();
      layer._isParallel  = false;

      const lls = layer.getLatLngs()[0] || [];
      let areaStr = '';
      if (L.GeometryUtil && lls.length >= 3) {
        areaStr = '<br>Surface: ' + formatArea(L.GeometryUtil.geodesicArea(lls));
      }
      layer.bindPopup(`<b>${layer._elementName}</b><br>Limite de foyer / batiment${areaStr}`);

      drawnItems.addLayer(layer);
      undoStack.push(layer);
    } else if (tool === 'coord') {
      const ll = layer.getLatLng();
      const epsg = document.getElementById('sel-projection').value;
      const proj = fromWGS84(ll.lat, ll.lng, epsg);

      let textName = prompt("Nom ou Annotation (ex: ABDELKHALEK KASMAOUI - laisser vide pour coordonnees seules) :", "");
      if (textName === null) textName = "";
      textName = textName.trim();

      layer._elementType = 'coord';
      layer._elementId   = elementCounter;
      layer._elementName = textName;
      layer._customTitle = textName;
      layer._isParallel  = false;
      layer._showCoordsMap = true;

      if (layer.dragging) {
        layer.dragging.enable();
        layer.on('drag', function() {
          if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
        });
        layer.on('dragend', function() {
          if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
          updateSupportDisplay(layer);
          const newLl = layer.getLatLng();
          const newProj = fromWGS84(newLl.lat, newLl.lng, epsg);
          if (newProj) {
            setStatus('Position coordonnees mise a jour : X=' + newProj.x.toFixed(2) + ' Y=' + newProj.y.toFixed(2));
          }
        });
      }

      drawnItems.addLayer(layer);
      updateSupportDisplay(layer);
      undoStack.push(layer);
    } else if (tool === 'pba' || tool === 'acier') {
      const isPBA = (tool === 'pba');
      const poleType = isPBA ? 'PBA' : 'P Acier';
      const defaultExample = isPBA ? 'PBA 9/500' : '9/500 ACIER';
      let name = prompt(`Nom du support ${poleType} (ex: 9/500, 1//9 8/500 ACIER...) :`, defaultExample);
      if (name === null) {
        stopCurrentDraw();
        return;
      }
      name = name.trim();
      if (!name) name = defaultExample;

      layer._elementType = 'marker';
      layer._isPole      = true;
      layer._poleType    = poleType;
      layer._networkType = 'BT';
      layer._elementId   = elementCounter;
      layer._elementName = name;
      layer._showCoordsMap = !!window.SHOW_COORDS_MAP;
      layer._showCoordsDXF = !!window.SHOW_COORDS_DXF;
      const numMatch = name.match(/\b(?:N°|#)?(\d+)\b/i);
      if (numMatch) {
        layer._supportNumber = parseInt(numMatch[1], 10);
      }

      layer.setIcon(createPoleIcon(poleType));
      updateSupportDisplay(layer);

      if (layer.dragging) {
        layer.dragging.enable();
        layer.on('drag', function() {
          if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
        });
        layer.on('dragend', function() {
          if (layer._coordsMarker) layer._coordsMarker.setLatLng(layer.getLatLng());
          updateSupportPopup(layer);
          updateSupportDisplay(layer);
          if (window.refreshPointsList) window.refreshPointsList();
          adjustOverlappingTooltips();
          const newLl = layer.getLatLng();
          const epsg = document.getElementById('sel-projection').value;
          const proj = latlon2proj(newLl.lat, newLl.lng, epsg);
          if (proj) {
            setStatus(`Position ${layer._elementName} mise à jour : X=${proj.x.toFixed(3)} Y=${proj.y.toFixed(3)}`);
          }
          if (document.getElementById('chk-altitude')?.checked && typeof fetchElevation === 'function') {
            fetchElevation(newLl.lat, newLl.lng).then(alt => {
              if (alt !== null) {
                layer._altitude = alt;
                updateSupportDisplay(layer);
                updateSupportPopup(layer);
                if (window.refreshPointsList) window.refreshPointsList();
              }
            });
          }
        });
      }

      if (document.getElementById('chk-altitude')?.checked && typeof fetchElevation === 'function') {
        const curLl = layer.getLatLng();
        fetchElevation(curLl.lat, curLl.lng).then(alt => {
          if (alt !== null) {
            layer._altitude = alt;
            updateSupportDisplay(layer);
            updateSupportPopup(layer);
            if (window.refreshPointsList) window.refreshPointsList();
          }
        });
      }

      updateSupportPopup(layer);
      layer.on('click', function() {
        if (typeof highlightPointInSidebar === 'function') {
          highlightPointInSidebar(layer);
        }
      });

      drawnItems.addLayer(layer);
      undoStack.push(layer);
      adjustOverlappingTooltips();

      if (!window._lastImportedPointsLayers) {
        window._lastImportedPointsLayers = [];
      }
      window._lastImportedPointsLayers.push(layer);

      if (window.refreshPointsList) window.refreshPointsList();

      const leftSidebar = document.getElementById('left-sidebar');
      if (leftSidebar) {
        leftSidebar.style.display = 'flex';
      }

      updateElementCount();
      updateInfoPanel();

      setStatus(`Support ${name} (${poleType}) placé. Cliquez pour en ajouter un autre. [Echap] pour terminer.`);

      setTimeout(function() {
        const btnId = isPBA ? 'tool-pba' : 'tool-acier';
        const btn = document.getElementById(btnId);
        if (btn && btn.classList.contains('active')) {
          startDraw(tool);
        }
      }, 80);
      return;
    } else {
      layer._elementType = e.layerType;
      layer._elementId   = elementCounter;
      layer._elementName = getTypeFR(tool || e.layerType) + ' #' + elementCounter;
      layer._isParallel  = false;
      if (e.layerType === 'marker' || e.layerType === 'polygon' || e.layerType === 'circle') {
        layer.bindPopup(buildPopup(layer, tool || e.layerType, elementCounter));
      }
      drawnItems.addLayer(layer);
      undoStack.push(layer);
    }

    updateElementCount();
    updateInfoPanel();

    if (tool === 'coord') {
      /* ── L'outil Coord reste ACTIF : relancer immediatement pour le prochain clic ── */
      setStatus('Coord #' + elementCounter + ' place. Cliquez encore pour un autre point. [Echap] pour terminer.');
      /* Petite pause pour laisser le tooltip s'afficher, puis repartir */
      setTimeout(function() {
        if (/* toujours en mode coord ? */ document.getElementById('tool-coord').classList.contains('active')) {
          startDraw('coord');
        }
      }, 80);
    } else {
      stopCurrentDraw();
      setStatus(getTypeFR(tool || e.layerType) + ' #' + elementCounter + ' ajoute.');
    }
  });

  MAP.on(L.Draw.Event.DELETED, function(e) {
    if (e && e.layers) {
      e.layers.eachLayer(function(l) {
        if (l._coordsMarker) {
          try { drawnItems.removeLayer(l._coordsMarker); } catch(err) {}
          l._coordsMarker = null;
        }
      });
    }
    updateElementCount();
    updateInfoPanel();
    if (window.refreshPointsList) window.refreshPointsList();
    setStatus('Element supprime.');
  });
  MAP.on(L.Draw.Event.EDITED,  function() {
    updateElementCount();
    if (window.refreshPointsList) window.refreshPointsList();
    setStatus('Elements modifies.');
  });
}

/* ─── GESTION MULTI-LIGNES ET SÉPARATION DES ÉTIQUETTES SUPERPOSÉES ─── */
function splitSupportNameLines(rawName) {
  if (!rawName) return [];
  let raw = String(rawName).trim();

  // 1. Découpage explicite sur saut de ligne (\n, \r\n ou \n littéral)
  let parts = raw.split(/\r?\n|\\n/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    // Si la 1ère ligne est un numéro type "23-", "23", "n 23-", etc.
    const m = parts[0].match(/^(?:(?:n|N)[°\.]?\s*|#\s*)?(\d+(?:\s*(?:bis|ter|[a-zA-Z]))?)\s*[-–]?$/i);
    if (m && parts[1]) {
      parts[0] = `n ${m[1]}-`;
    }
    return parts;
  }

  // 2. Découpage support électrique type "23-8/150 pba", "n 23-8/150 pba", "23 - 8/150 pba"
  // Format : [numéro support]-[caractéristiques type 8/150 pba...]
  const mPole = raw.match(/^(?:(?:n|N)[°\.]?\s*|#\s*)?(\d+(?:\s*(?:bis|ter|[a-zA-Z]))?)\s*[-–]\s*(.+)$/i);
  if (mPole) {
    const num = mPole[1].trim();
    const rest = mPole[2].trim();
    return [`n ${num}-`, rest];
  }

  // 3. Découpage intelligent sur équipement secondaire électrique (ex: Pose AD6 + NA2+ Herse Dérivation E=1,3m)
  const regex = /^(.+?\+\s*(?:NA\d*\+?|AD\d*\+?|SC\d*\+?)?)\s+(Herse.*|Dérivation.*|Derivation.*|Arr[êe]t.*|Alignement.*|Transfo.*|IACM.*)$/i;
  const match = raw.match(regex);
  if (match) {
    return [match[1].trim(), match[2].trim()];
  }

  // 4. Autre séparateur type "+ Herse"
  const regexPlus = /^(.+?\+)\s*(Herse.*|Dérivation.*|Derivation.*|Arr[êe]t.*|Alignement.*|Transfo.*|IACM.*)$/i;
  const matchPlus = raw.match(regexPlus);
  if (matchPlus) {
    return [matchPlus[1].trim(), matchPlus[2].trim()];
  }

  return [raw];
}
window.splitSupportNameLines = splitSupportNameLines;

/**
 * 1. Titre / Désignation du support affiché EN HAUT du point (direction: 'top')
 */
function formatSupportTopLabelHtml(layer) {
  const name = layer._elementName || layer._customTitle || '';
  if (!name) return '';
  let lines = splitSupportNameLines(name);

  // Si la 1ère ligne est déjà un numéro explicite type "n 23-", ne pas dupliquer avec le badge N°
  const hasExplicitNumLine = lines.length > 0 && /^n\s*\d+[-]/i.test(lines[0]);

  if (hasExplicitNumLine) {
    lines[0] = `<span class="pole-num-line">${lines[0]}</span>`;
  } else {
    // Pour les tracés réseau manuels : afficher le badge N° si activé
    // Pour les imports KML / DXF : afficher le titre intact
    const supNum = layer._supportNumber;
    const isImported = !!layer._isImportedKML || !!layer._isImported;
    const showSupNum = (layer._showSupportNumber === true || (!isImported && layer._showSupportNumber !== false)) && (supNum !== undefined && supNum !== null && supNum !== '');
    if (showSupNum) {
      // Filtrer les étiquettes réseau automatiques pour ne pas dupliquer le N°
      lines = lines.filter(line => {
        const l = line.replace(/<[^>]*>/g, '').trim();
        if (/^(N°|#|\bN\b|\bN\d+)\s*\d*/i.test(l)) return false;
        if (/^(?:(?:PBA|ACIER)\s+)?(?:MT|BT|BTMT|Support|Element)\s*#?\d+$/i.test(l)) return false;
        return true;
      });
      lines.unshift(`<span class="pole-order-badge">N°${supNum}</span>`);
    }
  }

  return lines.join('<br>');
}
window.formatSupportTopLabelHtml = formatSupportTopLabelHtml;

/**
 * 2. Détecte si les coordonnées doivent être affichées sur la carte
 */
function shouldShowSupportMapCoords(layer) {
  if (!layer) return false;
  if (layer._showCoordsMap === false) return false;
  if (layer._showCoordsMap === true) return true;
  const chkGlobalMap = document.getElementById('chk-coords-map');
  return (chkGlobalMap && chkGlobalMap.checked) || !!window.SHOW_COORDS_MAP;
}
window.shouldShowSupportMapCoords = shouldShowSupportMapCoords;

/**
 * 3. Coordonnées X / Y (et Altitude) affichées EN BAS du point (direction: 'bottom')
 */
function formatSupportBottomCoordsHtml(layer) {
  if (!layer || !layer.getLatLng) return '';
  const ll = layer.getLatLng();
  const selProj = document.getElementById('sel-projection');
  const epsg = selProj ? selProj.value : 'EPSG:26191';
  const proj = latlon2proj(ll.lat, ll.lng, epsg);
  if (!proj) return '';

  const parts = [
    `X=${proj.x.toFixed(2)}`,
    `Y=${proj.y.toFixed(2)}`
  ];

  // Altitude si cochée
  const chkAlt = document.getElementById('chk-altitude');
  const showAlt = (chkAlt && chkAlt.checked) || (window.SHOW_ALTITUDE !== false && chkAlt?.checked);
  if (showAlt && layer._altitude !== undefined && layer._altitude !== null && layer._altitude !== '') {
    const altVal = (typeof layer._altitude === 'number') ? layer._altitude.toFixed(1) : layer._altitude;
    parts.push(`<span style="color:#2ecc71;">Alt=${altVal}m</span>`);
  }

  return parts.join('<br>');
}
window.formatSupportBottomCoordsHtml = formatSupportBottomCoordsHtml;

/**
 * 4. Met à jour l'affichage sur la carte :
 *    - Titre EN HAUT du point (offset [0, -8])
 *    - Coordonnées EN BAS du point (offset [0, 8])
 */
function updateSupportDisplay(layer) {
  if (!layer || !(layer instanceof L.Marker) || layer._isCoordsMarker || layer._isDistLabel) return;

  // 1. Titre EN HAUT du point
  const topHtml = formatSupportTopLabelHtml(layer);
  if (topHtml) {
    const existing = layer.getTooltip();
    if (existing && existing.options.direction === 'top') {
      layer.setTooltipContent(topHtml);
    } else {
      if (existing) layer.unbindTooltip();
      layer.bindTooltip(topHtml, {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'kml-label kml-label-top'
      });
    }
  } else if (layer.getTooltip()) {
    layer.unbindTooltip();
  }

  // 2. Coordonnées EN BAS du point
  const showCoords = shouldShowSupportMapCoords(layer);
  const bottomHtml = showCoords ? formatSupportBottomCoordsHtml(layer) : '';

  if (bottomHtml) {
    if (!layer._coordsMarker) {
      layer._coordsMarker = L.marker(layer.getLatLng(), {
        icon: L.divIcon({ className: 'coords-anchor-div', html: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
        interactive: false
      });
      layer._coordsMarker._isCoordsMarker = true;
      layer._coordsMarker._parentPole = layer;
      drawnItems.addLayer(layer._coordsMarker);
    } else {
      layer._coordsMarker.setLatLng(layer.getLatLng());
      if (!drawnItems.hasLayer(layer._coordsMarker)) {
        drawnItems.addLayer(layer._coordsMarker);
      }
    }

    const existingBottom = layer._coordsMarker.getTooltip();
    if (existingBottom && existingBottom.options.direction === 'bottom') {
      layer._coordsMarker.setTooltipContent(bottomHtml);
    } else {
      if (existingBottom) layer._coordsMarker.unbindTooltip();
      layer._coordsMarker.bindTooltip(bottomHtml, {
        permanent: true,
        direction: 'bottom',
        offset: [0, 8],
        className: 'kml-coords-label kml-coords-bottom'
      });
    }
  } else {
    if (layer._coordsMarker) {
      try {
        if (layer._coordsMarker.unbindTooltip) layer._coordsMarker.unbindTooltip();
        if (drawnItems && drawnItems.hasLayer && drawnItems.hasLayer(layer._coordsMarker)) {
          drawnItems.removeLayer(layer._coordsMarker);
        }
        if (typeof MAP !== 'undefined' && MAP && MAP.hasLayer && MAP.hasLayer(layer._coordsMarker)) {
          MAP.removeLayer(layer._coordsMarker);
        }
      } catch(e){}
      layer._coordsMarker = null;
    }
  }
}
window.updateSupportDisplay = updateSupportDisplay;

function formatSupportTooltipText(layer) {
  updateSupportDisplay(layer);
  return formatSupportTopLabelHtml(layer);
}
window.formatSupportTooltipText = formatSupportTooltipText;

function adjustOverlappingTooltips() {
  const allMarkers = [];
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel && (layer._isPole || layer._elementType === 'marker' || layer._elementType === 'bt-support' || layer._elementType === 'mt-support' || layer._elementType === 'btmt-support')) {
      allMarkers.push(layer);
    }
  });

  const groups = [];
  allMarkers.forEach(m => {
    const ll = m.getLatLng();
    let found = false;
    for (const g of groups) {
      if (ll.distanceTo(g.center) < 1.0) {
        g.markers.push(m);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ center: ll, markers: [m] });
    }
  });

  groups.forEach(g => {
    if (g.markers.length === 1) {
      updateSupportDisplay(g.markers[0]);
    } else {
      // 1er support : Standard (Haut / Bas)
      updateSupportDisplay(g.markers[0]);

      // 2nd support : Décalé pour éviter la superposition
      const m2 = g.markers[1];
      const topHtml2 = formatSupportTopLabelHtml(m2);
      if (topHtml2) {
        if (m2.getTooltip()) m2.unbindTooltip();
        m2.bindTooltip(topHtml2, {
          permanent: true,
          direction: 'left',
          offset: [-12, -4],
          className: 'kml-label kml-label-left'
        });
      }
      if (shouldShowSupportMapCoords(m2)) {
        const bottomHtml2 = formatSupportBottomCoordsHtml(m2);
        if (bottomHtml2) {
          if (!m2._coordsMarker) {
            m2._coordsMarker = L.marker(m2.getLatLng(), {
              icon: L.divIcon({ className: 'coords-anchor-div', html: '', iconSize: [0, 0], iconAnchor: [0, 0] }),
              interactive: false
            });
            m2._coordsMarker._isCoordsMarker = true;
            m2._coordsMarker._parentPole = m2;
            drawnItems.addLayer(m2._coordsMarker);
          }
          m2._coordsMarker.bindTooltip(bottomHtml2, {
            permanent: true,
            direction: 'left',
            offset: [-12, 10],
            className: 'kml-coords-label kml-coords-bottom'
          });
        }
      } else if (m2._coordsMarker) {
        try {
          if (m2._coordsMarker.unbindTooltip) m2._coordsMarker.unbindTooltip();
          if (drawnItems && drawnItems.hasLayer && drawnItems.hasLayer(m2._coordsMarker)) {
            drawnItems.removeLayer(m2._coordsMarker);
          }
          if (typeof MAP !== 'undefined' && MAP && MAP.hasLayer && MAP.hasLayer(m2._coordsMarker)) {
            MAP.removeLayer(m2._coordsMarker);
          }
        } catch(e){}
        m2._coordsMarker = null;
      }

      // 3ème ou plus : en haut / bas décalé
      for (let i = 2; i < g.markers.length; i++) {
        const mi = g.markers[i];
        const dir = (i % 2 === 0) ? 'right' : 'bottom';
        const off = (i % 2 === 0) ? [12, 0] : [0, 16];
        const topHtmlI = formatSupportTopLabelHtml(mi);
        if (topHtmlI) {
          if (mi.getTooltip()) mi.unbindTooltip();
          mi.bindTooltip(topHtmlI, {
            permanent: true,
            direction: dir,
            offset: off,
            className: 'kml-label'
          });
        }
      }
    }
  });
}
window.adjustOverlappingTooltips = adjustOverlappingTooltips;

/* ─── GESTION POPUP ET SUPPRESSION DES SUPPORTS (PBA / ACIER) ─────────── */
function updateSupportPopup(layer) {
  const ll = layer.getLatLng();
  const epsg = document.getElementById('sel-projection').value;
  const proj = latlon2proj(ll.lat, ll.lng, epsg);
  const poleType = layer._poleType || (
    (layer._elementName || '').toLowerCase().includes('acier') ? 'P Acier' : 'PBA'
  );
  layer._poleType = poleType;
  const netType = layer._networkType || 'BT';
  layer._networkType = netType;
  const name = layer._elementName || 'Support';
  const isAcier = (poleType === 'P Acier');
  const typeLabel = isAcier ? 'ACIER' : 'PBA';
  const hasTypeInName = /^(PBA|P\s*Acier|ACIER)\b/i.test((layer._elementName || '').trim());

  const supNum = (layer._supportNumber !== undefined && layer._supportNumber !== null) ? layer._supportNumber : '';
  const showSupNum = (layer._showSupportNumber !== false);
  const showCoordsMap = shouldShowSupportMapCoords(layer);
  const showCoordsDxf = !!layer._showCoordsDXF;

  const xStr = proj ? proj.x.toFixed(3) : '--';
  const yStr = proj ? proj.y.toFixed(3) : '--';
  const safeNameInput = String(name).replace(/"/g, '&quot;');

  const html = `
    <div class="pole-popup-box" style="font-family:'Segoe UI',sans-serif;min-width:245px;max-width:295px;">
      <!-- Ligne N° de Support (Ordre sur la ligne) -->
      <div style="font-size:11px;color:#333;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:3px 7px;border-radius:4px;border:1px solid #e2e8f0;">
        <label style="display:flex;align-items:center;gap:6px;font-weight:700;color:#1e3a8a;cursor:pointer;margin:0;user-select:none;" title="Cocher pour afficher le N° d'ordre du support sur la carte et dans le DXF">
          <input type="checkbox" class="pole-chk-show-num" ${showSupNum ? 'checked' : ''} style="cursor:pointer;" />
          <span>N° Support (Ordre) :</span>
        </label>
        <div style="display:flex;align-items:center;gap:3px;">
          <span style="font-weight:800;color:#1e3a8a;">N°</span>
          <input type="number" class="pole-input-num" value="${supNum}" style="width:48px;padding:2px 4px;font-weight:700;border:1px solid #cbd5e1;border-radius:3px;text-align:center;font-size:11px;" min="1" placeholder="-" />
        </div>
      </div>

      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <span style="font-size:11px;font-weight:700;color:#475569;">
            <i class="fa fa-pen" style="color:#3498db;"></i> Nom (1 ou 2 lignes) :
          </span>
          <div style="display:flex;gap:3px;">
            <button class="pole-btn-split" style="font-size:10px;padding:2px 5px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:3px;cursor:pointer;font-weight:600;color:#0f172a;" title="Couper automatiquement en 2 lignes (ex: Armement + Herse Dérivation)">
              ⚡ 2 lignes
            </button>
            <button class="pole-btn-join" style="font-size:10px;padding:2px 5px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:3px;cursor:pointer;font-weight:600;color:#0f172a;" title="Remettre sur une seule ligne">
              ↔️ 1 ligne
            </button>
          </div>
        </div>
        <textarea class="pole-popup-textarea" rows="3" style="width:100%;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;font-weight:700;font-size:12px;color:#c0392b;border:1.5px solid #cbd5e1;border-radius:4px;padding:4px 6px;resize:vertical;line-height:1.3;background:#fff;" placeholder="Ligne 1&#10;Ligne 2">${safeNameInput}</textarea>
      </div>

      <div style="font-size:11px;color:#333;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <span><b>Type :</b> ${isAcier ? '● P Acier' : '■ PBA'}</span>
        <button class="pole-btn-toggle" style="padding:2px 6px;font-size:10.5px;border:1px solid #f39c12;background:#fef3c7;color:#b45309;border-radius:3px;cursor:pointer;font-weight:600;">
          🔄 ${isAcier ? 'Passer en PBA' : 'Passer en Acier'}
        </button>
      </div>

      <div style="font-size:11px;color:#333;margin-bottom:6px;display:flex;align-items:center;background:#f8fafc;padding:3px 7px;border-radius:4px;border:1px solid #e2e8f0;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;font-size:11px;color:#1e293b;user-select:none;margin:0;">
          <input type="checkbox" class="pole-chk-show-type" ${hasTypeInName ? 'checked' : ''} style="cursor:pointer;" />
          <span>Afficher <b>${typeLabel}</b> dans le nom</span>
        </label>
      </div>

      <!-- Coordonnées X / Y avec choix Map, DXF et Tous -->
      <div style="font-size:11px;margin-bottom:6px;background:${(showCoordsMap || showCoordsDxf) ? '#f0fdf4' : '#f8fafc'};padding:6px 8px;border-radius:4px;border:1.5px solid ${(showCoordsMap || showCoordsDxf) ? '#86efac' : '#cbd5e1'};">
        <div style="font-weight:700;color:#0f172a;margin-bottom:5px;display:flex;align-items:center;justify-content:space-between;">
          <span style="display:flex;align-items:center;gap:4px;">
            <i class="fa fa-crosshairs" style="color:#0284c7;"></i> Coordonnées X/Y :
          </span>
          <span style="font-size:9.5px;padding:1px 5px;border-radius:3px;font-weight:700;background:${showCoordsMap ? '#e0f2fe' : '#f1f5f9'};color:${showCoordsMap ? '#0284c7' : '#94a3b8'};">
            ${showCoordsMap ? '✓ VISIBLE CARTE' : 'MASQUÉ CARTE'}
          </span>
        </div>

        <!-- BOUTON D'ACTION DIRECT : AFFICHER / MASQUER COORDONNÉES DE CE POINT -->
        <button type="button" class="pole-btn-toggle-coords-map" style="width:100%;margin-bottom:6px;padding:6px 8px;font-size:11px;font-weight:700;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;border:1.5px solid ${showCoordsMap ? '#0284c7' : '#94a3b8'};background:${showCoordsMap ? '#0284c7' : '#ffffff'};color:${showCoordsMap ? '#ffffff' : '#334155'};box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="Cliquer pour afficher ou masquer immédiatement les coordonnées X/Y sous ce support sur la carte">
          <i class="fa ${showCoordsMap ? 'fa-eye' : 'fa-eye-slash'}"></i>
          <span>${showCoordsMap ? 'Coordonnées VISIBLES (Cliquer pour masquer)' : '📍 Afficher coordonnées de CE point sur carte'}</span>
        </button>

        <div style="display:flex;gap:12px;margin-bottom:4px;align-items:center;background:#fff;padding:3px 6px;border-radius:3px;border:1px solid #e2e8f0;">
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-weight:700;color:${showCoordsMap ? '#0284c7' : '#64748b'};user-select:none;margin:0;" title="Afficher coordonnées X/Y sous le support sur la carte">
            <input type="checkbox" class="pole-chk-coords-map" ${showCoordsMap ? 'checked' : ''} style="cursor:pointer;" />
            <span>Map</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-weight:700;color:${showCoordsDxf ? '#16a34a' : '#64748b'};user-select:none;margin:0;" title="Exporter les coordonnées X et Y de ce support dans le fichier DXF">
            <input type="checkbox" class="pole-chk-coords-dxf" ${showCoordsDxf ? 'checked' : ''} style="cursor:pointer;" />
            <span>DXF</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-weight:700;color:${(showCoordsMap && showCoordsDxf) ? '#9333ea' : '#64748b'};user-select:none;margin:0;" title="Activer / désactiver coordonnées à la fois sur Map et DXF">
            <input type="checkbox" class="pole-chk-coords-both" ${(showCoordsMap && showCoordsDxf) ? 'checked' : ''} style="cursor:pointer;" />
            <span>Tous</span>
          </label>
        </div>

        <div style="font-size:10.5px;font-family:Consolas,monospace;color:#64748b;display:flex;justify-content:space-between;padding-top:3px;border-top:1px dashed #cbd5e1;">
          <span><b>X:</b> ${xStr}</span>
          <span><b>Y:</b> ${yStr}</span>
          ${(layer._altitude !== undefined && layer._altitude !== null && layer._altitude !== '') ? `<span style="color:#16a34a;"><b>Z:</b> ${(typeof layer._altitude === 'number' ? layer._altitude.toFixed(1) : layer._altitude)} m</span>` : ''}
        </div>
      </div>

      <div style="font-size:11.5px;color:#333;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <b>Réseau :</b>
        <div style="display:inline-flex;border-radius:4px;overflow:hidden;border:1px solid #cbd5e1;font-size:11px;">
          <button class="pole-net-btn" data-net="BT" style="padding:2px 7px;border:none;background:${netType==='BT'?'#e74c3c':'#f8fafc'};color:${netType==='BT'?'#fff':'#333'};cursor:pointer;font-weight:700;">BT</button>
          <button class="pole-net-btn" data-net="MT" style="padding:2px 7px;border:none;border-left:1px solid #cbd5e1;background:${netType==='MT'?'#8e44ad':'#f8fafc'};color:${netType==='MT'?'#fff':'#333'};cursor:pointer;font-weight:700;">MT</button>
          <button class="pole-net-btn" data-net="BT_MT" style="padding:2px 7px;border:none;border-left:1px solid #cbd5e1;background:${netType==='BT_MT'?'#00b4d8':'#f8fafc'};color:${netType==='BT_MT'?'#fff':'#333'};cursor:pointer;font-weight:700;">BT+MT</button>
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:5px;">
        <button class="pole-btn-continue" style="flex:1;padding:5px 8px;font-size:11px;border:1px solid #0284c7;background:#e0f2fe;color:#0369a1;border-radius:4px;cursor:pointer;font-weight:700;" title="Continuer le tracé de la ligne depuis ce support">
          ⚡ Continuer le tracé (${netType})
        </button>
      </div>

      <div style="display:flex;gap:4px;">
        <button class="pole-btn-delete" style="flex:1;padding:4px 8px;font-size:11px;border:1px solid #ef4444;background:#fee2e2;color:#b91c1c;border-radius:3px;cursor:pointer;font-weight:600;" title="Supprimer ce support">
          🗑️ Supprimer ce support
        </button>
      </div>
    </div>
  `;

  const popup = (typeof layer.getPopup === 'function') ? layer.getPopup() : null;
  const isAlreadyOpen = !!(popup && popup.isOpen && popup.isOpen());

  function setupPopupListeners(popupEl) {
    if (!popupEl) return;

    if (typeof highlightPointInSidebar === 'function') {
      highlightPointInSidebar(layer);
    }

    // Bouton d'action direct : Afficher / Masquer coordonnées de ce point
    const btnToggleCoords = popupEl.querySelector('.pole-btn-toggle-coords-map');
    if (btnToggleCoords) {
      btnToggleCoords.onclick = function(ev) {
        ev.stopPropagation();
        if (typeof toggleSupportCoordsMap === 'function') {
          toggleSupportCoordsMap(layer);
        }
      };
    }

    const textarea = popupEl.querySelector('.pole-popup-textarea');
    const chkShowType = popupEl.querySelector('.pole-chk-show-type');
    const chkCoordsMapEl = popupEl.querySelector('.pole-chk-coords-map');
    const chkCoordsDxfEl = popupEl.querySelector('.pole-chk-coords-dxf');
    const chkCoordsBothEl = popupEl.querySelector('.pole-chk-coords-both');
    const chkShowNum = popupEl.querySelector('.pole-chk-show-num');
    const inputNum = popupEl.querySelector('.pole-input-num');

    // Case à cocher : Coordonnées Tous (Map + DXF) dans le popup
    if (chkCoordsBothEl) {
      chkCoordsBothEl.indeterminate = (layer._showCoordsMap !== layer._showCoordsDXF);
      chkCoordsBothEl.onchange = function(ev) {
        ev.stopPropagation();
        const val = this.checked;
        layer._showCoordsMap = val;
        layer._showCoordsDXF = val;
        if (chkCoordsMapEl) chkCoordsMapEl.checked = val;
        if (chkCoordsDxfEl) chkCoordsDxfEl.checked = val;
        if (typeof updateSupportDisplay === 'function') {
          updateSupportDisplay(layer);
        } else if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        updateSupportPopup(layer);
        if (window.refreshPointsList) window.refreshPointsList();
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      };
    }

    // Case à cocher : Coordonnées sur Map
    if (chkCoordsMapEl) {
      chkCoordsMapEl.onchange = function(ev) {
        ev.stopPropagation();
        layer._showCoordsMap = this.checked;
        if (typeof updateSupportDisplay === 'function') {
          updateSupportDisplay(layer);
        } else if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        updateSupportPopup(layer);
        if (window.refreshPointsList) window.refreshPointsList();
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      };
    }

    // Case à cocher : Coordonnées sur DXF
    if (chkCoordsDxfEl) {
      chkCoordsDxfEl.onchange = function(ev) {
        ev.stopPropagation();
        layer._showCoordsDXF = this.checked;
        updateSupportPopup(layer);
        if (window.refreshPointsList) window.refreshPointsList();
        if (typeof updateSelectAllCheckboxesState === 'function') updateSelectAllCheckboxesState();
      };
    }

    // N° de Support (Ordre)
    if (chkShowNum) {
      chkShowNum.onchange = function(ev) {
        ev.stopPropagation();
        layer._showSupportNumber = this.checked;
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
      };
    }
    if (inputNum) {
      inputNum.oninput = function(ev) {
        const val = parseInt(this.value, 10);
        layer._supportNumber = isNaN(val) ? '' : val;
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
      };
    }

    if (textarea) {
      // Prevent Leaflet / parent from intercepting Enter key — let browser insert newline naturally
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.stopPropagation();
          // default browser behavior: insert \n in textarea
        }
      });
      textarea.addEventListener('input', function() {
        const val = textarea.value;
        layer._elementName = val;
        if (chkShowType) {
          chkShowType.checked = /^(PBA|P\s*Acier|ACIER)\b/i.test(val.trim());
        }
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
        adjustOverlappingTooltips();
      });
    }

    // Case à cocher : Afficher PBA ou ACIER dans le nom
    if (chkShowType && textarea) {
      chkShowType.onchange = function(ev) {
        ev.stopPropagation();
        const pType = (layer._poleType === 'P Acier') ? 'ACIER' : 'PBA';
        let val = textarea.value;
        if (this.checked) {
          if (!/^(PBA|P\s*Acier|ACIER)\b/i.test(val.trim())) {
            val = `${pType} ${val.trimStart()}`;
          }
        } else {
          val = val.replace(/^(PBA|P\s*Acier|ACIER)\s*/i, '');
        }
        textarea.value = val;
        layer._elementName = val;
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
        adjustOverlappingTooltips();
      };
    }

    const btnSplit = popupEl.querySelector('.pole-btn-split');
    if (btnSplit && textarea) {
      btnSplit.onclick = function(ev) {
        ev.stopPropagation();
        const curVal = textarea.value.trim();
        const splitted = splitSupportNameLines(curVal);
        const newVal = splitted.join('\n');
        textarea.value = newVal;
        layer._elementName = newVal;
        if (chkShowType) {
          chkShowType.checked = /^(PBA|P\s*Acier|ACIER)\b/i.test(newVal.trim());
        }
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
        adjustOverlappingTooltips();
      };
    }

    const btnJoin = popupEl.querySelector('.pole-btn-join');
    if (btnJoin && textarea) {
      btnJoin.onclick = function(ev) {
        ev.stopPropagation();
        const curVal = textarea.value.trim();
        const newVal = curVal.replace(/\r?\n+/g, ' ');
        textarea.value = newVal;
        layer._elementName = newVal;
        if (chkShowType) {
          chkShowType.checked = /^(PBA|P\s*Acier|ACIER)\b/i.test(newVal.trim());
        }
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }
        if (window.refreshPointsList) window.refreshPointsList();
        adjustOverlappingTooltips();
      };
    }

    // Boutons Réseau (BT / MT / BT+MT)
    popupEl.querySelectorAll('.pole-net-btn').forEach(function(btn) {
      btn.onclick = function(ev) {
        ev.stopPropagation();
        const selectedNet = this.getAttribute('data-net');
        layer._networkType = selectedNet;
        updateSupportPopup(layer);
        layer.openPopup();
        if (window.refreshPointsList) window.refreshPointsList();
      };
    });

    // Bouton Toggle Type (PBA <=> P Acier)
    const btnToggle = popupEl.querySelector('.pole-btn-toggle');
    if (btnToggle) {
      btnToggle.onclick = function(ev) {
        ev.stopPropagation();
        const nextType = (layer._poleType === 'PBA') ? 'P Acier' : 'PBA';
        const nextLabel = (nextType === 'PBA') ? 'PBA' : 'ACIER';
        layer._poleType = nextType;
        layer.setIcon(createPoleIcon(nextType));

        let cur = (layer._elementName || '').trim();
        const hadType = /^(PBA|P\s*Acier|ACIER)\b/i.test(cur);
        const chk = popupEl.querySelector('.pole-chk-show-type');
        const shouldShow = (chk && chk.checked) || hadType;

        if (shouldShow) {
          cur = cur.replace(/^(PBA|P\s*Acier|ACIER)\s+/i, '');
          const updated = `${nextLabel} ${cur}`;
          layer._elementName = updated;
        }
        if (layer.getTooltip && layer.getTooltip()) {
          layer.setTooltipContent(formatSupportTooltipText(layer));
        }

        updateSupportPopup(layer);
        layer.openPopup();
        if (window.refreshPointsList) window.refreshPointsList();
        adjustOverlappingTooltips();
      };
    }

    // Bouton Continuer le tracé depuis ce support
    const btnContinue = popupEl.querySelector('.pole-btn-continue');
    if (btnContinue) {
      btnContinue.onclick = function(ev) {
        ev.stopPropagation();
        layer.closePopup();
        const net = (layer._networkType === 'MT') ? 'mt' : ((layer._networkType === 'BT_MT') ? 'btmt' : 'bt');
        continueTraceFromSupport(layer, net);
      };
    }

    // Bouton Supprimer
    const btnDel = popupEl.querySelector('.pole-btn-delete');
    if (btnDel) {
      btnDel.onclick = function(ev) {
        ev.stopPropagation();
        if (confirm(`Voulez-vous vraiment supprimer le support "${layer._elementName || 'Support'}" ?`)) {
          deleteSupportPoint(layer);
        }
      };
    }
  }

  if (isAlreadyOpen) {
    popup.setContent(html);
    const pEl = (popup.getElement) ? popup.getElement() : null;
    if (pEl) setupPopupListeners(pEl);
  } else {
    layer.bindPopup(html);
  }

  layer.off('popupopen');
  layer.on('popupopen', function() {
    const popupEl = layer.getPopup() ? layer.getPopup().getElement() : null;
    setupPopupListeners(popupEl);
  });
}
window.updateSupportPopup = updateSupportPopup;

/* ─── CONTINUER LE TRACÉ DEPUIS UN SUPPORT EXISTANT (CONTINUITÉ) ─────── */
function continueTraceFromSupport(marker, net) {
  if (!marker || !marker.getLatLng) return;
  const targetTool = net || (marker._networkType === 'MT' ? 'mt' : (marker._networkType === 'BT_MT' ? 'btmt' : 'bt'));
  startDraw(targetTool);
  setTimeout(function() {
    if (currentDrawHandler && typeof currentDrawHandler.addVertex === 'function') {
      currentDrawHandler.addVertex(marker.getLatLng());
      if (typeof setStatus === 'function') {
        setStatus(`⚡ Tracé ${targetTool.toUpperCase()} démarré depuis ${marker._elementName || 'support'}. Cliquez pour poser le support suivant.`);
      }
    }
  }, 80);
}
window.continueTraceFromSupport = continueTraceFromSupport;

function deleteSupportPoint(layer) {
  if (!layer) return;
  if (layer._coordsMarker) {
    try { drawnItems.removeLayer(layer._coordsMarker); } catch(e){}
    layer._coordsMarker = null;
  }
  drawnItems.removeLayer(layer);
  undoStack = undoStack.filter(l => l !== layer && l._elementId !== layer._elementId);

  if (window._lastImportedPointsLayers) {
    window._lastImportedPointsLayers = window._lastImportedPointsLayers.filter(l => l !== layer);
  }

  if (window.refreshPointsList) window.refreshPointsList();
  adjustOverlappingTooltips();
  updateElementCount();
  updateInfoPanel();
  setStatus(`Support ${layer._elementName || ''} supprimé.`);
}
window.deleteSupportPoint = deleteSupportPoint;

/* ─── VOIES & PISTES : POPUP & MODIFICATION DE LARGEUR EN DIRECT ─── */
function bindRoadPopup(layer, type, groupId, width, centerline) {
  const isRoute = (type === 'route');
  const isPiste = (type === 'piste');
  const typeName = isRoute ? 'Route' : (isPiste ? 'Piste' : 'Piste Piétons');
  const badgeColor = isRoute ? '#27ae60' : (isPiste ? '#e67e22' : '#8e44ad');
  const icon = isRoute ? 'fa-road' : (isPiste ? 'fa-person-hiking' : 'fa-person-walking');
  const len = getPolylineLength(centerline || layer.getLatLngs());
  const lenStr = formatDistance(len);

  const html = `
    <div style="font-size:13px;min-width:180px;line-height:1.5;">
      <div style="font-weight:700;color:${badgeColor};margin-bottom:4px;">
        <i class="fa ${icon}"></i> ${typeName} #${groupId}
      </div>
      <div style="padding:4px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;font-size:12px;">
        <div><b>Largeur :</b> <span style="font-weight:bold;color:${badgeColor};">${width} m</span></div>
        <div><b>Longueur axe :</b> ${lenStr}</div>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;">
        <button onclick="changeTrackWidth(${groupId})" style="flex:1;background:#3498db;color:#fff;border:none;padding:4px 6px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600;">
          <i class="fa fa-arrows-left-right"></i> Modifier Largeur
        </button>
        <button onclick="deleteTrackGroup(${groupId})" style="background:#e74c3c;color:#fff;border:none;padding:4px 7px;border-radius:3px;cursor:pointer;font-size:11px;" title="Supprimer la voie">
          <i class="fa fa-trash"></i>
        </button>
      </div>
    </div>
  `;
  layer.bindPopup(html);
}

window.changeTrackWidth = function(groupId) {
  let target1 = null, target2 = null;
  drawnItems.eachLayer(l => {
    if (l._groupId === groupId) {
      if (!target1) target1 = l;
      else if (!target2) target2 = l;
    }
  });
  if (!target1) return;
  const type = target1._elementType || 'route';
  const currentW = target1._widthMeters || (type === 'route' ? CURRENT_ROUTE_WIDTH : (type === 'piste' ? CURRENT_PISTE_WIDTH : CURRENT_PIETON_WIDTH));
  const minW = type === 'route' ? 8 : (type === 'piste' ? 2 : 1);
  const maxW = type === 'route' ? 30 : (type === 'piste' ? 8 : 3);
  const val = prompt(`Nouvelle largeur en mètres pour ${getTypeFR(type)} #${groupId} (entre ${minW}m et ${maxW}m) :`, currentW);
  if (val === null) return;
  const newW = parseFloat(val);
  if (isNaN(newW) || newW <= 0) {
    alert("Veuillez saisir une largeur valide en mètres.");
    return;
  }
  const centerline = target1._centerlineVertices || target1._routeVertices || target1._pisteVertices;
  if (!centerline) {
    alert("Impossible de recalculer : axe d'origine non disponible.");
    return;
  }
  const halfGap = newW / 2;
  const ll1 = computeParallelLatLngs(centerline, +halfGap);
  const ll2 = computeParallelLatLngs(centerline, -halfGap);
  target1.setLatLngs(ll1);
  target1._widthMeters = newW;
  if (target2) {
    target2.setLatLngs(ll2);
    target2._widthMeters = newW;
  }
  bindRoadPopup(target1, type, groupId, newW, centerline);
  if (target2) bindRoadPopup(target2, type, groupId, newW, centerline);
  setStatus(`${getTypeFR(type)} #${groupId} : Largeur mise à jour à ${newW} m.`);
};

window.deleteTrackGroup = function(groupId) {
  const toRemove = [];
  drawnItems.eachLayer(l => {
    if (l._groupId === groupId) toRemove.push(l);
  });
  toRemove.forEach(l => {
    try { drawnItems.removeLayer(l); } catch(e){}
  });
  updateElementCount();
  updateInfoPanel();
  setStatus(`Voie #${groupId} supprimée.`);
};

/* ─── DOUBLE LIGNE PISTE PIÉTONS (1m à 2m - POINTILLÉS PARALLÈLES) ─── */
function addDoubleLinePistePieton(mainLayer) {
  const lls       = mainLayer.getLatLngs();
  const groupId   = elementCounter;
  const width     = CURRENT_PIETON_WIDTH || 1.5;
  const halfGap   = width / 2;

  const styleMain = {
    color: STYLES.pistePietonColor || '#8e44ad',
    weight: 3.5,
    opacity: 0.95,
    dashArray: '1, 7',
    lineCap: 'round',
    lineJoin: 'round'
  };
  const stylePar  = {
    color: STYLES.pistePietonColor || '#8e44ad',
    weight: 3.5,
    opacity: 0.95,
    dashArray: '1, 7',
    lineCap: 'round',
    lineJoin: 'round'
  };

  // Ligne 1 (offset +halfGap)
  const ll1 = computeParallelLatLngs(lls, +halfGap);
  const l1  = L.polyline(ll1, styleMain);
  l1._elementType = 'piste_pieton';
  l1._elementId   = elementCounter;
  l1._elementName = 'Piste Piétons #' + groupId;
  l1._groupId     = groupId;
  l1._isParallel  = false;
  l1._centerlineVertices = lls;
  l1._pisteVertices = lls;
  l1._widthMeters = width;
  drawnItems.addLayer(l1);
  undoStack.push(l1);

  // Ligne 2 (offset -halfGap)
  elementCounter++;
  const ll2 = computeParallelLatLngs(lls, -halfGap);
  const l2  = L.polyline(ll2, stylePar);
  l2._elementType = 'piste_pieton';
  l2._elementId   = elementCounter;
  l2._elementName = 'Piste Piétons #' + groupId;
  l2._groupId     = groupId;
  l2._isParallel  = true;
  l2._centerlineVertices = lls;
  l2._pisteVertices = lls;
  l2._widthMeters = width;
  drawnItems.addLayer(l2);
  undoStack.push(l2);

  l1._pairedLayer = l2;
  l2._pairedLayer = l1;

  bindRoadPopup(l1, 'piste_pieton', groupId, width, lls);
  bindRoadPopup(l2, 'piste_pieton', groupId, width, lls);

  const len = getPolylineLength(lls);
  setStatus('Piste Piétons #' + groupId + ' - Longueur: ' + formatDistance(len) + ' | Largeur: ' + width + ' m');
}

/* ─── DOUBLE LIGNE PISTE (2m à 8m - TIRETS PARALLÈLES) ─── */
function addDoubleLinePiste(mainLayer) {
  const lls       = mainLayer.getLatLngs();
  const groupId   = elementCounter;
  const width     = CURRENT_PISTE_WIDTH || 4;
  const halfGap   = width / 2;

  const styleMain = {
    color: STYLES.pisteColor || '#f39c12',
    weight: 2.5,
    opacity: 0.95,
    dashArray: '10, 6',
    lineCap: 'butt',
    lineJoin: 'round'
  };
  const stylePar  = {
    color: STYLES.pisteColor || '#f39c12',
    weight: 2.5,
    opacity: 0.95,
    dashArray: '10, 6',
    lineCap: 'butt',
    lineJoin: 'round'
  };

  // Ligne 1 (offset +halfGap)
  const ll1 = computeParallelLatLngs(lls, +halfGap);
  const l1  = L.polyline(ll1, styleMain);
  l1._elementType = 'piste';
  l1._elementId   = elementCounter;
  l1._elementName = 'Piste #' + groupId;
  l1._groupId     = groupId;
  l1._isParallel  = false;
  l1._centerlineVertices = lls;
  l1._pisteVertices = lls;
  l1._widthMeters = width;
  drawnItems.addLayer(l1);
  undoStack.push(l1);

  // Ligne 2 (offset -halfGap)
  elementCounter++;
  const ll2 = computeParallelLatLngs(lls, -halfGap);
  const l2  = L.polyline(ll2, stylePar);
  l2._elementType = 'piste';
  l2._elementId   = elementCounter;
  l2._elementName = 'Piste #' + groupId;
  l2._groupId     = groupId;
  l2._isParallel  = true;
  l2._centerlineVertices = lls;
  l2._pisteVertices = lls;
  l2._widthMeters = width;
  drawnItems.addLayer(l2);
  undoStack.push(l2);

  l1._pairedLayer = l2;
  l2._pairedLayer = l1;

  bindRoadPopup(l1, 'piste', groupId, width, lls);
  bindRoadPopup(l2, 'piste', groupId, width, lls);

  const len = getPolylineLength(lls);
  setStatus('Piste #' + groupId + ' - Longueur: ' + formatDistance(len) + ' | Largeur: ' + width + ' m');
}

/* ─── DOUBLE LIGNE ROUTE (8m à 30m - TRAITS PLEINS PARALLÈLES) ─── */
function addDoubleLineRoute(mainLayer) {
  const lls     = mainLayer.getLatLngs();
  const groupId = elementCounter;
  const width   = CURRENT_ROUTE_WIDTH || 10;
  const halfGap = width / 2;

  const style = {
    color: STYLES.routeColor || '#27ae60',
    weight: 3,
    opacity: 0.95,
    dashArray: null,
    lineJoin: 'round'
  };

  // Ligne 1 (offset +halfGap)
  const ll1 = computeParallelLatLngs(lls, +halfGap);
  const l1  = L.polyline(ll1, style);
  l1._elementType = 'route';
  l1._elementId   = elementCounter;
  l1._elementName = 'Route #' + groupId;
  l1._groupId     = groupId;
  l1._isParallel  = false;
  l1._centerlineVertices = lls;
  l1._routeVertices = lls;
  l1._widthMeters = width;
  drawnItems.addLayer(l1);
  undoStack.push(l1);

  // Ligne 2 (offset -halfGap)
  elementCounter++;
  const ll2 = computeParallelLatLngs(lls, -halfGap);
  const l2  = L.polyline(ll2, style);
  l2._elementType = 'route';
  l2._elementId   = elementCounter;
  l2._elementName = 'Route #' + groupId;
  l2._groupId     = groupId;
  l2._isParallel  = true;
  l2._centerlineVertices = lls;
  l2._routeVertices = lls;
  l2._widthMeters = width;
  drawnItems.addLayer(l2);
  undoStack.push(l2);

  l1._pairedLayer = l2;
  l2._pairedLayer = l1;

  bindRoadPopup(l1, 'route', groupId, width, lls);
  bindRoadPopup(l2, 'route', groupId, width, lls);

  const len = getPolylineLength(lls);
  setStatus('Route #' + groupId + ' - Longueur: ' + formatDistance(len) + ' | Largeur: ' + width + ' m');
}

/* ─── GESTION MODERNE DU TRACÉ RÉSEAU (BT / MT / MIXTE) AVEC POTEAUX PBA & DISTANCES ─── */
let btGroupCounter = 0;
let mtGroupCounter = 0;

function findNearbySupport(latlng, maxDistMeters) {
  const maxD = maxDistMeters || 2.5;
  if (!drawnItems) return null;
  const layers = drawnItems.getLayers();
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    if (l instanceof L.Marker && l._isPole && l.getLatLng) {
      if (l.getLatLng().distanceTo(latlng) <= maxD) {
        return l;
      }
    }
  }
  return null;
}

function updateLineSpanDistances(polylineLayer) {
  if (!polylineLayer || !polylineLayer._distMarkers || !polylineLayer.getLatLngs) return;
  const lls = polylineLayer.getLatLngs();
  if (!Array.isArray(lls) || lls.length < 2) return;
  const netType = polylineLayer._elementType || 'BT';
  for (let i = 1; i < lls.length; i++) {
    const p1 = lls[i - 1];
    const p2 = lls[i];
    const dist = p1.distanceTo(p2);
    const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
    const m = polylineLayer._distMarkers[i - 1];
    if (m) {
      m.setLatLng(mid);
      m.setIcon(createDistanceLabelIcon(dist, netType));
    }
  }
}

function addNetworkLineWithPoles(polylineLayer, tool) {
  const isMT = (tool === 'mt' || tool === 'mtExt');
  const isBTMT = (tool === 'btmt');
  const isExt = (tool === 'btExt' || tool === 'mtExt');
  const netType = isMT ? 'MT' : (isBTMT ? 'BT_MT' : 'BT');

  if (isMT) mtGroupCounter++;
  else btGroupCounter++;
  const groupId = isMT ? mtGroupCounter : btGroupCounter;

  const lls = polylineLayer.getLatLngs();
  if (!lls || lls.length < 2) return;

  elementCounter++;
  const linePrefix = isBTMT ? 'Ligne BT+MT' : (isMT ? (isExt ? 'MT Existant' : 'Ligne MT') : (isExt ? 'BT Existant' : 'Ligne BT'));
  polylineLayer._elementType = tool;
  polylineLayer._elementId   = elementCounter;
  polylineLayer._elementName = `${linePrefix} #${groupId}`;
  polylineLayer._groupId     = groupId;
  polylineLayer._distMarkers = [];

  // Style de la ligne
  if (tool === 'bt') {
    polylineLayer.setStyle({ color: STYLES.btColor, weight: 2.5, opacity: 1, dashArray: '8,4' });
  } else if (tool === 'btExt') {
    polylineLayer.setStyle({ color: '#000000', weight: 2.5, opacity: 1, dashArray: null });
  } else if (tool === 'mt') {
    polylineLayer.setStyle({ color: STYLES.mtColor, weight: 2.5, opacity: 1, dashArray: '8,4' });
  } else if (tool === 'mtExt') {
    polylineLayer.setStyle({ color: '#555555', weight: 2.5, opacity: 1, dashArray: null });
  } else if (tool === 'btmt') {
    polylineLayer.setStyle({ color: '#00b4d8', weight: 3, opacity: 1, dashArray: '6,3' });
  }

  drawnItems.addLayer(polylineLayer);
  undoStack.push(polylineLayer);

  // 1. Cotes de distance entre les points (au milieu de chaque segment)
  if (AUTO_POLES_AND_DISTANCES) {
    for (let i = 1; i < lls.length; i++) {
      const p1 = lls[i - 1];
      const p2 = lls[i];
      const spanDist = p1.distanceTo(p2);
      const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
      const distLabel = L.marker(mid, {
        icon: createDistanceLabelIcon(spanDist, netType),
        interactive: false
      });
      distLabel._elementType = 'dist-label';
      distLabel._isDistLabel = true;
      distLabel._groupId     = groupId;
      drawnItems.addLayer(distLabel);
      polylineLayer._distMarkers.push(distLabel);
    }
  }

  // 2. Supports PBA carrés automatiques à chaque sommet
  const createdPoles = [];
  if (AUTO_POLES_AND_DISTANCES) {
    if (!window._lastImportedPointsLayers) window._lastImportedPointsLayers = [];

    // Détection de continuité : si le 1er sommet est sur un support existant
    let startNum = 0;
    const firstSup = findNearbySupport(lls[0], 2.0);
    if (firstSup && (firstSup._supportNumber !== undefined && firstSup._supportNumber !== null && firstSup._supportNumber !== '')) {
      startNum = parseInt(firstSup._supportNumber, 10) || 0;
    }

    lls.forEach(function(ll, idx) {
      // Vérifier si un support existe déjà tout près (raccordement / continuité)
      const existing = findNearbySupport(ll, 2.0);
      if (existing) {
        // Poteau déjà existant à ce point de raccordement : ne pas créer de doublon
        createdPoles.push(existing);
        return;
      }

      const supNum = (startNum > 0) ? (startNum + idx) : (idx + 1);

      elementCounter++;
      const poleType = 'PBA';
      const marker = L.marker([ll.lat, ll.lng], { icon: createPoleIcon(poleType) });

      marker._elementType = 'marker';
      marker._isPole      = true;
      marker._poleType    = poleType;
      marker._networkType = netType;
      marker._elementId   = elementCounter;
      marker._supportNumber = supNum;
      marker._showSupportNumber = true;

      // Coordonnées NON affichées automatiquement (choix Map et DXF indépendants)
      const chkGlobalMap = document.getElementById('chk-coords-map');
      marker._showCoordsMap = (chkGlobalMap && chkGlobalMap.checked) || !!window.SHOW_COORDS_MAP;

      const chkGlobalDxf = document.getElementById('chk-coords-dxf');
      marker._showCoordsDXF = (chkGlobalDxf && chkGlobalDxf.checked) || !!window.SHOW_COORDS_DXF;

      const chkTop = document.getElementById('chk-show-pole-type');
      const showTypeInName = (chkTop && chkTop.checked) || !!window.SHOW_POLE_TYPE_IN_NAME;
      marker._elementName = showTypeInName ? `${poleType} ${netType} ${supNum}` : `${netType} ${supNum}`;
      marker._groupId     = groupId;

      updateSupportDisplay(marker);

      if (marker.dragging) {
        marker.dragging.enable();
        marker.on('drag', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
        });
        marker.on('dragend', function() {
          if (marker._coordsMarker) marker._coordsMarker.setLatLng(marker.getLatLng());
          updateSupportPopup(marker);
          updateSupportDisplay(marker);
          if (window.refreshPointsList) window.refreshPointsList();
          adjustOverlappingTooltips();
          updateLineSpanDistances(polylineLayer);
        });
      }

      updateSupportPopup(marker);

      drawnItems.addLayer(marker);
      undoStack.push(marker);
      window._lastImportedPointsLayers.push(marker);
      createdPoles.push(marker);
    });

    if (document.getElementById('chk-altitude')?.checked && typeof fetchElevationsBatch === 'function') {
      fetchElevationsBatch(lls).then(alts => {
        if (Array.isArray(alts)) {
          createdPoles.forEach((p, idx) => {
            if (alts[idx] !== null && alts[idx] !== undefined) {
              p._altitude = alts[idx];
              updateSupportDisplay(p);
              updateSupportPopup(p);
            }
          });
          if (window.refreshPointsList) window.refreshPointsList();
        }
      });
    }

    if (window.refreshPointsList) window.refreshPointsList();
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar && createdPoles.length > 0) leftSidebar.style.display = 'flex';
    adjustOverlappingTooltips();
  }

  const totalLen = getPolylineLength(lls);
  updateElementCount();
  updateInfoPanel();

  if (typeof setStatus === 'function') {
    setStatus(`✅ ${linePrefix} #${groupId} enregistrée : ${lls.length} points (${createdPoles.length} poteaux PBA créés), ${formatDistance(totalLen)}. [Echap] pour terminer.`);
  }

  // 3. CONTINUITÉ DE TRACÉ : Réarmer l'outil automatiquement pour continuer sans interruption !
  if (AUTO_POLES_AND_DISTANCES) {
    setTimeout(function() {
      const btn = document.getElementById('tool-' + tool);
      if (btn && btn.classList.contains('active')) {
        startDraw(tool);
      }
    }, 120);
  }
}

function addBTLine(polylineLayer)   { addNetworkLineWithPoles(polylineLayer, 'bt'); }
function addBTExtLine(polylineLayer){ addNetworkLineWithPoles(polylineLayer, 'btExt'); }
function addMTLine(polylineLayer)   { addNetworkLineWithPoles(polylineLayer, 'mt'); }
function addMTExtLine(polylineLayer){ addNetworkLineWithPoles(polylineLayer, 'mtExt'); }
function addBTMTLine(polylineLayer) { addNetworkLineWithPoles(polylineLayer, 'btmt'); }

/* ─── COMPUTE PARALLEL OFFSET (geographic) ───────────────────────────── */
function computeParallelLatLngs(lls, offsetMeters) {
  const result = [];
  for (let i = 0; i < lls.length; i++) {
    let angle;
    let miterScale = 1;
    if (lls.length === 1) {
      angle = 0;
    } else if (i === 0) {
      angle = bearingDeg(lls[0], lls[1]);
    } else if (i === lls.length - 1) {
      angle = bearingDeg(lls[i-1], lls[i]);
    } else {
      const b1 = bearingDeg(lls[i-1], lls[i]);
      const b2 = bearingDeg(lls[i], lls[i+1]);
      let diff = b2 - b1;
      while (diff >  180) diff -= 360;
      while (diff < -180) diff += 360;
      angle = b1 + diff / 2;
      const cosHalf = Math.cos((diff / 2) * Math.PI / 180);
      if (Math.abs(cosHalf) > 0.15) {
        miterScale = Math.min(Math.max(1 / cosHalf, 0.5), 2.5);
      }
    }
    const perpAngle = angle + 90;
    result.push(destinationPoint(lls[i].lat, lls[i].lng, offsetMeters * miterScale, perpAngle));
  }
  return result;
}

function bearingDeg(from, to) {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat  * Math.PI / 180;
  const dLon = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x) * 180 / Math.PI;
}

function destinationPoint(lat, lng, distM, bearingDeg) {
  const R   = 6378137;
  const d   = distM / R;
  const b   = bearingDeg * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(b)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
}

/* ─── HELPERS ─────────────────────────────────────────────────────────── */
function getTypeFR(type) {
  const m = {
    foyer:'Limite Foyer', coord:'Coordonnees X/Y',
    marker:'Point', polyline:'Ligne', polygon:'Zone', circle:'Cercle',
    rectangle:'Rectangle',
    route: 'Route (' + CURRENT_ROUTE_WIDTH + 'm)',
    piste: 'Piste (' + CURRENT_PISTE_WIDTH + 'm)',
    piste_pieton: 'Piste Piétons (' + CURRENT_PIETON_WIDTH + 'm)',
    bt:'Ligne BT Neuf', 'bt-support':'Support BT', btExt:'BT Existant', line:'Ligne'
  };
  return m[type] || type;
}

function buildPopup(layer, type, id) {
  let html = '<div style="font-size:13px;min-width:160px;">';
  html += '<b>' + getTypeFR(type) + ' #' + id + '</b>';
  if (type === 'marker' || type === 'point') {
    const ll = layer.getLatLng();
    const epsg = document.getElementById('sel-projection').value;
    const proj = fromWGS84(ll.lat, ll.lng, epsg);
    html += '<br>Lat: ' + ll.lat.toFixed(6) + '&deg;';
    html += '<br>Lon: ' + ll.lng.toFixed(6) + '&deg;';
    if (proj && epsg !== 'EPSG:4326') {
      html += '<br>X: ' + proj.x.toFixed(3) + ' m';
      html += '<br>Y: ' + proj.y.toFixed(3) + ' m';
    }
  } else if (type === 'circle') {
    const r = layer.getRadius();
    html += '<br>Rayon: ' + formatDistance(r);
    html += '<br>Surface: ' + formatArea(Math.PI * r * r);
  } else if (type === 'polygon') {
    const lls = layer.getLatLngs()[0] || [];
    if (L.GeometryUtil) html += '<br>Surface: ' + formatArea(L.GeometryUtil.geodesicArea(lls));
  }
  html += '</div>';
  return html;
}

function getPolylineLength(lls) {
  if (Array.isArray(lls[0])) lls = lls[0];
  let total = 0;
  for (let i = 1; i < lls.length; i++) total += lls[i-1].distanceTo(lls[i]);
  return total;
}

function formatDistance(m) {
  if (m < 1000) return m.toFixed(1) + ' m';
  return (m / 1000).toFixed(3) + ' km';
}

function formatArea(m2) {
  if (m2 < 10000) return m2.toFixed(1) + ' m\xB2';
  if (m2 < 1e6)   return (m2/10000).toFixed(3) + ' ha';
  return (m2/1e6).toFixed(4) + ' km\xB2';
}

function undoLastDraw() {
  if (undoStack.length === 0) { setStatus('Rien a annuler.'); return; }
  const last = undoStack.pop();
  if (last._coordsMarker) {
    try { drawnItems.removeLayer(last._coordsMarker); } catch(e){}
    last._coordsMarker = null;
  }
  drawnItems.removeLayer(last);
  if (last._distMarkers && Array.isArray(last._distMarkers)) {
    last._distMarkers.forEach(m => { try { drawnItems.removeLayer(m); } catch(e){} });
  }
  if (undoStack.length > 0) {
    const prev = undoStack[undoStack.length - 1];
    if (prev._groupId && prev._groupId === last._groupId) {
      undoStack.pop();
      if (prev._coordsMarker) {
        try { drawnItems.removeLayer(prev._coordsMarker); } catch(e){}
        prev._coordsMarker = null;
      }
      drawnItems.removeLayer(prev);
      if (prev._distMarkers && Array.isArray(prev._distMarkers)) {
        prev._distMarkers.forEach(m => { try { drawnItems.removeLayer(m); } catch(e){} });
      }
    }
  }
  updateElementCount();
  updateInfoPanel();
  if (window.refreshPointsList) window.refreshPointsList();
  setStatus('Annule.');
}

function clearAll() {
  if (!confirm('Effacer tous les elements ?')) return;
  drawnItems.clearLayers();
  undoStack = [];
  elementCounter = 0;
  btGroupCounter = 0;
  mtGroupCounter = 0;
  updateElementCount();
  updateInfoPanel();
  setStatus('Carte effacee.');
}

function updateElementCount() {
  const count = drawnItems.getLayers().filter(l => !l._isCoordsMarker && !l._isDistLabel).length;
  document.getElementById('status-count').textContent = count > 0 ? count + ' element(s)' : '';
}

function enableDelete() {
  stopCurrentDraw();
  try {
    const edit = new L.EditToolbar.Delete(MAP, { featureGroup: drawnItems });
    edit.enable();
    setStatus('Mode suppression — cliquez un element puis Sauvegardez.');
  } catch(e) { console.warn('Delete:', e); }
}

function removeLayer(id) {
  drawnItems.eachLayer(layer => {
    if (layer._elementId === id) {
      if (layer._coordsMarker) {
        try { drawnItems.removeLayer(layer._coordsMarker); } catch(e){}
        layer._coordsMarker = null;
      }
      drawnItems.removeLayer(layer);
      undoStack = undoStack.filter(l => l._elementId !== id);
    }
  });
  updateElementCount();
  updateInfoPanel();
}

function updateInfoPanel() {
  const list = document.getElementById('info-list');
  if (!list) return;
  list.innerHTML = '';
  const typeIcons = {
    foyer:'fa-home', coord:'fa-crosshairs',
    marker:'fa-location-dot', polyline:'fa-route', polygon:'fa-draw-polygon',
    circle:'fa-circle-notch', route:'fa-road', piste:'fa-person-hiking', piste_pieton:'fa-person-walking',
    bt:'fa-bolt', 'bt-support':'fa-tower-cell', btExt:'fa-plug',
    mt:'fa-bolt', 'mt-support':'fa-tower-cell', mtExt:'fa-plug',
    btmt:'fa-layer-group', 'btmt-support':'fa-tower-cell'
  };
  const typeColors = {
    foyer:'#c0392b', coord:'#8e44ad',
    marker:'#e74c3c', polyline:'#3a86ff', polygon:'#9b59b6',
    circle:'#1abc9c', route:'#27ae60', piste:'#f39c12', piste_pieton:'#8e44ad',
    bt:'#e74c3c', 'bt-support':'#c0392b', btExt:'#111',
    mt:'#8e44ad', 'mt-support':'#8e44ad', mtExt:'#555',
    btmt:'#00b4d8', 'btmt-support':'#00b4d8'
  };

  drawnItems.eachLayer(layer => {
    if (layer._isParallel || layer._isCoordsMarker || layer._isDistLabel) return;
    const type  = layer._elementType || 'polyline';
    const icon  = typeIcons[type]  || 'fa-map-marker';
    const color = typeColors[type] || '#888';
    const name  = layer._elementName || 'Element #' + layer._elementId;
    let detail  = '';
    if (type === 'foyer') {
      detail = layer._coordX ? ('X=' + layer._coordX) : 'Foyer';
    } else if (type === 'coord') {
      detail = layer._coordX ? ('X=' + layer._coordX) : 'Coord';
    } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      detail = formatDistance(getPolylineLength(layer.getLatLngs()));
    } else if (layer instanceof L.Circle) {
      detail = 'r=' + formatDistance(layer.getRadius());
    } else if (layer instanceof L.Polygon) {
      const lls = layer.getLatLngs()[0] || [];
      if (L.GeometryUtil) detail = formatArea(L.GeometryUtil.geodesicArea(lls));
    }

    const item = document.createElement('div');
    item.className = 'info-item';
    item.innerHTML =
      '<i class="fa ' + icon + '" style="color:' + color + ';"></i>' +
      '<span class="item-type">' + name + '</span>' +
      '<span class="item-detail">' + detail + '</span>' +
      '<button class="item-del" onclick="removeLayer(' + layer._elementId + ')"><i class="fa fa-times"></i></button>';

    item.addEventListener('click', function(e) {
      if (e.target.closest('.item-del')) return;
      if (layer.getLatLng)   MAP.setView(layer.getLatLng(), 17);
      else if (layer.getBounds) MAP.fitBounds(layer.getBounds(), {padding:[30,30]});
    });
    list.appendChild(item);
  });
}
