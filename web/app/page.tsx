"use client";

import { useState } from "react";
import FileUploader from "../components/FileUploader";
import ModelLoading from "../components/ModelLoading";
import SearchResults from "../components/SearchResults";
import UploadProgress from "../components/UploadProgress";
import { useWorker } from "../hooks/useWorker";

export default function Home() {
  const {
    ready,
    initProgress,
    searchResults,
    isSearching,
    uploads,
    search,
    addDocument,
  } = useWorker();

  const [query, setQuery] = useState("");

  const handleSearch = () => {
    search(query);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">
        Local Mind 🧠 (Worker Edition)
      </h1>

      <ModelLoading ready={ready} initProgress={initProgress} />

      <FileUploader onUpload={addDocument} ready={ready} />

      <UploadProgress uploads={uploads} />

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
            disabled={!ready || isSearching}
            className="bg-blue-600 px-4 py-2 rounded disabled:opacity-50"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </div>

        <SearchResults results={searchResults} />
      </div>
    </main>
  );
}
