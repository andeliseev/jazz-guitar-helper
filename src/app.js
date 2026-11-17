// Jazz Guitar Drop Helper: the page. State, rendering, the mouse and keyboard, Settings.
// Music theory is in theory.js, drawing the fretboards in fretboard.js. docs/ui.md describes it.

import {
  DROPS,
  KEYS,
  PRESETS,
  STRING_NAMES,
  chordName,
  chordTones,
  fretText,
  inversionName,
  parseChord,
  parseChords,
  presetChords,
  presetKey,
  voiceLead,
  voicings,
} from './theory.js';
import { boardMarkup, geometry, notesMarkup, rulerMarkup } from './fretboard.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Chord colors .c0 to .c7 in styles.css, by the chord's place in the progression.
const COLORS = 8;
const FRET_CHOICES = [12, 15, 17, 20, 22, 24];
// Pixels between strings: a board per chord, or one taller board for all of them, as tall as the
// window allows between these.
const STACKED_GAP = 20;
const OVERLAY_GAP = [30, 40];
const MAX_DOT_RADIUS = 11.5;
const RULER_HEIGHT = 22;
const SAVE_DELAY_MS = 300;
const TOAST_MS = 6000;
const CHORD_HELP = 'Try symbols like Dm7, G7, Cmaj7, Bø or E♭°7.';

const tauri = window.__TAURI__;
const IS_MAC = navigator.userAgent.includes('Macintosh');
const IS_WINDOWS = navigator.userAgent.includes('Windows');

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
      version: () => tauri.app.getVersion(),
    }
  : {
      load: async () => ({ theme: readLocal('theme') || 'system', ui: JSON.parse(readLocal('ui') || 'null') }),
      saveUi: async (ui) => writeLocal('ui', JSON.stringify(ui)),
      setTheme: async (theme) => writeLocal('theme', theme),
      version: async () => 'in a browser',
    };

function readLocal(key) {
  try {
    return localStorage.getItem(`drop-helper.${key}`);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(`drop-helper.${key}`, value);
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
    key: 'C',
    drop: 'drop2',
    sets: { drop2: ['4321'], drop3: ['6432'], drop24: ['6532'] },
    inversions: [0, 1, 2, 3],
    labels: 'intervals',
    view: 'stacked',
    leading: false,
    // The pinned voicing of each chord (chord id → voicing id), and the chord last clicked,
    // which voice leading starts from.
    pins: {},
    anchor: null,
    frets: 15,
    leftHanded: false,
    openStrings: true,
  };
}

/** The saved state, with anything missing or out of date replaced by the defaults. */
function sanitize(saved) {
  const ui = defaultUi();
  if (!saved || typeof saved !== 'object') return ui;
  if (Array.isArray(saved.chords)) {
    ui.chords = saved.chords
      .filter((c) => c && Number.isInteger(c.id) && c.root && Number.isInteger(c.root.letter) && Number.isInteger(c.root.acc))
      .filter((c) => c.root.letter >= 0 && c.root.letter < 7 && Math.abs(c.root.acc) <= 2)
      .filter((c) => chordTonesOk(c))
      .map((c) => ({
        id: c.id,
        root: { letter: c.root.letter, acc: c.root.acc },
        quality: c.quality,
        role: typeof c.role === 'string' ? c.role : '',
        text: typeof c.text === 'string' ? c.text : undefined,
        approx: !!c.approx,
        hidden: !!c.hidden,
      }));
  }
  ui.nextId = Math.max(Number.isInteger(saved.nextId) ? saved.nextId : 1, ...ui.chords.map((c) => c.id + 1), 1);
  if (KEYS.includes(saved.key)) ui.key = saved.key;
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
  ui.leading = !!saved.leading;
  if (saved.pins && typeof saved.pins === 'object') {
    for (const [id, pin] of Object.entries(saved.pins)) if (typeof pin === 'string') ui.pins[id] = pin;
  }
  if (Number.isInteger(saved.anchor)) ui.anchor = saved.anchor;
  if (FRET_CHOICES.includes(saved.frets)) ui.frets = saved.frets;
  ui.leftHanded = !!saved.leftHanded;
  ui.openStrings = saved.openStrings !== false;
  return ui;
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
  // The chords on the fretboard (not hidden): { chord, cls, tones, voicings }.
  rows: [],
  // The boards' geometry, the boards' width it was made for, and the fret under the mouse.
  geo: null,
  boardsWidth: 0,
  boardsHeight: 0,
  bandFret: -1,
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
  state.rows = [];
  ui.chords.forEach((chord, index) => {
    if (chord.hidden) return;
    state.rows.push({ chord, cls: `c${index % COLORS}`, tones: chordTones(chord), voicings: chordVoicings(chord) });
  });
  if (ui.leading) relead();
}

