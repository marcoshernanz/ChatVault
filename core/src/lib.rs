use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use serde::{Deserialize, Serialize};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

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

        let paragraphs = content.split("\n\n");
        for p in paragraphs {
            let clean_text = p.trim();
            if !clean_text.is_empty() {
                let embedding = self.compute_embedding(clean_text)?;
                let chunk = TextChunk {
                    doc_id: id.clone(),
                    content: clean_text.to_string(),
                    embedding,
                };
                self.chunks.push(chunk);
            }
        }
        Ok(())
    }

    pub fn search(&self, query: String, top_k: usize) -> Result<JsValue, JsError> {
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

        let tokens = tokenizer
            .encode(text, true)
            .map_err(|e| JsError::new(&e.to_string()))?;
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
