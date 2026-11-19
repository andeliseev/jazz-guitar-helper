// Jazz Guitar Helper: the page. State, rendering, the mouse and keyboard, Settings.
// Music theory is in theory.js, drawing the fretboards in fretboard.js. docs/ui.md describes it.

import {
  DEFAULT_BEATS,
  DROPS,
  KEYS,
  LENGTHS,
  PRESETS,
  SCALES,
  STRING_NAMES,
  chordName,
  chordNotes,
  chordScale,
  chordSymbol,
  chordTones,
  fretText,
  inversionName,
  lengthName,
  notesOnNeck,
  parseChord,
  parseChords,
  presetChords,
  presetKey,
  scaleChoices,
  scaleName,
  scaleNotes,
  scaleOnNeck,
  staffStep,
  suggestChords,
  voiceLead,
  voicings,
} from './theory.js';
import { boardHeight, boardMarkup, geometry, notesMarkup } from './fretboard.js';
import { staffMarkup } from './staff.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Chord colors .c0 to .c7 in styles.css, by the chord's place in the progression.
const COLORS = 8;
const FRET_CHOICES = [12, 15, 17, 20, 22, 24];
// Pixels between strings, which is how tall the boards are. Each view keeps its own, set with
// Height in the toolbar: a board per chord is shorter than the one board for all of them.
const GAPS = { stacked: 20, overlay: 32 };
const GAP_RANGE = [16, 44];
const BPM_RANGE = [40, 240];
// A row of fret numbers over or under the boards: none, the frets with inlays, or every fret.
const NUMBER_ROWS = ['off', 'inlays', 'all'];
const MAX_DOT_RADIUS = 14;
const SAVE_DELAY_MS = 300;
const TOAST_MS = 6000;
// A press on a chord's row that moves further than this, in px, drags the row.
const DRAG_START = 4;
// Asking GitHub for a newer release: a little after launch, then this often while the app runs;
// opening Settings always asks too.
const FIRST_UPDATE_CHECK_MS = 10 * 1000;
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
const CHORD_HELP = 'Try symbols like Dm7, G7, Cmaj7, Bø or E♭°7.';

const tauri = window.__TAURI__;
const IS_MAC = navigator.userAgent.includes('Macintosh');
const IS_WINDOWS = navigator.userAgent.includes('Windows');

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mod = (n, m) => ((n % m) + m) % m;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Saving

// In the app, Rust keeps the state in settings.json in the app data folder and sets the window's
// theme. In a plain browser, for trying the page (docs/development.md), it's kept in localStorage
// and the theme changes only the page.
const backend = tauri
  ? {
      load: () => tauri.core.invoke('load_state'),
      saveUi: (ui) => tauri.core.invoke('save_ui', { ui }),
      setTheme: (theme) => tauri.core.invoke('set_theme', { theme }),
      openLink: (url) => tauri.core.invoke('open_external', { url }),
      checkUpdate: () => tauri.core.invoke('check_update'),
      installUpdate: () => tauri.core.invoke('install_update'),
      version: () => tauri.app.getVersion(),
    }
  : {
      load: async () => ({ theme: readLocal('theme') || 'system', ui: JSON.parse(readLocal('ui') || 'null') }),
      saveUi: async (ui) => writeLocal('ui', JSON.stringify(ui)),
      setTheme: async (theme) => writeLocal('theme', theme),
      openLink: async (url) => window.open(url, '_blank', 'noopener'),
      // A page in a browser has nothing to update.
      checkUpdate: async () => null,
      installUpdate: async () => {},
      version: async () => 'in a browser',
    };

function readLocal(key) {
  try {
    return localStorage.getItem(`jazz-guitar-helper.${key}`);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(`jazz-guitar-helper.${key}`, value);
  } catch {
    // Private windows may refuse; the page still works for this visit.
  }
}

// State

/** What the page saves: the progression, what's chosen, and the fretboard settings. */
function defaultUi() {
  return {
    chords: presetChords('ii-V-I', 'C').map((chord, i) => ({ ...chord, id: i + 1 })),
    nextId: 4,
    // The name of the preset loaded last, offered when saving (Save).
    title: 'ii–V–I in C',
    // My presets: { id, name, chords } with the chords as the progression keeps them, minus ids.
    saved: [],
    nextPresetId: 1,
    key: 'C',
    // What the boards show: `voicings` of the drop type, or every note of each chord (`tones`).
    mode: 'tones',
    drop: 'drop2',
    sets: { drop2: ['4321'], drop3: ['6432'], drop24: ['6532'] },
    inversions: [0, 1, 2, 3],
    labels: 'intervals',
    view: 'stacked',
    heights: { ...GAPS },
    leading: false,
    // Every note of each chord on the neck, besides its voicings.
    allNotes: false,
    // Each chord's scale on the neck, outlined (the chord's `scale`, or chordScale's default).
    scales: false,
    // The progression on a staff above the boards: each chord's voicing or notes, or its scale.
    staff: false,
    staffShows: 'chords',
    // The metronome bar, which plays round and round: beats per minute, a bar of clicks first, and
    // while playing only that chord's board and the next one's (Follow).
    bpm: 100,
    countIn: true,
    follow: false,
    // The click's sound (CLICKS) and how loud it is, 0–100.
    click: 'tick',
    clickVolume: 70,
    // Its rhythm (GROOVES): every beat, 2 and 4, or the ride's swing; and for swing, where the
    // swung eighth falls, as a share of the beat (50 straight, 67 a triplet, 75 dotted).
    groove: 'every',
    swing: 67,
    // The chords' sound while playing (SOUNDS): off, plucked, or a pad held for a bar at a time;
    // how much reverb (`space`) and how loud (`volume`), 0–100; and the root an octave lower
    // (`bass`).
    sound: 'ambient',
    space: 50,
    volume: 70,
    bass: true,
    // The pinned voicing of each chord (chord id → voicing id), and the chord last clicked,
    // which voice leading starts from; `autoAnchor` when the app chose it (startPath).
    pins: {},
    anchor: null,
    autoAnchor: false,
    frets: 15,
    leftHanded: false,
    openStrings: true,
    // Fret numbers over and under each board (NUMBER_ROWS): the inlay frets' over, every fret's under.
    numbersAbove: 'inlays',
    numbersBelow: 'all',
  };
}

/** The saved state, with anything missing or out of date replaced by the defaults. */
function sanitize(saved) {
  const ui = defaultUi();
  if (!saved || typeof saved !== 'object') return ui;
  if (Array.isArray(saved.chords)) {
    ui.chords = saved.chords
      .filter((c) => Number.isInteger(c?.id))
      .map((c) => {
        const chord = cleanChord(c);
        return chord && { id: c.id, ...chord, hidden: !!c.hidden };
      })
      .filter(Boolean);
  }
  ui.nextId = Math.max(Number.isInteger(saved.nextId) ? saved.nextId : 1, ...ui.chords.map((c) => c.id + 1), 1);
  ui.title = typeof saved.title === 'string' ? saved.title : '';
  if (Array.isArray(saved.saved)) {
    ui.saved = saved.saved
      .filter((p) => p && Number.isInteger(p.id) && typeof p.name === 'string' && p.name.trim() && Array.isArray(p.chords))
      .map((p) => ({ id: p.id, name: p.name.trim(), chords: p.chords.map(cleanChord).filter(Boolean) }))
      .filter((p) => p.chords.length);
  }
  ui.nextPresetId = Math.max(Number.isInteger(saved.nextPresetId) ? saved.nextPresetId : 1, ...ui.saved.map((p) => p.id + 1), 1);
  if (KEYS.includes(saved.key)) ui.key = saved.key;
  if (['tones', 'voicings'].includes(saved.mode)) ui.mode = saved.mode;
  if (DROPS[saved.drop]) ui.drop = saved.drop;
  for (const drop of Object.keys(DROPS)) {
    const sets = saved.sets?.[drop];
    const valid = Array.isArray(sets) ? sets.filter((s) => DROPS[drop].sets.includes(s)) : [];
    if (valid.length) ui.sets[drop] = valid;
  }
  if (Array.isArray(saved.inversions)) {
    const valid = saved.inversions.filter((i) => [0, 1, 2, 3].includes(i));
    if (valid.length) ui.inversions = valid;
  }
  if (saved.labels === 'notes') ui.labels = 'notes';
  if (saved.view === 'overlay') ui.view = 'overlay';
  for (const view of Object.keys(GAPS)) {
    const gap = saved.heights?.[view];
    if (Number.isInteger(gap) && gap >= GAP_RANGE[0] && gap <= GAP_RANGE[1]) ui.heights[view] = gap;
  }
  ui.leading = !!saved.leading;
  ui.allNotes = !!saved.allNotes;
  ui.scales = !!saved.scales;
  ui.staff = !!saved.staff;
  if (saved.staffShows === 'scales') ui.staffShows = 'scales';
  if (Number.isInteger(saved.bpm) && saved.bpm >= BPM_RANGE[0] && saved.bpm <= BPM_RANGE[1]) ui.bpm = saved.bpm;
  for (const key of ['countIn', 'follow', 'bass']) if (typeof saved[key] === 'boolean') ui[key] = saved[key];
  // `click` was on or off before it had sounds: on was the tick.
  if (CLICKS[saved.click]) ui.click = saved.click;
  if (GROOVES[saved.groove]) ui.groove = saved.groove;
  if (Number.isInteger(saved.swing) && saved.swing >= SWING_RANGE[0] && saved.swing <= SWING_RANGE[1]) ui.swing = saved.swing;
  else if (saved.click === false) ui.click = 'off';
  // `sound` was on or off before there were pads: off stays off, on was the pluck.
  if (SOUNDS[saved.sound]) ui.sound = saved.sound;
  else if (typeof saved.sound === 'boolean') ui.sound = saved.sound ? 'pluck' : 'off';
  for (const key of ['space', 'volume', 'clickVolume']) if (Number.isInteger(saved[key]) && saved[key] >= 0 && saved[key] <= 100) ui[key] = saved[key];
  if (saved.pins && typeof saved.pins === 'object') {
    for (const [id, pin] of Object.entries(saved.pins)) if (typeof pin === 'string') ui.pins[id] = pin;
  }
  if (Number.isInteger(saved.anchor)) ui.anchor = saved.anchor;
  ui.autoAnchor = !!saved.autoAnchor;
  if (FRET_CHOICES.includes(saved.frets)) ui.frets = saved.frets;
  ui.leftHanded = !!saved.leftHanded;
  ui.openStrings = saved.openStrings !== false;
  for (const key of ['numbersAbove', 'numbersBelow']) if (NUMBER_ROWS.includes(saved[key])) ui[key] = saved[key];
  return ui;
}

