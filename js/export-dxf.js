/**
 * export-dxf.js - DXF AC1009 (AutoCAD R12)
 * Export complet : Limites Foyers, Textes Noms en Rouge, Coordonnees X/Y, Pistes 4m, Routes 7m, BT
 */

function P(code, value) {
  return ('   ' + code).slice(-3) + '\r\n' + value + '\r\n';
}

/* ─── MAIN EXPORT DXF ─────────────────────────────────────────────────── */
function exportDXF() {
  const layers = drawnItems.getLayers();
  if (layers.length === 0) { alert('Aucun element a exporter !'); return; }

  const epsg = document.getElementById('sel-projection').value;
  const projLabel = document.getElementById('sel-projection').options[document.getElementById('sel-projection').selectedIndex].text;
  const projectName = (document.getElementById('project-name') || {}).value || 'Map_Tools_v2';

  /* ── Police et Taille sélectionnées par l'utilisateur (entre 1 et 10 m) ── */
  const fontEl = document.getElementById('top-dxf-font') || document.getElementById('modal-dxf-font');
  const sizeEl = document.getElementById('top-dxf-size') || document.getElementById('modal-dxf-size');
  const offsetEl = document.getElementById('modal-dxf-offset');

  const selectedFontFile = fontEl ? fontEl.value : 'calibri.ttf';
  let TH = sizeEl ? parseFloat(sizeEl.value) : 3.50;
  if (isNaN(TH) || TH < 0.5) TH = 3.50;
  if (TH > 15) TH = 10.0;

  // Espacement interligne proportionnel : garanti sans chevauchement pour toute taille de 1 à 10 m
  const SP = TH * 1.37;

  // Décalage du texte par rapport au centre du support
  let textOffset = offsetEl ? parseFloat(offsetEl.value) : TH;
  if (isNaN(textOffset) || textOffset < 0.5) textOffset = TH;
  if (textOffset > 15) textOffset = 10.0;

  /* ── HEADER ────────────────────────────────────────────────────────── */
  let dxf = '';
  dxf += P(0,'SECTION'); dxf += P(2,'HEADER');
  dxf += P(9,'$ACADVER');   dxf += P(1,'AC1009');
  dxf += P(9,'$DWGCODEPAGE'); dxf += P(3,'ANSI_1252');
  dxf += P(9,'$INSUNITS');  dxf += P(70,'     6');
  dxf += P(9,'$LTSCALE');   dxf += P(40,'1.0');
  dxf += P(9,'$TEXTSTYLE'); dxf += P(7,'STANDARD');
  dxf += P(0,'ENDSEC');

  /* ── TABLES ────────────────────────────────────────────────────────── */
  dxf += P(0,'SECTION'); dxf += P(2,'TABLES');

  // LTYPE
  dxf += P(0,'TABLE'); dxf += P(2,'LTYPE'); dxf += P(70,'     3');
  dxf += P(0,'LTYPE'); dxf += P(2,'CONTINUOUS');
  dxf += P(70,'    64'); dxf += P(3,'Solid line');
  dxf += P(72,'    65'); dxf += P(73,'     0'); dxf += P(40,'0.0');
  dxf += P(0,'LTYPE'); dxf += P(2,'DASHED');
  dxf += P(70,'    64'); dxf += P(3,'__ __ __ __ __ __ __ __ __ __ __ __ __ _');
  dxf += P(72,'    65'); dxf += P(73,'     2'); dxf += P(40,'10.0');
  dxf += P(49,'6.0'); dxf += P(49,'-4.0');
  dxf += P(0,'LTYPE'); dxf += P(2,'DOT');
  dxf += P(70,'    64'); dxf += P(3,'. . . . . . . . . . . . . . . . . . . .');
  dxf += P(72,'    65'); dxf += P(73,'     2'); dxf += P(40,'2.0');
  dxf += P(49,'0.0'); dxf += P(49,'-2.0');
  dxf += P(0,'ENDTAB');

  // LAYER
  const layerDefs = [
    { name:'PISTES_PIETONS', color:40, ltype:'DOT' },
    { name:'PISTES',         color:30, ltype:'DASHED' },
    { name:'ROUTES',         color: 3, ltype:'CONTINUOUS' },
    { name:'LIGNES_BT',      color: 1, ltype:'CONTINUOUS' },
    { name:'SUPPORTS_BT',    color:11, ltype:'CONTINUOUS' },
    { name:'BT_EXISTANT',    color: 7, ltype:'CONTINUOUS' },
    { name:'LIGNES_MT',      color: 6, ltype:'CONTINUOUS' }, // Magenta (MT Neuve)
    { name:'SUPPORTS_MT',    color: 6, ltype:'CONTINUOUS' },
    { name:'MT_EXISTANT',    color: 8, ltype:'CONTINUOUS' }, // Gris foncé (MT Existante)
    { name:'LIGNES_BT_MT',   color: 4, ltype:'CONTINUOUS' }, // Cyan (Mixte BT+MT)
    { name:'SUPPORTS_BT_MT', color: 4, ltype:'CONTINUOUS' },
    { name:'DISTANCES',        color: 2, ltype:'CONTINUOUS' }, // Mesures des portées entre supports (Jaune)
    { name:'FOYERS',           color: 7, ltype:'CONTINUOUS' }, // Contour noir/blanc du foyer
    { name:'FOYERS_NOM',       color: 1, ltype:'CONTINUOUS' }, // Texte Nom en Rouge
    { name:'NUMEROS_SUPPORTS', color: 3, ltype:'CONTINUOUS' }, // N° de support (Vert - N1, N°1...)
    { name:'NOMS_SUPPORTS',    color: 1, ltype:'CONTINUOUS' }, // Désignation / Nom du support (Rouge - PBA MT 21...)
    { name:'COORDONNEES_XY',   color: 4, ltype:'CONTINUOUS' }, // Coordonnées X= et Y= (Cyan)
    { name:'COORDONNEES',      color: 6, ltype:'CONTINUOUS' }, // Points de coordonnees
    { name:'ZONES',            color: 5, ltype:'CONTINUOUS' }, // Polygones et cercles
    { name:'POINTS_N',         color: 6, ltype:'CONTINUOUS' }, // Sommets N#
    { name:'NUMS_N',           color: 6, ltype:'CONTINUOUS' }, // Textes N#
    { name:'TEXTES',           color: 7, ltype:'CONTINUOUS' }, // Textes X= Y=
    { name:'IMPORTS',          color: 2, ltype:'CONTINUOUS' }, // Points importes KML/DXF (jaune)
    { name:'POTEAUX_PBA',      color: 7, ltype:'CONTINUOUS' }, // Poteau Beton Arme (Carre Noir Plein)
    { name:'POTEAUX_ACIER',    color: 7, ltype:'CONTINUOUS' }, // Poteau Acier (Cercle Noir Plein)
  ];
  dxf += P(0,'TABLE'); dxf += P(2,'LAYER'); dxf += P(70,'     ' + layerDefs.length);
  layerDefs.forEach(ld => {
    dxf += P(0,'LAYER'); dxf += P(2,ld.name);
    dxf += P(70,'     0');
    dxf += P(62,('     ' + ld.color).slice(-6));
    dxf += P(6,ld.ltype);
  });
  dxf += P(0,'ENDTAB');

  // STYLE (police sélectionnée : Calibri, Arial, Times, Tahoma, Simplex, txt)
  dxf += P(0,'TABLE'); dxf += P(2,'STYLE'); dxf += P(70,'     1');
  dxf += P(0,'STYLE'); dxf += P(2,'STANDARD');
  dxf += P(70,'     0'); dxf += P(40,'0.0'); dxf += P(41,'1.0');
  dxf += P(50,'0.0');   dxf += P(71,'     0'); dxf += P(42, TH.toFixed(1));
  dxf += P(3, selectedFontFile);    dxf += P(4,'');
  dxf += P(0,'ENDTAB');

  // VIEW
  dxf += P(0,'TABLE'); dxf += P(2,'VIEW'); dxf += P(70,'     0'); dxf += P(0,'ENDTAB');
  dxf += P(0,'ENDSEC');

  /* ── BLOCKS ────────────────────────────────────────────────────────── */
  dxf += P(0,'SECTION'); dxf += P(2,'BLOCKS'); dxf += P(0,'ENDSEC');

  /* ── ENTITIES ──────────────────────────────────────────────────────── */
  dxf += P(0,'SECTION'); dxf += P(2,'ENTITIES');

  let nCounter = 1;
  const exportedMarkerKeys = new Set();
  const coordUsageCount = new Map();

  layers.forEach(function(layer) {
    if (layer._isDistLabel || layer._elementType === 'dist-label' || layer._isCoordsMarker) return;
    const type = layer._elementType || '';
    const rawName = layer._elementName || layer._customTitle || '';
    const n = String(rawName).toLowerCase();

    /* ── 0. Piste Piétons / Sentier (dessinée ou importée KML/DXF) ───── */
    if (type === 'piste_pieton' || (!type && (n.includes('pieton') || n.includes('piéton') || n.includes('sentier')) && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) dxf += dxfPolyline(pts, 'PISTES_PIETONS', false);
      });
    }
    /* ── 1. Piste (dessinée ou importée KML/DXF) ─────────────────────── */
    else if (type === 'piste' || (!type && n.includes('piste') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) dxf += dxfPolyline(pts, 'PISTES', false);
      });
      if (!layer._isParallel && !layer._isImportedKML && !layer._isImported && layer._pisteVertices) {
        const origPts = latlngs2proj(layer._pisteVertices, epsg);
        origPts.forEach(function(pt) {
          dxf += dxfPoint(pt.x, pt.y, 'POINTS_N');
          dxf += dxfText(pt.x, pt.y, 'N' + nCounter, 'NUMS_N', 3.0);
          nCounter++;
        });
      }
    }
    /* ── 2. Route (dessinée ou importée KML/DXF) ─────────────────────── */
    else if (type === 'route' || (!type && n.includes('route') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) dxf += dxfPolyline(pts, 'ROUTES', false);
      });
      if (!layer._isParallel && !layer._isImportedKML && !layer._isImported && layer._routeVertices) {
        const origPts = latlngs2proj(layer._routeVertices, epsg);
        origPts.forEach(function(pt) {
          dxf += dxfPoint(pt.x, pt.y, 'POINTS_N');
          dxf += dxfText(pt.x, pt.y, 'N' + nCounter, 'NUMS_N', 3.0);
          nCounter++;
        });
      }
    }
    /* ── 3. Reseau BT existant ────────────────────────────────────────── */
    else if (type === 'btExt' || (n.includes('exist') && n.includes('bt') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, 'BT_EXISTANT', false);
          dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
        }
      });
    }
    /* ── 4. Ligne BT nouvelle ─────────────────────────────────────────── */
    else if (type === 'bt' || (n.includes('bt') && !n.includes('mt') && !n.includes('exist') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, 'LIGNES_BT', false);
          dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
        }
      });
    }
    /* ── 4b. Reseau MT existant ────────────────────────────────────────── */
    else if (type === 'mtExt' || (n.includes('exist') && n.includes('mt') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, 'MT_EXISTANT', false);
          dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
        }
      });
    }
    /* ── 4c. Ligne MT nouvelle ─────────────────────────────────────────── */
    else if (type === 'mt' || (n.includes('mt') && !n.includes('bt') && !n.includes('exist') && layer instanceof L.Polyline && !(layer instanceof L.Polygon))) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, 'LIGNES_MT', false);
          dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
        }
      });
    }
    /* ── 4d. Ligne mixte BT + MT ──────────────────────────────────────── */
    else if (type === 'btmt' || ((n.includes('bt') && n.includes('mt')) || n.includes('mixte')) && layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, 'LIGNES_BT_MT', false);
          dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
        }
      });
    }
    /* ── 5. Supports numerotes (BT / MT / BT+MT) ──────────────────────── */
    else if (type === 'bt-support' || type === 'mt-support' || type === 'btmt-support') {
      const ll   = layer.getLatLng();
      const proj = latlon2proj(ll.lat, ll.lng, epsg);
      if (proj) {
        const supLayer = (type === 'mt-support') ? 'SUPPORTS_MT' : ((type === 'btmt-support') ? 'SUPPORTS_BT_MT' : 'SUPPORTS_BT');
        dxf += dxfPoint(proj.x, proj.y, supLayer, layer._altitude);
        const prefix = (type === 'mt-support') ? 'MT-S' : ((type === 'btmt-support') ? 'BTMT-S' : 'S');
        const label = prefix + (layer._btNum || layer._mtNum || layer._btmtNum || '');
        dxf += dxfText(proj.x + 1.5, proj.y + 1.5, label, 'NUMEROS_SUPPORTS', 2.5);
      }
    }
    /* ── 6. Foyer (Limite Polygone seul) ────────────────────────────── */
    else if (type === 'foyer' || (n.includes('foyer') && layer instanceof L.Polygon)) {
      const rings = extractPolygonRingsDXF(layer.getLatLngs());
      rings.forEach(function(ring) {
        const pts = ring.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 3) {
          const closed = [...pts, { x: pts[0].x, y: pts[0].y }];
          dxf += dxfPolyline(closed, 'FOYERS', true);
        }
      });
    }
    /* ── 7. Coordonnees X/Y + Nom (Emplacement choisi par l'utilisateur) ─── */
    else if (type === 'coord') {
      const ll = layer.getLatLng();
      const proj = latlon2proj(ll.lat, ll.lng, epsg);
      if (proj) {
        dxf += dxfPoint(proj.x, proj.y, 'COORDONNEES', layer._altitude);
        let lineY = proj.y + 0.8;
        if (layer._customTitle) {
          const titleClean = String(layer._customTitle).replace(/[^\x20-\x7E]/g,'').slice(0,50);
          // Nom du point / support en calque NOMS_SUPPORTS (Rouge)
          dxf += dxfText(proj.x + textOffset, lineY + SP * 2, titleClean, 'NOMS_SUPPORTS', TH);
        }
        // X= et Y= en calque COORDONNEES_XY (Cyan) avec hauteur choisie TH
        dxf += dxfText(proj.x + textOffset, lineY + SP, 'X=' + proj.x.toFixed(2), 'COORDONNEES_XY', TH);
        dxf += dxfText(proj.x + textOffset, lineY,       'Y=' + proj.y.toFixed(2), 'COORDONNEES_XY', TH);
      }
    }
    /* ── 8. Marqueur (Support PBA / Acier, KML, DXF) ──── */
    else if (type === 'marker' || type === 'text' ||
             (layer instanceof L.Marker && !(type))) {
      // Ignorer les points de support numérotés auto (bt-support, mt-support, btmt-support)
      // Ces points sont des jalons de tracé sans intérêt dans le DXF
      if (type === 'bt-support' || type === 'mt-support' || type === 'btmt-support') return;

      const ll   = layer.getLatLng ? layer.getLatLng() : null;
      if (!ll) return;
      const proj = latlon2proj(ll.lat, ll.lng, epsg);
      if (!proj) return;

      const nomRaw = layer._elementName || layer._customTitle || '';

      /* ── TRAITEMENT DU NOM : préserver les sauts de ligne \n avant tout nettoyage ── */
      // Étape 1 : découper sur les vrais sauts de ligne (tapés par l'utilisateur avec Entrée)
      const rawLines = String(nomRaw).split(/\r?\n/);
      // Étape 2 : nettoyer chaque ligne individuellement (garder lettres accentuées + espace + chiffres + ponctuation)
      const cleanedLines = rawLines
        .map(l => l.replace(/[\x00-\x1F\x7F]/g, '').trim())  // supprimer seulement les caractères de contrôle
        .filter(Boolean);
      // Étape 3 : reconstituer un nom propre avec \n pour les déductions automatiques suivantes
      const nom = cleanedLines.join('\n').slice(0, 300);
      // Nom sur une seule ligne (pour déduplication et clé)
      const nomFlat = cleanedLines.join(' ').slice(0, 150);

      /* Déduplication par identifiant de couche Leaflet (ne pas sauter d'entités distinctes) */
      const keyExact = layer._leaflet_id ? ('ID_' + layer._leaflet_id) : (nomFlat.toUpperCase() + '_' + proj.x.toFixed(2) + '_' + proj.y.toFixed(2));
      if (exportedMarkerKeys.has(keyExact)) return;
      exportedMarkerKeys.add(keyExact);

      /* Détection des points superposés à la même position géographique (rayon 0.5m) */
      const gridKey = Math.round(proj.x / 0.5) + '_' + Math.round(proj.y / 0.5);
      const markerIndexAtLocation = coordUsageCount.get(gridKey) || 0;
      coordUsageCount.set(gridKey, markerIndexAtLocation + 1);

      /* Symbole du poteau reduit : PBA = Carre noir 2.0m, P Acier = Cercle noir 2.0m */
      const poleType = layer._poleType || (
        nomFlat.toLowerCase().includes('acier') || /\bac\b/i.test(nomFlat) || nomFlat.toLowerCase().endsWith('ac') ? 'P Acier' : 'PBA'
      );

      const POLE_SIZE   = 2.0;          // 2.0 m (taille reduite)
      const POLE_RADIUS = POLE_SIZE / 2; // 1.0 m de rayon / demi-cote

      // Dessin du symbole pour le premier point ou si le type de poteau est différent
      if (markerIndexAtLocation === 0) {
        if (poleType === 'P Acier') {
          dxf += dxfSolidCircle(proj.x, proj.y, POLE_RADIUS, 'POTEAUX_ACIER', 24);
          dxf += dxfCircle(proj.x, proj.y, POLE_RADIUS, 'POTEAUX_ACIER');
        } else {
          dxf += dxfSolidSquare(proj.x, proj.y, POLE_SIZE, 'POTEAUX_PBA');
          const h = POLE_RADIUS;
          const squarePts = [
            { x: proj.x - h, y: proj.y - h },
            { x: proj.x + h, y: proj.y - h },
            { x: proj.x + h, y: proj.y + h },
            { x: proj.x - h, y: proj.y + h },
            { x: proj.x - h, y: proj.y - h }
          ];
          dxf += dxfPolyline(squarePts, 'POTEAUX_PBA', true, 0.15);
        }
      }

      /* Point de localisation central */
      dxf += dxfPoint(proj.x, proj.y, 'IMPORTS', layer._altitude);

      /* SÉPARATION DES ÉTIQUETTES SI DEUX POINTS SONT AU MÊME ENDROIT :
       * - Point 1 (index 0) : Placé à DROITE du symbole (+textOffset), aligné à gauche
       * - Point 2 (index 1) : Placé à GAUCHE du symbole (-textOffset), aligné à droite (DXF 72=2)
       * - Point 3+ : Étagé verticalement pour éviter tout chevauchement
       */
      let textX, align, baseTextY;
      if (markerIndexAtLocation === 0) {
        textX = proj.x + textOffset;
        align = 'LEFT';
        baseTextY = proj.y;
      } else if (markerIndexAtLocation === 1) {
        textX = proj.x - textOffset;
        align = 'RIGHT';
        baseTextY = proj.y;
      } else {
        const isRight = (markerIndexAtLocation % 2 === 0);
        textX = isRight ? (proj.x + textOffset) : (proj.x - textOffset);
        align = isRight ? 'LEFT' : 'RIGHT';
        const shiftY = Math.floor(markerIndexAtLocation / 2) * (SP * 4);
        baseTextY = proj.y + shiftY;
      }

      /* GESTION MULTI-LIGNES DU NOM DE SUPPORT
       * Priorité 1 : les sauts de ligne manuels tapés par l'utilisateur (Entrée)
       * Priorité 2 : découpage automatique via splitSupportNameLines (si pas de \n manuel)
       */
      let nameLines = [];
      if (typeof splitSupportNameLines === 'function') {
        nameLines = splitSupportNameLines(nom);
      } else if (cleanedLines.length > 1) {
        nameLines = cleanedLines;
      } else {
        nameLines = nom ? [nom] : [];
      }

      // Nettoyer les balises HTML éventuelles
      nameLines = nameLines.map(l => l.replace(/<[^>]*>/g, '').trim()).filter(Boolean);

      // N° de support par ordre sur la ligne MT ou BT
      const supNum = layer._supportNumber;
      const hasExplicitNumLine = nameLines.length > 0 && /^n\s*\d+[-]/i.test(nameLines[0]);
      const showSupNum = !hasExplicitNumLine && (layer._showSupportNumber !== false) && (supNum !== undefined && supNum !== null && supNum !== '');
      if (showSupNum) {
        // Filtrer les étiquettes réseau automatiques (ex: "MT 4", "BT 4", "MT 5", "BT 5", "Support #4", etc.)
        // pour ne laisser que le numéro "N°1" seulement, plus d'éventuelles annotations manuelles
        nameLines = nameLines.filter(line => {
          const l = line.trim();
          if (/^(N°|#|\bN\b|\bN\d+)\s*\d*/i.test(l)) return false;
          if (/^(?:(?:PBA|ACIER)\s+)?(?:MT|BT|BTMT|Support|Element)\s*#?\d+$/i.test(l)) return false;
          return true;
        });

        // Ajouter uniquement le numéro de support propre "N°1", "N°2", "N°4", etc.
        nameLines.unshift(`N°${supNum}`);
      }

      // Noms auto-générés à filtrer uniquement s'il n'y a pas de vrai nom ni de numéro d'ordre
      const isAutoName = (!nomFlat && !showSupNum && !hasExplicitNumLine)
        || (/^(Support|Element|Point DXF|Point Coord)\s*#?\d+$/i.test(nomFlat.trim()) && !showSupNum && !hasExplicitNumLine)
        || (nomFlat.startsWith('Point DXF') && !showSupNum && !hasExplicitNumLine)
        || (nomFlat.startsWith('Element ') && !showSupNum && !hasExplicitNumLine);

      // Affichage des coordonnées X= et Y= dans le DXF :
      // Actif si la case globale DXF est cochée, ou si ce point individuel a _showCoordsDXF === true
      const chkGlobalDxf = document.getElementById('chk-coords-dxf');
      const showDxfGlobal = (chkGlobalDxf && chkGlobalDxf.checked) || !!window.SHOW_COORDS_DXF;
      const shouldExportCoords = (layer._showCoordsDXF === true) || (layer._showCoordsDXF !== false && showDxfGlobal);

      if (!isAutoName) {
        // Détection de la couche appropriée pour chaque ligne :
        // - NUMEROS_SUPPORTS pour n 23-, N1, N°1, #1, N.1... ou si généré automatiquement via _supportNumber
        // - NOMS_SUPPORTS pour les désignations (8/150 pba, PBA MT 21, MT 1, etc.)
        const getLineLayer = (lineText, index) => {
          const trimmed = lineText.trim();
          if (/^n\s*\d+[-]/i.test(trimmed)) {
            return 'NUMEROS_SUPPORTS';
          }
          if (showSupNum && index === 0 && (trimmed === `N°${supNum}` || trimmed === `N° ${supNum}` || trimmed.startsWith(`N°`) || trimmed.startsWith(`N%%d`))) {
            return 'NUMEROS_SUPPORTS';
          }
          if (/^(N(?:°|%%d)|#|\bN\s*|\bN)(?:[°\.\s]*)?\d+/i.test(trimmed) || /^(N(?:°|%%d)|#)\s*\d+/i.test(trimmed)) {
            return 'NUMEROS_SUPPORTS';
          }
          return 'NOMS_SUPPORTS';
        };

        if (shouldExportCoords) {
          // Avec coordonnées : empilement des lignes du nom au-dessus de X=
          for (let i = 0; i < nameLines.length; i++) {
            const lineClean = nameLines[i].replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200) || ' ';
            const lineY = baseTextY + SP * (nameLines.length - i);
            const lineLayer = getLineLayer(lineClean, i);
            dxf += dxfText(textX, lineY, lineClean, lineLayer, TH, align);
          }
        } else {
          // Sans coordonnées : centrer les lignes du nom à hauteur du poteau
          const totalH = (nameLines.length - 1) * SP;
          const startY = baseTextY + (totalH / 2);
          for (let i = 0; i < nameLines.length; i++) {
            const lineClean = nameLines[i].replace(/[\x00-\x1F\x7F]/g, '').slice(0, 200) || ' ';
            const lineY = startY - (i * SP);
            const lineLayer = getLineLayer(lineClean, i);
            dxf += dxfText(textX, lineY, lineClean, lineLayer, TH, align);
          }
        }
      }

      /* Coordonnees X= et Y= UNIQUEMENT si cochées */
      if (shouldExportCoords) {
        dxf += dxfText(textX, baseTextY,      'X=' + proj.x.toFixed(2), 'COORDONNEES_XY', TH, align);
        dxf += dxfText(textX, baseTextY - SP, 'Y=' + proj.y.toFixed(2), 'COORDONNEES_XY', TH, align);
      }
    }
    /* ── 9. Polyline generique (dessinee ou importee KML/DXF) ─── */
    else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      let targetLayer = layer._dxfLayer || 'PISTES';
      if (n.includes('pieton') || n.includes('piéton') || n.includes('sentier')) targetLayer = 'PISTES_PIETONS';
      else if (n.includes('route')) targetLayer = 'ROUTES';
      else if (n.includes('bt')) targetLayer = n.includes('exist') ? 'BT_EXISTANT' : 'LIGNES_BT';

      const segments = extractPolylineSegmentsDXF(layer.getLatLngs());
      segments.forEach(function(seg) {
        const pts = seg.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 2) {
          dxf += dxfPolyline(pts, targetLayer, false);
          if (!layer._isImportedKML && !layer._isImported) {
            pts.forEach(function(pt) {
              dxf += dxfPoint(pt.x, pt.y, 'POINTS_N');
              dxf += dxfText(pt.x, pt.y, 'N' + nCounter, 'NUMS_N', 3.0);
              nCounter++;
            });
          }
          if (layer._distMarkers && layer._distMarkers.length > 0) {
            dxf += exportSegmentDistancesDXF(pts, 'DISTANCES', TH * 0.75);
          }
        }
      });
    }
    /* ── 10. Cercle ────────────────────────────────────────────────── */
    else if (layer instanceof L.Circle) {
      const center = layer.getLatLng();
      const proj   = latlon2proj(center.lat, center.lng, epsg);
      if (proj) dxf += dxfCircle(proj.x, proj.y, layer.getRadius(), 'ZONES');
    }
    /* ── 11. Polygone generique (dessiné ou importé KML/DXF) ─── */
    else if (layer instanceof L.Polygon) {
      const rings = extractPolygonRingsDXF(layer.getLatLngs());
      rings.forEach(function(ring) {
        const pts = ring.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
        if (pts.length >= 3) {
          const closed = [...pts, { x: pts[0].x, y: pts[0].y }];
          dxf += dxfPolyline(closed, 'ZONES', true);
        }
      });
    }
  });

  dxf += P(0,'ENDSEC');
  dxf += P(0,'EOF');

  const fname = projectName.replace(/[\s\\/:\"*?<>|]/g,'_');
  const fontNameClean = selectedFontFile.replace(/\.(ttf|shx)$/i,'');

  /* ── Téléchargement du fichier DXF ────────────────────────────────── */
  downloadFile(dxf, fname + '_AutoCAD.dxf', 'application/dxf');

  setStatus('DXF exporté (AutoCAD) avec ' + (nCounter-1) + ' point(s) N# — ' + layers.length + ' éléments. [Police: ' + fontNameClean + ' | Taille: ' + TH.toFixed(1) + ' m].');
}

/* ─── DXF ENTITY BUILDERS ─────────────────────────────────────────────── */
function dxfPoint(x, y, layerName, z) {
  let s = '';
  s += P(0,  'POINT');
  s += P(8,  layerName);
  s += P(10, fmtC(x));
  s += P(20, fmtC(y));
  s += P(30, fmtC(z || 0.0));
  return s;
}

/* Epaisseur des traits : 0.30 m (group codes 40=start width, 41=end width en AC1009) */
const LINE_WIDTH = 0.30;

function dxfPolyline(pts, layerName, closed, widthOverride) {
  const w = (widthOverride !== undefined) ? widthOverride : LINE_WIDTH;
  let s = '';
  s += P(0,  'POLYLINE');
  s += P(8,  layerName);
  s += P(66, '     1');
  s += P(10, '0.0');
  s += P(20, '0.0');
  s += P(30, '0.0');
  s += P(70, closed ? '     1' : '     0');
  s += P(40, w.toFixed(6));   // default start width
  s += P(41, w.toFixed(6));   // default end width
  pts.forEach(function(pt) {
    s += P(0,  'VERTEX');
    s += P(8,  layerName);
    s += P(10, fmtC(pt.x));
    s += P(20, fmtC(pt.y));
    s += P(30, fmtC(pt.z || 0.0));
    s += P(70, '     0');
    s += P(40, '0.000000');   // 0 = use polyline default width
    s += P(41, '0.000000');
  });
  s += P(0, 'SEQEND');
  s += P(8, layerName);
  return s;
}

function dxfCircle(x, y, r, layerName) {
  let s = '';
  s += P(0,  'CIRCLE');
  s += P(8,  layerName);
  s += P(10, fmtC(x));
  s += P(20, fmtC(y));
  s += P(30, '0.0');
  s += P(40, fmtC(r));
  return s;
}

function dxfSolidSquare(cx, cy, side, layerName) {
  const h = side / 2;
  const x1 = cx - h, y1 = cy - h;
  const x2 = cx + h, y2 = cy - h;
  const x3 = cx + h, y3 = cy + h;
  const x4 = cx - h, y4 = cy + h;

  let s = '';
  s += P(0,  'SOLID');
  s += P(8,  layerName);
  s += P(10, fmtC(x1));
  s += P(20, fmtC(y1));
  s += P(30, '0.0');
  s += P(11, fmtC(x2));
  s += P(21, fmtC(y2));
  s += P(31, '0.0');
  s += P(12, fmtC(x4)); // DXF SOLID : points 3 et 4 inversés
  s += P(22, fmtC(y4));
  s += P(32, '0.0');
  s += P(13, fmtC(x3));
  s += P(23, fmtC(y3));
  s += P(33, '0.0');
  return s;
}

function dxfSolidCircle(cx, cy, radius, layerName, segments) {
  const segs = segments || 24;
  let s = '';
  for (let i = 0; i < segs; i++) {
    const a1 = (i * 2 * Math.PI) / segs;
    const a2 = ((i + 1) * 2 * Math.PI) / segs;
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);

    s += P(0,  'SOLID');
    s += P(8,  layerName);
    s += P(10, fmtC(cx));
    s += P(20, fmtC(cy));
    s += P(30, '0.0');
    s += P(11, fmtC(x1));
    s += P(21, fmtC(y1));
    s += P(31, '0.0');
    s += P(12, fmtC(x2)); // Triangle SOLID : 12/22 et 13/23 identiques
    s += P(22, fmtC(y2));
    s += P(32, '0.0');
    s += P(13, fmtC(x2));
    s += P(23, fmtC(y2));
    s += P(33, '0.0');
  }
  return s;
}

