import { UploadStatus } from "../types";

interface UploadProgressProps {
  uploads: Record<string, UploadStatus>;
}

export default function UploadProgress({ uploads }: UploadProgressProps) {
  return (
    <div className="fixed bottom-8 right-8 flex flex-col gap-4 w-80 pointer-events-none">
      {Object.values(uploads).map((upload) => (
        <div
          key={upload.filename}
          className="bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700 animate-fade-in pointer-events-auto"
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className="font-semibold text-sm truncate max-w-40"
              title={upload.filename}
            >
              {upload.filename}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {upload.status}
            </span>
            {upload.status === "processing" && (
              <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            )}
          </div>

          {upload.status === "pending" && (
            <div className="text-xs text-gray-500">Waiting in queue...</div>
          )}

          {(upload.status === "processing" || upload.status === "completed") &&
            upload.progress && (
              <>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{Math.round(upload.progress.percent)}%</span>
                  <span>{upload.progress.etr}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress.percent}%` }}
                  ></div>
                </div>
              </>
            )}
          {upload.status === "error" && (
            <div className="text-xs text-red-500">Error: {upload.error}</div>
          )}
        </div>
      ))}
    </div>
  );
}
