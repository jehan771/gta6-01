// Cars — mesh builder, arcade driving physics, and stealing (walk up, press E).
// A car is a group: body box, cabin box, four cylinder wheels, headlights.
// Physics is deliberately simple: speed along the heading, steering that
// scales down at speed, velocity eased toward the heading (grip), buildings
// and other cars push back.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, pick } from './random.js';
import { collideCircle } from './city.js';

export function makeCarMesh(typeName, colour) {
  const spec = CFG.cars[typeName];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.75, spec.len), bodyMat);
  body.position.y = 0.55; group.add(body);
  const cabinH = typeName === 'van' ? 1.0 : 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.wid - 0.25, cabinH, spec.len * 0.45), darkMat);
  cabin.position.set(0, 1.05 + cabinH / 2 - 0.3, typeName === 'van' ? 0 : -spec.len * 0.05);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPos = [
    [-spec.wid / 2, spec.len / 2 - 0.8], [spec.wid / 2, spec.len / 2 - 0.8],
    [-spec.wid / 2, -spec.len / 2 + 0.8], [spec.wid / 2, -spec.len / 2 + 0.8],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz);
    group.add(w); wheels.push(w);
  }
  // Headlights + taillights so cars read at dusk.
  const lightGeo = new THREE.BoxGeometry(0.3, 0.18, 0.06);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(lightGeo, headMat); h.position.set(s * (spec.wid / 2 - 0.35), 0.6, spec.len / 2 + 0.02); group.add(h);
    const t = new THREE.Mesh(lightGeo, tailMat); t.position.set(s * (spec.wid / 2 - 0.35), 0.6, -spec.len / 2 - 0.02); group.add(t);
  }
  if (typeName === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.75, 0); group.add(sign);
  }
  if (typeName === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.35), new THREE.MeshBasicMaterial({ color: 0x3366ff }));
    bar.position.set(0, 1.72, -0.1); group.add(bar);
    group.userData.lightBar = bar;
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(scene, rng, typeName, x, z, heading) {
  const spec = CFG.cars[typeName];
  const colour = pick(rng, spec.colours);
  const mesh = makeCarMesh(typeName, colour);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    type: typeName, spec, mesh, colour,
    x, z, heading, speed: 0, vx: 0, vz: 0,
    steer: 0, airborne: 0, vy: 0, alive: true, isPlayer: false, isPolice: typeName === 'police',
    driverOut: false,
  };
}

// One physics step for a driven car. Returns 'crash' when it hit something hard.
export function stepCar(car, dt, throttle, steerInput, handbrake, colliders, others) {
  const spec = car.spec;
  const top = spec.top;
  if (throttle > 0) car.speed += CFG.accel * spec.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CFG.brake * dt;
    else car.speed -= CFG.reverseAccel * dt * -throttle;
  }
  car.speed = clamp(car.speed, -CFG.maxReverse, top);
  // Drag + rolling resistance.
  car.speed -= car.speed * CFG.drag * dt * Math.abs(car.speed) * 0.06;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;

  const steerTarget = steerInput * CFG.steerRate * spec.steer * clamp(1 - Math.abs(car.speed) / (top * 1.6), 0.35, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 6, 0, 1);

  // Velocity eases toward the heading (arcade grip); handbrake loosens it.
  const grip = handbrake ? CFG.handbrakeGrip : CFG.grip;
  const hx = Math.sin(car.heading), hz = Math.cos(car.heading);
  const fwd = car.vx * hx + car.vz * hz;
  const rx = car.vx - hx * fwd, rz = car.vz - hz * fwd;
  const keep = Math.exp(-grip * dt);
  car.vx = hx * car.speed + rx * keep;
  car.vz = hz * car.speed + rz * keep;
  // Keep the scalar speed honest with the velocity vector.
  car.speed = Math.hypot(car.vx, car.vz) * Math.sign(fwd || car.speed || 1);
  if (Math.abs(car.speed) < 0.01) car.speed = 0;

  let nx = car.x + car.vx * dt;
  let nz = car.z + car.vz * dt;
  let crashed = false;

  // Buildings: push out, then slide along the wall — drop the velocity
  // component that points into the building so the car deflects instead of
  // grinding to a halt against it.
  const hit = collideCircle(colliders, nx, nz, spec.len * 0.45);
  if (hit.hit) {
    const pl = Math.hypot(hit.nx, hit.nz);
    if (pl > 1e-6) {
      const nnx = hit.nx / pl, nnz = hit.nz / pl;
      const vn = car.vx * nnx + car.vz * nnz;
      if (vn < 0) { car.vx -= nnx * vn; car.vz -= nnz * vn; }
    }
    nx = hit.x; nz = hit.z;
    if (Math.abs(car.speed) > 8) crashed = true;
    car.speed *= (1 - CFG.crashSpeedLoss);
    car.vx *= 0.5; car.vz *= 0.5;
  }
  // Other cars: simple circle push.
  for (const o of others) {
    if (o === car || !o.alive) continue;
    const dx = nx - o.x, dz = nz - o.z;
    const d2 = dx * dx + dz * dz;
    const min = (spec.len + o.spec.len) * 0.42;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = (min - d) / d;
      nx += dx * push * 0.5; nz += dz * push * 0.5;
      if (Math.abs(car.speed) > 10) crashed = true;
      car.speed *= 0.85;
    }
  }
  // World edge: cars stay on land — the marina water (x > 136) and the sea
  // beyond the beach (z > 168) are not drivable.
  nx = clamp(nx, -CFG.cityHalf - 30, CFG.marinaX - 2);
  nz = clamp(nz, -CFG.cityHalf - 30, CFG.beachZ + 30);
  car.x = nx; car.z = nz;

  // Airborne (stunt ramps set vy) — simple vertical arc.
  if (car.airborne > 0 || car.vy !== 0) {
    car.vy -= 22 * dt;
    car.airborne += car.vy * dt;
    if (car.airborne <= 0) { car.airborne = 0; car.vy = 0; if (Math.abs(car.speed) > 15) crashed = true; }
  }

  car.mesh.position.set(car.x, car.airborne, car.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * 0.06 * Math.sign(car.speed);
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  return crashed ? 'crash' : null;
}

export function removeCar(scene, car) {
  car.alive = false;
  scene.remove(car.mesh);
}
