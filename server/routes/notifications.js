const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all notifications for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Helper function to create notification
async function createNotification(userId, type, title, message, entityType, entityId, actionUrl) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, action_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, entityType, entityId, actionUrl]
  );
}

module.exports = router;
module.exports.createNotification = createNotification;
