import mongoose from 'mongoose';

const contactFormSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  company: { type: String },
  phone: { type: String },
  country: { type: String },
  serviceInterest: { type: String },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ContactForm = mongoose.model('ContactForm', contactFormSchema);

export default ContactForm; 