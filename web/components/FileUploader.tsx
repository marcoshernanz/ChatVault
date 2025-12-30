"use client";
import { useState } from "react";

interface FileUploaderProps {
  onUpload: (file: File, content: string) => void;
  ready: boolean;
}

export default function FileUploader({ onUpload, ready }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !ready) return;

    setUploading(true);
    const file = e.target.files[0];

    try {
      const text = await file.text();
      console.log(`Read ${text.length} chars.`);

      // Call the parent handler
      onUpload(file, text);

      // We don't wait for the worker here because it's async message passing.
      // The parent component will handle the "done" state or we can just reset immediately
      // since the heavy lifting is off-thread.
    } catch (err) {
      console.error("Error reading file:", err);
      alert("Error reading file. See console.");
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
        disabled={!ready || uploading}
        className="text-white"
      />
      {uploading && <p className="text-yellow-400 mt-2">Reading file...</p>}
    </div>
  );
}
