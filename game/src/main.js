// Solmar City boot, game loop and state machine (title / playing / paused /
// busted / complete). Fixed 1/60 s steps, a smooth chase camera, stealing
// and driving, wanted and police, the helicopter, missions, combat, the HUD,
// procedural sound and the radio, and autosave. ?shot=1..4&seed=N stages a
// screenshot scene instead of the live game.
import * as THREE from 'three';
import { STEP, MAX_FRAME, DEFAULT_SEED, WANTED, COMBAT, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCar, driveCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createHelicopter } from './helicopter.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const scene = new THREE.Scene();

const G = {
  seed,
  rng: createRandom(seed),
  scene,
  camera,
  renderer,
  mode: 'title',
  time: 0,
  money: 0,
  missionIndex: 0,
  packagesGot: 0,
  heat: 0,
  lastCrimeAt: -100,
  lastShotAt: -100,
  lastPunchAt: -100,
  lastDamageAt: -100,
  bustedTimer: 0,
  mission: null,
  camYaw: 0,
  camFreeUntil: 0,
  shotMode: shotParam,
  hasSave: false,
};
G.city = buildCity(G);
G.player = createPlayer(G);
G.traffic = createTraffic(G);
G.pedestrians = createPedestrians(G);
G.police = createPolice(G);
G.helicopter = createHelicopter(G);
G.combat = createCombat(G);
G.missions = createMissions(G);
G.audio = createAudio(G);
G.save = createSave(G);
G.input = createInput(G);
G.hud = createHud(G);
G.hudMessage = (text) => G.hud.message(text);
// Shot scenes must never write a save: they are staged, not played.
G.saveGame = () => { if (!G.shotMode) G.save.saveGame(); };
G.hasSave = G.save.hasSave();
G.camYaw = Math.PI;

function resetWorld() {
  G.money = 0;
  G.missionIndex = 0;
  G.packagesGot = 0;
  G.heat = 0;
  G.mission = null;
  G.bustedTimer = 0;
  G.player.health = 100;
  G.player.ammo = COMBAT.ammoStart;
  G.player.weapon = 'fists';
  G.player.onFoot = true;
  G.player.car = null;
  G.player.group.visible = true;
  G.player.pos.set(G.city.places.spawn.x, 0, G.city.places.spawn.z);
  G.player.yaw = 0;
  G.camYaw = Math.PI;
}

function bustPlayer() {
  G.money = Math.max(0, G.money - WANTED.bustFine);
  G.heat = 0;
  G.bustedTimer = 0;
  G.mission = null;
  if (G.player.car) {
    G.player.car.stolen = false;
    G.player.car = null;
  }
  G.player.onFoot = true;
  G.player.group.visible = true;
  G.player.pos.set(G.city.places.hideout.x, 0, G.city.places.hideout.z);
  G.mode = 'busted';
  G.hudMessage(`BUSTED — $${WANTED.bustFine} fine. You wake up at the hideout.`);
  G.hud.showScreen('busted');
  G.saveGame();
}
G.bustPlayer = bustPlayer;

function stealOrExitCar() {
  const p = G.player;
  if (p.onFoot) {
    let best = null;
    let bestD = 4.5;
    for (const car of G.traffic.cars) {
      if (car.stolen) continue;
      const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (!best) return;
    best.stolen = true;
    best.speed = 0;
    p.car = best;
    p.onFoot = false;
    p.group.visible = false;
    p.pos.copy(best.pos);
    G.camYaw = best.yaw;
    G.police.addHeat(WANTED.steal, 'You stole a car!');
    G.hudMessage(`You stole a ${best.type}.`);
  } else if (p.car) {
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.group.visible = true;
    p.pos.set(car.pos.x + Math.cos(car.yaw) * 2, 0, car.pos.z - Math.sin(car.yaw) * 2);
    p.yaw = car.yaw;
    G.camYaw = car.yaw;
  }
}

function updateCamera(dt) {
  if (G.mode === 'title') {
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 95, 42, Math.cos(t) * 95);
    camera.lookAt(0, 0, 0);
    return;
  }
  const target = G.player.car ? G.player.car.pos : G.player.pos;
  const followYaw = G.player.car ? G.player.car.yaw : G.player.yaw;
  if (G.time > G.camFreeUntil && (G.player.moving || G.player.car)) {
    let diff = followYaw - G.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.camYaw += diff * Math.min(1, 2.5 * dt);
  }
  const dist = G.player.car ? 16 : 6.5;
  const height = 2.4 + Math.sin(G.player.camPitch) * dist * 0.55;
  const cx = target.x - Math.sin(G.camYaw) * dist;
  const cz = target.z - Math.cos(G.camYaw) * dist;
  camera.position.x += (cx - camera.position.x) * Math.min(1, 8 * dt);
  camera.position.y += (height - camera.position.y) * Math.min(1, 8 * dt);
  camera.position.z += (cz - camera.position.z) * Math.min(1, 8 * dt);
  camera.lookAt(target.x, target.y + 3.5, target.z);
}

