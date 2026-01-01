import init, { VectorDatabase } from "../pkg/local_mind_core";
import { get, set } from "idb-keyval";

type WorkerMessage =
  | { type: "INIT" }
  | { type: "ADD_DOCUMENT"; payload: { id: string; content: string } }
  | { type: "SEARCH"; payload: { query: string; allowedIds?: string[] } }
  | { type: "CANCEL_DOCUMENT"; payload: { id: string } };

let db: VectorDatabase | null = null;
const cancelledDocs = new Set<string>();

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const filename = url.split("/").pop() || "unknown";

  try {
    const cachedFile = await get(filename);
    if (cachedFile) {
      onProgress(cachedFile.byteLength, cachedFile.byteLength);
      return cachedFile;
    }
  } catch (err) {
    console.warn(`Worker: Cache lookup failed for ${filename}`, err);
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body!.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(received, total);
    }
  }

  const chunksAll = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }
  const buffer = chunksAll.buffer;

  set(filename, buffer).catch((err) =>
    console.error(`Worker: Failed to cache ${filename}`, err)
  );

  return buffer;
}

async function initialize() {
  try {
    await init();
    db = new VectorDatabase();

    const progressMap: Record<string, { loaded: number; total: number }> = {};

    const ESTIMATED_SIZES: Record<string, number> = {
      "model.safetensors": 90 * 1024 * 1024,
      "tokenizer.json": 500 * 1024,
      "config.json": 2 * 1024,
    };

    const modelUrls = [
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.safetensors",
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json",
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json",
    ];

    modelUrls.forEach((url) => {
      const filename = url.split("/").pop() || "";
      progressMap[url] = {
        loaded: 0,
        total: ESTIMATED_SIZES[filename] || 0,
      };
    });

    const reportTotalProgress = () => {
      let totalLoaded = 0;
      let totalSize = 0;

      Object.values(progressMap).forEach((p) => {
        totalLoaded += p.loaded;
        totalSize += p.total || 0;
      });

      let percent = totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;

      if (percent > 100) percent = 100;

      self.postMessage({
        type: "INIT_PROGRESS",
        payload: { percent, status: "Downloading model..." },
      });
    };

    const loadFile = (url: string) => {
      return fetchWithProgress(url, (loaded, total) => {
        progressMap[url] = { loaded, total };
        reportTotalProgress();
      });
    };

    const [weights, tokenizer, config] = await Promise.all(
      modelUrls.map(loadFile)
    );

    self.postMessage({
      type: "INIT_PROGRESS",
      payload: { percent: 100, status: "Compiling model..." },
    });

    db.load_model(
      new Uint8Array(weights),
      new Uint8Array(tokenizer),
      new Uint8Array(config)
    );

    try {
      const savedDb = await get("local_mind_db_dump");
      if (savedDb) {
        db.import_database(savedDb);
        const ids = db.get_document_ids();
        self.postMessage({ type: "RESTORED_DOCS", payload: ids });
      }
    } catch (e) {
      console.error("Failed to load saved DB", e);
    }

    self.postMessage({ type: "READY" });
  } catch (e) {
    console.error("Worker: Failed to initialize", e);
    self.postMessage({ type: "ERROR", payload: String(e) });
  }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      await initialize();
      break;

    case "ADD_DOCUMENT":
      if (!db) return;
      const { id, content } = msg.payload;

      if (cancelledDocs.has(id)) {
        cancelledDocs.delete(id);
        return;
      }

      try {
        const onProgress = (current: number, total: number) => {
          self.postMessage({
            type: "INDEX_PROGRESS",
            payload: {
              filename: id,
              current: current + 1,
              total,
              percent: ((current + 1) / total) * 100,
            },
          });
        };

        db.add_document(id, content, onProgress);

        if (cancelledDocs.has(id)) {
          cancelledDocs.delete(id);
          return;
        }

        const count = db.get_count();
        self.postMessage({ type: "DOCUMENT_ADDED", payload: { count, id } });

        try {
          const dump = db.export_database();
          await set("local_mind_db_dump", dump);
        } catch (e) {
          console.error("Failed to save DB", e);
        }
      } catch (err) {
        self.postMessage({ type: "ERROR", payload: String(err) });
      }
      break;

    case "CANCEL_DOCUMENT":
      cancelledDocs.add(msg.payload.id);
      break;

    case "SEARCH":
      if (!db) return;
      const { query, allowedIds } = msg.payload;
      try {
        const results = db.search(query, 5, 0.3, allowedIds);
        self.postMessage({ type: "SEARCH_RESULTS", payload: results });
      } catch (err) {
        self.postMessage({ type: "ERROR", payload: String(err) });
      }
      break;
  }
};
