// Fretboards drawn as SVG: the wood, frets, strings and inlays, and chords' notes as dots joined
// into their voicing shapes. Only drawing: app.js decides what to show and handles the mouse.
// docs/ui.md#fretboard describes the layout.

import { STRING_NAMES } from './theory.js';

// Each fret's space is this much narrower than the one before it: a hint of a real neck (0.944),
// while a shape still looks the same all along it.
const FRET_RATIO = 0.97;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];
// Left of the nut: the string names, then a column for open strings' notes.
const NAMES_WIDTH = 20;
const OPEN_WIDTH = 28;
const RIGHT_PAD = 8;
// Dots smaller than this have no label.
const MIN_LABELED_RADIUS = 6.5;
// A row of fret numbers under a board (Stacked): its height, and how far below the wood they sit.
const NUMBERS_HEIGHT = 14;
const NUMBERS_OFFSET = 8;

// Coordinates are rounded to a tenth of a pixel to keep the markup short.
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Where everything goes on a board `width` px wide with `frets` frets and `gap` px between strings.
 * High E on top, as in tab; left-handed mirrors it, the nut on the right. With `numbers`, each board
 * has its fret numbers under it.
 */
export function geometry(width, frets, { gap = 22, leftHanded = false, numbers = false } = {}) {
  const nut = NAMES_WIDTH + OPEN_WIDTH;
  const avail = Math.max(240, width - nut - RIGHT_PAD);
  const first = (avail * (1 - FRET_RATIO)) / (1 - FRET_RATIO ** frets);
  const wires = [nut];
  for (let k = 1; k <= frets; k++) wires.push(wires[k - 1] + first * FRET_RATIO ** (k - 1));
  const top = Math.round(gap * 0.8);
  const flip = (x) => (leftHanded ? width - x : x);
  return {
    width,
    frets,
    gap,
    top,
    numbers,
    height: boardHeight(gap, numbers),
    leftHanded,
    flip,
    stringY: (string) => top + (string - 1) * gap,
    wireX: (k) => flip(wires[k]),
    // The middle of a fret's space, or the column left of the nut for an open string.
    noteX: (fret) => flip(fret === 0 ? nut - OPEN_WIDTH / 2 : (wires[fret - 1] + wires[fret]) / 2),
    slotWidth: (fret) => (fret === 0 ? OPEN_WIDTH : wires[fret] - wires[fret - 1]),
    // The fret whose space is at x: 0 for the open strings' column, -1 off the board.
    fretAt(x) {
      const u = flip(x);
      if (u < nut - OPEN_WIDTH || u > wires[frets]) return -1;
      if (u < nut) return 0;
      let k = 1;
      while (k < frets && u > wires[k]) k++;
      return k;
    },
    // A fret's space as { x, width }, for highlighting it.
    slotRect(fret) {
      const a = flip(fret === 0 ? nut - OPEN_WIDTH : wires[fret - 1]);
      const b = flip(fret === 0 ? nut : wires[fret]);
      return { x: r1(Math.min(a, b)), width: r1(Math.abs(b - a)) };
    },
  };
}

/** How tall a board is with `gap` px between strings, and fret numbers under it with `numbers`. */
export function boardHeight(gap, numbers) {
  return Math.round(gap * 0.8) * 2 + gap * 5 + (numbers ? NUMBERS_HEIGHT : 0);
}

/**
 * The board itself: wood, inlays, frets, nut, strings and their names, the hover band, and with
 * `numbers` the fret numbers under it.
 */
export function boardMarkup(geo) {
  const { frets, gap } = geo;
  const y1 = r1(geo.stringY(1) - gap * 0.5);
  const y2 = r1(geo.stringY(6) + gap * 0.5);
  const xa = geo.wireX(0);
  const xb = geo.wireX(frets);
  const out = [
    `<rect class="wood" x="${r1(Math.min(xa, xb))}" y="${y1}" width="${r1(Math.abs(xb - xa))}" height="${r1(y2 - y1)}" rx="3"/>`,
    `<rect class="band" x="0" y="${y1}" width="0" height="${r1(y2 - y1)}"/>`,
  ];
  const inlay = (fret, y) =>
    `<circle class="inlay" cx="${r1(geo.noteX(fret))}" cy="${r1(y)}" r="${r1(Math.min(4.5, gap * 0.2))}"/>`;
  for (const f of INLAYS) if (f <= frets) out.push(inlay(f, geo.stringY(3.5)));
  for (const f of DOUBLE_INLAYS) if (f <= frets) out.push(inlay(f, geo.stringY(2.5)), inlay(f, geo.stringY(4.5)));
  for (let k = 1; k <= frets; k++) {
    const x = r1(geo.wireX(k));
    out.push(`<line class="fret" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>`);
  }
  out.push(`<rect class="nut" x="${r1(xa - 2.5)}" y="${y1}" width="5" height="${r1(y2 - y1)}" rx="1"/>`);
  const xOpen = r1(geo.flip(NAMES_WIDTH + 4));
  for (let s = 1; s <= 6; s++) {
    const y = r1(geo.stringY(s));
    // Wound strings are thicker.
    out.push(`<line class="string" x1="${xOpen}" x2="${r1(xb)}" y1="${y}" y2="${y}" stroke-width="${r1(0.8 + (s - 1) * 0.28)}"/>`);
    out.push(`<text class="string-name" x="${r1(geo.flip(NAMES_WIDTH / 2))}" y="${y}">${STRING_NAMES[s]}</text>`);
  }
  if (geo.numbers) out.push(fretNumbers(geo, y2 + NUMBERS_OFFSET));
  return out.join('');
}

