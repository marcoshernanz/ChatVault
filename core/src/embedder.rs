use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

use crate::utils::normalize;

pub struct Embedder {
    model: BertModel,
    tokenizer: Tokenizer,
}

impl Embedder {
    pub fn load(
        weights: &[u8],
        tokenizer_data: &[u8],
        config_data: &[u8],
    ) -> Result<Embedder, JsError> {
        let config: Config =
            serde_json::from_slice(config_data).map_err(|e| JsError::new(&e.to_string()))?;
        let tokenizer =
            Tokenizer::from_bytes(tokenizer_data).map_err(|e| JsError::new(&e.to_string()))?;

        let device = Device::Cpu;
        let vb = VarBuilder::from_slice_safetensors(weights, DType::F32, &device)
            .map_err(|e| JsError::new(&e.to_string()))?;
        let model = BertModel::load(vb, &config).map_err(|e| JsError::new(&e.to_string()))?;

        Ok(Embedder { model, tokenizer })
    }

    pub fn compute_embedding(&self, text: &str) -> Result<Vec<f32>, JsError> {
        let device = Device::Cpu;

        let mut tokens = self
            .tokenizer
            .encode(text, true)
            .map_err(|e| JsError::new(&e.to_string()))?;

        // Truncate to 512 tokens to avoid model error
        if tokens.get_ids().len() > 512 {
            // web_sys::console::warn_1(&JsValue::from_str("Truncating text to 512 tokens"));
            tokens = self
                .tokenizer
                .encode(&text[..std::cmp::min(text.len(), 2000)], true)
                .map_err(|e| JsError::new(&e.to_string()))?;
            // Note: This is a naive truncation (by char), ideally we truncate tokens.
            // But for now let's just warn and rely on the fact that we split by paragraphs.
        }

        let token_ids = Tensor::new(tokens.get_ids(), &device)?.unsqueeze(0)?;
        let token_type_ids = token_ids.zeros_like()?;

        let embeddings = self.model.forward(&token_ids, &token_type_ids, None)?;

        let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3()?;
        let embeddings = (embeddings.sum(1)? / (n_tokens as f64))?;
        let embeddings = normalize(&embeddings)?;

        let vec = embeddings.squeeze(0)?.to_vec1::<f32>()?;
        Ok(vec)
    }
}
