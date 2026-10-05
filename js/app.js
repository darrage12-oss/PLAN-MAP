/**
 * app.js - Main application logic (Updated: route, piste, BT tools)
 */

document.addEventListener('DOMContentLoaded', function() {

  /* INIT */
  initProjections();
  initMap();
  setupDrawEvents();
  updateUnitLabels();

  /* MAP TYPE */
  document.getElementById('sel-maptype').addEventListener('change', function() {
    switchTileLayer(this.value);
    setStatus('Fond de carte: ' + this.options[this.selectedIndex].text);
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    if (this.value === 'osm' || this.value === 'topo' || this.value === 'dark') {
      document.querySelector('[data-view="plan"]').classList.add('active');
    } else {
      document.querySelector('[data-view="satellite"]').classList.add('active');
    }
  });

  /* VIEW TOGGLE */
  document.querySelectorAll('.view-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const view = this.dataset.view;
      if (view === 'plan') {
        switchTileLayer('osm');
        document.getElementById('sel-maptype').value = 'osm';
      } else {
        switchTileLayer('satellite');
        document.getElementById('sel-maptype').value = 'satellite';
      }
    });
  });

  /* COUNTRY */
  document.getElementById('sel-country').addEventListener('change', function() {
    goToCountry(this.value);
    const projSelect = document.getElementById('sel-projection');
    if (this.value === 'MA') projSelect.value = 'EPSG:26191';
    else if (this.value === 'FR') projSelect.value = 'EPSG:2154';
    else if (this.value === 'DZ') projSelect.value = 'EPSG:32631';
    else if (this.value === 'TN') projSelect.value = 'EPSG:32632';
    else if (this.value === 'ES') projSelect.value = 'EPSG:32630';
    else if (this.value === 'SN' || this.value === 'MR') projSelect.value = 'EPSG:32628';
    else if (this.value === 'LY') projSelect.value = 'EPSG:32633';
    updateUnitLabels();
    if (window.refreshPointsList) window.refreshPointsList();
    setStatus('Navigation vers: ' + this.options[this.selectedIndex].text + ' | Projection: ' + projSelect.options[projSelect.selectedIndex].text);
  });

  /* ALTITUDE */
  const chkAlt = document.getElementById('chk-altitude');
  if (chkAlt) {
    chkAlt.addEventListener('change', function() {
      window.SHOW_ALTITUDE = this.checked;
      if (typeof drawnItems !== 'undefined' && drawnItems) {
        drawnItems.eachLayer(layer => {
          if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel) {
            if (typeof updateSupportDisplay === 'function') updateSupportDisplay(layer);
            if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
          }
        });
      }
      if (window.refreshPointsList) window.refreshPointsList();
      setStatus(this.checked ? 'Altitude activée.' : 'Altitude masquée.');
    });
  }

  /* PROJECTION */
  document.getElementById('sel-projection').addEventListener('change', function() {
    updateUnitLabels();
    if (typeof drawnItems !== 'undefined' && drawnItems) {
      drawnItems.eachLayer(layer => {
        if (layer instanceof L.Marker && !layer._isCoordsMarker && !layer._isDistLabel) {
          if (typeof updateSupportDisplay === 'function') updateSupportDisplay(layer);
          if (typeof updateSupportPopup === 'function') updateSupportPopup(layer);
        }
      });
    }
    if (window.refreshPointsList) window.refreshPointsList();
    setStatus('Projection: ' + this.options[this.selectedIndex].text);
  });

  /* GOTO */
  document.getElementById('btn-goto').addEventListener('click', function() {
    const x = document.getElementById('input-x').value;
    const y = document.getElementById('input-y').value;
    const epsg = document.getElementById('sel-projection').value;
    goToCoords(x, y, epsg);
  });
  ['input-x','input-y'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('btn-goto').click();
    });
  });

  /* EXAMPLE */
  document.getElementById('btn-example').addEventListener('click', function() {
    const epsg = document.getElementById('sel-projection').value;
    let x, y;
    if (epsg === 'EPSG:4326') { x = -5.4; y = 31.79; }
    else if (epsg.startsWith('EPSG:261')) { x = 500000; y = 300000; }
    else if (epsg === 'EPSG:32629' || epsg === 'EPSG:32630') { x = 400000; y = 3500000; }
    else { x = -600000; y = 3800000; }
    document.getElementById('input-x').value = x;
    document.getElementById('input-y').value = y;
    goToCoords(x, y, epsg);
  });

  /* SEARCH */
  document.getElementById('btn-search').addEventListener('click', function() {
    searchPlace(document.getElementById('search-input').value);
  });
  document.getElementById('search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') searchPlace(this.value);
  });

  /* ── DRAW TOOLS ─────────────────────────────────────────── */
  function toggleTool(type) {
    if (activeTool === type) { stopCurrentDraw(); setStatus('Dessin annule.'); }
    else startDraw(type);
  }

  document.getElementById('tool-pba').addEventListener('click',     function() { toggleTool('pba'); });
  document.getElementById('tool-acier').addEventListener('click',   function() { toggleTool('acier'); });
  document.getElementById('tool-foyer').addEventListener('click',   function() { toggleTool('foyer'); });
  document.getElementById('tool-coord').addEventListener('click',   function() { toggleTool('coord'); });
  document.getElementById('tool-piste').addEventListener('click',   function() { toggleTool('piste'); });
  document.getElementById('tool-route').addEventListener('click',   function() { toggleTool('route'); });
  document.getElementById('tool-line').addEventListener('click',    function() { toggleTool('line'); });
  document.getElementById('tool-bt').addEventListener('click',      function() { toggleTool('bt'); });
  document.getElementById('tool-btExt').addEventListener('click',   function() { toggleTool('btExt'); });
  const toolMt = document.getElementById('tool-mt');
  if (toolMt) toolMt.addEventListener('click', function() { toggleTool('mt'); });
  const toolMtExt = document.getElementById('tool-mtExt');
  if (toolMtExt) toolMtExt.addEventListener('click', function() { toggleTool('mtExt'); });
  const toolBtMt = document.getElementById('tool-btmt');
  if (toolBtMt) toolBtMt.addEventListener('click', function() { toggleTool('btmt'); });
  const toolNetAuto = document.getElementById('tool-network-auto');
  if (toolNetAuto) {
    toolNetAuto.addEventListener('click', function() {
      AUTO_POLES_AND_DISTANCES = !AUTO_POLES_AND_DISTANCES;
      window.AUTO_POLES_AND_DISTANCES = AUTO_POLES_AND_DISTANCES;
      if (AUTO_POLES_AND_DISTANCES) {
        toolNetAuto.classList.add('active');
        setStatus('✅ Option activée : Poteaux PBA carrés et Distances automatiques lors du tracé BT/MT.');
      } else {
        toolNetAuto.classList.remove('active');
        setStatus('⚪ Option désactivée : Tracé de ligne simple sans supports automatiques.');
      }
    });
  }
  document.getElementById('tool-polygon').addEventListener('click', function() { toggleTool('polygon'); });
  document.getElementById('tool-circle').addEventListener('click',  function() { toggleTool('circle'); });

  const btnAddPbaSidebar = document.getElementById('btn-add-pba-sidebar');
  if (btnAddPbaSidebar) btnAddPbaSidebar.addEventListener('click', function() { toggleTool('pba'); });
  const btnAddAcierSidebar = document.getElementById('btn-add-acier-sidebar');
  if (btnAddAcierSidebar) btnAddAcierSidebar.addEventListener('click', function() { toggleTool('acier'); });

  document.getElementById('tool-select').addEventListener('click', function() {
    stopCurrentDraw();
    setStatus('Mode selection: cliquez sur un element pour le modifier.');
    if (drawControl) {
      try {
        const edit = new L.EditToolbar.Edit(MAP, { featureGroup: drawnItems });
        edit.enable();
      } catch(e) { console.warn('edit mode:', e); }
    }
  });

  document.getElementById('tool-delete').addEventListener('click', enableDelete);
  document.getElementById('tool-undo').addEventListener('click',   undoLastDraw);
  document.getElementById('tool-clear').addEventListener('click',  clearAll);

  /* ── INFO PANEL ──────────────────────────────────────────── */
  document.getElementById('tool-info').addEventListener('click', function() {
    const panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) updateInfoPanel();
  });
  document.getElementById('close-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.add('hidden');
  });

  /* ── EXPORT ──────────────────────────────────────────────── */
  document.getElementById('btn-export-kml').addEventListener('click', exportKML);
  document.getElementById('btn-export-dxf').addEventListener('click', exportDXF);

  /* ── Left Sidebar (Points) ── */
  const btnToggleSidebar = document.getElementById('btn-toggle-points-sidebar');
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', function() {
      const sidebar = document.getElementById('left-sidebar');
      const isHidden = (sidebar.style.display === 'none' || !sidebar.style.display);
      sidebar.style.display = isHidden ? 'flex' : 'none';
      this.classList.toggle('active', isHidden);
    });
  }

  document.getElementById('close-left-sidebar').addEventListener('click', function() {
    document.getElementById('left-sidebar').style.display = 'none';
    if (btnToggleSidebar) btnToggleSidebar.classList.remove('active');
  });

  /* ── Rotation de la carte ── */
  const btnRotLeft  = document.getElementById('btn-rotate-left');
  const btnRotRight = document.getElementById('btn-rotate-right');
  const btnRotReset = document.getElementById('btn-rotate-reset');

  if (btnRotLeft) {
    btnRotLeft.addEventListener('click', function() {
      if (MAP && typeof MAP.setBearing === 'function') {
        const cur = MAP.getBearing ? MAP.getBearing() : 0;
        MAP.setBearing(cur - 45);
        setStatus(`Carte tournée à ${Math.round(MAP.getBearing())}°`);
      }
    });
  }
  if (btnRotRight) {
    btnRotRight.addEventListener('click', function() {
      if (MAP && typeof MAP.setBearing === 'function') {
        const cur = MAP.getBearing ? MAP.getBearing() : 0;
        MAP.setBearing(cur + 45);
        setStatus(`Carte tournée à ${Math.round(MAP.getBearing())}°`);
      }
    });
  }
  if (btnRotReset) {
    btnRotReset.addEventListener('click', function() {
      if (MAP && typeof MAP.setBearing === 'function') {
        MAP.setBearing(0);
        setStatus('Carte réinitialisée au Nord (0°).');
      }
    });
  }

  document.getElementById('btn-export-points-csv').addEventListener('click', function() {
    if (!window._lastImportedPointsLayers || window._lastImportedPointsLayers.length === 0) {
      alert("Aucun point à exporter.");
      return;
    }
    const epsg = document.getElementById('sel-projection').value;
    let csv = "Nom,X,Y,Altitude,Latitude,Longitude\n";
    window._lastImportedPointsLayers.forEach(layer => {
      const nom = (layer._elementName || '').replace(/"/g, '""');
      const ll = layer.getLatLng ? layer.getLatLng() : null;
      if (!ll) return;
      const proj = latlon2proj(ll.lat, ll.lng, epsg);
      const altStr = (layer._altitude !== undefined && layer._altitude !== null) ? (typeof layer._altitude === 'number' ? layer._altitude.toFixed(2) : layer._altitude) : '';
      if (proj) {
        csv += `"${nom}",${proj.x.toFixed(3)},${proj.y.toFixed(3)},${altStr},${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}\n`;
      }
    });
    downloadFile(csv, "Points_Importes.csv", "text/csv");
  });

  document.getElementById('btn-export-txt').addEventListener('click', exportTXT);
  document.getElementById('btn-export-jpg').addEventListener('click', exportJPG);

  /* ── FILE IMPORT ─────────────────────────────────────────── */
  document.getElementById('file-import').addEventListener('change', function() {
    if (this.files.length) { handleFileImport(this.files); this.value = ''; }
  });

  /* ── DRAG & DROP ──────────────────────────────────────────── */
  const overlay = document.getElementById('drop-overlay');
  let dragCounter = 0;

  document.addEventListener('dragenter', function(e) {
    const chk = document.getElementById('chk-dragdrop');
    if (chk && !chk.checked) return;
    e.preventDefault(); dragCounter++;
    overlay.classList.remove('hidden');
  });
  document.addEventListener('dragleave', function() {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; overlay.classList.add('hidden'); }
  });
  document.addEventListener('dragover', function(e) { e.preventDefault(); });
  document.addEventListener('drop', function(e) {
    e.preventDefault(); dragCounter = 0; overlay.classList.add('hidden');
    const chk = document.getElementById('chk-dragdrop');
    if (chk && !chk.checked) return;
    if (e.dataTransfer.files.length) handleFileImport(e.dataTransfer.files);
  });

  /* ── FILTRE DE RECHERCHE POINTS SIDEBAR ── */
  const filterPointsInp = document.getElementById('filter-points-input');
  if (filterPointsInp) {
    filterPointsInp.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('#points-list .point-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = (!q || text.includes(q)) ? 'block' : 'none';
      });
    });
  }

  /* ── SETTINGS ─────────────────────────────────────────────── */
  document.getElementById('tool-settings').addEventListener('click', function() {
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('close-settings').addEventListener('click', function() {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('settings-modal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });

  document.getElementById('color-line').addEventListener('input',    function() { STYLES.lineColor = this.value; });
  document.getElementById('color-point').addEventListener('input',   function() { STYLES.pointColor = this.value; });
  document.getElementById('color-polygon').addEventListener('input', function() { STYLES.polygonColor = this.value; });
  document.getElementById('line-weight').addEventListener('input', function() {
    STYLES.weight = parseInt(this.value);
    document.getElementById('line-weight-val').textContent = this.value;
  });
  document.getElementById('fill-opacity').addEventListener('input', function() {
    STYLES.fillOpacity = parseInt(this.value) / 100;
    document.getElementById('fill-opacity-val').textContent = this.value + '%';
  });

  /* ── DXF EXPORT SETTINGS SYNC (Police & Taille 1 à 10 m) ── */
  const topFont        = document.getElementById('top-dxf-font');
  const modalFont      = document.getElementById('modal-dxf-font');
  const topSize        = document.getElementById('top-dxf-size');
  const modalSize      = document.getElementById('modal-dxf-size');
  const modalSizeVal   = document.getElementById('modal-dxf-size-val');
  const modalOffset    = document.getElementById('modal-dxf-offset');
  const modalOffsetVal = document.getElementById('modal-dxf-offset-val');

  // Restaurer les préférences sauvegardées
  const savedFont = localStorage.getItem('dxf_font');
  if (savedFont) {
    if (topFont) topFont.value = savedFont;
    if (modalFont) modalFont.value = savedFont;
  }
  const savedSize = localStorage.getItem('dxf_size');
  if (savedSize) {
    if (topSize) topSize.value = savedSize;
    if (modalSize) modalSize.value = savedSize;
    if (modalSizeVal) modalSizeVal.textContent = parseFloat(savedSize).toFixed(1) + ' m';
    if (modalOffset) modalOffset.value = savedSize;
    if (modalOffsetVal) modalOffsetVal.textContent = parseFloat(savedSize).toFixed(1) + ' m';
  }

  function syncFont(val) {
    if (topFont) topFont.value = val;
    if (modalFont) modalFont.value = val;
    localStorage.setItem('dxf_font', val);
    const label = val.replace(/\.(ttf|shx)$/i, '');
    setStatus('Police DXF sélectionnée : ' + label);
  }

  function syncSize(val) {
    const num = parseFloat(val).toFixed(1).replace(/\.0$/, '');
    if (topSize) {
      topSize.value = num;
      if (!topSize.value && topSize.querySelector(`option[value="${val}"]`)) {
        topSize.value = val;
      }
    }
    if (modalSize) modalSize.value = val;
    if (modalSizeVal) modalSizeVal.textContent = parseFloat(val).toFixed(1) + ' m';

    // Synchroniser automatiquement le décalage par défaut sur la taille
    if (modalOffset && !modalOffset._manuallyAdjusted) {
      modalOffset.value = val;
      if (modalOffsetVal) modalOffsetVal.textContent = parseFloat(val).toFixed(1) + ' m';
    }
    localStorage.setItem('dxf_size', val);
    setStatus('Taille texte DXF ajustée : ' + parseFloat(val).toFixed(1) + ' m');
  }

  if (topFont)   topFont.addEventListener('change',   function() { syncFont(this.value); });
  if (modalFont) modalFont.addEventListener('change', function() { syncFont(this.value); });

  if (topSize)   topSize.addEventListener('change',   function() { syncSize(this.value); });
  if (modalSize) modalSize.addEventListener('input',  function() { syncSize(this.value); });

  if (modalOffset) {
    modalOffset.addEventListener('input', function() {
      modalOffset._manuallyAdjusted = true;
      if (modalOffsetVal) modalOffsetVal.textContent = parseFloat(this.value).toFixed(1) + ' m';
      setStatus('Décalage texte DXF ajusté : ' + parseFloat(this.value).toFixed(1) + ' m');
    });
  }

  /* ── ANGLE UNIT ───────────────────────────────────────────── */
  document.querySelectorAll('input[name="angle-unit"]').forEach(function(r) {
    r.addEventListener('change', updateUnitLabels);
  });

  /* ── FULLSCREEN ───────────────────────────────────────────── */
  document.getElementById('tool-expand').addEventListener('click', function() {
    const mapEl = document.getElementById('main-layout');
    if (document.fullscreenElement) { document.exitFullscreen(); }
    else { mapEl.requestFullscreen().catch(function(e) { console.warn('Fullscreen:', e); }); }
  });

  /* ── KEYBOARD SHORTCUTS ───────────────────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch(e.key) {
      case 'Escape': stopCurrentDraw(); setStatus('Dessin annule.'); break;
      case 'p': case 'P': toggleTool('foyer'); break;
      case 'x': case 'X': toggleTool('coord'); break;
      case 'r': case 'R': toggleTool('route'); break;
      case 't': case 'T': toggleTool('piste'); break;
      case 'l': case 'L': toggleTool('line'); break;
      case 'b': case 'B': toggleTool('bt'); break;
      case 'e': case 'E': toggleTool('btExt'); break;
      case 'g': case 'G': toggleTool('polygon'); break;
      case 'c': case 'C': toggleTool('circle'); break;
      case 'Delete': enableDelete(); break;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault(); undoLastDraw();
    }
  });

  setStatus('Bienvenue ! Outils: Foyer(P), Route(R), Piste(T), Ligne(L), BT Neuf(B), BT Exist(E), Polygone(G).');
  goToCountry('MA');
});

/* HELPERS */
function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}

function updateUnitLabels() {
  const epsg = document.getElementById('sel-projection').value;
  const unit = getUnitLabel(epsg);
  document.getElementById('unit-x').textContent = unit;
  document.getElementById('unit-y').textContent = unit;
}


