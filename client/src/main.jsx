import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, MapPin, ArrowRight, Search, Heart, Users, Ticket, ChartNoAxesCombined, Megaphone, Star, Plus, LogOut, X, Clock3, CheckCircle2, Menu, Sparkles, ArrowLeft, LockKeyhole, Pencil, Trash2, ChevronDown } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['All', 'Technology', 'Culture', 'Sports', 'Workshop', 'Academic', 'Community'];
const color = { Technology: 'mint', Culture: 'peach', Sports: 'blue', Workshop: 'lavender', Academic: 'yellow', Community: 'rose' };
const fmt = date => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const time = date => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const initials = name => (name || 'U').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
const dateInput = value => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
const toIso = value => value ? new Date(value).toISOString() : '';
const defaultForm = () => ({ title: '', description: '', category: 'Technology', location: '', startsAt: '', endsAt: '', registrationDeadline: '', capacity: 50, imageUrl: '', status: 'draft' });

function App() {
  const [token, setToken] = useState(localStorage.getItem('campusloop_token') || '');
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore');
  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState([]);
  const [managed, setManaged] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [editing, setEditing] = useState(null);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [upcoming, setUpcoming] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const alert = message => { setToast(message); window.setTimeout(() => setToast(''), 4200); };
  const request = async (path, options = {}, access = token) => {
    const response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}), ...options.headers } });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  };
  const loadEvents = async () => { try { setEvents(await request('/events', {}, '')); } catch (error) { alert(error.message); } };
  const refreshUser = async () => {
    if (!token) return;
    try { setUser(await request('/auth/me')); }
    catch { localStorage.removeItem('campusloop_token'); setToken(''); setUser(null); }
  };
  const loadPrivate = async () => {
    if (!user) return;
    try {
      if (user.role === 'organizer') {
        const [e, s] = await Promise.all([request('/my/events'), request('/organizer/stats')]);
        setManaged(e); setStats(s);
      } else setMine(await request('/my/registrations'));
    } catch (error) { alert(error.message); }
  };
  const openEvent = async eventId => {
    try {
      const owned = user?.role === 'organizer' && managed.some(event => event._id === eventId);
      const data = owned ? await request('/my/events/' + eventId) : await request('/events/' + eventId, {}, '');
      setSelected(data);
      if (user?.role === 'organizer' && String(data.organizer._id) === user.id) setAttendees(await request('/events/' + eventId + '/attendees'));
      else setAttendees([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { alert(error.message); }
  };
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { refreshUser(); }, [token]);
  useEffect(() => { loadPrivate(); }, [user?.id, view]);
  const filtered = useMemo(() => events.filter(e =>
    (category === 'All' || e.category === category) &&
    (!upcoming || new Date(e.endsAt) >= new Date()) &&
    (!query || [e.title,e.description,e.location].join(' ').toLowerCase().includes(query.toLowerCase()))
  ), [events, category, upcoming, query]);
  const registration = eventId => mine.find(r => r.event?._id === eventId);
  const requireLogin = fn => user ? fn() : (setAuthMode('login'), setAuthOpen(true), alert('Sign in to continue.'));
  const run = async (fn, success) => {
    setBusy(true);
    try { await fn(); if (success) alert(success); await Promise.all([loadEvents(), loadPrivate()]); if (selected) await openEvent(selected._id); }
    catch (error) { alert(error.message); }
    finally { setBusy(false); }
  };
  const signOut = () => { localStorage.removeItem('campusloop_token'); setToken(''); setUser(null); setMine([]); setManaged([]); setSelected(null); setView('explore'); };
  const showView = next => { setView(next); setSelected(null); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleFavorite = eventId => requireLogin(() => run(async () => {
    const { favorite } = await request('/events/' + eventId + '/favorite', { method: 'POST' });
    setUser(current => ({ ...current, favorites: favorite ? [...current.favorites, eventId] : current.favorites.filter(id => id !== eventId) }));
  }, 'Saved list updated.'));
  const join = event => requireLogin(() => run(async () => {
    const result = await request('/events/' + event._id + '/register', { method: 'POST' });
    alert(result.status === 'waitlisted' ? 'Event full. You are on the waitlist.' : 'Your seat is confirmed!');
  }));
  const cancel = event => run(() => request('/events/' + event._id + '/register', { method: 'DELETE' }), 'Registration cancelled.');
  const saveEvent = async form => {
    await run(async () => {
      const payload = { ...form, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), registrationDeadline: toIso(form.registrationDeadline), capacity: Number(form.capacity) };
      if (editing?._id) await request('/events/' + editing._id, { method: 'PATCH', body: JSON.stringify(payload) });
      else await request('/events', { method: 'POST', body: JSON.stringify(payload) });
      setEditing(null);
    }, 'Event saved.');
  };

  return <div className="site">
    <header className="header"><div className="shell nav">
      <button className="brand" onClick={() => showView('explore')}><span className="brand-mark"><Sparkles size={21}/></span><span>campus<span className="brand-accent">loop</span><small>EVENTS THAT CONNECT</small></span></button>
      <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={23}/></button>
      <nav className={mobileNav ? 'links open' : 'links'}>
        <button className={view === 'explore' ? 'active' : ''} onClick={() => showView('explore')}>Explore events</button>
        {user && <button className={view === 'mine' ? 'active' : ''} onClick={() => showView('mine')}>{user.role === 'organizer' ? 'Organizer studio' : 'My events'}</button>}
        {user?.role === 'student' && <button className={view === 'saved' ? 'active' : ''} onClick={() => showView('saved')}>Saved</button>}
      </nav>
      <div className="account">{user ? <><span className="avatar" title={user.name}>{initials(user.name)}</span><span className="account-name">{user.name.split(' ')[0]}</span><button className="icon-btn logout" title="Sign out" onClick={signOut}><LogOut size={18}/></button></> : <><button className="text-btn" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}>Log in</button><button className="btn btn-dark compact" onClick={() => { setAuthMode('register'); setAuthOpen(true); }}>Join campusloop <ArrowRight size={16}/></button></>}</div>
    </div></header>
    {selected ? <EventPage event={selected} user={user} reg={registration(selected._id)} attendees={attendees} busy={busy} onBack={() => setSelected(null)} onJoin={() => join(selected)} onCancel={() => cancel(selected)} onFavorite={() => toggleFavorite(selected._id)} isFavorite={user?.favorites.includes(selected._id)} onAction={(fn, message) => run(fn, message)} request={request} onEdit={() => setEditing(selected)} /> :
    view === 'explore' ? <>
      <section className="hero"><div className="shell hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> THE CAMPUS IS YOURS TO EXPLORE</div><h1>Where your next <em>great story</em> begins.</h1><p>Discover experiences that spark new ideas, friendships, and memories. Your campus, all in one place.</p><button className="btn btn-lime" onClick={() => document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' })}>Explore events <ArrowRight size={19}/></button><div className="hero-proof"><div className="stack"><span>R</span><span>A</span><span>M</span></div><span>Made for curious minds on campus</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-circle"><span>GOOD<br/>THINGS<br/>HAPPEN<br/>HERE<span className="asterisk">✳</span></span></div><div className="floating-card card-one"><span className="float-icon">✦</span><span><strong>New connections</strong><small>Start with showing up</small></span></div><div className="floating-card card-two"><CalendarDays size={21}/><span><strong>Something for everyone</strong><small>Find your people</small></span></div><span className="star star-one">✳</span><span className="star star-two">✳</span></div></div></section>
      <section className="explore shell" id="events"><div className="section-head"><div><div className="overline">FIND YOUR THING</div><h2>Happening on campus<span className="period">.</span></h2><p>Big ideas, small gatherings, and everything in between.</p></div><div className="event-count">{filtered.length} {filtered.length === 1 ? 'event' : 'events'} to discover</div></div>
        <div className="filters"><div className="search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search events, places, ideas..." aria-label="Search events"/></div><label className="toggle"><input type="checkbox" checked={upcoming} onChange={e => setUpcoming(e.target.checked)}/><span/> Upcoming only</label></div>
        <div className="chips">{categories.map(c => <button key={c} className={category === c ? 'chip chosen' : 'chip'} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="event-grid">{filtered.map((event, i) => <EventCard key={event._id} event={event} index={i} onOpen={() => openEvent(event._id)} onFavorite={() => toggleFavorite(event._id)} favorite={user?.favorites.includes(event._id)}/>)}</div>
        {!filtered.length && <div className="empty"><Search size={32}/><h3>No events found</h3><p>Try a different search or category.</p><button className="btn btn-outline" onClick={() => { setQuery(''); setCategory('All'); setUpcoming(false); }}>Clear filters</button></div>}
      </section>
    </> : view === 'saved' ? <section className="shell workspace"><div className="overline">YOUR SHORTLIST</div><h1>Saved events<span className="period">.</span></h1><p className="muted">A little collection of things you don't want to miss.</p><div className="event-grid">{events.filter(e => user?.favorites.includes(e._id)).map((event, i) => <EventCard key={event._id} event={event} index={i} onOpen={() => openEvent(event._id)} onFavorite={() => toggleFavorite(event._id)} favorite/>)}</div>{!events.some(e => user?.favorites.includes(e._id)) && <Empty title="Nothing saved yet" text="Tap the heart on an event to keep it here." action={() => showView('explore')}/>}</section> :
      <section className="shell workspace">{user?.role === 'organizer' ? <>
        <div className="workspace-head"><div><div className="overline">ORGANIZER STUDIO</div><h1>Make it happen<span className="period">.</span></h1><p className="muted">Publish an experience and bring your campus together.</p></div><button className="btn btn-dark" onClick={() => setEditing(defaultForm())}><Plus size={18}/> Create event</button></div>
        <div className="stats-grid">{[['Events',stats?.events,'✳'],['Published',stats?.published,'↗'],['Registrations',stats?.registrations,'◎'],['Checked in',stats?.attended,'✓'],['Waitlisted',stats?.waitlisted,'◈'],['Reviews',stats?.reviews,'★']].map(([label,value,icon]) => <div className="stat" key={label}><span>{icon}</span><strong>{value ?? '—'}</strong><small>{label}</small></div>)}</div>
        <div className="list-head"><h2>Your events</h2><span>{managed.length} total</span></div><div className="manage-list">{managed.map(event => <div className="manage-row" key={event._id}><div className={'manage-icon ' + color[event.category]}>{event.category[0]}</div><div className="manage-info"><strong>{event.title}</strong><span>{fmt(event.startsAt)} · {event.location}</span></div><span className={'status ' + event.status}>{event.status}</span><span className="seat-count">{event.reserved}/{event.capacity} seats</span><button className="icon-btn" title="Edit" onClick={() => setEditing(event)}><Pencil size={17}/></button><button className="btn btn-outline compact" onClick={() => openEvent(event._id)}>Manage <ArrowRight size={15}/></button></div>)}</div>
        {!managed.length && <Empty title="Your first event starts here" text="Create a draft, then publish it when you're ready." action={() => setEditing(defaultForm())} actionText="Create event"/>}
      </> : <><div className="overline">YOUR CAMPUS CALENDAR</div><h1>My events<span className="period">.</span></h1><p className="muted">Everything you've signed up for, in one happy place.</p><div className="my-list">{mine.map(r => <div className="my-row" key={r._id}><div className={'my-date ' + color[r.event?.category]}><strong>{new Date(r.event?.startsAt).getDate()}</strong><small>{new Date(r.event?.startsAt).toLocaleString(undefined,{month:'short'})}</small></div><div><span className="overline mini">{r.event?.category}</span><h3>{r.event?.title}</h3><p>{r.event?.location} · {time(r.event?.startsAt)}</p></div><span className={'status ' + r.status}>{r.attendedAt ? 'Checked in' : r.status}</span><button className="btn btn-outline compact" onClick={() => openEvent(r.event?._id)}>Details <ArrowRight size={15}/></button></div>)}</div>{!mine.length && <Empty title="Your calendar is wide open" text="Find something inspiring and reserve your place." action={() => showView('explore')}/>}</>}</section>}
    <footer><div className="shell footer-inner"><div className="footer-brand">✳ campus<span>loop</span></div><span>Go somewhere. Meet someone. Make a memory.</span><small>Made for college communities · Full-stack demo</small></div></footer>
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} close={() => setAuthOpen(false)} submit={async (mode, data) => { setBusy(true); try { const result = await request('/auth/' + mode, { method: 'POST', body: JSON.stringify(data) }, ''); localStorage.setItem('campusloop_token', result.token); setToken(result.token); setUser(result.user); setAuthOpen(false); alert('Welcome to campusloop, ' + result.user.name.split(' ')[0] + '!'); } catch (error) { alert(error.message); } finally { setBusy(false); } }} busy={busy}/>}
    {editing && <EventForm initial={editing} close={() => setEditing(null)} save={saveEvent} busy={busy}/>}
    {toast && <div className="toast"><span>✳</span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}

function EventCard({ event, index, onOpen, onFavorite, favorite }) {
  const theme = color[event.category];
  return <article className="event-card"><button className={'card-art ' + theme} onClick={onOpen} aria-label={'View ' + event.title} style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
    {!event.imageUrl && <><span className="art-swoosh"/><span className="art-symbol">{['✳','◒','↗','✦','◎','❋'][index % 6]}</span><span className="art-caption">{event.category.toUpperCase()}<br/>ON CAMPUS</span></>}
    <span className="date-badge"><strong>{new Date(event.startsAt).getDate()}</strong><small>{new Date(event.startsAt).toLocaleString(undefined,{month:'short'}).toUpperCase()}</small></span>
  </button><div className="card-body"><div className="card-top"><span className={'category-tag ' + theme}>{event.category}</span><button className={'heart ' + (favorite ? 'filled' : '')} onClick={onFavorite} title={favorite ? 'Remove from saved' : 'Save event'}><Heart size={19} fill={favorite ? 'currentColor' : 'none'}/></button></div><button className="card-title" onClick={onOpen}>{event.title}</button><p>{event.description}</p><div className="card-meta"><span><MapPin size={15}/>{event.location}</span><span><Clock3 size={15}/>{time(event.startsAt)}</span></div><div className="card-bottom"><span><Users size={16}/>{Math.max(0, event.capacity - event.reserved)} spots left</span><button onClick={onOpen}>View event <ArrowRight size={17}/></button></div></div></article>;
}

function EventPage({ event, user, reg, attendees, busy, onBack, onJoin, onCancel, onFavorite, isFavorite, onAction, request, onEdit }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const owner = user?.role === 'organizer' && String(event.organizer._id) === user.id;
  const open = event.status === 'published' && new Date() < new Date(event.registrationDeadline) && new Date() < new Date(event.startsAt);
  const canCheckIn = new Date() >= new Date(event.startsAt) && new Date() <= new Date(event.endsAt);
  return <main className="shell detail"><button className="back" onClick={onBack}><ArrowLeft size={17}/> Back to events</button><div className="detail-layout"><div className="detail-main">
    <div className={'detail-banner ' + color[event.category]} style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>{!event.imageUrl && <><span>✳</span><small>{event.category.toUpperCase()} · CAMPUSLOOP</small></>}</div>
    <div className="detail-heading"><span className={'category-tag ' + color[event.category]}>{event.category}</span><h1>{event.title}</h1><p>Hosted by {event.organizer.name}</p></div>
    <div className="detail-block"><h2>About this event</h2><p className="description">{event.description}</p></div>
    <div className="detail-block"><div className="block-title"><h2>Announcements</h2><Megaphone size={19}/></div>{event.announcements?.length ? event.announcements.map(item => <div className="note" key={item._id}><span className="note-dot"/> <div><p>{item.message}</p><small>{item.author?.name} · {fmt(item.createdAt)}</small></div></div>) : <p className="muted">No announcements yet.</p>}
      {owner && <form className="inline-form" onSubmit={e => { e.preventDefault(); onAction(() => request('/events/' + event._id + '/announcements', { method: 'POST', body: JSON.stringify({ message }) }), 'Announcement posted.'); setMessage(''); }}><input value={message} onChange={e => setMessage(e.target.value)} maxLength={500} placeholder="Share an update with participants..." required/><button className="btn btn-dark compact" disabled={busy}>Post</button></form>}</div>
    <div className="detail-block"><div className="block-title"><h2>Participant feedback</h2><Star size={19}/></div>{event.feedback?.length ? event.feedback.map(item => <div className="review" key={item._id}><strong>{item.student?.name}</strong><span className="stars">{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</span><p>{item.comment || 'Rated this event.'}</p></div>) : <p className="muted">No reviews yet. Be the first after attending.</p>}
      {reg?.attendedAt && <form className="feedback-form" onSubmit={e => { e.preventDefault(); onAction(() => request('/events/' + event._id + '/feedback', { method: 'POST', body: JSON.stringify({ rating, comment }) }), 'Feedback saved.'); }}><label>Your rating <select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option value={n} key={n}>{n} stars</option>)}</select></label><textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="What did you enjoy?"/><button className="btn btn-dark compact" disabled={busy}>Share feedback</button></form>}</div>
    {owner && <div className="detail-block"><div className="block-title"><h2>Participant list</h2><Users size={19}/></div><div className="attendee-list">{attendees.map(r => <div className="attendee" key={r._id}><span className="avatar small">{initials(r.student?.name)}</span><div><strong>{r.student?.name}</strong><small>{r.student?.email}</small></div><span className={'status ' + r.status}>{r.status}</span>{r.status === 'registered' && <button className="btn btn-outline compact" disabled={busy} onClick={() => onAction(() => request('/events/' + event._id + '/attendance/' + r.student._id, { method: 'PATCH', body: JSON.stringify({ attended: !r.attendedAt }) }), 'Attendance updated.')}>{r.attendedAt ? 'Undo check-in' : 'Mark present'}</button>}</div>)}</div>{!attendees.length && <p className="muted">No participants yet.</p>}</div>}
  </div><aside className="detail-side"><div className="booking-card"><div className="booking-head"><span>THE DETAILS</span>{!owner && <button className={'heart ' + (isFavorite ? 'filled' : '')} onClick={onFavorite}><Heart size={20} fill={isFavorite ? 'currentColor' : 'none'}/></button>}</div><div className="booking-fact"><CalendarDays size={21}/><div><strong>{fmt(event.startsAt)}</strong><small>{time(event.startsAt)} – {time(event.endsAt)}</small></div></div><div className="booking-fact"><MapPin size={21}/><div><strong>{event.location}</strong><small>On campus</small></div></div><div className="booking-fact"><Users size={21}/><div><strong>{event.reserved} / {event.capacity} registered</strong><small>{Math.max(0,event.capacity-event.reserved)} places available</small></div></div><div className="booking-divider"/><div className="booking-deadline">Registration closes {fmt(event.registrationDeadline)}</div>
    {owner ? <><button className="btn btn-dark wide" onClick={onEdit}><Pencil size={17}/> Edit event</button><div className="code-box"><small>PARTICIPANT CHECK-IN CODE</small><strong>{event.checkInCode || '••••••'}</strong><p>Share this code with confirmed participants during the event.</p></div></> :
      reg ? <><div className={'booking-state ' + reg.status}><CheckCircle2 size={19}/>{reg.attendedAt ? 'Checked in' : reg.status === 'waitlisted' ? 'You are on the waitlist' : 'Your place is confirmed'}</div>{reg.status === 'registered' && !reg.attendedAt && canCheckIn && <form className="checkin-form" onSubmit={e => { e.preventDefault(); onAction(() => request('/events/' + event._id + '/check-in', { method: 'POST', body: JSON.stringify({ code }) }), 'You are checked in!'); setCode(''); }}><label>Check-in code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter event code" required/><button className="btn btn-dark wide" disabled={busy}>Check in</button></form>}{!reg.attendedAt && <button className="cancel-link" disabled={busy} onClick={onCancel}>Cancel my {reg.status === 'waitlisted' ? 'waitlist spot' : 'registration'}</button>}</> :
      <button className="btn btn-lime wide" disabled={!open || busy} onClick={onJoin}>{!open ? 'Registration closed' : event.reserved >= event.capacity ? 'Join waitlist' : 'Reserve my spot'} <ArrowRight size={18}/></button>}
    {!owner && !reg && open && <p className="booking-foot">Free to join · Takes less than a minute</p>}</div></aside></div></main>;
}

function AuthModal({ mode, setMode, close, submit, busy }) {
  const [data, setData] = useState({ name: '', email: '', password: '' });
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal auth-modal" role="dialog" aria-modal="true" aria-label="Account"><button className="modal-close" onClick={close}><X size={20}/></button><div className="modal-emblem">✳</div><div className="overline">{mode === 'login' ? 'WELCOME BACK' : 'JOIN THE COMMUNITY'}</div><h2>{mode === 'login' ? 'Good to see you again.' : 'Your campus awaits.'}</h2><p>{mode === 'login' ? 'Sign in to keep the good times rolling.' : 'Create a student account to join events.'}</p><form onSubmit={e => { e.preventDefault(); submit(mode, data); }}>{mode === 'register' && <label>Full name<input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} required minLength={2} placeholder="Your name"/></label>}<label>Email address<input type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })} required placeholder="you@college.edu"/></label><label>Password<input type="password" value={data.password} onChange={e => setData({ ...data, password: e.target.value })} required minLength={mode === 'register' ? 8 : 1} placeholder="At least 8 characters"/></label><button className="btn btn-dark wide" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17}/></button></form><div className="modal-switch">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Log in'}</button></div></div></div>;
}

function EventForm({ initial, close, save, busy }) {
  const [form, setForm] = useState({ ...defaultForm(), ...initial, startsAt: dateInput(initial.startsAt), endsAt: dateInput(initial.endsAt), registrationDeadline: dateInput(initial.registrationDeadline) });
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal event-modal" role="dialog" aria-modal="true" aria-label="Event editor"><button className="modal-close" onClick={close}><X size={20}/></button><div className="overline">ORGANIZER STUDIO</div><h2>{initial._id ? 'Edit your event' : 'Create an event'}</h2><p>Give students every reason to show up.</p><form onSubmit={e => { e.preventDefault(); save(form); }}><div className="form-grid"><label className="span-2">Event title<input value={form.title} onChange={e => set('title', e.target.value)} required maxLength={120} placeholder="e.g. Build Night: AI for Good"/></label><label>Category<select value={form.category} onChange={e => set('category', e.target.value)}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}</select></label><label>Capacity<input type="number" min="1" max="10000" value={form.capacity} onChange={e => set('capacity', e.target.value)} required/></label><label className="span-2">Location<input value={form.location} onChange={e => set('location', e.target.value)} required maxLength={120} placeholder="e.g. Innovation Lab, Block C"/></label><label>Starts<input type="datetime-local" value={form.startsAt} onChange={e => set('startsAt', e.target.value)} required/></label><label>Ends<input type="datetime-local" value={form.endsAt} onChange={e => set('endsAt', e.target.value)} required/></label><label>Registration closes<input type="datetime-local" value={form.registrationDeadline} onChange={e => set('registrationDeadline', e.target.value)} required/></label><label>Status<select value={form.status} onChange={e => set('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option>{initial._id && <option value="cancelled">Cancelled</option>}</select></label><label className="span-2">Image URL (optional)<input type="url" value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://example.com/photo.jpg"/></label><label className="span-2">Description<textarea value={form.description} onChange={e => set('description', e.target.value)} required maxLength={4000} rows="5" placeholder="What will happen? Who is this for?"/></label></div><div className="form-actions"><button type="button" className="btn btn-outline" onClick={close}>Cancel</button><button className="btn btn-dark" disabled={busy}>{busy ? 'Saving...' : 'Save event'} <ArrowRight size={17}/></button></div></form></div></div>;
}
function Empty({ title, text, action, actionText = 'Explore events' }) { return <div className="empty"><span className="empty-symbol">✳</span><h3>{title}</h3><p>{text}</p><button className="btn btn-dark" onClick={action}>{actionText} <ArrowRight size={17}/></button></div>; }

createRoot(document.getElementById('root')).render(<App/>);
