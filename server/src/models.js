import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const options = { timestamps: true };
export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'organizer'], default: 'student' },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Event' }]
}, options));
export const Event = model('Event', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 4000 },
  category: { type: String, required: true, enum: ['Technology', 'Culture', 'Sports', 'Workshop', 'Academic', 'Community'] },
  location: { type: String, required: true, maxlength: 120 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 10000 },
  reserved: { type: Number, default: 0, min: 0 },
  organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  checkInCode: { type: String, required: true },
  status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft' },
  imageUrl: { type: String, default: '' }
}, options));
const registrationSchema = new Schema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['registered', 'waitlisted', 'cancelled'], required: true },
  attendedAt: { type: Date, default: null }
}, options);
registrationSchema.index({ event: 1, student: 1 }, { unique: true });
export const Registration = model('Registration', registrationSchema);
const feedbackSchema = new Schema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500, default: '' }
}, options);
feedbackSchema.index({ event: 1, student: 1 }, { unique: true });
export const Feedback = model('Feedback', feedbackSchema);
export const Announcement = model('Announcement', new Schema({
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, maxlength: 500 }
}, options));
