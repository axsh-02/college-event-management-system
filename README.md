# CampusLoop — College Event Management System

A full-stack college events application built with **React + Vite**, **Node.js + Express**, and **MongoDB + Mongoose**. Students discover and join events. Organizers publish events, communicate with participants, and track attendance.

## Features

| # | Feature | What to demonstrate |
|---|---|---|
| 1 | Event publishing and management | Organizer creates a draft, publishes it, edits it, or cancels it. |
| 2 | Event discovery and details | Search, filter by category, inspect schedule, location, capacity, announcements, and reviews. |
| 3 | Participant registration | Student reserves a seat and sees it under My events; organizer sees the participant list. |
| 4 | Attendance | Organizer marks participants present or shares an event code for student self check-in during the event. |
| 5 | Automatic waitlist | Full events accept waitlist entries; cancelling a confirmed seat promotes the earliest waitlisted student. |
| 6 | Announcements | Organizer posts event updates displayed on the event detail page. |
| 7 | Favorites | Students save and unsave events in a personal shortlist. |
| 8 | Feedback and ratings | Checked-in students leave or update a 1–5 star review after an event begins. |
| 9 | Organizer analytics | Dashboard shows event, registration, attendance, waitlist, and review totals. |
| 10 | Accounts and roles | Students can sign up; organizer accounts can manage only their own events. |


open vs terminal and run these commands one by one:

>Copy-Item server\.env.example server\.env
>Copy-Item client\.env.example client\.env
>notepad server\.env
(In Notepad, replace replace-with-a-long-random-secret with a long string of your own, then save and close it.)
>Get-Service MongoDB
>npm install
>npm run install:all
>npm run seed
>npm run dev
click on this link:- Local:   http://localhost:5173/

To log in as the organizer, use organizer@campusloop.edu with password Demo@12345

