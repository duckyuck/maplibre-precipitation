// Precipitation Visualization Custom Layer for MapLibre GL JS

import { vertexShaderSource, fragmentShaderSource } from './shaders.js';
import { DEFAULT_CONFIG, COLOR_GRADIENT } from './config.js';

export class PrecipitationLayer {
    constructor(id, points, config = {}) {
        this.id = id;
        this.type = 'custom';
        this.renderingMode = '2d';

        this.points = points;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // WebGL resources
        this.program = null;
        this.positionBuffer = null;
        this.locations = {};
    }

    // Create and compile shader
    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    // Create shader program
    createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    // Prepare cached uniform data
    prepareUniformData() {
        // Validate point count
        if (this.points.length > 250) {
            throw new Error('Maximum 250 data points supported');
        }

        // Pre-compute points array
        this.pointsArray = new Float32Array(this.points.length * 3);
        this.points.forEach((point, i) => {
            this.pointsArray[i * 3] = point.lng;
            this.pointsArray[i * 3 + 1] = point.lat;
            this.pointsArray[i * 3 + 2] = point.value;
        });

        // Pre-compute gradient arrays
        this.gradientColors = new Float32Array(COLOR_GRADIENT.length * 3);
        this.gradientStops = new Float32Array(COLOR_GRADIENT.length);
        COLOR_GRADIENT.forEach((grad, i) => {
            this.gradientColors[i * 3] = grad.color[0];
            this.gradientColors[i * 3 + 1] = grad.color[1];
            this.gradientColors[i * 3 + 2] = grad.color[2];
            this.gradientStops[i] = grad.stop;
        });
    }

    // Initialize WebGL resources when layer is added to map
    onAdd(map, gl) {
        this.map = map;

        // Create shaders
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        if (!vertexShader || !fragmentShader) {
            throw new Error('Failed to compile shaders for precipitation layer');
        }

        // Create program
        this.program = this.createProgram(gl, vertexShader, fragmentShader);

        if (!this.program) {
            throw new Error('Failed to link shader program for precipitation layer');
        }

        // Clean up shaders after linking (no longer needed)
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        // Get attribute and uniform locations
        this.locations.aPosition = gl.getAttribLocation(this.program, 'a_position');
        this.locations.uCenter = gl.getUniformLocation(this.program, 'u_center');
        this.locations.uZoom = gl.getUniformLocation(this.program, 'u_zoom');
        this.locations.uViewportSize = gl.getUniformLocation(this.program, 'u_viewportSize');
        this.locations.uInfluenceRadius = gl.getUniformLocation(this.program, 'u_influenceRadius');
        this.locations.uFalloffSteepness = gl.getUniformLocation(this.program, 'u_falloffSteepness');
        this.locations.uPoints = gl.getUniformLocation(this.program, 'u_points');
        this.locations.uNumPoints = gl.getUniformLocation(this.program, 'u_numPoints');
        this.locations.uGradientColors = gl.getUniformLocation(this.program, 'u_gradientColors');
        this.locations.uGradientStops = gl.getUniformLocation(this.program, 'u_gradientStops');

        // Create a buffer for a full-screen quad
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Prepare cached uniform data
        this.prepareUniformData();
    }

    // Render the layer
    render(gl, matrix) {
        gl.useProgram(this.program);

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);

        // Get map transform parameters for Web Mercator projection
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        gl.uniform2f(this.locations.uCenter, center.lng, center.lat);
        gl.uniform1f(this.locations.uZoom, zoom);
        // Use client dimensions (CSS pixels) not canvas dimensions (physical pixels)
        gl.uniform2f(this.locations.uViewportSize, gl.canvas.clientWidth, gl.canvas.clientHeight);

        // Set radial blob model parameters
        gl.uniform1f(this.locations.uInfluenceRadius, this.config.influenceRadius);
        gl.uniform1f(this.locations.uFalloffSteepness, this.config.falloffSteepness);

        // Set data points (using cached array)
        gl.uniform3fv(this.locations.uPoints, this.pointsArray);
        gl.uniform1i(this.locations.uNumPoints, this.points.length);

        // Set color gradient (using cached arrays)
        gl.uniform3fv(this.locations.uGradientColors, this.gradientColors);
        gl.uniform1fv(this.locations.uGradientStops, this.gradientStops);

        // Draw the full-screen quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.BLEND);
    }

    // Clean up WebGL resources when layer is removed
    onRemove(gl) {
        gl.deleteProgram(this.program);
        gl.deleteBuffer(this.positionBuffer);
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.map) {
            this.map.triggerRepaint();
        }
    }

    // Update data points
    updatePoints(newPoints) {
        this.points = newPoints;
        this.prepareUniformData(); // Regenerate cached arrays
        if (this.map) {
            this.map.triggerRepaint();
        }
    }
}
