# Fraud Radar Backend

Express, TypeScript, MongoDB, and Mongoose API for the Fraud Radar frontend.

## Requirements

- Node.js 20+
- MongoDB Community Server or MongoDB Atlas
- MongoDB Compass is optional and can inspect the same database as the API

## Configure and run

From the repository root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `backend\.env` locally:

- Set `MONGODB_URI` to the rotated MongoDB URI, including `/fraud_radar` as its database path.
- Set a private, long `JWT_SECRET`.
- Set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`.
- Keep `FRONTEND_ORIGIN` aligned with the frontend dev-server origin.

Do not commit `.env` files or share database credentials in chat. MongoDB Compass can connect with the same URI and browse database `fraud_radar`; Mongoose creates the collections from the models.

Install and start the API in one terminal:

```powershell
Set-Location backend
npm install
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`; its health endpoint is `http://localhost:5000/api/v1/health`.

Start the frontend in another terminal:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

Open `http://127.0.0.1:5181`. Sign in with the demo admin credentials configured in `backend\.env`.

## API endpoints

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `GET /api/v1/transactions`, `GET /api/v1/transactions/:id`
- `POST /api/v1/transactions`, `POST /api/v1/transactions/:id/evaluate`
- `PATCH /api/v1/transactions/:id/status`, `GET /api/v1/transactions/:id/history`
- `GET /api/v1/alerts`, `PATCH /api/v1/alerts/:id/status`
- `GET /api/v1/investigations`, `GET /api/v1/investigations/transaction/:transactionId`
- `POST /api/v1/investigations/transaction/:transactionId/notes`
- `GET /api/v1/rules`, `PATCH /api/v1/rules/:id`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/risk-distribution`
- `GET /api/v1/analytics/activity?range=24h|7d|30d`

Registration and login are public. Self-registered accounts receive the analyst role; registration is rate limited. All other application endpoints except health/readiness require a bearer JWT. Risk scoring is deterministic and rule-based; this demo contains fictional transaction data and is not a real fraud-detection service.

## Verification

From each project directory:

```powershell
npm run build
npm test
```

Backend tests use `mongodb-memory-server` and exercise persisted transaction scoring, alert creation, investigation notes/status changes, and analytics without requiring Atlas credentials. To run the app against your Atlas database, configure the local backend `.env` first.
