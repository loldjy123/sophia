import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let scene, camera, renderer, particles, analyzer, dataArray;
let isListening = false;

export const SophiaVisualizer = {
    init(containerId) {
        const container = document.getElementById(containerId);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(250, 250); // Small size for the "Ball"
        container.appendChild(renderer.domElement);

        // Create a Particle Sphere
        const geometry = new THREE.IcosahedronGeometry(2, 5);
        const material = new THREE.PointsMaterial({ color: 0x9d00ff, size: 0.05 });
        particles = new THREE.Points(geometry, material);
        scene.add(particles);

        this.animate();
    },

    async startListening() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyzer = audioCtx.createAnalyser();
        source.connect(analyzer);
        dataArray = new Uint8Array(analyzer.frequencyBinCount);
        isListening = true;
    },

    stopListening() { isListening = false; },

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (isListening && analyzer) {
            analyzer.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
            particles.scale.set(1 + volume/100, 1 + volume/100, 1 + volume/100);
        }
        
        particles.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
};