/** A chord as the progression and My presets keep it, from saved data; null when it isn't one. */
function cleanChord(c) {
  if (!c?.root || !Number.isInteger(c.root.letter) || !Number.isInteger(c.root.acc)) return null;
  if (c.root.letter < 0 || c.root.letter > 6 || Math.abs(c.root.acc) > 2) return null;
  const chord = {
    root: { letter: c.root.letter, acc: c.root.acc },
    quality: c.quality,
    role: typeof c.role === 'string' ? c.role : '',
    text: typeof c.text === 'string' ? c.text : undefined,
    approx: !!c.approx,
    beats: LENGTHS.includes(c.beats) ? c.beats : DEFAULT_BEATS,
    scale: SCALES[c.scale] ? c.scale : undefined,
  };
  return chordTonesOk(chord) ? chord : null;
}

function chordTonesOk(chord) {
  try {
    return chordTones(chord).length === 4;
  } catch {
    return false;
  }
}

const state = {
  ui: defaultUi(),
  theme: 'system',
  // The chords on the fretboard (not hidden): { chord, cls, notes, voicings }, `notes` being all of
  // the chord's (chordNotes) and `voicings` none in Chord tones.
  rows: [],
  // The boards' geometry, the boards' width it was made for, and the fret under the mouse.
  geo: null,
  boardsWidth: 0,
  bandFret: -1,
  // The newer version GitHub has, if any (checkForUpdate).
  update: null,
  // The dot or line under the mouse: { keys, board, node }.
  hover: null,
};

const chordOfKey = (key) => Number(key.slice(0, key.indexOf('~')));

/** The chord's voicings for what's chosen, lowest on the neck first. */
function chordVoicings(chord) {
  const { ui } = state;
  const options = { frets: ui.frets, openStrings: ui.openStrings };
  const found = [];
  for (const set of DROPS[ui.drop].sets) {
    if (!ui.sets[ui.drop].includes(set)) continue;
    for (const v of voicings(chord, ui.drop, set, options)) {
      // `key` tells voicings of different chords apart on a board.
      if (ui.inversions.includes(v.inversion)) found.push({ ...v, key: `${chord.id}~${v.id}` });
    }
  }
  return found.sort((a, b) => a.low - b.low || a.high - b.high);
}

function computeRows() {
  const { ui } = state;
  const tones = ui.mode === 'tones';
  state.rows = [];
  ui.chords.forEach((chord, index) => {
    if (chord.hidden) return;
    state.rows.push({ chord, cls: `c${index % COLORS}`, notes: chordNotes(chord), voicings: tones ? [] : chordVoicings(chord) });
  });
  // A path whose start isn't drawn any more (another drop type, other strings, its chord hidden or
  // removed) starts again from the first chord. With nothing pinned there's no path to keep. Chord
  // tones draws no voicings, so the pins wait there for the voicings to come back.
  if (!tones && ui.leading && !relead() && Object.keys(ui.pins).length) startPath();
}

/**
 * With voice leading on: the other chords' pins follow the pinned voicing of the anchor chord.
 * False when that voicing isn't drawn, so there's nothing to lead from.
 */
function relead() {
  const { ui } = state;
  const anchor = state.rows.findIndex((row) => row.chord.id === ui.anchor);
  if (anchor < 0) return false;
  const start = state.rows[anchor].voicings.find((v) => v.id === ui.pins[ui.anchor]);
  if (!start) return false;
  const path = voiceLead(state.rows.map((row) => row.voicings), anchor, start);
  ui.pins = {};
  path.forEach((v, i) => {
    if (v) ui.pins[state.rows[i].chord.id] = v.id;
  });
  return true;
}

/** A path from the first chord's lowest voicing, for when there's no voicing to start from. */
function startPath() {
  const { ui } = state;
  const row = state.rows.find((r) => r.voicings.length);
  ui.pins = {};
  ui.anchor = row ? row.chord.id : null;
  ui.autoAnchor = !!row;
  if (!row) return;
  ui.pins[row.chord.id] = row.voicings[0].id;
  relead();
}

function pinnedVoicing(chord) {
  const row = state.rows.find((r) => r.chord === chord);
  return row?.voicings.find((v) => v.id === state.ui.pins[chord.id]) || null;
}

// Rendering

function render() {
  computeRows();
  renderSidebar();
  renderToolbar();
  renderBoards();
  renderStaff();
  renderPlayer();
  // Drawn again, so what's playing is marked again.
  markPlaying();
  scheduleSave();
}

function renderSidebar() {
  const { ui } = state;
  $('#chords').replaceChildren(...ui.chords.map((chord, index) => chordItem(chord, index)));
  $('#clear').hidden = ui.chords.length === 0;
  $('#save-preset').hidden = ui.chords.length === 0;
  $('#key').value = ui.key;
  for (const item of $$('#presets .preset')) {
    const preset = PRESETS.find((p) => p.id === item.dataset.preset);
    const title = `${preset.name} in ${presetKey(preset.id, ui.key)}`;
    item.querySelector('.load').title = `Put ${title} in place of the progression`;
    item.querySelector('.append').title = `Add ${title} to the end`;
    item.querySelector('.append').setAttribute('aria-label', `Add ${title} to the end`);
  }
  renderSaved();
}

/** My presets: a row per saved progression, its name and chords, with + and Delete under the mouse. */
function renderSaved() {
  $('#saved').replaceChildren(
    ...state.ui.saved.map((preset) => {
      const item = el('div', 'saved-item');
      item.dataset.id = preset.id;
      item.title = `Put “${preset.name}” in place of the progression`;
      item.append(el('div', 'saved-name', preset.name), el('div', 'saved-chords', preset.chords.map(chordSymbol).join(' ')));
      const actions = el('div', 'item-actions');
      actions.append(actionButton('append', ICONS.plus, 'Add to the end'), actionButton('delete', ICONS.remove, 'Delete', 'danger'));
      item.append(actions);
      return item;
    }),
  );
}

/** A small button over a row's right end; the row's click handler reads `data-action`. */
function actionButton(action, icon, title, className) {
  const b = el('button', className);
  b.dataset.action = action;
  b.innerHTML = icon;
  b.title = title;
  b.setAttribute('aria-label', title);
  return b;
}

function chordItem(chord, index) {
  const item = el('div', `chord-item c${index % COLORS}${chord.hidden ? ' off' : ''}`);
  item.dataset.id = chord.id;
  const head = el('div', 'item-head');
  const name = el('span', 'name', chordSymbol(chord));
  name.title = 'Double-click to change';
  head.append(el('span', 'dot'), name);
  if (chord.role) head.append(el('span', 'role', chord.role));
  const voiced = voicedAs(chord);
  if (voiced) head.append(el('span', 'voiced', voiced));
  // Under the row's buttons is the name; the length sits on the notes' line, at its end.
  const notes = el('div', 'notes');
  const length = el('select', 'length');
  length.dataset.lengthFor = chord.id;
  length.title = 'How long the chord lasts, for the staff and the metronome';
  length.setAttribute('aria-label', `Length of ${chordSymbol(chord)}`);
  for (const beats of LENGTHS) {
    const option = el('option', null, lengthName(beats));
    option.value = beats;
    option.selected = beats === chord.beats;
    length.append(option);
  }
  notes.append(el('span', 'note-names', chordNotes(chord).map((t) => t.name).join(' ')), length);
  item.append(head, notes);
  const pinned = pinnedVoicing(chord);
  if (pinned) {
    const frets = el('div', 'frets', fretText(pinned));
    frets.title = `${inversionName(pinned)}, pinned`;
    item.append(frets);
  }
  item.title = 'Drag to move it in the progression';
  item.append(itemActions(chord));
  return item;
}

/**
 * "voiced as Cmaj7" for a chord whose voicings are the nearest chord's (Cmaj9), while voicings show;
 * '' otherwise.
 */
function voicedAs(chord) {
  const name = chordName(chord);
  return state.ui.mode === 'voicings' && chordSymbol(chord) !== name ? `voiced as ${name}` : '';
}

function itemActions(chord) {
  const box = el('div', 'item-actions');
  box.append(
    actionButton('hide', chord.hidden ? ICONS.eyeOff : ICONS.eye, chord.hidden ? 'Show on the fretboard' : 'Hide from the fretboard'),
    actionButton('remove', ICONS.remove, 'Remove', 'danger'),
  );
  return box;
}

/**
 * Dragging a chord's row moves it in the progression. A press that moves less than DRAG_START px
 * stays a click (its fretboard comes into view; a double-click on the name edits it). The row
 * follows the pointer and an accent line shows where it will go; Esc puts it back.
 */
function initChordDrag() {
  const list = $('#chords');
  let drag = null;

  const finish = (drop) => {
    const d = drag;
    drag = null;
    if (!d?.active) return;
    // The click that ends a drag isn't one.
    state.suppressClick = true;
    document.documentElement.classList.remove('dragging-chord');
    d.line.remove();
    // `to` counts the slots before the dragged row too; take it out.
    const to = d.to > d.from ? d.to - 1 : d.to;
    if (drop && to !== d.from) {
      moveChordTo(d.from, to);
    } else {
      d.item.classList.remove('dragging');
      d.item.style.transform = '';
    }
  };

  list.addEventListener('pointerdown', (e) => {
    state.suppressClick = false;
    const item = e.target.closest('.chord-item');
    if (e.button !== 0 || !item || e.target.closest('button, input, select')) return;
    drag = { item, pointerId: e.pointerId, startY: e.clientY, active: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < DRAG_START) return;
      drag.active = true;
      drag.items = [...list.querySelectorAll('.chord-item')];
      drag.rects = drag.items.map((n) => n.getBoundingClientRect());
      drag.from = drag.items.indexOf(drag.item);
      drag.item.classList.add('dragging');
      document.documentElement.classList.add('dragging-chord');
      drag.line = el('div', 'drop-line');
      list.append(drag.line);
    }
    drag.item.style.transform = `translateY(${dy}px)`;
    // The slot before the first row whose middle is below the pointer.
    const at = drag.rects.findIndex((r) => e.clientY < r.top + r.height / 2);
    drag.to = at < 0 ? drag.items.length : at;
    const edge = drag.to < drag.rects.length ? drag.rects[drag.to].top : drag.rects[drag.rects.length - 1].bottom;
    drag.line.style.top = `${edge - list.getBoundingClientRect().top - 1}px`;
    // No line where the row already is.
    drag.line.hidden = drag.to === drag.from || drag.to === drag.from + 1;
  });
  document.addEventListener('pointerup', (e) => {
    if (drag && e.pointerId === drag.pointerId) finish(true);
  });
  document.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointerId) finish(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag?.active) {
      e.stopImmediatePropagation();
      finish(false);
    }
  }, true);
}

