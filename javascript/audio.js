'use strict';

const Audio = (() => {

  let ctx = null;
  let running = false;

  let masterGain, filterNode, delayNode, delayFeedback, delayWet,
      convolverNode, reverbWet, reverbDry, analyserNode, analyserNode2;

  let lfoNode = null;
  let lfoGain = null;

  const adsr = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 };

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    _buildChain();
  }

  function _buildChain() {
    masterGain   = ctx.createGain();
    masterGain.gain.value = 0.7;

    filterNode   = ctx.createBiquadFilter();
    filterNode.type      = 'lowpass';
    filterNode.frequency.value = 8000;
    filterNode.Q.value   = 1;

    delayNode    = ctx.createDelay(2.0);
    delayNode.delayTime.value = 0.25;
    delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3;
    delayWet     = ctx.createGain();
    delayWet.gain.value = 0.2;
    const delayDry = ctx.createGain();
    delayDry.gain.value = 1;

    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);

    convolverNode = ctx.createConvolver();
    convolverNode.buffer = _makeIR(1.5);
    reverbWet    = ctx.createGain();
    reverbWet.gain.value = 0.15;
    reverbDry    = ctx.createGain();
    reverbDry.gain.value = 1;

    analyserNode  = ctx.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.82;
    analyserNode2 = ctx.createAnalyser();
    analyserNode2.fftSize = 2048;

    const dest = ctx.destination;

    masterGain.connect(filterNode);
    filterNode.connect(delayNode);
    filterNode.connect(reverbDry);
    filterNode.connect(convolverNode);
    convolverNode.connect(reverbWet);
    reverbDry.connect(analyserNode);
    reverbWet.connect(analyserNode);
    delayWet.connect(analyserNode);
    analyserNode.connect(analyserNode2);
    analyserNode2.connect(dest);
  }

  function _makeIR(duration) {
    const rate    = ctx.sampleRate;
    const length  = rate * duration;
    const ir      = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    return ir;
  }

  function setReverbSize(size) {
    if (!ctx) return;
    convolverNode.buffer = _makeIR(size);
  }

  function makePeriodicWave(waveData) {
    ensureCtx();
    const N = waveData.length;
    const H = Math.min(Math.floor(N / 2), 2048);
    const real = new Float32Array(H + 1);
    const imag = new Float32Array(H + 1);
    for (let k = 1; k <= H; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const a = (2 * Math.PI * k * n) / N;
        re += waveData[n] * Math.cos(a);
        im -= waveData[n] * Math.sin(a);
      }
      real[k] = (2 / N) * re;
      imag[k] = (2 / N) * im;
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  function createVoice(oscSettings, frequency, startTime, endTime, bendCurveSec) {
    ensureCtx();
    const now         = ctx.currentTime;
    const isScheduled = startTime !== undefined;
    const t0          = isScheduled ? Math.max(startTime, now) : now;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;

    let periodicWave = null;
    if (oscSettings.type === 'custom' && oscSettings.customWave) {
      if (oscSettings._pwSource === oscSettings.customWave && oscSettings._periodicWave) {
        periodicWave = oscSettings._periodicWave;
      } else {
        periodicWave = makePeriodicWave(oscSettings.customWave);
        oscSettings._periodicWave = periodicWave;
        oscSettings._pwSource     = oscSettings.customWave;
      }
    }

    const unisonCount  = Math.max(1, Math.min(7, oscSettings.unison || 1));
    const unisonSpread = (oscSettings.unisonSpread || 0) * 100;
    const baseType     = periodicWave ? 'sine' : (oscSettings.type || 'sine');
    const detuneCents  = (oscSettings.detune || 0) * 100;

    const voices = [];
    for (let i = 0; i < unisonCount; i++) {
      const v = ctx.createOscillator();
      if (periodicWave) v.setPeriodicWave(periodicWave); else v.type = baseType;
      v.frequency.value = frequency;
      const offset = unisonCount === 1 ? 0 :
        (i / (unisonCount - 1) - 0.5) * unisonSpread * 2;

      if (bendCurveSec && bendCurveSec.length) {
        v.detune.setValueAtTime(detuneCents + offset + bendCurveSec[0].cents, t0);
        for (let bi = 1; bi < bendCurveSec.length; bi++) {
          const pt = bendCurveSec[bi];
          if (pt.time >= t0) v.detune.linearRampToValueAtTime(detuneCents + offset + pt.cents, pt.time);
        }
      } else {
        v.detune.value = detuneCents + offset;
      }
      const vGain = ctx.createGain();
      vGain.gain.value = 1 / unisonCount;
      v.connect(vGain);
      vGain.connect(voiceGain);
      v.start(t0);
      if (endTime !== undefined) {
        try { v.stop(endTime + 0.15); } catch (_) {}
      }
      voices.push({ osc: v, gain: vGain });
    }

    voiceGain.connect(masterGain);

    if (!isScheduled) {
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setValueAtTime(0, now);
      voiceGain.gain.linearRampToValueAtTime(oscSettings.gain, now + adsr.attack);
      voiceGain.gain.linearRampToValueAtTime(
        oscSettings.gain * adsr.sustain,
        now + adsr.attack + adsr.decay
      );
    }

    return {
      voices,
      voiceGain,
      frequency,
      oscSettings,
      endTime: endTime ?? Infinity,
      stop(t) {
        const rel = t || ctx.currentTime;
        const isLive = endTime === undefined || endTime === Infinity;
        if (isLive) {
          voiceGain.gain.cancelScheduledValues(rel);
          voiceGain.gain.setValueAtTime(voiceGain.gain.value, rel);
          voiceGain.gain.linearRampToValueAtTime(0, rel + adsr.release);
        }
        voices.forEach(v => {
          try { v.osc.stop(isLive ? rel + adsr.release + 0.05 : rel + 0.02); } catch (_) {}
        });
        setTimeout(() => {
          try { voiceGain.disconnect(); } catch (_) {}
        }, (isLive ? adsr.release + 0.15 : 0.1) * 1000);
      }
    };
  }

  function startLFO(shape, rate, depth, target) {
    stopLFO();
    if (!ctx || depth === 0) return;
    lfoNode = ctx.createOscillator();
    lfoNode.type = shape;
    lfoNode.frequency.value = rate;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = depth;

    if (target === 'frequency') {
    } else if (target === 'gain') {
      lfoGain.connect(masterGain.gain);
    } else if (target === 'filter') {
      lfoGain.connect(filterNode.frequency);
    }

    lfoNode.connect(lfoGain);
    lfoNode.start();
  }

  function stopLFO() {
    if (lfoNode) { try { lfoNode.stop(); } catch (_) {} lfoNode = null; }
    if (lfoGain) { try { lfoGain.disconnect(); } catch (_) {} lfoGain = null; }
  }

  function getAnalysers() { return { analyserNode, analyserNode2 }; }
  function getCtx()       { return ctx; }
  function getLFOGain()   { return lfoGain; }

  function start() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
  }
  function stop() {
    running = false;
  }
  function isRunning() { return running; }

  function setMasterVolume(v) {
    if (!masterGain) return;
    masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
  }
  function setFilterType(t) {
    if (!filterNode) return;
    filterNode.type = t;
  }
  function setFilterFreq(f) {
    if (!filterNode) return;
    filterNode.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
  }
  function setFilterQ(q) {
    if (!filterNode) return;
    filterNode.Q.setTargetAtTime(q, ctx.currentTime, 0.02);
  }
  function setFilterBypass(bypass) {
    if (!filterNode) return;
    if (bypass) {
      filterNode.frequency.setTargetAtTime(ctx.sampleRate / 2, ctx.currentTime, 0.02);
    }
  }
  function setDelayTime(t) {
    if (!delayNode) return;
    delayNode.delayTime.setTargetAtTime(t, ctx.currentTime, 0.02);
  }
  function setDelayFeedback(f) {
    if (!delayFeedback) return;
    delayFeedback.gain.setTargetAtTime(f, ctx.currentTime, 0.02);
  }
  function setDelayMix(m) {
    if (!delayWet) return;
    delayWet.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
  }
  function setReverbMix(m) {
    if (!reverbWet) return;
    reverbWet.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
    reverbDry.gain.setTargetAtTime(1 - m * 0.5, ctx.currentTime, 0.02);
  }
  function setADSR(key, val) {
    adsr[key] = val;
  }

  return {
    ensureCtx, start, stop, isRunning,
    createVoice, makePeriodicWave,
    startLFO, stopLFO, getLFOGain, getCtx, getAnalysers,
    setMasterVolume, setFilterType, setFilterFreq, setFilterQ, setFilterBypass,
    setDelayTime, setDelayFeedback, setDelayMix,
    setReverbMix, setReverbSize,
    setADSR, adsr,
  };

})();
