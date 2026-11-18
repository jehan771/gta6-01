// The story: seven jobs from Rosa Delgado that pay off Vic's $1,500 debt,
// plus taxi fares and ten hidden packages on the side. Every mission is a
// small state machine with a 3D beacon, a minimap waypoint and a timer.
import * as THREE from 'three';
import { MISSIONS, MISSION, WORLD } from './config.js';
import { createCar } from './vehicles.js';
import { range, pick } from './random.js';

const TAXI_SPOTS = [
  { x: -22, z: 30 }, { x: 22, z: -14 }, { x: 66, z: 74 }, { x: -66, z: -30 },
  { x: 110, z: 22 }, { x: -110, z: 66 }, { x: 44, z: -66 }, { x: -44, z: 110 },
];

export function createMissions(G) {
  const rng = G.rng;
  const places = G.city.places;

  // --- Beacon: a yellow light pillar, a floating diamond and a ground ring.
  const beaconGroup = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, MISSION.beaconHeight, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd94f, transparent: true, opacity: MISSION.beaconOpacity,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  pillar.position.y = MISSION.beaconHeight / 2;
  beaconGroup.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshLambertMaterial({ color: 0xffd94f, emissive: 0x776600 }),
  );
  diamond.position.y = MISSION.diamondHeight;
  beaconGroup.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94f, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  beaconGroup.add(ring);
  beaconGroup.visible = false;
  G.scene.add(beaconGroup);
  const beacon = { group: beaconGroup, diamond, target: null };

  // --- Hidden packages: ten glowing boxes.
  const packages = [];
  for (let i = 0; i < MISSION.packageCount; i += 1) {
    const spot = pick(rng, TAXI_SPOTS);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x39d353, emissive: 0x0a4413 }),
    );
    mesh.position.set(spot.x + range(rng, -4, 4), 0.6, spot.z + range(rng, -4, 4));
    G.scene.add(mesh);
    packages.push({ mesh, x: mesh.position.x, z: mesh.position.z, got: false });
  }

  // --- Waiting taxi passengers: gold figures on the sidewalk.
  const passengers = [];
  function spawnPassenger() {
    const spot = pick(rng, TAXI_SPOTS);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.9, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x443300 }),
    );
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
    );
    head.position.y = 1.6;
    group.add(head);
    group.position.set(spot.x + range(rng, -3, 3), 0, spot.z + range(rng, -3, 3));
    G.scene.add(group);
    const p = { group, pos: group.position };
    passengers.push(p);
    return p;
  }
  for (let i = 0; i < 3; i += 1) spawnPassenger();

  const taxi = { active: false, passenger: null, dest: null, startX: 0, startZ: 0 };

  // --- The blue sedan for mission 3 (Tail).
  let targetCar = null;
  function spawnTargetCar() {
    if (targetCar) return targetCar;
    targetCar = createCar(G, 'sedan', G.player.pos.x + 30, 22, Math.PI / 2, 0x2a4fd8);
    targetCar.traffic = true;
    targetCar.axis = 'x';
    targetCar.dir = 1;
    targetCar.cruise = 9;
    targetCar.speed = 9;
    return targetCar;
  }
  function removeTargetCar() {
    if (!targetCar) return;
    G.scene.remove(targetCar.group);
    targetCar = null;
  }

  function startMission() {
    if (G.mission || G.missionIndex >= MISSIONS.length) return false;
    const def = MISSIONS[G.missionIndex];
    const mission = {
      def, defIndex: G.missionIndex, stage: 0, timer: def.time,
      tailTime: 0, spotted: 0, inShootout: false,
    };
    G.mission = mission;
    if (def.name === 'Heat' || def.name === 'Last Score') {
      G.heat = 60;
      G.lastCrimeAt = G.time;
    }
    if (def.name === 'Tail') spawnTargetCar();
    G.hudMessage(`Mission ${G.missionIndex + 1}/7: ${def.name} — $${def.pay}`);
    G.hudMessage(def.intro);
    return true;
  }

  function completeMission() {
    const mission = G.mission;
    if (!mission) return;
    G.money += mission.def.pay;
    G.missionIndex += 1;
    G.hudMessage(`Mission complete: ${mission.def.name} — +$${mission.def.pay}`);
    if (mission.def.name === 'Payday') {
      G.hudMessage('DEBT PAID — Vic is free. Solmar City is yours now.');
      G.mode = 'complete';
      G.saveGame();
    }
    removeTargetCar();
    G.mission = null;
    beacon.target = null;
    beaconGroup.visible = false;
    G.saveGame();
  }

  function failMission(reason) {
    G.hudMessage(`Mission failed: ${reason}. Press M to retry.`);
    removeTargetCar();
    G.mission = null;
    beacon.target = null;
    beaconGroup.visible = false;
  }

  function distTo(x, z) {
    const p = G.player.car ? G.player.car.pos : G.player.pos;
    return Math.hypot(p.x - x, p.z - z);
  }

  function update(dt) {
    // Packages: walk or drive within 2 m to collect.
    for (const pkg of packages) {
      if (pkg.got) continue;
      if (distTo(pkg.x, pkg.z) < MISSION.packageRadius) {
        pkg.got = true;
        pkg.mesh.visible = false;
        G.packagesGot += 1;
        G.money += MISSION.packagePay;
        G.hudMessage(`Hidden package found — +$${MISSION.packagePay} (${G.packagesGot}/10)`);
      }
    }
    // Taxi: fare pays out on arrival.
    if (taxi.active && taxi.dest) {
      if (distTo(taxi.dest.x, taxi.dest.z) < MISSION.taxiRadius) {
        const trip = Math.hypot(taxi.dest.x - taxi.startX, taxi.dest.z - taxi.startZ);
        const fare = Math.round(MISSION.taxiPerMetre * trip + MISSION.taxiBase);
        G.money += fare;
        G.hudMessage(`Taxi fare paid — +$${fare}`);
        taxi.active = false;
        taxi.passenger = null;
        taxi.dest = null;
        spawnPassenger();
      }
    }

    const mission = G.mission;
    if (!mission) {
      beaconGroup.visible = false;
      return;
    }
    mission.timer -= dt;
    if (mission.timer <= 0) {
      failMission('time ran out');
      return;
    }
    const name = mission.def.name;
    let target = null;
    if (name === 'Getaway') {
      target = places.hideout;
      if (G.player.car && distTo(target.x, target.z) < MISSION.hideoutRadius) completeMission();
    } else if (name === 'Courier') {
      if (mission.stage === 0) {
        target = places.marinaGate;
        if (distTo(target.x, target.z) < MISSION.marinaRadius) {
          mission.stage = 1;
          G.hudMessage('Package collected — deliver it to the north tower.');
        }
      } else {
        target = places.northTower;
        if (distTo(target.x, target.z) < MISSION.towerRadius) completeMission();
      }
    } else if (name === 'Tail') {
      const t = targetCar;
      if (!t) { failMission('lost the target'); return; }
      target = { x: t.pos.x, z: t.pos.z };
      const d = distTo(t.pos.x, t.pos.z);
      if (d >= MISSION.tailMin && d <= MISSION.tailMax) mission.tailTime += dt;
      else if (d > MISSION.tailTooFar) mission.tailTime = Math.max(0, mission.tailTime - dt);
      if (d < MISSION.tailTooClose) mission.spotted += dt;
      else mission.spotted = Math.max(0, mission.spotted - dt * 2);
      if (mission.spotted > MISSION.spottedLimit) { failMission('spotted'); return; }
      if (mission.tailTime >= MISSION.tailTarget) completeMission();
    } else if (name === 'Heat') {
      target = null;
      if (G.heat <= 0) completeMission();
    } else if (name === 'The Debt') {
      if (mission.stage === 0) {
        target = places.marinaGate;
        if (distTo(target.x, target.z) < MISSION.marinaRadiusM5) {
          mission.stage = 1;
          mission.inShootout = true;
          G.heat = 0;
          G.combat.spawnCrew([
            { x: places.marinaGate.x + 4, z: places.marinaGate.z - 6 },
            { x: places.marinaGate.x - 4, z: places.marinaGate.z - 8 },
            { x: places.marinaGate.x, z: places.marinaGate.z - 14 },
          ]);
          G.hudMessage('The loan shark crew is here. Take them down.');
        }
      } else if (G.combat.enemies.length === 0) {
        completeMission();
      }
    } else if (name === 'Last Score') {
      target = places.hideout;
      if (G.player.car && distTo(target.x, target.z) < MISSION.hideoutRadius) completeMission();
    } else if (name === 'Payday') {
      if (mission.stage === 0) {
        target = places.marinaGate;
        if (distTo(target.x, target.z) < MISSION.marinaRadius) {
          mission.stage = 1;
          G.hudMessage('Payoff collected — take it to the north tower.');
        }
      } else if (mission.stage === 1) {
        target = places.northTower;
        if (distTo(target.x, target.z) < MISSION.towerRadius) {
          mission.stage = 2;
          mission.inShootout = true;
          G.heat = 0;
          G.combat.spawnCrew([
            { x: places.northTower.x + 6, z: places.northTower.z + 4 },
            { x: places.northTower.x - 6, z: places.northTower.z + 6 },
            { x: places.northTower.x, z: places.northTower.z + 12 },
          ]);
          G.hudMessage('Ambush! The crew is waiting at the tower.');
        }
      } else if (G.combat.enemies.length === 0) {
        completeMission();
      }
    }
    // Beacon follows the current objective.
    if (target) {
      beacon.target = target;
      beaconGroup.visible = true;
      beaconGroup.position.set(target.x, 0, target.z);
      diamond.rotation.y += dt * 1.5;
      diamond.position.y = MISSION.diamondHeight + Math.sin(G.time * 2) * 0.5;
    } else {
      beaconGroup.visible = false;
    }
    // The tail target keeps driving its road.
    if (targetCar) {
      targetCar.pos.x += targetCar.dir * targetCar.speed * dt;
      if (Math.abs(targetCar.pos.x) > WORLD.edge) targetCar.pos.x = -Math.sign(targetCar.pos.x) * WORLD.edge;
      targetCar.group.rotation.y = targetCar.yaw;
    }
  }

  function startTaxi() {
    if (!G.player.car || taxi.active) return false;
    let best = null;
    let bestDist = 12;
    for (const p of passengers) {
      const d = Math.hypot(p.pos.x - G.player.pos.x, p.pos.z - G.player.pos.z);
      if (d < bestDist) { best = p; bestDist = d; }
    }
    if (!best) return false;
    const dests = [places.hideout, places.marinaGate, places.northTower, places.beach, places.spawn]
      .filter((d) => Math.hypot(d.x - G.player.pos.x, d.z - G.player.pos.z) > 30);
    const dest = pick(rng, dests.length ? dests : [places.beach]);
    taxi.active = true;
    taxi.passenger = best;
    taxi.dest = dest;
    taxi.startX = G.player.pos.x;
    taxi.startZ = G.player.pos.z;
    G.scene.remove(best.group);
    passengers.splice(passengers.indexOf(best), 1);
    G.hudMessage('Taxi fare — take the passenger to the marked stop.');
    return true;
  }

  return {
    beacon, packages, passengers, taxi, targetCar: () => targetCar,
    startMission, completeMission, failMission, startTaxi, update,
  };
}