/** With voice leading on: the other chords' pins follow the pinned voicing of the anchor chord. */
function relead() {
  const { ui } = state;
  const anchor = state.rows.findIndex((row) => row.chord.id === ui.anchor);
  if (anchor < 0) return;
  const start = state.rows[anchor].voicings.find((v) => v.id === ui.pins[ui.anchor]);
  if (!start) return;
  const path = voiceLead(state.rows.map((row) => row.voicings), anchor, start);
  ui.pins = {};
  path.forEach((v, i) => {
    if (v) ui.pins[state.rows[i].chord.id] = v.id;
  });
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
  scheduleSave();
}

function renderSidebar() {
  const { ui } = state;
  $('#chords').replaceChildren(...ui.chords.map((chord, index) => chordItem(chord, index)));
  $('#clear').hidden = ui.chords.length === 0;
  $('#key').value = ui.key;
  for (const button of $$('#presets button')) {
    const preset = PRESETS.find((p) => p.id === button.dataset.preset);
    button.title = `Add ${preset.name} in ${presetKey(preset.id, ui.key)}`;
  }
}

function chordItem(chord, index) {
  const item = el('div', `chord-item c${index % COLORS}${chord.hidden ? ' off' : ''}`);
  item.dataset.id = chord.id;
  const head = el('div', 'item-head');
  const name = el('span', 'name', chordName(chord));
  name.title = 'Double-click to change';
  head.append(el('span', 'dot'), name);
  if (chord.role) head.append(el('span', 'role', chord.role));
  // Shown as the nearest chord the app voices: "from Cmaj9".
  if (chord.approx && chord.text) head.append(el('span', 'from', `from ${chord.text}`));
  item.append(head, el('div', 'notes', chordTones(chord).map((t) => t.name).join(' ')));
  const pinned = pinnedVoicing(chord);
  if (pinned) {
    const frets = el('div', 'frets', fretText(pinned));
    frets.title = `${inversionName(pinned)}, pinned`;
    item.append(frets);
  }
  item.append(itemActions(chord, index));
  return item;
}

function itemActions(chord, index) {
  const box = el('div', 'item-actions');
  const button = (action, icon, title, className) => {
    const b = el('button', className);
    b.dataset.action = action;
    b.innerHTML = icon;
    b.title = title;
    b.setAttribute('aria-label', title);
    return b;
  };
  const up = button('up', ICONS.up, 'Move up');
  const down = button('down', ICONS.down, 'Move down');
  up.disabled = index === 0;
  down.disabled = index === state.ui.chords.length - 1;
  box.append(
    button('hide', chord.hidden ? ICONS.eyeOff : ICONS.eye, chord.hidden ? 'Show on the fretboard' : 'Hide from the fretboard'),
    up,
    down,
    button('remove', ICONS.remove, 'Remove', 'danger'),
  );
  return box;
}

