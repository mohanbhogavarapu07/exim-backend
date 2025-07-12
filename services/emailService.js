import nodemailer from 'nodemailer';
import Subscriber from '../models/Subscriber.js';

export async function sendContactEmail({ fullName, email, company, phone, country, serviceInterest, message }) {
  // Log credentials at the time of sending
  console.log('Nodemailer credentials:', process.env.EMAIL_USER, process.env.EMAIL_PASS ? 'set' : 'not set');

  // Create transporter here, not at the top of the file!
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: 'New Contact Form Submission',
    text: `New contact form submission:\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nCountry/Market of Interest: ${country}\nService Interest: ${serviceInterest}\nMessage: ${message}`,
    html: `<h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Country/Market of Interest:</strong> ${country}</p>
      <p><strong>Service Interest:</strong> ${serviceInterest}</p>
      <p><strong>Message:</strong> ${message}</p>`
  };
  await transporter.sendMail(mailOptions);
}

export async function sendJobApplicationEmail({ name, email, phone, position, resume }) {
  // Log credentials at the time of sending
  console.log('Nodemailer credentials:', process.env.EMAIL_USER, process.env.EMAIL_PASS ? 'set' : 'not set');
  console.log('EmailService ENV:', {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS ? 'set' : 'not set',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `New Job Application: ${position}`,
    text: `New job application received:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nPosition: ${position}`,
    html: `<h2>New Job Application</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Position:</strong> ${position}</p>`,
    attachments: resume ? [{
      filename: 'resume.pdf',
      content: resume.split(',')[1], // base64 string after comma
      encoding: 'base64',
    }] : [],
  };
  await transporter.sendMail(mailOptions);
}

export async function sendCallBookingEmail({ fullName, email, company, phone, products, targetMarkets, experience, preferredTime }) {
  // Log credentials at the time of sending
  console.log('Nodemailer credentials:', process.env.EMAIL_USER, process.env.EMAIL_PASS ? 'set' : 'not set');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: 'New Free Consultation Call Booking',
    text: `New call booking request:\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nProducts: ${products}\nTarget Markets: ${targetMarkets}\nExperience Level: ${experience}\nPreferred Call Time: ${preferredTime}`,
    html: `<h2>New Free Consultation Call Booking</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Products:</strong> ${products}</p>
      <p><strong>Target Markets:</strong> ${targetMarkets}</p>
      <p><strong>Experience Level:</strong> ${experience}</p>
      <p><strong>Preferred Call Time:</strong> ${preferredTime}</p>`
  };
  await transporter.sendMail(mailOptions);
}

export async function sendBlogToSubscribers(blog) {
  // Fetch all subscriber emails
  const subscribers = await Subscriber.find({}, 'email');
  const emails = subscribers.map(sub => sub.email);
  if (emails.length === 0) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    bcc: emails, // BCC for privacy
    subject: `New Blog Update: ${blog.title}`,
    text: `Check out our latest blog post: ${blog.title}\n\n${blog.description}\n\nRead more: ${ 'https://exim.drehill.in'}/blog/${blog.slug}`,
    html: `<h2>${blog.title}</h2>
      <p>${blog.description}</p>
      <p><a href="${'https://exim.drehill.in'}/blog/${blog.slug}">Read the full post</a></p>`
  };
  await transporter.sendMail(mailOptions);
} 