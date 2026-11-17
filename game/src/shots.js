// The 4 screenshot scenes behind ?shot=1..4. Each one stages a real game
// state (real systems, real HUD) and then lets the loop run it forward with
// scripted inputs for a fixed number of frames, so the frame is what a short
// stretch of actual play looks like. The loop sets window.__shotReady when
// the scene has settled.
export function stageShot(G, name) {
  const { input, player, missions, police } = G;
  const holdW = () => input._testDown('KeyW');

  if (name === '1') {
    // Cover — police chase: red sports car at speed down the beach boulevard,
    // two police cars on its tail, 3 stars, courier mission live, sun ahead.
    G.startDriving('sports', -60, 110, Math.PI / 2);
    G.car.mesh.children[0].material.color.setHex(0xc62828);
    police.setHeat(61);
    police.step(0.01, { x: -60, z: 110 }, G.car, 20, false);
    missions.startMission(1, G.missionHooks);
    G.shotPoliceGap = 13;
    holdW();
    G.shotFrames = 150;
  } else if (name === '2') {
    // On foot in the city: Vic on the sidewalk among pedestrians, a taxi at
    // the curb ahead, storefronts and palms, downtown behind him.
    player.x = -15.5; player.z = 30; player.heading = Math.PI; player.camYaw = Math.PI;
    player.mesh.position.set(player.x, 0, player.z);
    G.spawnParkedTaxi(-24.2, 22, Math.PI);
    G.peds.spawn(-15.5, 20);
    G.peds.spawn(-14, 14);
    G.peds.spawn(-17, 10);
    G.peds.spawn(-15, 24);
    G.shotFrames = 40;
  } else if (name === '3') {
    // Mission in progress: sunset, driving for the marina gate on the final
    // job, a police car in the distance, waypoint beacon ahead.
    G.setTimeOfDay('sunset');
    G.startDriving('sedan', 75, 22, Math.PI / 2);
    G.car.mesh.children[0].material.color.setHex(0xc62828);
    missions.startMission(4, G.missionHooks);
    police.setHeat(22);
    police.step(0.01, { x: 75, z: 22 }, G.car, 20, false);
    G.shotPoliceGap = 30;
    G.shotPoliceMode = 'ahead';
    holdW();
    G.shotFrames = 70;
  } else {
    // Title screen: the city behind the menu, slow orbit.
    G.mode = 'title';
    G.shotFrames = 90;
  }
  G.shotCountdown = G.shotFrames;
}
