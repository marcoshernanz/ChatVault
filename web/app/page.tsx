"use client";

import FileUploader from "@/components/FileUploader";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  doc_id: string;
  content: string;
  score: number;
}

export default function Home() {
  // We use a ref to store the worker instance so it persists across renders
  // without triggering re-renders itself.
  const workerRef = useRef<Worker | null>(null);

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    // Initialize the Web Worker
    // Web Workers allow us to run scripts in background threads.
    // This keeps the main thread (UI) responsive while performing heavy computations.
    workerRef.current = new Worker(new URL("./worker.ts", import.meta.url));

    // Set up the message handler to receive messages from the worker
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      console.log("Main: Received message", type);

      switch (type) {
        case "READY":
          setReady(true);
          break;
        case "SEARCH_RESULTS":
          setResults(payload);
          setSearching(false);
          break;
        case "DOCUMENT_ADDED":
          setDocCount(payload);
          alert(`Saved! Total chunks: ${payload}`);
          break;
        case "ERROR":
          console.error("Worker error:", payload);
          setSearching(false);
          alert("An error occurred in the worker. Check console.");
          break;
      }
    };

    // Send the initialization message to the worker
    workerRef.current.postMessage({ type: "INIT" });

    // Cleanup function to terminate the worker when the component unmounts
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleSearch = () => {
    if (!workerRef.current || !query) return;
    setSearching(true);
    // Send the search query to the worker
    workerRef.current.postMessage({
      type: "SEARCH",
      payload: { query },
    });
  };

  const handleUpload = (file: File, content: string) => {
    if (!workerRef.current) return;
    // Send the document content to the worker for processing
    workerRef.current.postMessage({
      type: "ADD_DOCUMENT",
      payload: { id: file.name, content },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">
        Local Mind 🧠 (Worker Edition)
      </h1>

      {!ready && (
        <p className="text-yellow-400 mb-4">
          Loading AI Model in Web Worker (approx 90MB)...
        </p>
      )}

      <FileUploader onUpload={handleUpload} ready={ready} />

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

      {ready && (
        <div className="mt-8 p-4 bg-gray-800 rounded w-full max-w-2xl">
          <h2 className="text-xl mb-2">Debug View</h2>
          <p>Documentos (Chunks) en RAM de Rust (Worker): {docCount}</p>
        </div>
      )}
    </main>
  );
}
