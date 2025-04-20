
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { sendOTPEmail } from '../utils/mailer.js';
import { generateOTP, hashOTP, compareHashedOTP } from '../utils/otp.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Expecting "Bearer <token>"
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId; // Attach userId to request
    console.log('Token verified, userId:', req.userId);
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// SIGNUP - generate and send OTP, store in user_otps
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    console.log('Signup request:', { username, email });
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length) {
      console.log('Email already registered:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    console.log('Generated OTP:', otp, 'Hashed OTP:', hashedOtp);

    await pool.query(
      'INSERT INTO user_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [email, hashedOtp, expiresAt]
    );

    await sendOTPEmail(email, otp);
    console.log('OTP sent for email:', email);

    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Signup error:', err.message, err.stack);
    res.status(500).json({ error: `Signup failed: ${err.message}` });
  }
});

// VERIFY OTP AND REGISTER - verify OTP and save user
router.post('/verify-otp-and-register', async (req, res) => {
  const { username, email, password, otp } = req.body;
  try {
    console.log('Verify OTP and register request:', { email });
    const otpRecord = await pool.query(
      'SELECT * FROM user_otps WHERE email = $1 ORDER BY expires_at DESC LIMIT 1',
      [email]
    );

    if (!otpRecord.rows.length || new Date() > otpRecord.rows[0].expires_at) {
      console.log('OTP invalid or expired for email:', email);
      return res.status(400).json({ error: 'OTP expired or invalid' });
    }

    const valid = await compareHashedOTP(otp, otpRecord.rows[0].otp);
    if (!valid) {
      console.log('Incorrect OTP for email:', email);
      return res.status(400).json({ error: 'Incorrect OTP' });
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length) {
      console.log('Email already registered during verification:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    await pool.query('DELETE FROM user_otps WHERE email = $1', [email]);

    console.log('User registered:', newUser.rows[0]);
    res.status(201).json({ message: 'Registration successful', user: newUser.rows[0] });
  } catch (err) {
    console.error('Verify OTP and register error:', err.message, err.stack);
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log('Login request:', { email });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password mismatch:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err) {
    console.error('Login error:', err.message, err.stack);
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// FORGOT PASSWORD - send OTP
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    console.log('Forgot password request:', { email });
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) {
      console.log('Email not found:', email);
      return res.status(404).json({ error: 'Email not found' });
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log('Generated OTP for forgot password:', otp, 'Hashed OTP:', hashedOtp);

    // Include both user_id AND email in the insert
    await pool.query(
      'INSERT INTO user_otps (user_id, email, otp, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, email, hashedOtp, expiresAt]
    );

    await sendOTPEmail(email, otp);

    res.json({ message: 'OTP sent for password reset' });
  } catch (err) {
    console.error('Forgot password error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to send OTP: ${err.message}` });
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    console.log('Reset password request:', { email });
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) {
      console.log('Email not found:', email);
      return res.status(404).json({ error: 'Email not found' });
    }

    const otpResult = await pool.query(
      'SELECT * FROM user_otps WHERE user_id = $1 ORDER BY expires_at DESC LIMIT 1',
      [user.id]
    );

    if (!otpResult.rows.length || new Date() > otpResult.rows[0].expires_at) {
      console.log('OTP invalid or expired for user:', user.id);
      return res.status(400).json({ error: 'OTP expired or invalid' });
    }

    const isValid = await compareHashedOTP(otp, otpResult.rows[0].otp);
    if (!isValid) {
      console.log('Incorrect OTP for user:', user.id);
      return res.status(400).json({ error: 'Incorrect OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
    await pool.query('DELETE FROM user_otps WHERE user_id = $1', [user.id]);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err.message, err.stack);
    res.status(500).json({ error: `Password reset failed: ${err.message}` });
  }
});

// GET PROFILE - fetch user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    console.log('Get profile request for userId:', req.userId);
    const userResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to fetch profile: ${err.message}` });
  }
});

// UPDATE PROFILE - edit username, email, or password
router.put('/profile', verifyToken, async (req, res) => {
  const { username, email, password } = req.body;
  try {
    console.log('Update profile request for userId:', req.userId, { username, email, password: password ? '[provided]' : '[not provided]' });

    // Check if at least one field is provided
    if (!username && !email && !password) {
      console.log('No fields provided for update');
      return res.status(400).json({ error: 'At least one field (username, email, password) must be provided' });
    }

    // Fetch current user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update fields
    const updates = {};
    if (username) updates.username = username;
    if (email && email !== user.email) {
      // Check email uniqueness
      const existingEmail = await pool.query('SELECT * FROM users WHERE email = $1 AND id != $2', [email, req.userId]);
      if (existingEmail.rows.length) {
        console.log('Email already in use:', email);
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.email = email;
    }
    if (password) {
      // Basic password validation
      if (password.length < 6) {
        console.log('Password too short for userId:', req.userId);
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    // If no updates, return early
    if (Object.keys(updates).length === 0) {
      console.log('No valid fields to update for userId:', req.userId);
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build dynamic query
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
    const values = Object.values(updates);
    values.push(req.userId); // Add userId for WHERE clause

    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${fields.length + 1} RETURNING id, username, email`,
      values
    );

    // Fetch updated user
    const updatedUserResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);
    const updatedUser = updatedUserResult.rows[0];

    console.log('Profile updated for userId:', req.userId, updatedUser);
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to update profile: ${err.message}` });
  }
});

// DELETE PROFILE - delete user account
router.delete('/profile', verifyToken, async (req, res) => {
  try {
    console.log('Delete profile request for userId:', req.userId);

    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!userResult.rows.length) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete related OTPs
    await pool.query('DELETE FROM user_otps WHERE user_id = $1', [req.userId]);

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);

    console.log('Profile deleted for userId:', req.userId);
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    console.error('Delete profile error:', err.message, err.stack);
    res.status(500).json({ error: `Failed to delete profile: ${err.message}` });
  }
});

export default router;