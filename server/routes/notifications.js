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

// Get upcoming due dates for notification triggers
router.get('/due-dates', requireAuth, async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const daysThreshold = Math.max(1, Math.min(90, parseInt(days)));

    const dueDates = [];

    // Credit card due dates
    const [creditCards] = await pool.query(
      `SELECT id, name, due_date, due_amount, 'credit_card' as type 
       FROM credit_cards 
       WHERE user_id = ? 
         AND due_date IS NOT NULL 
         AND DATEDIFF(due_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...creditCards.map(cc => ({
      ...cc,
      title: `Credit Card Payment Due`,
      message: `${cc.name} payment of ${cc.due_amount} is due on ${cc.due_date}`
    })));

    // Loan EMI due dates (assuming monthly payments, calculate next due)
    const [loans] = await pool.query(
      `SELECT id, name, remaining, monthly_emi, 'loan' as type 
       FROM loans 
       WHERE user_id = ? AND remaining > 0`,
      [req.user.id]
    );
    loans.forEach(loan => {
      dueDates.push({
        ...loan,
        title: `Loan EMI Due`,
        message: `${loan.name} EMI of ${loan.monthly_emi} is due soon. Remaining: ${loan.remaining}`
      });
    });

    // DPS maturity dates
    const [dps] = await pool.query(
      `SELECT id, name, maturity_date, total_deposited, maturity_amount, 'dps' as type 
       FROM dps 
       WHERE user_id = ? 
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...dps.map(d => ({
      ...d,
      title: `DPS Maturity`,
      message: `${d.name} DPS matures on ${d.maturity_date}. Maturity amount: ${d.maturity_amount || d.total_deposited}`
    })));

    // FDR maturity dates
    const [fdrs] = await pool.query(
      `SELECT id, name, maturity_date, principal, 'fdr' as type 
       FROM fixed_deposits 
       WHERE user_id = ? 
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...fdrs.map(fd => ({
      ...fd,
      title: `Fixed Deposit Maturity`,
      message: `${fd.name} FDR matures on ${fd.maturity_date}. Principal: ${fd.principal}`
    })));

    // Sanchayapatra maturity dates
    const [sanchayapatra] = await pool.query(
      `SELECT id, name, maturity_date, principal_amount, 'sanchayapatra' as type 
       FROM sanchayapatra 
       WHERE user_id = ? 
         AND status = 'active'
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...sanchayapatra.map(sp => ({
      ...sp,
      title: `Sanchayapatra Maturity`,
      message: `${sp.name} Sanchayapatra matures on ${sp.maturity_date}. Principal: ${sp.principal_amount}`
    })));

    // Goal target dates
    const [goals] = await pool.query(
      `SELECT id, name, target_date, target_amount, current_amount, 'goal' as type 
       FROM goals 
       WHERE user_id = ? 
         AND status = 'active'
         AND target_date IS NOT NULL 
         AND DATEDIFF(target_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...goals.map(g => ({
      ...g,
      title: `Goal Target Date`,
      message: `${g.name} goal target date is ${g.target_date}. Progress: ${g.current_amount}/${g.target_amount}`
    })));

    res.json({
      days_threshold: daysThreshold,
      total_due_dates: dueDates.length,
      due_dates: dueDates.sort((a, b) => new Date(a.due_date || a.maturity_date || a.target_date) - new Date(b.due_date || b.maturity_date || b.target_date))
    });
  } catch (err) {
    next(err);
  }
});

// Create scheduled notification
router.post('/schedule', requireAuth, async (req, res, next) => {
  try {
    const { title, message, scheduled_date, entity_type, entity_id, action_url } = req.body;

    if (!title || !message || !scheduled_date) {
      return res.status(400).json({ error: 'Title, message, and scheduled date are required.' });
    }

    const scheduledDate = new Date(scheduled_date);
    if (scheduledDate < new Date()) {
      return res.status(400).json({ error: 'Scheduled date must be in the future.' });
    }

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, action_url, created_at, is_read)
       VALUES (?, 'scheduled', ?, ?, ?, ?, ?, ?, FALSE)`,
      [req.user.id, title, message, entity_type || null, entity_id || null, action_url || null, scheduledDate]
    );

    res.json({ ok: true, scheduled_date: scheduledDate });
  } catch (err) {
    next(err);
  }
});

// Get scheduled notifications
router.get('/scheduled', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
         AND type = 'scheduled' 
         AND created_at > CURDATE()
       ORDER BY created_at ASC`,
      [req.user.id]
    );

    res.json({ scheduled_notifications: rows });
  } catch (err) {
    next(err);
  }
});

// Cancel scheduled notification
router.delete('/scheduled/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ? AND type = "scheduled"',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Trigger notifications for due dates (called by cron job)
router.post('/trigger-due-dates', requireAuth, async (req, res, next) => {
  try {
    const { days = 3 } = req.body;
    const daysThreshold = Math.max(1, Math.min(30, parseInt(days)));

    let triggeredCount = 0;

    // Check credit cards
    const [creditCards] = await pool.query(
      `SELECT id, name, due_date, due_amount 
       FROM credit_cards 
       WHERE user_id = ? 
         AND due_date IS NOT NULL 
         AND DATEDIFF(due_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );

    for (const cc of creditCards) {
      await createNotification(
        req.user.id,
        'due_date',
        'Credit Card Payment Due',
        `${cc.name} payment of ${cc.due_amount} is due on ${cc.due_date}`,
        'credit_card',
        cc.id,
        `/credit-cards/${cc.id}`
      );
      triggeredCount++;
    }

    // Check FDR maturity
    const [fdrs] = await pool.query(
      `SELECT id, name, maturity_date, principal 
       FROM fixed_deposits 
       WHERE user_id = ? 
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );

    for (const fd of fdrs) {
      await createNotification(
        req.user.id,
        'maturity',
        'Fixed Deposit Maturity',
        `${fd.name} FDR matures on ${fd.maturity_date}. Principal: ${fd.principal}`,
        'fixed_deposit',
        fd.id,
        `/fixed-deposits/${fd.id}`
      );
      triggeredCount++;
    }

    res.json({ triggered_count: triggeredCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
