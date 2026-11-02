import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User, Event, Registration, Feedback, Announcement } from './models.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
const secret = process.env.JWT_SECRET;
if (!secret || secret === 'replace-with-a-long-random-secret') {
  console.error('Set a strong JWT_SECRET in server/.env before starting.');
  process.exit(1);
}
const route = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const id = value => mongoose.isValidObjectId(value);
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, favorites: user.favorites.map(String) });
const tokenFor = user => jwt.sign({ sub: user.id }, secret, { expiresIn: '7d' });
const auth = route(async (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) fail(401, 'Please sign in.');
  let payload;
  try { payload = jwt.verify(token, secret); } catch { fail(401, 'Session expired. Sign in again.'); }
  req.user = await User.findById(payload.sub);
  if (!req.user) fail(401, 'Account unavailable.');
  next();
});
const organizer = (req, _res, next) => req.user.role === 'organizer' ? next() : next(Object.assign(new Error('Organizer access required.'), { status: 403 }));
const ownEvent = async (eventId, user) => {
  if (!id(eventId)) fail(404, 'Event not found.');
  const event = await Event.findById(eventId);
  if (!event) fail(404, 'Event not found.');
  if (String(event.organizer) !== String(user.id)) fail(403, 'You do not manage this event.');
  return event;
};
const eventFor = async (eventId, user) => {
  if (!id(eventId)) fail(404, 'Event not found.');
  const event = await Event.findById(eventId).populate('organizer', 'name');
  if (!event || (event.status !== 'published' && String(event.organizer._id) !== String(user?.id))) fail(404, 'Event not found.');
  return event;
};
const eventInput = (body, existing) => {
  const keys = ['title','description','category','location','startsAt','endsAt','registrationDeadline','capacity','imageUrl'];
  const value = Object.fromEntries(keys.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
  const all = { ...(existing?.toObject() || {}), ...value };
  if (!all.title?.trim() || !all.description?.trim() || !all.location?.trim()) fail(400, 'Title, description and location are required.');
  if (!['Technology','Culture','Sports','Workshop','Academic','Community'].includes(all.category)) fail(400, 'Select a category.');
  if (!Number.isInteger(Number(all.capacity)) || Number(all.capacity) < 1 || Number(all.capacity) > 10000 || Number(all.capacity) < (existing?.reserved || 0)) fail(400, 'Capacity must be a whole number above reserved seats.');
  const start = new Date(all.startsAt), end = new Date(all.endsAt), deadline = new Date(all.registrationDeadline);
  if ([start,end,deadline].some(date => Number.isNaN(date.getTime())) || end <= start || deadline > start) fail(400, 'Use valid dates: end after start and deadline no later than start.');
  if (all.imageUrl && (!/^https?:\/\//i.test(all.imageUrl) || all.imageUrl.length > 500)) fail(400, 'Image must be a short HTTP(S) URL.');
  return { ...value, startsAt: start, endsAt: end, registrationDeadline: deadline, capacity: Number(all.capacity) };
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', route(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8) fail(400, 'Enter a name, valid email and password of at least 8 characters.');
  // Public signup is always a student. Organizers are created by the seed script or an administrator.
  if (await User.exists({ email: email.toLowerCase().trim() })) fail(409, 'Email already registered.');
  const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));
app.post('/api/auth/login', route(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase().trim() });
  if (!user || !await bcrypt.compare(req.body.password || '', user.passwordHash)) fail(401, 'Invalid email or password.');
  res.json({ token: tokenFor(user), user: publicUser(user) });
}));
app.get('/api/auth/me', auth, (req, res) => res.json(publicUser(req.user)));

