// Game State Management
class GameState {
    constructor() {
        this.currentState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.distance = 0;
        this.stunts = 0;
        this.health = 100;
        this.speed = 0;
        this.isGameRunning = false;
        this.isPaused = false;
    }

    reset() {
        this.score = 0;
        this.distance = 0;
        this.stunts = 0;
        this.health = 100;
        this.speed = 0;
    }
}

// Audio Manager - Using SimpleAudioManager from audio.js
class AudioManager {
    constructor() {
        this.simpleAudio = new SimpleAudioManager();
    }

    play(soundName) {
        switch(soundName) {
            case 'engine':
                this.simpleAudio.playEngine();
                break;
            case 'jump':
                this.simpleAudio.playJump();
                break;
            case 'crash':
                this.simpleAudio.playCrash();
                break;
            case 'powerup':
                this.simpleAudio.playPowerup();
                break;
            case 'menu':
                this.simpleAudio.playMenu();
                break;
        }
    }

    stop(soundName) {
        if (soundName === 'engine') {
            this.simpleAudio.stopEngine();
        }
    }

    startEngine() {
        this.simpleAudio.startEngine();
    }

    stopEngine() {
        this.simpleAudio.stopEngine();
    }
}

// 3D Bike Game Class
class NeonBikeGame {
    constructor() {
        this.gameState = new GameState();
        this.audioManager = new AudioManager();
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bike = null;
        this.terrain = null;
        this.obstacles = [];
        this.powerups = [];
        this.particles = [];
        this.lights = [];
        this.controls = {};
        this.clock = new THREE.Clock();
        this.dayNightCycle = 0;
        
        // Smooth physics parameters
        this.bikeVelocity = new THREE.Vector3(0, 0, 0);
        this.verticalVelocity = 0;
        this.gravity = -30; // units/s^2
        this.maxForwardSpeed = 80; // units/s
        this.maxReverseSpeed = 15; // units/s
        this.forwardAcceleration = 120; // units/s^2
        this.brakeAcceleration = 140; // units/s^2
        this.lateralAcceleration = 60; // units/s^2
        this.lateralMaxSpeed = 20; // units/s
        this.longitudinalDamping = 1.5; // per second
        this.lateralDamping = 3.0; // per second
        this.jumpSpeed = 13; // units/s
        this.lastJumpTime = 0;
        this.jumpCooldownMs = 400;
        this.lastHitTime = 0;
        this.hitInvulnMs = 800;

        // Scenery state
        this.scenery = [];
        this.lastSceneryZ = this.bike ? this.bike.position.z : 0;
        this.scenerySpacing = 12; // distance between scenery pairs
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        this.setupThreeJS();
        this.createBike();
        this.createTerrain();
        this.createLighting();
        this.createParticleSystem();
        this.animate();
    }

    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 50, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const container = document.getElementById('canvasContainer');
        container.appendChild(this.renderer.domElement);

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createBike() {
        // Create bike group
        this.bike = new THREE.Group();

        // Bike body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff00ff,
            emissive: 0x330033,
            shininess: 100
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        this.bike.add(body);

        // Bike wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 16);
        const wheelMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            emissive: 0x111111
        });

        const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        frontWheel.position.set(0, -0.5, 1.5);
        frontWheel.rotation.z = Math.PI / 2;
        frontWheel.castShadow = true;
        this.bike.add(frontWheel);

        const backWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        backWheel.position.set(0, -0.5, -1.5);
        backWheel.rotation.z = Math.PI / 2;
        backWheel.castShadow = true;
        this.bike.add(backWheel);

        // Handlebar
        const handlebarGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const handlebarMaterial = new THREE.MeshPhongMaterial({ color: 0x00ffff });
        const handlebar = new THREE.Mesh(handlebarGeometry, handlebarMaterial);
        handlebar.position.set(0, 0.5, 1.8);
        handlebar.castShadow = true;
        this.bike.add(handlebar);

        this.bike.position.set(0, 1, 0);
        this.scene.add(this.bike);
    }

    createTerrain() {
        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.8
        });
        this.terrain = new THREE.Mesh(groundGeometry, groundMaterial);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Create road
        this.createRoad();
        
        // Create obstacles and ramps
        this.generateObstacles();
        this.generateRamps();
    }

    createRoad() {
        const roadGeometry = new THREE.PlaneGeometry(20, 1000);
        const roadMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.9
        });
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01;
        road.receiveShadow = true;
        this.scene.add(road);

        // Road markings
        for (let i = 0; i < 50; i++) {
            const markingGeometry = new THREE.PlaneGeometry(0.5, 3);
            const markingMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(0, 0.02, -i * 20);
            marking.userData = { isMarking: true };
            this.scene.add(marking);
        }
    }

    generateObstacles() {
        // Generate initial obstacles
        for (let i = 0; i < 20; i++) {
            const obstacle = this.createObstacle();
            obstacle.position.set(
                (Math.random() - 0.5) * 15,
                1,
                -i * 50 - Math.random() * 30
            );
            this.obstacles.push(obstacle);
            this.scene.add(obstacle);
        }
    }

    generateInfiniteTerrain() {
        if (!this.gameState.isGameRunning) return;

        const bikeZ = this.bike.position.z;
        const generationDistance = 200; // Generate new terrain 200 units ahead
        
        // Ensure scenery rows exist far ahead initially
        if (this.scenery.length === 0) {
            this.lastSceneryZ = bikeZ - 10;
            for (let i = 0; i < 30; i++) {
                this.spawnSceneryRow(this.lastSceneryZ - i * this.scenerySpacing);
            }
        }

        // Generate new obstacles ahead
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            if (obstacle && obstacle.position && obstacle.position.z > bikeZ + 50) {
                // Remove obstacles that are too far behind
                this.scene.remove(obstacle);
                this.obstacles.splice(i, 1);
            }
        }

        // Generate new obstacles ahead
        const lastObstacleZ = this.obstacles.length > 0 ? 
            Math.min(...this.obstacles.map(o => o.position.z)) : bikeZ - 1000;
        
        if (bikeZ - lastObstacleZ > generationDistance) {
            for (let i = 0; i < 5; i++) {
                const obstacle = this.createObstacle();
                obstacle.position.set(
                    (Math.random() - 0.5) * 15,
                    1,
                    lastObstacleZ - Math.random() * 100 - 50
                );
                this.obstacles.push(obstacle);
                this.scene.add(obstacle);
            }
        }

        // Generate new ramps ahead
        this.scene.children.forEach((child, index) => {
            if (child.userData && child.userData.isRamp && child.position.z > bikeZ + 50) {
                this.scene.remove(child);
            }
        });

        const lastRampZ = this.scene.children
            .filter(child => child.userData && child.userData.isRamp)
            .reduce((min, child) => Math.min(min, child.position.z), bikeZ - 1000);

        if (bikeZ - lastRampZ > generationDistance) {
            for (let i = 0; i < 3; i++) {
                const ramp = this.createRamp();
                ramp.position.set(
                    (Math.random() - 0.5) * 10,
                    0,
                    lastRampZ - Math.random() * 150 - 100
                );
                ramp.userData = { isRamp: true };
                this.scene.add(ramp);
            }
        }

        // Generate new road markings ahead
        this.scene.children.forEach((child, index) => {
            if (child.userData && child.userData.isMarking && child.position.z > bikeZ + 50) {
                this.scene.remove(child);
            }
        });

        const lastMarkingZ = this.scene.children
            .filter(child => child.userData && child.userData.isMarking)
            .reduce((min, child) => Math.min(min, child.position.z), bikeZ - 1000);

        if (bikeZ - lastMarkingZ > 20) {
            for (let i = 0; i < 10; i++) {
                const markingGeometry = new THREE.PlaneGeometry(0.5, 3);
                const markingMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
                const marking = new THREE.Mesh(markingGeometry, markingMaterial);
                marking.rotation.x = -Math.PI / 2;
                marking.position.set(0, 0.02, lastMarkingZ - i * 20);
                marking.userData = { isMarking: true };
                this.scene.add(marking);
            }
        }

        // Generate terrain features (hills, valleys)
        this.scene.children.forEach((child, index) => {
            if (child.userData && child.userData.isTerrain && child.position.z > bikeZ + 100) {
                this.scene.remove(child);
            }
        });

        const lastTerrainZ = this.scene.children
            .filter(child => child.userData && child.userData.isTerrain)
            .reduce((min, child) => Math.min(min, child.position.z), bikeZ - 1000);

        if (bikeZ - lastTerrainZ > generationDistance) {
            // Create terrain variations
            for (let i = 0; i < 3; i++) {
                const terrainType = Math.random();
                if (terrainType < 0.3) {
                    // Create a hill
                    const hillGeometry = new THREE.ConeGeometry(20, 10, 8);
                    const hillMaterial = new THREE.MeshPhongMaterial({ 
                        color: 0x2a5a2a,
                        transparent: true,
                        opacity: 0.7
                    });
                    const hill = new THREE.Mesh(hillGeometry, hillMaterial);
                    hill.position.set(
                        (Math.random() - 0.5) * 40,
                        -5,
                        lastTerrainZ - Math.random() * 200 - 100
                    );
                    hill.userData = { isTerrain: true };
                    this.scene.add(hill);
                } else if (terrainType < 0.6) {
                    // Create a valley/depression
                    const valleyGeometry = new THREE.CylinderGeometry(15, 15, 5, 8);
                    const valleyMaterial = new THREE.MeshPhongMaterial({ 
                        color: 0x1a3a1a,
                        transparent: true,
                        opacity: 0.6
                    });
                    const valley = new THREE.Mesh(valleyGeometry, valleyMaterial);
                    valley.position.set(
                        (Math.random() - 0.5) * 30,
                        -2.5,
                        lastTerrainZ - Math.random() * 200 - 100
                    );
                    valley.userData = { isTerrain: true };
                    this.scene.add(valley);
                }
            }
        }
    }

    createObstacle() {
        // Create different types of obstacles
        const obstacleTypes = [
            { geometry: new THREE.BoxGeometry(2, 2, 2), color: 0xff4444 },
            { geometry: new THREE.SphereGeometry(1, 8, 8), color: 0xff6666 },
            { geometry: new THREE.CylinderGeometry(1, 1, 3, 8), color: 0xff8888 },
            { geometry: new THREE.ConeGeometry(1, 3, 8), color: 0xffaaaa }
        ];
        
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const material = new THREE.MeshPhongMaterial({ 
            color: type.color,
            emissive: 0x330000
        });
        const obstacle = new THREE.Mesh(type.geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        return obstacle;
    }

    generateRamps() {
        for (let i = 0; i < 10; i++) {
            const ramp = this.createRamp();
            ramp.position.set(
                (Math.random() - 0.5) * 10,
                0,
                -i * 80 - Math.random() * 40
            );
            ramp.userData = { isRamp: true };
            this.scene.add(ramp);
        }
    }

    createRamp() {
        const geometry = new THREE.BoxGeometry(8, 1, 6);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x00ffff,
            emissive: 0x003333
        });
        const ramp = new THREE.Mesh(geometry, material);
        ramp.rotation.x = -Math.PI / 6;
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        return ramp;
    }

    createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Neon lights
        const neonLight1 = new THREE.PointLight(0xff00ff, 1, 50);
        neonLight1.position.set(10, 10, 0);
        this.scene.add(neonLight1);

        const neonLight2 = new THREE.PointLight(0x00ffff, 1, 50);
        neonLight2.position.set(-10, 10, 0);
        this.scene.add(neonLight2);

        this.lights.push(neonLight1, neonLight2);
    }

    createParticleSystem() {
        // Create particle system for effects
        const particleCount = 100;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 100;
            positions[i + 1] = Math.random() * 50;
            positions[i + 2] = (Math.random() - 0.5) * 100;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.5,
            transparent: true,
            opacity: 0.6
        });

        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particleSystem);
    }

    setupEventListeners() {
        // Keyboard controls - single event listener for all keys
        document.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.key, 'Game state:', this.gameState.currentState); // Debug
            this.handleKeyDown(e);
        });
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // UI Event listeners
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('instructionsButton').addEventListener('click', () => this.showInstructions());
        document.getElementById('closeInstructions').addEventListener('click', () => this.hideInstructions());
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('backToMenuButton').addEventListener('click', () => this.showMainMenu());
        document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
        document.getElementById('pauseRestartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.showMainMenu());

        // Focus the game container to ensure keyboard events work
        document.getElementById('gameContainer').addEventListener('click', () => {
            document.getElementById('gameContainer').focus();
        });
        
        // Set initial focus
        document.getElementById('gameContainer').focus();
    }

    handleKeyDown(e) {
        // Prevent default behavior for game keys
        if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape'].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }

        // Handle ESC key for pause regardless of game state
        if (e.key === 'Escape' && this.gameState.currentState === 'playing') {
            this.togglePause();
            return;
        }

        // Only handle other keys if game is playing
        if (this.gameState.currentState !== 'playing') {
            console.log('Key ignored - game not playing. State:', this.gameState.currentState); // Debug
            return;
        }

        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.controls.forward = true;
                break;
            case 's':
            case 'arrowdown':
                this.controls.backward = true;
                break;
            case 'a':
            case 'arrowleft':
                this.controls.left = true;
                break;
            case 'd':
            case 'arrowright':
                this.controls.right = true;
                break;
            case ' ':
                console.log('Spacebar detected!'); // Debug
                this.jump();
                break;
            default:
                console.log('Unhandled key:', e.key); // Debug
                break;
        }
    }

    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.controls.forward = false;
                break;
            case 's':
            case 'arrowdown':
                this.controls.backward = false;
                break;
            case 'a':
            case 'arrowleft':
                this.controls.left = false;
                break;
            case 'd':
            case 'arrowright':
                this.controls.right = false;
                break;
        }
    }

    jump() {
        const now = performance.now();
        if (now - this.lastJumpTime < this.jumpCooldownMs) return;

        // Allow jump only if fairly close to ground
        if (this.bike.position.y <= 1.05) {
            this.verticalVelocity = this.jumpSpeed;
            this.lastJumpTime = now;
            this.gameState.stunts++;
            this.audioManager.play('jump');
            this.createJumpEffect();
        }
    }

    createJumpEffect() {
        // Create particle effect for jump
        for (let i = 0; i < 10; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.1),
                new THREE.MeshBasicMaterial({ color: 0xff00ff })
            );
            particle.position.copy(this.bike.position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 3,
                (Math.random() - 0.5) * 2
            );
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    startGame() {
        this.gameState.currentState = 'playing';
        this.gameState.isGameRunning = true;
        this.gameState.isPaused = false;
        this.gameState.reset();
        
        // Reset bike position and controls
        this.bike.position.set(0, 1, 0);
        this.bike.rotation.set(0, 0, 0);
        this.controls = {};
        
        // Hide menu, show HUD
        document.getElementById('startMenu').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        
        // Start audio
        this.audioManager.startEngine();
        this.audioManager.play('menu');
    }

    showInstructions() {
        document.getElementById('instructionsModal').classList.remove('hidden');
        this.audioManager.play('menu');
    }

    hideInstructions() {
        document.getElementById('instructionsModal').classList.add('hidden');
        this.audioManager.play('menu');
    }

    restartGame() {
        console.log('Restarting game...'); // Debug
        
        // Clean up the scene
        this.cleanupScene();
        
        // Reset game state
        this.gameState.reset();
        
        // Reset bike position and rotation
        this.bike.position.set(0, 1, 0);
        this.bike.rotation.set(0, 0, 0);
        
        // Reset controls
        this.controls = {};
        
        // Reset camera position
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
        
        // Reset clock
        this.clock = new THREE.Clock();
        
        // Regenerate initial terrain
        this.generateObstacles();
        this.generateRamps();
        
        // Clear any existing powerups and regenerate
        this.powerups.forEach(powerup => {
            if (powerup && this.scene) {
                this.scene.remove(powerup);
            }
        });
        this.powerups = [];
        
        // Start the game
        this.startGame();
        
        console.log('Game restarted successfully'); // Debug
    }

    showMainMenu() {
        this.gameState.currentState = 'menu';
        this.gameState.isGameRunning = false;
        
        // Stop audio
        this.audioManager.stopEngine();
        
        // Show menu, hide other screens
        document.getElementById('startMenu').classList.remove('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('hud').classList.add('hidden');
        
        this.audioManager.play('menu');
    }

    togglePause() {
        if (this.gameState.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    pauseGame() {
        this.gameState.isPaused = true;
        document.getElementById('pauseMenu').classList.remove('hidden');
    }

    resumeGame() {
        this.gameState.isPaused = false;
        document.getElementById('pauseMenu').classList.add('hidden');
    }

    gameOver() {
        this.gameState.currentState = 'gameOver';
        this.gameState.isGameRunning = false;
        
        // Stop audio
        this.audioManager.stopEngine();
        this.audioManager.play('crash');
        
        // Update final scores
        document.getElementById('finalScore').textContent = this.gameState.score;
        document.getElementById('finalDistance').textContent = Math.floor(this.gameState.distance);
        document.getElementById('finalStunts').textContent = this.gameState.stunts;
        
        // Show game over screen
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
    }

    updateBike() {
        if (!this.gameState.isGameRunning || this.gameState.isPaused) return;

        const delta = this.clock.getDelta();

        // Longitudinal acceleration/deceleration
        let targetAccelZ = 0;
        if (this.controls.forward) targetAccelZ -= this.forwardAcceleration;
        if (this.controls.backward) targetAccelZ += this.brakeAcceleration;

        // Apply acceleration on z velocity
        this.bikeVelocity.z += targetAccelZ * delta;

        // Clamp forward/reverse speeds
        const forwardSpeed = -this.bikeVelocity.z; // negative z is forward
        if (forwardSpeed > this.maxForwardSpeed) this.bikeVelocity.z = -this.maxForwardSpeed;
        if (this.bikeVelocity.z > this.maxReverseSpeed) this.bikeVelocity.z = this.maxReverseSpeed;

        // Natural damping when no input
        if (!this.controls.forward && !this.controls.backward) {
            const sign = Math.sign(this.bikeVelocity.z);
            const dampAmt = this.longitudinalDamping * delta;
            this.bikeVelocity.z -= Math.min(Math.abs(this.bikeVelocity.z), dampAmt) * sign;
        }

        // Lateral movement with acceleration and damping
        let targetAccelX = 0;
        if (this.controls.left) targetAccelX -= this.lateralAcceleration;
        if (this.controls.right) targetAccelX += this.lateralAcceleration;

        this.bikeVelocity.x += targetAccelX * delta;
        // Clamp lateral velocity
        if (this.bikeVelocity.x > this.lateralMaxSpeed) this.bikeVelocity.x = this.lateralMaxSpeed;
        if (this.bikeVelocity.x < -this.lateralMaxSpeed) this.bikeVelocity.x = -this.lateralMaxSpeed;

        // Damping lateral when no input
        if (!this.controls.left && !this.controls.right) {
            const signX = Math.sign(this.bikeVelocity.x);
            const dampX = this.lateralDamping * delta;
            this.bikeVelocity.x -= Math.min(Math.abs(this.bikeVelocity.x), dampX) * signX;
        }

        // Jump/gravity
        if (this.bike.position.y <= 1) {
            this.bike.position.y = 1;
            if (this.verticalVelocity < 0) this.verticalVelocity = 0;
        } else {
            this.verticalVelocity += this.gravity * delta;
        }
        this.bike.position.y += this.verticalVelocity * delta;

        // Integrate position
        this.bike.position.x = THREE.MathUtils.clamp(
            this.bike.position.x + this.bikeVelocity.x * delta,
            -8,
            8
        );
        this.bike.position.z += this.bikeVelocity.z * delta;

        // Subtle banking and pitch for feel
        const bank = THREE.MathUtils.clamp(this.bikeVelocity.x / this.lateralMaxSpeed, -1, 1) * 0.25;
        const pitch = THREE.MathUtils.clamp(forwardSpeed / this.maxForwardSpeed, 0, 1) * 0.05;
        this.bike.rotation.z = -bank;
        this.bike.rotation.x = pitch;

        // Camera smoothing follow
        const desiredCameraPos = new THREE.Vector3(
            this.bike.position.x * 0.3,
            8 + this.bike.position.y * 0.2,
            this.bike.position.z + 22
        );
        this.camera.position.lerp(desiredCameraPos, 1 - Math.pow(0.001, delta));
        this.camera.lookAt(new THREE.Vector3(
            this.bike.position.x,
            this.bike.position.y + 1,
            this.bike.position.z - 5
        ));

        // Game metrics
        this.gameState.speed = Math.max(0, Math.floor(forwardSpeed));
        this.gameState.distance = Math.abs(this.bike.position.z);
        this.gameState.score = Math.floor(this.gameState.distance) + this.gameState.stunts * 100;

        // Update engine audio with normalized speed
        const normalized = Math.min(1, forwardSpeed / this.maxForwardSpeed);
        this.audioManager.simpleAudio?.updateEngine?.(normalized);

        // Update HUD and collisions
        this.updateHUD();
        this.checkCollisions();
    }

    updateHUD() {
        document.getElementById('currentScore').textContent = this.gameState.score;
        document.getElementById('currentDistance').textContent = Math.floor(this.gameState.distance);
        document.getElementById('currentSpeed').textContent = Math.floor(this.gameState.speed);
        document.getElementById('currentStunts').textContent = this.gameState.stunts;
        document.getElementById('currentHealth').textContent = this.gameState.health;
        
        // Debug: Log stunts value
        if (this.gameState.stunts > 0) {
            console.log('HUD Update - Stunts:', this.gameState.stunts);
        }
    }

    checkCollisions() {
        // Check obstacle collisions
        this.obstacles.forEach((obstacle, index) => {
            if (!obstacle || !obstacle.position) return;
            
            const distance = this.bike.position.distanceTo(obstacle.position);
            const now = performance.now();
            if (distance < 2 && (now - this.lastHitTime > this.hitInvulnMs)) {
                this.lastHitTime = now;
                this.gameState.health -= 20;
                this.audioManager.play('crash');
                this.createCrashEffect();
                
                // Knockback effect
                this.bikeVelocity.z = Math.min(this.bikeVelocity.z + 15, 10);

                // Remove the obstacle that was hit
                this.scene.remove(obstacle);
                this.obstacles.splice(index, 1);
                
                if (this.gameState.health <= 0) {
                    this.gameOver();
                }
            }
        });

        // Check powerup collisions
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            if (!powerup || !powerup.position) continue;
            
            // Calculate distance in 3D space
            const dx = this.bike.position.x - powerup.position.x;
            const dy = this.bike.position.y - powerup.position.y;
            const dz = this.bike.position.z - powerup.position.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // More generous collision detection
            if (distance < 3.0) {
                this.gameState.score += 500;
                this.audioManager.play('powerup');
                this.scene.remove(powerup);
                this.powerups.splice(i, 1);
            }
        }
    }

    createCrashEffect() {
        // Create crash particles
        for (let i = 0; i < 20; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.2),
                new THREE.MeshBasicMaterial({ color: 0xff4444 })
            );
            particle.position.copy(this.bike.position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 5,
                (Math.random() - 0.5) * 5
            );
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    updateParticles() {
        // Update particle effects
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            if (particle && particle.position && particle.velocity) {
                particle.position.add(particle.velocity.clone().multiplyScalar(0.1));
                particle.velocity.y -= 0.1; // Gravity
                
                if (particle.position.y < -10) {
                    this.scene.remove(particle);
                    this.particles.splice(i, 1);
                }
            }
        }
    }

    updateDayNightCycle() {
        this.dayNightCycle += 0.001;
        const intensity = 0.5 + 0.3 * Math.sin(this.dayNightCycle);
        
        this.lights.forEach(light => {
            light.intensity = intensity;
        });
    }

    generatePowerups() {
        // Generate initial powerups if none exist
        if (this.powerups.length === 0) {
            for (let i = 0; i < 8; i++) {
                this.createPowerup(this.bike.position.z - 50 - i * 25);
            }
        }

        // Clean up powerups that are too far behind
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            if (powerup && powerup.position && powerup.position.z > this.bike.position.z + 50) {
                this.scene.remove(powerup);
                this.powerups.splice(i, 1);
            }
        }

        // Generate new powerups ahead more frequently
        const lastPowerupZ = this.powerups.length > 0 ? 
            Math.min(...this.powerups.map(p => p.position.z)) : this.bike.position.z - 1000;
        
        if (this.bike.position.z - lastPowerupZ > 150) {
            for (let i = 0; i < 4; i++) {
                this.createPowerup(lastPowerupZ - Math.random() * 100 - 50);
            }
        }
    }

    createPowerup(zPosition) {
        const powerupGeometry = new THREE.SphereGeometry(1.0); // Larger size
        const powerupMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xffff00,
            emissive: 0x333300,
            transparent: true,
            opacity: 0.9
        });
        const powerup = new THREE.Mesh(powerupGeometry, powerupMaterial);
        
        // Place powerups in more accessible positions
        const xPos = (Math.random() - 0.5) * 8; // Closer to center
        const yPos = 1.5 + Math.random() * 1; // Lower height for easier collection
        
        powerup.position.set(xPos, yPos, zPosition);
        
        // Add rotation animation and pulse effect
        powerup.userData = { 
            rotationSpeed: 0.03,
            pulseSpeed: 0.05,
            originalScale: 1.0
        };
        
        this.powerups.push(powerup);
        this.scene.add(powerup);
    }

    createSceneryObject(type) {
        let mesh;
        switch (type) {
            case 'tree': {
                // Simple low-poly tree
                const trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.2, 0.25, 2, 6),
                    new THREE.MeshPhongMaterial({ color: 0x8b5a2b, emissive: 0x221100 })
                );
                const foliage = new THREE.Mesh(
                    new THREE.ConeGeometry(1.2, 2.5, 8),
                    new THREE.MeshPhongMaterial({ color: 0x1faa59, emissive: 0x052a12 })
                );
                foliage.position.y = 2;
                const group = new THREE.Group();
                trunk.castShadow = true; foliage.castShadow = true;
                group.add(trunk); group.add(foliage);
                mesh = group;
                break;
            }
            case 'rock': {
                const geo = new THREE.DodecahedronGeometry(0.8);
                const mat = new THREE.MeshPhongMaterial({ color: 0x777777, emissive: 0x111111 });
                mesh = new THREE.Mesh(geo, mat);
                mesh.castShadow = true; mesh.receiveShadow = true;
                break;
            }
            default: { // neon post
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.1, 3.5, 12),
                    new THREE.MeshPhongMaterial({ color: 0x111111, emissive: 0x111111 })
                );
                const glow = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05, 0.05, 2.2, 16),
                    new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x005555 })
                );
                glow.position.y = 1.2;
                const group = new THREE.Group();
                post.castShadow = true; glow.castShadow = true;
                group.add(post); group.add(glow);
                mesh = group;
            }
        }
        return mesh;
    }

    spawnSceneryRow(baseZ) {
        const leftX = -14 - Math.random() * 5; // beyond road edge (~ -10)
        const rightX = 14 + Math.random() * 5;
        const y = 0; // on ground
        const types = ['tree', 'rock', 'post'];
        // Left side
        const leftType = types[Math.floor(Math.random() * types.length)];
        const left = this.createSceneryObject(leftType);
        left.position.set(leftX, y, baseZ);
        left.userData = { isScenery: true, type: leftType };
        this.scene.add(left);
        this.scenery.push(left);
        // Right side
        const rightType = types[Math.floor(Math.random() * types.length)];
        const right = this.createSceneryObject(rightType);
        right.position.set(rightX, y, baseZ);
        right.userData = { isScenery: true, type: rightType };
        this.scene.add(right);
        this.scenery.push(right);
    }

    updateScenery() {
        if (!this.gameState.isGameRunning) return;
        const bikeZ = this.bike.position.z;

        // Spawn new rows ahead as we move forward
        while (this.lastSceneryZ - bikeZ > this.scenerySpacing) {
            this.lastSceneryZ -= this.scenerySpacing;
            this.spawnSceneryRow(this.lastSceneryZ);
        }

        // Clean scenery behind the bike to save memory
        for (let i = this.scenery.length - 1; i >= 0; i--) {
            const obj = this.scenery[i];
            if (!obj) { this.scenery.splice(i, 1); continue; }
            if (obj.position.z > bikeZ + 60) {
                this.scene.remove(obj);
                this.scenery.splice(i, 1);
            }
        }

        // Subtle animation for living scenery
        this.scenery.forEach(obj => {
            if (obj.userData?.type === 'tree') {
                obj.rotation.y += 0.0015; // tiny sway
            } else if (obj.userData?.type === 'post') {
                obj.children.forEach(c => { c.material.emissiveIntensity = 1.0; });
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.gameState.isGameRunning && !this.gameState.isPaused) {
            this.updateBike();
            this.updateParticles();
            this.updateDayNightCycle();
            this.generatePowerups();
            this.generateInfiniteTerrain();
            this.updateScenery();
        }

        // Rotate particle system
        if (this.particleSystem) {
            this.particleSystem.rotation.y += 0.001;
        }

        // Animate powerups
        this.powerups.forEach(powerup => {
            if (powerup && powerup.userData) {
                // Rotation animation
                if (powerup.userData.rotationSpeed) {
                    powerup.rotation.y += powerup.userData.rotationSpeed;
                    powerup.rotation.x += powerup.userData.rotationSpeed * 0.5;
                }
                
                // Pulse animation
                if (powerup.userData.pulseSpeed && powerup.userData.originalScale) {
                    const pulse = Math.sin(Date.now() * powerup.userData.pulseSpeed) * 0.2 + 1;
                    powerup.scale.set(pulse, pulse, pulse);
                }
            }
        });

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    cleanupScene() {
        console.log('Cleaning up scene...'); // Debug
        
        // Clear all game objects
        this.obstacles.forEach(obstacle => {
            if (obstacle && this.scene) {
                this.scene.remove(obstacle);
            }
        });
        this.obstacles = [];
        
        this.powerups.forEach(powerup => {
            if (powerup && this.scene) {
                this.scene.remove(powerup);
            }
        });
        this.powerups = [];
        
        this.particles.forEach(particle => {
            if (particle && this.scene) {
                this.scene.remove(particle);
            }
        });
        this.particles = [];
        
        // Clear terrain objects
        if (this.scene) {
            const childrenToRemove = [];
            this.scene.children.forEach((child) => {
                if (child.userData && (child.userData.isRamp || child.userData.isMarking || child.userData.isTerrain)) {
                    childrenToRemove.push(child);
                }
            });
            childrenToRemove.forEach(child => {
                this.scene.remove(child);
            });
        }
        
        console.log('Scene cleanup complete'); // Debug
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new NeonBikeGame();
    window.game = game;
});
