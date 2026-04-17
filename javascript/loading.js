(function () {
  const MESSAGES = [
    'initialising audio engine…',
    'warming up oscillators…',
    'tuning 440 Hz reference tone…',
    'spooling up the delay line…',
    'generating impulse response…',
    'calibrating reverb tails…',
    'building the filter bank…',
    'loading all the frequencies (yes, all of them)…',
    'untangling the audio graph…',
    'negotiating with AudioContext…',
    'convincing the browser to make noise…',
    'connecting to the vibe…',
    'calculating sick beats…',
    'synthesising waveform tables…',
    'allocating sample buffers…',
    'constructing the piano roll…',
    'painting 84 piano keys…',
    'wiring up MIDI decoder…',
    'compiling oscillator card templates…',
    'bootstrapping the lookahead scheduler…',
    'aligning tempo grid to BPM…',
    'seeding velocity lane…',
    'grafting unison voices…',
    'injecting pink noise for warmth…',
    'measuring the speed of sound (343 m/s)…',
    'converting MIDI to frequencies via 12-TET…',
    'pre-baking DFT coefficients…',
    'smoothing the analyser curves…',
    'rendering waveform previews…',
    'loading scale snapshots…',
    'setting sustain pedal to true…',
    'defragmenting the sample memory…',
    'overclocking the virtual CPU…',
    'checking if the bass is too loud (it is)…',
    'adding unnecessary but cool particles…',
    'teaching the browser to feel rhythm…',
    'making sure the low-pass doesn\'t clip…',
    'asking the reverb to please be shorter…',
    'the delay line said no…',
    'scheduling phantom notes for vibes…',
    'crossing the Nyquist boundary…',
    'patching the mod matrix…',
    'applying subtle compression (not really)…',
    'almost done, we promise…',
    'seriously almost there…',
    'one more second…',
    'tuning the final oscillator…',
  ];

  let msgIdx = 0;

  const overlay = document.createElement('div');
  overlay.id = 'nosc-loader';

  overlay.innerHTML = `
    <style>
      #nosc-loader {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: #0d0f14;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        color: #dde1ec;
        overflow: hidden;
        transition: opacity 0.55s ease, visibility 0.55s ease;
      }
      #nosc-loader.fade-out {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      /* ── Animated waveform bars ── */
      .nosc-wave {
        display: flex;
        align-items: flex-end;
        gap: 5px;
        height: 52px;
        margin-bottom: 28px;
      }
      .nosc-wave span {
        display: block;
        width: 5px;
        border-radius: 3px 3px 0 0;
        background: #5b8fff;
        animation: nosc-bounce 1.1s ease-in-out infinite;
        transform-origin: bottom;
      }
      .nosc-wave span:nth-child(1)  { height: 18px; animation-delay: 0.0s;  background: #5b8fff; }
      .nosc-wave span:nth-child(2)  { height: 36px; animation-delay: 0.1s;  background: #6b9bff; }
      .nosc-wave span:nth-child(3)  { height: 52px; animation-delay: 0.2s;  background: #a855f7; }
      .nosc-wave span:nth-child(4)  { height: 30px; animation-delay: 0.3s;  background: #a855f7; }
      .nosc-wave span:nth-child(5)  { height: 44px; animation-delay: 0.4s;  background: #22d3a0; }
      .nosc-wave span:nth-child(6)  { height: 22px; animation-delay: 0.5s;  background: #22d3a0; }
      .nosc-wave span:nth-child(7)  { height: 48px; animation-delay: 0.35s; background: #5b8fff; }
      .nosc-wave span:nth-child(8)  { height: 28px; animation-delay: 0.15s; background: #6b9bff; }
      .nosc-wave span:nth-child(9)  { height: 40px; animation-delay: 0.45s; background: #a855f7; }
      .nosc-wave span:nth-child(10) { height: 16px; animation-delay: 0.05s; background: #5b8fff; }
      .nosc-wave span:nth-child(11) { height: 34px; animation-delay: 0.25s; background: #22d3a0; }
      .nosc-wave span:nth-child(12) { height: 50px; animation-delay: 0.55s; background: #a855f7; }
      .nosc-wave span:nth-child(13) { height: 24px; animation-delay: 0.08s; background: #f43f5e; }
      .nosc-wave span:nth-child(14) { height: 42px; animation-delay: 0.32s; background: #5b8fff; }
      .nosc-wave span:nth-child(15) { height: 14px; animation-delay: 0.48s; background: #22d3a0; }
      .nosc-wave span:nth-child(16) { height: 38px; animation-delay: 0.18s; background: #a855f7; }

      @keyframes nosc-bounce {
        0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
        50%       { transform: scaleY(1);    opacity: 1;    }
      }

      /* ── App title ── */
      .nosc-title {
        font-size: clamp(1.6rem, 4vw, 2.6rem);
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 6px;
        background: linear-gradient(90deg, #5b8fff 0%, #a855f7 50%, #22d3a0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        position: relative;
        animation: nosc-glitch 7s steps(1) infinite;
      }
      @keyframes nosc-glitch {
        0%,  94%, 100% { text-shadow: none; filter: none; }
        95% {
          text-shadow: -2px 0 #f43f5e, 2px 0 #22d3a0;
          filter: blur(0.4px);
          letter-spacing: 0.12em;
        }
        96% { text-shadow: 2px 0 #a855f7; letter-spacing: 0.02em; }
        97% { text-shadow: none; filter: none; }
        98% { text-shadow: -1px 0 #5b8fff; }
      }
      .nosc-sub {
        font-size: 0.78rem;
        color: #7a82a0;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 40px;
      }
      .nosc-version {
        font-size: 0.65rem;
        color: #3a4155;
        letter-spacing: 0.12em;
        margin-top: -34px;
        margin-bottom: 34px;
      }

      /* ── Progress bar ── */
      .nosc-bar-wrap {
        width: min(340px, 80vw);
        height: 3px;
        background: #1e2230;
        border-radius: 99px;
        overflow: hidden;
        margin-bottom: 22px;
      }
      .nosc-bar-fill {
        height: 100%;
        width: 0%;
        border-radius: 99px;
        background: linear-gradient(90deg, #5b8fff, #a855f7, #22d3a0);
        transition: width 0.35s ease;
      }

      /* ── Status message ── */
      .nosc-msg {
        font-size: 0.82rem;
        color: #7a82a0;
        min-height: 1.2em;
        letter-spacing: 0.04em;
        transition: opacity 0.25s ease;
      }
      .nosc-msg.flash {
        opacity: 0;
      }

      /* ── Background grid ── */
      .nosc-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(91,143,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(91,143,255,0.04) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
        animation: nosc-grid-drift 8s linear infinite;
      }
      @keyframes nosc-grid-drift {
        from { background-position: 0 0; }
        to   { background-position: 40px 40px; }
      }

      /* ── Floating particles ── */
      .nosc-particles {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .nosc-p {
        position: absolute;
        border-radius: 50%;
        opacity: 0;
        animation: nosc-float linear infinite;
      }
      @keyframes nosc-float {
        0%   { transform: translateY(100vh) scale(0);   opacity: 0; }
        10%  { opacity: 0.6; }
        90%  { opacity: 0.3; }
        100% { transform: translateY(-20vh)  scale(1.2); opacity: 0; }
      }
    </style>

    <div class="nosc-grid"></div>
    <div class="nosc-particles" id="nosc-particles"></div>

    <div class="nosc-wave">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>

    <div class="nosc-title">NodeOSC</div>
    <div class="nosc-sub">Oscillator Workstation</div>
    <div class="nosc-version">WebAudio · Canvas · MIDI</div>

    <div class="nosc-bar-wrap">
      <div class="nosc-bar-fill" id="nosc-bar"></div>
    </div>
    <div class="nosc-msg" id="nosc-msg">initialising…</div>
  `;

  function _attach() {
    if (document.body) {
      document.body.prepend(overlay);
      _spawnParticles();
    } else {
      new MutationObserver((_, obs) => {
        if (document.body) {
          obs.disconnect();
          document.body.prepend(overlay);
          _spawnParticles();
        }
      }).observe(document.documentElement, { childList: true });
    }
  }
  _attach();

  function _spawnParticles() {
    const container = document.getElementById('nosc-particles');
    if (!container) return;
    const COLORS = ['#5b8fff', '#a855f7', '#22d3a0', '#f43f5e'];
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'nosc-p';
      const size = 3 + Math.random() * 5;
      p.style.cssText = [
        `width:${size}px`, `height:${size}px`,
        `left:${Math.random() * 100}%`,
        `background:${COLORS[Math.floor(Math.random() * COLORS.length)]}`,
        `animation-duration:${4 + Math.random() * 6}s`,
        `animation-delay:${Math.random() * 5}s`,
      ].join(';');
      container.appendChild(p);
    }
  }

  const barEl = () => document.getElementById('nosc-bar');
  const msgEl = () => document.getElementById('nosc-msg');

  function _setProgress(pct) {
    const b = barEl();
    if (b) b.style.width = pct + '%';
  }

  function _setMsg(txt) {
    const m = msgEl();
    if (!m) return;
    m.classList.add('flash');
    setTimeout(() => { m.textContent = txt; m.classList.remove('flash'); }, 150);
  }

  function _nextMsg() {
    _setMsg(MESSAGES[msgIdx % MESSAGES.length]);
    msgIdx++;
  }

  const MIN_DISPLAY_MS = 5500;
  let   _loadStart     = Date.now();

  function _dismiss() {
    const elapsed  = Date.now() - _loadStart;
    const waitMore = Math.max(0, MIN_DISPLAY_MS - elapsed);
    setTimeout(() => {
      _setProgress(100);
      _setMsg('ready ✓');
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 700);
      }, 450);
    }, waitMore);
  }

  let _ready          = false;
  let _audioPreloaded = false;

  function _checkDone() {
    if (_ready && _audioPreloaded) _dismiss();
  }

  _setProgress(5);
  _nextMsg();

  let _fakeProgress = 5;
  const _progressTimer = setInterval(() => {
    if (_fakeProgress < 88) {
      _fakeProgress += (88 - _fakeProgress) * 0.06;
      _setProgress(_fakeProgress);
    } else {
      clearInterval(_progressTimer);
    }
  }, 80);

  let _msgTimer = setInterval(() => {
    if (_ready && _audioPreloaded) { clearInterval(_msgTimer); return; }
    _nextMsg();
  }, 620);

  function _preloadAudio() {
    if (_audioPreloaded) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { _audioPreloaded = true; _checkDone(); return; }

      if (typeof Audio !== 'undefined' && Audio.getCtx && Audio.getCtx()) {
        Audio.getCtx().resume().catch(() => {});
        _audioPreloaded = true;
        _setProgress(80);
        _checkDone();
        return;
      }

      const probe = new AC();
      const osc   = probe.createOscillator();
      const gain  = probe.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(probe.destination);
      osc.start();
      osc.stop(probe.currentTime + 0.001);
      const _resumeTimeout = new Promise(res => setTimeout(res, 2000));
      Promise.race([probe.resume(), _resumeTimeout]).then(() => {
        try { osc.disconnect(); gain.disconnect(); probe.close(); } catch (_) {}
        _audioPreloaded = true;
        _setProgress(80);
        _checkDone();
      }).catch(() => {
        _audioPreloaded = true;
        _setProgress(80);
        _checkDone();
      });
    } catch (_) {
      _audioPreloaded = true;
      _checkDone();
    }
  }

  _preloadAudio();
  const _gestureEvents = ['pointerdown', 'keydown', 'touchstart'];
  function _onGesture() {
    _gestureEvents.forEach(ev => document.removeEventListener(ev, _onGesture));
    _preloadAudio();
    if (typeof Audio !== 'undefined' && Audio.ensureCtx) {
      try { Audio.ensureCtx(); } catch (_) {}
    }
  }
  _gestureEvents.forEach(ev => document.addEventListener(ev, _onGesture, { once: false, passive: true }));

  _setProgress(20);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      _setProgress(60);
      _nextMsg();
      setTimeout(() => {
        _setProgress(90);
        _ready = true;
        _checkDone();
      }, 1800);
    });
  } else {
    _setProgress(90);
    _ready = true;
    _checkDone();
  }

  setTimeout(() => {
    if (!_audioPreloaded || !_ready) {
      _audioPreloaded = true;
      _ready = true;
      _checkDone();
    }
  }, 8000);

  window.NoscLoader = { dismiss: _dismiss };

})();
