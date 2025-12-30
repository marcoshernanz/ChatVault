"use client";

import { useEffect, useState } from "react";
import init, { add } from "../pkg/local_mind_core";

export default function Home() {
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    // Initialize the Wasm module when the component mounts
    init().then(() => {
      // Once initialized, we can call our Rust function
      const sum = add(BigInt(5), BigInt(10));
      setResult(Number(sum));
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Rust + Next.js</h1>
      <div className="text-xl">
        5 + 10 ={" "}
        <span className="font-mono font-bold text-green-500">
          {result !== null ? result : "Loading..."}
        </span>
      </div>
    </main>
  );
}
