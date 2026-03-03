const express = require('express');
const { ensureAuthenticated } = require('../middleware/auth');
const { query } = require('../db/repository');
const { toCurrency, toDate } = require('../utils/format');

const router = express.Router();

router.get('/', async (_req, res) => {
  const publicStats = await query(
    `SELECT
      COUNT(DISTINCT u.id) AS members,
      COUNT(DISTINCT g.id) AS groups,
      COALESCE(SUM(c.amount), 0) AS pooled
     FROM users u
     LEFT JOIN group_members gm ON gm.user_id = u.id
     LEFT JOIN bhisi_groups g ON g.id = gm.group_id
     LEFT JOIN contributions c ON c.group_id = g.id`
  );

  res.render('home', {
    title: 'mybhisi | Build trust, rotate wealth',
    stats: publicStats.rows[0],
    toCurrency
  });
});

router.get('/dashboard', ensureAuthenticated, async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    const groupResult = await query(
      `SELECT g.id, g.name, g.monthly_contribution, g.created_at,
              COALESCE(SUM(c.amount), 0) AS total_collected,
              (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
       FROM bhisi_groups g
       JOIN group_members gm ON gm.group_id = g.id
       LEFT JOIN contributions c ON c.group_id = g.id
       WHERE gm.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const upcomingPayouts = await query(
      `SELECT p.id, p.payout_date, p.amount, g.name AS group_name,
              u.full_name AS recipient_name
       FROM payouts p
       JOIN bhisi_groups g ON g.id = p.group_id
       JOIN users u ON u.id = p.recipient_user_id
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
         AND p.payout_date >= CURRENT_DATE
       ORDER BY p.payout_date ASC
       LIMIT 5`,
      [userId]
    );

    res.render('dashboard', {
      title: 'Dashboard',
      groups: groupResult.rows,
      payouts: upcomingPayouts.rows,
      toCurrency,
      toDate
    });
  } catch (error) {
    next(error);
  }
});

router.get('/groups/new', ensureAuthenticated, (req, res) => {
  res.render('new-group', { title: 'Create Bhisi Group', error: null, values: {} });
});

router.post('/groups', ensureAuthenticated, async (req, res, next) => {
  try {
    const { name, description, monthlyContribution } = req.body;
    const values = { name, description, monthlyContribution };

    if (!name || !monthlyContribution || Number(monthlyContribution) <= 0) {
      return res.status(400).render('new-group', {
        title: 'Create Bhisi Group',
        error: 'Group name and a valid monthly contribution are required.',
        values
      });
    }

    const createGroup = await query(
      `INSERT INTO bhisi_groups (name, description, monthly_contribution, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name.trim(), description?.trim() || null, monthlyContribution, req.session.user.id]
    );

    await query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [createGroup.rows[0].id, req.session.user.id]
    );

    res.redirect(`/groups/${createGroup.rows[0].id}`);
  } catch (error) {
    next(error);
  }
});

router.get('/groups/:id', ensureAuthenticated, async (req, res, next) => {
  try {
    const groupId = Number(req.params.id);

    const groupResult = await query(
      `SELECT g.*, (gm.role = 'admin') AS is_admin
       FROM bhisi_groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 AND gm.user_id = $2`,
      [groupId, req.session.user.id]
    );

    if (groupResult.rowCount === 0) {
      return res.status(404).render('404', { title: 'Group not found' });
    }

    const membersResult = await query(
      `SELECT u.full_name, u.email, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    const contributionsResult = await query(
      `SELECT c.amount, c.paid_at, u.full_name
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.group_id = $1
       ORDER BY c.paid_at DESC
       LIMIT 10`,
      [groupId]
    );

    const payoutResult = await query(
      `SELECT p.amount, p.payout_date, u.full_name AS recipient
       FROM payouts p
       JOIN users u ON u.id = p.recipient_user_id
       WHERE p.group_id = $1
       ORDER BY p.payout_date ASC`,
      [groupId]
    );

    res.render('group-details', {
      title: groupResult.rows[0].name,
      group: groupResult.rows[0],
      members: membersResult.rows,
      contributions: contributionsResult.rows,
      payouts: payoutResult.rows,
      toCurrency,
      toDate,
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.post('/groups/:id/contributions', ensureAuthenticated, async (req, res, next) => {
  try {
    const groupId = Number(req.params.id);
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.redirect(`/groups/${groupId}`);
    }

    const membership = await query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.session.user.id]
    );

    if (membership.rowCount === 0) {
      return res.status(403).render('403', { title: 'Forbidden' });
    }

    await query(
      `INSERT INTO contributions (group_id, user_id, amount)
       VALUES ($1, $2, $3)`,
      [groupId, req.session.user.id, amount]
    );

    res.redirect(`/groups/${groupId}`);
  } catch (error) {
    next(error);
  }
});

router.post('/groups/:id/payouts', ensureAuthenticated, async (req, res, next) => {
  try {
    const groupId = Number(req.params.id);
    const { recipientEmail, payoutDate, amount } = req.body;

    const adminCheck = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.session.user.id]
    );

    if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).render('403', { title: 'Forbidden' });
    }

    const recipient = await query('SELECT id FROM users WHERE email = $1', [recipientEmail.toLowerCase()]);
    if (recipient.rowCount === 0) {
      return res.redirect(`/groups/${groupId}`);
    }

    await query(
      `INSERT INTO payouts (group_id, recipient_user_id, payout_date, amount)
       VALUES ($1, $2, $3, $4)`,
      [groupId, recipient.rows[0].id, payoutDate, amount]
    );

    res.redirect(`/groups/${groupId}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
