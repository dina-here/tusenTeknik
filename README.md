# TusenTeknik Demo Platform

Demo-länkar:
- PowerAdmin: https://tusenteknik-admin-ui.onrender.com
- PowerRegister: https://tusenteknik-powerwatch-ui.onrender.com

En fullstack-demo som simulerar ett modernt backend-system för hantering av batteribackuper, fält-rapportering (PowerRegister), dimensionering och realtidsdata.

Projektet är byggt för att demonstrera:

- Idempotent event processing
- Offline-first mobilflöde
- Asynkron validering med worker
- Produkt- och livslängdslogik
- Enkel "ML-liknande" health scoring
- B2B partner-integration via API-key
- Modern monorepo-arkitektur

---

# 🏗 Arkitektur

Monorepo (pnpm workspaces):

apps/
api/ -> NestJS REST API
worker/ -> Async processor (staging → main DB)
admin-ui/ -> PowerAdmin (React)
powerwatch-ui/ -> PowerRegister, offline-first PWA (simulerar Android-app)

packages/
shared/ -> Delade Zod-scheman

prisma/
schema + seed


Teknikstack:

- NestJS (TypeScript)
- PostgreSQL (via Prisma ORM)
- React + Vite + Tailwind
- pnpm workspaces
- Docker (Postgres)
- Zod (shared validation layer)

---

# 🔁 Eventflöde (PowerRegister)

1. Fälttekniker rapporterar via PowerRegister (offline möjligt)
2. Events lagras lokalt
3. Batch skickas till API
4. API sparar i `IngressEvent` (UNIQUE eventId → idempotens)
5. Worker processar asynkront
6. Validering + device-matchning
7. Rekommendation skapas (service/replace/inspect)

Tre arkitekturprinciper:

- Idempotens → UNIQUE(eventId)
- Async processing → staging-tabell + worker
- Batch support → offline sync

---

# 📡 Realtidsdata & Health Scoring

Enheter kan skicka telemetri:

- Spänning
- Temperatur
- Felkoder

Systemet:

- Sparar rådata (append-only)
- Skapar health snapshot
- Beräknar score (0–100)
- Genererar risknivå: OK / WARN / CRITICAL

Nuvarande implementation är en enkel heuristik.
Designen är förberedd för framtida ML-modell:

1. Feature engineering
2. Labeling (battery replacement, incidents)
3. Modellträning (t.ex. logistisk regression)
4. Versionerad inference-tjänst

---

# 📐 Dimensioneringsverktyg

Endpoint: `/api/sizing`

Input:
{
"load": 120,
"backupHours": 24,
"temperature": 20
}

Returnerar:
- Rekommenderad modell
- Batterikapacitet
- Säkerhetsmarginal
- Algorithm version

Resultat sparas för framtida uppföljning och modellutvärdering.

---

# 🔌 Partner Integration (B2B)

Partners autentiseras via `x-api-key`.

Exempel:
GET /api/partners/devices/:serial/status

Returnerar:
- Status
- Health score
- Timestamp

Designen är byggd för att kunna ersättas med OAuth2 + scopes.

---

# 🚀 Starta lokalt

## 1. Starta Postgres
docker compose up -d

## 2. Installera dependencies
pnpm install

## 3. Prisma
pnpm prisma:migrate
pnpm prisma:seed

## 4. Starta alla tjänster
pnpm dev

## 5. Lokala env-filer
- Root: .env.local (för app-URLer)
- Prisma: prisma/.env.local (DATABASE_URL)

Tips: skapa även .env.example och prisma/.env.example för dokumentation.

---

# 🚀 Deploy på Render

## 1. Skapa services (monorepo)
Använd samma GitHub-repo för alla services. Sätt Root Directory per service.

### API (Web Service)
- Root Directory: (tomt)
- Build Command: pnpm install && pnpm --filter ./prisma prisma:generate && pnpm --filter ./prisma prisma migrate deploy && pnpm --filter ./prisma prisma db seed && pnpm build
- Start Command: node apps/api/dist/main.js
- Environment:
	- DATABASE_URL

### Worker (Background Worker)
- Root Directory: (tomt)
- Build Command: pnpm install && pnpm --filter ./prisma prisma:generate && pnpm --filter ./apps/worker build
- Start Command: node apps/worker/dist/index.js
- Environment:
	- DATABASE_URL

### Admin UI (Static Site)
- Root Directory: (tomt)
- Build Command: pnpm install && pnpm --filter ./apps/admin-ui build
- Publish Directory: apps/admin-ui/dist
- Environment:
	- VITE_API_BASE = https://<din-api>.onrender.com

### PowerWatch UI (Static Site)
- Root Directory: (tomt)
- Build Command: pnpm install && pnpm --filter ./apps/powerwatch-ui build
- Publish Directory: apps/powerwatch-ui/dist
- Environment:
	- VITE_API_BASE = https://<din-api>.onrender.com

Obs: Prisma v7 använder `prisma/prisma.config.ts` för datasource-konfiguration. `DIRECT_URL` används inte längre i detta projekt.

## 2. Viktigt om API_BASE
PowerWatch UI och Admin UI behöver VITE_API_BASE satt i Render. Annars pekar de mot localhost och synk fungerar inte.


---

# 🔍 URLs

API:
http://localhost:3000/health

Admin UI:
http://localhost:5173

PowerRegister UI:
http://localhost:5174

---

# 🎯 Designmål

Detta är inte en produktionslösning, utan en arkitekturell demo med fokus på:

- Skalbarhet
- Tydlig ansvarsfördelning
- Ren kodstruktur
- Separering av concern
- Framtida ML-stöd
- B2B-integration

---

# 📌 Framtida förbättringar

- Redis + riktig job queue (BullMQ)
- Event-driven arkitektur
- Grafisk device detail view
- OAuth2 istället för API key
- Observability (OpenTelemetry)
- Time-series DB för telemetri
- Riktig ML-modell för batterislitage

---

# 👤 Author

Byggt som arkitekturell demo för TusenTeknik.