// One fixed world step. Input is read fresh each step from the live keys
// (or from scripted holds in shot mode).
function stepWorld(dt) {
  G.time += dt;
  const input = G.input;
  const p = G.player;

  if (G.mode === 'playing') {
    // One-shot keys.
    if (input.wasPressed('KeyM')) {
      if (!G.mission) G.missions.startMission();
    }
    if (input.wasPressed('KeyE')) stealOrExitCar();
    if (input.wasPressed('KeyR')) {
      G.audio.cycleRadio();
      G.hudMessage(`Radio: ${G.audio.radioStation() ? G.audio.radioStation().name : 'off'}`);
    }
    if (input.wasPressed('KeyT')) G.missions.startTaxi();
    if (input.wasPressed('Digit1')) p.weapon = 'fists';
    if (input.wasPressed('Digit2')) {
      p.weapon = 'pistol';
      G.audio.ensure();
    }
    if (input.wasPressed('KeyF')) G.combat.punch();
    const click = input.takeClick();
    if (click && p.weapon === 'pistol') {
      const ndc = new THREE.Vector2((click.x / window.innerWidth) * 2 - 1, -(click.y / window.innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const point = ray.ray.at(30, new THREE.Vector3());
      G.combat.firePistolAt(point);
    }
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      G.mode = 'paused';
      G.hud.showScreen('pause');
      G.saveGame();
    }

    // Movement.
    const fwd = (input.held.has('KeyW') ? 1 : 0) - (input.held.has('KeyS') ? 1 : 0);
    const strafe = (input.held.has('KeyD') ? 1 : 0) - (input.held.has('KeyA') ? 1 : 0);
    if (p.onFoot) {
      updatePlayer(G, dt, { x: strafe, z: fwd }, input.held.has('Space'), input.held.has('ShiftLeft') || input.held.has('ShiftRight'));
    } else if (p.car) {
      driveCar(G, p.car, dt, {
        throttle: fwd,
        steer: strafe,
        handbrake: input.held.has('Space'),
      });
      p.pos.copy(p.car.pos);
      p.yaw = p.car.yaw;
    }

    G.traffic.update(dt);
    G.pedestrians.update(dt);
    G.police.update(dt);
    G.helicopter.update(dt);
    G.missions.update(dt);
    G.combat.update(dt);
    G.save.update(dt);
    if (!G.shotMode) {
      G.audio.radioTick();
      G.audio.engine(p.car ? p.car.speed : 0);
      G.audio.siren(G.police.stars() >= 1);
    }
  } else if (G.mode === 'title') {
    G.traffic.update(dt);
    G.pedestrians.update(dt);
  }
  input.clearPressed();
}

function handleTitleKeys() {
  const input = G.input;
  if (input.wasPressed('Enter')) {
    if (G.hasSave && G.save.loadGame()) {
      G.save.applySave(G.save.loadGame());
      G.hudMessage('Welcome back, Vic.');
    } else {
      resetWorld();
    }
    G.mode = 'playing';
    G.hud.showScreen(null);
    G.audio.ensure();
    G.audio.ui();
  }
  input.clearPressed();
}

// Debug and test hooks: the headless play-test drives the real loop
// through these (teleports, heat, aimed shots) and reads live state.
G.test = {
  state() {
    return {
      mode: G.mode,
      money: G.money,
      missionIndex: G.missionIndex,
      heat: G.heat,
      stars: G.police.stars(),
      health: G.player.health,
      ammo: G.player.ammo,
      inCar: !G.player.onFoot,
      mission: G.mission ? { name: G.mission.def.name, stage: G.mission.stage, timer: G.mission.timer, tailTime: G.mission.tailTime, spotted: G.mission.spotted } : null,
      crew: G.combat.enemies.length,
      heliActive: G.helicopter.heli.active,
      heliY: G.helicopter.heli.group.position.y,
      taxiActive: G.missions.taxi.active,
      packagesGot: G.packagesGot,
      playerX: G.player.pos.x,
      playerZ: G.player.pos.z,
      carSpeed: G.player.car ? G.player.car.speed : 0,
      hideout: { ...G.city.places.hideout },
      marinaGate: { ...G.city.places.marinaGate },
      northTower: { ...G.city.places.northTower },
      targetCar: G.missions.targetCar() ? { x: G.missions.targetCar().pos.x, z: G.missions.targetCar().pos.z } : null,
      taxiDest: G.missions.taxi.dest ? { ...G.missions.taxi.dest } : null,
    };
  },
  setHeat(v) { G.heat = v; G.lastCrimeAt = G.time; },
  setMissionTailTime(v) { if (G.mission) G.mission.tailTime = v; },
  teleportPlayer(x, z) {
    G.player.pos.set(x, 0, z);
    if (G.player.car) G.player.car.pos.set(x, 0, z);
  },
  teleportCar(x, z) {
    if (G.player.car) {
      G.player.car.pos.set(x, 0, z);
      G.player.pos.copy(G.player.car.pos);
    } else {
      G.player.pos.set(x, 0, z);
    }
  },
  bringTrafficCarNear() {
    const car = G.traffic.cars.find((c) => !c.stolen);
    if (!car) return false;
    car.pos.set(G.player.pos.x + 2.5, 0, G.player.pos.z + 1);
    car.speed = 0;
    car.yaw = 0;
    return true;
  },
  bringPoliceCarNear() {
    let car = G.police.policeCars[0];
    if (!car) {
      car = createCar(G, 'police', G.player.pos.x + 2, G.player.pos.z, 0);
      G.police.policeCars.push(car);
    }
    car.pos.set(G.player.pos.x + 2, 0, G.player.pos.z);
    car.speed = 0;
    return true;
  },
  setupTaxi() {
    // Put a waiting passenger next to the player and a car under him.
    if (!G.player.car) {
      const car = G.traffic.cars.find((c) => !c.stolen);
      if (car) {
        car.pos.set(G.player.pos.x + 2.5, 0, G.player.pos.z);
        car.speed = 0;
      }
    }
    const p = G.missions.passengers[0];
    if (p) p.pos.set(G.player.pos.x + 3, 0, G.player.pos.z + 2);
    return true;
  },
  shootEnemy(index) {
    const enemy = G.combat.enemies[index];
    if (!enemy) return null;
    const before = enemy.health;
    // Aim the camera at the enemy and fire through the real raycast path.
    const aim = enemy.pos.clone();
    aim.y = 1.2;
    G.camera.lookAt(aim);
    G.player.weapon = 'pistol';
    if (G.player.ammo <= 0) G.player.ammo = 12;
    const camPos = G.camera.position.clone();
    const toEnemy = aim.clone().sub(camPos);
    const diag = {
      cam: { x: +camPos.x.toFixed(1), y: +camPos.y.toFixed(1), z: +camPos.z.toFixed(1) },
      enemy: { x: +enemy.pos.x.toFixed(1), z: +enemy.pos.z.toFixed(1) },
      dist: +toEnemy.length().toFixed(1),
      ammoBefore: G.player.ammo,
    };
    G.combat.firePistolAt(aim);
    const after = G.combat.enemies[index] ? G.combat.enemies[index].health : 0;
    return { before, after, ...diag, ammoAfter: G.player.ammo };
  },
  crewHealth(index) {
    const enemy = G.combat.enemies[index];
    return enemy ? enemy.health : null;
  },
};
window.__game = G;

function render() {
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'playing') {
    G.mode = 'paused';
    G.hud.showScreen('pause');
    G.saveGame();
  }
});

