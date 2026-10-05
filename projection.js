/**
 * Geodesy Coordinate Conversions Utility
 * Wraps Proj4js to provide high-precision coordinate transformation.
 */

// Define projection strings for Proj4
const PROJECTIONS = {
    wgs84: 'EPSG:4326',
    lambert93: '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    lambert2: '+proj=lcc +lat_0=46.8 +lon_0=2.33722917 +k_0=0.99987742 +x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs'
};

/**
 * Determine UTM Zone and Projection String for a given longitude and latitude
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @returns {object} - { zone: number, hemisphere: 'N'|'S', projString: string }
 */
function getUTMProjection(lat, lon) {
    // UTM Zone calculation: 1 to 60
    let zone = Math.floor((lon + 180) / 6) + 1;
    
    // Handle special UTM zone anomalies
    if (lat >= 56.0 && lat < 64.0 && lon >= 3.0 && lon < 12.0) {
        zone = 32;
    }
    // Svalbard anomalies
    if (lat >= 72.0 && lat < 84.0) {
        if (lon >= 0.0 && lon < 9.0) zone = 31;
        else if (lon >= 9.0 && lon < 21.0) zone = 33;
        else if (lon >= 21.0 && lon < 33.0) zone = 35;
        else if (lon >= 33.0 && lon < 42.0) zone = 37;
    }

    const hemisphere = lat >= 0 ? 'N' : 'S';
    const projString = `+proj=utm +zone=${zone} ${hemisphere === 'S' ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
    
    return { zone, hemisphere, projString };
}

/**
 * Get UTM Latitude Band letter
 * @param {number} lat - Latitude in decimal degrees
 * @returns {string} - UTM Latitude Band letter (C to X, omitting I and O)
 */
function getUTMLatitudeBand(lat) {
    if (lat < -80 || lat > 84) return 'Z'; // Outside UTM limits
    const bands = 'CDEFGHJKLMNPQRSTUVWXX'; // Extra X to handle the north boundary
    const index = Math.floor((lat + 80) / 8);
    return bands.charAt(index);
}

/**
 * Convert Decimal Degrees to Degrees, Minutes, Seconds (DMS)
 * @param {number} decimal - Decimal coordinates
 * @param {boolean} isLat - True if latitude, False if longitude
 * @returns {string} - DMS formatted string (e.g. 48° 10' 15" N)
 */
function decimalToDMS(decimal, isLat) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
    
    let direction = '';
    if (isLat) {
        direction = decimal >= 0 ? 'N' : 'S';
    } else {
        direction = decimal >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Convert DMS to Decimal Degrees
 * @param {number} degrees 
 * @param {number} minutes 
 * @param {number} seconds 
 * @param {string} direction - 'N', 'S', 'E', 'W'
 * @returns {number} - Decimal degrees
 */
function dmsToDecimal(degrees, minutes, seconds, direction) {
    let decimal = Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600;
    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }
    return decimal;
}

/**
 * Transform coordinates from WGS84 to target projections
 * @param {number} lat - Latitude (WGS84)
 * @param {number} lon - Longitude (WGS84)
 * @returns {object} - Transformed coordinates
 */
function transformCoordinates(lat, lon) {
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }

    // WGS84 Point
    const wgs84Point = [lon, lat]; // Proj4 expects [lon, lat]

    // 1. UTM conversion
    const utmInfo = getUTMProjection(lat, lon);
    const utmCoords = proj4(PROJECTIONS.wgs84, utmInfo.projString, wgs84Point);
    const utmBand = getUTMLatitudeBand(lat);

    // 2. Lambert 93 (Valid around France)
    let lambert93 = { x: null, y: null };
    try {
        const l93Coords = proj4(PROJECTIONS.wgs84, PROJECTIONS.lambert93, wgs84Point);
        lambert93 = { x: l93Coords[0], y: l93Coords[1] };
    } catch (e) {
        console.warn('Lambert 93 conversion error:', e);
    }

    // 3. Lambert II Étendu (Valid around France)
    let lambert2 = { x: null, y: null };
    try {
        const l2Coords = proj4(PROJECTIONS.wgs84, PROJECTIONS.lambert2, wgs84Point);
        lambert2 = { x: l2Coords[0], y: l2Coords[1] };
    } catch (e) {
        console.warn('Lambert II conversion error:', e);
    }

    return {
        wgs84: {
            lat: lat,
            lon: lon,
            latDMS: decimalToDMS(lat, true),
            lonDMS: decimalToDMS(lon, false)
        },
        utm: {
            x: utmCoords[0],
            y: utmCoords[1],
            zone: utmInfo.zone,
            band: utmBand,
            hemisphere: utmInfo.hemisphere,
            formatted: `${utmInfo.zone}${utmBand} E: ${utmCoords[0].toFixed(2)} N: ${utmCoords[1].toFixed(2)}`
        },
        lambert93: {
            x: lambert93.x,
            y: lambert93.y,
            formatted: lambert93.x ? `X: ${lambert93.x.toFixed(2)} Y: ${lambert93.y.toFixed(2)}` : 'N/A'
        },
        lambert2: {
            x: lambert2.x,
            y: lambert2.y,
            formatted: lambert2.x ? `X: ${lambert2.x.toFixed(2)} Y: ${lambert2.y.toFixed(2)}` : 'N/A'
        }
    };
}