function renderToolbar() {
  const { ui } = state;
  for (const b of $$('#drop button')) b.setAttribute('aria-checked', String(b.dataset.drop === ui.drop));
  const chosen = ui.sets[ui.drop];
  $('#sets').replaceChildren(
    ...DROPS[ui.drop].sets.map((set) => {
      const strings = [...set];
      const b = el('button', 'chip', strings.join('-'));
      b.dataset.set = set;
      b.setAttribute('aria-pressed', String(chosen.includes(set)));
      b.title = `Strings ${strings.slice(0, 3).join(', ')} and ${strings[3]} (${strings.map((s) => STRING_NAMES[s]).join(' ')}). Double-click to show only these.`;
      return b;
    }),
  );
  for (const b of $$('#inversions button')) b.setAttribute('aria-pressed', String(ui.inversions.includes(Number(b.dataset.inversion))));
  for (const b of $$('#labels button')) b.setAttribute('aria-checked', String(b.dataset.labels === ui.labels));
  for (const b of $$('#view button')) b.setAttribute('aria-checked', String(b.dataset.view === ui.view));
  $('#leading').setAttribute('aria-pressed', String(ui.leading));
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
      : 'Add chords to see all their drop voicings on the neck.';
    $('#empty-add').hidden = ui.chords.length > 0;
    $('#empty-add').textContent = `Add ii–V–I in ${ui.key}`;
    return;
  }
  const style = getComputedStyle(boards);
  state.boardsWidth = boards.clientWidth;
  state.boardsHeight = boards.clientHeight;
  const width = Math.floor(boards.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  const overlay = ui.view === 'overlay';
  // The board is 6.6 gaps tall; the fret numbers, legend and info line take about 110 px.
  const fit = Math.floor((boards.clientHeight - 110) / 6.6);
  const gap = overlay ? Math.max(OVERLAY_GAP[0], Math.min(OVERLAY_GAP[1], fit)) : STACKED_GAP;
  const geo = geometry(width, ui.frets, { gap, leftHanded: ui.leftHanded });
  state.geo = geo;
  const nodes = [ruler(geo)];
  if (overlay) nodes.push(overlayView(geo));
  else for (const row of state.rows) nodes.push(stackedRow(row, geo));
  boards.replaceChildren(...nodes);
  restyle();
}

function svgNode(width, height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return svg;
}

function ruler(geo) {
  const wrap = el('div', 'ruler');
  const svg = svgNode(geo.width, RULER_HEIGHT);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = rulerMarkup(geo, RULER_HEIGHT);
  wrap.append(svg);
  return wrap;
}

/** What a board draws for a chord: its voicings, each note labeled as chosen. */
function layerOf(row) {
  const names = state.ui.labels === 'notes';
  return {
    cls: row.cls,
    voicings: row.voicings.map((v) => ({
      id: v.key,
      notes: v.notes.map((n) => ({ string: n.string, fret: n.fret, label: names ? n.tone.name : n.tone.label, root: n.tone.deg === 1 })),
    })),
  };
}

function board(geo, layers, label) {
  const svg = svgNode(geo.width, geo.height);
  svg.setAttribute('class', 'board');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.innerHTML = boardMarkup(geo) + notesMarkup(geo, layers, { radius: Math.min(geo.gap * 0.46, MAX_DOT_RADIUS) });
  return svg;
}

function stackedRow(row, geo) {
  const section = el('section', `row ${row.cls}`);
  section.dataset.chord = row.chord.id;
  const head = el('header', 'row-head');
  head.append(el('span', 'dot'), el('span', 'row-name', chordName(row.chord)), el('span', 'row-notes', row.tones.map((t) => t.name).join(' ')));
  if (row.chord.role) head.append(el('span', 'row-role', row.chord.role));
  const info = el('span', 'row-info');
  info.dataset.chord = row.chord.id;
  head.append(info);
  section.append(head, board(geo, [layerOf(row)], `${chordName(row.chord)}: ${DROPS[state.ui.drop].name} voicings`));
  if (!row.voicings.length) section.append(el('p', 'row-none', 'No voicings with these strings and inversions.'));
  return section;
}

