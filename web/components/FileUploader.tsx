"use client";
import { useState } from "react";

interface RustDatabase {
  add_document: (id: string, content: string) => void;
  get_count: () => number;
}

export default function FileUploader({ db }: { db: RustDatabase | null }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !db) return;

    setUploading(true);
    const file = e.target.files[0];

    try {
      const text = await file.text();
      console.log(`Read ${text.length} chars.`);

      // Allow UI to update before freezing for WASM
      await new Promise((r) => setTimeout(r, 50));

      const startTime = performance.now();
      db.add_document(file.name, text);
      const endTime = performance.now();

      console.log(`Rust took ${endTime - startTime}ms to process and embed.`);
      alert(`Saved! Total chunks: ${db.get_count()}`);
    } catch (err) {
      console.error("Error processing file:", err);
      alert("Error processing file. See console.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg w-full max-w-2xl text-center">
      <input
        type="file"
        accept=".txt,.md"
        onChange={handleFileChange}
        disabled={!db || uploading}
        className="text-white"
      />
      {uploading && (
        <p className="text-yellow-400 mt-2">
          Processing & Embedding in Rust... (this may freeze the UI)
        </p>
      )}
    </div>
  );
}
