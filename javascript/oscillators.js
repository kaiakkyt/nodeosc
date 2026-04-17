'use strict';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const WAVE_TYPES = [
  { id: 'sine',     label: 'Sine',  svg: '<svg width="28" height="14" viewBox="0 0 28 14"><path d="M2,7 Q5,0 9,7 Q13,14 17,7 Q21,0 25,7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { id: 'triangle', label: 'Tri',   svg: '<svg width="28" height="14" viewBox="0 0 28 14"><polyline points="2,7 8,1 14,13 20,1 26,7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { id: 'square',   label: 'Sq',    svg: '<svg width="28" height="14" viewBox="0 0 28 14"><polyline points="2,7 2,1 9,1 9,13 16,13 16,1 23,1 23,7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { id: 'sawtooth', label: 'Saw',   svg: '<svg width="28" height="14" viewBox="0 0 28 14"><polyline points="2,12 10,2 10,12 18,2 18,12 26,2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { id: 'custom',   label: 'Draw',  svg: '<svg width="28" height="14" viewBox="0 0 28 14"><path d="M2,9 L6,3 L10,10 L14,5 L18,9 L22,4 L26,7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
];

const KB_MAP = {

  'z':0,'s':1,'x':2,'d':3,'c':4,'v':5,'g':6,'b':7,'h':8,'n':9,'j':10,'m':11,
  ',':12,'l':13,'.':14,';':15,'/':16,

  'q':12,'2':13,'w':14,'3':15,'e':16,'r':17,'5':18,'t':19,'6':20,'y':21,'7':22,'u':23,
  'i':24,'9':25,'o':26,'0':27,'p':28,
};

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let oscIdCounter = 0;
const oscillators = [];

const defaultSettings = () => ({
  type:        'sine',
  gain:        0.5,
  detune:      0,
  octave:      0,
  unison:      1,
  unisonSpread:0.2,
  solo:        false,
  muted:       false,
  customWave:  null,
});

function addOscillator() {
  const id = ++oscIdCounter;
  const osc = {
    id,
    settings: defaultSettings(),
    voices: new Map(),
  };
  oscillators.push(osc);
  renderOscCard(osc);
  updateEmptyState();
  return osc;
}

function addOscillatorWithSettings(settings) {
  const id  = ++oscIdCounter;
  const osc = { id, settings: { ...defaultSettings(), ...settings }, voices: new Map() };
  oscillators.push(osc);
  renderOscCard(osc);
  updateEmptyState();
  return osc;
}

function removeOscillator(id) {
  const idx = oscillators.findIndex(o => o.id === id);
  if (idx === -1) return;
  const osc = oscillators[idx];
  osc.voices.forEach(v => v.stop());
  oscillators.splice(idx, 1);
  const card = document.getElementById(`osc-card-${id}`);
  if (card) card.remove();
  updateEmptyState();
}

let anySolo = false;

function noteOn(noteKey, freq) {
  if (!Audio.isRunning()) return;
  anySolo = oscillators.some(o => o.settings.solo);

  oscillators.forEach(osc => {
    if (osc.settings.muted) return;
    if (anySolo && !osc.settings.solo) return;
    if (osc.voices.has(noteKey)) return;

    const shiftedFreq = freq * Math.pow(2, osc.settings.octave);
    const voice = Audio.createVoice(osc.settings, shiftedFreq);

    const lfoGain = Audio.getLFOGain();
    if (lfoGain) {
      voice.voices.forEach(v => {
        try { lfoGain.connect(v.osc.frequency); } catch (_) {}
      });
    }

    osc.voices.set(noteKey, voice);
  });
}

function noteOff(noteKey) {
  oscillators.forEach(osc => {
    const voice = osc.voices.get(noteKey);
    if (voice) {
      voice.stop();
      osc.voices.delete(noteKey);
    }
  });
}

const PIANO_KEYS = [
  { note: 60, type: 'white', label: 'C4'  },
  { note: 61, type: 'black', label: 'C#4', leftPct: 52 },
  { note: 62, type: 'white', label: 'D4'  },
  { note: 63, type: 'black', label: 'D#4', leftPct: 120 },
  { note: 64, type: 'white', label: 'E4'  },
  { note: 65, type: 'white', label: 'F4'  },
  { note: 66, type: 'black', label: 'F#4', leftPct: 262 },
  { note: 67, type: 'white', label: 'G4'  },
  { note: 68, type: 'black', label: 'G#4', leftPct: 330 },
  { note: 69, type: 'white', label: 'A4'  },
  { note: 70, type: 'black', label: 'A#4', leftPct: 398 },
  { note: 71, type: 'white', label: 'B4'  },
  { note: 72, type: 'white', label: 'C5'  },
];

function buildPiano() {
  const piano = document.getElementById('piano');
  piano.innerHTML = '';

  const whites = PIANO_KEYS.filter(k => k.type === 'white');
  const whites_count = whites.length;
  const keyW = 100 / whites_count;

  piano.style.position = 'relative';

  let whiteIdx = 0;
  PIANO_KEYS.forEach(k => {
    const el = document.createElement('div');
    el.dataset.note = k.note;
    el.title = k.label;

    if (k.type === 'white') {
      el.className = 'key-white';
      el.style.width = `${keyW}%`;
      whiteIdx++;
    } else {
      el.className = 'key-black';

      el.style.left  = `${(whiteIdx - 0.3) * keyW}%`;
      el.style.width = `${keyW * 0.6}%`;
      el.style.top   = '0';
    }

    const noteKey = `piano-${k.note}`;
    const freq    = midiToFreq(k.note);

    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      Audio.start();
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      noteOn(noteKey, freq);
    });
    el.addEventListener('pointerup',    () => { el.classList.remove('active'); noteOff(noteKey); });
    el.addEventListener('pointercancel',() => { el.classList.remove('active'); noteOff(noteKey); });

    piano.appendChild(el);
  });
}

const heldKeys = new Set();

document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if (document.activeElement && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (document.activeElement?.isContentEditable) return;

  const key = e.key.toLowerCase();
  if (!(key in KB_MAP)) return;
  if (heldKeys.has(key)) return;
  heldKeys.add(key);

  Audio.start();
  const midi = 60 + KB_MAP[key];
  noteOn(`kb-${key}`, midiToFreq(midi));
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (!heldKeys.has(key)) return;
  heldKeys.delete(key);
  noteOff(`kb-${key}`);
});