G.hud.refs.btnNew.addEventListener('click', () => {
  resetWorld();
  G.mode = 'playing';
  G.hud.showScreen(null);
  G.audio.ensure();
});
G.hud.refs.btnContinue.addEventListener('click', () => {
  const data = G.save.loadGame();
  if (data) G.save.applySave(data);
  G.mode = 'playing';
  G.hud.showScreen(null);
  G.audio.ensure();
});
G.hud.refs.btnResume.addEventListener('click', () => {
  G.mode = 'playing';
  G.hud.showScreen(null);
});
G.hud.refs.btnRetry.addEventListener('click', () => {
  resetWorld();
  G.mode = 'playing';
  G.hud.showScreen(null);
});

// --- Shot mode: stage the scene, step it, paint twice, signal ready.
if (shotParam) {
  G.mode = 'playing';
  stageShot(shotParam, G, (n, script) => {
    for (let i = 0; i < n; i += 1) {
      if (script) script(i);
      stepWorld(STEP);
      updateCamera(STEP);
    }
  });
  updateCamera(0.016);
  G.hud.update(performance.now());
  let painted = 0;
  (function paint() {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }());
} else {
  G.hud.showTitle();
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    if (G.mode === 'title') handleTitleKeys();
    else if (G.mode === 'busted' || G.mode === 'complete') {
      if (G.input.wasPressed('Enter')) {
        if (G.mode === 'busted') {
          G.mode = 'playing';
          G.hud.showScreen(null);
        } else {
          G.mode = 'playing';
          G.hud.showScreen(null);
        }
      }
      G.input.clearPressed();
    }
    if (G.mode === 'paused') {
      if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP') || G.input.wasPressed('Enter')) {
        G.mode = 'playing';
        G.hud.showScreen(null);
      }
      G.input.clearPressed();
      accumulator = 0;
    }
    if (G.mode === 'playing' || G.mode === 'title') {
      while (accumulator >= STEP && (G.mode === 'playing' || G.mode === 'title')) {
        stepWorld(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateCamera(frameDt);
    G.hud.update(now);
    render();
  }
  requestAnimationFrame(frame);
}
