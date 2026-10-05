/**
 * Map Tools Application Logic
 */

// Application State
const state = {
    map: null,
    baseMaps: {},
    drawnFeatures: [], // Array of { id, type, name, layer, coords, elevations, distance, area }
    activeTool: null, // 'marker' | 'path' | 'polygon' | null
    tempDraw: {
        points: [],
        markers: [],
        polyline: null,
        polygon: null
    },
    selectedFeature: null,
    elevationProfile: {
        featureId: null,
        data: [] // Array of { distance, elevation, latlng }
    },
    toastTimeout: null
};

/**
 * Calculate the area of a polygon in square meters using the UTM projected coordinates
 * @param {Array} coords - Array of L.LatLng objects or objects with {lat, lng}
 * @returns {number} - Area in square meters
 */
function calculatePolygonArea(coords) {
    if (coords.length < 3) return 0;
    let area = 0;
    const n = coords.length;
    
    // Project all coordinates to UTM
    const utmCoords = coords.map(c => {
        const converted = transformCoordinates(c.lat, c.lng || c.lon);
        return converted ? { x: converted.utm.x, y: converted.utm.y } : { x: 0, y: 0 };
    });

    // Shoelace formula
    for (let i = 0; i < n; i++) {
        const p1 = utmCoords[i];
        const p2 = utmCoords[(i + 1) % n];
        area += p1.x * p2.y - p2.x * p1.y;
    }
    return 0.5 * Math.abs(area);
}


// Custom icons / markers styling
const MARKER_STYLE = {
    radius: 7,
    fillColor: '#6366f1',
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.95
};

const TEMP_MARKER_STYLE = {
    radius: 5,
    fillColor: '#10b981',
    color: '#ffffff',
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.8
};

const HIGHLIGHT_MARKER_STYLE = {
    radius: 9,
    fillColor: '#f43f5e',
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
    className: 'pulsing-marker'
};

const SHAPE_STYLE = {
    color: '#6366f1',
    weight: 3,
    opacity: 0.85,
    fillColor: '#6366f1',
    fillOpacity: 0.15
};

const DRAWING_SHAPE_STYLE = {
    color: '#10b981',
    weight: 2.5,
    opacity: 0.8,
    dashArray: '5, 5',
    fillColor: '#10b981',
    fillOpacity: 0.1
};

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    showToast('Application chargée. Cliquez sur la carte pour explorer.', 'info');
});

// Map Initialization
function initMap() {
    // 1. Define Base Tile Layers
    state.baseMaps.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    state.baseMaps.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    state.baseMaps.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    });

    // 2. Initialize Leaflet Map (Centered in France/Europe by default)
    state.map = L.map('map', {
        center: [46.603354, 1.888334],
        zoom: 6,
        layers: [state.baseMaps.osm],
        zoomControl: true
    });

    // 3. Add Layer Control
    L.control.layers({
        "Rues (OpenStreetMap)": state.baseMaps.osm,
        "Satellite (Esri)": state.baseMaps.satellite,
        "Relief (OpenTopoMap)": state.baseMaps.topo
    }, null, { position: 'topright' }).addTo(state.map);

    // Adjust Zoom Control Position
    state.map.zoomControl.setPosition('bottomleft');
}

// Set up UI Event Listeners
function setupEventListeners() {
    const mapContainer = document.getElementById('map');

    // Sidebar toggles
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('floating-sidebar-btn').addEventListener('click', toggleSidebar);

    // Map Mouse Move for Live Coordinates Display
    state.map.on('mousemove', (e) => {
        updateLiveCoords(e.latlng);
    });

    // Map Click Handler
    state.map.on('click', handleMapClick);

    // Drawing Tools Panel Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tool = btn.getAttribute('data-tool');
            if (tool) setActiveTool(tool);
        });
    });

    // Escape key terminates drawing
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.activeTool) {
            cancelDrawing();
            showToast('Dessin annulé', 'info');
        }
    });

    // Manual Coordinates Form Submission
    document.getElementById('manual-coords-form').addEventListener('submit', handleManualCoordsSubmit);

    // Search Location Form
    document.getElementById('search-btn').addEventListener('click', handleAddressSearch);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddressSearch();
    });

    // Import File
    document.getElementById('import-file-input').addEventListener('change', handleFileImport);

    // Export Buttons
    document.getElementById('export-csv').addEventListener('click', () => exportData('csv'));
    document.getElementById('export-geojson').addEventListener('click', () => exportData('geojson'));
    document.getElementById('export-kml').addEventListener('click', () => exportData('kml'));
    document.getElementById('export-gpx').addEventListener('click', () => exportData('gpx'));

    // Close Elevation Profile
    document.getElementById('close-profile-btn').addEventListener('click', closeElevationProfile);
}

// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('floating-sidebar-btn');
    sidebar.classList.toggle('collapsed');
    
    if (sidebar.classList.contains('collapsed')) {
        trigger.style.display = 'flex';
    } else {
        trigger.style.display = 'none';
    }
    
    // Invalidate map size to recalculate viewport correctly after layout transitions
    setTimeout(() => {
        state.map.invalidateSize();
    }, 300);
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Live coordinates updates on mouse movement
function updateLiveCoords(latlng) {
    const lat = latlng.lat;
    const lon = latlng.lng;
    
    const converted = transformCoordinates(lat, lon);
    if (!converted) return;

    document.getElementById('live-lat').textContent = lat.toFixed(6);
    document.getElementById('live-lon').textContent = lon.toFixed(6);
    document.getElementById('live-utm').textContent = `${converted.utm.zone}${converted.utm.band} E:${converted.utm.x.toFixed(0)} N:${converted.utm.y.toFixed(0)}`;
    
    // Lambert 93 is only relevant in France area, check bounds approximately
    if (lat > 41 && lat < 52 && lon > -5 && lon < 10) {
        document.getElementById('live-lambert').textContent = `X:${converted.lambert93.x.toFixed(0)} Y:${converted.lambert93.y.toFixed(0)}`;
    } else {
        document.getElementById('live-lambert').textContent = 'Hors France';
    }
}

