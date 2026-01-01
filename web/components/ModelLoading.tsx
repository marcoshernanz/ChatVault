import { InitProgress } from "../types";

interface ModelLoadingProps {
  ready: boolean;
  initProgress: InitProgress | null;
}

export default function ModelLoading({
  ready,
  initProgress,
}: ModelLoadingProps) {
  if (ready) return null;

  return (
    <div className="w-full max-w-2xl mb-8">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>{initProgress?.status || "Initializing..."}</span>
        <span>{Math.round(initProgress?.percent || 0)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${initProgress?.percent || 0}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        First load may take a while (90MB). Subsequent loads will be instant.
      </p>
    </div>
  );
}
