// Combat: bare fists and a pistol, ammo boxes around the city, and the
// armed loan-shark crew that missions 5 and 7 spawn. A shot is a raycast
// from the camera; the crew shoots back when Vic gets close.
import * as THREE from 'three';
import { COMBAT, WANTED } from './config.js';
import { range, pick } from './random.js';

export function createCombat(G) {
  const rng = G.rng;
  const enemies = [];
  const raycaster = new THREE.Raycaster();

  // Green ammo boxes scattered near the roads.
  const ammoBoxes = [];
  const ammoSpots = [
    { x: -22, z: 30 }, { x: 66, z: -22 }, { x: -66, z: 66 }, { x: 22, z: -66 },
    { x: 110, z: -22 }, { x: -110, z: -66 }, { x: 44, z: 110 }, { x: -44, z: -110 },
  ];
  for (const spot of ammoSpots) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x2fae4e, emissive: 0x0a3313 }),
    );
    mesh.position.set(spot.x, 0.25, spot.z);
    G.scene.add(mesh);
    ammoBoxes.push({ mesh, x: spot.x, z: spot.z, taken: false });
  }

  function spawnCrew(spots) {
    for (const spot of spots) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.0, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x4a1f1f }),
      );
      body.position.y = 1.05;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xc9976b }),
      );
      head.position.y = 1.78;
      group.add(head);
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x111111 }),
      );
      gun.position.set(0.4, 1.1, 0.3);
      group.add(gun);
      group.position.set(spot.x, 0, spot.z);
      G.scene.add(group);
      enemies.push({
        group, pos: group.position, health: 100, shootTimer: range(rng, 0.5, 1.5),
      });
    }
  }

  function removeEnemy(enemy) {
    G.scene.remove(enemy.group);
    enemies.splice(enemies.indexOf(enemy), 1);
  }

  // A punch: 25 damage to the nearest person in front, within 2.2 m.
  function punch() {
    G.lastPunchAt = G.time;
    const p = G.player;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    let best = null;
    let bestD = COMBAT.punchRange;
    const consider = (pos, kind, ref) => {
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && dx * fx + dz * fz > 0) { best = { kind, ref }; bestD = d; }
    };
    for (const e of enemies) consider(e.pos, 'enemy', e);
    for (const ped of G.pedestrians.peds) consider(ped.pos, 'ped', ped);
    if (!best) return false;
    if (best.kind === 'enemy') {
      damageEnemy(best.ref, COMBAT.punchDamage);
    } else {
      G.police.addHeat(WANTED.hitPed, 'You hit a pedestrian!');
    }
    return true;
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0) {
      removeEnemy(enemy);
      G.hudMessage('Crew member down.');
    }
  }

  // Fire the pistol along a ray from the camera through a world point
  // (the mouse click, or a debug aim). Hits the first enemy near the ray.
  function firePistolAt(point) {
    const p = G.player;
    if (p.weapon !== 'pistol' || p.ammo <= 0) return false;
    p.ammo -= 1;
    G.lastShotAt = G.time;
    G.audio.gunshot();
    const from = G.camera.position.clone();
    const dir = point.clone().sub(from).normalize();
    raycaster.set(from, dir);
    raycaster.far = 300;
    let best = null;
    let bestDist = Infinity;
    for (const enemy of enemies) {
      const centre = enemy.pos.clone();
      centre.y = 1.2;
      const toEnemy = centre.clone().sub(from);
      const along = toEnemy.dot(dir);
      if (along < 0 || along > 300) continue;
      const closest = from.clone().add(dir.clone().multiplyScalar(along));
      if (closest.distanceTo(centre) < 1.6 && along < bestDist) {
        best = enemy;
        bestDist = along;
      }
    }
    if (best) {
      damageEnemy(best, COMBAT.pistolDamage);
      G.audio.hitMarker();
    }
    G.police.addHeat(WANTED.shoot);
    return true;
  }

  function update(dt) {
    // Ammo boxes: walk within 2.5 m to pick up 12 rounds.
    for (const box of ammoBoxes) {
      if (box.taken) continue;
      const d = Math.hypot(box.x - G.player.pos.x, box.z - G.player.pos.z);
      if (d < 2.5) {
        box.taken = true;
        box.mesh.visible = false;
        G.player.ammo = Math.min(COMBAT.ammoMax, G.player.ammo + COMBAT.ammoBox);
        G.hudMessage(`Ammo +${COMBAT.ammoBox}`);
      }
    }
    // The crew shoots back when Vic is near.
    for (const enemy of [...enemies]) {
      const d = Math.hypot(enemy.pos.x - G.player.pos.x, enemy.pos.z - G.player.pos.z);
      enemy.shootTimer -= dt;
      if (d < 45 && enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.5;
        enemy.group.lookAt(G.player.pos.x, 1.2, G.player.pos.z);
        G.player.health -= 5;
        G.lastDamageAt = G.time;
        G.audio.enemyShot();
        if (G.player.health <= 0) {
          G.player.health = 100;
          G.hudMessage('Vic got shot up — back on his feet, but the crew is still there.');
        }
      }
    }
  }

  return { enemies, ammoBoxes, spawnCrew, punch, firePistolAt, damageEnemy, update };
}