function dxfText(x, y, text, layerName, height, align, rotationDeg) {
  // Garder les lettres accentuées (ANSI 1252 : é,è,à,ç,ù...) — supprimer seulement les contrôles
  let clean = String(text).replace(/[\x00-\x1F\x7F]/g,'').replace(/[\r\n]/g,' ').slice(0,255) || ' ';
  // Remplacer le symbole degré par %%d (code standard AutoCAD) pour éviter l'apparition de "Â°" en UTF-8
  clean = clean.replace(/Â°/g, '°').replace(/Â%%d/g, '%%d').replace(/°/g, '%%d');
  let s = '';
  s += P(0,  'TEXT');
  s += P(8,  layerName);
  s += P(10, fmtC(x));
  s += P(20, fmtC(y));
  s += P(30, '0.0');
  s += P(40, (height||3.5).toFixed(4));
  s += P(1,  clean);
  s += P(7,  'STANDARD');

  // Angle d'orientation en degrés (Code 50)
  if (rotationDeg !== undefined && rotationDeg !== null && !isNaN(rotationDeg) && Math.abs(rotationDeg) > 0.001) {
    s += P(50, rotationDeg.toFixed(2));
  }

  if (align === 'RIGHT' || align === 2) {
    s += P(72, '     2');
    s += P(11, fmtC(x));
    s += P(21, fmtC(y));
    s += P(31, '0.0');
  } else if (align === 'CENTER' || align === 1) {
    s += P(72, '     1');
    s += P(73, '     2'); // Centré au milieu (middle center)
    s += P(11, fmtC(x));
    s += P(21, fmtC(y));
    s += P(31, '0.0');
  }
  return s;
}

