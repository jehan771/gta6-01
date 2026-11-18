// The HUD: minimap, wanted stars, health, money, debt, mission counter,
// packages, timer, district line, radio line, heli line, objective line,
// speed, ammo, message feed and context hints, plus the title, pause,
// busted and complete screens.
import { MISSIONS, MISSION } from './config.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const refs = {
    minimap: el('minimap'),
    stars: el('hud-stars'),
    health: el('hud-health-fill'),
    money: el('hud-money'),
    debt: el('hud-debt'),
    missions: el('hud-missions'),
    packages: el('hud-packages'),
    timer: el('hud-timer'),
    district: el('hud-district'),
    radio: el('hud-radio'),
    heli: el('hud-heli'),
    objective: el('hud-objective'),
    speed: el('hud-speed'),
    ammo: el('hud-ammo'),
    feed: el('hud-feed'),
    hint: el('hud-hint'),
    title: el('screen-title'),
    pause: el('screen-pause'),
    busted: el('screen-busted'),
    complete: el('screen-complete'),
    titleSummary: el('title-summary'),
    btnContinue: el('btn-continue'),
    btnNew: el('btn-new'),
    btnResume: el('btn-resume'),
    btnRetry: el('btn-retry'),
    completeSummary: el('complete-summary'),
  };
  const ctx = refs.minimap.getContext('2d');
  const feed = [];

  function message(text) {
    feed.push(text);
    while (feed.length > 5) feed.shift();
    refs.feed.innerHTML = feed.map((m) => `<div>${m}</div>`).join('');
  }

  function districtName(x, z) {
    if (z > 138) return 'SOLMAR BEACH';
    if (x > 138) return 'MARINA';
    if (Math.abs(x) < 44 && Math.abs(z) < 44) return 'DOWNTOWN';
    if (x < -66 && z < -66) return 'PALM ROW';
    if (z < -100) return 'NORTH END';
    if (x > 66) return 'EASTSIDE';
    if (z > 100) return 'BEACH BLVD';
    return 'SOLMAR CITY';
  }

  function radioText() {
    const station = G.audio.radioStation();
    if (station === null) return 'RADIO OFF — press R';
    return `${station.name} — Solmar radio (R)`;
  }

  function showScreen(name) {
    for (const key of ['title', 'pause', 'busted', 'complete']) {
      refs[key].style.display = key === name ? 'flex' : 'none';
    }
  }

  function drawMinimap() {
    const S = 190;
    const scale = S / 320;
    const px = G.player.pos.x;
    const pz = G.player.pos.z;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];
    // Roads.
    ctx.strokeStyle = '#4a5058';
    ctx.lineWidth = 5;
    for (const road of [-110, -66, -22, 22, 66, 110]) {
      const [x1, y1] = toMap(road, pz - 160);
      const [x2, y2] = toMap(road, pz + 160);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(px - 160, road);
      const [x4, y4] = toMap(px + 160, road);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      if (mx < -4 || mx > S + 4 || my < -4 || my > S + 4) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    };
    // Mission waypoint.
    if (G.missions.beacon.target) dot(G.missions.beacon.target.x, G.missions.beacon.target.z, '#ffd94f', 5);
    // Taxi passenger.
    if (G.missions.taxi.active && G.missions.taxi.dest) dot(G.missions.taxi.dest.x, G.missions.taxi.dest.z, '#f2c230', 5);
    for (const p of G.missions.passengers) dot(p.pos.x, p.pos.z, '#f2c230', 3);
    // Police, traffic, pedestrians, helicopter.
    for (const car of G.police.policeCars) dot(car.pos.x, car.pos.z, '#4f8ff2', 3);
    for (const car of G.traffic.cars) {
      if (!car.stolen) dot(car.pos.x, car.pos.z, '#9aa3ad', 2);
    }
    for (const ped of G.pedestrians.peds) dot(ped.pos.x, ped.pos.z, '#7d8894', 1.5);
    if (G.helicopter.heli.active) {
      const [hx, hy] = toMap(G.helicopter.heli.group.position.x, G.helicopter.heli.group.position.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4f8ff2';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); ctx.stroke();
    }
    // Player in the centre, with N above.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 12);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 4, 0, Math.PI * 2); ctx.stroke();
  }

  let lastText = 0;
  function update(now) {
    drawMinimap();
    if (now - lastText < 100) return;
    lastText = now;
    const level = G.police.stars();
    refs.stars.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
    refs.stars.style.color = level >= 3 ? '#ff5544' : '#ffd94f';
    refs.health.style.width = `${Math.max(0, G.player.health)}px`;
    refs.money.textContent = `$${G.money}`;
    refs.debt.textContent = G.missionIndex >= MISSIONS.length ? 'DEBT PAID' : `DEBT $${MISSION.debtTotal}`;
    refs.missions.textContent = `Missions ${G.missionIndex}/${MISSIONS.length}`;
    refs.packages.textContent = `Packages ${G.packagesGot}/${MISSION.packageCount}`;
    if (G.mission) {
      const t = Math.max(0, Math.ceil(G.mission.timer));
      refs.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      refs.objective.textContent = `${G.mission.def.name}: ${G.mission.def.intro}`;
    } else {
      refs.timer.textContent = '';
      refs.objective.textContent = G.missionIndex >= MISSIONS.length
        ? 'Free roam — fares and packages still pay.'
        : 'Press M to start the next job.';
    }
    refs.district.textContent = districtName(G.player.pos.x, G.player.pos.z);
    refs.radio.textContent = radioText();
    const heliOn = G.helicopter.heli.active;
    refs.heli.style.display = heliOn ? 'block' : 'none';
    if (heliOn) refs.heli.textContent = 'AIR-1 overhead — lose the chopper';
    refs.speed.textContent = G.player.car ? `${Math.round(Math.abs(G.player.car.speed) * 3.6)} km/h` : '';
    refs.ammo.textContent = G.player.weapon === 'pistol' ? `PISTOL ${G.player.ammo}` : 'FISTS';
    refs.hint.textContent = G.player.car
      ? 'E exit car · Space handbrake · R radio · T taxi · M mission'
      : 'E steal car · F punch · 2 pistol · M mission';
  }

  function showTitle() {
    refs.titleSummary.textContent =
      `Money $${G.money} · Missions ${G.missionIndex}/${MISSIONS.length} · Packages ${G.packagesGot}/${MISSION.packageCount}`;
    refs.btnContinue.style.display = G.hasSave ? 'inline-block' : 'none';
    showScreen('title');
  }

  return { refs, message, showScreen, showTitle, update };
}
