// Wanted level + police. Heat is a 0–100 meter: crimes add heat, it decays
// when the player stays clean. Stars = heat / 20. Police cars spawn at the
// edge of the city, chase, and ram; foot cops chase on foot. Getting caught
// (boxed in and stopped, or touched on foot) means BUSTED: a fine and a
// respawn at the hideout.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar, stepCar, removeCar } from './vehicles.js';
import { clamp, range } from './random.js';

export function createPolice(scene, rng) {
  const cars = [];
  const footCops = [];
  let heat = 0;
  let grace = 0;
  let bustedTimer = 0;
  let sirenOn = false;

  function stars() { return Math.min(5, Math.floor(heat / CFG.heatPerStar)); }

  function spawnCarNear(px, pz) {
    const angle = range(rng, 0, Math.PI * 2);
    const x = clamp(px + Math.sin(angle) * 70, -CFG.cityHalf, CFG.cityHalf);
    const z = clamp(pz + Math.cos(angle) * 70, -CFG.cityHalf, CFG.cityHalf);
    const car = makeCar(scene, rng, 'police', x, z, Math.atan2(px - x, pz - z));
    car.cruise = CFG.policeRam;
    cars.push(car);
    return car;
  }
  function spawnFootCop(px, pz) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), new THREE.MeshLambertMaterial({ color: 0x1c2f57 }));
    body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0xc9976b }));
    head.position.y = 1.78; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 2.0; g.add(cap);
    const angle = range(rng, 0, Math.PI * 2);
    const x = clamp(px + Math.sin(angle) * 25, -CFG.cityHalf, CFG.cityHalf);
    const z = clamp(pz + Math.cos(angle) * 25, -CFG.cityHalf, CFG.cityHalf);
    g.position.set(x, 0, z);
    scene.add(g);
    const cop = { mesh: g, x, z, heading: 0, alive: true };
    footCops.push(cop);
    return cop;
  }

  function desiredCars() {
    const s = stars();
    return s === 0 ? 0 : s === 1 ? 1 : s === 2 ? 2 : s === 3 ? 2 : s === 4 ? 3 : 4;
  }

  return {
    get heat() { return heat; },
    get wanted() { return stars(); },
    get siren() { return sirenOn; },
    cars, footCops,
    addHeat(n) { heat = clamp(heat + n, 0, 100); grace = CFG.heatGrace; },
    setHeat(n) { heat = clamp(n, 0, 100); grace = CFG.heatGrace; },
    clear() {
      heat = 0; grace = 0; bustedTimer = 0; sirenOn = false;
      for (const c of cars) removeCar(scene, c);
      cars.length = 0;
      for (const c of footCops) { scene.remove(c.mesh); c.alive = false; }
      footCops.length = 0;
    },
    step(dt, playerPos, playerCar, playerSpeed, onFoot) {
      // Decay when clean.
      if (grace > 0) grace -= dt;
      else if (heat > 0) heat = Math.max(0, heat - CFG.heatDecay * dt);
      const s = stars();
      sirenOn = s > 0;
      // Keep the fleet at the wanted size.
      while (cars.length < desiredCars()) spawnCarNear(playerPos.x, playerPos.z);
      while (cars.length > desiredCars()) removeCar(scene, cars.pop());
      if (s >= 3) while (footCops.length < 2) spawnFootCop(playerPos.x, playerPos.z);
      if (s < 3) {
        for (const c of footCops) { scene.remove(c.mesh); c.alive = false; }
        footCops.length = 0;
      }
      // Chase: steer toward the player, ram speed when close.
      const allCars = [...cars];
      for (const car of cars) {
        const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
        const d = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steer = clamp(dh * 1.4, -1, 1);
        const throttle = d > 4 ? 1 : (playerSpeed > 2 ? 1 : 0.2);
        stepCar(car, dt, throttle, steer, false, [], allCars);
        // Light bar flashes.
        if (car.mesh.userData.lightBar) {
          car.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 350) % 2 ? 0xff2222 : 0x3366ff);
        }
      }
      // Foot cops run at the player.
      for (const cop of footCops) {
        if (!cop.alive) continue;
        const dx = playerPos.x - cop.x, dz = playerPos.z - cop.z;
        const d = Math.hypot(dx, dz) || 1;
        cop.heading = Math.atan2(dx, dz);
        const sp = onFoot ? 5.2 : 0; // they only chase you on foot
        cop.x += Math.sin(cop.heading) * sp * dt;
        cop.z += Math.cos(cop.heading) * sp * dt;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
      // Busted check: cop close + player slow (in car) or touched (on foot).
      let caught = false;
      if (s > 0) {
        for (const car of cars) {
          const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
          if (d < 4.5 && playerSpeed < 1.5) caught = true;
        }
        for (const cop of footCops) {
          const d = Math.hypot(cop.x - playerPos.x, cop.z - playerPos.z);
          if (onFoot && d < 1.6) caught = true;
        }
      }
      if (caught) bustedTimer += dt; else bustedTimer = 0;
      return bustedTimer > CFG.bustedHold ? 'busted' : null;
    },
  };
}