function overlayView(geo) {
  const section = el('section', 'overlay-view');
  const legend = el('div', 'legend');
  for (const row of state.rows) {
    const item = el('span', `legend-item ${row.cls}`);
    item.dataset.chord = row.chord.id;
    item.append(el('span', 'dot'), el('b', null, chordName(row.chord)));
    if (row.chord.role) item.append(el('span', 'row-role', row.chord.role));
    item.append(el('span', 'frets'));
    legend.append(item);
  }
  section.append(legend, board(geo, state.rows.map(layerOf), `All chords: ${DROPS[state.ui.drop].name} voicings`), el('div', 'overlay-info'));
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
        path.push(`${chordName(row.chord)} `, el('b', null, fretText(v)));
      }
      info.replaceChildren(...path);
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
  if (withChord) parts.push(`${chordName(state.ui.chords.find((c) => c.id === chordOfKey(v.key)))} · `);
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
    if (ui.leading) relead();
  } else if (ui.leading) {
    // The path comes from one voicing, so it goes as a whole.
    ui.pins = {};
    ui.anchor = null;
  } else {
    delete ui.pins[chordId];
  }
  renderSidebar();
  restyle();
  scheduleSave();
}

function clearPins() {
  state.ui.pins = {};
  state.ui.anchor = null;
  renderSidebar();
  restyle();
  scheduleSave();
}

// The progression

function addChords(chords) {
  const { ui } = state;
  for (const c of chords) {
    ui.chords.push({ id: ui.nextId++, root: c.root, quality: c.quality, role: c.role || '', text: c.approx ? c.text : undefined, approx: !!c.approx });
  }
  render();
}

function removeChord(index) {
  const { ui } = state;
  const [chord] = ui.chords.splice(index, 1);
  const pin = ui.pins[chord.id];
  delete ui.pins[chord.id];
  render();
  toast(`Removed ${chordName(chord)}`, 'Undo', () => {
    ui.chords.splice(Math.min(index, ui.chords.length), 0, chord);
    if (pin) ui.pins[chord.id] = pin;
    render();
  });
}

function clearChords() {
  const { ui } = state;
  if (!ui.chords.length) return;
  const before = { chords: ui.chords, pins: ui.pins, anchor: ui.anchor };
  Object.assign(ui, { chords: [], pins: {}, anchor: null });
  render();
  toast('Cleared the progression', 'Undo', () => {
    Object.assign(state.ui, before);
    render();
  });
}

function moveChord(index, by) {
  const { chords } = state.ui;
  const to = index + by;
  if (to < 0 || to >= chords.length) return;
  [chords[index], chords[to]] = [chords[to], chords[index]];
  render();
}

