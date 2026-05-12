const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

// ── Helpers ──────────────────────────────────────────────────────────────────
function enrichInvestment(inv) {
  const qty   = Number(inv.quantity_held) || 0;
  const avgBuy = Number(inv.average_buy_price) || 0;
  const cur   = Number(inv.current_price) || avgBuy;
  const currentValue = qty * cur;
  const totalInvested = Number(inv.total_invested) || (qty * avgBuy);
  const unrealizedGain = currentValue - totalInvested;
  const unrealizedPct  = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
  return { ...inv, current_value: Math.round(currentValue * 100) / 100, unrealized_gain: Math.round(unrealizedGain * 100) / 100, unrealized_pct: Math.round(unrealizedPct * 100) / 100 };
}

// ── GET all investments ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(rows.map(enrichInvestment));
  } catch (err) { next(err); }
});

// ── POST create investment ────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, name, symbol, exchange, currency = 'BDT', quantity_held = 0, average_buy_price = 0, current_price, total_invested, broker_name, bo_account_number } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required.' });
    const qty = Number(quantity_held); const avgBuy = Number(average_buy_price);
    const ti = total_invested ? Number(total_invested) : qty * avgBuy;
    const [result] = await pool.query(
      `INSERT INTO investments (user_id, type, name, symbol, exchange, currency, quantity_held, average_buy_price, current_price, total_invested, broker_name, bo_account_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, type, name.trim(), symbol || null, exchange || null, currency, qty, avgBuy, current_price || null, ti, broker_name || null, bo_account_number || null],
    );
    const [newInv] = await pool.query('SELECT * FROM investments WHERE id = ?', [result.insertId]);
    res.status(201).json(enrichInvestment(newInv[0]));
  } catch (err) { next(err); }
});

// ── PUT update investment ─────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const invId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Investment not found.' });
    const fields = ['type','name','symbol','exchange','currency','quantity_held','average_buy_price','current_price','total_invested','realized_gain_loss','total_dividends_received','broker_name','bo_account_number','status'];
    const updates = []; const values = [];
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    values.push(invId, req.user.id);
    await pool.query(`UPDATE investments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE investment ─────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM investments WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Investment not found.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST buy ──────────────────────────────────────────────────────────────────
router.post('/:id/buy', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { quantity, price_per_unit, brokerage_fee = 0, tax = 0, date, account_id, note } = req.body;
    if (!quantity || !price_per_unit) return res.status(400).json({ error: 'quantity and price_per_unit required.' });

    const [inv] = await connection.query('SELECT * FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!inv.length) return res.status(404).json({ error: 'Investment not found.' });

    const investment = inv[0];
    const buyQty = Number(quantity); const buyPrice = Number(price_per_unit);
    const cost = buyQty * buyPrice + Number(brokerage_fee) + Number(tax);
    const oldQty = Number(investment.quantity_held) || 0;
    const oldAvg = Number(investment.average_buy_price) || 0;
    const newQty = oldQty + buyQty;
    const newAvg = newQty > 0 ? ((oldQty * oldAvg) + (buyQty * buyPrice)) / newQty : buyPrice;
    const newTotalInvested = Number(investment.total_invested || 0) + cost;

    await connection.query('UPDATE investments SET quantity_held = ?, average_buy_price = ?, total_invested = ? WHERE id = ?', [newQty, newAvg, newTotalInvested, invId]);
    await connection.query(`INSERT INTO investment_transactions (investment_id, type, date, quantity, price_per_unit, brokerage_fee, tax, source_account_id, note) VALUES (?, 'buy', ?, ?, ?, ?, ?, ?, ?)`, [invId, date || new Date().toISOString().slice(0,10), buyQty, buyPrice, Number(brokerage_fee), Number(tax), account_id || null, note || null]);

    if (account_id) {
      await connection.query('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ? AND user_id = ?', [cost, Number(account_id), req.user.id]);
      await connection.query(`INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes) VALUES (?, ?, 'expense', ?, 'BDT', CURDATE(), 'Investment', 'account', ?, ?)`, [req.user.id, Number(account_id), cost, investment.name, note || `Buy ${buyQty} × ${investment.name}`]);
    }
    await connection.commit();
    res.json({ ok: true, new_quantity_held: newQty, new_average_buy_price: Math.round(newAvg * 10000) / 10000 });
  } catch (err) { await connection.rollback(); next(err); } finally { connection.release(); }
});

