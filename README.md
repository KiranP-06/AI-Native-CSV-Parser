# CSV Validator — Transaction Data Validation & Processing Platform

A split-architecture platform for validating transaction CSV data. The React frontend uploads files to a Node.js/Express backend, which handles all parsing, validation, and file generation.

## Architecture

```
┌────────────────────┐         ┌────────────────────────┐
│   React Frontend   │  HTTP   │   Node.js Backend      │
│   (Vite · Vercel)  │ ──────► │   (Express · Render)   │
│                    │         │                        │
│  • Upload CSV      │         │  • Parse & validate    │
│  • Display results │         │  • Return JSON results │
│  • Trigger downloads│        │  • Generate CSV / ZIP  │
└────────────────────┘         └────────────────────────┘
```

## Validation Rules

| Check | Logic |
|---|---|
| **Phone** | Strip non-digits → compare digit count to country rules. Unknown country = flag. |
| **Date** | Accept `dd/mm/yyyy`, `yyyy-mm-dd`, `mm-dd-yyyy`. Anything else = flag. |
| **Null Fields** | Flag rows missing `order_id`, `phone`, or `date`. |
| **Duplicate Order ID** | Flag rows where `order_id` appears more than once. |
| **Amount** | Must be a positive number. |

## Local Development

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on port **4000** by default (set `PORT` env var to override).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173** and expects the backend at `http://localhost:4000` (configured in `.env`).

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repo, set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Render auto-sets the `PORT` env var.
4. The `/health` endpoint returns `{ "status": "ok" }` — useful for uptime monitors to prevent free-tier spin-down.

### Frontend → Vercel

1. Create a new project on [Vercel](https://vercel.com).
2. Connect your repo, set:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add environment variable:
   - `VITE_API_URL` = `https://your-backend-name.onrender.com`
4. Deploy.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (returns `{ status: "ok" }`) |
| `POST` | `/api/validate` | Upload CSV + rules → returns validation results |
| `POST` | `/api/download/cleaned` | Returns cleaned CSV (or ZIP if chunked) |
| `POST` | `/api/download/full` | Returns full CSV with `error_reason` column |

## File Structure

```
/backend
  index.js           ← Express app, all routes
  package.json

/frontend
  src/
    App.jsx           ← entire UI
    index.css         ← dark theme styles
    main.jsx          ← React entry point
  .env                ← local backend URL
  .env.example        ← template for production
  index.html
  vite.config.js
  package.json

README.md             ← this file
```

## Sample CSV Format

```csv
order_id,phone,date,country_code,amount
ORD001,+91-9876543210,15/03/2024,IN,1500.00
ORD002,+65-81234567,2024-03-15,SG,250.00
ORD003,invalid-phone,bad-date,XX,-50
```