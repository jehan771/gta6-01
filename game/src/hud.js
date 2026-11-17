// HUD — every DOM overlay: minimap canvas, wanted stars, health, money,
// objective line, speed, ammo, message feed, and the title / pause / busted /
// complete screens. The 3D world never draws text; the DOM does.
import { CFG } from './config.js';
import { roadCoords } from './city.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const map = el('minimap');
  const mctx = map.getContext('2d');
  const roads = roadCoords();
  const feed = el('feed');
  const feedItems = [];

  function say(text, who) {
    const div = document.createElement('div');
    div.className = 'msg' + (who === 'Rosa' ? ' rosa' : '');
    div.textContent = (who ? who + ': ' : '') + text;
    feed.prepend(div);
    feedItems.unshift(div);
    while (feedItems.length > 5) feedItems.pop().remove();
  }

  function drawMinimap(px, pz, heading, waypoint, police, traffic, peds, taxiPed) {
    const W = map.width, H = map.height;
    const scale = W / (CFG.cityHalf * 2 + 80);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    mctx.fillStyle = 'rgba(12, 20, 28, 0.85)';
    mctx.fillRect(0, 0, W, H);
    // Water + beach.
    mctx.fillStyle = '#2e6f8e';
    mctx.fillRect(toX(CFG.marinaX), 0, W - toX(CFG.marinaX), H);
    mctx.fillStyle = '#e6cf9e';
    mctx.fillRect(0, toY(CFG.beachZ), W, H - toY(CFG.beachZ));
    // Roads.
    mctx.strokeStyle = '#5a6068'; mctx.lineWidth = 5;
    for (const r of roads) {
      mctx.beginPath(); mctx.moveTo(toX(r), 0); mctx.lineTo(toX(r), H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, toY(r)); mctx.lineTo(W, toY(r)); mctx.stroke();
    }
    const dot = (x, z, color, r) => {
      mctx.fillStyle = color;
      mctx.beginPath(); mctx.arc(toX(x), toY(z), r, 0, Math.PI * 2); mctx.fill();
    };
    for (const c of traffic) if (c.alive) dot(c.x, c.z, '#b9c4cc', 1.6);
    for (const p of peds) if (p.alive) dot(p.x, p.z, '#8fa3b0', 1.2);
    if (taxiPed) dot(taxiPed.x, taxiPed.z, '#f2b705', 3);
    for (const c of police) dot(c.x, c.z, '#4d8dff', 3);
    if (waypoint) {
      mctx.fillStyle = '#ffd54d';
      mctx.beginPath(); mctx.arc(toX(waypoint.x), toY(waypoint.z), 4.5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffd54d'; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(toX(waypoint.x), toY(waypoint.z), 7 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); mctx.stroke();
    }
    // Player arrow: the arrow is drawn pointing up (-y); rotate it so it
    // points along the heading (map +y is +z, i.e. south).
    mctx.save();
    mctx.translate(toX(px), toY(pz));
    mctx.rotate(Math.PI - heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#ffffff'; mctx.font = 'bold 11px system-ui';
    mctx.fillText('N', W / 2 - 3, 12);
  }

  return {
    say,
    update(s) {
      el('money').textContent = '$' + s.money.toLocaleString('en-US');
      el('health-fill').style.width = Math.max(0, s.health) + '%';
      el('health-fill').style.background = s.health > 50 ? '#58d68d' : s.health > 25 ? '#f2b705' : '#e5534b';
      el('stars').textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      el('stars').style.color = s.wanted > 0 ? '#ffd54d' : 'rgba(255,255,255,0.35)';
      el('objective').textContent = s.objective;
      el('ammo').textContent = s.weapon === 'pistol' ? `🔫 ${s.ammo} / ${CFG.pistolMaxAmmo}` : '👊 fists  [2: pistol]';
      el('speed').textContent = s.inCar ? Math.round(s.speed * 3.6) + ' km/h' : '';
      el('speed').style.display = s.inCar ? 'block' : 'none';
      el('packages').textContent = `📦 ${s.collected}/${CFG.packageCount}`;
      el('missions-done').textContent = `Missions ${Math.min(s.missionsDone, 5)}/5`;
      el('debt').textContent = s.missionsDone >= 5 ? 'DEBT PAID ✓' : `Debt $${(1500 - s.money).toLocaleString('en-US')}`;
      el('timer').textContent = s.timerText || '';
      el('hint').textContent = s.hint || '';
      drawMinimap(s.px, s.pz, s.heading, s.waypoint, s.police, s.traffic, s.peds, s.taxiPed);
    },
    show(screen) {
      for (const id of ['title', 'pause', 'busted', 'complete']) {
        el('screen-' + id).classList.toggle('hidden', id !== screen);
      }
      el('hud').classList.toggle('hidden', screen === 'title' || screen === 'complete');
    },
    setTitleStats(money, missionsDone, best) {
      el('title-stats').textContent =
        `Money $${money.toLocaleString('en-US')}  •  Missions ${missionsDone}/5  •  Packages ${best}`;
    },
    setBusted(fine) { el('busted-text').textContent = `The Solmar PD caught you. Fine: $${fine}. Your car is impounded — you wake up at the hideout.`; },
    setComplete(money) { el('complete-text').textContent = `The debt is paid and Solmar City is yours. Final money: $${money.toLocaleString('en-US')}.`; },
  };
}
