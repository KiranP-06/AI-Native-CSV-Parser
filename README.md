# AI-Native CSV Parser — Transaction Data Validation & Processing Platform

A split-architecture platform for validating transaction CSV data using AI. The React frontend uploads files to a Node.js/Express backend, which uses **OpenRouter AI (Gemini Flash)** to clean and validate the data, then returns chunked ZIP outputs for download.

## 🚀 Live Deployment

| | URL |
|---|---|
| **Frontend** | https://ai-native-csv-parser-4wv17y1uk-kiranp-06s-projects.vercel.app/ |
| **Backend** | https://ai-native-csv-parser.onrender.com/ |
| **GitHub** | https://github.com/KiranP-06/AI-Native-CSV-Parser |

## Architecture

```
┌────────────────────┐         ┌──────────────────────────────┐
│   React Frontend   │  HTTP   │   Node.js Backend            │
│   (Vite · Vercel)  │ ──────► │   (Express · Render)         │
│                    │         │                              │
│  • Upload CSV      │         │  • Parse CSV rows            │
│  • Configure rules │         │  • Send to OpenRouter AI     │
│  • Poll job status │         │  • AI cleans & validates     │
│  • Download ZIP    │         │  • Return chunked ZIP output │
└────────────────────┘         └──────────────────────────────┘
```

## AI Validation Rules

The AI is instructed to apply the following checks on each batch of rows:

| Check | Logic |
|---|---|
| **Phone** | Digit count must match the country-specific rule (e.g. SG=8, IN=10). |
| **Date** | Must be a valid calendar date. The AI normalises to `YYYY-MM-DD`. |
| **Null Fields** | Rows missing `order_id`, `phone`, or `date` are dropped. |
| **Unknown Country** | Rows with a country code not in the configured rules are dropped. |

## Local Development

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your OPENROUTER_API_KEY
npm run dev            # starts on port 4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

The frontend reads the backend URL from `VITE_API_URL` (defaults to `http://localhost:4000`).

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repo and set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Add environment variables:
   - `OPENROUTER_API_KEY` = your OpenRouter key
4. Deploy.

### Frontend → Vercel

1. Create a new project on [Vercel](https://vercel.com).
2. Connect your repo and set:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add environment variable:
   - `VITE_API_URL` = `https://ai-native-csv-parser.onrender.com`
4. Deploy.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/validate` | Upload CSV + rules → starts AI job, returns `jobId` |
| `GET` | `/api/job/:jobId` | Poll job status (`processing` or `completed`) |
| `GET` | `/api/download/:jobId` | Download ZIP with cleaned CSV chunks |

## File Structure

```
/backend
  index.js           ← Express app, AI pipeline, all routes
  .env.example       ← template: copy to .env and fill keys
  package.json

/frontend
  src/
    App.jsx          ← entire UI with polling and download logic
    index.css        ← base styles
    main.jsx         ← React entry point
  vite.config.js
  package.json

README.md
```

## Sample CSV Format

```csv
order_id,product_name,payment_mode,phone,country_code,date,amount
ORD001,Widget A,Credit Card,98765432,SG,2024-03-15,250.00
ORD002,Gadget B,UPI,9876543210,IN,15/03/2024,1500.00
ORD003,Widget C,Cash,invalid,XX,bad-date,-50
```