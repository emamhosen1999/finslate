const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, symbol, quantity, buy_price, current_price, buy_date } = req.body;
    if (!name || !type || !quantity || !buy_price) {
      return res.status(400).json({ error: 'Name, type, quantity, and buy price are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO investments (user_id, name, type, symbol, quantity, buy_price, current_price, buy_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name.trim(), type.trim(), symbol?.trim() || null, Number(quantity), Number(buy_price), current_price ? Number(current_price) : null, buy_date || null],
    );
    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      type: type.trim(),
      symbol: symbol?.trim() || null,
      quantity: Number(quantity),
      buy_price: Number(buy_price),
      current_price: current_price ? Number(current_price) : null,
      buy_date,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, type, symbol, quantity, buy_price, current_price, buy_date } = req.body;
    const invId = Number(req.params.id);
    const [existing] = await pool.query('SELECT id FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Investment not found.' });
    }
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type.trim());
    }
    if (symbol !== undefined) {
      updates.push('symbol = ?');
      values.push(symbol?.trim() || null);
    }
    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(Number(quantity));
    }
    if (buy_price !== undefined) {
      updates.push('buy_price = ?');
      values.push(Number(buy_price));
    }
    if (current_price !== undefined) {
      updates.push('current_price = ?');
      values.push(current_price ? Number(current_price) : null);
    }
    if (buy_date !== undefined) {
      updates.push('buy_date = ?');
      values.push(buy_date);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    values.push(invId, req.user.id);
    await pool.query(`UPDATE investments SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    res.json({ message: 'Investment updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const invId = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM investments WHERE id = ? AND user_id = ?', [invId, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Investment not found.' });
    }
    res.json({ message: 'Investment deleted.' });
  } catch (err) {
    next(err);
  }
});

// Record a buy transaction for an investment
router.post('/:id/buy', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { quantity, price, date, account_id } = req.body;

    if (!quantity || !price) {
      await connection.rollback();
      return res.status(400).json({ error: 'Quantity and price are required.' });
    }

    const [inv] = await connection.query(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
      [invId, req.user.id]
    );

    if (!inv.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Investment not found.' });
    }

    const investment = inv[0];
    const buyQuantity = Number(quantity);
    const buyPrice = Number(price);
    const totalCost = buyQuantity * buyPrice;

    // Update investment quantity (average cost basis)
    const oldQuantity = Number(investment.quantity) || 0;
    const oldBuyPrice = Number(investment.buy_price) || 0;
    const newQuantity = oldQuantity + buyQuantity;
    const newBuyPrice = ((oldQuantity * oldBuyPrice) + totalCost) / newQuantity;

    await connection.query(
      'UPDATE investments SET quantity = ?, buy_price = ? WHERE id = ?',
      [newQuantity, newBuyPrice, invId]
    );

    // Record transaction if account provided
    if (account_id) {
      const [account] = await connection.query(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
        [Number(account_id), req.user.id]
      );
      if (!account.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'debit', totalCost, 'Investment Buy', `Buy ${buyQuantity} of ${investment.name}`]
      );
      await connection.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [totalCost, Number(account_id)]
      );
    }

    await connection.commit();
    res.json({
      message: 'Buy recorded successfully',
      new_quantity: newQuantity,
      new_buy_price: newBuyPrice
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Record a sell transaction for an investment
router.post('/:id/sell', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { quantity, price, date, account_id } = req.body;

    if (!quantity || !price) {
      await connection.rollback();
      return res.status(400).json({ error: 'Quantity and price are required.' });
    }

    const [inv] = await connection.query(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
      [invId, req.user.id]
    );

    if (!inv.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Investment not found.' });
    }

    const investment = inv[0];
    const sellQuantity = Number(quantity);
    const sellPrice = Number(price);
    const currentQuantity = Number(investment.quantity) || 0;
    const buyPrice = Number(investment.buy_price) || 0;

    if (sellQuantity > currentQuantity) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cannot sell more than current holdings.' });
    }

    const totalRevenue = sellQuantity * sellPrice;
    const totalCost = sellQuantity * buyPrice;
    const profit = totalRevenue - totalCost;

    // Update investment quantity
    const newQuantity = currentQuantity - sellQuantity;
    await connection.query(
      'UPDATE investments SET quantity = ? WHERE id = ?',
      [newQuantity, invId]
    );

    // Record transaction if account provided
    if (account_id) {
      const [account] = await connection.query(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
        [Number(account_id), req.user.id]
      );
      if (!account.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'credit', totalRevenue, 'Investment Sell', `Sell ${sellQuantity} of ${investment.name}`]
      );
      await connection.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [totalRevenue, Number(account_id)]
      );
    }

    await connection.commit();
    res.json({
      message: 'Sell recorded successfully',
      new_quantity: newQuantity,
      revenue: totalRevenue,
      cost: totalCost,
      profit: profit
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Record a dividend for an investment
router.post('/:id/dividend', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const invId = Number(req.params.id);
    const { amount, date, account_id } = req.body;

    if (!amount) {
      await connection.rollback();
      return res.status(400).json({ error: 'Dividend amount is required.' });
    }

    const [inv] = await connection.query(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
      [invId, req.user.id]
    );

    if (!inv.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Investment not found.' });
    }

    const investment = inv[0];
    const dividendAmount = Number(amount);

    // Record transaction if account provided
    if (account_id) {
      const [account] = await connection.query(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
        [Number(account_id), req.user.id]
      );
      if (!account.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Account not found.' });
      }
      await connection.query(
        'INSERT INTO transactions (user_id, account_id, type, amount, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, Number(account_id), 'credit', dividendAmount, 'Dividend', `Dividend from ${investment.name}`, date || new Date()]
      );
      await connection.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [dividendAmount, Number(account_id)]
      );
    }

    await connection.commit();
    res.json({ message: 'Dividend recorded successfully' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// Create a snapshot of all investments at current value
router.post('/snapshot', requireAuth, async (req, res, next) => {
  try {
    const [investments] = await pool.query(
      'SELECT * FROM investments WHERE user_id = ?',
      [req.user.id]
    );

    if (investments.length === 0) {
      return res.status(400).json({ error: 'No investments found.' });
    }

    let totalValue = 0;
    const investmentSnapshots = investments.map(inv => {
      const quantity = Number(inv.quantity) || 0;
      const currentPrice = Number(inv.current_price) || Number(inv.buy_price) || 0;
      const value = quantity * currentPrice;
      totalValue += value;

      return {
        investment_id: inv.id,
        investment_name: inv.name,
        symbol: inv.symbol,
        quantity: quantity,
        current_price: currentPrice,
        value: value
      };
    });

    res.json({
      snapshot_date: new Date().toISOString(),
      total_value: totalValue,
      investments: investmentSnapshots
    });
  } catch (err) {
    next(err);
  }
});

// Get investment performance summary
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const [investments] = await pool.query(
      'SELECT * FROM investments WHERE user_id = ?',
      [req.user.id]
    );

    let totalInvested = 0;
    let currentValue = 0;
    const investmentDetails = investments.map(inv => {
      const quantity = Number(inv.quantity) || 0;
      const buyPrice = Number(inv.buy_price) || 0;
      const currentPrice = Number(inv.current_price) || buyPrice;
      const invested = quantity * buyPrice;
      const value = quantity * currentPrice;
      const profit = value - invested;
      const profitPct = invested > 0 ? (profit / invested) * 100 : 0;

      totalInvested += invested;
      currentValue += value;

      return {
        id: inv.id,
        name: inv.name,
        symbol: inv.symbol,
        type: inv.type,
        quantity: quantity,
        buy_price: buyPrice,
        current_price: currentPrice,
        invested: invested,
        value: value,
        profit: profit,
        profit_pct: Math.round(profitPct * 100) / 100
      };
    });

    const totalProfit = currentValue - totalInvested;
    const totalProfitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    res.json({
      total_invested: totalInvested,
      current_value: currentValue,
      total_profit: totalProfit,
      total_profit_pct: Math.round(totalProfitPct * 100) / 100,
      investments: investmentDetails
    });
  } catch (err) {
    next(err);
  }
});

// Calculate investment rebate (Bangladesh example)
router.post('/rebate-calculation', requireAuth, async (req, res, next) => {
  try {
    const { total_investment, investment_type = 'stock' } = req.body;

    if (!total_investment) {
      return res.status(400).json({ error: 'Total investment amount is required.' });
    }

    const investmentAmount = Number(total_investment);
    let rebate = 0;
    let rebateRate = 0;
    let maxRebate = 0;

    // Bangladesh investment rebate rules (example)
    if (investment_type === 'stock') {
      // For listed securities: Up to 25% of investment or 1.5 million, whichever is lower
      maxRebate = 1500000;
      rebateRate = 0.25;
      rebate = Math.min(investmentAmount * rebateRate, maxRebate);
    } else if (investment_type === 'dps') {
      // For DPS: Up to 20% of investment or 500,000, whichever is lower
      maxRebate = 500000;
      rebateRate = 0.20;
      rebate = Math.min(investmentAmount * rebateRate, maxRebate);
    } else if (investment_type === 'fdr') {
      // For FDR: Up to 15% of investment or 300,000, whichever is lower
      maxRebate = 300000;
      rebateRate = 0.15;
      rebate = Math.min(investmentAmount * rebateRate, maxRebate);
    } else if (investment_type === 'insurance') {
      // For life insurance: Up to 30% of premium or 1 million, whichever is lower
      maxRebate = 1000000;
      rebateRate = 0.30;
      rebate = Math.min(investmentAmount * rebateRate, maxRebate);
    } else {
      // General investment: Up to 10% of investment or 200,000, whichever is lower
      maxRebate = 200000;
      rebateRate = 0.10;
      rebate = Math.min(investmentAmount * rebateRate, maxRebate);
    }

    res.json({
      investment_amount: investmentAmount,
      investment_type: investment_type,
      rebate_rate: rebateRate * 100,
      max_rebate: maxRebate,
      calculated_rebate: Math.round(rebate),
      effective_rebate_pct: investmentAmount > 0 ? ((rebate / investmentAmount) * 100).toFixed(2) : 0
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
