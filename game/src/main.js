// Solmar City — boot, game loop and the state machine (title / playing /
// paused / busted / complete). This file wires the systems together: input
// and camera, stealing and driving, wanted and police, missions, combat,
// HUD, sound and saving. The game runs on a fixed 1/60 s step so it plays
// the same on any display.
//
// ?seed=N fixes the city. ?shot=1..4 stages a screenshot scene instead of
// the title screen and sets window.__shotReady when it has settled.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, clamp } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, roadCoords, nearestRoad } from './city.js';
import { createPlayer, stepPlayer, updateCamera } from './player.js';
import { makeCar, stepCar, removeCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = makeRng(seed);

// --- renderer / scene / light ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.skyDay);
scene.fog = new THREE.Fog(CFG.fogDay, 130, 460);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
camera.position.set(0, 30, 60);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(CFG.sunDay, 2.0);
sun.position.set(90, 140, 60);
scene.add(sun);
resize();
window.addEventListener('resize', resize);

// --- systems ---
const city = buildCity(scene, seed);
const input = createInput(canvas);
const audio = createAudio();
const player = createPlayer(scene);
const traffic = createTraffic(scene, rng, city.colliders);
const peds = createPedestrians(scene, rng);
const police = createPolice(scene, rng);
const combat = createCombat(scene, rng);
const missions = createMissions(scene, city.places, rng, city.colliders);
const hud = createHud();
const parkedCars = [];

const G = {
  mode: 'title',
  money: 0, health: CFG.maxHealth, ammo: CFG.pistolAmmo,
  weapon: 'fists', inCar: false, car: null,
  places: city.places, peds, traffic, police, missions, combat, input, player,
  colliders: city.colliders, city, camera, THREE,
  shotFrames: 0, shotCountdown: 0,
  shake: 0, danger: null, saveTimer: 0,
};
window.__game = G;

// --- game state helpers ---
function playerPos() {
  return G.inCar && G.car ? { x: G.car.x, z: G.car.z } : { x: player.x, z: player.z };
}
function playerSpeed() {
  return G.inCar && G.car ? Math.abs(G.car.speed) : Math.abs(player.speed);
}
function announce(msg) { status.textContent = msg; }

const missionHooks = {
  onBrief: (text) => { hud.say(text.replace(/^Rosa: /, ''), 'Rosa'); audio.phone(); },
  onPaid: (pay, what) => {
    G.money += pay;
    hud.say(`${what} complete — +$${pay}.`, 'Rosa');
    audio.jingle();
    writeSave();
    if (missions.state.index >= CFG.missions.length && G.mode === 'playing') {
      G.mode = 'complete';
      hud.setComplete(G.money);
      hud.show('complete');
    }
  },
  onFail: (reason) => { hud.say(reason, 'Rosa'); audio.fail(); },
  onPackage: (pay, count) => {
    G.money += pay;
    hud.say(`Hidden package found (${count}/${CFG.packageCount}) — +$${pay}.`);
    audio.pickup();
  },
  spawnTailTarget: () => {
    const car = makeCar(scene, rng, 'sedan', -22, -88, Math.PI / 2);
    car.mesh.children.forEach(() => {});
    car.spec = CFG.cars.sedan;
    car.cruise = 12;
    traffic.cars.push(car);
    car.mesh.traverse((o) => { if (o.material) o.material = o.material.clone(); });
    // Paint it blue so the player can follow it.
    car.mesh.children[0].material.color.setHex(0x1565c0);
    return car;
  },
  spawnGunmen: (spots) => combat.spawnGunmen(spots),
  police,
  enemiesLeft: () => combat.enemies.filter((e) => e.alive).length,
};
G.missionHooks = missionHooks;

G.setTimeOfDay = (when) => {
  if (when === 'sunset') {
    scene.background.setHex(CFG.skySunset);
    scene.fog.color.setHex(0xd88a5a);
    sun.color.setHex(CFG.sunSunset);
    sun.position.set(-120, 60, 80);
    hemi.intensity = 0.7;
  } else {
    scene.background.setHex(CFG.skyDay);
    scene.fog.color.setHex(CFG.fogDay);
    sun.color.setHex(CFG.sunDay);
    sun.position.set(90, 140, 60);
    hemi.intensity = 1.0;
  }
};

G.spawnParkedTaxi = (x, z, heading) => {
  const car = makeCar(scene, rng, 'taxi', x, z, heading);
  car.parked = true;
  parkedCars.push(car);
  return car;
};

// Put Vic in a car of `type` at (x,z): used by screenshots and respawns.
G.startDriving = (type, x, z, heading) => {
  const car = makeCar(scene, rng, type, x, z, heading);
  car.isPlayer = true;
  G.car = car; G.inCar = true;
  player.mesh.visible = false;
  return car;
};

function exitCar() {
  const car = G.car;
  if (!car) return;
  car.isPlayer = false;
  car.parked = true;
  parkedCars.push(car);
  const side = 2.6;
  player.x = car.x + Math.cos(car.heading) * side;
  player.z = car.z - Math.sin(car.heading) * side;
  player.y = 0; player.vy = 0; player.grounded = true;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  G.car = null; G.inCar = false;
}

function stealCar() {
  let best = null, bestD = 4.5;
  for (const car of [...traffic.cars, ...parkedCars]) {
    if (!car.alive || car.isPolice) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  // Pull the driver out: they flee on foot.
  const victim = peds.spawn(best.x + 2, best.z + 2);
  victim.flee = 3; victim.fleeX = 1; victim.fleeZ = 0;
  const ti = traffic.cars.indexOf(best);
  if (ti >= 0) traffic.cars.splice(ti, 1);
  const pi = parkedCars.indexOf(best);
  if (pi >= 0) parkedCars.splice(pi, 1);
  best.isPlayer = true;
  best.speed = 0; best.vx = 0; best.vz = 0;
  G.car = best; G.inCar = true;
  player.mesh.visible = false;
  police.addHeat(CFG.stealHeat);
  hud.say('You jacked the car. The driver ran — and somebody called it in.');
  audio.crash();
}

function startGame(fromSave) {
  const s = fromSave ? loadGame() : null;
  G.money = s ? s.money : 0;
  G.health = CFG.maxHealth;
  G.ammo = s ? s.ammo : CFG.pistolAmmo;
  missions.state.index = s ? s.missionsDone : 0;
  missions.state.collected = s ? s.collected : 0;
  if (s) {
    player.x = s.px; player.z = s.pz;
    hud.say('Welcome back, Vic. Rosa has work if you want it.');
  } else {
    player.x = city.places.spawn.x; player.z = city.places.spawn.z;
    hud.say('Rosa: Vic, you owe the shark $1,500. Five jobs and you\'re free. Press M to start the first one.', 'Rosa');
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.visible = true;
  G.mode = 'playing';
  hud.show('playing');
  audio.unlock();
  announce('Playing. Solmar City.');
}

function writeSave() {
  saveGame({
    money: G.money, ammo: G.ammo,
    missionsDone: missions.state.index, collected: missions.state.collected,
    px: player.x, pz: player.z,
  });
}

function busted(kind) {
  const fine = kind === 'wasted' ? 50 : CFG.bustedFine;
  G.money = Math.max(0, G.money - fine);
  if (G.inCar) exitCar();
  police.clear();
  combat.clearEnemies();
  if (missions.state.active) {
    const m = missions.state.active;
    missions.failMission(kind === 'wasted' ? 'You got shot up — the job is blown.' : `Busted during "${m.def.name}".`, missionHooks);
  }
  player.x = city.places.hideout.x; player.z = city.places.hideout.z;
  player.y = 0; player.vy = 0;
  player.mesh.position.set(player.x, 0, player.z);
  G.health = CFG.maxHealth;
  G.mode = 'busted';
  hud.setBusted(fine);
  hud.show('busted');
  audio.fail();
  writeSave();
  announce(kind === 'wasted' ? 'Wasted.' : 'Busted.');
}

function onDamage(amount, kind) {
  if (kind === 'ammo') {
    G.ammo = Math.min(CFG.pistolMaxAmmo, G.ammo + CFG.ammoPickup);
    hud.say(`Ammo picked up (+${CFG.ammoPickup}).`);
    audio.pickup();
    return;
  }
  G.health -= amount;
  G.shake = Math.max(G.shake, 0.35);
  if (G.health <= 0) busted('wasted');
}

// --- the fixed step ---
function step(dt) {
  const pos = playerPos();
  if (G.mode === 'title') {
    // Slow orbit over downtown behind the menu.
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.05) * 70, 34, Math.cos(t * 0.05) * 70);
    camera.lookAt(0, 12, 0);
    traffic.step(dt, null, { x: 0, z: 0 });
    peds.step(dt, null);
    return;
  }
  if (G.mode !== 'playing') return;

  // Pause / resume.
  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
    G.mode = 'paused';
    hud.show('pause');
    writeSave();
    announce('Paused.');
    return;
  }
  // Start a mission.
  if (input.wasPressed('KeyM') && !missions.state.active && missions.state.index < CFG.missions.length) {
    missions.startMission(missions.state.index, missionHooks);
  }
  // Weapon switch.
  if (input.wasPressed('Digit1')) { G.weapon = 'fists'; player.gun.visible = false; }
  if (input.wasPressed('Digit2')) { G.weapon = 'pistol'; player.gun.visible = true; }

  // --- on foot ---
  if (!G.inCar) {
    const camYawRef = { value: player.camYaw };
    stepPlayer(player, input, dt, city.colliders, camYawRef);
    // Punch — only gunmen can be punched, and dropping an armed attacker
    // who is shooting at you is self-defence, not a crime: no heat.
    if (input.wasPressed('KeyF') && player.punchTimer <= 0) {
      player.punchTimer = 0.45;
      audio.punch();
      const hit = combat.punch(player.x, player.z, player.heading);
      if (hit) hud.say('You dropped him.');
      G.danger = { x: player.x, z: player.z, radius: 10 };
    }
    // Shoot — the bullet goes where the player clicked: unproject the click
    // through the camera so the pistol aims at the cursor, not just where
    // the camera happens to look.
    if (input.consumeClick() && G.weapon === 'pistol') {
      if (G.ammo > 0) {
        G.ammo -= 1;
        audio.gunshot();
        const m5fight = missions.state.active && missions.state.active.def.id === 5 && missions.state.active.stage === 1;
        if (!m5fight) police.addHeat(CFG.shootHeat);
        const origin = camera.position.clone();
        const click = input.consumeClickPos();
        let dir;
        if (click) {
          const ndc = new THREE.Vector3(
            (click.x / window.innerWidth) * 2 - 1,
            -(click.y / window.innerHeight) * 2 + 1,
            0.5,
          ).unproject(camera);
          dir = ndc.sub(origin).normalize();
        } else {
          dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
        }
        const hit = combat.shoot(origin, dir, city.colliders);
        if (hit && !hit.alive && !m5fight) { police.addHeat(CFG.killHeat); hud.say('Target down.'); }
        else if (hit && !hit.alive) hud.say('Target down.');
        G.danger = { x: player.x, z: player.z, radius: 22 };
        G.shake = Math.max(G.shake, 0.15);
      } else {
        hud.say('Out of ammo — find a green ammo box.');
      }
    }
    // Steal a car.
    if (input.wasPressed('KeyE')) stealCar();
  } else {
    // --- driving ---
    const ax = input.axis();
    const handbrake = input.held('Space');
    const car = G.car;
    const others = [...traffic.cars, ...parkedCars, ...police.cars];
    const result = stepCar(car, dt, ax.f, -ax.r, handbrake, city.colliders, others);
    if (result === 'crash') { audio.crash(); G.shake = Math.max(G.shake, 0.5); }
    // Stunt ramps: speed over a ramp launches the car.
    for (const r of city.ramps) {
      if (Math.hypot(car.x - r.x, car.z - r.z) < r.r && Math.abs(car.speed) > 14 && car.airborne === 0) {
        car.vy = 8.5; car.airborne = 0.1;
        hud.say('Stunt jump! Air time.');
        audio.pickup();
      }
    }
    // Hitting a pedestrian while driving.
    if (Math.abs(car.speed) > 4 && peds.hitByCar(car.x, car.z, 2.2)) {
      police.addHeat(CFG.hitPedHeat);
      audio.crash();
      G.shake = Math.max(G.shake, 0.4);
      hud.say('You hit a pedestrian! The city saw it.');
    }
    // Speeding past police adds heat.
    if (Math.abs(car.speed) > 28) {
      for (const pc of police.cars) {
        if (Math.hypot(pc.x - car.x, pc.z - car.z) < 16) police.addHeat(2 * dt);
      }
    }
    // Exit the car.
    if (input.wasPressed('KeyE')) exitCar();
  }

  // Taxi: near the waiting passenger, in a car, press T.
  const taxiPed = peds.peds.find((p) => p.taxi && p.alive);
  if (taxiPed && !missions.state.taxi) {
    const d = Math.hypot(taxiPed.x - pos.x, taxiPed.z - pos.z);
    if (G.inCar && d < 8) {
      hud.update({ ...hudState(), hint: 'Press T — passenger wants a ride' });
      if (input.wasPressed('KeyT')) {
        const roads = roadCoords();
        const dest = {
          x: roads[Math.floor(Math.random() * roads.length)] + (Math.random() < 0.5 ? -2 : 2),
          z: roads[Math.floor(Math.random() * roads.length)],
        };
        missions.startTaxi({ x: taxiPed.x, z: taxiPed.z }, dest);
        taxiPed.alive = false; taxiPed.mesh.visible = false;
        taxiPed.taxi = false;
        hud.say('Passenger: Take me across town, fast but smooth.');
        audio.phone();
      }
    }
  }

  // --- world systems ---
  traffic.step(dt, G.inCar ? G.car : null, pos);
  peds.step(dt, G.danger);
  G.danger = null;
  const bustedResult = police.step(dt, pos, G.car, playerSpeed(), !G.inCar);
  // Screenshot staging: in the last frames before the shot, hold the police
  // cars where the camera can see them — behind the player (shot 1) or
  // coming down the opposite lane in the distance (shot 3).
  if (shot && G.shotCountdown <= 15 && G.inCar && G.car && police.cars.length) {
    const gap = G.shotPoliceGap || 13;
    police.cars.forEach((pc, i) => {
      if (G.shotPoliceMode === 'ahead') {
        // Coming down the opposite lane toward the player, in the distance.
        const ahead = 45 + i * 12;
        pc.x = G.car.x + Math.sin(G.car.heading) * ahead + Math.cos(G.car.heading) * 2.2;
        pc.z = G.car.z + Math.cos(G.car.heading) * ahead - Math.sin(G.car.heading) * 2.2;
        pc.heading = G.car.heading + Math.PI;
        pc.speed = 20;
      } else {
        const back = gap + i * 9;
        pc.x = G.car.x - Math.sin(G.car.heading) * back;
        pc.z = G.car.z - Math.cos(G.car.heading) * back;
        pc.heading = G.car.heading;
        pc.speed = Math.abs(G.car.speed) * 0.95;
      }
      pc.vx = Math.sin(pc.heading) * pc.speed;
      pc.vz = Math.cos(pc.heading) * pc.speed;
      pc.mesh.position.set(pc.x, 0, pc.z);
      pc.mesh.rotation.y = pc.heading;
    });
  }
  combat.step(dt, pos, onDamage);
  missions.step(dt, { px: pos.x, pz: pos.z, inCar: G.inCar }, missionHooks);

  // Audio + camera.
  audio.setEngine(G.inCar ? Math.abs(G.car.speed) / CFG.cars.sports.top : 0, G.inCar);
  audio.setSiren(police.siren);
  updateCamera(camera, player, G.inCar ? G.car : null, dt);
  // Shot 1 cover: a three-quarter front view so the chasing police cars
  // behind the player are in the frame (a chase cam hides them).
  if (shot === '1' && G.shotCountdown <= 15 && G.inCar && G.car) {
    const c = G.car;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    const rx = Math.cos(c.heading), rz = -Math.sin(c.heading);
    camera.position.set(c.x + fx * 11 + rx * 9, 4.6, c.z + fz * 11 + rz * 9);
    camera.lookAt(c.x - fx * 6, 1.2, c.z - fz * 6);
  }
  if (G.shake > 0) {
    G.shake -= dt;
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.9;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.6;
  }

  // Autosave now and then.
  G.saveTimer += dt;
  if (G.saveTimer > 20) { G.saveTimer = 0; writeSave(); }

  // HUD.
  hud.update(hudState());
  input.endFrame();

  if (bustedResult === 'busted') busted('busted');
}

