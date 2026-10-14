# Scheduly — AI Timetable Generator (frontend demo)

React + Vite. Data is stored in the browser (localStorage). The assistant is a rule-based demo, and
collision detection is **not implemented** (see `src/utils/timetableValidation.js`).

## Run (Windows PowerShell or Command Prompt)

    cd path\to\scheduly
    npm install
    npm run dev

Open the URL Vite prints (usually http://localhost:5173). To check a production build: `npm run build`.

## Sign in / accounts

`src/AuthGate.jsx` shows the sign-in / create-account page (`src/components/AuthPage.jsx`) before the app.
Accounts are **browser-only demo accounts** (`src/utils/auth.js`): stored in localStorage, passwords salted + hashed
with PBKDF2, each account has its own timetables. There is no server, so no password recovery and no protection
against someone with access to the browser profile. Replace `auth.js` with a real backend before shipping.
