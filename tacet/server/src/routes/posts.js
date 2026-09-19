import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listPosts, getPost } from '../db.js';

export default function postsRouter() {
  const r = Router();

  r.get('/', requireAuth, (req, res) => {
    const { q, forum, author, actorId, limit = 50, offset = 0 } = req.query;
    const { total, posts } = listPosts({
      q, forum, author, actorId,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    });
    res.json({
      total,
      offset: Number(offset) || 0,
      limit: Number(limit) || 50,
      posts: posts.map((p) => ({
        id: p.id, forum: p.forum, author: p.author, authorId: p.authorId,
        title: p.title, content: p.content?.slice(0, 600), sig: p.sig?.slice(0, 200),
        ts: p.ts, sha256: p.sha256, entities: p.entities || {},
      })),
    });
  });

  r.get('/:id', requireAuth, (req, res) => {
    const post = getPost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  });

  return r;
}