// Active drawing tool management
function setActiveTool(tool) {
    // If drawing in progress, cancel it
    if (state.activeTool) {
        cancelDrawing();
    }

    const buttons = document.querySelectorAll('.tool-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    if (state.activeTool === tool) {
        // Toggle off
        state.activeTool = null;
        state.map.getContainer().style.cursor = '';
        showToast('Mode exploration actif', 'info');
        return;
    }

    state.activeTool = tool;
    const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tool === 'marker') {
        state.map.getContainer().style.cursor = 'crosshair';
        showToast('Cliquez sur la carte pour ajouter un point', 'info');
    } else if (tool === 'path') {
        state.map.getContainer().style.cursor = 'pencil';
        showToast('Cliquez pour tracer une ligne, double-cliquez pour finir', 'info');
    } else if (tool === 'polygon') {
        state.map.getContainer().style.cursor = 'pencil';
        showToast('Cliquez pour tracer un polygone, double-cliquez pour fermer', 'info');
    }
}

// Cancel current drawing
function cancelDrawing() {
    state.tempDraw.points = [];
    
    state.tempDraw.markers.forEach(m => state.map.removeLayer(m));
    state.tempDraw.markers = [];
    
    if (state.tempDraw.polyline) {
        state.map.removeLayer(state.tempDraw.polyline);
        state.tempDraw.polyline = null;
    }
    
    if (state.tempDraw.polygon) {
        state.map.removeLayer(state.tempDraw.polygon);
        state.tempDraw.polygon = null;
    }
    
    setActiveTool(null);
}

// Open-Meteo elevation service (Z)
async function fetchElevation(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.elevation ? data.elevation[0] : null;
    } catch (err) {
        console.warn('Elevation API error:', err);
        return null;
    }
}

async function fetchElevationsBatch(coords) {
    if (coords.length === 0) return [];
    try {
        const lats = coords.map(c => c[0] || c.lat).join(',');
        const lons = coords.map(c => c[1] || c.lng).join(',');
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.elevation || coords.map(() => null);
    } catch (err) {
        console.warn('Batch Elevation API error:', err);
        return coords.map(() => null);
    }
}

// Map Click Handler
async function handleMapClick(e) {
    const latlng = e.latlng;
    
    if (!state.activeTool) {
        // Mode exploration: query coordinates X, Y, Z on click
        showClickCoordinates(latlng);
        return;
    }

    if (state.activeTool === 'marker') {
        const name = `Point ${state.drawnFeatures.filter(f => f.type === 'Point').length + 1}`;
        addPointFeature(latlng.lat, latlng.lng, name);
        setActiveTool(null); // Reset tool
    } 
    else if (state.activeTool === 'path' || state.activeTool === 'polygon') {
        addVertexToDrawing(latlng);
    }
}

// Display temporary coordinates panel on standard map click
let clickTempMarker = null;
async function showClickCoordinates(latlng) {
    if (clickTempMarker) {
        state.map.removeLayer(clickTempMarker);
    }

    clickTempMarker = L.circleMarker(latlng, TEMP_MARKER_STYLE).addTo(state.map);
    
    // Show coordinates details box in sidebar
    updateCoordinatesDetailsPanel('Calcul...', latlng.lat, latlng.lng, 'Fetching...');

    // Fetch Z coordinate
    const z = await fetchElevation(latlng.lat, latlng.lng);
    const zText = z !== null ? `${z.toFixed(2)} m` : 'Indisponible';
    
    // Update conversions
    updateCoordinatesDetailsPanel('Position cliquée', latlng.lat, latlng.lng, z);
    
    // Open a popup on the map
    const converted = transformCoordinates(latlng.lat, latlng.lng);
    const popupHtml = `
        <div class="popup-coord-box">
            <div class="popup-title">Coordonnées X, Y, Z</div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Lat (Y):</span> <span class="popup-coord-val">${latlng.lat.toFixed(6)}°</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Lon (X):</span> <span class="popup-coord-val">${latlng.lng.toFixed(6)}°</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Alt (Z):</span> <span class="popup-coord-val">${zText}</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">UTM:</span> <span class="popup-coord-val">${converted.utm.zone}${converted.utm.band}</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Easting:</span> <span class="popup-coord-val">${converted.utm.x.toFixed(1)} m</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Northing:</span> <span class="popup-coord-val">${converted.utm.y.toFixed(1)} m</span></div>
        </div>
    `;
    clickTempMarker.bindPopup(popupHtml).openPopup();
}