app.get('/api/events', route(async (req, res) => {
  const { q = '', category = '', upcoming = '' } = req.query;
  const filter = { status: 'published' };
  if (category) filter.category = category;
  if (upcoming === 'true') filter.endsAt = { $gte: new Date() };
  if (q) filter.$or = ['title','description','location'].map(key => ({ [key]: { $regex: String(q).slice(0, 80).replace(/[.*+?^$\\{}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
  const events = await Event.find(filter).select('-checkInCode').populate('organizer', 'name').sort({ startsAt: 1 }).limit(100);
  res.json(events);
}));
app.get('/api/events/:eventId', route(async (req, res) => {
  const event = await eventFor(req.params.eventId);
  const [announcements, feedback] = await Promise.all([
    Announcement.find({ event: event.id }).populate('author', 'name').sort({ createdAt: -1 }).limit(30),
    Feedback.find({ event: event.id }).populate('student', 'name').sort({ createdAt: -1 }).limit(30)
  ]);
  const data = event.toObject();
  delete data.checkInCode;
  res.json({ ...data, announcements, feedback });
}));
app.get('/api/my/events', auth, organizer, route(async (req, res) => {
  res.json(await Event.find({ organizer: req.user.id }).sort({ startsAt: 1 }));
}));
app.get('/api/my/events/:eventId', auth, organizer, route(async (req, res) => {
  const event = await ownEvent(req.params.eventId, req.user);
  const [announcements, feedback] = await Promise.all([
    Announcement.find({ event: event.id }).populate('author', 'name').sort({ createdAt: -1 }).limit(30),
    Feedback.find({ event: event.id }).populate('student', 'name').sort({ createdAt: -1 }).limit(30)
  ]);
  await event.populate('organizer', 'name');
  res.json({ ...event.toObject(), announcements, feedback });
}));
app.post('/api/events', auth, organizer, route(async (req, res) => {
  const data = eventInput(req.body);
  const event = await Event.create({ ...data, organizer: req.user.id, checkInCode: crypto.randomBytes(3).toString('hex').toUpperCase(), status: req.body.status === 'published' ? 'published' : 'draft' });
  res.status(201).json(event);
}));
app.patch('/api/events/:eventId', auth, organizer, route(async (req, res) => {
  const event = await ownEvent(req.params.eventId, req.user);
  if (req.body.status && !['draft','published','cancelled'].includes(req.body.status)) fail(400, 'Invalid status.');
  const data = eventInput(req.body, event);
  Object.assign(event, data);
  if (req.body.status) event.status = req.body.status;
  await event.save();
  res.json(event);
}));
app.delete('/api/events/:eventId', auth, organizer, route(async (req, res) => {
  const event = await ownEvent(req.params.eventId, req.user);
  if (event.reserved > 0 || await Registration.exists({ event: event.id, status: 'waitlisted' })) fail(409, 'Cancel the event instead; participants have signed up.');
  await Promise.all([Event.deleteOne({ _id: event.id }), Announcement.deleteMany({ event: event.id }), Feedback.deleteMany({ event: event.id })]);
  res.status(204).end();
}));
app.post('/api/events/:eventId/favorite', auth, route(async (req, res) => {
  const event = await eventFor(req.params.eventId, req.user);
  const has = req.user.favorites.some(value => String(value) === event.id);
  await User.updateOne({ _id: req.user.id }, has ? { $pull: { favorites: event.id } } : { $addToSet: { favorites: event.id } });
  res.json({ favorite: !has });
}));
app.get('/api/my/registrations', auth, route(async (req, res) => {
  res.json(await Registration.find({ student: req.user.id, status: { $ne: 'cancelled' } }).populate({ path: 'event', populate: { path: 'organizer', select: 'name' } }).sort({ createdAt: -1 }));
}));
app.post('/api/events/:eventId/register', auth, route(async (req, res) => {
  if (req.user.role !== 'student') fail(403, 'Student account required.');
  const event = await eventFor(req.params.eventId, req.user);
  if (event.status !== 'published' || new Date() >= event.registrationDeadline || new Date() >= event.startsAt) fail(409, 'Registration is closed.');
  const old = await Registration.findOne({ event: event.id, student: req.user.id });
  if (old && old.status !== 'cancelled') fail(409, 'You already joined this event.');
  const claimed = await Event.updateOne({ _id: event.id, status: 'published', reserved: { $lt: event.capacity } }, { $inc: { reserved: 1 } });
  const status = claimed.modifiedCount ? 'registered' : 'waitlisted';
  try {
    const registration = await Registration.findOneAndUpdate(
      { event: event.id, student: req.user.id, status: { $in: ['cancelled', null] } },
      { $set: { status, attendedAt: null }, $setOnInsert: { event: event.id, student: req.user.id } },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(registration);
  } catch (error) {
    if (claimed.modifiedCount) await Event.updateOne({ _id: event.id }, { $inc: { reserved: -1 } });
    if (error.code === 11000) fail(409, 'You already joined this event.');
    throw error;
  }
}));
app.delete('/api/events/:eventId/register', auth, route(async (req, res) => {
  if (!id(req.params.eventId)) fail(404, 'Event not found.');
  const registration = await Registration.findOne({ event: req.params.eventId, student: req.user.id, status: { $ne: 'cancelled' } });
  if (!registration) fail(404, 'No active registration.');
  if (registration.attendedAt) fail(409, 'Checked-in attendance cannot be cancelled.');
  const wasRegistered = registration.status === 'registered';
  registration.status = 'cancelled';
  await registration.save();
  if (wasRegistered) {
    const next = await Registration.findOneAndUpdate({ event: registration.event, status: 'waitlisted' }, { $set: { status: 'registered' } }, { sort: { createdAt: 1 }, new: true });
    if (!next) await Event.updateOne({ _id: registration.event, reserved: { $gt: 0 } }, { $inc: { reserved: -1 } });
  }
  res.json({ message: wasRegistered ? 'Registration cancelled; the next waitlisted student received the seat if applicable.' : 'Waitlist entry cancelled.' });
}));
app.post('/api/events/:eventId/check-in', auth, route(async (req, res) => {
  const event = await eventFor(req.params.eventId, req.user);
  if (event.status !== 'published' || new Date() < event.startsAt || new Date() > event.endsAt) fail(409, 'Check-in is available only during the event.');
  if ((req.body.code || '').trim().toUpperCase() !== event.checkInCode) fail(400, 'Incorrect check-in code.');
  const registration = await Registration.findOneAndUpdate({ event: event.id, student: req.user.id, status: 'registered', attendedAt: null }, { $set: { attendedAt: new Date() } }, { new: true });
  if (!registration) fail(409, 'A confirmed, unchecked registration is required.');
  res.json(registration);
}));
app.get('/api/events/:eventId/attendees', auth, organizer, route(async (req, res) => {
  await ownEvent(req.params.eventId, req.user);
  res.json(await Registration.find({ event: req.params.eventId, status: { $ne: 'cancelled' } }).populate('student', 'name email').sort({ createdAt: 1 }));
}));
app.patch('/api/events/:eventId/attendance/:studentId', auth, organizer, route(async (req, res) => {
  await ownEvent(req.params.eventId, req.user);
  if (!id(req.params.studentId)) fail(404, 'Student not found.');
  const registration = await Registration.findOne({ event: req.params.eventId, student: req.params.studentId, status: 'registered' });
  if (!registration) fail(404, 'Confirmed registration not found.');
  registration.attendedAt = req.body.attended ? new Date() : null;
  await registration.save();
  res.json(registration);
}));
app.post('/api/events/:eventId/announcements', auth, organizer, route(async (req, res) => {
  await ownEvent(req.params.eventId, req.user);
  const message = req.body.message?.trim();
  if (!message || message.length > 500) fail(400, 'Write an announcement under 500 characters.');
  const announcement = await Announcement.create({ event: req.params.eventId, author: req.user.id, message });
  res.status(201).json(announcement);
}));
app.post('/api/events/:eventId/feedback', auth, route(async (req, res) => {
  const event = await eventFor(req.params.eventId, req.user);
  if (new Date() < event.startsAt) fail(409, 'Feedback opens when the event begins.');
  if (!await Registration.exists({ event: event.id, student: req.user.id, status: 'registered', attendedAt: { $ne: null } })) fail(403, 'Only checked-in participants may review this event.');
  const rating = Number(req.body.rating), comment = String(req.body.comment || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) fail(400, 'Choose 1–5 stars and a comment under 500 characters.');
  const feedback = await Feedback.findOneAndUpdate({ event: event.id, student: req.user.id }, { $set: { rating, comment } }, { upsert: true, new: true, runValidators: true });
  res.json(feedback);
}));
app.get('/api/organizer/stats', auth, organizer, route(async (req, res) => {
  const events = await Event.find({ organizer: req.user.id }).select('_id status');
  const ids = events.map(event => event.id);
  const [registrations, attended, waitlisted, reviews] = await Promise.all([
    Registration.countDocuments({ event: { $in: ids }, status: 'registered' }),
    Registration.countDocuments({ event: { $in: ids }, attendedAt: { $ne: null } }),
    Registration.countDocuments({ event: { $in: ids }, status: 'waitlisted' }),
    Feedback.countDocuments({ event: { $in: ids } })
  ]);
  res.json({ events: events.length, published: events.filter(event => event.status === 'published').length, registrations, attended, waitlisted, reviews });
}));
app.use((_req, _res, next) => next(Object.assign(new Error('Route not found.'), { status: 404 })));
app.use((error, _req, res, _next) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ error: error.message });
  if (error.code === 11000) return res.status(409).json({ error: 'This entry already exists.' });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong.' });
});
const port = Number(process.env.PORT || 5000);
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_events')
  .then(() => app.listen(port, () => console.log(`API listening on http://localhost:${port}`)))
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
