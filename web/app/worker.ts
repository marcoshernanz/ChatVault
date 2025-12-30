import init, { VectorDatabase } from "../pkg/local_mind_core";

// Define the types of messages we can receive from the main thread
type WorkerMessage =
  | { type: "INIT" }
  | { type: "ADD_DOCUMENT"; payload: { id: string; content: string } }
  | { type: "SEARCH"; payload: { query: string } };

// Global state for the worker
let db: VectorDatabase | null = null;

// Initialize the WASM module and the Vector Database
async function initialize() {
  try {
    // Initialize the WASM module
    // We use the default export from the pkg which is the init function
    await init();

    // Create the database instance
    db = new VectorDatabase();

    console.log("Worker: WASM initialized, loading model...");

    // Fetch model files directly in the worker
    // Web Workers have access to the fetch API
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

    // Load the model into the database
    db.load_model(
      new Uint8Array(weights),
      new Uint8Array(tokenizer),
      new Uint8Array(config)
    );

    console.log("Worker: Model loaded!");

    // Notify the main thread that we are ready
    self.postMessage({ type: "READY" });
  } catch (e) {
    console.error("Worker: Failed to initialize", e);
    self.postMessage({ type: "ERROR", payload: String(e) });
  }
}

// Handle messages from the main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "INIT":
      await initialize();
      break;

    case "ADD_DOCUMENT":
      if (!db) return;
      const { id, content } = msg.payload;
      try {
        console.log(`Worker: Adding document ${id}...`);
        db.add_document(id, content);
        const count = db.get_count();
        self.postMessage({ type: "DOCUMENT_ADDED", payload: count });
      } catch (err) {
        self.postMessage({ type: "ERROR", payload: String(err) });
      }
      break;

    case "SEARCH":
      if (!db) return;
      const { query } = msg.payload;
      try {
        // Perform the search
        // This is the heavy lifting that would freeze the UI if done on the main thread
        const results = db.search(query, 5, 0.5);
        self.postMessage({ type: "SEARCH_RESULTS", payload: results });
      } catch (err) {
        self.postMessage({ type: "ERROR", payload: String(err) });
      }
      break;
  }
};