function renderOscCard(osc) {
  const grid = document.getElementById('osc-grid');
  const card = document.createElement('div');
  card.className = 'osc-card';
  card.id = `osc-card-${osc.id}`;

  card.innerHTML = `
    <div class="osc-header">
      <span class="osc-name">OSC ${osc.id}</span>
      <div class="osc-header-btns">
        <button class="btn-osc-mute"  title="Mute">M</button>
        <button class="btn-osc-solo"  title="Solo">S</button>
        <button class="btn-osc-remove" title="Remove">&#10005;</button>
      </div>
    </div>
    <div class="osc-body">

      <!-- Waveform picker -->
      <div class="waveform-picker osc-section-full">
        ${WAVE_TYPES.map(w => `
          <button class="wave-btn${osc.settings.type === w.id ? ' selected' : ''}"
                  data-wave="${w.id}" title="${w.label}">
            ${w.svg}${w.label}
          </button>`).join('')}
      </div>

      <!-- Custom waveform editor (visible when Draw type is selected) -->
      <div class="custom-wave-editor osc-section-full">
        <canvas class="custom-wave-canvas"></canvas>
        <div class="custom-wave-presets">
          <button class="btn-ghost cwp-btn" data-preset="sine">Sine</button>
          <button class="btn-ghost cwp-btn" data-preset="saw">Saw</button>
          <button class="btn-ghost cwp-btn" data-preset="square">Sq</button>
          <button class="btn-ghost cwp-btn" data-preset="clear">Clear</button>
        </div>
      </div>

      <!-- Volume -->
      <label class="knob-label">
        Volume
        <input type="range" class="knob-slider osc-gain"
               min="0" max="1" step="0.01" value="${osc.settings.gain}" />
        <span class="knob-value osc-gain-val">${Math.round(osc.settings.gain * 100)}%</span>
      </label>

      <!-- Detune -->
      <label class="knob-label">
        Detune <small>(semi)</small>
        <input type="range" class="knob-slider osc-detune"
               min="-24" max="24" step="0.1" value="${osc.settings.detune}" />
        <span class="knob-value osc-detune-val">${osc.settings.detune.toFixed(1)}</span>
      </label>

      <!-- Octave -->
      <label class="knob-label">
        Octave
        <input type="range" class="knob-slider osc-octave"
               min="-3" max="3" step="1" value="${osc.settings.octave}" />
        <span class="knob-value osc-octave-val">${osc.settings.octave >= 0 ? '+' : ''}${osc.settings.octave}</span>
      </label>

      <!-- Unison count -->
      <label class="knob-label">
        Unison
        <input type="range" class="knob-slider osc-unison"
               min="1" max="7" step="1" value="${osc.settings.unison}" />
        <span class="knob-value osc-unison-val">${osc.settings.unison}</span>
      </label>

      <!-- Unison spread -->
      <label class="knob-label">
        Spread
        <input type="range" class="knob-slider osc-spread"
               min="0" max="1" step="0.01" value="${osc.settings.unisonSpread}" />
        <span class="knob-value osc-spread-val">${osc.settings.unisonSpread.toFixed(2)}</span>
      </label>

    </div>
  `;

  const N_WAVE  = 256;
  const wCanvas = card.querySelector('.custom-wave-canvas');
  const wEditor = card.querySelector('.custom-wave-editor');

  function _initCustomWave() {
    if (!osc.settings.customWave)
      osc.settings.customWave = Array.from({ length: N_WAVE }, (_, i) => Math.sin(2 * Math.PI * i / N_WAVE));
  }

  function _drawWave() {
    if (!osc.settings.customWave) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = wCanvas.clientWidth  || 220;
    const H   = wCanvas.clientHeight || 72;
    wCanvas.width  = W * dpr;
    wCanvas.height = H * dpr;
    const c = wCanvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0e1018';
    c.fillRect(0, 0, W, H);

    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth   = 1;
    c.beginPath(); c.moveTo(0, H / 2 + 0.5); c.lineTo(W, H / 2 + 0.5); c.stroke();

    c.strokeStyle = '#5b8fff';
    c.lineWidth   = 1.5;
    c.beginPath();
    const data = osc.settings.customWave;
    for (let i = 0; i < N_WAVE; i++) {
      const x = (i / (N_WAVE - 1)) * W;
      const y = (1 - data[i]) / 2 * H;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }

  let _wDrawing = false, _wLastIdx = -1;
  function _onWMove(e) {
    const rect = wCanvas.getBoundingClientRect();
    const idx  = Math.max(0, Math.min(N_WAVE - 1, Math.round(((e.clientX - rect.left) / rect.width) * (N_WAVE - 1))));
    const val  = Math.max(-1, Math.min(1, 1 - 2 * (e.clientY - rect.top) / rect.height));
    const d    = osc.settings.customWave;
    if (_wLastIdx >= 0 && _wLastIdx !== idx) {
      const step = Math.sign(idx - _wLastIdx);
      const v0   = d[_wLastIdx];
      for (let i = _wLastIdx + step; i !== idx + step; i += step)
        d[i] = v0 + (val - v0) * ((i - _wLastIdx) / (idx - _wLastIdx));
    }
    d[idx]    = val;
    _wLastIdx = idx;
    _drawWave();
  }

  wCanvas.addEventListener('pointerdown',   e => { _initCustomWave(); _wDrawing = true; wCanvas.setPointerCapture(e.pointerId); _onWMove(e); });
  wCanvas.addEventListener('pointermove',   e => { if (_wDrawing) _onWMove(e); });
  wCanvas.addEventListener('pointerup',     () => { _wDrawing = false; _wLastIdx = -1; });
  wCanvas.addEventListener('pointercancel', () => { _wDrawing = false; _wLastIdx = -1; });

  card.querySelectorAll('.cwp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _initCustomWave();
      const d = osc.settings.customWave;
      switch (btn.dataset.preset) {
        case 'sine':   for (let i = 0; i < N_WAVE; i++) d[i] = Math.sin(2 * Math.PI * i / N_WAVE); break;
        case 'saw':    for (let i = 0; i < N_WAVE; i++) d[i] = (2 * i / N_WAVE) - 1;               break;
        case 'square': for (let i = 0; i < N_WAVE; i++) d[i] = i < N_WAVE / 2 ? 1 : -1;           break;
        case 'clear':  for (let i = 0; i < N_WAVE; i++) d[i] = 0;                                  break;
      }
      _drawWave();
    });
  });

  card.querySelectorAll('.wave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      osc.settings.type = btn.dataset.wave;
      card.querySelectorAll('.wave-btn').forEach(b => b.classList.toggle('selected', b === btn));
      wEditor.style.display = osc.settings.type === 'custom' ? 'block' : 'none';
      if (osc.settings.type === 'custom') { _initCustomWave(); _drawWave(); }
    });
  });

  function wire(selector, valSelector, setter, fmt) {
    const slider = card.querySelector(selector);
    const valEl  = card.querySelector(valSelector);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      setter(v);
      valEl.textContent = fmt(v);
    });
    _makeValEditable(slider, valEl, setter, fmt);
  }

  wire('.osc-gain',   '.osc-gain-val',   v => { osc.settings.gain = v; },             v => `${Math.round(v * 100)}%`);
  wire('.osc-detune', '.osc-detune-val', v => { osc.settings.detune = v; },            v => v.toFixed(1));
  wire('.osc-octave', '.osc-octave-val', v => { osc.settings.octave = v; },            v => `${v >= 0 ? '+' : ''}${v}`);
  wire('.osc-unison', '.osc-unison-val', v => { osc.settings.unison = v; },            v => `${v}`);
  wire('.osc-spread', '.osc-spread-val', v => { osc.settings.unisonSpread = v; },      v => v.toFixed(2));

  const muteBtn   = card.querySelector('.btn-osc-mute');
  const soloBtn   = card.querySelector('.btn-osc-solo');
  const removeBtn = card.querySelector('.btn-osc-remove');

  muteBtn.addEventListener('click', () => {
    osc.settings.muted = !osc.settings.muted;
    muteBtn.classList.toggle('on', osc.settings.muted);
    card.classList.toggle('muted', osc.settings.muted);
    if (osc.settings.muted) { osc.voices.forEach(v => v.stop()); osc.voices.clear(); }
  });

  soloBtn.addEventListener('click', () => {
    osc.settings.solo = !osc.settings.solo;
    soloBtn.classList.toggle('on', osc.settings.solo);
    const nowSolo = oscillators.some(o => o.settings.solo);
    if (nowSolo) {
      oscillators.forEach(o => {
        if (!o.settings.solo) { o.voices.forEach(v => v.stop()); o.voices.clear(); }
      });
    }
  });

  removeBtn.addEventListener('click', () => removeOscillator(osc.id));

  grid.appendChild(card);

  if (osc.settings.type === 'custom') {
    wEditor.style.display = 'block';
    _initCustomWave();
    _drawWave();
  }
}

