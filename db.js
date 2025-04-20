import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: false, // Set to false to avoid self-signed certificate issues
  },
});

export default pool;