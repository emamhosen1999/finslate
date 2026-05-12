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

    // Credit card due dates (based on payment_due_day of current month)
    const [creditCards] = await pool.query(
      `SELECT id, card_name, payment_due_day, current_outstanding, 'credit_card' as type 
       FROM credit_cards 
       WHERE user_id = ? AND is_active = 1
         AND current_outstanding > 0
         AND payment_due_day IS NOT NULL
         AND DATEDIFF(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(CURDATE()), '-', payment_due_day)), CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...creditCards.map(cc => ({
      ...cc,
      due_date: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(cc.payment_due_day).padStart(2,'0')}`,
      title: `Credit Card Payment Due`,
      message: `${cc.card_name} payment of ${cc.current_outstanding} is due on day ${cc.payment_due_day}`
    })));

    // Loan EMI due dates
    const [loans] = await pool.query(
      `SELECT id, lender_name, outstanding_balance, emi_amount, emi_day_of_month, 'loan' as type 
       FROM loans 
       WHERE user_id = ? AND status = 'active' AND outstanding_balance > 0`,
      [req.user.id]
    );
    loans.forEach(loan => {
      dueDates.push({
        ...loan,
        title: `Loan EMI Due`,
        message: `${loan.lender_name} EMI of ${loan.emi_amount} is due soon. Outstanding: ${loan.outstanding_balance}`
      });
    });

    // DPS maturity dates
    const [dps] = await pool.query(
      `SELECT id, institution_name, maturity_date, total_deposited, projected_maturity_value, 'dps' as type 
       FROM dps 
       WHERE user_id = ? AND deleted_at IS NULL
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...dps.map(d => ({
      ...d,
      title: `DPS Maturity`,
      message: `${d.institution_name} DPS matures on ${d.maturity_date}. Maturity amount: ${d.projected_maturity_value || d.total_deposited}`
    })));

    // FDR maturity dates
    const [fdrs] = await pool.query(
      `SELECT id, institution_name, maturity_date, principal_amount, 'fdr' as type 
       FROM fixed_deposits 
       WHERE user_id = ? AND deleted_at IS NULL AND status = 'active'
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );
    dueDates.push(...fdrs.map(fd => ({
      ...fd,
      title: `Fixed Deposit Maturity`,
      message: `${fd.institution_name} FDR matures on ${fd.maturity_date}. Principal: ${fd.principal_amount}`
    })));

    // Sanchayapatra maturity dates
    const [sanchayapatra] = await pool.query(
      `SELECT id, scheme_type, certificate_number, maturity_date, face_value, 'sanchayapatra' as type 
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
      message: `${sp.scheme_type} (${sp.certificate_number}) matures on ${sp.maturity_date}. Face value: ${sp.face_value}`
    })));

    // Goal target dates
    const [goals] = await pool.query(
      `SELECT id, name, target_date, target_amount, current_amount, 'goal' as type 
       FROM goals 
       WHERE user_id = ? 
         AND status = 'in_progress'
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
      `SELECT id, card_name, payment_due_day, current_outstanding 
       FROM credit_cards 
       WHERE user_id = ? AND is_active = 1
         AND current_outstanding > 0
         AND payment_due_day IS NOT NULL
         AND DATEDIFF(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(CURDATE()), '-', payment_due_day)), CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );

    for (const cc of creditCards) {
      await createNotification(
        req.user.id,
        'warning',
        'Credit Card Payment Due',
        `${cc.card_name} payment of ${cc.current_outstanding} is due on day ${cc.payment_due_day}`,
        'credit_card',
        cc.id,
        `/credit-cards/${cc.id}`
      );
      triggeredCount++;
    }

    // Check FDR maturity
    const [fdrs] = await pool.query(
      `SELECT id, institution_name, maturity_date, principal_amount 
       FROM fixed_deposits 
       WHERE user_id = ? AND deleted_at IS NULL AND status = 'active'
         AND maturity_date IS NOT NULL 
         AND DATEDIFF(maturity_date, CURDATE()) BETWEEN 0 AND ?`,
      [req.user.id, daysThreshold]
    );

    for (const fd of fdrs) {
      await createNotification(
        req.user.id,
        'info',
        'Fixed Deposit Maturity',
        `${fd.institution_name} FDR matures on ${fd.maturity_date}. Principal: ${fd.principal_amount}`,
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