function renderToolbar() {
  const { ui } = state;
  const tones = ui.mode === 'tones';
  for (const b of $$('#drop button')) b.setAttribute('aria-checked', String(b.dataset.drop ? !tones && b.dataset.drop === ui.drop : tones));
  const chosen = ui.sets[ui.drop];
  $('#sets').replaceChildren(
    ...DROPS[ui.drop].sets.map((set) => {
      const strings = [...set];
      const b = el('button', 'chip', strings.join('-'));
      b.dataset.set = set;
      b.setAttribute('aria-pressed', String(chosen.includes(set)));
      b.title = `Strings ${strings.slice(0, 3).join(', ')} and ${strings[3]} (${strings.map((s) => STRING_NAMES[s]).join(' ')}). Double-click to show only these.`;
      b.disabled = tones;
      return b;
    }),
  );
  for (const b of $$('#inversions button')) {
    b.setAttribute('aria-pressed', String(ui.inversions.includes(Number(b.dataset.inversion))));
    b.disabled = tones;
  }
  // Chord tones draws no voicings: what only voicings use stays where it is, dimmed, so the
  // toolbar doesn't move. A dimmed button lets the mouse through, to its group's tooltip.
  for (const group of [$('#sets'), $('#inversions')].map((n) => n.closest('.group'))) {
    group.classList.toggle('off', tones);
    group.title = tones ? 'For drop voicings: choose Drop 2, Drop 3 or Drop 2&4' : '';
  }
  for (const b of $$('#labels button')) b.setAttribute('aria-checked', String(b.dataset.labels === ui.labels));
  for (const b of $$('#view button')) b.setAttribute('aria-checked', String(b.dataset.view === ui.view));
  $('#leading').setAttribute('aria-pressed', String(ui.leading));
  $('#all-notes').setAttribute('aria-pressed', String(ui.allNotes));
  $('#leading').disabled = tones;
  $('#all-notes').disabled = tones;
  $('#scales').setAttribute('aria-pressed', String(ui.scales));
  $('#staff-toggle').setAttribute('aria-pressed', String(ui.staff));
  $('#tempo').value = ui.bpm;
  $('#tempo-number').value = ui.bpm;
  for (const b of $$('#player button[data-option]')) b.setAttribute('aria-pressed', String(ui[b.dataset.option]));
  renderSound();
  $('#height').value = ui.heights[ui.view];
  $('#frets').value = String(ui.frets);
}

