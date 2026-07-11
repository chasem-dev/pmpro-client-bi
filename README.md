# PMPro Client BI — P6 Update Tool

Next.js app for field users to view and update Primavera P6 activities assigned via the **Owner Email** UDF.

## Features

- **My Work** — Activities owned by your Clerk email, grouped by project
- **Time slicer** — Filter by days from today or a date range (planned start/finish)
- **Read-only planning** — Project, activity ID/name, planned dates, floats, budgeted units/costs
- **Editable actuals** — % complete, actual/expected dates, activity steps, comments
- **Resource & material** — Labor/non-labor/material subsections with assignment-level updates
- **Timesheet** — Daily labor hours stored in MongoDB; totals sync to P6
- **Non-labor** — Daily tracking or running totals; syncs to P6
- **Admin** — Project/activity CRUD, field policies, company (EPS) access

## Setup

1. Copy `.env.example` to `.env.local` and fill in Clerk, P6, and MongoDB values.
2. Install dependencies:

```bash
npm install
```

3. Run the dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000). Sign in with Clerk; activities appear when your email matches the P6 Owner Email UDF on Production projects.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Database name (default: `pmpro_client_bi`) |
| `P6_BASE_URL` | P6 EPPM REST base URL |
| `P6_DATABASE_NAME` | P6 database name |
| `P6_AUTHTOKEN` | P6 REST auth token |
| `P6_OWNER_EMAIL_UDF_TITLE` | UDF title for owner email (default: `Owner Email`) |
| `P6_PROD_EPS_ID` | Production EPS id (default: `PROD`) |

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Deploy

Deploy on Vercel or any Node host. Ensure `MONGODB_URI` and P6 credentials are set in production environment variables.
