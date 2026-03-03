require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const rateLimit = require('express-rate-limit');
const methodOverride = require('method-override');

const pool = require('./db/pool');
const { attachLocals } = require('./middleware/locals');
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');

const app = express();
const PgStore = pgSessionFactory(session);
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true
    }),
    name: 'mybhisi.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  })
);

app.use(
  '/auth',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(attachLocals);
app.use(authRoutes);
app.use(appRoutes);

app.use((_req, res) => {
  res.status(404).render('404', { title: 'Page not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).render('500', {
    title: 'Something went wrong',
    errorMessage: process.env.NODE_ENV === 'production' ? 'Please try again later.' : error.message
  });
});

app.listen(PORT, () => {
  console.log(`mybhisi running on http://localhost:${PORT}`);
});
