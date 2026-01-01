use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct TextChunk {
    pub doc_id: String,
    pub content: String,
    pub sender: Option<String>,
    pub date: Option<String>,
    pub embedding: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub doc_id: String,
    pub content: String,
    pub sender: Option<String>,
    pub date: Option<String>,
    pub score: f32,
}
