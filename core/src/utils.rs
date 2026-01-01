use candle_core::Tensor;
use wasm_bindgen::prelude::*;

pub fn normalize(tensor: &Tensor) -> Result<Tensor, JsError> {
    let sum_sq = tensor.sqr()?.sum_keepdim(1)?;
    let norm = sum_sq.sqrt()?;
    Ok((tensor.broadcast_div(&norm))?)
}

pub fn dot_product(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}
