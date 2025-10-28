import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import Database from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import EmailService from '../services/emailService.js';

const router = express.Router();
const db = Database.getInstance().getConnection();
const emailService = new EmailService();

// Register user
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/).withMessage('Password must be at least 8 characters long, contain at least one uppercase letter, and one special character (!@#$%^&*)'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),

], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = generateToken({ email, type: 'verification' }, '24h');

    // Insert user
    const [result] = await db.execute(
      `INSERT INTO users (username, email, password, first_name, last_name, verification_token, verification_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [username, email, hashedPassword, firstName, lastName, verificationToken]
    );

    const userId = result.insertId;

    // Send verification email asynchronously
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    emailService.sendVerificationEmail(email, firstName, verificationLink).catch(error => {
      console.error('Failed to send verification email:', error);
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: { id: userId, username, email, firstName, lastName, emailVerified: false }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await db.execute(
      'SELECT id, username, email, password, first_name, last_name, photos, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email before logging in.',
        email: user.email
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        photos: user.photos ? JSON.parse(user.photos) : []
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Forgot password - Send reset email
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const [users] = await db.execute(
      'SELECT id, first_name FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const user = users[0];

    // Generate reset token (simple implementation - in production use JWT with expiration)
    const resetToken = generateToken({ id: user.id, email, type: 'reset' }, '1h');

    // Store reset token in database (you might want to create a separate table for this)
    await db.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
      [resetToken, user.id]
    );

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(email, user.first_name, resetLink);

    res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, password } = req.body;

    // Verify token (this is a simple implementation - in production verify JWT properly)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'reset') {
        return res.status(400).json({ success: false, message: 'Invalid reset token' });
      }

      // Check if token is still valid in database
      const [users] = await db.execute(
        'SELECT id FROM users WHERE id = ? AND reset_token = ? AND reset_token_expires > NOW()',
        [decoded.id, token]
      );

      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      await db.execute(
        'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [hashedPassword, decoded.id]
      );

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (jwtError) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// Verify email
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token } = req.body;

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'verification') {
        return res.status(400).json({ success: false, message: 'Invalid verification token' });
      }

      // Check if token is still valid in database
      const [users] = await db.execute(
        'SELECT id, email, first_name, last_name FROM users WHERE email = ? AND verification_token = ? AND verification_token_expires > NOW()',
        [decoded.email, token]
      );

      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
      }

      const user = users[0];

      // Update user as verified and clear verification token
      await db.execute(
        'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
        [user.id]
      );

      // Generate auth token for automatic login
      const authToken = generateToken({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      });

      res.json({
        success: true,
        message: 'Email verified successfully',
        token: authToken,
        user: { id: user.id, email: user.email, emailVerified: true }
      });
    } catch (jwtError) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify email' });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists and is not verified
    const [users] = await db.execute(
      'SELECT id, first_name, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = generateToken({ email, type: 'verification' }, '24h');

    // Update verification token in database
    await db.execute(
      'UPDATE users SET verification_token = ?, verification_token_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
      [verificationToken, user.id]
    );

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await emailService.sendVerificationEmail(email, user.first_name, verificationLink);

    res.json({ success: true, message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification email' });
  }
});

export default router;
