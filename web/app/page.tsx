"use client";

import FileUploader from "@/components/FileUploader";
import { useEffect, useState } from "react";

export default function Home() {
  const [db, setDb] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const wasm = await import("../pkg/local_mind_core");
        await wasm.default();

        const database = new wasm.VectorDatabase();
        setDb(database);

        console.log("Loading model...");

        // Fetch model files
        const [weights, tokenizer, config] = await Promise.all([
          fetch(
            "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.safetensors"
          ).then((r) => r.arrayBuffer()),
          fetch(
            "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json"
          ).then((r) => r.arrayBuffer()),
          fetch(
            "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json"
          ).then((r) => r.arrayBuffer()),
        ]);

        database.load_model(
          new Uint8Array(weights),
          new Uint8Array(tokenizer),
          new Uint8Array(config)
        );

        console.log("Model loaded!");
        setReady(true);
      } catch (e) {
        console.error("Failed to init WASM or load model:", e);
      }
    })();
  }, []);

  const handleSearch = async () => {
    if (!db || !query) return;
    setSearching(true);
    try {
      // Small delay to let UI update
      await new Promise((r) => setTimeout(r, 10));
      const res = db.search(query, 5);
      setResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">Local Mind 🧠</h1>

      {!ready && (
        <p className="text-yellow-400 mb-4">
          Loading AI Model (approx 90MB)...
        </p>
      )}

      <FileUploader db={ready ? db : null} />

      <div className="w-full max-w-2xl mt-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask something about your documents..."
            className="flex-1 p-2 rounded bg-gray-800 border border-gray-700 text-white"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={!ready || searching}
            className="bg-blue-600 px-4 py-2 rounded disabled:opacity-50"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {results.map((r, i) => (
            <div
              key={i}
              className="p-4 bg-gray-800 rounded border border-gray-700"
            >
              <p className="text-sm text-gray-400 mb-1">
                Source: {r.doc_id} (Score: {r.score.toFixed(4)})
              </p>
              <p>{r.content}</p>
            </div>
          ))}
        </div>
      </div>

      {db && ready && (
        <div className="mt-8 p-4 bg-gray-800 rounded w-full max-w-2xl">
          <h2 className="text-xl mb-2">Debug View</h2>
          <p>Documentos (Chunks) en RAM de Rust: {db.get_count()}</p>
        </div>
      )}
    </main>
  );
}
