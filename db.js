import pg from 'pg';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config();

// Configure timezone-aware type parsing
pg.types.setTypeParser(1082, (val) => val ? moment(val).format('YYYY-MM-DD') : val); // For date type
pg.types.setTypeParser(1114, (val) => val ? moment(val).tz('Asia/Kolkata').format() : val); // For timestamp without timezone
pg.types.setTypeParser(1184, (val) => val ? moment(val).tz('Asia/Kolkata').format() : val); // For timestamp with timezone

const pool = new pg.Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  host: process.env.POSTGRES_HOST,
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  // Add timezone configuration
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Set timezone for each new client connection
pool.on('connect', async (client) => {
  try {
    await client.query(`SET TIME ZONE 'Asia/Kolkata'`); // Replace with your desired timezone
    await client.query('SET DATESTYLE TO ISO, DMY'); // Set date format to DD-MM-YYYY
  } catch (error) {
    console.error('Failed to set timezone for new client:', error);
  }
});

// Test the connection and timezone
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SHOW TIMEZONE');
    console.log('Database timezone is set to:', res.rows[0].TimeZone);
    client.release();
  } catch (error) {
    console.error('Error checking database timezone:', error);
  }
})();

export default pool;