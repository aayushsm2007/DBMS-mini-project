# QuickBite — Food Delivery Management System

College DBMS project built with Node.js, Express, MySQL, HTML, CSS and JavaScript.

## Run locally

1. Install Node.js and MySQL.
2. In MySQL Workbench, run `database/schema.sql`, then `database/seed.sql`.
   **Warning:** `schema.sql` begins with `DROP DATABASE IF EXISTS QuickBite;`, which deletes the existing QuickBite database before recreating it. Back up existing data before running it again.
3. Copy `.env.example` to `.env` and enter your local MySQL connection values.
4. Open a terminal in this project folder and run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`. Admin page: `http://localhost:3000/admin.html`.

## Folder layout

- `server.js`, `db.js`: Express server and MySQL connection
- `public/index.html`: customer website
- `public/reset-password.html`: demo password-reset page
- `public/admin.html`: admin page
- `public/css/style.css`: styles
- `public/js/app.js`, `public/js/admin.js`: browser JavaScript
- `database/schema.sql`, `database/seed.sql`: database setup

## Password reset note

For this college demo, the reset form accepts the registered email and a new password, hashes the new password with bcrypt, and updates `Customer.password` in MySQL. It does **not** verify ownership of the email address or send a reset link. Use only with demo accounts/local testing, not a real public website.