// ── POST sell ─────────────────────────────────────────────────────────────────
router.post('/:id/sell', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { quantity, price_per_unit, brokerage_fee = 0, tax = 0, date, account_id, note } = req.body;
    if (!quantity || !price_per_unit) return res.status(400).json({ error: 'quantity and price_per_unit required.' });

    const [inv] = await connection.query('SELECT * FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!inv.length) return res.status(404).json({ error: 'Investment not found.' });

    const investment = inv[0];
    const sellQty = Number(quantity); const sellPrice = Number(price_per_unit);
    const currQty = Number(investment.quantity_held) || 0;
    const avgBuy  = Number(investment.average_buy_price) || 0;
    if (sellQty > currQty) return res.status(400).json({ error: 'Cannot sell more than held quantity.' });

    const revenue = sellQty * sellPrice;
    const costBasis = sellQty * avgBuy;
    const realizedGain = revenue - costBasis - Number(brokerage_fee) - Number(tax);
    const newQty = currQty - sellQty;
    const newTotalInvested = Math.max(0, Number(investment.total_invested || 0) - costBasis);
    const newRealizedGL = Number(investment.realized_gain_loss || 0) + realizedGain;

    await connection.query('UPDATE investments SET quantity_held = ?, total_invested = ?, realized_gain_loss = ?, status = IF(? = 0, \'sold\', status) WHERE id = ?', [newQty, newTotalInvested, newRealizedGL, newQty, invId]);
    await connection.query(`INSERT INTO investment_transactions (investment_id, type, date, quantity, price_per_unit, brokerage_fee, tax, source_account_id, note) VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?)`, [invId, date || new Date().toISOString().slice(0,10), sellQty, sellPrice, Number(brokerage_fee), Number(tax), account_id || null, note || null]);

    if (account_id) {
      const netRevenue = revenue - Number(brokerage_fee) - Number(tax);
      await connection.query('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?', [netRevenue, Number(account_id), req.user.id]);
      await connection.query(`INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes) VALUES (?, ?, 'income', ?, 'BDT', CURDATE(), 'Investment', 'account', ?, ?)`, [req.user.id, Number(account_id), netRevenue, investment.name, note || `Sell ${sellQty} × ${investment.name}`]);
    }
    await connection.commit();
    res.json({ ok: true, new_quantity_held: newQty, realized_gain: Math.round(realizedGain * 100) / 100 });
  } catch (err) { await connection.rollback(); next(err); } finally { connection.release(); }
});

// ── POST dividend ─────────────────────────────────────────────────────────────
router.post('/:id/dividend', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { amount, date, account_id, note } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required.' });

    const [inv] = await connection.query('SELECT * FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!inv.length) return res.status(404).json({ error: 'Investment not found.' });

    const investment = inv[0];
    const divAmount = Number(amount);
    const newTotalDiv = Number(investment.total_dividends_received || 0) + divAmount;
    await connection.query('UPDATE investments SET total_dividends_received = ? WHERE id = ?', [newTotalDiv, invId]);
    await connection.query(`INSERT INTO investment_transactions (investment_id, type, date, quantity, price_per_unit, source_account_id, note) VALUES (?, 'dividend', ?, 0, 0, ?, ?)`, [invId, date || new Date().toISOString().slice(0,10), account_id || null, note || null]);

    if (account_id) {
      await connection.query('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ? AND user_id = ?', [divAmount, Number(account_id), req.user.id]);
      await connection.query(`INSERT INTO transactions (user_id, account_id, type, amount, currency, transaction_date, category_id, source_type, payee, notes) VALUES (?, ?, 'income', ?, 'BDT', CURDATE(), 'Dividend', 'account', ?, ?)`, [req.user.id, Number(account_id), divAmount, investment.name, note || `Dividend: ${investment.name}`]);
    }
    await connection.commit();
    res.json({ ok: true, total_dividends_received: newTotalDiv });
  } catch (err) { await connection.rollback(); next(err); } finally { connection.release(); }
});

// ── POST snapshot ─────────────────────────────────────────────────────────────
router.post('/snapshot', requireAuth, async (req, res, next) => {
  try {
    const [investments] = await pool.query('SELECT * FROM investments WHERE user_id = ? AND status = \'active\'', [req.user.id]);
    if (!investments.length) return res.status(400).json({ error: 'No active investments found.' });
    const today = new Date().toISOString().slice(0, 10);
    let totalValue = 0;
    for (const inv of investments) {
      const qty = Number(inv.quantity_held) || 0;
      const price = Number(inv.current_price) || Number(inv.average_buy_price) || 0;
      const value = qty * price;
      totalValue += value;
      await pool.query('INSERT INTO investment_snapshots (user_id, investment_id, snapshot_date, price, quantity, value) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, inv.id, today, price, qty, value]);
    }
    res.json({ ok: true, snapshot_date: today, total_portfolio_value: Math.round(totalValue * 100) / 100 });
  } catch (err) { next(err); }
});

// ── GET summary ───────────────────────────────────────────────────────────────
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const [investments] = await pool.query('SELECT * FROM investments WHERE user_id = ?', [req.user.id]);
    let totalInvested = 0, currentValue = 0, totalRealized = 0, totalDividends = 0;
    const details = investments.map(inv => {
      const qty = Number(inv.quantity_held) || 0;
      const cur = Number(inv.current_price) || Number(inv.average_buy_price) || 0;
      const val = qty * cur;
      const ti  = Number(inv.total_invested) || 0;
      totalInvested += ti; currentValue += val;
      totalRealized += Number(inv.realized_gain_loss) || 0;
      totalDividends += Number(inv.total_dividends_received) || 0;
      return { id: inv.id, name: inv.name, type: inv.type, symbol: inv.symbol, quantity_held: qty, average_buy_price: Number(inv.average_buy_price), current_price: cur, total_invested: ti, current_value: Math.round(val * 100) / 100, unrealized_gain: Math.round((val - ti) * 100) / 100 };
    });
    const unrealizedTotal = currentValue - totalInvested;
    res.json({ total_invested: Math.round(totalInvested * 100) / 100, current_value: Math.round(currentValue * 100) / 100, unrealized_gain: Math.round(unrealizedTotal * 100) / 100, unrealized_pct: totalInvested > 0 ? Math.round((unrealizedTotal / totalInvested) * 10000) / 100 : 0, total_realized_gain: Math.round(totalRealized * 100) / 100, total_dividends: Math.round(totalDividends * 100) / 100, investments: details });
  } catch (err) { next(err); }
});

module.exports = router;
