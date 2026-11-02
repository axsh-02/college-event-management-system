import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Event, Registration, Announcement, Feedback } from './models.js';

const days = offset => new Date(Date.now() + offset * 86400000);
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_events');
try {
  const passwordHash = await bcrypt.hash('Demo@12345', 12);
  const organizer = await User.findOneAndUpdate({ email: 'organizer@campusloop.edu' },
    { $set: { name: 'Campus Events Office', passwordHash, role: 'organizer' } }, { upsert: true, new: true });
  const student = await User.findOneAndUpdate({ email: 'student@campusloop.edu' },
    { $set: { name: 'Aarav Sharma', passwordHash, role: 'student' } }, { upsert: true, new: true });
  const samples = [
    { title: 'Build Night: AI for Good', category: 'Technology', location: 'Innovation Lab · Block C', description: 'Team up, prototype an idea for your community, and show it at the end of the evening. Beginners welcome. Bring a laptop and curiosity.', start: 5, duration: 0.25, capacity: 80, imageUrl: '' },
    { title: 'Rhythm & Roots Festival', category: 'Culture', location: 'Open Air Auditorium', description: 'An evening of music, dance, and performances from student groups across campus. Join us for a celebration of every voice.', start: 9, duration: 0.25, capacity: 300, imageUrl: '' },
    { title: 'Design Your First Portfolio', category: 'Workshop', location: 'Design Studio · Room 204', description: 'A hands-on workshop covering project stories, visual hierarchy, and a portfolio that shows how you think.', start: 12, duration: 0.15, capacity: 35, imageUrl: '' },
    { title: 'Interdepartmental Football Cup', category: 'Sports', location: 'Main Sports Ground', description: 'Cheer for your department, meet the teams, and enjoy a full day of football on campus.', start: 16, duration: 0.33, capacity: 120, imageUrl: '' },
    { title: 'Research Poster Showcase', category: 'Academic', location: 'Central Library Hall', description: 'Explore student research and talk with the people behind the posters. All disciplines welcome.', start: 20, duration: 0.2, capacity: 90, imageUrl: '' },
    { title: 'Campus Green Drive', category: 'Community', location: 'North Gate Assembly Point', description: 'Help plant native trees and clean shared spaces. Gloves and supplies are provided.', start: 24, duration: 0.12, capacity: 60, imageUrl: '' }
  ];
  for (const sample of samples) {
    const event = await Event.findOneAndUpdate({ title: sample.title, organizer: organizer.id },
      { $set: { description: sample.description, category: sample.category, location: sample.location, startsAt: days(sample.start), endsAt: days(sample.start + sample.duration), registrationDeadline: days(sample.start - 1), capacity: sample.capacity, status: 'published', imageUrl: sample.imageUrl }, $setOnInsert: { checkInCode: 'DEMO24', reserved: 0 } },
      { upsert: true, new: true });
    if (!await Announcement.exists({ event: event.id })) await Announcement.create({ event: event.id, author: organizer.id, message: 'Registration is open! More details will be shared here as the event approaches.' });
  }
  console.log('Demo accounts: organizer@campusloop.edu and student@campusloop.edu / Demo@12345');
  console.log('Seed complete. Existing registrations and feedback were preserved.');
} finally { await mongoose.disconnect(); }
