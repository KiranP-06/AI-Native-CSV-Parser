import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Settings, FileCheck, XCircle, Bot } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [file, setFile] = useState(null);
  const [rules, setRules] = useState([{ code: "SG", digits: 8 }, { code: "IN", digits: 10 }]);
  const [chunkSize, setChunkSize] = useState(500);
  
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const addRule = () => setRules([...rules, { code: "", digits: "" }]);
  const updateRule = (index, field, value) => {
    const newRules = [...rules];
    newRules[index][field] = value;
    setRules(newRules);
  };
  const removeRule = (index) => setRules(rules.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setPolling(false);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    
    const ruleMap = rules.reduce((acc, r) => {
      if (r.code && r.digits) acc[r.code.toUpperCase()] = parseInt(r.digits);
      return acc;
    }, {});
    
    formData.append("rules", JSON.stringify(ruleMap));
    formData.append("chunkSize", chunkSize);

    try {
      const res = await fetch(`${API}/api/validate`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      
      setResult({ ...data, status: "processing" });
      setPolling(true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval;
    if (polling && result?.jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/job/${result.jobId}`);
          const data = await res.json();
          if (res.ok && data.status === "completed") {
            setResult({ jobId: result.jobId, ...data });
            setPolling(false);
            setLoading(false);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [polling, result?.jobId]);

  const handleDownload = () => {
    if (result?.jobId) {
      window.location.href = `${API}/api/download/${result.jobId}`;
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto font-sans">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
          <FileCheck className="w-8 h-8 text-blue-600" />
          AI Transaction Validator
        </h1>
        <p className="text-slate-500 mt-2">Validate phone numbers, dates, and chunk large datasets using OpenRouter AI.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Col: Config */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-500" />
              Configuration
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Chunk Size (Rows per file)</label>
              <input 
                type="number" 
                value={chunkSize} 
                onChange={(e) => setChunkSize(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Country Phone Rules</label>
              <div className="space-y-2 mb-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      placeholder="Code (e.g. US)" 
                      value={rule.code} 
                      onChange={(e) => updateRule(i, 'code', e.target.value)}
                      className="w-1/2 px-2 py-1 border rounded text-sm uppercase"
                    />
                    <input 
                      type="number" 
                      placeholder="Digits" 
                      value={rule.digits} 
                      onChange={(e) => updateRule(i, 'digits', e.target.value)}
                      className="w-1/2 px-2 py-1 border rounded text-sm"
                    />
                    <button onClick={() => removeRule(i)} className="text-red-500 hover:text-red-700">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={addRule}
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                + Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Upload & Results */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={loading || polling}
            />
            
            {file ? (
              <div className="mb-6">
                <div className="p-4 bg-blue-50 text-blue-800 rounded-lg inline-block font-medium">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </div>
                {!loading && !polling && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); fileInputRef.current.value = ""; }}
                    className="block mx-auto mt-2 text-sm text-slate-500 hover:text-slate-700 z-20 relative"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:bg-slate-50 transition-colors mb-6">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">Click or drag CSV here</h3>
              </div>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); handleUpload(); }}
              disabled={!file || loading || polling}
              className="relative z-20 w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || polling ? "AI Processing started..." : "Start AI Validation"}
            </button>
            
            {error && <p className="text-red-600 mt-4 font-medium relative z-20">{error}</p>}
          </div>

          {/* Results Dashboard */}
          {result && result.status === "processing" && (
            <div className="bg-white p-10 rounded-xl shadow-sm border border-blue-200 flex flex-col items-center justify-center animate-pulse">
              <Bot className="w-12 h-12 text-blue-500 mb-4 animate-bounce" />
              <h3 className="text-lg font-semibold text-blue-900">AI is cleaning your dataset...</h3>
              <p className="text-slate-500 text-sm mt-2">This may take a moment depending on the file size.</p>
            </div>
          )}

          {result && result.status === "completed" && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
              <h3 className="font-semibold text-xl mb-6">Validation Results</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-lg border text-center">
                  <div className="text-3xl font-bold text-slate-800">{result.total}</div>
                  <div className="text-sm text-slate-500 font-medium uppercase tracking-wide">Total Rows Parsed</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{result.validCount}</div>
                  <div className="text-sm text-emerald-700 font-medium uppercase tracking-wide">AI Verified Rows</div>
                </div>
              </div>

              <div className="p-6 bg-slate-800 text-white rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg">Download Cleaned Output</h4>
                  <p className="text-slate-400 text-sm mt-1">
                    Contains `valid_records_full.csv` and a folder of parts split into {chunkSize} row chunks.
                  </p>
                </div>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-slate-100 transition-colors shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Download ZIP
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