function hudState() {
  const pos = playerPos();
  const m = missions.state.active;
  return {
    money: G.money, health: G.health, wanted: police.wanted,
    objective: missions.objectiveText(),
    weapon: G.weapon, ammo: G.ammo,
    inCar: G.inCar, speed: G.inCar ? Math.abs(G.car.speed) : 0,
    px: pos.x, pz: pos.z,
    heading: G.inCar ? G.car.heading : player.heading,
    waypoint: missions.waypoint(),
    police: police.cars, traffic: traffic.cars, peds: peds.peds,
    taxiPed: peds.peds.find((p) => p.taxi && p.alive) || null,
    collected: missions.state.collected,
    missionsDone: missions.state.index,
    timerText: m ? `⏱ ${Math.max(0, Math.ceil(m.timer))}s` : '',
    hint: G.inCar ? 'E exit  •  Space handbrake' : 'E steal car  •  F punch  •  2 pistol  •  M mission',
  };
}

// --- menus ---
function wireButton(id, fn) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', () => { audio.unlock(); fn(); });
}
wireButton('btn-new', () => startGame(false));
wireButton('btn-continue', () => startGame(true));
wireButton('btn-resume', () => { G.mode = 'playing'; hud.show('playing'); announce('Playing.'); });
wireButton('btn-quit-title', () => { G.mode = 'title'; hud.show('title'); writeSave(); });
wireButton('btn-busted-ok', () => { G.mode = 'playing'; hud.show('playing'); });
wireButton('btn-complete-roam', () => { G.mode = 'playing'; hud.show('playing'); });
document.getElementById('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';

// --- main loop ---
let accumulator = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
    if (shot) {
      G.shotCountdown -= 1;
      if (G.shotCountdown <= 0 && !window.__shotReady) {
        // One more render, then the screenshot is ready.
        renderer.render(scene, camera);
        window.__shotReady = true;
      }
    }
  }
  if (G.mode === 'playing' || G.mode === 'title') hud.update(hudState());
  renderer.render(scene, camera);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'playing') {
    G.mode = 'paused'; hud.show('pause'); writeSave();
  }
});

hud.show('title');
hud.setTitleStats(G.money, 0, 0);
announce('Solmar City. Press Enter or click New game to start.');
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && G.mode === 'title') startGame(hasSave());
  if (e.code === 'Enter' && G.mode === 'busted') { G.mode = 'playing'; hud.show('playing'); }
});

// Screenshot mode: stage the scene, then run the loop.
if (shot) {
  stageShot(G, shot);
  if (shot !== '4') { G.mode = 'playing'; hud.show('playing'); }
  audio.unlock = () => {}; // no audio in headless shots
}
requestAnimationFrame(frame);
