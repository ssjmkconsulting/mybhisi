const pool = require('./pool');

const query = (text, params = []) => pool.query(text, params);

module.exports = { query, pool };
