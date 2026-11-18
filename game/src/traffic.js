// Traffic: fourteen AI cars driving the road grid, picking a new turn at
// every intersection and slowing for the car ahead. These are the cars
// Vic can steal with E.
import { WORLD } from './config.js';
import { createCar } from './vehicles.js';
import { range, pick } from './random.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'pickup', 'sports', 'van'];

export function createTraffic(G) {
  const rng = G.rng;
  const cars = [];
  for (let i = 0; i < WORLD.trafficCount; i += 1) {
    const type = pick(rng, TRAFFIC_TYPES);
    const road = pick(rng, WORLD.roads);
    const along = range(rng, -120, 120);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (rng() < 0.5 ? -1 : 1) * 2.5;
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    const yaw = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(G, type, x, z, yaw);
    car.traffic = true;
    car.axis = axis;
    car.dir = dir;
    car.lane = lane;
    car.cruise = range(rng, 8, 12);
    car.speed = car.cruise;
    cars.push(car);
  }

  function carAhead(car) {
    let nearest = Infinity;
    for (const other of cars) {
      if (other === car || other.stolen) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const across = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (along > 0 && along < 14 && across < 3) nearest = Math.min(nearest, along);
    }
    return nearest;
  }

  function update(dt) {
    for (const car of cars) {
      if (car.stolen) continue;
      // Slow for the car ahead.
      const ahead = carAhead(car);
      const want = ahead < 14 ? Math.max(0, car.cruise * (ahead / 14)) : car.cruise;
      car.speed += (want - car.speed) * Math.min(1, 2 * dt);
      // Advance along the current road.
      if (car.axis === 'x') car.pos.x += car.dir * car.speed * dt;
      else car.pos.z += car.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the cross road.
      const along = car.axis === 'x' ? car.pos.x : car.pos.z;
      const nearestRoad = WORLD.roads.reduce((a, b) => (Math.abs(b - along) < Math.abs(a - along) ? b : a));
      if (Math.abs(along - nearestRoad) < 0.6 && rng() < 0.35) {
        const turn = rng() < 0.5 ? -1 : 1;
        if (car.axis === 'x') {
          car.axis = 'z';
          car.dir = turn;
          car.pos.x = nearestRoad;
          car.lane = turn > 0 ? 2.5 : -2.5;
          car.pos.z += car.lane * 0 + 0;
          car.yaw = turn > 0 ? 0 : Math.PI;
        } else {
          car.axis = 'x';
          car.dir = turn;
          car.pos.z = nearestRoad;
          car.lane = turn > 0 ? 2.5 : -2.5;
          car.yaw = turn > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        car.pos.x = Math.max(-WORLD.edge, Math.min(WORLD.edge, car.pos.x));
        car.pos.z = Math.max(-WORLD.edge, Math.min(WORLD.edge, car.pos.z));
      }
      // Wrap around the far edge so traffic never runs out.
      if (car.axis === 'x' && Math.abs(car.pos.x) > WORLD.edge) car.pos.x = -Math.sign(car.pos.x) * WORLD.edge;
      if (car.axis === 'z' && Math.abs(car.pos.z) > WORLD.edge) car.pos.z = -Math.sign(car.pos.z) * WORLD.edge;
      car.group.rotation.y = car.yaw;
      for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2;
    }
  }

  return { cars, update };
}
