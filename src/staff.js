// The progression on a staff, as SVG: a treble clef written an octave above how the guitar sounds,
// as guitar music is, in 4/4 with a bar line every four beats, and each chord's symbol over what it
// holds for its length. Only drawing: app.js decides what each chord shows. docs/ui.md#staff.

// Px between the staff's lines; a step of the scale (a line to the next space) is half that.
const LINE = 8;
const STEP = LINE / 2;
// Left of the first bar: the clef and the time signature.
const LEFT = 64;
const RIGHT = 10;
// A beat is at least this wide, so a bar is 128 px or more; when the bars fit, they share the
// width, and when they don't, the staff scrolls.
const MIN_BEAT = 32;
// A scale's notes, each this wide, across its chord's beats.
const SCALE_NOTE = 15;
const SYMBOL_Y = 14;
const HEAD_RX = 5.5;
const HEAD_RY = 4;
// The bottom line, E4, as a staffStep(); the middle line, B4, is 4 steps up, the top one 8.
const BOTTOM = 30;
const MIDDLE = 4;

const r1 = (n) => Math.round(n * 10) / 10;
const sign = (acc) => (acc < 0 ? '♭' : acc > 0 ? '♯' : '');
// Chord symbols are what was typed, so they're escaped.
const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The staff for `entries`, one per chord: { symbol, cls, beats, kind, notes: [{ step, acc }] },
 * `kind` being 'voicing' (its pinned voicing), 'notes' (the chord's notes from its root) or
 * 'scale', and each note's `step` staffStep() of its written pitch. `available` is the width to
 * fill. Returns { width, height, markup, spans }, `spans` holding each chord's [x0, x1], to mark
 * the one playing (`.staff-now`, `.staff-playhead`).
 */
export function staffMarkup(entries, available) {
  const total = entries.reduce((sum, e) => sum + e.beats, 0);
  const roomy = entries.filter((e) => e.kind === 'scale').map((e) => (e.notes.length * SCALE_NOTE + 26) / e.beats);
  const beat = Math.max(MIN_BEAT, ...roomy, (available - LEFT - RIGHT) / Math.max(total, 1));
  const width = Math.ceil(LEFT + RIGHT + beat * total);
  // Room over and under the staff for notes on ledger lines; the symbols go above it all.
  const positions = entries.flatMap((e) => e.notes.map((n) => n.step - BOTTOM));
  const high = Math.max(10, ...positions);
  const low = Math.min(-3, ...positions);
  const bottom = SYMBOL_Y + 12 + high * STEP;
  const height = Math.ceil(bottom - low * STEP + 12);
  const y = (pos) => r1(bottom - pos * STEP);
  const x = (b) => LEFT + b * beat;
  const end = r1(x(total));

  const out = [`<rect class="staff-now" x="0" y="0" width="0" height="${height}" rx="6"/>`];
  for (let l = 0; l <= 8; l += 2) out.push(`<line class="staff-line" x1="4" x2="${end}" y1="${y(l)}" y2="${y(l)}"/>`);
  out.push(`<text class="clef" x="7" y="${r1(bottom + LINE * 0.9)}" font-size="${LINE * 5.6}">𝄞</text>`);
  out.push(`<text class="clef-8" x="21" y="${r1(bottom + LINE * 2.9)}">8</text>`);
  out.push(`<text class="time" x="${LEFT - 15}" y="${y(6)}">4</text><text class="time" x="${LEFT - 15}" y="${y(2)}">4</text>`);
  for (let b = 4; b < total; b += 4) out.push(`<line class="bar-line" x1="${r1(x(b))}" x2="${r1(x(b))}" y1="${y(8)}" y2="${y(0)}"/>`);
  out.push(`<line class="bar-line" x1="${r1(end - 5)}" x2="${r1(end - 5)}" y1="${y(8)}" y2="${y(0)}"/>`);
  out.push(`<line class="bar-line end" x1="${r1(end - 1.5)}" x2="${r1(end - 1.5)}" y1="${y(8)}" y2="${y(0)}"/>`);

  const spans = [];
  let start = 0;
  for (const e of entries) {
    const x0 = x(start);
    const x1 = x(start + e.beats);
    spans.push([r1(x0), r1(x1)]);
    const notes = [];
    if (e.kind === 'scale') {
      // The scale from its root, spread over the chord's beats, clear of the bar lines.
      const from = x0 + 20;
      const to = x1 - 14;
      e.notes.forEach((note, k) => {
        let nx = e.notes.length > 1 ? from + (k * (to - from)) / (e.notes.length - 1) : from;
        for (let b = 4; b < total; b += 4) if (Math.abs(nx - x(b)) < 9) nx = x(b) + (nx < x(b) ? -9 : 9);
        notes.push(chordMarkup([note], nx, 0, y));
      });
    } else {
      // Split at the bar lines: each piece is a whole note (a bar) or a half note, tied to the next.
      let prev = null;
      for (let b = start; b < start + e.beats; ) {
        const until = Math.min((Math.floor(b / 4) + 1) * 4, start + e.beats);
        const piece = chordMarkup(e.notes, x(b) + 18, until - b, y);
        notes.push(piece);
        if (prev) notes.push({ markup: ties(prev.heads, piece.heads) });
        prev = piece;
        b = until;
      }
    }
    const kind = e.kind === 'notes' ? ' muted' : '';
    out.push(`<text class="staff-symbol ${e.cls}" x="${r1(x0 + 6)}" y="${SYMBOL_Y}">${escape(e.symbol)}</text>`);
    out.push(`<g class="staff-notes${kind}">${notes.map((n) => n.markup).join('')}</g>`);
    start += e.beats;
  }
  out.push(`<line class="staff-playhead" x1="0" x2="0" y1="${y(10)}" y2="${y(-2)}" visibility="hidden"/>`);
  return { width, height, markup: out.join(''), spans };
}

/**
 * Notes sounding together at `cx`, for `beats` (4: a whole note, 2: a half note, with a stem; 0: a
 * scale's note, filled). Returns { markup, heads }, the heads' places for ties.
 */
function chordMarkup(notes, cx, beats, y) {
  const out = [];
  const heads = [];
  // Low to high; a note a step above the one below goes beside it.
  for (const n of [...notes].sort((a, b) => a.step - b.step)) {
    const pos = n.step - BOTTOM;
    const below = heads[heads.length - 1];
    const aside = !!below && pos - below.pos === 1 && !below.aside;
    heads.push({ pos, acc: n.acc, aside, x: cx + (aside ? 2 * HEAD_RX - 1 : 0), y: y(pos) });
  }
  for (const h of heads) {
    for (let p = -2; p >= h.pos; p -= 2) out.push(ledger(h.x, y(p)));
    for (let p = 10; p <= h.pos; p += 2) out.push(ledger(h.x, y(p)));
  }
  // Accidentals left of the notes, moved further left when they'd touch the one above.
  let lastAt = null;
  let shift = 0;
  for (const h of [...heads].reverse()) {
    if (!h.acc) continue;
    shift = lastAt != null && lastAt - h.pos < 6 ? (shift ? 0 : 8) : 0;
    out.push(`<text class="accidental" x="${r1(cx - HEAD_RX - 7 - shift)}" y="${h.y}">${sign(h.acc)}</text>`);
    lastAt = h.pos;
  }
  const fill = beats === 0 ? ' filled' : '';
  for (const h of heads) {
    out.push(`<ellipse class="head${fill}" cx="${r1(h.x)}" cy="${h.y}" rx="${HEAD_RX}" ry="${HEAD_RY}" transform="rotate(-20 ${r1(h.x)} ${h.y})"/>`);
  }
  if (beats === 2 && heads.length) {
    // Stem up from the lowest note when they sit low, down from the highest when high.
    const lowest = heads[0];
    const highest = heads[heads.length - 1];
    const up = heads.reduce((sum, h) => sum + h.pos, 0) / heads.length < MIDDLE;
    const sx = r1(cx + (up ? HEAD_RX - 0.6 : -HEAD_RX + 0.6));
    const [from, to] = up ? [lowest.y, highest.y - LINE * 3.5] : [highest.y, lowest.y + LINE * 3.5];
    out.push(`<line class="stem" x1="${sx}" x2="${sx}" y1="${r1(from)}" y2="${r1(to)}"/>`);
  }
  return { markup: out.join(''), heads };
}

function ledger(x, y) {
  return `<line class="ledger" x1="${r1(x - 9)}" x2="${r1(x + 9)}" y1="${y}" y2="${y}"/>`;
}

/**
 * A tie from each head in `from` to the same note in `to`: a thin crescent curving away from the
 * middle line, deeper the longer it is, so a tie across a bar doesn't read as a staff line.
 */
function ties(from, to) {
  return from
    .map((a) => {
      const b = to.find((h) => h.pos === a.pos);
      if (!b) return '';
      const dir = a.pos >= MIDDLE ? -1 : 1;
      const x1 = a.x + HEAD_RX;
      const x2 = b.x - HEAD_RX;
      const mid = (x1 + x2) / 2;
      const yy = a.y + dir * 4;
      const depth = 6 + Math.min(8, (x2 - x1) / 30);
      return `<path class="tie" d="M${r1(x1)} ${r1(yy)}Q${r1(mid)} ${r1(yy + dir * depth)} ${r1(x2)} ${r1(yy)}Q${r1(mid)} ${r1(yy + dir * (depth - 2.2))} ${r1(x1)} ${r1(yy)}Z"/>`;
    })
    .join('');
}
