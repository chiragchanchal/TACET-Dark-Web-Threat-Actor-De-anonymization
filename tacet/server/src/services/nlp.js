// ---- linguistic feature math used by TACET stylometry ----
// Pure JS statistical NLP: no heavy model required for the demo; the
// architecture supports swapping in a transformer (RoBERTa) embedding
// adapter behind the same `embed(text)` contract.

const FUNCTION_WORDS = new Set((
  'the a an and but or nor for of to in on at by with from as into through during before after ' +
  'above below between out up down off over under again further then once here there when where why how ' +
  'all any both each few more most other some such no nor not only own same so than too very just also ' +
  'can will just should now what which who whom whose this that these those is are was were be been being ' +
  'have has had do does did i you he she it we they me him her us them my your his its our their'
).split(/\s+/));

const PUNCT = ['.', ',', '!', '?', ';', ':', '(', ')', '[', ']', '{', '}', '"', "'", '-', '…'];

export function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || [];
}

export function sentences(text) {
  const s = String(text || '');
  // split on sentence terminators followed by space/cap
  return s.split(/(?<=[.!?…])\s+(?=[A-Z0-9"'(])/).filter((x) => x.trim().length > 0);
}

export function charShingles(text, n = 4) {
  const s = String(text || ' ').toLowerCase();
  const out = new Map();
  for (let i = 0; i + n <= s.length && i < 4000; i++) {
    const sh = s.slice(i, i + n);
    out.set(sh, (out.get(sh) || 0) + 1);
  }
  return out;
}

function countsToHist(counts) {
  const vals = Array.from(counts.values());
  const sum = vals.reduce((a, b) => a + b, 0) || 1;
  const hist = { sum };
  for (const [k, v] of counts) hist[k] = v / sum;
  return hist;
}

/** Raw frequency profile of a text: base metrics useful for display + matcher. */
export function profile(text) {
  const t = String(text || '');
  const words = tokenize(t);
  const sents = sentences(t);
  const unique = new Set(words);
  const wlens = words.map((w) => w.length);

  const punct = {};
  for (const ch of t) {
    if (PUNCT.includes(ch)) {
      punct[ch] = (punct[ch] || 0) + 1;
    }
  }
  PUNCT.forEach((p) => { punct[p] = punct[p] || 0; });

  const fun = {};
  for (const w of words) if (FUNCTION_WORDS.has(w)) fun[w] = (fun[w] || 0) + 1;

  const caps = (t.match(/[A-Z]/g) || []).length;
  const shingle = charShingles(t, 4);

  const avgWord = words.length ? wlens.reduce((a, b) => a + b, 0) / words.length : 0;
  let wVar = 0;
  if (wlens.length) wVar = wlens.reduce((a, b) => a + (b - avgWord) ** 2, 0) / wlens.length;

  return {
    words: words.length,
    chars: t.replace(/\s+/g, '').length,
    sentences: sents.length,
    avgWordLen: avgWord,
    wordLenVar: wVar,
    avgSentLen: sents.length ? words.length / sents.length : 0,
    ttr: words.length ? unique.size / words.length : 0,
    hapax: words.length ? Array.from(unique).filter((w) => words.filter((x) => x === w).length === 1).length / unique.size : 0,
    puncRate: t.length ? (punct['.'] + punct[','] + punct['!'] + punct['?']) : 0,
    exclaimRate: t.length ? punct['!'] / t.length : 0,
    capsRate: t.length ? caps / t.length : 0,
    functionHist: countsToHist(new Map(Object.entries(fun))),
    punctHist: countsToHist(new Map(Object.entries(punct))),
    shingleHist: shingle,
    topWords: words.slice(0, 250),
  };
}

/** Stable, bounded numeric vector for cosine similarity. */
export function vectorize(prof) {
  const items = [];
  items.push(prof.avgWordLen, Math.sqrt(prof.wordLenVar), Math.min(prof.avgSentLen, 120) / 120);
  items.push(prof.ttr, prof.hapax, prof.puncRate * 40, prof.exclaimRate * 200, prof.capsRate * 100);
  for (const kw of ['the', 'and', 'to', 'of', 'in', 'i', 'you', 'it', 'but', 'just', 'very', 'really', 'shit', 'fuck', 'bro', 'btw', 'lol']) {
    items.push(prof.functionHist[kw] || Math.min(prof.topWords.filter((w) => w === kw).length / Math.max(prof.words, 1), 1));
  }
  // char-shingle density (compressed to fingerprint)
  const shArr = Array.from(prof.shingleHist.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24);
  for (const [, v] of shArr) items.push(Math.min(v, 1));
  return items;
}

export function cosine(a, b) {
  if (!a || !b || !a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Average of numeric vectors. */
export function centroid(vecs) {
  if (!vecs.length) return null;
  const n = vecs[0].length;
  const out = new Array(n).fill(0);
  for (const v of vecs) for (let i = 0; i < n; i++) out[i] += v[i] / vecs.length;
  return out;
}

export { FUNCTION_WORDS };