/** Double-click on a chord's name: type another symbol in its place. */
function editChord(id) {
  const { ui } = state;
  const chord = ui.chords.find((c) => c.id === id);
  const name = $(`.chord-item[data-id="${id}"] .name`);
  if (!chord || !name) return;
  const input = el('input', 'name-edit');
  input.value = chord.approx && chord.text ? chord.text : chordName(chord);
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
    if (keep && text && text !== chordName(chord)) {
      const parsed = parseChord(text);
      if (parsed) {
        const same = parsed.root.letter === chord.root.letter && parsed.root.acc === chord.root.acc && parsed.quality === chord.quality;
        Object.assign(chord, { root: parsed.root, quality: parsed.quality, text: parsed.approx ? parsed.text : undefined, approx: parsed.approx });
        if (!same) {
          chord.role = '';
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

function toggleLeading() {
  state.ui.leading = !state.ui.leading;
  render();
}

// Settings

function openSettings() {
  renderSettings();
  $('#settings').hidden = false;
}

function closeSettings() {
  $('#settings').hidden = true;
}

function renderSettings() {
  for (const b of $$('#theme button')) b.setAttribute('aria-checked', String(b.dataset.theme === state.theme));
  for (const b of $$('#frets button')) b.setAttribute('aria-checked', String(Number(b.dataset.frets) === state.ui.frets));
  $('#left-handed').checked = state.ui.leftHanded;
  $('#open-strings').checked = state.ui.openStrings;
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
  if (e.key === 'Escape') {
    if (!$('#settings').hidden) closeSettings();
    else if (isTyping(e)) e.target.blur();
    else if (Object.keys(state.ui.pins).length) clearPins();
    return;
  }
  if (!$('#settings').hidden || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
  const key = shortcutKey(e);
  if (['1', '2', '3'].includes(key)) setDrop(Object.keys(DROPS)[Number(key) - 1]);
  else if (key === 'v') toggleView();
  else if (key === 'n') toggleLabels();
  else if (key === 'l') toggleLeading();
  else if (key === 'z' && toastAction) runToastAction();
  else if (key === 'a') {
    e.preventDefault();
    $('#add-input').focus();
  } else return;
  e.preventDefault();
}

function bindEvents() {
  document.addEventListener('keydown', onKey);

  // Sidebar
  $('#chords').addEventListener('click', (e) => {
    const item = e.target.closest('.chord-item');
    if (!item) return;
    const index = state.ui.chords.findIndex((c) => c.id === Number(item.dataset.id));
    const chord = state.ui.chords[index];
    const action = e.target.closest('button[data-action]')?.dataset.action;
    if (action === 'hide') {
      chord.hidden = !chord.hidden;
      render();
    } else if (action === 'up' || action === 'down') {
      moveChord(index, action === 'up' ? -1 : 1);
    } else if (action === 'remove') {
      removeChord(index);
    } else if (!action && !e.target.closest('input')) {
      // The chord's fretboard comes into view.
      $(`.row[data-chord="${chord.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  $('#chords').addEventListener('dblclick', (e) => {
    const name = e.target.closest('.name');
    if (name) editChord(Number(name.closest('.chord-item').dataset.id));
  });
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#add-input');
    const { chords, bad } = parseChords(input.value);
    if (chords.length) addChords(chords);
    input.value = bad.join(' ');
    if (bad.length) toast(`Couldn't read ${bad.map((t) => `“${t}”`).join(', ')}. ${CHORD_HELP}`);
  });
  $('#clear').addEventListener('click', clearChords);
  $('#key').addEventListener('change', (e) => {
    state.ui.key = e.target.value;
    renderSidebar();
    scheduleSave();
  });
  $('#presets').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-preset]');
    if (button) addChords(presetChords(button.dataset.preset, state.ui.key));
  });
  $('#empty-add').addEventListener('click', () => addChords(presetChords('ii-V-I', state.ui.key)));
  $('#open-settings').addEventListener('click', openSettings);

  // Toolbar. A double-click on a string set or inversion shows only that one.
  $('#drop').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-drop]');
    if (b) setDrop(b.dataset.drop);
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

  // Fretboards
  const boards = $('#boards');
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
  $('#settings').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  $('#theme').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme]');
    if (b) setTheme(b.dataset.theme);
  });
  $('#frets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-frets]');
    if (!b) return;
    state.ui.frets = Number(b.dataset.frets);
    renderSettings();
    render();
  });
  $('#left-handed').addEventListener('change', (e) => {
    state.ui.leftHanded = e.target.checked;
    render();
  });
  $('#open-strings').addEventListener('change', (e) => {
    state.ui.openStrings = e.target.checked;
    render();
  });

  $('#toast-action').addEventListener('click', runToastAction);
}

function fillControls() {
  $('#key').replaceChildren(
    ...KEYS.map((k) => {
      const option = el('option', null, k);
      option.value = k;
      return option;
    }),
  );
  $('#presets').replaceChildren(
    ...PRESETS.map((p) => {
      const b = el('button', null, p.name);
      b.dataset.preset = p.id;
      return b;
    }),
  );
  $('#frets').replaceChildren(
    ...FRET_CHOICES.map((n) => {
      const b = el('button', null, String(n));
      b.setAttribute('role', 'radio');
      b.dataset.frets = n;
      return b;
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
  // A new width redraws the boards; a new height only the overlay, which fits the height.
  new ResizeObserver(() => {
    requestAnimationFrame(() => {
      const boards = $('#boards');
      if (boards.hidden) return;
      const resized = boards.clientWidth !== state.boardsWidth || (state.ui.view === 'overlay' && boards.clientHeight !== state.boardsHeight);
      if (resized) renderBoards();
    });
  }).observe($('#boards'));
}

init();
