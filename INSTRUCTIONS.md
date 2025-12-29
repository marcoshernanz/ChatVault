```bash
cd core
wasm-pack build --target web
cd pkg 
npm pack 
cd ../../web 
npm install ../core/pkg/local-mind-core-0.1.0.tgz


```