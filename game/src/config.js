// Solmar City tuning: every number the game balances on lives here.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const DEFAULT_SEED = 20261117;

export const WORLD = {
  roadGap: 44,
  roads: [-110, -66, -22, 22, 66, 110],
  halfRoad: 5,
  sidewalk: 2.5,
  edge: 132,
  beachZ: 138,
  marinaX: 138,
  fogNear: 130,
  fogFar: 460,
  fov: 62,
  near: 0.1,
  far: 900,
  trafficCount: 14,
  pedCount: 26,
  palmCount: 90,
  cloudCount: 20,
};

export const PLACES = {
  spawn: { x: -22, z: 44 },
  hideout: { x: -88, z: -88 },
  marinaGate: { x: 128, z: 22 },
  northTower: { x: 22, z: -110 },
  beach: { x: 0, z: 150 },
};

export const WALK = {
  speed: 6,
  run: 10,
  jump: 8.5,
  gravity: 24,
};

export const DRIVE = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxReverse: 9,
  steer: 1.9,
  grip: 6.5,
  handbrakeGrip: 1.6,
  drag: 0.35,
  crashLoss: 0.45,
};

export const CAR_TYPES = {
  sedan: { top: 30, accelMul: 1.0, steerMul: 1.0, length: 4.4, color: 0x3a6fd8 },
  taxi: { top: 28, accelMul: 0.95, steerMul: 1.0, length: 4.4, color: 0xf2c230 },
  pickup: { top: 27, accelMul: 0.9, steerMul: 0.85, length: 4.8, color: 0x8a5a2e },
  sports: { top: 42, accelMul: 1.35, steerMul: 1.2, length: 4.2, color: 0xd8232a },
  van: { top: 24, accelMul: 0.8, steerMul: 0.8, length: 5.2, color: 0x9aa3ad },
  police: { top: 36, accelMul: 1.2, steerMul: 1.15, length: 4.4, color: 0x1c2f6e },
};

export const WANTED = {
  heatPerStar: 20,
  decay: 1.6,
  decayDelay: 6,
  steal: 26,
  hitPed: 30,
  shoot: 18,
  kill: 45,
  bustFine: 100,
  bustHold: 1.6,
  policeChaseSpeed: 36,
  policeRamSpeed: 26,
  footSpeed: 5.2,
};

export const COMBAT = {
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.2,
  pistolDamage: 34,
  ammoStart: 12,
  ammoMax: 48,
  ammoBox: 12,
};

export const HELI = {
  orbitRadius: 30,
  orbitHeight: 22,
  orbitSpeed: 0.32,
  rotorSpeed: 22,
  departRise: 6,
  departTime: 4,
  minStars: 3,
  lightLength: 22,
  lightRadius: 3,
};

export const RADIO = {
  stations: [
    { name: 'SOL 101.9', bpm: 112, base: 110, minor: true, tag: 'night drive' },
    { name: 'PALMA FM', bpm: 124, base: 130.81, minor: false, tag: 'beach day' },
  ],
  bassVol: 0.11,
  arpVol: 0.035,
  steps: 16,
};

export const MISSIONS = [
  { name: 'Getaway', pay: 300, time: 100, intro: 'Rosa: steal a car and bring it to the hideout on Palm Row.' },
  { name: 'Courier', pay: 450, time: 130, intro: 'Rosa: pick up the package at the marina gate, deliver it to the north tower.' },
  { name: 'Tail', pay: 500, time: 75, intro: 'Rosa: follow the blue sedan. Stay 8 to 35 metres back. Do not get spotted.' },
  { name: 'Heat', pay: 600, time: 160, intro: 'Rosa: the whole city is on you. Lose all the heat. Lay low.' },
  { name: 'The Debt', pay: 1000, time: 240, intro: 'Rosa: meet the loan shark crew at the marina. This is not the last job — two more after this.' },
  { name: 'Last Score', pay: 800, time: 120, intro: 'Rosa: one more car, one more run to the hideout. The cops are already on you.' },
  { name: 'Payday', pay: 1500, time: 240, intro: 'Rosa: pick up the payoff at the marina, deliver it north — then finish it. The debt ends tonight.' },
];

export const MISSION = {
  hideoutRadius: 7,
  marinaRadius: 6,
  marinaRadiusM5: 10,
  towerRadius: 7,
  packageRadius: 2,
  taxiRadius: 6,
  tailMin: 8,
  tailMax: 35,
  tailTooClose: 6,
  tailTooFar: 45,
  tailTarget: 45,
  spottedLimit: 3,
  taxiPerMetre: 1.1,
  taxiBase: 20,
  packagePay: 50,
  packageCount: 10,
  debtTotal: 1500,
  beaconHeight: 26,
  beaconOpacity: 0.25,
  diamondHeight: 7,
};

export const SAVE_KEY = 'solmar-city.save.v2';
export const AUTOSAVE_SECONDS = 20;
