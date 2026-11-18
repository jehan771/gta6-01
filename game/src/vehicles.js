// Cars: five stealable types plus the police interceptor, built from boxes
// and cylinders, and arcade driving physics (acceleration that tapers near
// top speed, steering that weakens at speed, handbrake, crash speed loss).
import * as THREE from 'three';
import { CAR_TYPES, DRIVE } from './config.js';
import { clamp } from './random.js';

export function buildCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const len = spec.length;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, len), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, len * 0.45),
    new THREE.MeshLambertMaterial({ color: 0x1a2733 }),
  );
  cabin.position.set(0, 1.15, -len * 0.05);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, len / 2 - 0.8], [0.95, len / 2 - 0.8], [-0.95, -len / 2 + 0.8], [0.95, -len / 2 + 0.8]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x554400 }),
    );
    sign.position.set(0, 1.6, 0);
    group.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    bar.position.set(0, 1.52, 0);
    group.add(bar);
    const lightL = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x661111 }),
    );
    lightL.position.set(-0.35, 1.56, 0);
    group.add(lightL);
    const lightR = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x111166 }),
    );
    lightR.position.set(0.35, 1.56, 0);
    group.add(lightR);
  }
  return { group, wheels };
}

export function createCar(G, type, x, z, yaw, color) {
  const spec = CAR_TYPES[type];
  const { group, wheels } = buildCarMesh(type, color ?? spec.color);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  G.scene.add(group);
  return {
    type, spec, group, wheels,
    pos: group.position,
    yaw,
    speed: 0,
    steer: 0,
    traffic: false,
    police: type === 'police',
    // Traffic AI fields, set by traffic.js.
    axis: 'x',
    dir: 1,
    lane: 0,
    cruise: 10,
  };
}

// Arcade drive step. `drive` is {throttle: -1..1, steer: -1..1, handbrake: bool}.
export function driveCar(G, car, dt, drive) {
  const spec = car.spec;
  const top = spec.top;
  if (drive.throttle > 0) {
    car.speed += DRIVE.accel * spec.accelMul * (1 - clamp(car.speed / top, 0, 1)) * dt;
  } else if (drive.throttle < 0) {
    if (car.speed > 0.5) car.speed -= DRIVE.brake * dt;
    else car.speed -= DRIVE.reverseAccel * dt;
  } else {
    // Rolling drag.
    const drag = DRIVE.drag * 10 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  if (drive.handbrake) {
    car.speed = Math.abs(car.speed) <= 20 * dt ? 0 : car.speed - Math.sign(car.speed) * 20 * dt;
  }
  car.speed = clamp(car.speed, -DRIVE.maxReverse, top);
  const grip = drive.handbrake ? DRIVE.handbrakeGrip : DRIVE.grip;
  const steerAuthority = clamp(1 - (Math.abs(car.speed) / top) * 0.55, 0.35, 1);
  const targetSteer = drive.steer * DRIVE.steer * spec.steerMul * steerAuthority;
  car.steer += (targetSteer - car.steer) * Math.min(1, grip * dt);
  // Yaw rate grows with speed up to a point, then steering authority falls off.
  car.yaw += car.steer * dt * Math.sign(car.speed || 1) * clamp(Math.abs(car.speed) / 8, 0, 1);
  const forward = car.speed * dt;
  car.pos.x += Math.sin(car.yaw) * forward;
  car.pos.z += Math.cos(car.yaw) * forward;
  car.group.rotation.y = car.yaw;
  const hitWall = G.city.collideCircle(car.pos, 1.6);
  if (hitWall && Math.abs(car.speed) > 3) {
    car.speed *= 1 - DRIVE.crashLoss;
  }
  // Wheel spin for show.
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2;
  return hitWall;
}
