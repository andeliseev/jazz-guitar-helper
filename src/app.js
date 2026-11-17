// Jazz Guitar Helper: the page. State, rendering, the mouse and keyboard, Settings.
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
  notesOnNeck,
  parseChord,
  parseChords,
  presetChords,
  presetKey,
  suggestChords,
  voiceLead,
  voicings,
} from './theory.js';
import { boardMarkup, geometry, notesMarkup, rulerMarkup } from './fretboard.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Chord colors .c0 to .c7 in styles.css, by the chord's place in the progression.
const COLORS = 8;
const FRET_CHOICES = [12, 15, 17, 20, 22, 24];
// Pixels between strings, which is how tall the boards are. Each view keeps its own, set with
// Height in the toolbar: a board per chord is shorter than the one board for all of them.
const GAPS = { stacked: 20, overlay: 32 };
const GAP_RANGE = [16, 44];
const MAX_DOT_RADIUS = 14;
const RULER_HEIGHT = 22;
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
    drop: 'drop2',
    sets: { drop2: ['4321'], drop3: ['6432'], drop24: ['6532'] },
    inversions: [0, 1, 2, 3],
    labels: 'intervals',
    view: 'stacked',
    heights: { ...GAPS },
    leading: false,
    // Every note of each chord on the neck, besides its voicings.
    allNotes: false,
    // The pinned voicing of each chord (chord id → voicing id), and the chord last clicked,
    // which voice leading starts from; `autoAnchor` when the app chose it (startPath).
    pins: {},
    anchor: null,
    autoAnchor: false,
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
  if (saved.pins && typeof saved.pins === 'object') {
    for (const [id, pin] of Object.entries(saved.pins)) if (typeof pin === 'string') ui.pins[id] = pin;
  }
  if (Number.isInteger(saved.anchor)) ui.anchor = saved.anchor;
  ui.autoAnchor = !!saved.autoAnchor;
  if (FRET_CHOICES.includes(saved.frets)) ui.frets = saved.frets;
  ui.leftHanded = !!saved.leftHanded;
  ui.openStrings = saved.openStrings !== false;
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
  // The chords on the fretboard (not hidden): { chord, cls, tones, voicings }.
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
  state.rows = [];
  ui.chords.forEach((chord, index) => {
    if (chord.hidden) return;
    state.rows.push({ chord, cls: `c${index % COLORS}`, tones: chordTones(chord), voicings: chordVoicings(chord) });
  });
  // A path whose start isn't drawn any more (another drop type, other strings, its chord hidden or
  // removed) starts again from the first chord. With nothing pinned there's no path to keep.
  if (ui.leading && !relead() && Object.keys(ui.pins).length) startPath();
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
      item.append(el('div', 'saved-name', preset.name), el('div', 'saved-chords', preset.chords.map(chordName).join(' ')));
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
  item.title = 'Drag to move it in the progression';
  item.append(itemActions(chord));
  return item;
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
    if (e.button !== 0 || !item || e.target.closest('button, input')) return;
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
  $('#all-notes').setAttribute('aria-pressed', String(ui.allNotes));
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
      : 'Add chords to see all their drop voicings on the neck.';
    $('#empty-add').hidden = ui.chords.length > 0;
    $('#empty-add').textContent = `Add ii–V–I in ${ui.key}`;
    return;
  }
  const style = getComputedStyle(boards);
  state.boardsWidth = boards.clientWidth;
  const width = Math.floor(boards.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  // In Stacked each board has its own fret numbers, so a fret reads at any board without looking up.
  const geo = geometry(width, ui.frets, { gap: ui.heights[ui.view], leftHanded: ui.leftHanded, numbers: ui.view === 'stacked' });
  state.geo = geo;
  const nodes = [ruler(geo)];
  if (ui.view === 'overlay') nodes.push(overlayView(geo));
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

/**
 * What a board draws for a chord: its voicings, each note labeled as chosen, and with All notes on,
 * every other place its tones are on the neck (`extras`).
 */
function layerOf(row) {
  const { ui } = state;
  const note = (n) => ({ string: n.string, fret: n.fret, label: ui.labels === 'notes' ? n.tone.name : n.tone.label, root: n.tone.deg === 1 });
  return {
    cls: row.cls,
    voicings: row.voicings.map((v) => ({ id: v.key, notes: v.notes.map(note) })),
    extras: ui.allNotes ? notesOnNeck(row.chord, { frets: ui.frets, openStrings: ui.openStrings }).map(note) : [],
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
  scheduleSave();
}

function clearPins() {
  state.ui.pins = {};
  state.ui.anchor = null;
  state.ui.autoAnchor = false;
  renderSidebar();
  restyle();
  scheduleSave();
}

// The progression

/** The progression's form of a chord read or loaded: a new id, and what was typed only when shown as the nearest. */
function newChord(c) {
  return { id: state.ui.nextId++, root: { ...c.root }, quality: c.quality, role: c.role || '', text: c.approx ? c.text : undefined, approx: !!c.approx };
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
  const chords = ui.chords.map(chordName).join(' ');
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
  toast(`Removed ${chordName(chord)}`, 'Undo', () => {
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

/**
 * On: the path shows at once, from the voicing pinned last, or else from the first chord's lowest
 * voicing. Off: only a voicing the user pinned stays pinned; the ones the path chose go.
 */
function toggleLeading() {
  const { ui } = state;
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
  $('#all-notes').addEventListener('click', () => {
    state.ui.allNotes = !state.ui.allNotes;
    render();
  });
  // The boards follow the slider as it moves, at most once a frame; a double-click goes back to
  // the view's default height.
  const setHeight = (gap) => {
    state.ui.heights[state.ui.view] = gap;
    $('#height').value = gap;
    if (!state.heightFrame) {
      state.heightFrame = requestAnimationFrame(() => {
        state.heightFrame = 0;
        renderBoards();
      });
    }
    scheduleSave();
  };
  $('#height').addEventListener('input', (e) => setHeight(Number(e.target.value)));
  $('#height').addEventListener('dblclick', () => setHeight(GAPS[state.ui.view]));
  $('#frets').addEventListener('change', (e) => {
    state.ui.frets = Number(e.target.value);
    render();
  });

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

  $('#toast-action').addEventListener('click', runToastAction);
  $('#update').addEventListener('click', installUpdate);
}

function fillControls() {
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
      if (!boards.hidden && boards.clientWidth !== state.boardsWidth) renderBoards();
    });
  }).observe($('#boards'));
}

init();
