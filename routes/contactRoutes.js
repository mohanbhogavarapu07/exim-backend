import express from 'express';
import { sendContactEmail, sendJobApplicationEmail, sendCallBookingEmail } from '../services/emailService.js';
import ContactForm from '../models/ContactForm.js';
import Subscriber from '../models/Subscriber.js';

const router = express.Router();

// POST /api/contact/submit-form
router.post('/submit-form', async (req, res) => {
  const { fullName, email, company, phone, country, serviceInterest, message } = req.body;
  try {
    // Save to DB
    await ContactForm.create({ fullName, email, company, phone, country, serviceInterest, message });
    // Optionally, send an email notification as well
    await sendContactEmail({ fullName, email, company, phone, country, serviceInterest, message });
    res.status(200).json({ message: 'Form submitted and email sent successfully.' });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({ message: 'Failed to send email.' });
  }
});

// POST /api/contact/submit-application
router.post('/submit-application', async (req, res) => {
  const { name, email, phone, position, resume } = req.body;
  try {
    await sendJobApplicationEmail({ name, email, phone, position, resume });
    res.status(200).json({ message: 'Application submitted and email sent successfully.' });
  } catch (error) {
    console.error('Error sending job application email:', error);
    res.status(500).json({ message: 'Failed to send job application email.' });
  }
});

// POST /api/contact/book-call
router.post('/book-call', async (req, res) => {
  const { fullName, email, company, phone, products, targetMarkets, experience, preferredTime } = req.body;
  try {
    await sendCallBookingEmail({ fullName, email, company, phone, products, targetMarkets, experience, preferredTime });
    res.status(200).json({ message: 'Call booking submitted and email sent successfully.' });
  } catch (error) {
    console.error('Error sending call booking email:', error);
    res.status(500).json({ message: 'Failed to send call booking email.' });
  }
});

// POST /api/contact/subscribe
router.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    // Upsert: only add if not already present
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(200).json({ message: 'Already subscribed.' });
    }
    await Subscriber.create({ email });
    res.status(200).json({ message: 'Subscribed successfully.' });
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({ message: 'Failed to subscribe.' });
  }
});

export default router; 