// Update the coordinates details sidebar card
function updateCoordinatesDetailsPanel(name, lat, lon, z) {
    const container = document.getElementById('details-container');
    container.innerHTML = '';

    const converted = transformCoordinates(lat, lon);
    if (!converted) return;

    const zVal = typeof z === 'number' ? `${z.toFixed(2)} m` : (z || 'N/A');

    const html = `
        <div class="coord-details">
            <h4 style="font-size: 0.9rem; font-weight:600; color: var(--accent); margin-bottom: 5px;">${name}</h4>
            <div class="detail-row">
                <span class="detail-label">Latitude (Y)</span>
                <span class="detail-val">${lat.toFixed(7)}°</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Longitude (X)</span>
                <span class="detail-val">${lon.toFixed(7)}°</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Altitude (Z)</span>
                <span class="detail-val" style="color: var(--success); font-weight:700;">${zVal}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">DMS Lat</span>
                <span class="detail-val">${converted.wgs84.latDMS}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">DMS Lon</span>
                <span class="detail-val">${converted.wgs84.lonDMS}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">UTM Zone</span>
                <span class="detail-val">${converted.utm.zone}${converted.utm.band} (${converted.utm.hemisphere})</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">UTM Easting (X)</span>
                <span class="detail-val">${converted.utm.x.toFixed(3)} m</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">UTM Northing (Y)</span>
                <span class="detail-val">${converted.utm.y.toFixed(3)} m</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Lambert 93 X</span>
                <span class="detail-val">${converted.lambert93.x ? converted.lambert93.x.toFixed(3) + ' m' : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Lambert 93 Y</span>
                <span class="detail-val">${converted.lambert93.y ? converted.lambert93.y.toFixed(3) + ' m' : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Lambert II X</span>
                <span class="detail-val">${converted.lambert2.x ? converted.lambert2.x.toFixed(3) + ' m' : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Lambert II Y</span>
                <span class="detail-val">${converted.lambert2.y ? converted.lambert2.y.toFixed(3) + ' m' : 'N/A'}</span>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// Add a Single Point Feature
async function addPointFeature(lat, lon, name, customZ = null) {
    let z = customZ;
    if (z === null) {
        z = await fetchElevation(lat, lon);
    }

    const id = Date.now().toString();
    const marker = L.circleMarker([lat, lon], MARKER_STYLE).addTo(state.map);
    
    // Bind tooltip & popup
    const zText = z !== null ? `${z.toFixed(2)} m` : 'N/A';
    marker.bindTooltip(`${name} (Z: ${zText})`, { permanent: false, direction: 'top' });
    
    const converted = transformCoordinates(lat, lon);
    const popupHtml = `
        <div class="popup-coord-box">
            <div class="popup-title">${name}</div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Lat (Y):</span> <span class="popup-coord-val">${lat.toFixed(6)}°</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Lon (X):</span> <span class="popup-coord-val">${lon.toFixed(6)}°</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">Alt (Z):</span> <span class="popup-coord-val">${zText}</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">UTM E:</span> <span class="popup-coord-val">${converted.utm.x.toFixed(1)}</span></div>
            <div class="popup-coord-item"><span class="popup-coord-lbl">UTM N:</span> <span class="popup-coord-val">${converted.utm.y.toFixed(1)}</span></div>
        </div>
    `;
    marker.bindPopup(popupHtml);

    // Click on marker highlights it
    marker.on('click', () => {
        selectFeature(id);
    });

    const feature = {
        id,
        type: 'Point',
        name,
        layer: marker,
        coords: [{ lat, lng: lon }],
        elevations: [z],
        distance: 0,
        area: 0
    };

    state.drawnFeatures.push(feature);
    updateFeaturesList();
    selectFeature(id);
    showToast(`Point "${name}" enregistré.`, 'success');
}

// Add points and paths from interactive drawing
async function addVertexToDrawing(latlng) {
    state.tempDraw.points.push(latlng);
    
    // Add temporary vertex marker
    const vMarker = L.circleMarker(latlng, TEMP_MARKER_STYLE).addTo(state.map);
    state.tempDraw.markers.push(vMarker);

    // Update lines
    if (state.activeTool === 'path') {
        if (!state.tempDraw.polyline) {
            state.tempDraw.polyline = L.polyline(state.tempDraw.points, DRAWING_SHAPE_STYLE).addTo(state.map);
        } else {
            state.tempDraw.polyline.setLatLngs(state.tempDraw.points);
        }
        
        // Listen to mousemove to draw helper line to mouse cursor
        state.map.off('mousemove', updateDrawGuideLine);
        state.map.on('mousemove', updateDrawGuideLine);
        
        // Double click to finish
        vMarker.on('dblclick', finishDrawing);
    } 
    else if (state.activeTool === 'polygon') {
        if (!state.tempDraw.polygon) {
            state.tempDraw.polygon = L.polygon(state.tempDraw.points, DRAWING_SHAPE_STYLE).addTo(state.map);
        } else {
            state.tempDraw.polygon.setLatLngs(state.tempDraw.points);
        }
        
        state.map.off('mousemove', updateDrawGuideLine);
        state.map.on('mousemove', updateDrawGuideLine);
        
        vMarker.on('dblclick', finishDrawing);
    }
}

// Update drawing guide line to cursor
function updateDrawGuideLine(e) {
    if (state.tempDraw.points.length === 0) return;
    
    const pts = [...state.tempDraw.points, e.latlng];
    if (state.activeTool === 'path' && state.tempDraw.polyline) {
        state.tempDraw.polyline.setLatLngs(pts);
    } else if (state.activeTool === 'polygon' && state.tempDraw.polygon) {
        state.tempDraw.polygon.setLatLngs(pts);
    }
    
    // Update live coordinates in the footer
    updateLiveCoords(e.latlng);
}

// Finalize drawn shape
async function finishDrawing() {
    state.map.off('mousemove', updateDrawGuideLine);
    
    const points = [...state.tempDraw.points];
    const type = state.activeTool === 'path' ? 'LineString' : 'Polygon';
    
    // Cleanup temporary drawings
    state.tempDraw.markers.forEach(m => state.map.removeLayer(m));
    state.tempDraw.markers = [];
    
    if (state.tempDraw.polyline) state.map.removeLayer(state.tempDraw.polyline);
    if (state.tempDraw.polygon) state.map.removeLayer(state.tempDraw.polygon);
    
    state.tempDraw.polyline = null;
    state.tempDraw.polygon = null;
    state.tempDraw.points = [];
    
    if (points.length < 2 && type === 'LineString') {
        cancelDrawing();
        showToast('Tracé annulé : pas assez de points', 'danger');
        return;
    }
    if (points.length < 3 && type === 'Polygon') {
        cancelDrawing();
        showToast('Tracé annulé : pas assez de points pour un polygone', 'danger');
        return;
    }

    const id = Date.now().toString();
    const name = type === 'LineString' 
        ? `Ligne ${state.drawnFeatures.filter(f => f.type === 'LineString').length + 1}`
        : `Surface ${state.drawnFeatures.filter(f => f.type === 'Polygon').length + 1}`;

    // Create the final layer
    let layer;
    let distance = 0;
    let area = 0;

    if (type === 'LineString') {
        layer = L.polyline(points, SHAPE_STYLE).addTo(state.map);
        // Calculate length
        for (let i = 0; i < points.length - 1; i++) {
            distance += points[i].distanceTo(points[i+1]);
        }
    } else {
        layer = L.polygon(points, SHAPE_STYLE).addTo(state.map);
        // Calculate Area using our custom UTM shoelace formula
        area = calculatePolygonArea(points);
        
        // Perimeter distance
        for (let i = 0; i < points.length; i++) {
            const nextIdx = (i + 1) % points.length;
            distance += points[i].distanceTo(points[nextIdx]);
        }
    }

    showToast('Récupération de l\'altitude...', 'info');
    const elevations = await fetchElevationsBatch(points);

    // Attach tooltip
    const descText = type === 'LineString'
        ? `Longeur: ${(distance/1000).toFixed(2)} km`
        : `Superficie: ${(area/10000).toFixed(2)} ha (${(area/1e6).toFixed(2)} km²)`;
    layer.bindTooltip(`${name}<br>${descText}`, { direction: 'top' });

    layer.on('click', () => {
        selectFeature(id);
    });

    const feature = {
        id,
        type,
        name,
        layer,
        coords: points.map(p => ({ lat: p.lat, lng: p.lng })),
        elevations,
        distance,
        area
    };

    state.drawnFeatures.push(feature);
    updateFeaturesList();
    selectFeature(id);
    setActiveTool(null);
    showToast(`Tracé "${name}" créé avec succès`, 'success');
}

// Update saved features in sidebar
function updateFeaturesList() {
    const list = document.getElementById('features-list');
    list.innerHTML = '';

    if (state.drawnFeatures.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 10px;">Aucun élément enregistré</div>`;
        return;
    }

    state.drawnFeatures.forEach(feat => {
        let desc = '';
        let icon = '';

        if (feat.type === 'Point') {
            icon = 'fa-map-marker-alt';
            desc = `Lat: ${feat.coords[0].lat.toFixed(5)}° L: ${feat.coords[0].lng.toFixed(5)}°`;
        } else if (feat.type === 'LineString') {
            icon = 'fa-route';
            desc = feat.distance > 1000 
                ? `${(feat.distance / 1000).toFixed(2)} km`
                : `${feat.distance.toFixed(0)} m`;
        } else if (feat.type === 'Polygon') {
            icon = 'fa-draw-polygon';
            desc = feat.area > 1000000
                ? `${(feat.area / 1e6).toFixed(2)} km²`
                : `${(feat.area / 10000).toFixed(1)} ha (${feat.area.toFixed(0)} m²)`;
        }

        const item = document.createElement('div');
        item.className = `feature-item ${state.selectedFeature && state.selectedFeature.id === feat.id ? 'active' : ''}`;
        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
            // Ignore click if button was clicked
            if (e.target.closest('.action-btn')) return;
            selectFeature(feat.id);
        });

        item.innerHTML = `
            <div class="feature-info">
                <span class="feature-name"><i class="fas ${icon}" style="color: var(--accent); margin-right: 5px;"></i> ${feat.name}</span>
                <span class="feature-desc">${desc}</span>
            </div>
            <div class="feature-actions">
                <button class="action-btn btn-zoom" title="Zoomer sur cet élément"><i class="fas fa-search-location"></i></button>
                <button class="action-btn btn-del" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        // Action Handlers
        item.querySelector('.btn-zoom').addEventListener('click', () => zoomToFeature(feat.id));
        item.querySelector('.btn-del').addEventListener('click', () => deleteFeature(feat.id));

        list.appendChild(item);
    });
}

// Select a feature to view conversions and show profile if line
function selectFeature(id) {
    const feat = state.drawnFeatures.find(f => f.id === id);
    if (!feat) return;

    state.selectedFeature = feat;
    updateFeaturesList();

    // Reset previous selection highlights
    state.drawnFeatures.forEach(f => {
        if (f.type === 'Point') {
            f.layer.setStyle(MARKER_STYLE);
        } else {
            f.layer.setStyle(SHAPE_STYLE);
        }
    });

    // Highlight current selection
    if (feat.type === 'Point') {
        feat.layer.setStyle({ fillColor: '#f43f5e', color: '#fff' });
        updateCoordinatesDetailsPanel(feat.name, feat.coords[0].lat, feat.coords[0].lng, feat.elevations[0]);
        closeElevationProfile();
    } else {
        feat.layer.setStyle({ color: '#f43f5e', fillOpacity: 0.25 });
        
        // For lines/polygons, show details of the first point in coordinates detail
        const midPoint = feat.coords[Math.floor(feat.coords.length / 2)];
        updateCoordinatesDetailsPanel(`${feat.name} (Milieu)`, midPoint.lat, midPoint.lng, feat.elevations[Math.floor(feat.elevations.length / 2)]);
        
        // Show Elevation Profile for lines
        if (feat.type === 'LineString') {
            openElevationProfile(feat);
        } else {
            closeElevationProfile();
        }
    }
}

// Zoom to Feature
function zoomToFeature(id) {
    const feat = state.drawnFeatures.find(f => f.id === id);
    if (!feat) return;
    
    if (feat.type === 'Point') {
        state.map.setView([feat.coords[0].lat, feat.coords[0].lng], 15);
    } else {
        state.map.fitBounds(feat.layer.getBounds(), { padding: [50, 50] });
    }
    selectFeature(id);
}

// Delete Feature
function deleteFeature(id) {
    const idx = state.drawnFeatures.findIndex(f => f.id === id);
    if (idx === -1) return;

    const feat = state.drawnFeatures[idx];
    state.map.removeLayer(feat.layer);
    state.drawnFeatures.splice(idx, 1);

    if (state.selectedFeature && state.selectedFeature.id === id) {
        state.selectedFeature = null;
        document.getElementById('details-container').innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px;">Cliquez sur un élément ou sur la carte pour voir ses coordonnées</div>`;
        closeElevationProfile();
    }

    updateFeaturesList();
    showToast(`Élément "${feat.name}" supprimé.`, 'info');
}

