'use strict';

const Exporter = (() => {


  const TICKS_PER_BEAT = 480;

  function _varLen(val) {
    const bytes = [];
    bytes.unshift(val & 0x7F);
    val >>>= 7;
    while (val > 0) {
      bytes.unshift((val & 0x7F) | 0x80);
      val >>>= 7;
    }
    return bytes;
  }

  function exportMidi(notes, bpm) {
    if (!notes || notes.length === 0) {
      alert('No notes to export — draw some notes in the piano roll first.');
      return;
    }

    const ticksPerBeat         = TICKS_PER_BEAT;
    const microsecondsPerBeat  = Math.round(60_000_000 / bpm);

    const events = [];

    events.push({ tick: 0, bytes: [
      0xFF, 0x51, 0x03,
      (microsecondsPerBeat >>> 16) & 0xFF,
      (microsecondsPerBeat >>>  8) & 0xFF,
      (microsecondsPerBeat       ) & 0xFF,
    ]});

    const name      = 'NodeOSC Export';
    const nameBytes = [0xFF, 0x03, name.length, ...name.split('').map(c => c.charCodeAt(0))];
    events.push({ tick: 0, bytes: nameBytes });

    notes.forEach(n => {
      const startTick = Math.round(n.beat        * ticksPerBeat);
      const endTick   = Math.round((n.beat + n.dur) * ticksPerBeat);
      events.push({ tick: startTick, bytes: [0x90, n.midi, n.vel ?? 100] });
      events.push({ tick: endTick,   bytes: [0x80, n.midi, 0x40] });
    });

    const lastTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
    events.push({ tick: lastTick + ticksPerBeat, bytes: [0xFF, 0x2F, 0x00] });

    events.sort((a, b) => a.tick - b.tick);

    const trackBytes = [];
    let prevTick = 0;
    events.forEach(ev => {
      const delta = ev.tick - prevTick;
      prevTick = ev.tick;
      trackBytes.push(..._varLen(delta), ...ev.bytes);
    });

    const header = [
      0x4D, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00,
      0x00, 0x01,
      (ticksPerBeat >>> 8) & 0xFF, ticksPerBeat & 0xFF,
    ];

    const tLen = trackBytes.length;
    const trackHeader = [
      0x4D, 0x54, 0x72, 0x6B,
      (tLen >>> 24) & 0xFF, (tLen >>> 16) & 0xFF,
      (tLen >>>  8) & 0xFF, (tLen       ) & 0xFF,
    ];

    const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
    _download(fileBytes, 'nodeosc-melody.mid', 'audio/midi');
  }


  function _makeIR(offCtx, duration) {
    const len = Math.floor(offCtx.sampleRate * duration);
    const ir  = offCtx.createBuffer(2, len, offCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    return ir;
  }

  function _buildWAV(audioBuffer) {
    const numCh      = audioBuffer.numberOfChannels;
    const numSamples = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const byteRate   = sampleRate * numCh * 4;
    const dataLen    = numSamples * numCh * 4;

    const buf  = new ArrayBuffer(44 + dataLen);
    const view = new DataView(buf);

    const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

    str(0,  'RIFF');  view.setUint32( 4, 36 + dataLen, true);
    str(8,  'WAVE');
    str(12, 'fmt ');  view.setUint32(16, 16, true);
    view.setUint16(20, 3,          true);
    view.setUint16(22, numCh,      true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate,   true);
    view.setUint16(32, numCh * 4,  true);
    view.setUint16(34, 32,         true);
    str(36, 'data');  view.setUint32(40, dataLen, true);

    const channels = [];
    for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numCh; c++) {
        view.setFloat32(off, channels[c][i], true);
        off += 4;
      }
    }
    return new Uint8Array(buf);
  }

  function _dom(id, fallback) {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : fallback;
  }
  function _domStr(id, fallback) {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  }

  async function exportWAV(notes, bpm, statusCallback) {
    if (!notes || notes.length === 0) {
      alert('No notes to export — draw some notes in the piano roll first.');
      return;
    }

    statusCallback?.('Rendering…');

    try {
      const beatsPerSec = bpm / 60;
      const lastBeat    = Math.max(...notes.map(n => n.beat + n.dur));
      const releaseSec  = _dom('env-release', 0.3);
      const totalSecs   = (lastBeat / beatsPerSec) + releaseSec + 0.8;
      const sampleRate  = 48000;

      const offCtx = new OfflineAudioContext(2, Math.ceil(totalSecs * sampleRate), sampleRate);

      const masterGain = offCtx.createGain();
      masterGain.gain.value = _dom('master-vol', 0.7);

      const filter     = offCtx.createBiquadFilter();
      const bypassed   = document.getElementById('filter-bypass')?.checked ?? false;
      filter.type             = bypassed ? 'allpass' : _domStr('filter-type', 'lowpass');
      filter.frequency.value  = _dom('filter-freq', 8000);
      filter.Q.value          = _dom('filter-q', 1);

      const delayNode = offCtx.createDelay(2.0);
      delayNode.delayTime.value = _dom('delay-time', 0.25);
      const delayFB  = offCtx.createGain(); delayFB.gain.value  = _dom('delay-fb',  0.3);
      const delayWet = offCtx.createGain(); delayWet.gain.value = _dom('delay-mix', 0.2);
      delayNode.connect(delayFB);
      delayFB.connect(delayNode);
      delayNode.connect(delayWet);

      const reverbMix  = _dom('reverb-mix',  0.15);
      const convolver  = offCtx.createConvolver();
      convolver.buffer = _makeIR(offCtx, _dom('reverb-size', 1.5));
      const reverbWet  = offCtx.createGain(); reverbWet.gain.value  = reverbMix;
      const reverbDry  = offCtx.createGain(); reverbDry.gain.value  = 1 - reverbMix * 0.5;

      masterGain.connect(filter);
      filter.connect(delayNode);
      filter.connect(convolver);
      filter.connect(reverbDry);
      convolver.connect(reverbWet);
      reverbDry.connect(offCtx.destination);
      reverbWet.connect(offCtx.destination);
      delayWet.connect(offCtx.destination);

      const adsr    = Audio.adsr;
      const oscList = (typeof oscillators !== 'undefined' && oscillators.length > 0)
        ? oscillators
        : [{ settings: { type: 'sine', gain: 0.5, detune: 0, octave: 0, unison: 1, unisonSpread: 0, muted: false } }];

      notes.forEach(note => {
        const startSec = note.beat / beatsPerSec;
        const durSec   = note.dur  / beatsPerSec;
        const stopSec  = startSec + durSec + adsr.release + 0.1;

        oscList.forEach(osc => {
          if (osc.settings.muted) return;
          const freq  = midiToFreq(note.midi) * Math.pow(2, osc.settings.octave);
          const uCnt  = Math.max(1, Math.min(7, osc.settings.unison  || 1));
          const uSprd = (osc.settings.unisonSpread || 0) * 100;

          const vg = offCtx.createGain();
          vg.gain.setValueAtTime(0, startSec);
          vg.gain.linearRampToValueAtTime(osc.settings.gain,                      startSec + adsr.attack);
          vg.gain.linearRampToValueAtTime(osc.settings.gain * adsr.sustain,       startSec + adsr.attack + adsr.decay);
          vg.gain.setValueAtTime         (osc.settings.gain * adsr.sustain,       startSec + durSec);
          vg.gain.linearRampToValueAtTime(0,                                       startSec + durSec + adsr.release);
          vg.connect(masterGain);

          for (let i = 0; i < uCnt; i++) {
            const v = offCtx.createOscillator();
            if (osc.settings.type === 'custom' && osc.settings.customWave) {
              const pw = Audio.makePeriodicWave(osc.settings.customWave);
              v.setPeriodicWave(pw);
            } else {
              v.type = osc.settings.type || 'sine';
            }
            v.frequency.value = freq;
            const detOff = uCnt === 1 ? 0 : (i / (uCnt - 1) - 0.5) * uSprd * 2;
            v.detune.value = (osc.settings.detune || 0) * 100 + detOff;
            const uvg = offCtx.createGain();
            uvg.gain.value = 1 / uCnt;
            v.connect(uvg);
            uvg.connect(vg);
            v.start(startSec);
            v.stop(stopSec);
          }
        });
      });

      const rendered = await offCtx.startRendering();
      const wavBytes = _buildWAV(rendered);
      _download(wavBytes, 'nodeosc-export-32f.wav', 'audio/wav');
      statusCallback?.('Done');
    } catch (err) {
      console.error('WAV export failed:', err);
      statusCallback?.('Error');
      alert('Export failed: ' + err.message);
    }
  }


  function _download(bytes, filename, mimeType) {
    const blob = new Blob([bytes], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  return { exportMidi, exportWAV };

})();