function renderBoards() {
  const { ui } = state;
  const boards = $('#boards');
  const none = state.rows.length === 0;
  boards.hidden = none;
  $('#empty').hidden = !none;
  state.hover = null;
  state.bandFret = -1;
  if (none) {
    state.geo = null;
    $('#empty-text').textContent = ui.chords.length
      ? 'Every chord is hidden. Show one with its eye button in the sidebar.'
      : ui.mode === 'tones'
        ? 'Add chords to see all their notes on the neck.'
        : 'Add chords to see all their drop voicings on the neck.';
    $('#empty-add').hidden = ui.chords.length > 0;
    $('#empty-add').textContent = `Add ii–V–I in ${ui.key}`;
    return;
  }
  const style = getComputedStyle(boards);
  state.boardsWidth = boards.clientWidth;
  state.boardsHeight = boards.clientHeight;
  const width = Math.floor(boards.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  // Following the playing chord: only it and the next one, as tall as the pane allows.
  const follow = following();
  const rows = follow ? followedRows() : state.rows;
  const draw = (gap) => {
    // Every board has its fret numbers under it, so a fret reads at any board without looking away.
    const geo = geometry(width, ui.frets, { gap, leftHanded: ui.leftHanded, above: ui.numbersAbove, below: ui.numbersBelow });
    state.geo = geo;
    if (ui.view === 'overlay') boards.replaceChildren(overlayView(geo, rows));
    else boards.replaceChildren(...rows.map((row) => stackedRow(row, geo)));
  };
  draw(ui.heights[ui.view]);
  if (follow) {
    const gap = fittedGap();
    if (gap !== ui.heights[ui.view]) draw(gap);
  }
  restyle();
}

/**
 * The tallest boards (px between strings) that let every board drawn show in the pane without
 * scrolling, or the smallest when they can't. Measured on what's drawn: its headings and the
 * legend stay as they are, and only the boards grow.
 */
function fittedGap() {
  const boards = $('#boards');
  const svgs = $$('#boards svg.board');
  if (!svgs.length) return state.ui.heights[state.ui.view];
  const drawn = svgs.reduce((sum, svg) => sum + Number(svg.getAttribute('height')), 0);
  const content = Math.max(...[...boards.children].map((n) => n.offsetTop + n.offsetHeight)) + parseFloat(getComputedStyle(boards).paddingBottom);
  const around = content - drawn;
  let gap = GAP_RANGE[1];
  const { numbersAbove, numbersBelow } = state.ui;
  while (gap > GAP_RANGE[0] && around + svgs.length * boardHeight(gap, numbersAbove, numbersBelow) > boards.clientHeight) gap -= 1;
  return gap;
}

/** The view's height (px between strings), from Height or Fit. The boards follow at most once a frame. */
function setHeight(gap) {
  state.ui.heights[state.ui.view] = gap;
  $('#height').value = gap;
  if (!state.heightFrame) {
    state.heightFrame = requestAnimationFrame(() => {
      state.heightFrame = 0;
      renderBoards();
      markPlaying();
    });
  }
  scheduleSave();
}

/** Fit: the boards as tall as the pane allows with all of them showing; the slider follows. */
function fitHeight() {
  if (following() || $('#boards').hidden) return;
  setHeight(fittedGap());
}

function svgNode(width, height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return svg;
}

/**
 * What a board draws for a chord: its voicings, each note labeled as chosen, and with All notes on,
 * every other place its notes are on the neck, outlined (`extras`). Chord tones draws those places
 * as dots of their own (`notes`), and no voicings. With Scales on, the chord's scale is outlined
 * around them; a spot that's the chord's own keeps its look.
 */
function layerOf(row) {
  const { ui } = state;
  const options = { frets: ui.frets, openStrings: ui.openStrings };
  const note = (n) => ({ string: n.string, fret: n.fret, label: ui.labels === 'notes' ? n.tone.name : n.tone.label, root: n.tone.deg === 1 });
  const scale = ui.scales ? scaleOnNeck(row.chord, chordScale(row.chord), options).map(note) : [];
  if (ui.mode === 'tones') return { cls: row.cls, voicings: [], notes: notesOnNeck(row.chord, options).map(note), extras: scale };
  return {
    cls: row.cls,
    voicings: row.voicings.map((v) => ({ id: v.key, notes: v.notes.map(note) })),
    extras: [...(ui.allNotes ? notesOnNeck(row.chord, options).map(note) : []), ...scale],
  };
}

/** The scale picker for a chord (Scales on): its scales by name, and the notes of the one chosen. */
function scalePicker(chord) {
  const box = el('span', 'scale-pick');
  const select = el('select');
  select.dataset.scaleFor = chord.id;
  select.setAttribute('aria-label', `Scale over ${chordSymbol(chord)}`);
  const chosen = chordScale(chord);
  for (const key of scaleChoices(chord)) {
    const option = el('option', null, scaleName(chord, key));
    option.value = key;
    option.selected = key === chosen;
    select.append(option);
  }
  box.append(select, el('span', 'scale-notes', scaleNotes(chord, chosen).map((t) => t.name).join(' ')));
  return box;
}

/** What a board shows, for its label: "Dm7: Drop 2 voicings", "All chords: chord tones". */
function showing(what) {
  return `${what}: ${state.ui.mode === 'tones' ? 'chord tones' : `${DROPS[state.ui.drop].name} voicings`}`;
}

/** A board for `layers`; `focus` is the layer of the chord playing, kept in the middle of its frets. */
function board(geo, layers, label, focus = -1) {
  const svg = svgNode(geo.width, geo.height);
  svg.setAttribute('class', 'board');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.innerHTML = boardMarkup(geo) + notesMarkup(geo, layers, { radius: Math.min(geo.gap * 0.46, MAX_DOT_RADIUS), focus });
  return svg;
}

function stackedRow(row, geo) {
  const section = el('section', `row ${row.cls}`);
  section.dataset.chord = row.chord.id;
  const head = el('header', 'row-head');
  const name = chordSymbol(row.chord);
  head.append(el('span', 'dot'), el('span', 'row-name', name), el('span', 'row-notes', row.notes.map((t) => t.name).join(' ')));
  if (row.chord.role) head.append(el('span', 'row-role', row.chord.role));
  const voiced = voicedAs(row.chord);
  if (voiced) head.append(el('span', 'row-voiced', voiced));
  if (state.ui.scales) head.append(scalePicker(row.chord));
  const info = el('span', 'row-info');
  info.dataset.chord = row.chord.id;
  head.append(info);
  section.append(head, board(geo, [layerOf(row)], showing(name)));
  if (state.ui.mode === 'voicings' && !row.voicings.length) section.append(el('p', 'row-none', 'No voicings with these strings and inversions.'));
  return section;
}

function overlayView(geo, rows) {
  const section = el('section', 'overlay-view');
  const legend = el('div', 'legend');
  for (const row of rows) {
    const item = el('span', `legend-item ${row.cls}`);
    item.dataset.chord = row.chord.id;
    item.append(el('span', 'dot'), el('b', null, chordSymbol(row.chord)));
    if (row.chord.role) item.append(el('span', 'row-role', row.chord.role));
    if (state.ui.scales) item.append(scalePicker(row.chord));
    item.append(el('span', 'frets'));
    legend.append(item);
  }
  // While playing, the chord playing keeps a straight column: its dots in the middle of each fret.
  const playing = player.playing && player.shown ? player.shown.chordId : null;
  const focus = rows.findIndex((row) => row.chord.id === playing);
  const label = showing(rows.length < state.rows.length ? 'The chord playing and the next' : 'All chords');
  section.append(legend, board(geo, rows.map(layerOf), label, focus), el('div', 'overlay-info'));
  return section;
}

/**
 * Updates what stands out without redrawing: the voicings under the mouse (`on`), the pinned ones,
 * and the other voicings of chords that have a pin (`dim`).
 */
function restyle() {
  const { ui } = state;
  const drawn = new Map();
  for (const row of state.rows) for (const v of row.voicings) drawn.set(v.key, v);
  const pinned = new Set();
  for (const row of state.rows) {
    const key = `${row.chord.id}~${ui.pins[row.chord.id]}`;
    if (drawn.has(key)) pinned.add(key);
  }
  const pinnedChords = new Set([...pinned].map(chordOfKey));
  const { hover } = state;
  for (const svg of $$('#boards .board')) {
    const hovering = !!hover && hover.board === svg;
    svg.classList.toggle('hovering', hovering);
    for (const node of svg.querySelectorAll('[data-v]')) {
      const keys = node.dataset.v.split(' ');
      const on = hovering && keys.some((k) => hover.keys.has(k));
      const isPinned = keys.some((k) => pinned.has(k));
      node.classList.toggle('on', on);
      node.classList.toggle('pinned', isPinned);
      node.classList.toggle('dim', !on && !isPinned && pinnedChords.has(chordOfKey(keys[0])));
    }
  }
  renderInfo(drawn, pinned);
}

/** The frets and inversion of the voicing under the mouse, or of the pinned ones. */
function renderInfo(drawn, pinned) {
  const { ui } = state;
  const hovered = state.hover ? [...state.hover.keys].map((k) => drawn.get(k)).filter(Boolean) : [];
  const pinnedOf = (chordId) => drawn.get(`${chordId}~${ui.pins[chordId]}`);
  if (ui.view === 'overlay') {
    for (const item of $$('.legend-item')) {
      const chordId = Number(item.dataset.chord);
      const v = pinned.has(`${chordId}~${ui.pins[chordId]}`) ? pinnedOf(chordId) : null;
      item.querySelector('.frets').textContent = v ? fretText(v) : '';
    }
    const info = $('.overlay-info');
    if (!info) return;
    if (hovered.length) {
      info.replaceChildren(...describe(hovered[0], true, hovered.length - 1));
    } else if (pinned.size) {
      const path = [];
      for (const row of state.rows) {
        const v = pinned.has(`${row.chord.id}~${ui.pins[row.chord.id]}`) && pinnedOf(row.chord.id);
        if (!v) continue;
        if (path.length) path.push('  →  ');
        path.push(`${chordSymbol(row.chord)} `, el('b', null, fretText(v)));
      }
      info.replaceChildren(...path);
    } else if (ui.mode === 'tones') {
      info.textContent = 'Every note of each chord. Where chords share a note, their dots stand side by side: notes you can keep from one chord to the next.';
    } else {
      info.textContent = ui.leading
        ? 'Point at a voicing to see its frets. Click one to pin it, and the other chords follow with their closest voicings.'
        : 'Point at a voicing to see its frets. Click it to pin it.';
    }
    return;
  }
  for (const info of $$('.row-info')) {
    const chordId = Number(info.dataset.chord);
    const mine = hovered.filter((v) => chordOfKey(v.key) === chordId);
    const v = mine[0] || (pinned.has(`${chordId}~${ui.pins[chordId]}`) ? pinnedOf(chordId) : null);
    info.replaceChildren(...(v ? describe(v, false, mine.length - 1) : []));
  }
}

/** "Dm7 · 1st inversion, ♭3 in the bass · x x 3 5 3 5", the frets in bold. */
function describe(v, withChord, more) {
  const parts = [];
  if (withChord) parts.push(`${chordSymbol(state.ui.chords.find((c) => c.id === chordOfKey(v.key)))} · `);
  parts.push(`${inversionName(v)} · `, el('b', null, fretText(v)));
  if (more > 0) parts.push(` · and ${more} more using this note`);
  return parts;
}

/** Shades the fret under the mouse on every board, and its number. */
function moveBand(fret) {
  if (fret === state.bandFret) return;
  state.bandFret = fret;
  const rect = fret >= 0 && state.geo ? state.geo.slotRect(fret) : null;
  for (const band of $$('#boards .band')) {
    band.setAttribute('x', rect ? rect.x : 0);
    band.setAttribute('width', rect ? rect.width : 0);
  }
  for (const n of $$('#boards .fret-number')) n.classList.toggle('active', Number(n.dataset.fret) === fret);
}

// Staff (staff.js): above the boards, the progression's bars, each chord for its length.

/** The chord's root as a MIDI note in the octave under middle C, where the staff starts its notes. */
function lowRoot(chord) {
  return 48 + chordTones(chord)[0].pc;
}

/**
 * What the staff shows for each chord: its pinned voicing, or else its notes from the root (in
 * Chord tones, and for a chord with no pin), or with Scales chosen there, its scale. Pitches are
 * written an octave up, as guitar music is.
 */
function staffEntries() {
  const { ui } = state;
  return ui.chords.map((chord, index) => {
    const entry = { symbol: chordSymbol(chord), cls: `c${index % COLORS}`, beats: chord.beats };
    const note = (tone, midi) => ({ step: staffStep(tone, midi + 12), acc: tone.acc });
    if (ui.staffShows === 'scales') {
      const notes = scaleNotes(chord, chordScale(chord));
      const root = lowRoot(chord);
      return { ...entry, kind: 'scale', notes: [...notes.map((t) => note(t, root + t.semis)), note(notes[0], root + 12)] };
    }
    const pinned = pinnedVoicing(chord);
    if (pinned) return { ...entry, kind: 'voicing', notes: pinned.notes.map((n) => note(n.tone, n.pitch)) };
    return { ...entry, kind: 'notes', notes: chordNotes(chord).map((t) => note(t, lowRoot(chord) + t.semis)) };
  });
}

function renderStaff() {
  const { ui } = state;
  const section = $('#staff');
  section.hidden = !ui.staff || !ui.chords.length;
  state.staffSpans = [];
  if (section.hidden) return;
  for (const b of $$('#staff-shows button')) b.setAttribute('aria-checked', String(b.dataset.shows === ui.staffShows));
  const layout = staffMarkup(staffEntries(), $('#staff-scroll').clientWidth);
  const svg = $('#staff-svg');
  svg.setAttribute('width', layout.width);
  svg.setAttribute('height', layout.height);
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.innerHTML = layout.markup;
  state.staffSpans = layout.spans;
}

// Playing (#player): a metronome walks through the progression, each chord for its length, round
// and round, and the chord playing stands out everywhere. Web Audio, scheduled a little ahead of
// time so the beats stay even; the screen follows with timers.

const LOOKAHEAD_S = 0.12;
const SCHEDULE_MS = 25;
const STRUM_S = 0.028;
const REVERB_S = 3;

// The chords' sounds. A pad holds the chord for its length: oscillators per note ([wave, frequency
// ratio, detune in cents, level]) through a low-pass filter, fading in over `attack` and out over
// `release`, so one chord melts into the next. `sweep` moves the filter slowly (Hz, at `sweepRate`),
// `vibrato` wobbles the pitch.
const SOUNDS = {
  off: { name: 'Off' },
  pluck: { name: 'Pluck' },
  ambient: {
    name: 'Ambient',
    attack: 0.9,
    release: 2.2,
    cutoff: 950,
    q: 2.2,
    sweep: 650,
    sweepRate: 0.13,
    level: 0.06,
    oscillators: [['sawtooth', 1, -6, 0.55], ['triangle', 1, 6, 1], ['sine', 2, 0, 0.35]],
  },
  warm: { name: 'Warm pad', attack: 0.35, release: 0.9, cutoff: 1150, q: 0.8, level: 0.065, oscillators: [['sawtooth', 1, -7, 1], ['sawtooth', 1, 7, 1]] },
  strings: {
    name: 'Strings',
    attack: 0.7,
    release: 1.3,
    cutoff: 2300,
    q: 0.5,
    vibrato: 5.5,
    level: 0.045,
    oscillators: [['sawtooth', 1, -12, 1], ['sawtooth', 1, 0, 1], ['sawtooth', 1, 11, 1]],
  },
  organ: { name: 'Organ', attack: 0.04, release: 0.25, cutoff: 7000, q: 0.3, level: 0.085, oscillators: [['sine', 1, 0, 1], ['sine', 2, 0, 0.5], ['sine', 3, 0, 0.22]] },
};

// `mix`: the chords' sound goes through it, dry and through a reverb, to a compressor; the click
// goes straight to the compressor. `voices`: pads still sounding, to fade them when stopping.
const player = { ctx: null, mix: null, buffers: new Map(), noise: null, voices: [], playing: false, timer: 0, next: 0, beat: 0, shown: null };

// The click's sounds: Tick (a short triangle), Wood (a woodblock: two sines and a knock of noise),
// Hi-hat (noise above 7 kHz), Beep (a sine), Ride (a cymbal: metallic partials, ringing). A
// stronger beat is higher, or longer, or louder.
const CLICKS = {
  off: { name: 'Off' },
  tick: { name: 'Tick' },
  wood: { name: 'Wood' },
  hihat: { name: 'Hi-hat' },
  beep: { name: 'Beep' },
  ride: { name: 'Ride' },
};

// The click's rhythms: every beat with 1 stronger; only 2 and 4, as a drummer's hi-hat; or swing,
// the ride's "ding, ding-a, ding, ding-a", 2 and 4 stronger, with the swung eighth before them.
const GROOVES = {
  every: { name: 'Every beat' },
  backbeat: { name: '2 & 4' },
  swing: { name: 'Swing' },
};
const SWING_RANGE = [50, 75];

const clock = () => (player.ctx ? player.ctx.currentTime : performance.now() / 1000);

/** Where each chord starts in the progression and how long it lasts, in beats. */
function timeline() {
  let start = 0;
  return state.ui.chords.map((chord, index) => {
    const span = { chord, index, start, beats: chord.beats };
    start += chord.beats;
    return span;
  });
}

/** Follow on while playing: the boards show only the chord playing and the next one. */
function following() {
  return player.playing && state.ui.follow;
}

/**
 * The rows Follow draws: the playing chord's (the first one's during the count-in) and the next
 * one's, round to the first after the last. Hidden chords have no board and are skipped.
 */
function followedRows() {
  const { chords } = state.ui;
  const at = player.shown && player.shown.index >= 0 ? player.shown.index : 0;
  const picked = [];
  for (let k = 0; k < chords.length && picked.length < 2; k++) {
    const row = state.rows.find((r) => r.chord.id === chords[(at + k) % chords.length].id);
    if (row && !picked.includes(row)) picked.push(row);
  }
  return picked.length ? picked : state.rows;
}

function togglePlay() {
  if (player.playing) stopPlaying();
  else startPlaying();
}

function startPlaying() {
  if (!state.ui.chords.length) return;
  audio();
  player.playing = true;
  // A bar of clicks first: the count-in's beats are -4 to -1.
  player.beat = state.ui.countIn ? -4 : 0;
  player.next = clock() + 0.1;
  player.shown = null;
  renderPlayer();
  if (state.ui.follow) renderBoards();
  schedule();
}

function stopPlaying() {
  const followed = following();
  player.playing = false;
  clearTimeout(player.timer);
  fadeVoices();
  player.shown = null;
  renderPlayer();
  // Every board again, as tall as the slider says, and Overlay's chords side by side again.
  if (followed || state.ui.view === 'overlay') renderBoards();
  markPlaying();
}

/**
 * Schedules the beats due in the next moment: their click, the chord's sound as it starts and again
 * at each bar it lasts into (a pad holds it to the bar's end), and the screen. Round and round.
 */
function schedule() {
  const spans = timeline();
  const total = spans.reduce((sum, s) => sum + s.beats, 0);
  if (!total) return stopPlaying();
  while (player.next < clock() + LOOKAHEAD_S) {
    // The progression may have changed while playing.
    if (player.beat >= total) player.beat = 0;
    const beat = player.beat;
    const time = player.next;
    const span = beat >= 0 ? spans.find((s) => beat < s.start + s.beats) : null;
    if (player.ctx) {
      clickBeat(beat, time, 60 / state.ui.bpm);
      if (span && (beat === span.start || mod(beat, 4) === 0)) {
        const until = Math.min(span.start + span.beats, (Math.floor(beat / 4) + 1) * 4);
        chordSound(span.chord, time, ((until - beat) * 60) / state.ui.bpm);
      }
    }
    setTimeout(() => showBeat(beat, span), Math.max(0, (time - clock()) * 1000));
    player.next += 60 / state.ui.bpm;
    player.beat = (player.beat + 1) % total;
  }
  player.voices = player.voices.filter((v) => v.stop > clock());
  player.timer = setTimeout(schedule, SCHEDULE_MS);
}

function showBeat(beat, span) {
  if (!player.playing) return;
  const before = player.shown?.chordId;
  player.shown = { beat, chordId: span ? span.chord.id : null, index: span ? span.index : -1, frac: span ? (beat - span.start + 0.5) / span.beats : 0 };
  // Following, a new chord brings new boards: it and the one after it.
  // A new chord draws the boards again when they depend on it: Follow's pair, or Overlay's middle.
  if (span && span.chord.id !== before && (following() || state.ui.view === 'overlay')) renderBoards();
  markPlaying();
  // A new chord comes into view, on its board and on the staff.
  if (span && span.chord.id !== before) {
    if (!following()) $(`#boards .row[data-chord="${span.chord.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const at = state.staffSpans[span.index];
    const scroll = $('#staff-scroll');
    if (at && (at[0] < scroll.scrollLeft || at[1] > scroll.scrollLeft + scroll.clientWidth)) {
      scroll.scrollTo({ left: Math.max(0, at[0] - 40), behavior: 'smooth' });
    }
  }
}

/** Marks the chord playing: its row, its board (the others rest), its bar on the staff, the beat. */
function markPlaying() {
  const shown = player.playing ? player.shown : null;
  const id = shown ? shown.chordId : null;
  for (const item of $$('#chords .chord-item')) item.classList.toggle('playing', id != null && Number(item.dataset.id) === id);
  for (const row of $$('#boards .row')) row.classList.toggle('resting', id != null && Number(row.dataset.chord) !== id);
  const cls = id != null ? `c${shown.index % COLORS}` : null;
  for (const node of $$('#boards .overlay-view .board .dot, #boards .overlay-view .board .shape')) node.classList.toggle('resting', !!cls && !node.classList.contains(cls));
  const span = id != null ? state.staffSpans[shown.index] : null;
  const now = $('#staff-svg .staff-now');
  const head = $('#staff-svg .staff-playhead');
  if (now && head) {
    now.setAttribute('x', span ? span[0] : 0);
    now.setAttribute('width', span ? span[1] - span[0] : 0);
    head.setAttribute('visibility', span ? 'visible' : 'hidden');
    if (span) {
      const x = Math.round((span[0] + (span[1] - span[0]) * shown.frac) * 10) / 10;
      head.setAttribute('x1', x);
      head.setAttribute('x2', x);
    }
  }
  $$('#beats i').forEach((dot, k) => dot.classList.toggle('on', !!shown && mod(shown.beat, 4) === k));
  const bars = Math.ceil(state.ui.chords.reduce((sum, c) => sum + c.beats, 0) / 4);
  const chord = id != null ? state.ui.chords.find((c) => c.id === id) : null;
  $('#play-status').textContent = !shown
    ? ''
    : shown.beat < 0
      ? `Count-in ${shown.beat + 5}`
      : `${chord ? chordSymbol(chord) : ''} · bar ${Math.floor(shown.beat / 4) + 1} of ${bars}`;
}

function renderPlayer() {
  const play = $('#play');
  play.setAttribute('aria-pressed', String(player.playing));
  $('#play-text').textContent = player.playing ? 'Stop' : 'Play';
  play.disabled = !state.ui.chords.length && !player.playing;
  // While Follow sizes the boards, Height and Fit wait.
  const follow = following();
  $('#height').disabled = follow;
  $('#fit').disabled = follow;
  $('#height').closest('.height-pick').classList.toggle('off', follow);
}

/** The audio context, made on the first Play (a click or a key), as browsers allow. */
function audio() {
  if (!player.ctx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    try {
      player.ctx = new Context();
    } catch {
      return null;
    }
  }
  if (player.ctx.state === 'suspended') player.ctx.resume();
  if (!player.mix) player.mix = makeMix(player.ctx);
  return player.ctx;
}

/** The mix: the chords' sound at `volume`, dry and through a reverb at `space`, into a compressor. */
function makeMix(ctx) {
  const out = ctx.createDynamicsCompressor();
  out.connect(ctx.destination);
  const chords = ctx.createGain();
  chords.connect(out);
  // A room: a few seconds of noise fading away, as the reverb's impulse.
  const reverb = ctx.createConvolver();
  const length = Math.round(ctx.sampleRate * REVERB_S);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  chords.connect(reverb).connect(wet).connect(out);
  // The click at its own volume, dry.
  const click = ctx.createGain();
  click.connect(out);
  const mix = { out, chords, wet, click };
  setMix(mix);
  return mix;
}

/** Space and the two volumes, at once, even while playing. */
function setMix(mix = player.mix) {
  if (!mix) return;
  mix.chords.gain.value = state.ui.volume / 100;
  mix.wet.gain.value = state.ui.space / 100;
  mix.click.gain.value = state.ui.clickVolume / 100;
}

/**
 * A beat's click in the chosen rhythm (GROOVES), at `time`, a beat lasting `beat` seconds. The
 * count-in is every beat whatever the rhythm, so "one" is heard before 2 and 4 take over.
 */
function clickBeat(index, time, beat) {
  const { groove, swing } = state.ui;
  const inBar = mod(index, 4);
  if (index < 0 || groove === 'every') return tick(time, inBar === 0);
  const two = inBar === 1 || inBar === 3;
  if (groove === 'backbeat') {
    if (two) tick(time, false);
    return;
  }
  // Swing: every beat, 2 and 4 stronger; on 1 and 3, also the softer swung eighth leading to them.
  tick(time, two);
  if (!two) tick(time + (swing / 100) * beat, false, 0.6);
}

/** The metronome's click in its sound (CLICKS), stronger with `accent`, at `level` of its loudness. */
function tick(time, accent, level = 1) {
  const ctx = player.ctx;
  const kind = state.ui.click;
  if (kind === 'off') return;
  // A sound that dies away: `peak` reached at once, gone after `length` seconds.
  const envelope = (peak, length) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak * level, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    gain.connect(player.mix.click);
    return gain;
  };
  const tone = (type, freq, peak, length) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(envelope(peak, length));
    osc.start(time);
    osc.stop(time + length + 0.01);
  };
  const noise = (filterType, freq, q, peak, length) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter).connect(envelope(peak, length));
    source.start(time);
    source.stop(time + length + 0.01);
  };
  if (kind === 'tick') {
    tone('triangle', accent ? 1760 : 1320, accent ? 0.5 : 0.3, 0.045);
  } else if (kind === 'wood') {
    tone('sine', accent ? 1250 : 950, accent ? 0.55 : 0.4, 0.07);
    tone('sine', accent ? 2100 : 1600, 0.12, 0.03);
    noise('bandpass', 2600, 4, 0.25, 0.012);
  } else if (kind === 'hihat') {
    noise('highpass', 7000, 0.7, accent ? 0.5 : 0.3, accent ? 0.09 : 0.045);
  } else if (kind === 'ride') {
    // Six square waves at clashing pitches, as drum machines make cymbals, kept to the highs and
    // left to ring; a sine adds the bell's ping.
    const out = envelope(accent ? 0.24 : 0.16, accent ? 1.1 : 0.8);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 8500;
    band.Q.value = 0.7;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 5500;
    band.connect(high).connect(out);
    for (const freq of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(band);
      osc.start(time);
      osc.stop(time + 1.2);
    }
    tone('sine', 2640, accent ? 0.05 : 0.03, 0.5);
  } else {
    tone('sine', accent ? 1320 : 880, accent ? 0.45 : 0.3, 0.09);
  }
}

/** Half a second of white noise, made once, for the clicks that need it. */
function noiseBuffer() {
  if (!player.noise) {
    const ctx = player.ctx;
    const length = Math.round(ctx.sampleRate * 0.5);
    player.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = player.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return player.noise;
}

/**
 * A chord as it starts, for `seconds`: its pinned voicing, or else its notes from the root, with
 * Bass the root an octave lower; plucked low to high, or held by a pad for the chord's length.
 */
function chordSound(chord, time, seconds) {
  const { ui } = state;
  if (ui.sound === 'off' || !player.ctx) return;
  const pinned = pinnedVoicing(chord);
  const pitches = pinned ? pinned.notes.map((n) => n.pitch) : chordNotes(chord).map((t) => lowRoot(chord) + t.semis).sort((a, b) => a - b);
  if (ui.bass) pitches.unshift(lowRoot(chord) - 12);
  if (ui.sound === 'pluck') {
    pitches.forEach((midi, k) => pluck(midi, time + k * STRUM_S, 0.3));
    return;
  }
  const sound = SOUNDS[ui.sound];
  pitches.forEach((midi, k) => pad(midi, time, time + seconds, sound, sound.level * (ui.bass && k === 0 ? 1.3 : 1)));
}

/** One note of a pad, from `start` to `end`, then fading over its release. */
function pad(midi, start, end, sound, level) {
  const ctx = player.ctx;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const stop = end + sound.release + 0.05;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(level, start + sound.attack);
  gain.gain.setValueAtTime(level, Math.max(start + sound.attack, end));
  gain.gain.exponentialRampToValueAtTime(0.0001, end + sound.release);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = sound.cutoff;
  filter.Q.value = sound.q;
  filter.connect(gain).connect(player.mix.chords);
  const nodes = [];
  const lfo = (rate, depth, target) => {
    const osc = ctx.createOscillator();
    const amount = ctx.createGain();
    osc.frequency.value = rate;
    amount.gain.value = depth;
    osc.connect(amount).connect(target);
    osc.start(start);
    osc.stop(stop);
    nodes.push(osc);
  };
  if (sound.sweep) lfo(sound.sweepRate, sound.sweep, filter.frequency);
  for (const [type, ratio, detune, share] of sound.oscillators) {
    const osc = ctx.createOscillator();
    const amount = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * ratio;
    osc.detune.value = detune;
    amount.gain.value = share;
    osc.connect(amount).connect(filter);
    if (sound.vibrato) lfo(sound.vibrato, 4, osc.detune);
    osc.start(start);
    osc.stop(stop);
    nodes.push(osc);
  }
  player.voices.push({ gain, nodes, stop });
}

/** Stopping: the pads still sounding fade out in a moment instead of ringing on. */
function fadeVoices() {
  const ctx = player.ctx;
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const v of player.voices) {
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + 0.25);
    for (const node of v.nodes) {
      try {
        node.stop(t + 0.3);
      } catch {
        // Already stopped.
      }
    }
  }
  player.voices = [];
}

/** A plucked string (Karplus–Strong): a burst of noise through a delay as long as one period. */
function pluck(midi, time, level) {
  const ctx = player.ctx;
  let buffer = player.buffers.get(midi);
  if (!buffer) {
    const rate = ctx.sampleRate;
    const period = Math.max(2, Math.round(rate / (440 * 2 ** ((midi - 69) / 12))));
    const length = Math.round(rate * 2.2);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const k = i % period;
      data[i] = ring[k];
      ring[k] = 0.4985 * (ring[k] + ring[(k + 1) % period]);
    }
    // Fade the last tenth of a second, so it ends without a click.
    const fade = Math.round(rate * 0.1);
    for (let i = 0; i < fade; i++) data[length - 1 - i] *= i / fade;
    buffer = ctx.createBuffer(1, length, rate);
    buffer.getChannelData(0).set(data);
    player.buffers.set(midi, buffer);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = level;
  source.connect(gain).connect(player.mix.chords);
  source.start(time);
}

// Pins

/** A click on a voicing's line pins it; a click on a note pins each voicing using it in turn. */
function pinFrom(node) {
  const keys = node.dataset.v.split(' ');
  const chordId = chordOfKey(keys[0]);
  const at = keys.indexOf(`${chordId}~${state.ui.pins[chordId]}`);
  // Past the last one, the chord's pin goes.
  const next = at < 0 ? keys[0] : keys[at + 1];
  setPin(chordId, next ? next.slice(next.indexOf('~') + 1) : null);
}

function setPin(chordId, voicingId) {
  const { ui } = state;
  if (voicingId) {
    ui.pins[chordId] = voicingId;
    ui.anchor = chordId;
    ui.autoAnchor = false;
    if (ui.leading) relead();
  } else if (ui.leading) {
    // The path comes from one voicing, so it goes as a whole.
    ui.pins = {};
    ui.anchor = null;
    ui.autoAnchor = false;
  } else {
    delete ui.pins[chordId];
  }
  renderSidebar();
  restyle();
  renderStaff();
  markPlaying();
  scheduleSave();
}

function clearPins() {
  state.ui.pins = {};
  state.ui.anchor = null;
  state.ui.autoAnchor = false;
  renderSidebar();
  restyle();
  renderStaff();
  markPlaying();
  scheduleSave();
}

// The progression

/** The progression's form of a chord read or loaded: a new id, and what was typed only when shown as the nearest. */
function newChord(c) {
  return {
    id: state.ui.nextId++,
    root: { ...c.root },
    quality: c.quality,
    role: c.role || '',
    text: c.approx ? c.text : undefined,
    approx: !!c.approx,
    beats: c.beats || DEFAULT_BEATS,
    scale: c.scale,
  };
}

function addChords(chords) {
  const { ui } = state;
  // Chords typed into an empty progression start a new one, with no name yet.
  if (!ui.chords.length) ui.title = '';
  for (const c of chords) ui.chords.push(newChord(c));
  render();
}

/**
 * A preset's chords in place of the progression, or with `append` after it; a toast, naming it
 * `label`, offers Undo. Replacing starts with no voicing pinned, and `title` becomes the name
 * Save offers (so does adding to an empty progression).
 */
function loadChords(chords, title, append, label = title) {
  const { ui } = state;
  const before = { chords: ui.chords, pins: ui.pins, anchor: ui.anchor, autoAnchor: ui.autoAnchor, title: ui.title };
  const loaded = chords.map(newChord);
  if (append && ui.chords.length) ui.chords = [...ui.chords, ...loaded];
  else Object.assign(ui, { chords: loaded, pins: {}, anchor: null, autoAnchor: false, title });
  render();
  toast(`${append ? 'Added' : 'Loaded'} ${label}`, 'Undo', () => {
    Object.assign(state.ui, before);
    render();
  });
}

function loadPreset(id, append) {
  const preset = PRESETS.find((p) => p.id === id);
  loadChords(presetChords(id, state.ui.key), `${preset.name} in ${presetKey(id, state.ui.key)}`, append);
}

function loadSaved(id, append) {
  const preset = state.ui.saved.find((p) => p.id === id);
  if (preset) loadChords(preset.chords, preset.name, append, `“${preset.name}”`);
}

/** Save: a name field under My presets, with the name of the preset loaded last, or the chords. */
function startSaving() {
  const { ui } = state;
  if (!ui.chords.length) return;
  const field = $('#save-name');
  const chords = ui.chords.map(chordSymbol).join(' ');
  field.value = ui.title || (chords.length > 40 ? `${chords.slice(0, 39)}…` : chords);
  $('#save-form').hidden = false;
  field.focus();
  field.select();
}

function stopSaving() {
  $('#save-form').hidden = true;
}

/** Keeps the progression under `name`; one already called that is replaced, with Undo. */
function savePreset(name) {
  const { ui } = state;
  name = name.trim();
  if (!name || !ui.chords.length) return;
  const chords = ui.chords.map(({ id, hidden, ...chord }) => ({ ...chord, root: { ...chord.root } }));
  const before = ui.saved;
  const same = ui.saved.find((p) => p.name.toLowerCase() === name.toLowerCase());
  ui.saved = same ? ui.saved.map((p) => (p === same ? { ...p, name, chords } : p)) : [...ui.saved, { id: ui.nextPresetId++, name, chords }];
  ui.title = name;
  stopSaving();
  renderSaved();
  scheduleSave();
  toast(same ? `Replaced “${name}” in My presets` : `Saved “${name}” in My presets`, same ? 'Undo' : undefined, same ? () => {
    state.ui.saved = before;
    renderSaved();
    scheduleSave();
  } : undefined);
}

/** Add chords: reads the field; what doesn't read stays in it, and a toast says so. */
function addFromField() {
  const input = $('#add-input');
  const { chords, bad } = parseChords(input.value);
  if (chords.length) addChords(chords);
  input.value = bad.join(' ');
  hideSuggestions();
  if (bad.length) toast(`Couldn't read ${bad.map((t) => `“${t}”`).join(', ')}. ${CHORD_HELP}`);
}

// Suggestions under Add chords (suggestChords in theory.js): for the chord the caret is in, the
// chords that fit what's typed so far. ↓ and ↑ choose one; Enter or a click puts it in and adds
// the field, Tab only puts it in (to type more), Esc closes them.

/** The chord symbol being typed: from the last separator before the caret, up to the caret. */
function typedToken(input) {
  const before = input.value.slice(0, input.selectionStart ?? input.value.length);
  const token = /[^\s,;|]*$/.exec(before)[0];
  return { token, start: before.length - token.length, end: before.length };
}

function updateSuggestions() {
  const input = $('#add-input');
  const { token, start, end } = typedToken(input);
  const items = document.activeElement === input && token ? suggestChords(token) : [];
  // One suggestion that is just what's typed adds nothing.
  const same = items.length === 1 && parseChord(token)?.quality === items[0].quality && !items[0].approx;
  state.suggest = { items: same ? [] : items, active: -1, start, end };
  renderSuggestions();
}

function hideSuggestions() {
  state.suggest = { items: [], active: -1 };
  renderSuggestions();
}

function renderSuggestions() {
  const { items, active } = state.suggest;
  const box = $('#suggest');
  const input = $('#add-input');
  box.hidden = !items.length;
  input.setAttribute('aria-expanded', String(items.length > 0));
  if (active >= 0) input.setAttribute('aria-activedescendant', `suggest-${active}`);
  else input.removeAttribute('aria-activedescendant');
  if (!items.length) return box.replaceChildren();
  const rows = items.map((s, i) => {
    const row = el('div', `suggest-item${s.approx ? ' approx' : ''}${i === active ? ' active' : ''}`);
    row.id = `suggest-${i}`;
    row.dataset.index = i;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(i === active));
    row.append(el('b', null, s.text), el('span', null, s.desc));
    return row;
  });
  box.replaceChildren(...rows, el('div', 'suggest-hint', '↑↓ choose · Enter adds · Tab completes'));
  box.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}

/** Puts suggestion `index` in place of the chord being typed; `add` then adds the whole field. */
function acceptSuggestion(index, add) {
  const input = $('#add-input');
  const { items, start, end } = state.suggest;
  const { text } = items[index];
  const rest = input.value.slice(end);
  const gap = add || /^\s/.test(rest) ? '' : ' ';
  input.value = input.value.slice(0, start) + text + gap + rest;
  const caret = start + text.length + gap.length;
  input.setSelectionRange(caret, caret);
  hideSuggestions();
  if (add) addFromField();
}

function bindSuggestions() {
  const input = $('#add-input');
  state.suggest = { items: [], active: -1 };
  input.addEventListener('input', updateSuggestions);
  input.addEventListener('focus', updateSuggestions);
  input.addEventListener('blur', hideSuggestions);
  input.addEventListener('keydown', (e) => {
    const { items, active } = state.suggest;
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      state.suggest.active = active < 0 && step < 0 ? items.length - 1 : (active + step + items.length) % items.length;
      renderSuggestions();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      acceptSuggestion(active, true);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      acceptSuggestion(Math.max(active, 0), false);
    } else if (e.key === 'Escape') {
      // Closes the suggestions only; the next Esc leaves the field.
      e.stopPropagation();
      hideSuggestions();
    }
  });
  // A press on a suggestion keeps the field's focus, so it doesn't close first.
  $('#suggest').addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.suggest-item');
    e.preventDefault();
    if (row) acceptSuggestion(Number(row.dataset.index), true);
  });
}