// Handle coordinates entered manually
function handleManualCoordsSubmit(e) {
    e.preventDefault();
    const latVal = parseFloat(document.getElementById('manual-lat').value);
    const lonVal = parseFloat(document.getElementById('manual-lon').value);
    const zValRaw = document.getElementById('manual-z').value;
    const name = document.getElementById('manual-name').value || `Point ${state.drawnFeatures.filter(f => f.type === 'Point').length + 1}`;

    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
        showToast('Latitude invalide (-90 à 90)', 'danger');
        return;
    }
    if (isNaN(lonVal) || lonVal < -180 || lonVal > 180) {
        showToast('Longitude invalide (-180 à 180)', 'danger');
        return;
    }

    const customZ = zValRaw !== '' ? parseFloat(zValRaw) : null;
    
    addPointFeature(latVal, lonVal, name, customZ);
    state.map.setView([latVal, lonVal], 13);

    // Reset inputs
    document.getElementById('manual-lat').value = '';
    document.getElementById('manual-lon').value = '';
    document.getElementById('manual-z').value = '';
    document.getElementById('manual-name').value = '';
}

// Handle Nominatim Location Geocoder Search
async function handleAddressSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    showToast('Recherche de l\'adresse...', 'info');

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'fr' }
        });
        const data = await res.json();
        
        if (data.length === 0) {
            showToast('Lieu introuvable.', 'danger');
            return;
        }

        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        state.map.setView([lat, lon], 14);
        
        // Add manual point
        addPointFeature(lat, lon, result.display_name.split(',')[0]);
        
    } catch (err) {
        showToast('Erreur lors de la recherche de l\'adresse.', 'danger');
        console.error(err);
    }
}

