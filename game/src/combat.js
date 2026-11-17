// Combat — fists on foot (F), pistol (2 to draw, click to fire), ammo
// pickups, muzzle flash, and the armed gunmen Mission 5 spawns. Shooting is
// a raycast from the camera; enemies return fire when the player is close.
import * as THREE from 'three';
import { CFG } from './config.js';
import { range } from './random.js';

export function createCombat(scene, rng) {
  const enemies = [];
  const pickups = [];
  const flash = new THREE.PointLight(0xffcc66, 0, 12);
  scene.add(flash);
  let flashTimer = 0;

  // Tracer line shown briefly when a shot is fired.
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  scene.add(tracer);

  function makeGunman(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0x8a5a3b }));
    head.position.y = 1.8; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.1, 0.3); g.add(gun);
    g.position.set(x, 0, z);
    scene.add(g);
    const e = { mesh: g, x, z, hp: 100, alive: true, shootCd: range(rng, 0.5, 1.5) };
    enemies.push(e);
    return e;
  }

  function spawnAmmo(x, z) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    box.position.set(x, 0.35, z);
    scene.add(box);
    pickups.push({ mesh: box, x, z, taken: false, kind: 'ammo' });
  }
  // Ammo boxes at fixed, memorable spots.
  for (const [x, z] of [[-20, 42], [24, -20], [-64, -64], [64, 64], [110, -22], [-110, 66]]) spawnAmmo(x, z);

  return {
    enemies, pickups,
    spawnGunmen(spots) { for (const [x, z] of spots) makeGunman(x, z); },
    clearEnemies() {
      for (const e of enemies) { scene.remove(e.mesh); e.alive = false; }
      enemies.length = 0;
    },
    // Fire the pistol from `origin` along `dir`. Returns the enemy hit (if any).
    shoot(origin, dir, colliders) {
      const ray = new THREE.Raycaster(origin, dir, 0.1, 120);
      let best = null, bestD = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const toE = new THREE.Vector3(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
        const d = toE.length();
        const along = toE.dot(dir);
        if (along > 0 && along < bestD) {
          const perp = toE.clone().addScaledVector(dir, -along).length();
          if (perp < 1.1) { best = e; bestD = along; }
        }
      }
      // Buildings block shots: if a building AABB is crossed before the enemy, miss.
      if (best) {
        for (const c of colliders) {
          // Cheap test: sample the ray; a hit inside a building box before the enemy blocks it.
          for (let t = 2; t < bestD; t += 2) {
            const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
            if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) { best = null; break; }
          }
          if (!best) break;
        }
      }
      const end = best
        ? new THREE.Vector3(best.x, 1.2, best.z)
        : origin.clone().addScaledVector(dir, 60);
      tracerGeo.setFromPoints([origin.clone(), end]);
      tracer.material.opacity = 0.9;
      flash.position.copy(origin).addScaledVector(dir, 1.2);
      flash.intensity = 60; flashTimer = 0.07;
      if (best) {
        best.hp -= CFG.pistolDamage;
        if (best.hp <= 0) { best.alive = false; best.mesh.visible = false; }
      }
      return best;
    },
    // A punch: anything in a short arc in front takes damage.
    punch(px, pz, heading) {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - px, dz = e.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < CFG.punchRange && dx * fx + dz * fz > 0) {
          e.hp -= CFG.punchDamage;
          if (e.hp <= 0) { e.alive = false; e.mesh.visible = false; }
          return e;
        }
      }
      return null;
    },
    step(dt, playerPos, onDamage) {
      if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) flash.intensity = 0; }
      tracer.material.opacity = Math.max(0, tracer.material.opacity - dt * 8);
      // Gunmen stand their ground and shoot when the player is near.
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
        e.mesh.lookAt(playerPos.x, 0, playerPos.z);
        e.shootCd -= dt;
        if (d < 26 && e.shootCd <= 0) {
          e.shootCd = range(rng, 1.2, 2.2);
          // Rough aim: hits about a third of the time at close range.
          if (Math.random() < 0.35) onDamage(7);
          const from = new THREE.Vector3(e.x, 1.3, e.z);
          const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
          const dir = to.clone().sub(from).normalize();
          tracerGeo.setFromPoints([from, to]);
          tracer.material.opacity = 0.7;
        }
      }
      // Ammo pickups bob and spin.
      for (const pk of pickups) {
        if (pk.taken) continue;
        pk.mesh.rotation.y += dt * 2;
        pk.mesh.position.y = 0.35 + Math.sin(performance.now() / 400 + pk.x) * 0.08;
        const d = Math.hypot(pk.x - playerPos.x, pk.z - playerPos.z);
        if (d < 1.6) {
          pk.taken = true; pk.mesh.visible = false;
          onDamage(0, 'ammo');
        }
      }
    },
  };
}
