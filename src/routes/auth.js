const express = require('express');
const bcrypt = require('bcryptjs');
const { ensureGuest } = require('../middleware/auth');
const { query } = require('../db/repository');

const router = express.Router();

router.get('/register', ensureGuest, (req, res) => {
  res.render('register', { title: 'Create account', error: null, values: {} });
});

router.post('/register', ensureGuest, async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const values = { fullName, email };

    if (!fullName || !email || !password || password.length < 8) {
      return res.status(400).render('register', {
        title: 'Create account',
        error: 'Please provide your full name, a valid email and a password of at least 8 characters.',
        values
      });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).render('register', {
        title: 'Create account',
        error: 'An account with that email already exists.',
        values
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email`,
      [fullName.trim(), email.toLowerCase(), passwordHash]
    );

    req.session.user = inserted.rows[0];
    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
});

router.get('/login', ensureGuest, (req, res) => {
  res.render('login', { title: 'Sign in', error: null, values: {} });
});

router.post('/login', ensureGuest, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const values = { email };

    if (!email || !password) {
      return res.status(400).render('login', {
        title: 'Sign in',
        error: 'Email and password are required.',
        values
      });
    }

    const userResult = await query('SELECT id, full_name, email, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).render('login', {
        title: 'Sign in',
        error: 'Invalid credentials.',
        values
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).render('login', {
        title: 'Sign in',
        error: 'Invalid credentials.',
        values
      });
    }

    req.session.user = { id: user.id, full_name: user.full_name, email: user.email };
    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mybhisi.sid');
    res.redirect('/');
  });
});

module.exports = router;
