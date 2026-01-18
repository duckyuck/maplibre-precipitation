// Main application initialization and controls

import { PrecipitationLayer } from './precipitation-layer.js';
import { TEST_POINTS, MAP_CONFIG, DEFAULT_CONFIG, COLOR_GRADIENT } from './config.js';

let map;
let precipitationLayer;

// Format radius value for display
function formatRadiusValue(radius) {
    return `${radius.toFixed(0)} km`;
}

// Update gradient legend from COLOR_GRADIENT config with discrete bands
function updateGradientLegend() {
    const gradientBar = document.querySelector('.gradient-bar');
    if (gradientBar) {
        // Create discrete color bands with hard stops
        const bands = [];
        for (let i = 0; i < COLOR_GRADIENT.length; i++) {
            const color = `rgb(${COLOR_GRADIENT[i].color.join(',')})`;
            const startPercent = i * 20;
            const endPercent = (i + 1) * 20;
            bands.push(`${color} ${startPercent}%`, `${color} ${endPercent}%`);
        }
        gradientBar.style.background = `linear-gradient(to right, ${bands.join(', ')})`;
    }
}

// Initialize the map and layer
function initMap() {
    // Create MapLibre map
    map = new maplibregl.Map({
        container: 'map',
        style: MAP_CONFIG.style,
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.zoom
    });

    // Expose map globally for debugging
    window.map = map;

    map.on('load', () => {
        // Create precipitation layer with test data
        precipitationLayer = new PrecipitationLayer('precipitation-layer', TEST_POINTS, DEFAULT_CONFIG);

        // Add layer to map
        map.addLayer(precipitationLayer);

        // Add markers for data points to visualize them
        // addDataPointMarkers();

        console.log('Precipitation layer initialized with', TEST_POINTS.length, 'points');

        // Log initial map state
        const center = map.getCenter();
        console.log('Map center:', center.lng, center.lat, 'Zoom:', map.getZoom());
    });

    // Log map state on move
    map.on('moveend', () => {
        const center = map.getCenter();
        console.log('Map center:', center.lng, center.lat, 'Zoom:', map.getZoom());
    });
}

// Add markers to visualize data points
function addDataPointMarkers() {
    TEST_POINTS.forEach((point, index) => {
        const el = document.createElement('div');
        el.className = 'marker';
        el.innerHTML = `
            <div class="marker-inner">
                <div class="marker-label">${(point.value * 100).toFixed(0)}%</div>
            </div>
        `;

        new maplibregl.Marker(el)
            .setLngLat([point.lng, point.lat])
            .addTo(map);
    });
}

// Set up control event listeners
function initControls() {
    const radiusSlider = document.getElementById('influenceRadius');
    const radiusValue = document.getElementById('radiusValue');
    const steepnessSlider = document.getElementById('falloffSteepness');
    const steepnessValue = document.getElementById('steepnessValue');
    const resetButton = document.getElementById('resetButton');

    // Influence radius control
    radiusSlider.addEventListener('input', (e) => {
        const radius = parseFloat(e.target.value);
        radiusValue.textContent = formatRadiusValue(radius);
        if (precipitationLayer) {
            precipitationLayer.updateConfig({ influenceRadius: radius });
        }
    });

    // Falloff steepness control
    steepnessSlider.addEventListener('input', (e) => {
        const steepness = parseFloat(e.target.value);
        steepnessValue.textContent = steepness.toFixed(1);
        if (precipitationLayer) {
            precipitationLayer.updateConfig({ falloffSteepness: steepness });
        }
    });

    // Reset button
    resetButton.addEventListener('click', () => {
        radiusSlider.value = DEFAULT_CONFIG.influenceRadius;
        radiusValue.textContent = formatRadiusValue(DEFAULT_CONFIG.influenceRadius);

        steepnessSlider.value = DEFAULT_CONFIG.falloffSteepness;
        steepnessValue.textContent = DEFAULT_CONFIG.falloffSteepness.toFixed(1);

        if (precipitationLayer) {
            precipitationLayer.updateConfig(DEFAULT_CONFIG);
        }
    });

    // Initialize display values
    radiusValue.textContent = formatRadiusValue(parseFloat(radiusSlider.value));
    steepnessValue.textContent = steepnessSlider.value;
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initControls();
    updateGradientLegend();
});