// Open and Draw Elevation Profile for a Polyline
function openElevationProfile(feat) {
    const elevations = feat.elevations;
    const coords = feat.coords;
    
    // Construct cumulative distances
    let cumDist = 0;
    const data = [{ distance: 0, elevation: elevations[0] || 0, latlng: coords[0] }];
    
    for (let i = 1; i < coords.length; i++) {
        const p1 = L.latLng(coords[i-1].lat, coords[i-1].lng);
        const p2 = L.latLng(coords[i].lat, coords[i].lng);
        cumDist += p1.distanceTo(p2);
        data.push({
            distance: cumDist,
            elevation: elevations[i] || 0,
            latlng: coords[i]
        });
    }

    state.elevationProfile.featureId = feat.id;
    state.elevationProfile.data = data;

    // Open Panel
    const container = document.getElementById('elevation-profile');
    container.classList.add('open');

    // Draw SVG Chart
    renderElevationChart(data);
}

function closeElevationProfile() {
    const container = document.getElementById('elevation-profile');
    container.classList.remove('open');
    state.elevationProfile.featureId = null;
    state.elevationProfile.data = [];
    
    if (chartHighlightMarker) {
        state.map.removeLayer(chartHighlightMarker);
        chartHighlightMarker = null;
    }
}

// Render SVG chart inside wrapper
let chartHighlightMarker = null;
function renderElevationChart(data) {
    const wrapper = document.getElementById('profile-chart-wrapper');
    const svg = document.getElementById('profile-svg');
    svg.innerHTML = ''; // Clear SVG

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    if (width <= 0 || height <= 0) return;

    // Statistics
    const elevationsValid = data.map(d => d.elevation).filter(e => e !== null);
    const minElev = Math.min(...elevationsValid);
    const maxElev = Math.max(...elevationsValid);
    const totalDist = data[data.length - 1].distance;

    document.getElementById('stat-dist').textContent = totalDist > 1000 
        ? `${(totalDist/1000).toFixed(2)} km` 
        : `${totalDist.toFixed(0)} m`;
    document.getElementById('stat-min').textContent = `${minElev.toFixed(2)} m`;
    document.getElementById('stat-max').textContent = `${maxElev.toFixed(2)} m`;
    document.getElementById('stat-deniv').textContent = `${(maxElev - minElev).toFixed(2)} m`;

    const padding = { top: 15, right: 30, bottom: 25, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Helpers to project distance/elevation to SVG coordinates
    const scaleX = (dist) => padding.left + (dist / totalDist) * chartW;
    
    // Set a range buffer for Y-axis (elevation)
    const elevBuffer = (maxElev - minElev) * 0.1 || 20;
    const yMin = minElev - elevBuffer;
    const yMax = maxElev + elevBuffer;
    
    const scaleY = (elev) => padding.top + (1 - (elev - yMin) / (yMax - yMin)) * chartH;

    // 1. Create Grid and Axes
    let svgContent = '';
    
    // Add Linear Gradient definition
    svgContent += `
        <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
    `;

    // Horizontal grid lines (4 divisions)
    for (let i = 0; i <= 4; i++) {
        const val = yMin + (i / 4) * (yMax - yMin);
        const y = scaleY(val);
        svgContent += `
            <line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />
            <text class="chart-text" x="${padding.left - 10}" y="${y + 3}" text-anchor="end">${val.toFixed(0)}m</text>
        `;
    }

    // Vertical grid lines (5 divisions)
    for (let i = 0; i <= 5; i++) {
        const distVal = (i / 5) * totalDist;
        const x = scaleX(distVal);
        const textVal = distVal > 1000 
            ? `${(distVal/1000).toFixed(1)} km` 
            : `${distVal.toFixed(0)} m`;
        svgContent += `
            <line class="chart-grid" x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" />
            <text class="chart-text" x="${x}" y="${height - padding.bottom + 15}" text-anchor="middle">${textVal}</text>
        `;
    }

    // 2. Generate SVG Paths for Area and Line
    let pathD = `M ${scaleX(data[0].distance)} ${scaleY(data[0].elevation)}`;
    for (let i = 1; i < data.length; i++) {
        pathD += ` L ${scaleX(data[i].distance)} ${scaleY(data[i].elevation)}`;
    }

    const areaD = `${pathD} L ${scaleX(data[data.length - 1].distance)} ${height - padding.bottom} L ${scaleX(data[0].distance)} ${height - padding.bottom} Z`;

    svgContent += `<path class="chart-area" d="${areaD}" />`;
    svgContent += `<path class="chart-line" d="${pathD}" />`;

    // Add Interactive Components (Hover Guide and Circle)
    svgContent += `
        <line id="hover-guide" class="chart-hover-line" x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}" />
        <circle id="hover-marker" class="chart-marker" />
    `;

    svg.innerHTML = svgContent;

    // Attach Interactive Mouse Events
    const hoverGuide = document.getElementById('hover-guide');
    const hoverMarker = document.getElementById('hover-marker');

    svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        if (mouseX >= padding.left && mouseX <= width - padding.right) {
            // Convert mouse X position back to distance
            const ratio = (mouseX - padding.left) / chartW;
            const targetDist = ratio * totalDist;
            
            // Find closest index in data points
            let closestIdx = 0;
            let minDiff = Infinity;
            for (let i = 0; i < data.length; i++) {
                const diff = Math.abs(data[i].distance - targetDist);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            }

            const item = data[closestIdx];
            const svgX = scaleX(item.distance);
            const svgY = scaleY(item.elevation);

            // Update guides
            hoverGuide.setAttribute('x1', svgX);
            hoverGuide.setAttribute('x2', svgX);
            hoverGuide.style.display = 'block';

            hoverMarker.setAttribute('cx', svgX);
            hoverMarker.setAttribute('cy', svgY);
            hoverMarker.style.display = 'block';

            // Show highlight marker on map
            if (chartHighlightMarker) {
                state.map.removeLayer(chartHighlightMarker);
            }
            chartHighlightMarker = L.circleMarker([item.latlng.lat, item.latlng.lng], HIGHLIGHT_MARKER_STYLE).addTo(state.map);
        }
    });

    svg.addEventListener('mouseleave', () => {
        hoverGuide.style.display = 'none';
        hoverMarker.style.display = 'none';
        if (chartHighlightMarker) {
            state.map.removeLayer(chartHighlightMarker);
            chartHighlightMarker = null;
        }
    });
}

