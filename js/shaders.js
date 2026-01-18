// WebGL shaders for precipitation visualization using radial blob model

export const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_texCoord;
varying vec2 v_screenPos;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    v_screenPos = a_position;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const fragmentShaderSource = `
precision highp float;

varying vec2 v_texCoord;
varying vec2 v_screenPos;

// Map transform parameters
uniform vec2 u_center;  // [lng, lat] - map center
uniform float u_zoom;    // zoom level
uniform vec2 u_viewportSize;  // [width, height] in pixels

// Radial blob model parameters
uniform float u_influenceRadius;
uniform float u_falloffSteepness;

// Data points (max 250 points)
uniform vec3 u_points[250];  // [lng, lat, value]
uniform int u_numPoints;

// Color gradient (5 stops with RGB colors)
uniform vec3 u_gradientColors[5];
uniform float u_gradientStops[5];

const float EARTH_RADIUS = 6371.0; // km
const float PI = 3.14159265359;
const float WORLD_SIZE = 512.0; // MapLibre's base world size

// Convert degrees to radians
float degToRad(float deg) {
    return deg * PI / 180.0;
}

// Convert longitude to mercator X coordinate (0-1)
float lngToMercatorX(float lng) {
    return (lng + 180.0) / 360.0;
}

// Convert latitude to mercator Y coordinate (0-1)
float latToMercatorY(float lat) {
    float latRad = degToRad(lat);
    float mercatorY = (PI - log(tan(PI / 4.0 + latRad / 2.0))) / (2.0 * PI);
    return mercatorY;
}

// Convert mercator Y to latitude
float mercatorYToLat(float y) {
    float latRad = 2.0 * (atan(exp(PI * (1.0 - 2.0 * y))) - PI / 4.0);
    return latRad * 180.0 / PI;
}

// Convert mercator X to longitude
float mercatorXToLng(float x) {
    return x * 360.0 - 180.0;
}

// Normalize longitude to -180 to 180 range
float normalizeLng(float lng) {
    // Use mod to wrap longitude
    lng = mod(lng + 180.0, 360.0) - 180.0;
    return lng;
}

// Calculate shortest longitude difference accounting for wrapping
float lngDifference(float lng1, float lng2) {
    float diff = lng2 - lng1;
    if (diff > 180.0) diff -= 360.0;
    if (diff < -180.0) diff += 360.0;
    return diff;
}

// Convert screen position to geographic coordinates
vec2 screenToGeo(vec2 screenPos, out float worldWrap) {
    // Get center in mercator coordinates
    float centerMercX = lngToMercatorX(u_center.x);
    float centerMercY = latToMercatorY(u_center.y);

    // Calculate scale based on zoom
    float scale = WORLD_SIZE * pow(2.0, u_zoom);

    // Convert screen position (NDC: -1 to 1) to pixel offset from center
    // Note: In NDC, y=1 is top, y=-1 is bottom
    // We need to invert Y because in NDC +Y is up, but in mercator +Y is south
    vec2 pixelPos = vec2(screenPos.x, -screenPos.y) * u_viewportSize * 0.5;

    // Convert pixel offset to mercator offset
    vec2 mercOffset = pixelPos / scale;

    // Add offset to center mercator coords
    float mercX = centerMercX + mercOffset.x;
    float mercY = centerMercY + mercOffset.y;

    // Determine which world wrap we're in (0 = main world, -1 = left wrap, +1 = right wrap, etc)
    worldWrap = floor(mercX);

    // Normalize to [0, 1] for this world instance
    float normalizedMercX = mercX - worldWrap;

    // Convert back to geographic coordinates
    float lng = mercatorXToLng(normalizedMercX);
    float lat = mercatorYToLat(mercY);

    return vec2(lng, lat);
}

// Calculate great circle distance between two points (Haversine formula)
// Handles longitude wrapping correctly
float haversineDistance(vec2 point1, vec2 point2) {
    float lat1 = degToRad(point1.y);
    float lat2 = degToRad(point2.y);
    float dLat = degToRad(point2.y - point1.y);

    // Use lngDifference to handle world wrapping
    float lngDiff = lngDifference(point1.x, point2.x);
    float dLng = degToRad(lngDiff);

    float a = sin(dLat / 2.0) * sin(dLat / 2.0) +
              cos(lat1) * cos(lat2) *
              sin(dLng / 2.0) * sin(dLng / 2.0);

    float c = 2.0 * atan(sqrt(a), sqrt(1.0 - a));
    return EARTH_RADIUS * c;
}

// Get discrete color based on thresholds (no interpolation)
vec3 getColor(float value) {
    // Clamp value to [0, 1]
    value = clamp(value, 0.0, 1.0);

    // Use discrete thresholds - find which band the value falls into
    if (value < 0.2) return u_gradientColors[0];
    if (value < 0.4) return u_gradientColors[1];
    if (value < 0.6) return u_gradientColors[2];
    if (value < 0.8) return u_gradientColors[3];
    return u_gradientColors[4];
}

void main() {
    // Convert screen position to geographic coordinates using Web Mercator projection
    float worldWrap;
    vec2 currentPos = screenToGeo(v_screenPos, worldWrap);

    // Only render in the main world instance (worldWrap == 0)
    // This prevents the heatmap from appearing on wrapped copies of the world
    if (worldWrap != 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // Radial influence model for precipitation visualization
    // Each non-zero point creates a "blob" of influence that fades with distance
    // Blobs blend together smoothly to create cohesive precipitation fields

    float totalInfluence = 0.0;
    float totalWeight = 0.0;

    for (int i = 0; i < 250; i++) {
        if (i >= u_numPoints) break;

        vec2 pointPos = u_points[i].xy;
        float pointValue = u_points[i].z;

        // Skip zero-value points - they don't create precipitation clouds
        if (pointValue == 0.0) {
            continue;
        }

        float distance = haversineDistance(currentPos, pointPos);

        // Calculate influence using smooth falloff within radius
        if (distance < u_influenceRadius) {
            // Normalized distance (0 at center, 1 at radius edge)
            float normalizedDist = distance / u_influenceRadius;

            // Apply steepness adjustment
            normalizedDist = pow(normalizedDist, u_falloffSteepness);

            // Smooth falloff using cosine interpolation (smoother than linear)
            // This creates a smooth "blob" shape
            float falloff = 0.5 + 0.5 * cos(normalizedDist * 3.14159);

            // Calculate influence: full value at center, fades to 0 at radius
            float influence = pointValue * falloff;

            // Weight based on influence strength (stronger = more weight)
            // This creates smooth blending while maintaining visible colors
            float weight = falloff * falloff; // Square for smoother blending

            totalInfluence += influence * weight;
            totalWeight += weight;
        }
    }

    // Weighted average, boosted to maintain color intensity
    float interpolatedValue = totalWeight > 0.0 ?
        (totalInfluence / totalWeight) * 1.15 : 0.0;

    // If there's no precipitation at all, make it transparent
    if (interpolatedValue <= 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // All visible precipitation has full opacity
    float alpha = 0.8;

    // Use the interpolated value directly for color mapping (no remapping)
    // This ensures values near zero map to the start of the gradient
    vec3 color = getColor(interpolatedValue);
    gl_FragColor = vec4(color / 255.0, alpha);
}
`;
