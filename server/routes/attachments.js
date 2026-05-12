const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExts = /\.(jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|csv|txt)$/i;
    if (allowedExts.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('File type not supported. Allowed: jpg, png, gif, pdf, doc, docx, xls, xlsx, csv, txt'));
  },
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { entity_type, entity_id } = req.query;
    let query = 'SELECT * FROM attachments WHERE user_id = ?';
    const params = [req.user.id];
    if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { query += ' AND entity_id = ?'; params.push(entity_id); }
    query += ' ORDER BY uploaded_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/transaction/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.* FROM attachments a
       JOIN transaction_attachments ta ON ta.attachment_id = a.id
       JOIN transactions t ON t.id = ta.transaction_id
       WHERE ta.transaction_id = ? AND t.user_id = ?`,
      [req.params.transactionId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { entity_type, entity_id } = req.body;
    const publicUrl = `/uploads/${req.file.filename}`;
    const [result] = await pool.query(
      'INSERT INTO attachments (user_id, file_name, file_type, file_size_bytes, storage_path, public_url, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, publicUrl, entity_type || null, entity_id ? Number(entity_id) : null]
    );
    res.status(201).json({
      id: result.insertId,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size_bytes: req.file.size,
      storage_path: req.file.filename,
      public_url: publicUrl,
      entity_type: entity_type || null,
      entity_id: entity_id ? Number(entity_id) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/transaction/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const { attachment_id } = req.body;
    const [txns] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [req.params.transactionId, req.user.id]);
    if (!txns.length) return res.status(404).json({ error: 'Transaction not found.' });
    const [atts] = await pool.query('SELECT id FROM attachments WHERE id = ? AND user_id = ?', [attachment_id, req.user.id]);
    if (!atts.length) return res.status(404).json({ error: 'Attachment not found.' });
    await pool.query(
      'INSERT IGNORE INTO transaction_attachments (transaction_id, attachment_id) VALUES (?, ?)',
      [req.params.transactionId, attachment_id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/transaction/:transactionId/:attachmentId', requireAuth, async (req, res, next) => {
  try {
    const [txns] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [req.params.transactionId, req.user.id]);
    if (!txns.length) return res.status(404).json({ error: 'Transaction not found.' });
    await pool.query(
      'DELETE FROM transaction_attachments WHERE transaction_id = ? AND attachment_id = ?',
      [req.params.transactionId, req.params.attachmentId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM attachments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Attachment not found.' });
    const filePath = path.join(UPLOADS_DIR, rows[0].storage_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM attachments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
