export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.TACET_DATA_DIR || new URL('../data/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  storeFile: process.env.TACET_STORE || null, // resolved in db.js against dataDir
  tokenSecret: process.env.TACET_SECRET || 'tacet-dev-secret-change-me',
  tokenTtlSec: 60 * 60 * 12,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Stylometry tuning
  stylometry: {
    clusterThreshold: Number(process.env.STYLE_THRESHOLD || 0.62),
    strongThreshold: Number(process.env.STYLE_STRONG || 0.78),
    charNgram: 4,
    minPostsForProfile: 2,
  },
  // Attribution score weights
  attributionWeights: {
    artifact: 0.42, // shared crypto / PGP / handle / email
    style: 0.36,    // stylometric similarity
    timezone: 0.12, // posting-time histogram overlap
    proximity: 0.10 // co-posted in same threads / replied chains
  },
};