function exportSegmentDistancesDXF(pts, layerName, height) {
  if (!pts || pts.length < 2) return '';
  let s = '';
  const textH = height || 2.5;
  const perpOffset = textH * 0.7; // Décalage perpendiculaire au-dessus de la ligne

  for (let i = 1; i < pts.length; i++) {
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) continue; // ignorer points superposés

    // Point milieu du segment entre les deux supports
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    // Angle d'orientation en degrés
    let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

    // Vecteur unitaire perpendiculaire
    let ux = -dy / dist;
    let uy = dx / dist;

    // Redresser le texte pour qu'il soit toujours lisible de gauche à droite
    if (angleDeg > 90 || angleDeg < -90) {
      angleDeg += (angleDeg > 90 ? -180 : 180);
      ux = -ux;
      uy = -uy;
    }

    const tx = mx + ux * perpOffset;
    const ty = my + uy * perpOffset;

    const label = dist.toFixed(2) + 'm';
    s += dxfText(tx, ty, label, layerName || 'DISTANCES', textH, 'CENTER', angleDeg);
  }
  return s;
}

/* ─── COORDINATE UTILS ────────────────────────────────────────────────── */
function latlon2proj(lat, lng, epsg) {
  if (epsg === 'EPSG:4326') return { x: lng, y: lat };
  return fromWGS84(lat, lng, epsg);
}