function deleteSaved(id) {
  const { ui } = state;
  const preset = ui.saved.find((p) => p.id === id);
  if (!preset) return;
  const before = ui.saved;
  ui.saved = ui.saved.filter((p) => p !== preset);
  renderSaved();
  scheduleSave();
  toast(`Deleted “${preset.name}”`, 'Undo', () => {
    state.ui.saved = before;
    renderSaved();
    scheduleSave();
  });
}

function removeChord(index) {
  const { ui } = state;
  const [chord] = ui.chords.splice(index, 1);
  const pin = ui.pins[chord.id];
  delete ui.pins[chord.id];
  render();
  toast(`Removed ${chordSymbol(chord)}`, 'Undo', () => {
    ui.chords.splice(Math.min(index, ui.chords.length), 0, chord);
    if (pin) ui.pins[chord.id] = pin;
    render();
  });
}

function clearChords() {
  const { ui } = state;
  if (!ui.chords.length) return;
  const before = { chords: ui.chords, pins: ui.pins, anchor: ui.anchor, autoAnchor: ui.autoAnchor, title: ui.title };
  Object.assign(ui, { chords: [], pins: {}, anchor: null, autoAnchor: false, title: '' });
  render();
  toast('Cleared the progression', 'Undo', () => {
    Object.assign(state.ui, before);
    render();
  });
}

