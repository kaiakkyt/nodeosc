/* =====================================================
   NodeOSC — Visualizer  (processing.js)
   Waveform, Spectrum, and Lissajous modes on <canvas>
   ===================================================== */

'use strict';

const Viz = (() => {

  let canvas, ctx2d;
  let mode = 'waveform';
  let rafId = null;

  /* ---- Reusable typed-array buffers (allocated lazily, reused every frame) ---- */
  let _waveData  = null;  // Float32Array for waveform
  let _freqData  = null;  // Uint8Array   for spectrum
  let _lissData1 = null;  // Float32Array for lissajous ch1
  let _lissData2 = null;  // Float32Array for lissajous ch2

  /* Palette */
  const C_BG      = '#0d0f14';
  const C_GRID    = 'rgba(42,47,63,0.55)';
  const C_WAVE    = '#5b8fff';
  const C_WAVE2   = '#a855f7';
  const C_SPEC_LO = '#22d3a0';
  const C_SPEC_HI = '#f43f5e';

  function init() {
    canvas = document.getElementById('viz-canvas');
    if (!canvas) return;
    ctx2d  = canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);

    /* Mode buttons */
    document.querySelectorAll('.viz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    _loop();
  }

  /* ---- Resize ---- */
  function _resize() {
    if (!canvas) return;
    // Match CSS pixel size exactly for crisp rendering
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width)  * (window.devicePixelRatio || 1);
    canvas.height = Math.floor(rect.height) * (window.devicePixelRatio || 1);
    canvas.style.height = Math.floor(rect.height) + 'px';
  }

  /* ---- RAF loop ---- */
  function _loop() {
    rafId = requestAnimationFrame(_loop);
    if (!canvas || !ctx2d) return;

    const { analyserNode, analyserNode2 } = Audio.getAnalysers();
    if (!analyserNode) {
      _drawIdle();
      return;
    }

    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    switch (mode) {
      case 'waveform':  _drawWaveform(analyserNode);    break;
      case 'spectrum':  _drawSpectrum(analyserNode);    break;
      case 'lissajous': _drawLissajous(analyserNode, analyserNode2); break;
    }
  }

  /* ---- Idle (no context yet) ---- */
  function _drawIdle() {
    const w = canvas.width, h = canvas.height;
    ctx2d.fillStyle = C_BG;
    ctx2d.fillRect(0, 0, w, h);
    ctx2d.strokeStyle = C_GRID;
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();
    ctx2d.fillStyle = 'rgba(122,130,160,0.4)';
    ctx2d.font = `${14 * (window.devicePixelRatio || 1)}px system-ui`;
    ctx2d.textAlign = 'center';
    ctx2d.fillText('Press Start and play a note', w / 2, h / 2 - 8 * (window.devicePixelRatio || 1));
  }

  /* ---- Waveform ---- */
  function _drawWaveform(analyser) {
    const w = canvas.width, h = canvas.height;
    const bufLen = analyser.fftSize;
    if (!_waveData || _waveData.length !== bufLen) _waveData = new Float32Array(bufLen);
    const data = _waveData;
    analyser.getFloatTimeDomainData(data);

    ctx2d.fillStyle = C_BG;
    ctx2d.fillRect(0, 0, w, h);

    // Grid lines
    ctx2d.strokeStyle = C_GRID;
    ctx2d.lineWidth = 1;
    for (let g = 0.25; g < 1; g += 0.25) {
      ctx2d.beginPath();
      ctx2d.moveTo(0,     Math.floor(h * g));
      ctx2d.lineTo(w,     Math.floor(h * g));
      ctx2d.stroke();
    }

    // Waveform
    ctx2d.strokeStyle = C_WAVE;
    ctx2d.lineWidth   = 2 * (window.devicePixelRatio || 1);
    ctx2d.shadowColor = C_WAVE;
    ctx2d.shadowBlur  = 6 * (window.devicePixelRatio || 1);
    ctx2d.beginPath();

    const sliceW = w / bufLen;
    for (let i = 0; i < bufLen; i++) {
      const x = i * sliceW;
      const y = (1 - (data[i] * 0.5 + 0.5)) * h;
      if (i === 0) ctx2d.moveTo(x, y);
      else         ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
  }

  /* ---- Spectrum ---- */
  function _drawSpectrum(analyser) {
    const w = canvas.width, h = canvas.height;
    const bufLen = analyser.frequencyBinCount;
    if (!_freqData || _freqData.length !== bufLen) _freqData = new Uint8Array(bufLen);
    const data = _freqData;
    analyser.getByteFrequencyData(data);

    ctx2d.fillStyle = C_BG;
    ctx2d.fillRect(0, 0, w, h);

    // Grid
    ctx2d.strokeStyle = C_GRID;
    ctx2d.lineWidth = 1;
    for (let g = 0.25; g < 1; g += 0.25) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, Math.floor(h * g)); ctx2d.lineTo(w, Math.floor(h * g));
      ctx2d.stroke();
    }

    const barW  = Math.max(1, (w / bufLen) * 2.5);
    const step  = Math.max(1, Math.floor(bufLen / (w / barW)));

    for (let i = 0; i < bufLen; i += step) {
      const t   = i / bufLen;       // 0–1 position
      const mag = data[i] / 255;
      const barH = mag * h;
      const x   = t * w;

      // Colour gradient from green (lo) to red (hi)
      const r = Math.round(34  + (244 - 34)  * mag);
      const g2= Math.round(211 + (63  - 211) * mag);
      const b = Math.round(160 + (94  - 160) * mag);
      ctx2d.fillStyle = `rgb(${r},${g2},${b})`;

      ctx2d.shadowColor = ctx2d.fillStyle;
      ctx2d.shadowBlur  = 4 * (window.devicePixelRatio || 1);
      ctx2d.fillRect(x, h - barH, barW, barH);
    }
    ctx2d.shadowBlur = 0;
  }

  /* ---- Lissajous (X-Y phase) ---- */
  function _drawLissajous(a1, a2) {
    const w = canvas.width, h = canvas.height;
    const half = Math.min(w, h) / 2;

    const bufLen = a1.fftSize;
    if (!_lissData1 || _lissData1.length !== bufLen) {
      _lissData1 = new Float32Array(bufLen);
      _lissData2 = new Float32Array(bufLen);
    }
    const ch1 = _lissData1, ch2 = _lissData2;
    a1.getFloatTimeDomainData(ch1);
    a2.getFloatTimeDomainData(ch2);

    // Fade tail
    ctx2d.fillStyle = 'rgba(13,15,20,0.25)';
    ctx2d.fillRect(0, 0, w, h);

    ctx2d.strokeStyle = C_WAVE2;
    ctx2d.lineWidth   = 1.5 * (window.devicePixelRatio || 1);
    ctx2d.shadowColor = C_WAVE2;
    ctx2d.shadowBlur  = 8  * (window.devicePixelRatio || 1);
    ctx2d.beginPath();

    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < bufLen; i++) {
      const x = cx + ch1[i] * half * 0.9;
      const y = cy + ch2[i] * half * 0.9;
      if (i === 0) ctx2d.moveTo(x, y);
      else         ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
  }

  /* ---- Canvas height: follow panel ---- */
  function _setCanvasHeight() {
    // Let the canvas be proportional (16:5 ratio, ~3× visualizer panel)
    if (!canvas) return;
    const vizPanel = document.getElementById('panel-viz');
    if (!vizPanel) return;
    const headerH = vizPanel.querySelector('.panel-header')?.offsetHeight || 34;
    const available = vizPanel.clientHeight - headerH;
    canvas.style.height = Math.max(80, available) + 'px';
    _resize();
  }

  window.addEventListener('resize', () => {
    _setCanvasHeight();
    _resize();
  });

  /* ---- Public ---- */
  return { init };

})();

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to let layout settle so getBoundingClientRect is accurate
  requestAnimationFrame(() => {
    Viz.init();
    // Force canvas to fill its panel
    const canvas = document.getElementById('viz-canvas');
    if (canvas) {
      canvas.style.height = '140px';
      const rect = canvas.getBoundingClientRect();
      canvas.width  = Math.floor(rect.width)  * (window.devicePixelRatio || 1);
      canvas.height = Math.floor(rect.height) * (window.devicePixelRatio || 1);
    }
  });
});
