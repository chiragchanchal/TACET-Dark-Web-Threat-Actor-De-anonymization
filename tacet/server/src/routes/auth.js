import { Router } from 'express';
import { loginUser, issueToken, verifyToken } from '../auth.js';

export default function authRouter() {
  const r = Router();

  r.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = loginUser(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = issueToken(user);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, username: user.username } });
  });

  r.get('/verify', (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ valid: false });
    res.json({ valid: true, user: payload });
  });

  return r;
}