/** Moves the chord at `from` so it ends up at `to` (initChordDrag). */
function moveChordTo(from, to) {
  const { chords } = state.ui;
  const [chord] = chords.splice(from, 1);
  chords.splice(to, 0, chord);
  render();
}

/** Double-click on a chord's name: type another symbol in its place. */
function editChord(id) {
  const { ui } = state;
  const chord = ui.chords.find((c) => c.id === id);
  const name = $(`.chord-item[data-id="${id}"] .name`);
  if (!chord || !name) return;
  const input = el('input', 'name-edit');
  input.value = chordSymbol(chord);
  const before = input.value;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Chord symbol');
  name.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    if (keep && text && text !== before) {
      const parsed = parseChord(text);
      if (parsed) {
        const same = parsed.root.letter === chord.root.letter && parsed.root.acc === chord.root.acc && parsed.quality === chord.quality;
        Object.assign(chord, { root: parsed.root, quality: parsed.quality, text: parsed.approx ? parsed.text : undefined, approx: parsed.approx });
        if (!same) {
          chord.role = '';
          chord.scale = undefined;
          delete ui.pins[chord.id];
        }
      } else {
        toast(`Couldn't read “${text}”. ${CHORD_HELP}`);
      }
    }
    render();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

/** Turns `value` on or off in `list`, keeping at least one on. */
function toggleIn(list, value) {
  const at = list.indexOf(value);
  if (at < 0) list.push(value);
  else if (list.length > 1) list.splice(at, 1);
}

function setDrop(drop) {
  state.ui.drop = drop;
  state.ui.mode = 'voicings';
  render();
}

/** Chord tones: every note of each chord on the neck, and no voicings (pins wait for them). */
function showTones() {
  state.ui.mode = 'tones';
  render();
}

function toggleView() {
  state.ui.view = state.ui.view === 'stacked' ? 'overlay' : 'stacked';
  render();
}

function toggleLabels() {
  state.ui.labels = state.ui.labels === 'intervals' ? 'notes' : 'intervals';
  render();
}

/**
 * On: the path shows at once, from the voicing pinned last, or else from the first chord's lowest
 * voicing. Off: only a voicing the user pinned stays pinned; the ones the path chose go.
 */
function toggleScales() {
  state.ui.scales = !state.ui.scales;
  render();
}

function toggleLeading() {
  const { ui } = state;
  if (ui.mode === 'tones') return; // no voicings to lead
  ui.leading = !ui.leading;
  if (ui.leading) {
    if (!relead()) startPath();
  } else {
    const kept = !ui.autoAnchor && ui.anchor != null ? ui.pins[ui.anchor] : null;
    ui.pins = kept ? { [ui.anchor]: kept } : {};
    if (!kept) ui.anchor = null;
    ui.autoAnchor = false;
  }
  render();
}

// Settings

function openSettings() {
  renderSettings();
  $('#settings').hidden = false;
  checkForUpdate();
}

// Updates (update.rs, docs/development.md#updates)

/** Asks GitHub whether a newer release exists. Failures (offline, nothing released yet) stay quiet. */
async function checkForUpdate() {
  try {
    state.update = await backend.checkUpdate();
  } catch (e) {
    console.warn(e);
    return;
  }
  renderUpdate();
}

/** Update to X in Settings, and a dot on the Settings button while it waits there. */
function renderUpdate() {
  const button = $('#update');
  button.hidden = !state.update;
  if (state.update && !button.disabled) button.textContent = `Update to ${state.update}`;
  $('#open-settings').classList.toggle('has-update', Boolean(state.update));
  $('#open-settings').title = state.update ? `Version ${state.update} is available` : '';
}

/**
 * Downloads and installs the update. On Windows the app closes and the installer opens it again
 * when it's done; on macOS the app quits and opens again.
 */
async function installUpdate() {
  const button = $('#update');
  button.disabled = true;
  button.textContent = 'Updating…';
  try {
    await backend.installUpdate();
  } catch (e) {
    toast(String(e));
    button.disabled = false;
    renderUpdate();
    // Installing used up the update that was found; find it again.
    checkForUpdate();
  }
}

function closeSettings() {
  $('#settings').hidden = true;
}

function renderSettings() {
  for (const b of $$('#theme button')) b.setAttribute('aria-checked', String(b.dataset.theme === state.theme));
  $('#left-handed').checked = state.ui.leftHanded;
  $('#open-strings').checked = state.ui.openStrings;
  for (const [id, key] of [['#numbers-above', 'numbersAbove'], ['#numbers-below', 'numbersBelow']]) {
    for (const b of $$(`${id} button`)) b.setAttribute('aria-checked', String(b.dataset.numbers === state.ui[key]));
  }
}

/** Rust sets the window's theme (and so `prefers-color-scheme`) and saves it; the page follows at once. */
async function setTheme(theme) {
  try {
    await backend.setTheme(theme);
    state.theme = theme;
    applyTheme(theme);
    renderSettings();
  } catch (e) {
    toast(String(e));
  }
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

// Toast

let toastTimer = 0;
let toastAction = null;

/** A message at the bottom, with an optional button such as Undo (also Z). */
function toast(text, label, action) {
  $('#toast-text').textContent = text;
  const button = $('#toast-action');
  button.hidden = !action;
  button.textContent = label || '';
  toastAction = action || null;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
  $('#toast').hidden = true;
  toastAction = null;
}

function runToastAction() {
  const action = toastAction;
  hideToast();
  action?.();
}

let saveTimer = 0;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => backend.saveUi(state.ui).catch((e) => toast(String(e))), SAVE_DELAY_MS);
}

