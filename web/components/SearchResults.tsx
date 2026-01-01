import { SearchResult } from "../types";

interface SearchResultsProps {
  results: SearchResult[];
}

export default function SearchResults({ results }: SearchResultsProps) {
  return (
    <div className="mt-6 space-y-4">
      {results.map((r, i) => (
        <div key={i} className="p-4 bg-gray-800 rounded border border-gray-700">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-400">
                {r.sender || "Unknown"}
              </span>
              <span className="text-xs text-gray-500">
                {r.date || "No date"}
              </span>
            </div>
            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
              Score: {r.score.toFixed(2)}
            </span>
          </div>
          <p className="text-gray-300 whitespace-pre-wrap">{r.content}</p>
          <div className="mt-2 text-xs text-gray-500 text-right">
            Source: {r.doc_id}
          </div>
        </div>
      ))}
    </div>
  );
}
