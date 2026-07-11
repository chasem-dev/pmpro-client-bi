# Architecture

## Overview

PMPro Client BI is a Next.js application that gives field users a self-service **P6 Update Tool**. Signed-in users see activities assigned to them via the P6 **Owner Email** user-defined field (matched against their Clerk email), view read-only planning data, and update actuals, steps, comments, resource/material assignments, and daily timesheet/non-labor entries.

## Systems

| System | Role |
|--------|------|
| **Clerk** | Authentication; user email and org ID drive ownership and access policy |
| **Primavera P6 EPPM REST API** | Source of truth for projects, activities, EPS, resource assignments, steps, comments |
| **MongoDB** | App-owned data: daily timesheet/non-labor history, field visibility policies, company (EPS) access rules, audit trail |

## Data flow

```
User (Clerk) → Next.js API routes → P6 REST API (read/write schedule data)
                                 → MongoDB (timesheet, policies, audit)
```

On timesheet submit, daily hours are stored in MongoDB and summed totals are written to P6 `ResourceAssignment.ActualUnits` / `AtCompletionUnits`.

## EPS hierarchy

Only projects under **Production** (`P6_PROD_EPS_ID`, default `PROD`) are shown. Optional **company access** policies restrict users/orgs to specific 2nd-level EPS nodes (client companies).

## Key modules

- `lib/p6.ts` — P6 REST client (session, UDF lookup, activities, steps, comments, resource assignments)
- `lib/my-activities.ts` — Ownership filter, EPS isolation, time slicer, policy-aware response shaping
- `lib/db/` — MongoDB connection and collection accessors
- `lib/policy.ts` — Field and company access policies
- `app/api/my/activities` — Primary read endpoint for the My Work UI
- `app/page.tsx` — My Work UI grouped by project

## Environment

See `.env.example` for required variables. `MONGODB_URI` is required for timesheet, policies, and audit features.
