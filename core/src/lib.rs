use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use serde::{Deserialize, Serialize};
use text_splitter::{ChunkConfig, ChunkSizer, MarkdownSplitter, TextSplitter};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

struct BertSizer<'a> {
    tokenizer: &'a Tokenizer,
}

impl<'a> ChunkSizer for BertSizer<'a> {
    fn size(&self, chunk: &str) -> usize {
        self.tokenizer
            .encode(chunk, false)
            .map(|e| e.len())
            .unwrap_or(0)
    }
}

struct TextChunk {
    doc_id: String,
    content: String,
    embedding: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub doc_id: String,
    pub content: String,
    pub score: f32,
}

#[wasm_bindgen]
pub struct VectorDatabase {
    chunks: Vec<TextChunk>,
    model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
}

#[wasm_bindgen]
impl VectorDatabase {
    #[wasm_bindgen(constructor)]
    pub fn new() -> VectorDatabase {
        console_error_panic_hook::set_once();
        VectorDatabase {
            chunks: Vec::new(),
            model: None,
            tokenizer: None,
        }
    }

    pub fn load_model(
        &mut self,
        weights: &[u8],
        tokenizer_data: &[u8],
        config_data: &[u8],
    ) -> Result<(), JsError> {
        let config: Config =
            serde_json::from_slice(config_data).map_err(|e| JsError::new(&e.to_string()))?;
        let tokenizer =
            Tokenizer::from_bytes(tokenizer_data).map_err(|e| JsError::new(&e.to_string()))?;

        let device = Device::Cpu;
        let vb = VarBuilder::from_slice_safetensors(weights, DType::F32, &device)
            .map_err(|e| JsError::new(&e.to_string()))?;
        let model = BertModel::load(vb, &config).map_err(|e| JsError::new(&e.to_string()))?;

        self.model = Some(model);
        self.tokenizer = Some(tokenizer);
        Ok(())
    }

    pub fn add_document(&mut self, id: String, content: String) -> Result<(), JsError> {
        if self.model.is_none() {
            return Err(JsError::new("Model not loaded"));
        }

        let tokenizer = self.tokenizer.as_ref().unwrap();

        // Use TextSplitter with the Hugging Face Tokenizer
        // This ensures chunks fit within the model's token limit (e.g., 512 tokens)
        // and splits semantically.
        let max_tokens = 100; // Target ~100 tokens per chunk for dense retrieval
        let sizer = BertSizer { tokenizer };

        let chunks: Vec<String> = if id.ends_with(".md") {
            let splitter = MarkdownSplitter::new(ChunkConfig::new(max_tokens).with_sizer(sizer));
            splitter.chunks(&content).map(|s| s.to_string()).collect()
        } else {
            let splitter = TextSplitter::new(ChunkConfig::new(max_tokens).with_sizer(sizer));
            splitter.chunks(&content).map(|s| s.to_string()).collect()
        };

        for chunk_text in chunks {
            // Log progress
            let preview = if chunk_text.len() > 50 {
                &chunk_text[..50]
            } else {
                &chunk_text
            };
            web_sys::console::log_1(&JsValue::from_str(&format!(
                "Indexing chunk: {}...",
                preview
            )));

            let embedding = self.compute_embedding(&chunk_text)?;

            let chunk = TextChunk {
                doc_id: id.clone(),
                content: chunk_text,
                embedding,
            };
            self.chunks.push(chunk);
        }

        Ok(())
    }

    pub fn search(&self, query: String, top_k: usize, threshold: f32) -> Result<JsValue, JsError> {
        if self.model.is_none() {
            return Err(JsError::new("Model not loaded"));
        }

        let query_embedding = self.compute_embedding(&query)?;

        let mut scores: Vec<(usize, f32)> = self
            .chunks
            .iter()
            .enumerate()
            .map(|(i, chunk)| {
                let score = dot_product(&query_embedding, &chunk.embedding);
                (i, score)
            })
            .collect();

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<SearchResult> = scores
            .into_iter()
            .filter(|(_, score)| *score >= threshold)
            .take(top_k)
            .map(|(i, score)| SearchResult {
                doc_id: self.chunks[i].doc_id.clone(),
                content: self.chunks[i].content.clone(),
                score,
            })
            .collect();

        Ok(serde_wasm_bindgen::to_value(&results)?)
    }

    pub fn get_count(&self) -> usize {
        self.chunks.len()
    }

    pub fn debug_print_chunk(&self, index: usize) -> String {
        if index < self.chunks.len() {
            format!(
                "[{}] {}",
                self.chunks[index].doc_id, self.chunks[index].content
            )
        } else {
            "Index out of bounds".to_string()
        }
    }

    fn compute_embedding(&self, text: &str) -> Result<Vec<f32>, JsError> {
        let tokenizer = self.tokenizer.as_ref().unwrap();
        let model = self.model.as_ref().unwrap();
        let device = Device::Cpu;

        let mut tokens = tokenizer
            .encode(text, true)
            .map_err(|e| JsError::new(&e.to_string()))?;

        // Truncate to 512 tokens to avoid model error
        if tokens.get_ids().len() > 512 {
            web_sys::console::warn_1(&JsValue::from_str("Truncating text to 512 tokens"));
            tokens = tokenizer
                .encode(&text[..std::cmp::min(text.len(), 2000)], true)
                .map_err(|e| JsError::new(&e.to_string()))?;
            // Note: This is a naive truncation (by char), ideally we truncate tokens.
            // But for now let's just warn and rely on the fact that we split by paragraphs.
        }

        let token_ids = Tensor::new(tokens.get_ids(), &device)?.unsqueeze(0)?;
        let token_type_ids = token_ids.zeros_like()?;

        let embeddings = model.forward(&token_ids, &token_type_ids, None)?;

        let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;
        let embeddings = normalize(&embeddings)?;

        let vec = embeddings.squeeze(0)?.to_vec1::<f32>()?;
        Ok(vec)
    }
}

fn normalize(tensor: &Tensor) -> Result<Tensor, JsError> {
    let sum_sq = tensor.sqr()?.sum_keepdim(1)?;
    let norm = sum_sq.sqrt()?;
    Ok((tensor.broadcast_div(&norm))?)
}

fn dot_product(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}