// Window

/** The app draws its own title bar; see docs/ui.md#title-bar. */
function initTitleBar() {
  if (!tauri || (!IS_MAC && !IS_WINDOWS)) return;
  const root = document.documentElement;
  root.classList.add('own-title-bar', IS_MAC ? 'mac' : 'win');
  // "deep": anywhere inside drags the window, except on buttons and fields.
  for (const node of [$('.brand'), $('#toolbar')]) node.dataset.tauriDragRegion = 'deep';
  const win = tauri.window.getCurrentWindow();
  if (IS_MAC) {
    // In full screen the system hides its window buttons, so the brand moves up into their room.
    const fullScreen = async () => root.classList.toggle('full-screen', await win.isFullscreen());
    fullScreen();
    win.onResized(fullScreen);
    return;
  }
  $('#window-buttons').hidden = false;
  $('#win-min').addEventListener('click', () => win.minimize());
  $('#win-max').addEventListener('click', () => win.toggleMaximize());
  $('#win-close').addEventListener('click', () => win.close());
  const showMaximized = async () => {
    const maximized = await win.isMaximized();
    const button = $('#win-max');
    button.textContent = maximized ? '' : '';
    button.title = maximized ? 'Restore Down' : 'Maximize'; // Windows' own names
    button.setAttribute('aria-label', button.title);
  };
  showMaximized();
  win.onResized(showMaximized);
  // The buttons dim while another window is in front, as Windows' own do.
  win.onFocusChanged(({ payload: focused }) => root.classList.toggle('inactive', !focused));
}

// Events

function isTyping(e) {
  return !!e.target.closest?.('input, textarea, select, [contenteditable]');
}

