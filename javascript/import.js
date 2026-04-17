'use strict';

const Importer = (() => {

  function _vlq(data, offset) {
    let val = 0, n = 0;
    do {
      val = (val << 7) | (data[offset + n] & 0x7F);
      n++;
    } while ((data[offset + n - 1] & 0x80) && n < 4);
    return { val, n };
  }

  function _parse(buf) {
    const d   = new Uint8Array(buf);
    let   pos = 0;

    const r32 = () => {
      const v = (d[pos] << 24) | (d[pos+1] << 16) | (d[pos+2] << 8) | d[pos+3];
      pos += 4; return v >>> 0;
    };
    const r16 = () => { const v = (d[pos] << 8) | d[pos+1]; pos += 2; return v; };
    const tag = () => { const s = String.fromCharCode(d[pos],d[pos+1],d[pos+2],d[pos+3]); pos+=4; return s; };

    if (tag() !== 'MThd') throw new Error('Not a valid MIDI file (missing MThd chunk).');
    r32();
 r16();
    const numTracks = r16();
    const division  = r16();
    const TPQB = (division & 0x8000) ? 480 : division;

    let   tempo        = 500_000;
    let   hasFirstTempo = false;
    const allEvs        = [];
    const drumTracks    = new Set();
    const bendEvs       = [];
    const bendState     = {};

    const DRUM_NAME_RE = /drum|perc|kick|snare|hat|cymbal|clap|beat|kit|bongo|conga|tamb|ride|crash/i;

    for (let t = 0; t < numTracks; t++) {
      if (pos + 8 > d.length) break;

      const chunkTag = tag();
      const chunkLen = r32();
      if (chunkTag !== 'MTrk') { pos += chunkLen; continue; }

      const end   = pos + chunkLen;
      let   tick  = 0;
      let   runSt = 0;

      while (pos < end) {
        const dt = _vlq(d, pos);
        pos  += dt.n;
        tick += dt.val;

        let status = d[pos];
        if (status & 0x80) { runSt = status; pos++; }
        else               { status = runSt; }

        const evType = status & 0xF0;
        const ch     = status & 0x0F;

        if (evType === 0x90) {
          const note = d[pos++], vel = d[pos++];
          if (ch !== 9 && !drumTracks.has(t))
            allEvs.push({ tick, t, ch, note, vel, type: vel === 0 ? 'off' : 'on' });

        } else if (evType === 0x80) {
          const note = d[pos++]; pos++;
          if (ch !== 9 && !drumTracks.has(t))
            allEvs.push({ tick, t, ch, note, type: 'off' });

        } else if (evType === 0xA0 || evType === 0xB0) {
          pos += 2;

        } else if (evType === 0xE0) {
          const lsb = d[pos++], msb = d[pos++];
          const raw  = ((msb & 0x7F) << 7) | (lsb & 0x7F);
          const cents = Math.round(((raw - 8192) / 8192) * 200);
          bendState[ch] = cents;
          bendEvs.push({ tick, ch, cents });

        } else if (evType === 0xC0 || evType === 0xD0) {
          pos += 1;

        } else if (status === 0xFF) {
          const mt = d[pos++];
          const ml = _vlq(d, pos); pos += ml.n;
          if (mt === 0x51 && ml.val === 3) {
            if (!hasFirstTempo) { tempo = (d[pos] << 16) | (d[pos+1] << 8) | d[pos+2]; hasFirstTempo = true; }
          } else if (mt === 0x03 || mt === 0x04) {
            const name = String.fromCharCode(...d.slice(pos, pos + ml.val));
            if (DRUM_NAME_RE.test(name)) drumTracks.add(t);
          }
          pos += ml.val;
          runSt = 0;

        } else if (status === 0xF0 || status === 0xF7) {
          const sl = _vlq(d, pos); pos += sl.n + sl.val;
          runSt = 0;

        } else if (status >= 0xF8) {

        } else {
          pos++;
        }
      }
      pos = end;
    }

    allEvs.sort((a, b) => a.tick - b.tick);

    const bendByChannel = new Map();
    for (const b of bendEvs) {
      if (!bendByChannel.has(b.ch)) bendByChannel.set(b.ch, []);
      bendByChannel.get(b.ch).push(b);
    }

    const open  = {};
    const notes = [];
    const BEND_MAX_PTS = 64;

    for (const ev of allEvs) {
      const key = `${ev.t}-${ev.ch}-${ev.note}`;
      if (ev.type === 'on') {
        open[key] = ev;
      } else if (open[key]) {
        const on   = open[key];
        const beat = on.tick / TPQB;
        const dur  = Math.max(0.0625, (ev.tick - on.tick) / TPQB);
        let midi = on.note;
        while (midi < 36)  midi += 12;
        while (midi > 119) midi -= 12;

        let bendCurve = null;
        const chBends = bendByChannel.get(on.ch);
        if (chBends) {
          let initCents = 0;
          for (let i = chBends.length - 1; i >= 0; i--) {
            if (chBends[i].tick <= on.tick) { initCents = chBends[i].cents; break; }
          }
          const during = chBends.filter(b => b.tick > on.tick && b.tick <= ev.tick);
          if (initCents !== 0 || during.length > 0) {
            bendCurve = [
              { offsetBeats: 0, cents: initCents },
              ...during.map(b => ({ offsetBeats: (b.tick - on.tick) / TPQB, cents: b.cents }))
            ];
            if (bendCurve.length > BEND_MAX_PTS) {
              const stride = Math.ceil(bendCurve.length / (BEND_MAX_PTS - 1));
              const sampled = [bendCurve[0]];
              for (let i = stride; i < bendCurve.length - 1; i += stride) sampled.push(bendCurve[i]);
              sampled.push(bendCurve[bendCurve.length - 1]);
              bendCurve = sampled;
            }
          }
        }

        notes.push({ midi, beat, dur, vel: on.vel ?? 100, ...(bendCurve && { bendCurve }) });
        delete open[key];
      }
    }

    const bpm = Math.round(60_000_000 / tempo);
    return { notes, bpm };
  }

  function open() {
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = '.mid,.midi';

    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const { notes, bpm } = _parse(await file.arrayBuffer());

        if (notes.length === 0) {
          alert('No notes were found in the range C2–B8.\nThe MIDI file may be empty or contain only non-note events.');
          return;
        }

        const lastBeat  = Math.max(...notes.map(n => n.beat + n.dur));
        const totalBars = Math.ceil(lastBeat / 4);
        const fitBars   = [2, 4, 8, 16, 32, 64].find(b => b >= totalBars) ?? 64;

        PianoRoll.loadNotes(notes);
        PianoRoll.setBars(fitBars);

        const clampedBPM = Math.max(40, Math.min(240, bpm));
        const sl = document.getElementById('master-bpm');
        if (sl) { sl.value = clampedBPM; sl.dispatchEvent(new Event('input')); }

      } catch (err) {
        console.error('[Importer]', err);
        alert('Failed to import MIDI: ' + err.message);
      }
    });

    inp.click();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-import-midi')
      ?.addEventListener('click', () => open());
  });

  return { open };

})();
