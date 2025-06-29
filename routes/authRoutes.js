import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Log email configuration (without sensitive data)
console.log('Email configuration:', {
  hasEmailUser: !!process.env.EMAIL_USER,
  hasEmailPass: !!process.env.EMAIL_PASS,
  hasAdminEmail: !!process.env.ADMIN_EMAIL,
  emailUser: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}...` : 'not set',
  adminEmail: process.env.ADMIN_EMAIL || 'not set'
});

// Store OTP temporarily (in production, use Redis or similar)
const otpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
      console.error('Missing email configuration:', {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPass: !!process.env.EMAIL_PASS,
        hasAdminEmail: !!process.env.ADMIN_EMAIL
      });
      return res.status(500).json({ 
        message: 'Email configuration is missing',
        details: {
          hasEmailUser: !!process.env.EMAIL_USER,
          hasEmailPass: !!process.env.EMAIL_PASS,
          hasAdminEmail: !!process.env.ADMIN_EMAIL
        }
      });
    }

    const otp = generateOTP();
    const adminEmail = process.env.ADMIN_EMAIL;

    console.log('Attempting to send OTP to:', adminEmail);

    // Store OTP with expiration (5 minutes)
    otpStore.set(adminEmail, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    // Configure nodemailer with debug logging
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true, // Enable debug logging
      logger: true // Enable logger
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError);
      return res.status(500).json({ 
        message: 'Failed to verify email configuration',
        error: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
      });
    }

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: 'Admin Login OTP',
      text: `Your OTP for admin login is: ${otp}. This OTP will expire in 5 minutes.`
    };

    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully');

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      message: 'Failed to send OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const storedData = otpStore.get(adminEmail);

    if (!storedData) {
      return res.status(400).json({ message: 'OTP expired or not found' });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(adminEmail);
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (otp !== storedData.otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Clear OTP after successful verification
    otpStore.delete(adminEmail);

    // Generate JWT token
    const token = jwt.sign(
      { email: adminEmail, role: 'admin' },
      global.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

// Verify admin token
router.get('/verify', verifyAdmin, (req, res) => {
  res.json({ message: 'Token is valid' });
});

export default router; 