function latlngs2proj(lls, epsg) {
  if (Array.isArray(lls[0])) lls = lls[0];
  return lls.map(ll => latlon2proj(ll.lat, ll.lng, epsg)).filter(Boolean);
}

function extractPolylineSegmentsDXF(rawLls) {
  if (!rawLls || !Array.isArray(rawLls) || rawLls.length === 0) return [];
  const segments = [];
  function traverse(item) {
    if (!Array.isArray(item) || item.length === 0) return;
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

function extractPolygonRingsDXF(rawLls) {
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

function fmtC(v) { return parseFloat(v).toFixed(6); }

/* ─── TXT EXPORT ──────────────────────────────────────────────────────── */
function exportTXT() {
  const layers = drawnItems.getLayers();
  if (layers.length === 0) { alert('Aucun element a exporter !'); return; }
  const epsg = document.getElementById('sel-projection').value;
  const projTxt = document.getElementById('sel-projection').options[document.getElementById('sel-projection').selectedIndex].text;
  const projectName = (document.getElementById('project-name')||{}).value || 'Map_Tools';

  let txt  = '# Map Tools Export - ' + new Date().toLocaleString() + '\r\n';
  txt += '# Projection: ' + projTxt + ' (' + epsg + ')\r\n';
  txt += '# Format: N\tX\t\tY\t\tAlt\tType\r\n\r\n';
  let n = 1;

  drawnItems.eachLayer(function(layer) {
    if (layer._isCoordsMarker || layer._isDistLabel || layer._elementType === 'dist-label') return;
    const type = layer._elementType || '';
    const altStr = (layer._altitude !== undefined && layer._altitude !== null && !isNaN(layer._altitude))
      ? parseFloat(layer._altitude).toFixed(3)
      : '0.000';
    if (type === 'coord') {
      const ll = layer.getLatLng();
      const p = latlon2proj(ll.lat, ll.lng, epsg);
      if (p) { txt += (layer._elementName || ('N' + n++)) + '\t' + p.x.toFixed(6) + '\t' + p.y.toFixed(6) + '\t' + altStr + '\tcoord\r\n'; }
    } else if (type === 'foyer') {
      const center = layer.getBounds().getCenter();
      const p = latlon2proj(center.lat, center.lng, epsg);
      if (p) { txt += (layer._elementName || ('FOYER_' + n++)) + '\t' + p.x.toFixed(6) + '\t' + p.y.toFixed(6) + '\t' + altStr + '\tfoyer\r\n'; }
    } else if (layer instanceof L.Marker) {
      const ll = layer.getLatLng();
      const p = latlon2proj(ll.lat, ll.lng, epsg);
      const markerName = layer._elementName || ('N' + n++);
      const poleType = layer._poleType || type;
      if (p) { txt += markerName + '\t' + p.x.toFixed(6) + '\t' + p.y.toFixed(6) + '\t' + altStr + '\t' + poleType + '\r\n'; }
    } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      if (layer._isParallel) return;
      txt += '\r\n# --- ' + (layer._elementName||type) + ' ---\r\n';
      let lls = layer.getLatLngs();
      if (Array.isArray(lls[0])) lls = lls[0];
      lls.forEach(function(ll) {
        const p = latlon2proj(ll.lat, ll.lng, epsg);
        if (p) { txt += 'N' + n++ + '\t' + p.x.toFixed(6) + '\t' + p.y.toFixed(6) + '\t' + altStr + '\t' + type + '\r\n'; }
      });
    }
  });

  downloadFile(txt, projectName.replace(/\s+/g,'_') + '_export.txt', 'text/plain');
  setStatus('TXT exporte avec ' + (n-1) + ' point(s) N#.');
}

/* ─── JPG EXPORT ──────────────────────────────────────────────────────── */
function exportJPG() {
  setStatus('Capture en cours...');
  if (typeof html2canvas !== 'undefined') {
    html2canvas(document.getElementById('map'), { useCORS: true, allowTaint: true, logging: false, scale: 2 })
      .then(function(canvas) {
        canvas.toBlob(function(blob) {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = ((document.getElementById('project-name')||{}).value || 'Map_Tools').replace(/\s+/g,'_') + '_carte.jpg';
          a.click(); URL.revokeObjectURL(url);
          setStatus('Image exportee.');
        }, 'image/jpeg', 0.95);
      }).catch(function(e) {
        console.error(e); alert('Erreur capture. Utilisez Impr.Ecran.'); setStatus('Erreur.');
      });
  } else { alert('Utilisez Impr.Ecran.'); }
}

/* ─── DOWNLOAD HELPER ─────────────────────────────────────────────────── */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
