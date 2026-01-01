"use client";

import { useState, useEffect, useRef } from "react";
import FileUploader from "../components/FileUploader";
import ModelLoading from "../components/ModelLoading";
import SearchResults from "../components/SearchResults";
import UploadProgress from "../components/UploadProgress";
import ChatFilter from "../components/ChatFilter";
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
    documents,
  } = useWorker();

  const [query, setQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const knownDocsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newDocs = documents.filter((d) => !knownDocsRef.current.has(d));
    if (newDocs.length > 0) {
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        newDocs.forEach((d) => next.add(d));
        return next;
      });
      newDocs.forEach((d) => knownDocsRef.current.add(d));
    }
  }, [documents]);

  const handleSearch = () => {
    search(query, Array.from(selectedDocs));
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (select: boolean) => {
    if (select) {
      setSelectedDocs(new Set(documents));
    } else {
      setSelectedDocs(new Set());
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center py-24 px-6 bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      <a
        href="https://github.com/marcoshernanz/chatvault"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
        aria-label="View on GitHub"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      </a>
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-linear-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            ChatVault
          </h1>
          <p className="text-zinc-500 text-sm">
            Your private second brain, running entirely in your browser.
          </p>
        </div>

        <ModelLoading ready={ready} initProgress={initProgress} />

        <div className="space-y-6">
          <FileUploader onUpload={addDocument} ready={ready} />

          <UploadProgress uploads={uploads} />

          <div className="space-y-4">
            <ChatFilter
              documents={documents}
              selected={selectedDocs}
              onToggle={toggleDoc}
              onToggleAll={toggleAll}
            />

            <div className="relative group">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex gap-3 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800/50 shadow-lg backdrop-blur-sm focus-within:border-zinc-700 transition-colors">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask something about your documents..."
                  className="flex-1 bg-transparent px-4 py-3 outline-none text-zinc-100 placeholder:text-zinc-600"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={!ready || isSearching}
                  className="bg-zinc-100 text-zinc-900 px-6 py-2 rounded-lg font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                      Thinking
                    </span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </div>

            <SearchResults results={searchResults} />
          </div>
        </div>
      </div>
    </main>
  );
}
