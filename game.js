// =================================================================
// The Allies & The Attack on Navarone Guns - Final Engine
// =================================================================

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let aaGun, navalGun, shipSprite, shipTurret, planesGroup, sceneContext;
let coastalShells, aaShells, navalShells, planeMissiles;

let coastalHits = 0, navalHits = 0;
const MAX_SCORE = 20000;
let isGameOver = false;

let aaGunHealth = 100, navalGunHealth = 100;
let aaGunDestroyed = false, navalGunDestroyed = false;

let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playWW2Sound(type) {
    // إنشاء سياق الصوت إن لم يكن موجوداً
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // استئناف الصوت إذا كان المتصفح يضعه في حالة "مُعلق" (Suspended)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        let now = audioCtx.currentTime;

        if (type === 'aa_fire') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); 
            osc.stop(now + 0.08);
        } else if (type === 'explosion') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(15, now + 0.3);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); 
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.error("Audio error:", e);
    }
}


function preload() {
    this.textures.addBase64('dummy_loader', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
}


function create() {
    sceneContext = this;
    const W = this.scale.width;
    const H = this.scale.height;

    coastalHits = 0; navalHits = 0;
    aaGunHealth = 100; navalGunHealth = 100;
    aaGunDestroyed = false; navalGunDestroyed = false;
    isGameOver = false;

    this.input.once('pointerdown', () => initAudio());
    this.input.on('pointerdown', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
});


    createProceduralAssets(this);

    // السماء والبحر
    let bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0f1d, 0x0a0f1d, 0x1e293b, 0x0284c7, 1);
    bg.fillRect(0, 0, W, H);

    let sea = this.add.graphics();
    sea.fillStyle(0x0369a1, 0.9);
    sea.fillRect(0, H - 120, W, 120);

    // خلفية الكهوف
    let bunkerShadows = this.add.graphics().setDepth(0);
    bunkerShadows.fillStyle(0x050811, 0.95);
    bunkerShadows.fillEllipse(120, H - 495, 140, 60);
    bunkerShadows.fillEllipse(220, H - 350, 160, 70);

    // المدافع
    aaGun = createWheeledGun(this, 145, H - 495, 'aa_barrel', 'aa_base', 'gun_wheel');
    navalGun = createWheeledGun(this, 245, H - 350, 'naval_barrel', 'naval_base', 'gun_wheel');

    // الجبل
    let mountain = this.physics.add.staticImage(0, H, 'mountain_gfx')
        .setOrigin(0, 1).setDisplaySize(540, 680).setDepth(2);
    mountain.refreshBody();

    // الفرقاطة والمدفع الأبيض
    shipSprite = this.physics.add.image(W - 220, H - 110, 'ship_gfx').setDisplaySize(210, 75).setDepth(10);
    shipSprite.setImmovable(true);
    shipSprite.body.allowGravity = false;
    shipSprite.baseX = W - 220;

    shipTurret = this.add.image(W - 275, H - 125, 'white_turret_barrel').setOrigin(0.1, 0.5).setDepth(11);

    this.tweens.add({
        targets: [shipSprite, shipTurret],
        y: '-=6',
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    planesGroup = this.physics.add.group();
    for (let i = 0; i < 6; i++) {
        spawnAirPlane(this, W + (i * 160), Phaser.Math.Between(50, 300), 3.5 + Math.random() * 2);
    }

    coastalShells = this.physics.add.group();
    aaShells = this.physics.add.group();
    navalShells = this.physics.add.group();
    planeMissiles = this.physics.add.group();

    this.input.on('pointermove', (pointer) => {
        if (isGameOver) return;
        rotateGunTowards(aaGun, pointer.x, pointer.y, -80, 30, aaGunDestroyed || aaGun.hidden);
        rotateGunTowards(navalGun, pointer.x, pointer.y, -60, 30, navalGunDestroyed || navalGun.hidden);
    });

    this.time.addEvent({ delay: 70, callback: fireAABattery, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 200, callback: fireNavalBattery, callbackScope: this, loop: true });

    startAutomatedBunkerCycle(aaGun, 0);
    startAutomatedBunkerCycle(navalGun, 1000);

    setupCollisions(this);
}

function createProceduralAssets(scene) {
    if (scene.textures.exists('mountain_gfx')) return;

    let gM = scene.make.graphics({ add: false });
    gM.fillStyle(0x334155, 1);
    gM.beginPath();
    gM.moveTo(0, 780); gM.lineTo(0, 100); gM.lineTo(150, 100);
    gM.lineTo(260, 300); gM.lineTo(380, 500); gM.lineTo(560, 780);
    gM.closePath(); gM.fillPath();

    gM.fillStyle(0x22c55e, 1);
    gM.beginPath();
    gM.moveTo(0, 100); gM.lineTo(150, 100); gM.lineTo(260, 300);
    gM.lineTo(230, 320); gM.lineTo(120, 120); gM.lineTo(0, 120);
    gM.closePath(); gM.fillPath();
    gM.generateTexture('mountain_gfx', 560, 780);

    let gS = scene.make.graphics({ add: false });
    gS.fillStyle(0x1e293b, 1); gS.fillRect(20, 45, 180, 30);
    gS.fillStyle(0x38bdf8, 1); gS.fillRect(50, 25, 90, 20);
    gS.generateTexture('ship_gfx', 220, 75);

    let gT = scene.make.graphics({ add: false });
    gT.fillStyle(0xffffff, 1); gT.fillRect(0, 0, 45, 8);
    gT.fillRect(-10, -6, 20, 20);
    gT.generateTexture('white_turret_barrel', 55, 20);

    let gP = scene.make.graphics({ add: false });
    gP.fillStyle(0xf8fafc, 1); gP.fillEllipse(50, 25, 38, 10);
    gP.fillStyle(0x38bdf8, 1); gP.fillRect(40, 5, 12, 40);
    gP.fillStyle(0xef4444, 1); gP.fillTriangle(15, 25, 5, 10, 25, 25);
    gP.generateTexture('plane_gfx', 100, 50);

    let gB = scene.make.graphics({ add: false });
    gB.fillStyle(0xffffff, 1); gB.fillRect(0, 0, 16, 5);
    gB.generateTexture('laser_bullet', 16, 5);

    let g1 = scene.make.graphics({ add: false });
    g1.fillStyle(0x38bdf8, 1); g1.fillRect(0, 0, 100, 18);
    g1.generateTexture('aa_barrel', 100, 22);

    let g2 = scene.make.graphics({ add: false });
    g2.fillStyle(0x64748b, 1); g2.fillRoundedRect(0, 0, 75, 40, 8);
    g2.generateTexture('aa_base', 75, 40);

    let g3 = scene.make.graphics({ add: false });
    g3.fillStyle(0xf59e0b, 1); g3.fillRect(0, 0, 120, 22);
    g3.generateTexture('naval_barrel', 120, 26);

    let g4 = scene.make.graphics({ add: false });
    g4.fillStyle(0x475569, 1); g4.fillRoundedRect(0, 0, 85, 45, 8);
    g4.generateTexture('naval_base', 85, 45);

    let g5 = scene.make.graphics({ add: false });
    g5.fillStyle(0x94a3b8, 1); g5.fillCircle(12, 12, 12);
    g5.generateTexture('gun_wheel', 24, 24);
}

function createWheeledGun(scene, x, y, barrelKey, baseKey, wheelKey) {
    let container = scene.add.container(x, y).setDepth(1);
    let barrel = scene.add.image(12, -8, barrelKey).setOrigin(0.1, 0.5);
    let base = scene.add.image(0, 0, baseKey).setOrigin(0.5, 0.6);
    let leftWheel = scene.add.image(-22, 16, wheelKey).setDisplaySize(24, 24);
    let rightWheel = scene.add.image(22, 16, wheelKey).setDisplaySize(24, 24);

    container.add([barrel, base, leftWheel, rightWheel]);
    scene.physics.add.existing(container);
    container.body.setSize(90, 60);

    return {
        container: container, barrel: barrel, base: base,
        wheels: [leftWheel, rightWheel], x: x, y: y, baseX: x,
        hidden: false, inManualControl: false
    };
}

function startAutomatedBunkerCycle(gunObj, initialDelay) {
    sceneContext.time.delayedCall(initialDelay, () => {
        let cycle = () => {
            if (isGameOver || gunObj.inManualControl) return;

            sceneContext.time.delayedCall(4500, () => {
                if (isGameOver || gunObj.inManualControl) return;

                sceneContext.tweens.add({
                    targets: gunObj.container,
                    x: gunObj.baseX - 135,
                    duration: 500,
                    ease: 'Quad.easeInOut',
                    onStart: () => { gunObj.hidden = true; rotateWheels(gunObj, 1); },
                    onComplete: () => {
                        gunObj.x = gunObj.container.x;
                        sceneContext.time.delayedCall(500, () => {
                            if (isGameOver || gunObj.inManualControl) return;

                            sceneContext.tweens.add({
                                targets: gunObj.container,
                                x: gunObj.baseX,
                                duration: 500,
                                ease: 'Quad.easeOut',
                                onStart: () => rotateWheels(gunObj, -1),
                                onComplete: () => {
                                    gunObj.hidden = false;
                                    gunObj.x = gunObj.container.x;
                                    cycle();
                                }
                            });
                        });
                    }
                });
            });
        };
        cycle();
    });
}

function toggleGunBunker(type) {
    let gunObj = type === 'aa' ? aaGun : navalGun;
    if (isGameOver || !gunObj) return;

    gunObj.inManualControl = true;
    sceneContext.tweens.killTweensOf(gunObj.container);

    let targetX = gunObj.hidden ? gunObj.baseX : gunObj.baseX - 135;
    let newHiddenState = !gunObj.hidden;

    sceneContext.tweens.add({
        targets: gunObj.container,
        x: targetX,
        duration: 500,
        ease: 'Quad.easeInOut',
        onStart: () => rotateWheels(gunObj, gunObj.hidden ? -1 : 1),
        onComplete: () => {
            gunObj.hidden = newHiddenState;
            gunObj.x = gunObj.container.x;
            sceneContext.time.delayedCall(2000, () => {
                gunObj.inManualControl = false;
                startAutomatedBunkerCycle(gunObj, 0);
            });
        }
    });
}

function rotateWheels(gunObj, direction) {
    gunObj.wheels.forEach(wheel => {
        sceneContext.tweens.add({ targets: wheel, angle: wheel.angle + (direction * 360), duration: 500 });
    });
}

function setupCollisions(scene) {
    scene.physics.add.overlap(aaShells, planeMissiles, (shell, missile) => {
        triggerSparkExplosion(scene, missile.x, missile.y, 0x38bdf8);
        shell.destroy(); missile.destroy();
    });

    scene.physics.add.overlap(coastalShells, navalShells, (shell, nShell) => {
        triggerSparkExplosion(scene, nShell.x, nShell.y, 0xf59e0b);
        shell.destroy(); nShell.destroy();
    });

    scene.physics.add.overlap(coastalShells, shipSprite, (ship, shell) => {
        triggerSparkExplosion(scene, shell.x, shell.y, 0xffd700);
        shell.destroy(); coastalHits += 40;
        updateScoreDisplay(); checkMatchWinner();
    });

    scene.physics.add.overlap(aaShells, planesGroup, (shell, plane) => {
        playWW2Sound('explosion');
        triggerSparkExplosion(scene, plane.x, plane.y, 0xff4500);
        shell.destroy(); plane.destroy();
        coastalHits += 80;
        updateScoreDisplay(); checkMatchWinner();

        if (planesGroup.getLength() < 7) {
            scene.time.delayedCall(700, () => {
                spawnAirPlane(scene, scene.scale.width + 80, Phaser.Math.Between(50, 300), 3.5 + Math.random() * 2);
            });
        }
    });

    scene.physics.add.overlap(navalShells, aaGun.container, (gun, proj) => {
        if (aaGun.hidden) return;
        triggerSparkExplosion(scene, proj.x, proj.y, 0x00f0ff);
        proj.destroy();
        if (!aaGunDestroyed) {
            aaGunHealth -= 2.5; navalHits += 2;
            if (aaGunHealth <= 0) { destroyGun(aaGun); aaGunDestroyed = true; }
            updateScoreDisplay(); checkMatchWinner();
        }
    });

    scene.physics.add.overlap(navalShells, navalGun.container, (gun, proj) => {
        if (navalGun.hidden) return;
        triggerSparkExplosion(scene, proj.x, proj.y, 0x00f0ff);
        proj.destroy();
        if (!navalGunDestroyed) {
            navalGunHealth -= 2.5; navalHits += 2;
            if (navalGunHealth <= 0) { destroyGun(navalGun); navalGunDestroyed = true; }
            updateScoreDisplay(); checkMatchWinner();
        }
    });
}

function triggerShipSalvo() {
    if (isGameOver || !shipSprite) return;
    playWW2Sound('explosion');
    let Sx = shipTurret.x;
    let Sy = shipTurret.y;

    for (let i = 0; i < 2; i++) {
        let targetGun = i === 0 ? aaGun : navalGun;
        let angle = Phaser.Math.Angle.Between(Sx, Sy, targetGun.x, targetGun.y);
        let speed = 1100;

        let bullet = navalShells.create(Sx, Sy, 'laser_bullet').setDepth(6);
        bullet.setTint(0x00f0ff); bullet.setScale(2.0, 1.4);
        bullet.rotation = angle;
        bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
}

function triggerAirstrike() {
    if (isGameOver || !planesGroup) return;
    planesGroup.getChildren().forEach(plane => {
        if (plane.x < sceneContext.scale.width && plane.x > 150) {
            let targetGun = Math.random() > 0.5 ? aaGun : navalGun;
            let angle = Phaser.Math.Angle.Between(plane.x, plane.y, targetGun.x, targetGun.y);

            let missile = planeMissiles.create(plane.x, plane.y, 'laser_bullet').setDepth(5);
            missile.setTint(0xa855f7); missile.setScale(2.1, 1.4);
            missile.rotation = angle;
            missile.setVelocity(Math.cos(angle) * 850, Math.sin(angle) * 850);
        }
    });
}

function triggerHeavyBarrage() {
    if (isGameOver) return;
    [aaGun, navalGun].forEach(gunObj => {
        if (!gunObj.hidden && ((gunObj === aaGun && !aaGunDestroyed) || (gunObj === navalGun && !navalGunDestroyed))) {
            for (let i = 0; i < 5; i++) {
                sceneContext.time.delayedCall(i * 40, () => {
                    let spreadAngle = gunObj.barrel.rotation + Phaser.Math.DegToRad((Math.random() - 0.5) * 35);
                    let spawnX = gunObj.x + Math.cos(spreadAngle) * 85;
                    let spawnY = gunObj.y + Math.sin(spreadAngle) * 85;

                    let targetGroup = gunObj === aaGun ? aaShells : coastalShells;
                    let bulletColor = gunObj === aaGun ? 0x10b981 : 0xff4500;

                    let bullet = targetGroup.create(spawnX, spawnY, 'laser_bullet').setDepth(6);
                    bullet.setTint(bulletColor); bullet.setScale(2.4, 1.8);
                    bullet.rotation = spreadAngle;
                    bullet.setVelocity(Math.cos(spreadAngle) * 1300, Math.sin(spreadAngle) * 1300);

                    playWW2Sound('aa_fire');
                    triggerSparkExplosion(sceneContext, spawnX, spawnY, 0xffeb3b);
                });
            }
        }
    });
}

function rotateGunTowards(gunObj, targetX, targetY, minDeg, maxDeg, isDisabled) {
    if (isDisabled || !gunObj || !gunObj.barrel) return;
    let angle = Phaser.Math.Angle.Between(gunObj.x, gunObj.y, targetX, targetY);
    gunObj.barrel.rotation = Phaser.Math.Clamp(angle, Phaser.Math.DegToRad(minDeg), Phaser.Math.DegToRad(maxDeg));
}

function spawnAirPlane(scene, x, y, speed) {
    let plane = planesGroup.create(x, y, 'plane_gfx').setDisplaySize(80, 40).setDepth(5);
    plane.setFlipX(true); plane.body.allowGravity = false; plane.speed = speed;
}

function fireAABattery() {
    if (isGameOver || aaGunDestroyed || aaGun.hidden) return;
    playWW2Sound('aa_fire');
    fireGenericBattery(aaGun, aaShells, 0x38bdf8, 1.4, 1300, 25);
}

function fireNavalBattery() {
    if (isGameOver || navalGunDestroyed || navalGun.hidden) return;
    playWW2Sound('aa_fire');
    fireGenericBattery(navalGun, coastalShells, 0xf59e0b, 2.1, 1050, 6);
}

function fireGenericBattery(gunObj, bulletGroup, colorHex, scaleMult, speed, spreadDeg) {
    let finalAngle = gunObj.barrel.rotation + Phaser.Math.DegToRad((Math.random() - 0.5) * spreadDeg);
    let spawnX = gunObj.x + Math.cos(finalAngle) * 85;
    let spawnY = gunObj.y + Math.sin(finalAngle) * 85;

    let bullet = bulletGroup.create(spawnX, spawnY, 'laser_bullet').setDepth(6);
    bullet.setTint(colorHex); bullet.setScale(scaleMult, scaleMult * 0.7);
    bullet.rotation = finalAngle;
    bullet.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);
}

function destroyGun(gunObj) {
    playWW2Sound('explosion');
    gunObj.barrel.setTint(0x333333); gunObj.base.setTint(0x111111);
    for (let i = 0; i < 10; i++) {
        triggerSparkExplosion(sceneContext, gunObj.x + Phaser.Math.Between(-15, 15), gunObj.y + Phaser.Math.Between(-15, 15), 0xff4500);
    }
}

function triggerSparkExplosion(scene, x, y, mainColor = 0xffffff) {
    for (let i = 0; i < 6; i++) {
        let spark = scene.add.graphics().setDepth(15);
        spark.fillStyle(mainColor, 1); spark.fillRect(x, y, 4, 4);
        let angle = (Math.PI * 2 / 6) * i;
        let speed = Phaser.Math.Between(40, 140);
        scene.tweens.add({
            targets: spark, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed,
            alpha: 0, duration: 220, onComplete: () => spark.destroy()
        });
    }
}

function updateScoreDisplay() {
    const elCoastal = document.getElementById('score-coastal');
    const elGuns = document.getElementById('guns-health');
    const elFleet = document.getElementById('fleet-status');

    if (elCoastal) elCoastal.innerText = `Hits: ${coastalHits} / ${MAX_SCORE}`;
    if (elGuns) elGuns.innerText = `AA: ${Math.max(0, Math.ceil(aaGunHealth))}% | NAV: ${Math.max(0, Math.ceil(navalGunHealth))}%`;
    if (elFleet) elFleet.innerText = coastalHits >= MAX_SCORE ? "RETREAT" : "ATTACKING";
}

function checkMatchWinner() {
    if (coastalHits >= MAX_SCORE || (aaGunDestroyed && navalGunDestroyed)) {
        isGameOver = true;
        sceneContext.physics.pause();

        let winnerText = coastalHits >= MAX_SCORE ? "COASTAL FORTRESS VICTORIOUS!" : "ENEMY FLEET DESTROYED THE BASE!";
        let colorText = coastalHits >= MAX_SCORE ? "#22c55e" : "#f97316";

        let overlay = sceneContext.add.graphics().setDepth(20);
        overlay.fillStyle(0x0f172a, 0.88);
        overlay.fillRect(0, 0, sceneContext.scale.width, sceneContext.scale.height);

        sceneContext.add.text(sceneContext.scale.width / 2, 280, "GAME OVER", { fontSize: '44px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(21);
        sceneContext.add.text(sceneContext.scale.width / 2, 350, winnerText, { fontSize: '26px', fontStyle: 'bold', color: colorText }).setOrigin(0.5).setDepth(21);

        let restartBtn = sceneContext.add.text(sceneContext.scale.width / 2, 440, "RESTART MATCH", {
            fontSize: '22px', backgroundColor: '#0284c7', padding: { x: 20, y: 10 }, color: '#ffffff'
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => { sceneContext.scene.restart(); });
    }
}

function update(time) {
    if (isGameOver) return;
    const W = this.scale.width;

    if (planesGroup && planesGroup.getChildren().length > 0) {
        let targetPlane = planesGroup.getChildren()[0];
        rotateGunTowards(aaGun, targetPlane.x, targetPlane.y, -80, 30, aaGunDestroyed || aaGun.hidden);
    }
    rotateGunTowards(navalGun, shipSprite.x, shipSprite.y, -60, 30, navalGunDestroyed || navalGun.hidden);

    if (shipTurret && navalGun.container) {
        let angle = Phaser.Math.Angle.Between(shipTurret.x, shipTurret.y, navalGun.container.x, navalGun.container.y);
        shipTurret.rotation = angle;
    }

    if (planesGroup) {
        planesGroup.getChildren().forEach(plane => {
            plane.x -= plane.speed;
            if (plane.x < -100) {
                plane.x = W + 100;
                plane.y = Phaser.Math.Between(50, 300);
            }
        });
    }
}