// Redraw chart on window resize
window.addEventListener('resize', () => {
    if (state.elevationProfile.featureId) {
        renderElevationChart(state.elevationProfile.data);
    }
});

// Import CSV, GPX, KML, GeoJSON
function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop().toLowerCase();

    reader.onload = async (event) => {
        const content = event.target.result;
        
        try {
            if (extension === 'json' || extension === 'geojson') {
                importGeoJSON(JSON.parse(content));
            } else if (extension === 'gpx') {
                importGPX(content);
            } else if (extension === 'kml') {
                importKML(content);
            } else if (extension === 'csv') {
                importCSV(content);
            } else {
                showToast('Format de fichier non pris en charge.', 'danger');
            }
        } catch (err) {
            console.error(err);
            showToast('Erreur lors du traitement du fichier.', 'danger');
        }
        
        // Reset file input
        e.target.value = '';
    };

    if (extension === 'json' || extension === 'geojson' || extension === 'kml' || extension === 'gpx' || extension === 'csv') {
        reader.readAsText(file);
    } else {
        showToast('Format non supporté (utilisez CSV, GPX, KML, GeoJSON)', 'danger');
    }
}

// Parse and import GeoJSON
async function importGeoJSON(geojson) {
    let count = 0;
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];

    for (const feat of features) {
        const type = feat.geometry.type;
        const name = feat.properties?.name || `${type} Importé`;

        if (type === 'Point') {
            const [lon, lat] = feat.geometry.coordinates;
            const z = feat.geometry.coordinates[2] !== undefined ? feat.geometry.coordinates[2] : null;
            await addPointFeature(lat, lon, name, z);
            count++;
        } 
        else if (type === 'LineString' || type === 'Polygon') {
            const coords = feat.geometry.coordinates.map(pt => L.latLng(pt[1], pt[0]));
            let zList = feat.geometry.coordinates.map(pt => pt[2] !== undefined ? pt[2] : null);
            
            const hasNullZ = zList.some(z => z === null);
            if (hasNullZ) {
                // Fetch elevations
                zList = await fetchElevationsBatch(coords);
            }

            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            let layer;
            let distance = 0;
            let area = 0;

            if (type === 'LineString') {
                layer = L.polyline(coords, SHAPE_STYLE).addTo(state.map);
                for (let i = 0; i < coords.length - 1; i++) {
                    distance += coords[i].distanceTo(coords[i+1]);
                }
            } else {
                layer = L.polygon(coords, SHAPE_STYLE).addTo(state.map);
                area = calculatePolygonArea(coords);
                for (let i = 0; i < coords.length; i++) {
                    const nextIdx = (i + 1) % coords.length;
                    distance += coords[i].distanceTo(coords[nextIdx]);
                }
            }

            const descText = type === 'LineString'
                ? `Longeur: ${(distance/1000).toFixed(2)} km`
                : `Superficie: ${(area/10000).toFixed(2)} ha`;
            layer.bindTooltip(`${name}<br>${descText}`, { direction: 'top' });
            
            layer.on('click', () => selectFeature(id));

            state.drawnFeatures.push({
                id,
                type,
                name,
                layer,
                coords: coords.map(c => ({ lat: c.lat, lng: c.lng })),
                elevations: zList,
                distance,
                area
            });
            count++;
        }
    }
    
    updateFeaturesList();
    if (count > 0) {
        showToast(`${count} élément(s) importé(s)`, 'success');
        // Zoom on last element
        const last = state.drawnFeatures[state.drawnFeatures.length - 1];
        zoomToFeature(last.id);
    }
}

// Parse GPX
async function importGPX(gpxContent) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(gpxContent, 'text/xml');
    
    let count = 0;

    // 1. Waypoints (<wpt>)
    const wpts = xml.getElementsByTagName('wpt');
    for (let i = 0; i < wpts.length; i++) {
        const lat = parseFloat(wpts[i].getAttribute('lat'));
        const lon = parseFloat(wpts[i].getAttribute('lon'));
        const nameEl = wpts[i].getElementsByTagName('name')[0];
        const name = nameEl ? nameEl.textContent : `Waypoint ${i+1}`;
        const eleEl = wpts[i].getElementsByTagName('ele')[0];
        const ele = eleEl ? parseFloat(eleEl.textContent) : null;
        
        await addPointFeature(lat, lon, name, ele);
        count++;
    }

    // 2. Tracks (<trk>)
    const trks = xml.getElementsByTagName('trk');
    for (let i = 0; i < trks.length; i++) {
        const nameEl = trks[i].getElementsByTagName('name')[0];
        const name = nameEl ? nameEl.textContent : `Trace GPX ${i+1}`;
        
        const trkpts = trks[i].getElementsByTagName('trkpt');
        const coords = [];
        const elevations = [];

        for (let j = 0; j < trkpts.length; j++) {
            const lat = parseFloat(trkpts[j].getAttribute('lat'));
            const lon = parseFloat(trkpts[j].getAttribute('lon'));
            const eleEl = trkpts[j].getElementsByTagName('ele')[0];
            
            coords.push(L.latLng(lat, lon));
            elevations.push(eleEl ? parseFloat(eleEl.textContent) : null);
        }

        if (coords.length >= 2) {
            const hasNullZ = elevations.some(z => z === null);
            let finalElevations = elevations;
            if (hasNullZ) {
                finalElevations = await fetchElevationsBatch(coords);
            }

            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const layer = L.polyline(coords, SHAPE_STYLE).addTo(state.map);
            
            let distance = 0;
            for (let j = 0; j < coords.length - 1; j++) {
                distance += coords[j].distanceTo(coords[j+1]);
            }

            layer.bindTooltip(`${name}<br>Longeur: ${(distance/1000).toFixed(2)} km`, { direction: 'top' });
            layer.on('click', () => selectFeature(id));

            state.drawnFeatures.push({
                id,
                type: 'LineString',
                name,
                layer,
                coords: coords.map(c => ({ lat: c.lat, lng: c.lng })),
                elevations: finalElevations,
                distance,
                area: 0
            });
            count++;
        }
    }

    updateFeaturesList();
    if (count > 0) {
        showToast(`${count} élément(s) GPX importé(s)`, 'success');
        const last = state.drawnFeatures[state.drawnFeatures.length - 1];
        zoomToFeature(last.id);
    } else {
        showToast('Aucun point ou tracé trouvé dans le GPX', 'warning');
    }
}