function updateEmptyState() {
  const grid = document.getElementById('osc-grid');
  let empty  = grid.querySelector('.osc-empty');
  if (oscillators.length === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'osc-empty';
      empty.textContent = 'Click "+ Add Oscillator" to get started';
      grid.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

function _makeValEditable(slider, valEl, setter, fmt) {
  if (!valEl || !slider) return;
  valEl.classList.add('knob-value-editable');
  valEl.title = 'Click to type a value';

  function _commit(text) {

    let v = parseFloat(text);
    if (isNaN(v)) { valEl.textContent = fmt(parseFloat(slider.value)); }
    else {
      const mn = parseFloat(slider.min), mx = parseFloat(slider.max);
      const st = parseFloat(slider.step) || 0.0001;
      v = Math.round(v / st) * st;
      v = Math.max(mn, Math.min(mx, v));
      slider.value = v;
      setter(v);
      valEl.textContent = fmt(v);
    }
    valEl.contentEditable = 'false';
    valEl.classList.remove('editing');
  }

  valEl.addEventListener('click', () => {
    valEl.contentEditable = 'true';
    valEl.classList.add('editing');
    valEl.textContent = parseFloat(slider.value).toString();
    valEl.focus();
    const r = document.createRange();
    r.selectNodeContents(valEl);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });

  valEl.addEventListener('blur', () => {
    if (valEl.contentEditable === 'true') _commit(valEl.textContent);
  });

  valEl.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter')  { e.preventDefault(); valEl.blur(); }
    if (e.key === 'Escape') {
      valEl.textContent     = fmt(parseFloat(slider.value));
      valEl.contentEditable = 'false';
      valEl.classList.remove('editing');
      valEl.blur();
    }
  });
}

