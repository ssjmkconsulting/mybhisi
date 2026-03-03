# mybhisi

A production-ready Node.js + PostgreSQL web app for managing Bhisi (rotating savings groups), with a polished Bootstrap UI.

## Features

- Account registration and sign in
- Create and manage Bhisi groups
- Track contributions with recent payment history
- Schedule payouts for members
- Dashboard for group and payout visibility
- Security basics: Helmet, compression, session hardening, and rate limiting

## Tech Stack

- Node.js + Express
- PostgreSQL (`pg`)
- EJS templates + Bootstrap 5

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update `DATABASE_URL` and `SESSION_SECRET` in `.env`.

4. Run migration and optional seed data:

```bash
npm run migrate
npm run seed
```

5. Start the app:

```bash
npm start
```

Open `http://localhost:3000`.

## Production Notes

- Set a strong `SESSION_SECRET`.
- Use a managed PostgreSQL instance with backups.
- Run behind a reverse proxy (Nginx/Cloud load balancer) and HTTPS.
- Set `NODE_ENV=production`.