// Parse KML
async function importKML(kmlContent) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlContent, 'text/xml');
    const placemarks = xml.getElementsByTagName('Placemark');
    let count = 0;

    for (let i = 0; i < placemarks.length; i++) {
        const nameEl = placemarks[i].getElementsByTagName('name')[0];
        const name = nameEl ? nameEl.textContent : `Placemark ${i+1}`;
        
        // Check geometry
        const pt = placemarks[i].getElementsByTagName('Point')[0];
        const line = placemarks[i].getElementsByTagName('LineString')[0];
        const poly = placemarks[i].getElementsByTagName('Polygon')[0];

        if (pt) {
            const coordStr = pt.getElementsByTagName('coordinates')[0].textContent.trim();
            const [lon, lat, ele] = coordStr.split(',').map(parseFloat);
            await addPointFeature(lat, lon, name, isNaN(ele) ? null : ele);
            count++;
        } 
        else if (line) {
            const coordStr = line.getElementsByTagName('coordinates')[0].textContent.trim();
            const coordLines = coordStr.split(/\s+/).filter(c => c.trim() !== '');
            
            const coords = [];
            const elevations = [];

            coordLines.forEach(lineStr => {
                const [lon, lat, ele] = lineStr.split(',').map(parseFloat);
                coords.push(L.latLng(lat, lon));
                elevations.push(isNaN(ele) ? null : ele);
            });

            if (coords.length >= 2) {
                const hasNullZ = elevations.some(z => z === null);
                let finalElevs = elevations;
                if (hasNullZ) {
                    finalElevs = await fetchElevationsBatch(coords);
                }

                const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                const layer = L.polyline(coords, SHAPE_STYLE).addTo(state.map);
                
                let distance = 0;
                for (let j = 0; j < coords.length - 1; j++) {
                    distance += coords[j].distanceTo(coords[j+1]);
                }

                layer.bindTooltip(`${name}<br>Longeur: ${(distance/1000).toFixed(2)} km`, { direction: 'top' });
                layer.on('click', () => selectFeature(id));

                state.drawnFeatures.push({
                    id,
                    type: 'LineString',
                    name,
                    layer,
                    coords: coords.map(c => ({ lat: c.lat, lng: c.lng })),
                    elevations: finalElevs,
                    distance,
                    area: 0
                });
                count++;
            }
        }
        else if (poly) {
            const boundaryStr = poly.getElementsByTagName('coordinates')[0].textContent.trim();
            const coordLines = boundaryStr.split(/\s+/).filter(c => c.trim() !== '');
            
            const coords = [];
            const elevations = [];

            coordLines.forEach(lineStr => {
                const [lon, lat, ele] = lineStr.split(',').map(parseFloat);
                coords.push(L.latLng(lat, lon));
                elevations.push(isNaN(ele) ? null : ele);
            });

            // Remove duplicated closing point for polygon boundary calculations if present
            if (coords.length >= 4 && coords[0].equals(coords[coords.length - 1])) {
                coords.pop();
                elevations.pop();
            }

            if (coords.length >= 3) {
                const hasNullZ = elevations.some(z => z === null);
                let finalElevs = elevations;
                if (hasNullZ) {
                    finalElevs = await fetchElevationsBatch(coords);
                }

                const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                const layer = L.polygon(coords, SHAPE_STYLE).addTo(state.map);
                
                let distance = 0;
                for (let j = 0; j < coords.length; j++) {
                    const nextIdx = (j + 1) % coords.length;
                    distance += coords[j].distanceTo(coords[nextIdx]);
                }
                const area = calculatePolygonArea(coords);

                layer.bindTooltip(`${name}<br>Superficie: ${(area/10000).toFixed(2)} ha`, { direction: 'top' });
                layer.on('click', () => selectFeature(id));

                state.drawnFeatures.push({
                    id,
                    type: 'Polygon',
                    name,
                    layer,
                    coords: coords.map(c => ({ lat: c.lat, lng: c.lng })),
                    elevations: finalElevs,
                    distance,
                    area
                });
                count++;
            }
        }
    }

    updateFeaturesList();
    if (count > 0) {
        showToast(`${count} élément(s) KML importé(s)`, 'success');
        const last = state.drawnFeatures[state.drawnFeatures.length - 1];
        zoomToFeature(last.id);
    } else {
        showToast('Aucune entité géométrique KML reconnue', 'warning');
    }
}