/** The key for a shortcut: the letter typed, or with another layout (Russian, say) the key's place. */
function shortcutKey(e) {
  if (/^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase();
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.key;
}

function onKey(e) {
  const card = $$('.sound-card').find((c) => !c.hidden);
  if (e.key === 'Escape' && card) {
    showCard(null);
    $(`[aria-controls="${card.id}"]`).focus();
    return;
  }
  if (e.key === 'Escape') {
    if (!$('#settings').hidden) closeSettings();
    else if (isTyping(e)) e.target.blur();
    // Pins only show with voicings; Chord tones keeps them for when they're back.
    else if (state.ui.mode === 'voicings' && Object.keys(state.ui.pins).length) clearPins();
    return;
  }
  if (!$('#settings').hidden || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
  const key = shortcutKey(e);
  // As the buttons go: 1 Chord tones, 2 Drop 2, 3 Drop 3, 4 Drop 2&4.
  if (key === '1') showTones();
  else if (['2', '3', '4'].includes(key)) setDrop(Object.keys(DROPS)[Number(key) - 2]);
  else if (key === 'v') toggleView();
  else if (key === 'n') toggleLabels();
  else if (key === 'l') toggleLeading();
  else if (key === 's') toggleScales();
  else if (key === ' ' && !e.target.closest?.('button, select')) togglePlay();
  else if (key === 'z' && toastAction) runToastAction();
  else if (key === 'a') {
    e.preventDefault();
    $('#add-input').focus();
  } else return;
  e.preventDefault();
}

function bindEvents() {
  document.addEventListener('keydown', onKey);
  // In the app the web view's own menu (Back, Reload, Print) means nothing. Fields keep it, for
  // Cut, Copy and Paste, and with Shift it shows anywhere (Inspect, in the test app).
  if (tauri) {
    document.addEventListener('contextmenu', (e) => {
      // Only where text is typed: sliders, checkboxes and lists have nothing to cut or paste.
      const text = e.target.closest?.('textarea, [contenteditable], input:not([type="range"], [type="checkbox"], [type="radio"])');
      if (!text && !e.shiftKey) e.preventDefault();
    });
  }

  // Sidebar
  initChordDrag();
  $('#chords').addEventListener('click', (e) => {
    const item = e.target.closest('.chord-item');
    if (!item || state.suppressClick) return;
    const index = state.ui.chords.findIndex((c) => c.id === Number(item.dataset.id));
    const chord = state.ui.chords[index];
    const action = e.target.closest('button[data-action]')?.dataset.action;
    if (action === 'hide') {
      chord.hidden = !chord.hidden;
      render();
    } else if (action === 'remove') {
      removeChord(index);
    } else if (!action && !e.target.closest('input, select')) {
      // The chord's fretboard comes into view.
      $(`.row[data-chord="${chord.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  $('#chords').addEventListener('dblclick', (e) => {
    const name = e.target.closest('.name');
    if (name) editChord(Number(name.closest('.chord-item').dataset.id));
  });
  // A chord's length (the select on its notes' line).
  $('#chords').addEventListener('change', (e) => {
    const chord = state.ui.chords.find((c) => c.id === Number(e.target.dataset.lengthFor));
    if (!chord) return;
    chord.beats = Number(e.target.value);
    render();
  });
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    addFromField();
  });
  bindSuggestions();
  $('#clear').addEventListener('click', clearChords);
  $('#key').addEventListener('change', (e) => {
    state.ui.key = e.target.value;
    renderSidebar();
    scheduleSave();
  });
  // Presets: a click puts one in place of the progression, its + adds it to the end.
  $('#presets').addEventListener('click', (e) => {
    const item = e.target.closest('.preset');
    if (item) loadPreset(item.dataset.preset, !!e.target.closest('.append'));
  });
  $('#empty-add').addEventListener('click', () => loadPreset('ii-V-I', false));
  // My presets: the same, and Delete; Save names the progression in a field above them.
  $('#saved').addEventListener('click', (e) => {
    const item = e.target.closest('.saved-item');
    if (!item) return;
    const id = Number(item.dataset.id);
    const action = e.target.closest('button[data-action]')?.dataset.action;
    if (action === 'delete') deleteSaved(id);
    else loadSaved(id, action === 'append');
  });
  $('#save-preset').addEventListener('click', startSaving);
  $('#save-form').addEventListener('submit', (e) => {
    e.preventDefault();
    savePreset($('#save-name').value);
  });
  $('#save-name').addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    stopSaving();
  });
  $('#save-name').addEventListener('blur', stopSaving);
  $('#open-settings').addEventListener('click', openSettings);

  // Toolbar. A double-click on a string set or inversion shows only that one.
  $('#drop').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.drop) setDrop(b.dataset.drop);
    else if (b) showTones();
  });
  $('#sets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-set]');
    if (!b) return;
    toggleIn(state.ui.sets[state.ui.drop], b.dataset.set);
    render();
  });
  $('#sets').addEventListener('dblclick', (e) => {
    const b = e.target.closest('button[data-set]');
    if (!b) return;
    state.ui.sets[state.ui.drop] = [b.dataset.set];
    render();
  });
  $('#inversions').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-inversion]');
    if (!b) return;
    toggleIn(state.ui.inversions, Number(b.dataset.inversion));
    render();
  });
  $('#inversions').addEventListener('dblclick', (e) => {
    const b = e.target.closest('button[data-inversion]');
    if (!b) return;
    state.ui.inversions = [Number(b.dataset.inversion)];
    render();
  });
  $('#labels').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-labels]');
    if (!b) return;
    state.ui.labels = b.dataset.labels;
    render();
  });
  $('#view').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    state.ui.view = b.dataset.view;
    render();
  });
  $('#leading').addEventListener('click', toggleLeading);
  $('#all-notes').addEventListener('click', () => {
    state.ui.allNotes = !state.ui.allNotes;
    render();
  });
  $('#scales').addEventListener('click', toggleScales);
  $('#staff-toggle').addEventListener('click', () => {
    state.ui.staff = !state.ui.staff;
    render();
  });
  $('#staff-shows').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-shows]');
    if (!b) return;
    state.ui.staffShows = b.dataset.shows;
    render();
  });

  // The metronome
  $('#play').addEventListener('click', togglePlay);
  // The click's and the chords' sound: a card each, opening from its button and closing on a click
  // elsewhere or Esc. A new chords' sound starts with the next bar; volumes and Space change at once.
  for (const button of ['#click-button', '#sound-button']) {
    $(button).addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('aria-controls');
      showCard($('#' + id).hidden ? id : null);
    });
  }
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sound-pick')) showCard(null);
  });
  for (const [list, key] of [['#sounds', 'sound'], ['#clicks', 'click'], ['#grooves', 'groove']]) {
    $(list).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-choice]');
      if (!b) return;
      state.ui[key] = b.dataset.choice;
      renderSound();
      scheduleSave();
    });
  }
  for (const [id, key] of [['space', 'space'], ['volume', 'volume'], ['click-volume', 'clickVolume']]) {
    $('#' + id).addEventListener('input', (e) => {
      state.ui[key] = Number(e.target.value);
      setMix();
      scheduleSave();
    });
  }
  // The swing feel applies from the next beat; its ratio shows as it moves.
  $('#swing').addEventListener('input', (e) => {
    state.ui.swing = Number(e.target.value);
    renderSound();
    scheduleSave();
  });
  $('#bass').addEventListener('change', (e) => {
    state.ui.bass = e.target.checked;
    scheduleSave();
  });
  // The tempo: the slider, or a number typed (taken while it's one the slider has, set right on leaving).
  const setTempo = (bpm) => {
    state.ui.bpm = bpm;
    $('#tempo').value = bpm;
    $('#tempo-number').value = bpm;
    scheduleSave();
  };
  $('#tempo').addEventListener('input', (e) => setTempo(Number(e.target.value)));
  $('#tempo-number').addEventListener('input', (e) => {
    const bpm = Number(e.target.value);
    if (Number.isInteger(bpm) && bpm >= BPM_RANGE[0] && bpm <= BPM_RANGE[1]) {
      state.ui.bpm = bpm;
      $('#tempo').value = bpm;
      scheduleSave();
    }
  });
  $('#tempo-number').addEventListener('change', (e) => {
    const bpm = Math.round(Number(e.target.value));
    setTempo(Number.isFinite(bpm) && e.target.value !== '' ? Math.min(BPM_RANGE[1], Math.max(BPM_RANGE[0], bpm)) : state.ui.bpm);
  });
  $('#tempo-number').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  $('#player').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-option]');
    if (!b) return;
    const key = b.dataset.option;
    state.ui[key] = !state.ui[key];
    b.setAttribute('aria-pressed', String(state.ui[key]));
    if (key === 'follow' && player.playing) {
      renderPlayer();
      renderBoards();
      markPlaying();
    }
    scheduleSave();
  });
  // The boards follow the slider as it moves, at most once a frame; a double-click goes back to
  // the view's default height.
  $('#height').addEventListener('input', (e) => setHeight(Number(e.target.value)));
  $('#height').addEventListener('dblclick', () => setHeight(GAPS[state.ui.view]));
  $('#fit').addEventListener('click', fitHeight);
  $('#frets').addEventListener('change', (e) => {
    state.ui.frets = Number(e.target.value);
    render();
  });

  // Fretboards. A chord's scale is chosen over its board (Scales on).
  const boards = $('#boards');
  boards.addEventListener('change', (e) => {
    const chord = state.ui.chords.find((c) => c.id === Number(e.target.dataset.scaleFor));
    if (!chord) return;
    chord.scale = e.target.value;
    render();
  });
  boards.addEventListener('pointerover', (e) => {
    const node = e.target.closest?.('[data-v]') || null;
    if (node === (state.hover?.node || null)) return;
    state.hover = node ? { keys: new Set(node.dataset.v.split(' ')), board: node.closest('.board'), node } : null;
    restyle();
  });
  boards.addEventListener('pointerleave', () => {
    moveBand(-1);
    if (!state.hover) return;
    state.hover = null;
    restyle();
  });
  boards.addEventListener('pointermove', (e) => {
    const first = $('#boards .board');
    moveBand(first && state.geo ? state.geo.fretAt(e.clientX - first.getBoundingClientRect().left) : -1);
  });
  boards.addEventListener('click', (e) => {
    const node = e.target.closest?.('[data-v]');
    if (node) pinFrom(node);
  });

  // Settings
  $('#close-settings').addEventListener('click', closeSettings);
  $('#about').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-href]');
    if (!link) return;
    e.preventDefault();
    backend.openLink(link.dataset.href).catch((error) => toast(String(error)));
  });
  $('#settings').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  $('#theme').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme]');
    if (b) setTheme(b.dataset.theme);
  });
  $('#left-handed').addEventListener('change', (e) => {
    state.ui.leftHanded = e.target.checked;
    render();
  });
  $('#open-strings').addEventListener('change', (e) => {
    state.ui.openStrings = e.target.checked;
    render();
  });
  for (const [id, key] of [['#numbers-above', 'numbersAbove'], ['#numbers-below', 'numbersBelow']]) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-numbers]');
      if (!b) return;
      state.ui[key] = b.dataset.numbers;
      renderSettings();
      render();
    });
  }

  $('#toast-action').addEventListener('click', runToastAction);
  $('#update').addEventListener('click', installUpdate);
}

/** The chords' sound: the button names it, and the card shows the choice and its settings. */
function renderSound() {
  const { ui } = state;
  $('#sound-name').textContent = SOUNDS[ui.sound].name;
  $('#sound-button').setAttribute('aria-pressed', String(ui.sound !== 'off'));
  for (const b of $$('#sounds button')) b.setAttribute('aria-checked', String(b.dataset.choice === ui.sound));
  $('#space').value = ui.space;
  $('#volume').value = ui.volume;
  $('#bass').checked = ui.bass;
  $('#click-name').textContent = CLICKS[ui.click].name;
  $('#click-button').setAttribute('aria-pressed', String(ui.click !== 'off'));
  for (const b of $$('#clicks button')) b.setAttribute('aria-checked', String(b.dataset.choice === ui.click));
  $('#click-volume').value = ui.clickVolume;
  for (const b of $$('#grooves button')) b.setAttribute('aria-checked', String(b.dataset.choice === ui.groove));
  // The swing's slider, only with Swing, saying the long eighth against the short: 2:1 a triplet.
  $('#swing-row').hidden = ui.groove !== 'swing';
  $('#swing').value = ui.swing;
  $('#swing-ratio').textContent = `${Math.round((ui.swing / (100 - ui.swing)) * 10) / 10}:1`;
  if (ui.groove !== 'every') $('#click-name').textContent += ` · ${GROOVES[ui.groove].name}`;
}

/** Opens one sound card (`#sound-card` or `#click-card`), or closes them all with null. */
function showCard(id) {
  for (const card of $$('.sound-card')) {
    const open = card.id === id;
    card.hidden = !open;
    $(`[aria-controls="${card.id}"]`).setAttribute('aria-expanded', String(open));
  }
}

function fillControls() {
  // The choices on the sound cards, a button each.
  const choices = (list, sounds) =>
    $(list).replaceChildren(
      ...Object.entries(sounds).map(([key, sound]) => {
        const b = el('button', null, sound.name);
        b.dataset.choice = key;
        b.setAttribute('role', 'radio');
        return b;
      }),
    );
  choices('#sounds', SOUNDS);
  choices('#clicks', CLICKS);
  choices('#grooves', GROOVES);
  $('#key').replaceChildren(
    ...KEYS.map((k) => {
      const option = el('option', null, k);
      option.value = k;
      return option;
    }),
  );
  // A preset is two buttons in one pill: its name loads it, the + that shows under the mouse adds it.
  $('#presets').replaceChildren(
    ...PRESETS.map((p) => {
      const item = el('div', 'preset');
      item.dataset.preset = p.id;
      const append = el('button', 'append');
      append.innerHTML = ICONS.plus;
      item.append(el('button', 'load', p.name), append);
      return item;
    }),
  );
  $('#frets').replaceChildren(
    ...FRET_CHOICES.map((n) => {
      const option = el('option', null, String(n));
      option.value = n;
      return option;
    }),
  );
}

async function init() {
  initTitleBar();
  fillControls();
  bindEvents();
  try {
    const saved = await backend.load();
    state.theme = ['light', 'dark'].includes(saved?.theme) ? saved.theme : 'system';
    state.ui = sanitize(saved?.ui);
  } catch (e) {
    toast(String(e));
  }
  applyTheme(state.theme);
  render();
  backend
    .version()
    .then((version) => {
      $('#app-version').textContent = version;
    })
    .catch(() => {});
  setTimeout(checkForUpdate, FIRST_UPDATE_CHECK_MS);
  setInterval(checkForUpdate, UPDATE_CHECK_MS);
  // A new width redraws the boards; their height is the user's (Height).
  new ResizeObserver(() => {
    requestAnimationFrame(() => {
      const boards = $('#boards');
      // A new width redraws the boards; so does a new height while Follow fits them to it.
      const resized = boards.clientWidth !== state.boardsWidth || (following() && boards.clientHeight !== state.boardsHeight);
      if (boards.hidden || !resized) return;
      renderBoards();
      renderStaff();
      markPlaying();
    });
  }).observe($('#boards'));
}

init();
