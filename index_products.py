# index_products.py
import os
import json
import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer
import faiss
from tqdm import tqdm

DATA_DIR = "data/products"
OUT_DIR = "data/index"
os.makedirs(OUT_DIR, exist_ok=True)

print("Loading CLIP model (this will download the model once)...")
model = SentenceTransformer("sentence-transformers/clip-ViT-B-32")  # image encoder available here

products = []
embs = []

files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith((".jpg",".jpeg",".png"))]
if len(files) == 0:
    print("No images found in data/products/. Put at least one image there, then re-run.")
    raise SystemExit(1)

print(f"Found {len(files)} image files. Computing embeddings...")
for i, fname in enumerate(tqdm(files)):
    path = os.path.join(DATA_DIR, fname)
    try:
        img = Image.open(path).convert("RGB")
    except Exception as e:
        print("Skipping", fname, "error:", e)
        continue
    emb = model.encode(img, convert_to_numpy=True, show_progress_bar=False)
    embs.append(emb)
    products.append({
        "id": len(products),
        "name": os.path.splitext(fname)[0],
        "image_path": path,
        "thumb": f"/static/{fname}",
        "category": "unknown"
    })

embs = np.vstack(embs).astype("float32")
print("Embeddings shape:", embs.shape)

# Normalize embeddings for cosine similarity
faiss.normalize_L2(embs)

# Build index
d = embs.shape[1]
index = faiss.IndexFlatIP(d)  # inner product on normalized vectors = cosine similarity
index.add(embs)
faiss.write_index(index, os.path.join(OUT_DIR, "faiss.index"))

# Save embeddings and metadata
np.save(os.path.join(OUT_DIR, "embeddings.npy"), embs)
with open(os.path.join(OUT_DIR, "products.json"), "w") as f:
    json.dump(products, f, indent=2)

print("Index built and saved to data/index/ (faiss.index, embeddings.npy, products.json)")
