require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

async function seed() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const userOne = await pool.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ('Nomsa Dlamini', 'nomsa@example.com', $1)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [passwordHash]
  );

  const userTwo = await pool.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ('Themba Nkosi', 'themba@example.com', $1)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [passwordHash]
  );

  const group = await pool.query(
    `INSERT INTO bhisi_groups (name, description, monthly_contribution, created_by)
     VALUES ('Ubuntu Growth Circle', 'A monthly circle focused on school fees and emergency reserves.', 1200, $1)
     RETURNING id`,
    [userOne.rows[0].id]
  );

  await pool.query(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES ($1, $2, 'admin'), ($1, $3, 'member')
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [group.rows[0].id, userOne.rows[0].id, userTwo.rows[0].id]
  );

  await pool.query(
    `INSERT INTO contributions (group_id, user_id, amount)
     VALUES ($1, $2, 1200), ($1, $3, 1200)`,
    [group.rows[0].id, userOne.rows[0].id, userTwo.rows[0].id]
  );

  await pool.query(
    `INSERT INTO payouts (group_id, recipient_user_id, payout_date, amount)
     VALUES ($1, $2, CURRENT_DATE + INTERVAL '10 day', 2400)
     ON CONFLICT DO NOTHING`,
    [group.rows[0].id, userTwo.rows[0].id]
  );

  console.log('Seed data inserted. Login with nomsa@example.com / Password123!');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
