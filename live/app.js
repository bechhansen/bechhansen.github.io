'use strict';

// ─── MQTT CONFIG ───────────────────────────────────────────────────────────────
const MQTT_URL   = 'wss://8d7e542615ac48eb9d46ea3a80565554.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER  = 'webclient';
const MQTT_PASS  = 'Webclient1234!';
const MQTT_TOPIC = 'rover/telemetry';
const CLIENT_ID  = 'standalone-' + Math.random().toString(36).slice(2, 9);

// ─── CLOCK ────────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}
setInterval(updateClock, 1000);
updateClock();

// ─── MQTT STATUS ──────────────────────────────────────────────────────────────
function setStatus(state) {
  const dot   = document.getElementById('ws-dot');
  const label = document.getElementById('ws-label');
  if (state === 'connected') {
    dot.className = 'ws-indicator ws-on';
    label.textContent = 'CONNECTED';
  } else if (state === 'reconnecting') {
    dot.className = 'ws-indicator ws-amber';
    label.textContent = 'RECONNECTING';
  } else {
    dot.className = 'ws-indicator ws-off';
    label.textContent = 'DISCONNECTED';
  }
}

// ─── MQTT CONNECTION ──────────────────────────────────────────────────────────
const client = mqtt.connect(MQTT_URL, {
  clientId:  CLIENT_ID,
  username:  MQTT_USER,
  password:  MQTT_PASS,
  reconnectPeriod: 3000,
  connectTimeout:  10000,
});

client.on('connect', () => {
  setStatus('connected');
  client.subscribe(MQTT_TOPIC);
});

client.on('reconnect', () => setStatus('reconnecting'));
client.on('offline',   () => setStatus('disconnected'));
client.on('error',     () => setStatus('disconnected'));

client.on('message', (_topic, payload) => {
  try {
    updateUI(JSON.parse(payload.toString()));
  } catch (e) {
    // ignore malformed JSON
  }
});

// ─── TELEMETRY UPDATE ─────────────────────────────────────────────────────────
const MAX_DIST_CM = 100;
let lastPitch = 0, lastRoll = 0;

function updateUI(data) {
  // State badge
  if (data.state !== undefined) {
    const badge = document.getElementById('state');
    badge.textContent = data.state;
    badge.className = 'state-badge ' + stateClass(data.state);
  }

  // Drive: speed %
  if (data.speed_pct !== undefined) {
    document.getElementById('speed_pct').textContent = data.speed_pct;
  }

  // Drive: turning radius
  if (data.radius !== undefined) {
    const r = data.radius;
    document.getElementById('radius-val').textContent  = r === 0 ? '∞' : Math.abs(r);
    document.getElementById('radius-unit').textContent = r === 0 ? '' : (r < 0 ? 'L mm' : 'R mm');
  }

  // Proximity
  if (data.distance !== undefined) {
    document.getElementById('distance').textContent = data.distance;
    const pct = Math.min(100, Math.round((data.distance / MAX_DIST_CM) * 100));
    document.getElementById('dist-bar').style.width = pct + '%';
    document.getElementById('prox-card').classList.toggle('proximity-warning', data.distance < 20);
  }

  // Stability (IMU)
  if (data.pitch !== undefined) {
    lastPitch = parseFloat(data.pitch);
    document.getElementById('pitch').textContent = lastPitch.toFixed(1);
  }
  if (data.roll !== undefined) {
    lastRoll = parseFloat(data.roll);
    document.getElementById('roll').textContent = lastRoll.toFixed(1);
  }
  document.getElementById('stab-card').classList.toggle(
    'stability-warning', Math.abs(lastPitch) > 3 || Math.abs(lastRoll) > 3);

  // GPS
  if (data.gps_valid !== undefined) {
    const valid = data.gps_valid;
    const badge = document.getElementById('gps-fix-badge');
    badge.textContent = valid ? 'FIX' : 'NO FIX';
    badge.className = 'telem-value small ' + (valid ? 'gps-fix' : 'gps-nofix');

    if (valid && data.gps_lat !== undefined && data.gps_lng !== undefined) {
      document.getElementById('nav-position').textContent =
        parseFloat(data.gps_lat).toFixed(5) + ' / ' + parseFloat(data.gps_lng).toFixed(5);
      updateMap(parseFloat(data.gps_lat), parseFloat(data.gps_lng), parseFloat(data.gps_course));
    }
  }

  if (data.gps_speed !== undefined) {
    document.getElementById('gps_speed').textContent = data.gps_speed;
  }
  if (data.gps_course !== undefined) {
    document.getElementById('gps_course').textContent = data.gps_course;
  }
}

function stateClass(s) {
  s = (s || '').toUpperCase();
  if (s.includes('FORWARD'))  return 'state-fwd';
  if (s.includes('BACKWARD')) return 'state-bwd';
  if (s.includes('CIRCLING')) return 'state-circ';
  if (s === 'IDLE')           return 'state-idle';
  return '';
}

// ─── LEAFLET MAP ──────────────────────────────────────────────────────────────
const roverSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='52' viewBox='0 0 40 52'>
  <polygon points='20,2 13,12 27,12' fill='#fc3d21'/>
  <rect x='10' y='10' width='20' height='30' rx='3' fill='#00c8f0'/>
  <rect x='3' y='12' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <rect x='3' y='23' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <rect x='3' y='34' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <rect x='30' y='12' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <rect x='30' y='23' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <rect x='30' y='34' width='7' height='6' rx='2' fill='#0d1117' stroke='#7a9ab8' stroke-width='1.5'/>
  <circle cx='20' cy='26' r='3' fill='#0d1117' opacity='0.5'/>
</svg>`;

let map, roverMarker;

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
  map.setView([0, 0], 2);
}

function updateMap(lat, lon, course) {
  const deg = (course !== undefined && !isNaN(course)) ? course : 0;
  const iconHtml = `<div style="transform:rotate(${deg}deg);transform-origin:center;">${roverSvg}</div>`;
  const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [40, 52], iconAnchor: [20, 26] });

  document.getElementById('map-no-gps').classList.add('hidden');

  if (!roverMarker) {
    roverMarker = L.marker([lat, lon], { icon }).addTo(map);
    map.setView([lat, lon], 17);
  } else {
    roverMarker.setIcon(icon);
    roverMarker.setLatLng([lat, lon]);
    map.panTo([lat, lon]);
  }
}

window.addEventListener('load', initMap);
