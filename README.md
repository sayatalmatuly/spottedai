# Spotted AI — Electronic Attendance Journal

An intelligent attendance tracking system built for **S. Tolybekov Information Technology School-Lyceum No. 3**. Designed for teachers and school administrators to record daily student attendance, monitor trends, and gain AI-powered insights — all from a modern, mobile-friendly web dashboard.

## Features

- **Daily attendance marking** — per-class student rosters with present / late / absent statuses and absence-reason tracking
- **Real-time dashboard** — ring charts, weekly trend graphs, per-class bar charts, and donut breakdowns
- **AI analytics** — one-click weekly summaries powered by Groq (LLaMA) highlighting trends and students who need attention
- **Role-based access** — teachers see their assigned classes; administrators manage users, classes, and schedules
- **Trilingual interface** — Kazakh 🇰🇿, Russian 🇷🇺, and English 🇬🇧, switchable on the fly
- **Past-date review & correction** — open any previous day to view or edit attendance records
- **Excel export** — download detailed attendance data for any class and time period

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js](https://nextjs.org) (App Router, Server Actions) |
| Database & Auth | [Supabase](https://supabase.com) (PostgreSQL, Row-Level Security, Auth) |
| Language | TypeScript |
| Styling | Vanilla CSS (custom design system) |
| AI | Groq API (LLaMA 3) |
| Hosting | Vercel |

## Getting Started

See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for database provisioning and environment variable setup.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

This project is proprietary software developed for educational demonstration purposes.
