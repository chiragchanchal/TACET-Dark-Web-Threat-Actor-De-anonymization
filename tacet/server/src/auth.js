import crypto from 'node:crypto';
import { config } from './config.js';
import { findUserByUsername, insertUser, countUsers, nextId } from './db.js';

const SESSION_PREFIX = 'tacet.';

function hmac(data) {
  return crypto.createHmac('sha256', config.tokenSecret).update(data).digest('base64url');
}

export function issueToken(user) {
  const body = Buffer.from(JSON.stringify({
    sub: user.id, name: user.name, role: user.role, exp: Date.now() + config.tokenTtlSec * 1000,
  })).toString('base64url');
  return SESSION_PREFIX + body + '.' + hmac(body);
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith(SESSION_PREFIX)) return null;
  const [, body, sig] = token.split('.');
  if (!body || !sig || hmac(body) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized — provide a valid session token.' });
  req.user = payload;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden — requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// PBKDF2-SHA256 password hashing (no native bcrypt dependency).
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return `${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split('$');
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function loginUser(username, password) {
  const user = findUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, name: user.name, role: user.role, username: user.username };
}

export function seedUsers() {
  if (countUsers() > 0) return;
  insertUser({ id: nextId('usr'), username: 'analyst', passwordHash: hashPassword('tac3t-demo'), name: 'Senior OSINT Analyst', role: 'analyst' });
  insertUser({ id: nextId('usr'), username: 'admin', passwordHash: hashPassword('tac3t-admin'), name: 'Unit Administrator', role: 'admin' });
}