// Configuration and test data for precipitation visualization layer

// Default radial blob model parameters
export const DEFAULT_CONFIG = {
    influenceRadius: 25.0,  // Radius of influence for each point in kilometers
    falloffSteepness: 1.8,   // Steepness of falloff (higher = sharper edges)
    resolution: 512,         // Texture resolution (higher = smoother but slower)
    minValue: 0.0,          // Minimum data value
    maxValue: 1.0           // Maximum data value
};

// Generate natural-looking precipitation patterns with 200 points
function generatePrecipitationPoints() {
    const points = [];

    // Define realistic rain clusters for southern Norway
    // Western coastal areas get more rain (Atlantic weather systems)
    // Multiple distinct frontal systems and convective cells
    const rainClusters = [
        // Strong coastal system (west coast - Bergen area)
        { lng: 5.8, lat: 60.3, radius: 1.2, intensity: 0.92, density: 0.85 },
        { lng: 6.5, lat: 59.8, radius: 0.9, intensity: 0.88, density: 0.80 },

        // Frontal system moving inland
        { lng: 7.8, lat: 60.5, radius: 1.5, intensity: 0.75, density: 0.70 },
        { lng: 8.5, lat: 59.5, radius: 1.3, intensity: 0.70, density: 0.65 },

        // Convective cells in interior regions
        { lng: 10.2, lat: 60.8, radius: 0.6, intensity: 0.82, density: 0.75 },
        { lng: 11.0, lat: 59.3, radius: 0.7, intensity: 0.78, density: 0.70 },

        // Lighter precipitation in eastern valleys (rain shadow)
        { lng: 11.8, lat: 61.2, radius: 0.8, intensity: 0.58, density: 0.55 },
        { lng: 12.3, lat: 60.0, radius: 0.5, intensity: 0.52, density: 0.50 },

        // Secondary system in the south
        { lng: 8.0, lat: 58.5, radius: 1.0, intensity: 0.68, density: 0.60 },
        { lng: 9.2, lat: 58.8, radius: 0.8, intensity: 0.72, density: 0.65 },

        // Scattered showers
        { lng: 10.8, lat: 58.3, radius: 0.4, intensity: 0.62, density: 0.50 },
        { lng: 7.2, lat: 61.3, radius: 0.6, intensity: 0.65, density: 0.55 }
    ];

    // Generate grid points covering the visible map area
    // Bounds match current view: west: 7.83, east: 12.67, south: 58.77, north: 60.71
    const lngMin = 7.5, lngMax = 13.0;
    const latMin = 58.5, latMax = 61.0;
    const gridSize = Math.sqrt(200); // ~14x14 grid
    const lngStep = (lngMax - lngMin) / gridSize;
    const latStep = (latMax - latMin) / gridSize;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            // Add some random jitter to make it look more natural
            const jitterLng = (Math.random() - 0.5) * lngStep * 0.5;
            const jitterLat = (Math.random() - 0.5) * latStep * 0.5;

            const lng = lngMin + i * lngStep + jitterLng;
            const lat = latMin + j * latStep + jitterLat;

            // Calculate precipitation value based on proximity to rain clusters
            let maxValue = 0;

            for (const cluster of rainClusters) {
                const distLng = lng - cluster.lng;
                const distLat = lat - cluster.lat;
                const distance = Math.sqrt(distLng * distLng + distLat * distLat);

                if (distance < cluster.radius) {
                    // Calculate falloff with some randomness
                    const normalizedDist = distance / cluster.radius;
                    const falloff = Math.cos(normalizedDist * Math.PI / 2);
                    const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
                    let value = cluster.intensity * falloff * randomFactor;

                    // Apply density (chance of rain in this area)
                    if (Math.random() > cluster.density) {
                        value *= Math.random() * 0.3; // Reduced intensity outside dense areas
                    }

                    maxValue = Math.max(maxValue, value);
                }
            }

            // Clamp value and add some background noise in rain areas
            let finalValue = Math.min(maxValue, 1.0);

            // Add scattered light rain outside clusters (20% chance)
            if (finalValue < 0.1 && Math.random() < 0.2) {
                finalValue = Math.random() * 0.25;
            }

            // Round very small values to zero for cleaner visualization
            if (finalValue < 0.08) {
                finalValue = 0.0;
            }

            points.push({
                lng: parseFloat(lng.toFixed(4)),
                lat: parseFloat(lat.toFixed(4)),
                value: parseFloat(finalValue.toFixed(3))
            });
        }
    }

    return points;
}

// Generate 200 points with natural precipitation patterns
export const TEST_POINTS = generatePrecipitationPoints();

// Color gradient stops for precipitation visualization
// 5 distinct shades of blue for discrete thresholds
export const COLOR_GRADIENT = [
    { stop: 0.0, color: [135, 206, 250] },  // Light blue (0-20%)
    { stop: 0.2, color: [100, 180, 230] },  // Light-medium blue (20-40%)
    { stop: 0.4, color: [70, 130, 180] },   // Medium blue (40-60%)
    { stop: 0.6, color: [30, 100, 200] },   // Blue (60-80%)
    { stop: 0.8, color: [0, 60, 150] }      // Dark blue (80-100%)
];

// Map initial view centered on test points
export const MAP_CONFIG = {
    center: [10.25, 59.75],
    zoom: 7.5,
    style: 'https://tiles.openfreemap.org/styles/liberty'
};
