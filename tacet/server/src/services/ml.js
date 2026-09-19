// ---- bridge to the trained model artifacts (from ml/train.py) ----
// Exposes model provenance + cross-validated metrics and loads the feature
// vocabulary for the runtime scorer. If no model has been trained yet, the
// API reports that cleanly so a demo can't silently run on stale data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ml/train.py writes artifacts to <server>/model (two levels up from src/services)
const MODEL_DIR = path.resolve(__dirname, '../../model');

let _metricsCache = null;
let _vocabCache = null;
let _profilesCache = null;
let _loaded = false;

function readJson(name, cacheSetter) {
  const file = path.join(MODEL_DIR, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function modelInfo() {
  if (!_loaded) {
    _metricsCache = readJson('metrics.json');
    _vocabCache = readJson('vocab.json');
    _profilesCache = readJson('feature_profiles.json');
    _loaded = true;
  }
  return _metricsCache;
}

export function modelProfiles() {
  modelInfo();
  return _profilesCache;
}

export function modelVocab() {
  modelInfo();
  return _vocabCache;
}

export function modelPresent() {
  return !!modelInfo();
}

/** Number of model features available to the runtime scorer. */
export function modelFeatureCount() {
  const m = modelInfo();
  return m?.nFeatures ?? null;
}
