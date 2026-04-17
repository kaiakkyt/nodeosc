/* =====================================================
   NodeOSC — Project Save / Load  (save.js)
   Serialises the full session to a .noscproj file
   (JSON) and restores it — oscillators, FX chain,
   ADSR, LFO, and piano roll notes.
   ===================================================== */

'use strict';

const ProjectSave = (() => {

  const FORMAT_VERSION = 1;

  /* ---- DOM helpers ---- */
  const $v = (id, fb = 0)     => { const e = document.getElementById(id); return e ? parseFloat(e.value) : fb; };
  const $s = (id, fb = '')    => { const e = document.getElementById(id); return e ? e.value             : fb; };
  const $b = (id, fb = false) => { const e = document.getElementById(id); return e ? e.checked           : fb; };

  /* ---- Collect the entire project into a plain object ---- */
  function _collect() {
    return {
      version: FORMAT_VERSION,
      pianoRoll: {
        bpm:       PianoRoll.getBPM(),
        bars:      PianoRoll.getBars(),
        snap:      PianoRoll.getSnap(),
        scaleRoot: PianoRoll.getScaleRoot(),
        scaleName: PianoRoll.getScaleName(),
        /* strip internal IDs — regenerated on load */
        notes: PianoRoll.getNotes().map(n => ({ midi: n.midi, beat: n.beat, dur: n.dur })),
      },
      oscillators: oscillators.map(o => ({ ...o.settings })),
      master:  { vol:    $v('master-vol',   0.7) },
      filter:  { type:   $s('filter-type',  'lowpass'),
                 freq:   $v('filter-freq',  8000),
                 q:      $v('filter-q',     1),
                 bypass: $b('filter-bypass', false) },
      reverb:  { mix:    $v('reverb-mix',  0.15),
                 size:   $v('reverb-size', 1.5)  },
      delay:   { time:   $v('delay-time',  0.25),
                 fb:     $v('delay-fb',    0.3),
                 mix:    $v('delay-mix',   0.2)  },
      adsr:    { attack:  $v('env-attack',  0.01),
                 decay:   $v('env-decay',   0.1),
                 sustain: $v('env-sustain', 0.7),
                 release: $v('env-release', 0.3) },
      lfo:     { shape:  $s('lfo-shape',  'sine'),
                 rate:   $v('lfo-rate',   1),
                 depth:  $v('lfo-depth',  0),
                 target: $s('lfo-target', 'frequency') },
    };
  }

  /* ====================================================
     SAVE
     ==================================================== */
  function save() {
    const json  = JSON.stringify(_collect(), null, 2);
    const bytes = new TextEncoder().encode(json);
    const blob  = new Blob([bytes], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = 'project.noscproj';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }

  /* ====================================================
     LOAD helpers
     Dispatch DOM events so the existing audio wiring
     (wireGlobalUI) picks up each value automatically.
     ==================================================== */
  function _slider(id, val) {
    const e = document.getElementById(id);
    if (!e) return;
    e.value = val;
    e.dispatchEvent(new Event('input'));
  }
  function _select(id, val) {
    const e = document.getElementById(id);
    if (!e) return;
    e.value = val;
    e.dispatchEvent(new Event('change'));
  }
  function _check(id, val) {
    const e = document.getElementById(id);
    if (!e) return;
    e.checked = !!val;
    e.dispatchEvent(new Event('change'));
  }

  /* ---- Apply a parsed project object to the app ---- */
  function _apply(data) {
    /* Master */
    if (data.master)  _slider('master-vol', data.master.vol);

    /* Filter */
    if (data.filter) {
      _select('filter-type',   data.filter.type);
      _slider('filter-freq',   data.filter.freq);
      _slider('filter-q',      data.filter.q);
      _check ('filter-bypass', data.filter.bypass);
    }

    /* Reverb */
    if (data.reverb) {
      _slider('reverb-mix',  data.reverb.mix);
      _slider('reverb-size', data.reverb.size);
    }

    /* Delay */
    if (data.delay) {
      _slider('delay-time', data.delay.time);
      _slider('delay-fb',   data.delay.fb);
      _slider('delay-mix',  data.delay.mix);
    }

    /* ADSR */
    if (data.adsr) {
      _slider('env-attack',  data.adsr.attack);
      _slider('env-decay',   data.adsr.decay);
      _slider('env-sustain', data.adsr.sustain);
      _slider('env-release', data.adsr.release);
    }

    /* LFO */
    if (data.lfo) {
      _select('lfo-shape',  data.lfo.shape);
      _slider('lfo-rate',   data.lfo.rate);
      _slider('lfo-depth',  data.lfo.depth);
      _select('lfo-target', data.lfo.target);
    }

    /* Oscillators — remove all existing, recreate from saved settings */
    if (Array.isArray(data.oscillators)) {
      [...oscillators].forEach(o => removeOscillator(o.id));
      data.oscillators.forEach(s => addOscillatorWithSettings(s));
      if (oscillators.length === 0) addOscillator();   // always keep at least one
    }

    /* Piano Roll */
    if (data.pianoRoll) {
      const pr = data.pianoRoll;
      PianoRoll.setScale(pr.scaleRoot ?? 0, pr.scaleName ?? 'none');
      PianoRoll.setSnap(pr.snap ?? 0.5);
      PianoRoll.setBars(pr.bars ?? 4);
      PianoRoll.loadNotes(pr.notes ?? []);

      /* BPM through DOM slider so the slider + number input + PianoRoll all sync */
      const bpm = Math.max(40, Math.min(240, pr.bpm ?? 120));
      const sl  = document.getElementById('master-bpm');
      if (sl) { sl.value = bpm; sl.dispatchEvent(new Event('input')); }
    }
  }

  /* ====================================================
     LOAD — open file picker
     ==================================================== */
  function load() {
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = '.noscproj';
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.version !== FORMAT_VERSION) {
          if (!confirm(`This project was saved with format v${data.version ?? '?'}.\nLoad anyway?`)) return;
        }
        _apply(data);
      } catch (err) {
        console.error('[ProjectSave]', err);
        alert('Failed to load project: ' + err.message);
      }
    });
    inp.click();
  }

  /* ---- Wire buttons after DOM ready ---- */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-save-project')
      ?.addEventListener('click', () => save());
    document.getElementById('btn-load-project')
      ?.addEventListener('click', () => load());
  });

  return { save, load };

})();
