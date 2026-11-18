// Wanted: a heat meter 0-100, one star per 20 heat, that decays after six
// quiet seconds. Police cars chase and ram; foot police appear at three
// stars and chase Vic on foot. Caught while stopped means BUSTED.
import * as THREE from 'three';
import { WANTED, WORLD } from './config.js';
import { createCar, driveCar } from './vehicles.js';
import { clamp } from './random.js';

export function createPolice(G) {
  const policeCars = [];
  const footPolice = [];
  let spawnTimer = 0;

  function stars() {
    return Math.min(5, Math.floor(G.heat / WANTED.heatPerStar));
  }

  function addHeat(amount, reason) {
    if (G.mission && (G.mission.def.name === 'The Debt' || G.mission.def.name === 'Payday') && G.mission.inShootout) {
      return; // Police stood down during the crew shootouts.
    }
    G.heat = clamp(G.heat + amount, 0, 100);
    G.lastCrimeAt = G.time;
    if (reason) G.hudMessage(reason);
  }

  function spawnPoliceCar() {
    const angle = Math.random() * Math.PI * 2;
    const x = G.player.pos.x + Math.sin(angle) * 45;
    const z = G.player.pos.z + Math.cos(angle) * 45;
    const car = createCar(G, 'police', x, z, 0);
    car.police = true;
    policeCars.push(car);
    return car;
  }

  function spawnFootCop() {
    const group = createFootCopMesh();
    group.position.set(G.player.pos.x + 12, 0, G.player.pos.z + 8);
    G.scene.add(group);
    const cop = { group, pos: group.position, yaw: 0 };
    footPolice.push(cop);
    return cop;
  }

  function createFootCopMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2f6e }),
    );
    body.position.y = 1.05;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
    );
    head.position.y = 1.78;
    group.add(head);
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x101828 }),
    );
    hat.position.y = 2.0;
    group.add(hat);
    return group;
  }

  function update(dt) {
    // Heat decay after six quiet seconds.
    if (G.time - G.lastCrimeAt > WANTED.decayDelay && G.heat > 0) {
      G.heat = Math.max(0, G.heat - WANTED.decay * dt);
    }
    const level = stars();
    const wantCars = level === 0 ? 0 : 1 + Math.floor(level / 2);
    spawnTimer -= dt;
    if (policeCars.length < wantCars && spawnTimer <= 0) {
      spawnPoliceCar();
      spawnTimer = 2;
    }
    if (level === 0) {
      for (const car of policeCars) {
        car.pos.x += Math.sin(car.yaw) * 8 * dt;
        car.pos.z += Math.cos(car.yaw) * 8 * dt;
      }
    }
    // Chase: steer toward the player, ram at up to 26 m/s when close.
    // At one star the cops only pursue a moving player — lay low and they
    // lose interest. At two stars and up they hunt the player down.
    const target = G.player.car ? G.player.car.pos : G.player.pos;
    const targetSpeed = G.player.car ? Math.abs(G.player.car.speed) : (G.player.moving ? 6 : 0);
    const chasing = level >= 2 || targetSpeed > 3;
    for (const car of policeCars) {
      if (level === 0) continue;
      if (!chasing) {
        // Hold position and wait: brake to a stop, do not approach.
        if (car.speed > 0.5) {
          driveCar(G, car, dt, { throttle: -1, steer: 0, handbrake: false });
        } else {
          car.speed = 0;
        }
        continue;
      }
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz);
      let yawDiff = wantYaw - car.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      // Close in fast, ram at up to 26 m/s, then brake to a stop glued to
      // the player so a stopped player can be caught.
      const cruise = dist < 4 ? 0 : dist < 12 ? WANTED.policeRamSpeed : WANTED.policeChaseSpeed;
      const throttle = car.speed < cruise ? 1 : car.speed > cruise + 2 ? -1 : 0;
      driveCar(G, car, dt, { throttle, steer: clamp(yawDiff * 1.5, -1, 1), handbrake: false });
      // Ram: a fast impact shoves the player's car and slows it.
      if (dist < 4.5 && car.speed > 5) {
        if (G.player.car) {
          G.player.car.speed *= 0.92;
          G.player.car.pos.x += (dx / (dist || 1)) * -0.6 * dt * 10;
          G.player.car.pos.z += (dz / (dist || 1)) * -0.6 * dt * 10;
        } else {
          G.player.pos.x += (dx / (dist || 1)) * -0.4 * dt * 10;
          G.player.pos.z += (dz / (dist || 1)) * -0.4 * dt * 10;
        }
      }
    }
    // Foot police at three stars and up, only against a player on foot.
    const wantFoot = level >= 3 && G.player.onFoot ? 2 : 0;
    if (footPolice.length < wantFoot && spawnTimer <= 0) {
      spawnFootCop();
      spawnTimer = 2;
    }
    for (const cop of footPolice) {
      if (!G.player.onFoot || level < 3) continue;
      const dx = G.player.pos.x - cop.pos.x;
      const dz = G.player.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        cop.pos.x += (dx / dist) * WANTED.footSpeed * dt;
        cop.pos.z += (dz / dist) * WANTED.footSpeed * dt;
        cop.yaw = Math.atan2(dx, dz);
        cop.group.rotation.y = cop.yaw;
      }
    }
    // Busted: stopped with a wanted level and a police car glued to you.
    const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : (G.player.moving ? 6 : 0);
    let touching = false;
    if (level >= 1 && playerSpeed < 1.5) {
      for (const car of policeCars) {
        const d = Math.hypot(car.pos.x - target.x, car.pos.z - target.z);
        if (d < 4) touching = true;
      }
      if (G.player.onFoot) {
        for (const cop of footPolice) {
          const d = Math.hypot(cop.pos.x - G.player.pos.x, cop.pos.z - G.player.pos.z);
          if (d < 2.5) touching = true;
        }
      }
    }
    if (touching) {
      G.bustedTimer += dt;
      if (G.bustedTimer >= WANTED.bustHold) G.bustPlayer();
    } else {
      G.bustedTimer = 0;
    }
  }

  return { policeCars, footPolice, stars, addHeat, update };
}
