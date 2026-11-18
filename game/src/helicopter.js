// AIR-1: the police helicopter. It appears at three stars and up, orbits
// the player at 30 m and 22 m high, sweeps a searchlight over him, and
// climbs away for four seconds when the heat drops. It only watches —
// it never shoots and never catches the player.
import * as THREE from 'three';
import { HELI } from './config.js';

export function createHelicopter(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f6e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 3.6), bodyMat);
  group.add(body);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.3, 3.0),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  stripe.position.y = 0.2;
  group.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), bodyMat);
  tail.position.set(0, 0.2, -3.2);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), bodyMat);
  fin.position.set(0, 0.9, -4.6);
  group.add(fin);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.0), skidMat);
    skid.position.set(sx, -0.85, 0);
    group.add(skid);
  }
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const rz of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.35), bladeMat);
    blade.rotation.y = rz;
    rotor.add(blade);
  }
  rotor.position.y = 0.85;
  group.add(rotor);
  const beaconMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), beaconMat);
  beacon.position.set(0, 0.4, -4.8);
  group.add(beacon);
  // Searchlight: a pale, very transparent cone from the belly to the ground.
  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c8, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(HELI.lightRadius, HELI.lightLength, 16, 1, true), lightMat);
  cone.position.y = -HELI.lightLength / 2 - 0.6;
  group.add(cone);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(HELI.lightRadius, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -HELI.lightLength - 0.6;
  group.add(spot);

  group.visible = false;
  G.scene.add(group);

  const heli = {
    group, rotor, beacon, beaconMat, cone, spot,
    active: false,
    departing: false,
    departTimer: 0,
    orbitAngle: 0,
    blinkTimer: 0,
  };

  function update(dt) {
    const level = G.police.stars();
    heli.rotor.rotation.y += HELI.rotorSpeed * dt;
    heli.blinkTimer += dt;
    const bright = Math.floor(heli.blinkTimer / 0.4) % 2 === 0;
    heli.beaconMat.emissive.setHex(bright ? 0xcc0000 : 0x220000);

    if (level >= HELI.minStars) {
      if (!heli.active) {
        heli.active = true;
        heli.departing = false;
        heli.orbitAngle = Math.atan2(
          G.player.pos.x - 0, G.player.pos.z - 0,
        );
        group.visible = true;
        G.hudMessage('AIR-1 overhead — lose the chopper');
      }
      heli.orbitAngle += HELI.orbitSpeed * dt;
      const px = G.player.pos.x;
      const pz = G.player.pos.z;
      const tx = px + Math.sin(heli.orbitAngle) * HELI.orbitRadius;
      const tz = pz + Math.cos(heli.orbitAngle) * HELI.orbitRadius;
      const ty = HELI.orbitHeight;
      // Drift smoothly toward the orbit point instead of jumping.
      group.position.x += (tx - group.position.x) * Math.min(1, 3 * dt);
      group.position.z += (tz - group.position.z) * Math.min(1, 3 * dt);
      group.position.y += (ty - group.position.y) * Math.min(1, 3 * dt);
      group.lookAt(px, group.position.y, pz);
      heli.cone.visible = true;
      heli.spot.visible = true;
      // The pool of light on the ground directly below the helicopter.
      heli.spot.position.set(0, 0.1 - group.position.y, 0);
    } else if (heli.active) {
      // Climb away for four seconds, still orbiting slowly, then vanish.
      if (!heli.departing) {
        heli.departing = true;
        heli.departTimer = HELI.departTime;
      }
      heli.departTimer -= dt;
      heli.orbitAngle += HELI.orbitSpeed * 0.4 * dt;
      group.position.y += HELI.departRise * dt;
      group.position.x = G.player.pos.x + Math.sin(heli.orbitAngle) * HELI.orbitRadius;
      group.position.z = G.player.pos.z + Math.cos(heli.orbitAngle) * HELI.orbitRadius;
      heli.cone.visible = false;
      heli.spot.visible = false;
      if (heli.departTimer <= 0) {
        heli.active = false;
        heli.departing = false;
        group.visible = false;
      }
    }
  }

  return { heli, update };
}