// Parse CSV
// Supported formats: headers like name,lat,lon,elevation / x,y,z / latitude,longitude,altitude
async function importCSV(csvContent) {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return;

    // Detect separator (comma or semicolon)
    const header = lines[0];
    let sep = ',';
    if (header.includes(';')) sep = ';';

    const cols = header.split(sep).map(c => c.toLowerCase().trim().replace(/['"]/g, ''));
    
    // Find column indexes
    const idxLat = cols.findIndex(c => c === 'lat' || c === 'latitude' || c === 'y');
    const idxLon = cols.findIndex(c => c === 'lon' || c === 'longitude' || c === 'lng' || c === 'x');
    const idxZ = cols.findIndex(c => c === 'z' || c === 'elevation' || c === 'altitude' || c === 'alt');
    const idxName = cols.findIndex(c => c === 'name' || c === 'nom' || c === 'label' || c === 'id');

    if (idxLat === -1 || idxLon === -1) {
        showToast('Format CSV invalide : colonnes latitude(Y) et longitude(X) requises', 'danger');
        return;
    }

    let count = 0;
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(sep).map(r => r.trim().replace(/['"]/g, ''));
        if (row.length < cols.length) continue;

        const lat = parseFloat(row[idxLat]);
        const lon = parseFloat(row[idxLon]);
        
        if (isNaN(lat) || isNaN(lon)) continue;

        const z = idxZ !== -1 && row[idxZ] !== '' ? parseFloat(row[idxZ]) : null;
        const name = idxName !== -1 && row[idxName] !== '' 
            ? row[idxName] 
            : `Point CSV ${count + 1}`;

        await addPointFeature(lat, lon, name, z);
        count++;
    }

    updateFeaturesList();
    if (count > 0) {
        showToast(`${count} point(s) CSV importé(s)`, 'success');
        const last = state.drawnFeatures[state.drawnFeatures.length - 1];
        zoomToFeature(last.id);
    } else {
        showToast('Aucun point valide trouvé dans le CSV', 'warning');
    }
}

// Export files (CSV, GPX, KML, GeoJSON)
function exportData(format) {
    if (state.drawnFeatures.length === 0) {
        showToast('Rien à exporter. Dessinez des éléments ou importez des fichiers d\'abord.', 'warning');
        return;
    }

    let fileContent = '';
    let mimeType = 'text/plain';
    let fileName = `carte_export_${Date.now()}`;

    if (format === 'geojson') {
        mimeType = 'application/json';
        fileName += '.geojson';
        
        const collection = {
            type: "FeatureCollection",
            features: state.drawnFeatures.map(feat => {
                let coords;
                if (feat.type === 'Point') {
                    coords = [feat.coords[0].lng, feat.coords[0].lat, feat.elevations[0]];
                } else if (feat.type === 'LineString') {
                    coords = feat.coords.map((c, i) => [c.lng, c.lat, feat.elevations[i]]);
                } else {
                    // Polygon closing loop
                    const outerRing = feat.coords.map((c, i) => [c.lng, c.lat, feat.elevations[i]]);
                    outerRing.push(outerRing[0]); // GeoJSON polygons must close
                    coords = [outerRing];
                }

                return {
                    type: "Feature",
                    properties: {
                        name: feat.name,
                        type: feat.type,
                        distance_m: feat.distance,
                        area_m2: feat.area
                    },
                    geometry: {
                        type: feat.type,
                        coordinates: coords
                    }
                };
            })
        };
        fileContent = JSON.stringify(collection, null, 2);
    } 
    else if (format === 'csv') {
        mimeType = 'text/csv';
        fileName += '.csv';
        
        // Flat points format
        fileContent = 'Name,Type,Latitude_Y,Longitude_X,Altitude_Z,UTM_Zone,UTM_Easting_X,UTM_Northing_Y,Lambert93_X,Lambert93_Y\n';
        
        state.drawnFeatures.forEach(feat => {
            feat.coords.forEach((coord, i) => {
                const converted = transformCoordinates(coord.lat, coord.lng);
                const name = feat.type === 'Point' ? feat.name : `${feat.name}_pt${i+1}`;
                const z = feat.elevations[i] !== null ? feat.elevations[i].toFixed(2) : '';
                const l93X = converted.lambert93.x ? converted.lambert93.x.toFixed(3) : '';
                const l93Y = converted.lambert93.y ? converted.lambert93.y.toFixed(3) : '';

                fileContent += `"${name}","${feat.type}",${coord.lat.toFixed(7)},${coord.lng.toFixed(7)},${z},"${converted.utm.zone}${converted.utm.band}",${converted.utm.x.toFixed(3)},${converted.utm.y.toFixed(3)},${l93X},${l93Y}\n`;
            });
        });
    }
    else if (format === 'kml') {
        mimeType = 'application/vnd.google-earth.kml+xml';
        fileName += '.kml';
        
        let placemarks = '';
        state.drawnFeatures.forEach(feat => {
            let geomXml = '';
            
            if (feat.type === 'Point') {
                const z = feat.elevations[0] !== null ? feat.elevations[0] : 0;
                geomXml = `<Point><coordinates>${feat.coords[0].lng},${feat.coords[0].lat},${z}</coordinates></Point>`;
            } 
            else if (feat.type === 'LineString') {
                const coordsStr = feat.coords.map((c, i) => `${c.lng},${c.lat},${feat.elevations[i] || 0}`).join(' ');
                geomXml = `<LineString><coordinates>${coordsStr}</coordinates></LineString>`;
            } 
            else if (feat.type === 'Polygon') {
                const outerStr = feat.coords.map((c, i) => `${c.lng},${c.lat},${feat.elevations[i] || 0}`).join(' ');
                // Close polygon ring
                const closeStr = `${feat.coords[0].lng},${feat.coords[0].lat},${feat.elevations[0] || 0}`;
                geomXml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outerStr} ${closeStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
            }

            placemarks += `
    <Placemark>
      <name>${feat.name}</name>
      <description>${feat.type} - Dist: ${feat.distance.toFixed(1)}m, Area: ${feat.area.toFixed(1)}m²</description>
      ${geomXml}
    </Placemark>`;
        });

        fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Export Carte Antigravity Map Tools</name>
    ${placemarks}
  </Document>
</kml>`;
    }
    else if (format === 'gpx') {
        mimeType = 'application/gpx+xml';
        fileName += '.gpx';

        let waypoints = '';
        let tracks = '';

        state.drawnFeatures.forEach(feat => {
            if (feat.type === 'Point') {
                const z = feat.elevations[0] !== null ? `<ele>${feat.elevations[0]}</ele>` : '';
                waypoints += `  <wpt lat="${feat.coords[0].lat}" lon="${feat.coords[0].lng}">
    ${z}
    <name>${feat.name}</name>
  </wpt>\n`;
            } 
            else {
                // LineString and Polygon as tracks
                let trackPoints = '';
                feat.coords.forEach((coord, i) => {
                    const z = feat.elevations[i] !== null ? `<ele>${feat.elevations[i]}</ele>` : '';
                    trackPoints += `      <trkpt lat="${coord.lat}" lon="${coord.lng}">
        ${z}
      </trkpt>\n`;
                });

                // For polygons, repeat first point to close track representation
                if (feat.type === 'Polygon') {
                    const z = feat.elevations[0] !== null ? `<ele>${feat.elevations[0]}</ele>` : '';
                    trackPoints += `      <trkpt lat="${feat.coords[0].lat}" lon="${feat.coords[0].lng}">
        ${z}
      </trkpt>\n`;
                }

                tracks += `  <trk>
    <name>${feat.name}</name>
    <trkseg>
${trackPoints}    </trkseg>
  </trk>\n`;
            }
        });

        fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Antigravity Map Tools" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Export Map Tools</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypoints}${tracks}</gpx>`;
    }

    // Download File in Browser
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Fichier exporté avec succès (${format.toUpperCase()})`, 'success');
}
