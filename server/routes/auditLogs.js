const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// Get all audit logs for a user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, entity_type, entity_id } = req.query;
    
    let query = 'SELECT * FROM audit_logs WHERE user_id = ?';
    const params = [req.user.id];
    
    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }
    
    if (entity_id) {
      query += ' AND entity_id = ?';
      params.push(entity_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get audit log by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM audit_logs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Helper function to create audit log
async function createAuditLog(userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, ipAddress, userAgent]
  );
}

module.exports = router;
module.exports.createAuditLog = createAuditLog;
