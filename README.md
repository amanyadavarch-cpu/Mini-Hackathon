# Fraud Radar

Fraud Radar is a fictional-data fraud monitoring and investigation demo. It pairs a React dashboard with an authenticated Express API and MongoDB persistence. It is a hackathon/demo application, not a real fraud detection service.

## Features

- Dashboard KPIs, transaction activity, risk distribution, alerts, and investigation summaries
- Searchable, filterable transaction and alert lists
- Transaction risk evaluation, investigations, notes, and status updates
- Editable fraud scoring rules and analytics
- JWT-based analyst/admin sign-in
- Responsive Glacier-inspired UI with subtle GSAP animations

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Recharts, GSAP
- Backend: Express, TypeScript, Mongoose, MongoDB, JWT
- Tests: Vitest and MongoDB Memory Server

## Requirements

- Node.js 20 or later
- npm
- MongoDB Atlas or MongoDB Community Server
- MongoDB Compass is optional; it can inspect the same database as the backend

## Configure

Run these commands from the repository root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `backend\.env` locally:

- Set `MONGODB_URI` to your MongoDB URI and database name. Database names are case-sensitive; if the database already exists, use its exact spelling. URL-encode special characters in the URI username or password.
- Set `JWT_SECRET` to a long, private random value.
- Set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` to the sign-in credentials you want for this local demo.
- Set `FRONTEND_ORIGIN` to the frontend origin, for example `http://127.0.0.1:5181`.

The frontend example config uses `http://localhost:5000/api/v1`. Change `VITE_API_BASE_URL` in `frontend\.env` only if your API uses a different address.

Never commit `.env` files or share MongoDB credentials. The `.env` files are ignored by Git. If a credential has been exposed, rotate it before using the database.

## Run the application

In terminal 1, seed the database and start the API:

```powershell
Set-Location backend
npm install
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`. Check its status at:

- Health: `http://localhost:5000/api/v1/health`
- Database readiness: `http://localhost:5000/api/v1/ready`

In terminal 2, start the frontend:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

Open `http://127.0.0.1:5181` and sign in with the email and password configured in `backend\.env`. The seed command creates or updates that admin account and inserts fictional sample transactions, rules, alerts, and investigations.

## Verify

Run these commands from each project folder:

```powershell
npm run build
npm test
```

The backend integration test uses a temporary MongoDB instance to verify the transaction-to-alert-to-investigation workflow. It does not modify or validate your Atlas database.

## API overview

All API paths are under `/api/v1`. Health, readiness, and login are public; application data endpoints require a bearer token.

- Authentication: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. Anyone can create an analyst account from the sign-in page; registration is rate limited and cannot create admin accounts.
- Transactions: `GET/POST /transactions`, `GET /transactions/:id`, status and risk evaluation endpoints
- Alerts: `GET /alerts`, `PATCH /alerts/:id/status`
- Investigations: list and transaction-scoped investigation/note endpoints
- Rules: `GET /rules`, `PATCH /rules/:id`
- Analytics: overview, risk distribution, and activity endpoints

See [backend/README.md](./backend/README.md) for the full route list and backend setup details.

## Deploy to Vercel

Deploy the frontend and backend as **two Vercel projects** from this GitHub repository:

1. Import the repository into Vercel twice.
2. For the frontend project, set the root directory to `frontend`. Use `npm install` as the install command, `npm run build` as the build command, and `dist` as the output directory. The included `frontend/vercel.json` rewrites client-side routes to the Vite entry point.
3. For the backend project, set the root directory to `backend`. Vercel detects the catch-all Node function in `api/` and serves the Express API through it.
4. Configure these backend environment variables in Vercel for Production (and Preview if needed): `MONGODB_URI`, `JWT_SECRET`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, and `FRONTEND_ORIGIN`. Set `FRONTEND_ORIGIN` to the deployed frontend origin, without a trailing slash.
5. Configure the frontend build environment variable `VITE_API_BASE_URL` as `https://<backend-project>.vercel.app/api/v1`, then redeploy the frontend.
6. After rotating any credentials previously exposed, seed the production database once from the local `backend` directory using the same private environment values:

   ```powershell
   Set-Location backend
   npm run seed
   ```

The backend health and readiness checks are available at `https://<backend-project>.vercel.app/api/v1/health` and `/api/v1/ready`. The database name in `MONGODB_URI` must match the existing Atlas database spelling exactly. Never add production secrets to GitHub or commit `.env` files.

Vercel deployment requires access to a Vercel account. Importing the GitHub repository in Vercel will create deployments on subsequent pushes.
