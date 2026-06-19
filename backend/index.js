require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { parse } = require("csv-parse");
const { stringify } = require("csv-stringify/sync");
const archiver = require("archiver");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Helper to chunk arrays
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Call OpenRouter
async function processChunkWithAI(csvChunkString, rulesString) {
  const prompt = `You are a strict data validation engine. I am providing you with a chunk of a CSV file.
Rules:
1. Phone numbers must contain exactly the number of digits specified in this JSON for the given country_code: ${rulesString}. If a country is not in the rules, it's invalid.
2. Dates must be valid calendar dates. Fix the formatting to YYYY-MM-DD if possible.
3. Required fields (order_id, phone, date) must not be empty.

Task:
Drop any rows that violate the rules. If a row can be fixed (e.g. date format), fix it.
Return ONLY the cleaned, valid CSV rows. DO NOT return invalid rows. 
DO NOT include markdown blocks like \`\`\`csv. JUST return the raw CSV text including the header row.

Here is the CSV data:
${csvChunkString}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash", // using the fast flash model
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    let content = data.choices[0].message.content.trim();
    // Clean up potential markdown formatting if the AI disobeys
    if (content.startsWith("```csv")) content = content.replace(/^```csv\n/, "");
    if (content.endsWith("```")) content = content.replace(/\n```$/, "");
    
    return content;
  } catch (err) {
    console.error("AI API Error:", err);
    return null;
  }
}

const jobStore = {}; // In-memory store

// ---------------------------------------------------------------------------
// GET /api/load-test-file - Serve test data
// ---------------------------------------------------------------------------
app.get("/api/load-test-file", (req, res) => {
  res.sendFile("/Users/kiran/AI-Native-CSV-Parser/test_transactions.csv");
});

// ---------------------------------------------------------------------------
// POST /api/validate - Process CSV with AI
// ---------------------------------------------------------------------------
app.post("/api/validate", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  const rulesString = req.body.rules || "{}";
  const userRequestedChunkSize = parseInt(req.body.chunkSize) || 1000;

  const csvText = req.file.buffer.toString("utf-8");
  
  parse(csvText, { columns: true, skip_empty_lines: true, trim: true }, async (err, records) => {
    if (err) return res.status(400).json({ error: `CSV parse error: ${err.message}` });

    // Send early response so the frontend doesn't timeout during long AI processing
    const jobId = Date.now().toString();
    jobStore[jobId] = { status: "processing", validRecords: [], chunkSize: userRequestedChunkSize, total: records.length };
    
    res.json({ jobId, message: "AI Processing started", total: records.length });

    // --- Background AI Processing ---
    // We chunk into batches of 20 to prevent context explosion
    const aiBatches = chunkArray(records, 20);
    const allValidRecords = [];

    for (const batch of aiBatches) {
      const batchCsv = stringify(batch, { header: true });
      const cleanCsvString = await processChunkWithAI(batchCsv, rulesString);
      
      if (cleanCsvString) {
        // Parse the AI's returned CSV back into objects
        try {
          // Wrap in promise to handle callback
          const parsedClean = await new Promise((resolve, reject) => {
            parse(cleanCsvString, { columns: true, skip_empty_lines: true, trim: true }, (e, r) => {
              if (e) reject(e);
              else resolve(r);
            });
          });
          allValidRecords.push(...parsedClean);
        } catch (parseErr) {
          console.error("Failed to parse AI output:", parseErr);
        }
      }
    }

    // Processing complete
    jobStore[jobId].status = "completed";
    jobStore[jobId].validRecords = allValidRecords;
    jobStore[jobId].validCount = allValidRecords.length;
  });
});

// ---------------------------------------------------------------------------
// GET /api/job/:jobId - Poll status
// ---------------------------------------------------------------------------
app.get("/api/job/:jobId", (req, res) => {
  const job = jobStore[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job);
});

// ---------------------------------------------------------------------------
// GET /api/download/:jobId - Download the ZIP
// ---------------------------------------------------------------------------
app.get("/api/download/:jobId", (req, res) => {
  const job = jobStore[req.params.jobId];
  if (!job || job.status !== "completed") {
    return res.status(404).json({ error: "Job not completed or found." });
  }

  const { validRecords, chunkSize } = job;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="ai_cleaned_data_${req.params.jobId}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => { res.status(500).send({ error: err.message }); });
  archive.pipe(res);

  if (validRecords.length > 0) {
    for (let i = 0; i < validRecords.length; i += chunkSize) {
      const chunk = validRecords.slice(i, i + chunkSize);
      const chunkCsv = stringify(chunk, { header: true });
      const partNum = Math.floor(i / chunkSize) + 1;
      archive.append(chunkCsv, { name: `valid_chunks/valid_records_part_${partNum}.csv` });
    }
    
    const fullValidCsv = stringify(validRecords, { header: true });
    archive.append(fullValidCsv, { name: "valid_records_full.csv" });
  } else {
    archive.append("No valid records found.", { name: "empty.txt" });
  }

  archive.finalize();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AI Backend running on port ${PORT}`);
});