/**
 * Chords' notes as dots, and a line through each voicing's notes. `layers` has one entry per chord:
 * { cls, voicings: [{ id, notes: [{ string, fret, label, root }] }], notes, extras }, `cls` being its
 * color class, `notes` notes of the chord in no voicing (Chord tones) and `extras` other notes of
 * the chord to show, outlined (All notes). Where several chords share a spot, their dots stand side
 * by side in chord order.
 */
export function notesMarkup(geo, layers, { radius }) {
  // Each spot's chords, and which of their voicings use it.
  const spots = new Map();
  const spotAt = (n) => {
    const key = `${n.string}:${n.fret}`;
    if (!spots.has(key)) spots.set(key, { string: n.string, fret: n.fret, entries: new Map() });
    return spots.get(key);
  };
  layers.forEach((layer, li) => {
    for (const v of layer.voicings) {
      for (const n of v.notes) {
        const spot = spotAt(n);
        let entry = spot.entries.get(li);
        if (!entry) spot.entries.set(li, (entry = { layer: li, label: n.label, root: n.root, ids: [] }));
        entry.ids.push(v.id);
      }
    }
    for (const n of layer.notes || []) {
      const spot = spotAt(n);
      if (!spot.entries.has(li)) spot.entries.set(li, { layer: li, label: n.label, root: n.root, ids: [] });
    }
    // A note that's in a voicing is drawn as the voicing's.
    for (const n of layer.extras || []) {
      const spot = spotAt(n);
      if (!spot.entries.has(li)) spot.entries.set(li, { layer: li, label: n.label, root: n.root, ids: [], ghost: true });
    }
  });

  const placed = new Map();
  const dots = [];
  for (const spot of spots.values()) {
    const entries = [...spot.entries.values()].sort((a, b) => a.layer - b.layer);
    const share = geo.slotWidth(spot.fret) / entries.length;
    const r = Math.max(4, Math.min(radius, share / 2 - 1));
    const step = Math.min(2 * radius + 2, share);
    const y = geo.stringY(spot.string);
    entries.forEach((entry, i) => {
      const x = geo.noteX(spot.fret) + (i - (entries.length - 1) / 2) * step;
      placed.set(`${entry.layer}|${spot.string}:${spot.fret}`, `${r1(x)},${r1(y)}`);
      dots.push(dotMarkup(layers[entry.layer].cls, entry, x, y, r));
    });
  }

  const shapes = [];
  const hits = [];
  layers.forEach((layer, li) => {
    for (const v of layer.voicings) {
      const points = v.notes.map((n) => placed.get(`${li}|${n.string}:${n.fret}`)).join(' ');
      shapes.push(`<polyline class="shape ${layer.cls}" data-v="${v.id}" points="${points}"/>`);
      // A wider, invisible line over it, easier to point at.
      hits.push(`<polyline class="hit" data-v="${v.id}" points="${points}"/>`);
    }
  });
  return `<g class="shapes">${shapes.join('')}</g><g class="hits">${hits.join('')}</g><g class="dots">${dots.join('')}</g>`;
}

// Labels grow with the dot, longer ones less: [share of the radius, largest size in px].
const LABEL_FIT = { 1: [1.15, 13], 2: [1, 12], 3: [0.85, 10.5] };

// The root is a rounded square, the other tones circles, so it stands out without color. A dot in
// no voicing (Chord tones, or outlined for All notes) has no `data-v`: the mouse passes it by.
function dotMarkup(cls, entry, x, y, r) {
  const mark = entry.root
    ? `<rect class="mark" x="${r1(-r)}" y="${r1(-r)}" width="${r1(2 * r)}" height="${r1(2 * r)}" rx="${r1(r * 0.38)}"/>`
    : `<circle class="mark" r="${r1(r)}"/>`;
  const [share, largest] = LABEL_FIT[Math.min(entry.label.length, 3)];
  const text = r >= MIN_LABELED_RADIUS ? `<text font-size="${r1(Math.min(r * share, largest))}">${entry.label}</text>` : '';
  const classes = `dot ${cls}${entry.root ? ' root' : ''}${entry.ghost ? ' ghost' : ''}`;
  const voicings = entry.ids.length ? ` data-v="${entry.ids.join(' ')}"` : '';
  return `<g class="${classes}"${voicings} transform="translate(${r1(x)} ${r1(y)})">${mark}${text}</g>`;
}

// A number centered over each fret's space at `y`, the frets with inlays stronger.
function fretNumbers(geo, y) {
  const out = [];
  for (let f = 1; f <= geo.frets; f++) {
    const marked = INLAYS.includes(f) || DOUBLE_INLAYS.includes(f);
    out.push(`<text class="fret-number${marked ? ' marked' : ''}" data-fret="${f}" x="${r1(geo.noteX(f))}" y="${r1(y)}">${f}</text>`);
  }
  return out.join('');
}