function wireGlobalUI() {

  document.getElementById('btn-add-osc').addEventListener('click', () => {
    Audio.ensureCtx();
    addOscillator();
  });

  function wireSlider(id, valId, setter, fmt) {
    const el  = document.getElementById(id);
    const val = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      setter(v);
      if (val) val.textContent = fmt(v);
    });
    if (val) _makeValEditable(el, val, setter, fmt);
  }

  wireSlider('master-vol',  'master-vol-val',  Audio.setMasterVolume, v => `${Math.round(v*100)}%`);
  wireSlider('filter-freq', 'filter-freq-val', Audio.setFilterFreq,   v => `${Math.round(v)} Hz`);
  wireSlider('filter-q',    'filter-q-val',    Audio.setFilterQ,      v => v.toFixed(1));
  wireSlider('reverb-mix',  'reverb-mix-val',  Audio.setReverbMix,    v => `${Math.round(v*100)}%`);
  wireSlider('reverb-size', 'reverb-size-val', Audio.setReverbSize,   v => v.toFixed(2));
  wireSlider('delay-time',  'delay-time-val',  Audio.setDelayTime,    v => `${v.toFixed(2)} s`);
  wireSlider('delay-fb',    'delay-fb-val',    Audio.setDelayFeedback,v => `${Math.round(v*100)}%`);
  wireSlider('delay-mix',   'delay-mix-val',   Audio.setDelayMix,     v => `${Math.round(v*100)}%`);

  wireSlider('env-attack',  'env-attack-val',  v => Audio.setADSR('attack', v),  v => `${v.toFixed(2)} s`);
  wireSlider('env-decay',   'env-decay-val',   v => Audio.setADSR('decay', v),   v => `${v.toFixed(2)} s`);
  wireSlider('env-sustain', 'env-sustain-val', v => Audio.setADSR('sustain', v), v => `${Math.round(v*100)}%`);
  wireSlider('env-release', 'env-release-val', v => Audio.setADSR('release', v), v => `${v.toFixed(2)} s`);

  document.getElementById('filter-type').addEventListener('change', e => {
    Audio.setFilterType(e.target.value);
    Audio.setFilterBypass(false);
  });
  document.getElementById('filter-bypass').addEventListener('change', e => {
    Audio.setFilterBypass(e.target.checked);
  });

  function rewireLFO() {
    const shape  = document.getElementById('lfo-shape').value;
    const rate   = parseFloat(document.getElementById('lfo-rate').value);
    const depth  = parseFloat(document.getElementById('lfo-depth').value);
    const target = document.getElementById('lfo-target').value;
    Audio.startLFO(shape, rate, depth * 200, target);
  }

  ['lfo-shape','lfo-rate','lfo-depth','lfo-target'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'lfo-rate')  document.getElementById('lfo-rate-val').textContent  = `${parseFloat(el.value).toFixed(2)} Hz`;
      if (id === 'lfo-depth') document.getElementById('lfo-depth-val').textContent = `${Math.round(el.value*100)}%`;
      if (Audio.isRunning()) rewireLFO();
    });
    el.addEventListener('change', () => { if (Audio.isRunning()) rewireLFO(); });
  });

  const bpmSlider = document.getElementById('master-bpm');
  const bpmNum    = document.getElementById('master-bpm-num');

  function _setBPM(val) {
    val = Math.max(40, Math.min(240, Math.round(val)));
    bpmSlider.value = val;
    bpmNum.value    = val;
    PianoRoll.setBPM(val);
  }

  bpmSlider.addEventListener('input', function () { _setBPM(parseInt(this.value, 10)); });
  bpmNum.addEventListener('change', function () { _setBPM(parseInt(this.value, 10) || 120); });
  bpmNum.addEventListener('keydown', function (e) { if (e.key === 'Enter') { this.blur(); _setBPM(parseInt(this.value, 10) || 120); } });

  let _tapTimes = [];
  document.getElementById('btn-tap-tempo').addEventListener('click', () => {
    const now = performance.now();
    _tapTimes.push(now);

    _tapTimes = _tapTimes.filter(t => now - t < 3000);
    if (_tapTimes.length >= 2) {
      const gaps = [];
      for (let i = 1; i < _tapTimes.length; i++) gaps.push(_tapTimes[i] - _tapTimes[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      _setBPM(Math.round(60000 / avg));
    }
  });

  document.getElementById('btn-export-midi').addEventListener('click', () => {
    Exporter.exportMidi(PianoRoll.getNotes(), PianoRoll.getBPM());
  });

  document.getElementById('btn-export-wav').addEventListener('click', async () => {
    const btn  = document.getElementById('btn-export-wav');
    const orig = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled    = true;
    await Exporter.exportWAV(PianoRoll.getNotes(), PianoRoll.getBPM(), status => {
      btn.textContent = status === 'Rendering…' ? '⏳' : orig;
    });
    btn.textContent = orig;
    btn.disabled    = false;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildPiano();
  wireGlobalUI();
  updateEmptyState();
  addOscillator();
  PianoRoll.init();
});

const PianoRoll = (() => {

  const MIDI_LOW  = 36;
  const MIDI_HIGH = 119;
  const NOTE_COUNT = MIDI_HIGH - MIDI_LOW + 1;

  const ROW_H     = 14;
  const BEAT_W    = 80;
  const MIN_NOTE_W = 8;

  const C_BG         = '#13161e';
  const C_BG_BLACK   = '#0e1018';
  const C_GRID_BEAT  = '#2a2f3f';
  const C_GRID_BAR   = '#3d4460';
  const C_GRID_SEMI  = 'rgba(42,47,63,0.4)';
  const C_NOTE       = '#5b8fff';
  const C_NOTE_SEL   = '#a855f7';
  const C_NOTE_EDGE  = 'rgba(255,255,255,0.18)';
  const C_HEAD       = '#f43f5e';
  const C_C_LINE     = 'rgba(91,143,255,0.18)';

  let canvas, ctx, scrollWrap;
  let bpm      = 120;
  let bars     = 4;
  let snap     = 0.5;
  let notes    = [];
  let noteIdCtr = 0;
  let isDragging = false;
  let dragNote   = null;
  let dragOffsetBeat = 0;
  let dragOffsetRow  = 0;
  let dragMode   = 'move';
  let isDrawing  = false;
  let drawNote   = null;
  let drawStartBeat = 0;
  let drawStartMidi = 0;
  let tool       = 'draw';
  let selection  = [];
  let rafId      = null;
  let playhead   = 0;
  let isPlaying  = false;
  let looping    = false;
  let followPlayhead = true;
  let hoverBeat = -1;
  let playStartTime = 0;
  let playStartBeat = 0;
  let scheduledVoices = [];
  let _schedInterval  = null;
  let _schedIdx       = 0;
  let _notesSorted    = [];
  let isSelecting = false;
  let selBox      = null;

  let staticCanvas = null;
  let staticCtx    = null;
  let staticDirty  = true;
  let _scrollSpacer = null;

  let velCanvas, velCtx, velScroll;
  let velDirty        = true;
  let velDragNote     = null;
  let velDragStartY   = 0;
  let velDragStartVal = 0;
  const VEL_H_MIN = 72;
  let   VEL_H      = VEL_H_MIN;

  let inspectorNote = null;
  let _insp = {};

  const SCALES = {
    'none':             null,
    'major':            [0, 2, 4, 5, 7, 9, 11],
    'minor':            [0, 2, 3, 5, 7, 8, 10],
    'harmonic-minor':   [0, 2, 3, 5, 7, 8, 11],
    'pentatonic-major': [0, 2, 4, 7, 9],
    'pentatonic-minor': [0, 3, 5, 7, 10],
    'blues':            [0, 3, 5, 6, 7, 10],
    'dorian':           [0, 2, 3, 5, 7, 9, 10],
    'phrygian':         [0, 1, 3, 5, 7, 8, 10],
    'lydian':           [0, 2, 4, 6, 7, 9, 11],
    'mixolydian':       [0, 2, 4, 5, 7, 9, 10],
  };
  let scaleRoot = 0;
  let scaleName = 'none';

  function isInScale(midi) {
    const intervals = SCALES[scaleName];
    if (!intervals) return true;
    return intervals.includes(((midi - scaleRoot) % 12 + 12) % 12);
  }

  function nearestInScale(midi) {
    if (isInScale(midi)) return midi;
    for (let d = 1; d <= 6; d++) {
      if (midi + d <= MIDI_HIGH && isInScale(midi + d)) return midi + d;
      if (midi - d >= MIDI_LOW  && isInScale(midi - d)) return midi - d;
    }
    return midi;
  }

  function _updateLabelScaleStyles() {
    document.querySelectorAll('.pr-key-label').forEach(el => {
      const m = parseInt(el.dataset.midi, 10);
      el.classList.toggle('out-of-scale', !isInScale(m));
    });
  }

  const NOTE_NAMES_ALL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function midiName(midi) {
    const oct  = Math.floor(midi / 12) - 1;
    const name = NOTE_NAMES_ALL[midi % 12];
    return `${name}${oct}`;
  }
  function isBlackKey(midi) {
    return [1,3,6,8,10].includes(midi % 12);
  }

  function totalBeats()  { return bars * 4; }
  function canvasW()     { return totalBeats() * BEAT_W; }
  function canvasH()     { return NOTE_COUNT * ROW_H; }
  function midiToY(midi) { return (MIDI_HIGH - midi) * ROW_H; }
  function yToMidi(y)    { return MIDI_HIGH - Math.floor(y / ROW_H); }
  function beatToX(b)    { return b * BEAT_W; }
  function xToBeat(x)    { return x / BEAT_W; }
  function snapBeat(b)   { return Math.round(b / snap) * snap; }

  function init() {
    canvas     = document.getElementById('pr-canvas');
    ctx        = canvas.getContext('2d');
    scrollWrap = document.getElementById('pr-scroll-wrap');

    _buildLabels();
    resize();
    _bindEvents();
    _syncScrollLabels();
    _initVelCanvas();

    const drawToolBtn   = document.getElementById('pr-tool-draw');
    const selectToolBtn = document.getElementById('pr-tool-select');
    function _setTool(t) {
      tool = t;
      drawToolBtn.classList.toggle('pr-active', t === 'draw');
      selectToolBtn.classList.toggle('pr-active', t === 'select');
      canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
    }
    drawToolBtn.addEventListener('click',   () => _setTool('draw'));
    selectToolBtn.addEventListener('click', () => _setTool('select'));

    document.getElementById('pr-snap').addEventListener('change', e => {
      snap = parseFloat(e.target.value);
    });
    document.getElementById('pr-bars').addEventListener('change', e => {
      bars = parseInt(e.target.value, 10);
      resize();
    });

    const playBtn = document.getElementById('pr-play');
    playBtn.addEventListener('click', () => { if (isPlaying) stop(); else play(); });
    document.getElementById('pr-clear').addEventListener('click', () => {
      notes = []; selection = []; draw();
    });
    const loopBtn = document.getElementById('pr-loop');
    loopBtn.addEventListener('click', () => {
      looping = !looping;
      loopBtn.classList.toggle('pr-active', looping);
    });

    const followBtn = document.getElementById('pr-follow');
    if (followBtn) {
      followBtn.classList.toggle('pr-active', followPlayhead);
      followBtn.addEventListener('click', () => {
        followPlayhead = !followPlayhead;
        followBtn.classList.toggle('pr-active', followPlayhead);
      });
    }

    document.getElementById('pr-root').addEventListener('change', e => {
      scaleRoot = parseInt(e.target.value, 10);
      _updateLabelScaleStyles();
      draw();
    });
    document.getElementById('pr-scale').addEventListener('change', e => {
      scaleName = e.target.value;
      _updateLabelScaleStyles();
      draw();
    });

    document.addEventListener('keydown', _onRollKey);
    _initInspector();

    _renderLoop();
  }

  function _initInspector() {
    _insp = {
      bar:      document.getElementById('pr-inspector'),
      count:    document.getElementById('pr-insp-count'),
      noteName: document.getElementById('pr-insp-note-name'),
      midi:     document.getElementById('pr-insp-midi'),
      beat:     document.getElementById('pr-insp-beat'),
      dur:      document.getElementById('pr-insp-dur'),
      vel:      document.getElementById('pr-insp-vel'),
    };
    if (!_insp.bar) return;

    function _refNote() {
      return (inspectorNote && selection.includes(inspectorNote.id))
        ? inspectorNote
        : notes.find(n => selection.includes(n.id));
    }

    _insp.midi.addEventListener('change', () => {
      const v   = parseInt(_insp.midi.value, 10);
      const ref = _refNote();
      if (!ref || isNaN(v)) return;
      const delta = v - ref.midi;
      notes.filter(n => selection.includes(n.id)).forEach(n => {
        n.midi = Math.max(MIDI_LOW, Math.min(MIDI_HIGH, n.midi + delta));
      });
      _updateInspector(); draw();
    });

    _insp.beat.addEventListener('change', () => {
      const v   = parseFloat(_insp.beat.value);
      const ref = _refNote();
      if (!ref || isNaN(v)) return;
      const delta = v - ref.beat;
      notes.filter(n => selection.includes(n.id)).forEach(n => {
        n.beat = Math.max(0, Math.min(totalBeats() - n.dur, n.beat + delta));
      });
      _updateInspector(); draw();
    });

    _insp.dur.addEventListener('change', () => {
      const v = parseFloat(_insp.dur.value);
      if (isNaN(v) || v <= 0) return;
      notes.filter(n => selection.includes(n.id)).forEach(n => {
        n.dur = Math.max(snap, Math.min(v, totalBeats() - n.beat));
      });
      _updateInspector(); draw();
    });

    _insp.vel.addEventListener('change', () => {
      const v = parseInt(_insp.vel.value, 10);
      if (isNaN(v)) return;
      notes.filter(n => selection.includes(n.id)).forEach(n => {
        n.vel = Math.max(1, Math.min(127, v));
      });
      _updateInspector(); _drawVel();
    });
  }

  function _updateInspector() {
    if (!_insp.bar) return;
    const sel = notes.filter(n => selection.includes(n.id));
    if (!sel.length) { _insp.bar.style.display = 'none'; return; }
    _insp.bar.style.display = 'flex';

    const ref = (inspectorNote && selection.includes(inspectorNote.id)) ? inspectorNote : sel[0];
    _insp.count.textContent = sel.length === 1 ? '1 note' : `${sel.length} notes`;

    const name = NOTE_NAMES[ref.midi % 12] + (Math.floor(ref.midi / 12) - 1);
    _insp.noteName.textContent = name;
    _insp.midi.value = ref.midi;
    _insp.beat.value = ref.beat.toFixed(3);

    const allSameDur = sel.every(n => n.dur === ref.dur);
    _insp.dur.value       = (allSameDur ? ref.dur : sel[0].dur).toFixed(3);
    _insp.dur.placeholder = allSameDur ? '' : 'multi';

    const allSameVel = sel.every(n => (n.vel ?? 100) === (ref.vel ?? 100));
    _insp.vel.value       = allSameVel ? (ref.vel ?? 100) : (sel[0].vel ?? 100);
    _insp.vel.placeholder = allSameVel ? '' : 'multi';
  }

  function _buildLabels() {
    const col = document.getElementById('pr-labels');
    col.innerHTML = '';
    for (let midi = MIDI_HIGH; midi >= MIDI_LOW; midi--) {
      const div = document.createElement('div');
      div.className = 'pr-key-label' +
        (isBlackKey(midi) ? ' is-black' : '') +
        (midi % 12 === 0  ? ' is-c'    : '');
      div.style.height = ROW_H + 'px';
      div.textContent  = midi % 12 === 0 ? midiName(midi) : (isBlackKey(midi) ? '♯' : '');
      div.dataset.midi = midi;

      div.addEventListener('pointerdown', e => {
        e.preventDefault();
        Audio.start();
        const key = `pr-label-${midi}`;
        noteOn(key, midiToFreq(midi));
        div.classList.add('active');
        const up = () => { noteOff(key); div.classList.remove('active'); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointerup', up);
      });
      col.appendChild(div);
    }
  }

  function _syncScrollLabels() {
    const col = document.getElementById('pr-labels');
    scrollWrap.addEventListener('scroll', () => {
      col.scrollTop = scrollWrap.scrollTop;

      staticDirty = true;
      velDirty    = true;
      if (!isPlaying) draw();

    });

    col.style.overflowY = 'hidden';
  }

  function resize() {
    if (!canvas) return;
    const dpr   = window.devicePixelRatio || 1;

    const viewW = Math.max(1, scrollWrap.clientWidth);
    canvas.width  = viewW * dpr;
    canvas.height = canvasH() * dpr;
    canvas.style.width  = viewW + 'px';
    canvas.style.height = canvasH() + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!_scrollSpacer) {
      _scrollSpacer = document.createElement('div');
      _scrollSpacer.id = 'pr-scroll-spacer';
      _scrollSpacer.style.cssText =
        'position:absolute;top:0;left:0;pointer-events:none;z-index:-1;';
      scrollWrap.appendChild(_scrollSpacer);
    }
    _scrollSpacer.style.width  = canvasW() + 'px';
    _scrollSpacer.style.height = canvasH() + 'px';

    const panelEl     = canvas.closest('.panel-pianoroll');
    const headerEl    = panelEl && panelEl.querySelector('.panel-header');
    const velRowEl    = document.querySelector('.pr-vel-row');
    const prContainer = canvas.closest('.pr-container');
    if (panelEl && headerEl && velRowEl && prContainer) {
      const available = panelEl.clientHeight - headerEl.offsetHeight;
      const prH       = Math.min(canvasH(), Math.max(1, available - VEL_H_MIN));
      prContainer.style.maxHeight = prH + 'px';
      velRowEl.style.height       = Math.max(VEL_H_MIN, available - prH) + 'px';
    }

    staticDirty = true;
    velDirty    = true;
    _resizeVelCanvas();
    draw();
  }

  function _drawStatic() {
    staticDirty = false;
    const dpr   = window.devicePixelRatio || 1;
    const scrollX = scrollWrap ? scrollWrap.scrollLeft : 0;
    const viewW = canvas ? canvas.width / dpr : canvasW();
    const H     = canvasH();

    if (!staticCanvas || staticCanvas.width !== viewW * dpr || staticCanvas.height !== H * dpr) {
      if (typeof OffscreenCanvas !== 'undefined') {
        staticCanvas = new OffscreenCanvas(viewW * dpr, H * dpr);
      } else {
        staticCanvas = document.createElement('canvas');
        staticCanvas.width  = viewW * dpr;
        staticCanvas.height = H * dpr;
      }
      staticCtx = staticCanvas.getContext('2d');
      staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const sc = staticCtx;
    sc.clearRect(0, 0, viewW, H);

    sc.save();
    sc.translate(-scrollX, 0);

    const beatFirst = Math.max(0,            Math.floor(xToBeat(scrollX - BEAT_W) / snap) * snap);
    const beatLast  = Math.min(totalBeats(), Math.ceil( xToBeat(scrollX + viewW + BEAT_W) / snap) * snap);

    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      const y = midiToY(midi);
      sc.fillStyle = isBlackKey(midi) ? C_BG_BLACK : C_BG;
      sc.fillRect(scrollX, y, viewW, ROW_H);
      if (!isInScale(midi)) {
        sc.fillStyle = 'rgba(244,63,94,0.10)';
        sc.fillRect(scrollX, y, viewW, ROW_H);
      }
      if (midi % 12 === 0) {
        sc.fillStyle = C_C_LINE;
        sc.fillRect(scrollX, y, viewW, 1);
      }
    }

    for (let b = beatFirst; b <= beatLast; b += snap) {
      const x      = beatToX(b);
      const isBar  = b % 4 === 0;
      const isBeat = b % 1 === 0;
      sc.strokeStyle = isBar ? C_GRID_BAR : (isBeat ? C_GRID_BEAT : C_GRID_SEMI);
      sc.lineWidth   = isBar ? 1.5 : 1;
      sc.beginPath();
      sc.moveTo(x, 0); sc.lineTo(x, H);
      sc.stroke();
    }

    sc.font      = '10px system-ui';
    sc.fillStyle = '#3d4460';
    const barFirst = Math.max(0,    Math.floor(scrollX / (BEAT_W * 4)));
    const barLast  = Math.min(bars, Math.ceil( (scrollX + viewW) / (BEAT_W * 4)) + 1);
    for (let bar = barFirst; bar < barLast; bar++) {
      sc.fillText(`${bar + 1}`, beatToX(bar * 4) + 4, 10);
    }

    const visNotes = notes.filter(n => {
      const nx = beatToX(n.beat);
      const nw = Math.max(MIN_NOTE_W, beatToX(n.dur));
      return nx + nw > scrollX - 4 && nx < scrollX + viewW + 4;
    });
    visNotes.forEach(n => _drawNote(sc, n));

    sc.restore();
  }

  function draw() {
    if (!ctx) return;
    staticDirty = true;
    velDirty    = true;
    _drawStatic();

    _drawVel();
  }

  function _drawNote(sc, n) {
    const x = beatToX(n.beat);
    const y = midiToY(n.midi);
    const w = Math.max(MIN_NOTE_W, beatToX(n.dur) - 1);
    const h = ROW_H - 1;
    const sel = selection.includes(n.id);

    if (sel) {
      sc.fillStyle = 'rgba(168,85,247,0.5)';
      sc.fillRect(x - 1, y, w + 2, ROW_H);
    }

    sc.fillStyle = sel ? C_NOTE_SEL : C_NOTE;
    sc.beginPath();
    if (sc.roundRect) {
      sc.roundRect(x, y + 1, w, h, 3);
    } else {
      sc.rect(x, y + 1, w, h);
    }
    sc.fill();

    sc.fillStyle = C_NOTE_EDGE;
    sc.fillRect(x + 1, y + 1, w - 2, 2);

    sc.fillStyle = 'rgba(255,255,255,0.25)';
    sc.fillRect(x + w - 5, y + 2, 4, h - 4);

    if (n.bendCurve) {
      sc.fillStyle = '#f59e0b';
      sc.fillRect(x + 1, y + h - 1, w - 2, 2);
    }
  }

  function _renderLoop() {
    rafId = requestAnimationFrame(_renderLoop);
    const dpr    = window.devicePixelRatio || 1;
    const viewW  = canvas ? canvas.width / dpr : 0;
    const H      = canvasH();
    const scrollX = scrollWrap ? scrollWrap.scrollLeft : 0;

    if (isPlaying) {
      const ctx2 = Audio.getCtx();
      if (ctx2) {
        const elapsed = ctx2.currentTime - playStartTime;
        const beatsPerSec = bpm / 60;
        playhead = playStartBeat + elapsed * beatsPerSec;
        const total = totalBeats();
        if (playhead >= total) {
          if (looping) {
            if (_schedInterval) { clearInterval(_schedInterval); _schedInterval = null; }
            playStartTime = ctx2.currentTime;
            playStartBeat = 0;
            playhead = 0;
            _scheduleNotes();
          } else {
            stop();
            return;
          }
        }

        if (followPlayhead) {
          const targetScrollX = beatToX(playhead) - viewW * 0.30;
          const newScrollX = Math.max(0, targetScrollX);
          if (Math.abs(newScrollX - scrollX) > 1) {
            scrollWrap.scrollLeft = newScrollX;
            staticDirty = true;
          }
        }
      }
    }

    if (!ctx || !staticCanvas) return;
    const drawScrollX = scrollWrap ? scrollWrap.scrollLeft : 0;
    if (staticDirty) _drawStatic();
    ctx.drawImage(staticCanvas, 0, 0, viewW, H);

    if (hoverBeat >= 0 && !isPlaying) {
      const hx = beatToX(hoverBeat) - drawScrollX;
      if (hx >= 0 && hx <= viewW) {
        ctx.save();
        ctx.strokeStyle = 'rgba(244,63,94,0.35)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, 0); ctx.lineTo(hx, H);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (isPlaying || playhead > 0) {
      const px = beatToX(playhead) - drawScrollX;
      ctx.strokeStyle = C_HEAD;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0); ctx.lineTo(px, H);
      ctx.stroke();
    }

    if (selBox) {
      const bx = Math.min(selBox.x1, selBox.x2) - drawScrollX;
      const by = Math.min(selBox.y1, selBox.y2);
      const bw = Math.abs(selBox.x2 - selBox.x1);
      const bh = Math.abs(selBox.y2 - selBox.y1);
      ctx.save();
      ctx.fillStyle   = 'rgba(168,85,247,0.10)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.setLineDash([4, 3]);
      ctx.lineWidth   = 1;
      ctx.strokeStyle = 'rgba(168,85,247,0.85)';
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

    _drawVel();
  }

  function play() {
    Audio.start();
    const ac = Audio.getCtx();
    if (!ac) return;
    playStartTime = ac.currentTime;
    playStartBeat = playhead;
    isPlaying = true;

    if (followPlayhead) {
      const viewW = scrollWrap ? scrollWrap.clientWidth : 0;
      scrollWrap.scrollLeft = Math.max(0, beatToX(playhead) - viewW * 0.30);
      staticDirty = true;
    }
    _scheduleNotes();
    const btn = document.getElementById('pr-play');
    if (btn) { btn.innerHTML = '&#9646; Stop'; btn.classList.add('pr-active'); }
  }

  function stop() {
    isPlaying = false;
    if (_schedInterval) { clearInterval(_schedInterval); _schedInterval = null; }
    scheduledVoices.forEach(v => { try { v.stop(); } catch (_) {} });
    scheduledVoices = [];
    playhead = 0;
    const btn = document.getElementById('pr-play');
    if (btn) { btn.innerHTML = '&#9654; Play'; btn.classList.remove('pr-active'); }
    draw();
  }

  function setBPM(val) { bpm = val; }

  const LOOKAHEAD_SEC = 0.4;
  const SCHED_TICK_MS = 40;

  function _schedLoop() {
    const ac = Audio.getCtx();
    if (!ac || !isPlaying) return;

    const now         = ac.currentTime;
    const horizon     = now + LOOKAHEAD_SEC;
    const beatsPerSec = bpm / 60;
    const hasSolo     = oscillators.some(o => o.settings.solo);

    scheduledVoices = scheduledVoices.filter(v => v.endTime > now - 0.2);

    while (_schedIdx < _notesSorted.length) {
      const n        = _notesSorted[_schedIdx];
      const startSec = playStartTime + (n.beat - playStartBeat) / beatsPerSec;

      if (startSec > horizon) break;
      if (startSec < now - 0.05) { _schedIdx++; continue; }

      const durSec = Math.max(0.03, n.dur / beatsPerSec);
      const endSec = startSec + durSec;
      const velGain = (n.vel ?? 100) / 127;

      oscillators.forEach(osc => {
        if (osc.settings.muted) return;
        if (hasSolo && !osc.settings.solo) return;

        const freq  = midiToFreq(n.midi) * Math.pow(2, osc.settings.octave);

        let bendCurveSec = null;
        if (n.bendCurve) {
          bendCurveSec = n.bendCurve.map(pt => ({
            time:  startSec + pt.offsetBeats / beatsPerSec,
            cents: pt.cents
          }));
        }

        const voice = Audio.createVoice(osc.settings, freq, startSec, endSec, bendCurveSec);

        const vg   = voice.voiceGain;
        const peak = (osc.settings.gain ?? 0.5) * velGain;

        vg.gain.setValueAtTime(0, startSec);
        vg.gain.linearRampToValueAtTime(peak, startSec + Math.min(0.005, durSec * 0.1));
        vg.gain.setValueAtTime(peak, endSec - Math.min(0.03, durSec * 0.15));
        vg.gain.linearRampToValueAtTime(0, endSec);

        voice.endTime = endSec;
        scheduledVoices.push(voice);
      });

      _schedIdx++;
    }
  }

  function _scheduleNotes() {

    scheduledVoices.forEach(v => { try { v.stop(); } catch (_) {} });
    scheduledVoices = [];
    if (_schedInterval) { clearInterval(_schedInterval); _schedInterval = null; }

    const ac = Audio.getCtx();
    if (!ac) return;

    _notesSorted = notes
      .filter(n => n.beat >= playStartBeat - 0.001)
      .sort((a, b) => a.beat - b.beat);
    _schedIdx = 0;

    _schedLoop();
    _schedInterval = setInterval(_schedLoop, SCHED_TICK_MS);
  }

  function _initVelCanvas() {
    velCanvas = document.getElementById('pr-vel-canvas');
    velCtx    = velCanvas.getContext('2d');
    velScroll = document.getElementById('pr-vel-scroll');

    scrollWrap.addEventListener('scroll', () => {
      velScroll.scrollLeft = scrollWrap.scrollLeft;
    });
    velScroll.addEventListener('scroll', () => {
      scrollWrap.scrollLeft = velScroll.scrollLeft;
    });

    _resizeVelCanvas();

    velCanvas.addEventListener('pointerdown', _onVelPointerDown);
    velCanvas.addEventListener('pointermove', _onVelPointerMove);
    velCanvas.addEventListener('pointerup',   _onVelPointerUp);
    velCanvas.addEventListener('pointercancel', _onVelPointerUp);
  }

  function _resizeVelCanvas() {
    if (!velCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w   = canvasW();
    VEL_H = velScroll.clientHeight || VEL_H_MIN;
    velCanvas.width        = w * dpr;
    velCanvas.height       = VEL_H * dpr;
    velCanvas.style.width  = w + 'px';
    velCanvas.style.height = VEL_H + 'px';
    velCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _drawVel();
  }

  function _drawVel() {
    if (!velCtx || !velDirty) return;
    velDirty = false;
    const W = canvasW();
    velCtx.clearRect(0, 0, W, VEL_H);

    velCtx.fillStyle = '#0e1018';
    velCtx.fillRect(0, 0, W, VEL_H);

    velCtx.strokeStyle = 'rgba(42,47,63,0.6)';
    velCtx.lineWidth   = 1;
    [0.25, 0.5, 0.75].forEach(pct => {
      const y = VEL_H - pct * (VEL_H - 4);
      velCtx.beginPath(); velCtx.moveTo(0, y); velCtx.lineTo(W, y); velCtx.stroke();
    });

    notes.forEach(n => {
      const vel     = (n.vel ?? 100);
      const barH    = Math.max(3, Math.round((vel / 127) * (VEL_H - 4)));
      const x       = beatToX(n.beat);
      const barW    = Math.max(4, Math.round(beatToX(n.dur) * 0.72));
      const y       = VEL_H - barH;
      const isSel   = selection.includes(n.id);

      const grad = velCtx.createLinearGradient(0, y, 0, VEL_H);
      if (isSel) {
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(1, '#7e22ce');
      } else {
        grad.addColorStop(0, '#5b8fff');
        grad.addColorStop(1, '#1e3a8a');
      }
      velCtx.fillStyle = grad;
      velCtx.beginPath();
      if (velCtx.roundRect) velCtx.roundRect(x + 1, y, barW, barH, [2, 2, 0, 0]);
      else velCtx.rect(x + 1, y, barW, barH);
      velCtx.fill();

      velCtx.fillStyle = isSel ? '#e9d5ff' : '#93c5fd';
      velCtx.fillRect(x + 1, y, barW, 2);
    });
  }

  function _velNoteAt(x) {
    const beat = xToBeat(x);

    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (beat >= n.beat && beat < n.beat + n.dur) return n;
    }
    return null;
  }

  function _onVelPointerDown(e) {
    e.preventDefault();
    velCanvas.setPointerCapture(e.pointerId);
    const rect = velCanvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const n    = _velNoteAt(x);
    if (!n) return;
    velDragNote     = n;
    velDragStartY   = e.clientY;
    velDragStartVal = n.vel ?? 100;

    if (!selection.includes(n.id)) { selection = [n.id]; draw(); }
  }

  function _onVelPointerMove(e) {
    if (!velDragNote) return;
    e.preventDefault();
    const dy  = velDragStartY - e.clientY;
    const dv  = Math.round(dy * (127 / (VEL_H - 4)));
    const newV = Math.max(1, Math.min(127, velDragStartVal + dv));

    const toEdit = selection.includes(velDragNote.id)
      ? notes.filter(n => selection.includes(n.id))
      : [velDragNote];
    const delta = newV - (velDragNote.vel ?? 100);
    toEdit.forEach(n => { n.vel = Math.max(1, Math.min(127, (n.vel ?? 100) + delta)); });
    velDragNote.vel = newV;
    velDirty = true;
    _drawVel();
  }

  function _onVelPointerUp() {
    velDragNote = null;
  }

  function _bindEvents() {
    canvas.addEventListener('pointerdown',   _onPointerDown);
    canvas.addEventListener('pointermove',   _onPointerMove);
    canvas.addEventListener('pointerup',     _onPointerUp);
    canvas.addEventListener('pointercancel', _onPointerUp);
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const { x, y } = _eventPos(e);
      const hit = _noteAt(x, y);
      if (hit) {

        notes = notes.filter(n => n.id !== hit.id);
        selection = selection.filter(id => id !== hit.id);
        draw();
      } else {

        _seekTo(Math.max(0, Math.min(snapBeat(xToBeat(x)), totalBeats())));
      }
    });

    canvas.addEventListener('mousemove', e => {
      const { x } = _eventPos(e);
      hoverBeat = Math.max(0, xToBeat(x));
    });
    canvas.addEventListener('mouseleave', () => { hoverBeat = -1; });
  }

  function _eventPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {

      x: e.clientX - rect.left + (scrollWrap ? scrollWrap.scrollLeft : 0),
      y: e.clientY - rect.top,
    };
  }

  function _noteAt(x, y) {
    const beat = xToBeat(x);
    const midi = yToMidi(y);

    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.midi === midi && beat >= n.beat && beat <= n.beat + n.dur) return n;
    }
    return null;
  }

  function _isResizeHandle(x, n) {
    const nx = beatToX(n.beat);
    const nw = Math.max(MIN_NOTE_W, beatToX(n.dur) - 1);
    return x > nx + nw - 6;
  }

  function _onPointerDown(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = _eventPos(e);
    const beat = xToBeat(x);
    const midi = yToMidi(y);

    if (e.button === 1) {
      _seekTo(Math.max(0, Math.min(snapBeat(beat), totalBeats())));
      return;
    }

    if (e.button === 2) { _eraseAtEvent(e); return; }

    const hit = _noteAt(x, y);

    if (hit) {
      if (_isResizeHandle(x, hit)) {
        dragMode  = 'resize';
        dragNote  = hit;
        isDragging = true;
        canvas.style.cursor = 'ew-resize';
      } else {
        dragMode  = 'move';
        dragNote  = hit;
        dragOffsetBeat = beat - hit.beat;
        dragOffsetRow  = midi  - hit.midi;
        isDragging = true;
        canvas.style.cursor = 'grab';

        if (!e.shiftKey) selection = [hit.id];
        else if (!selection.includes(hit.id)) selection.push(hit.id);
        inspectorNote = hit;
        _updateInspector();
      }
    } else if (tool === 'select') {

      if (!e.shiftKey) selection = [];
      isSelecting = true;
      selBox = { x1: x, y1: y, x2: x, y2: y };
    } else {

      const snapped = snapBeat(beat);
      const clampMidi = nearestInScale(Math.max(MIDI_LOW, Math.min(MIDI_HIGH, midi)));
      const newNote = {
        id:   ++noteIdCtr,
        midi: clampMidi,
        beat: Math.max(0, Math.min(snapped, totalBeats() - snap)),
        dur:  snap,
        vel:  100,
        selected: false,
      };
      notes.push(newNote);
      selection  = [newNote.id];
      inspectorNote = newNote;
      isDrawing  = true;
      drawNote   = newNote;
      drawStartBeat = snapped;

      Audio.start();
      const auKey = `pr-draw-${newNote.id}`;
      noteOn(auKey, midiToFreq(clampMidi));
      setTimeout(() => noteOff(auKey), 120);
    }
    draw();
  }

  function _onPointerMove(e) {
    if (!isDragging && !isDrawing && !isSelecting) {

      const { x, y } = _eventPos(e);
      const hit = _noteAt(x, y);
      if (tool === 'select') {
        canvas.style.cursor = hit ? 'grab' : 'default';
      } else {
        if (hit) canvas.style.cursor = _isResizeHandle(x, hit) ? 'ew-resize' : 'grab';
        else     canvas.style.cursor = 'crosshair';
      }
      return;
    }
    e.preventDefault();
    const { x, y } = _eventPos(e);
    const beat = xToBeat(x);
    const midi = yToMidi(y);

    if (isSelecting && selBox) {
      selBox.x2 = x;
      selBox.y2 = y;
      draw();
      return;
    }

    if (isDrawing && drawNote) {
      const rawDur = beat - drawStartBeat;
      drawNote.dur = Math.max(snap, snapBeat(rawDur + snap));
      drawNote.dur = Math.min(drawNote.dur, totalBeats() - drawNote.beat);
      draw();
      return;
    }

    if (isDragging && dragNote) {
      if (dragMode === 'move') {
        const toMove = selection.includes(dragNote.id)
          ? notes.filter(n => selection.includes(n.id))
          : [dragNote];
        const targetBeat = snapBeat(beat - dragOffsetBeat);
        const rawMidi    = Math.max(MIDI_LOW, Math.min(MIDI_HIGH, midi - dragOffsetRow));
        const targetMidi = nearestInScale(rawMidi);
        const db = targetBeat - dragNote.beat;
        const dm = targetMidi - dragNote.midi;
        toMove.forEach(n => {
          n.beat = Math.max(0, Math.min(n.beat + db, totalBeats() - n.dur));
          n.midi = Math.max(MIDI_LOW, Math.min(MIDI_HIGH, n.midi + dm));
        });

        dragNote.beat = dragNote.beat;
      } else {
        const newDur = snapBeat(beat - dragNote.beat);
        dragNote.dur = Math.max(snap, Math.min(newDur, totalBeats() - dragNote.beat));
      }
      draw();
    }
  }

  function _onPointerUp(e) {
    if (isSelecting && selBox) {

      const bx1      = xToBeat(Math.min(selBox.x1, selBox.x2));
      const bx2      = xToBeat(Math.max(selBox.x1, selBox.x2));
      const midiHigh = yToMidi(Math.min(selBox.y1, selBox.y2));
      const midiLow  = yToMidi(Math.max(selBox.y1, selBox.y2));
      const inBox = notes.filter(n =>
        n.beat < bx2 && (n.beat + n.dur) > bx1 &&
        n.midi >= midiLow && n.midi <= midiHigh
      );
      if (e.shiftKey) {
        inBox.forEach(n => { if (!selection.includes(n.id)) selection.push(n.id); });
      } else {
        selection = inBox.map(n => n.id);
      }
      inspectorNote = notes.find(n => n.id === selection[0]) ?? null;
      _updateInspector();
      isSelecting = false;
      selBox = null;
      draw();
      return;
    }
    isDrawing  = false;
    isDragging = false;
    dragNote   = null;
    drawNote   = null;
    canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    draw();
  }

  function _eraseAtEvent(e) {
    const { x, y } = _eventPos(e);
    const hit = _noteAt(x, y);
    if (hit) {
      notes = notes.filter(n => n.id !== hit.id);
      selection = selection.filter(id => id !== hit.id);
      draw();
    } else {

      const beat = xToBeat(x);
      _seekTo(Math.max(0, Math.min(snapBeat(beat), totalBeats())));
    }
  }

  function _seekTo(beat) {
    playhead = beat;
    if (isPlaying) {

      stop();
      playhead = beat;
      play();
    } else {

      const viewW = scrollWrap.clientWidth;
      const tx = beatToX(beat) - viewW * 0.3;
      scrollWrap.scrollLeft = Math.max(0, tx);
      staticDirty = true;
      draw();
    }
  }

  let clipboard = [];

  function _onRollKey(e) {

    const tag = document.activeElement?.tagName;
    if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes(tag)) return;
    if (document.activeElement?.isContentEditable) return;

    if (document.activeElement?.closest?.('.pr-toolbar, .topbar-controls, .panel-body')) return;

    if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (isPlaying) stop(); else play();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      notes = notes.filter(n => !selection.includes(n.id));
      selection = [];
      inspectorNote = null;
      _updateInspector();
      draw();
    }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      selection = notes.map(n => n.id);
      draw();
    }

    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const sel = notes.filter(n => selection.includes(n.id));
      if (!sel.length) return;
      const earliest = Math.min(...sel.map(n => n.beat));
      clipboard = sel.map(n => ({ midi: n.midi, beat: n.beat - earliest, dur: n.dur, vel: n.vel ?? 100 }));
    }

    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const sel = notes.filter(n => selection.includes(n.id));
      if (!sel.length) return;
      const earliest = Math.min(...sel.map(n => n.beat));
      const latest   = Math.max(...sel.map(n => n.beat + n.dur));
      const offset   = latest - earliest;
      const newNotes = sel.map(n => ({ ...n, id: ++noteIdCtr, beat: n.beat + offset, vel: n.vel ?? 100 }));
      notes.push(...newNotes);
      selection = newNotes.map(n => n.id);
      draw();
    }

    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!clipboard.length) return;
      const pasteAt = notes.length
        ? Math.max(...notes.map(n => n.beat + n.dur))
        : 0;
      const newNotes = clipboard.map(c => ({
        id:   ++noteIdCtr,
        midi: Math.max(MIDI_LOW, Math.min(MIDI_HIGH, c.midi)),
        beat: Math.min(pasteAt + c.beat, totalBeats() - c.dur),
        dur:  c.dur,
        vel:  c.vel ?? 100,
      }));
      notes.push(...newNotes);
      selection = newNotes.map(n => n.id);
      draw();
    }

    if (e.key === 'Escape') { selection = []; inspectorNote = null; _updateInspector(); draw(); }

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selection.length) {
      e.preventDefault();
      const sel = notes.filter(n => selection.includes(n.id));
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const dm = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
        sel.forEach(n => { n.midi = Math.max(MIDI_LOW, Math.min(MIDI_HIGH, n.midi + dm)); });
      } else {
        const db = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 4 : snap);
        sel.forEach(n => { n.beat = Math.max(0, Math.min(totalBeats() - n.dur, n.beat + db)); });
      }
      _updateInspector();
      draw();
    }
  }

  function getNotes()      { return notes;     }
  function getBPM()        { return bpm;       }
  function getBars()       { return bars;      }
  function getSnap()       { return snap;      }
  function getScaleRoot()  { return scaleRoot; }
  function getScaleName()  { return scaleName; }

  function loadNotes(newNotes) {
    notes     = newNotes.map(n => ({ midi: n.midi, beat: n.beat, dur: n.dur, vel: n.vel ?? 100, id: ++noteIdCtr }));
    selection = [];
    inspectorNote = null;
    _updateInspector();
    draw();
  }

  function setBars(val) {
    bars = parseInt(val, 10);
    const sel = document.getElementById('pr-bars');
    if (sel) {
      if (!Array.from(sel.options).some(o => parseInt(o.value, 10) === bars)) {
        const opt = document.createElement('option');
        opt.value       = bars;
        opt.textContent = `${bars} bars`;
        sel.appendChild(opt);
      }
      sel.value = bars;
    }
    resize();
  }

  function setSnap(val) {
    snap = parseFloat(val);
    const sel = document.getElementById('pr-snap');
    if (sel) sel.value = snap;
  }

  function setScale(root, name) {
    scaleRoot = parseInt(root, 10);
    scaleName = name;
    const r = document.getElementById('pr-root');
    const s = document.getElementById('pr-scale');
    if (r) r.value = scaleRoot;
    if (s) s.value = scaleName;
    _updateLabelScaleStyles();
    draw();
  }

  return { init, resize, setBPM, play, stop,
           getNotes, getBPM, getBars, getSnap, getScaleRoot, getScaleName,
           loadNotes, setBars, setSnap, setScale };

})();
