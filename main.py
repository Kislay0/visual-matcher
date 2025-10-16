# main.py  (replace your existing file with this exact content)
import os
import io
import base64
import json
import asyncio
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer
import faiss
import aiohttp
from dotenv import load_dotenv
import re

load_dotenv()  # loads .env if present

# eBay / provider config
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")
EBAY_ENV = os.getenv("EBAY_ENV", "sandbox")  # or 'production'

if EBAY_ENV == "production":
    EBAY_OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
    EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search_by_image"
else:
    EBAY_OAUTH_URL = "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    EBAY_BROWSE_URL = "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search_by_image"

app = FastAPI(title="Visual Product Matcher")

# CORS (open for demo)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Serve product images from data/products via /static
if not os.path.exists("data/products"):
    os.makedirs("data/products")
app.mount("/static", StaticFiles(directory="data/products"), name="static")

# Serve simple homepage (static frontend served by Vite in dev, but keep this)
@app.get("/", response_class=HTMLResponse)
async def homepage():
    idx_path = "static/index.html"
    if os.path.exists(idx_path):
        return HTMLResponse(open(idx_path, "r", encoding="utf-8").read())
    return HTMLResponse("<h1>Visual Product Matcher API</h1><p>Use /search_local and /search_online endpoints.</p>")

# Globals loaded at startup
MODEL = None
FAISS_INDEX = None
PRODUCTS = None

def pil_from_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")

@app.on_event("startup")
async def startup():
    global MODEL, FAISS_INDEX, PRODUCTS
    print("Starting up: loading model and index...")
    # load CLIP model
    MODEL = SentenceTransformer("sentence-transformers/clip-ViT-B-32")
    # load FAISS index and metadata
    idx_path = "data/index/faiss.index"
    meta_path = "data/index/products.json"
    if os.path.exists(idx_path) and os.path.exists(meta_path):
        FAISS_INDEX = faiss.read_index(idx_path)
        with open(meta_path, "r", encoding="utf-8") as f:
            PRODUCTS = json.load(f)
        print(f"Loaded index with {len(PRODUCTS)} products.")
    else:
        print("Index files not found in data/index/. Run index_products.py first.")

# ---------- eBay helpers ----------
async def ebay_get_token(session: aiohttp.ClientSession):
    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        raise RuntimeError("EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set in .env to use eBay")
    auth_b64 = base64.b64encode(f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode()).decode()
    headers = {"Authorization": f"Basic {auth_b64}", "Content-Type": "application/x-www-form-urlencoded"}
    data = "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    async with session.post(EBAY_OAUTH_URL, headers=headers, data=data) as resp:
        text = await resp.text()
        if resp.status != 200:
            raise RuntimeError(f"eBay token error: {resp.status} {text}")
        return json.loads(text).get("access_token")

async def ebay_search_by_image_bytes(image_bytes: bytes, top_k: int = 10):
    async with aiohttp.ClientSession() as session:
        token = await ebay_get_token(session)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json"}
        payload = {"image": base64.b64encode(image_bytes).decode(), "limit": top_k}
        async with session.post(EBAY_BROWSE_URL, headers=headers, json=payload) as resp:
            text = await resp.text()
            if resp.status != 200:
                print("eBay search failed:", resp.status, text)
                return {}
            return json.loads(text)

async def fetch_image_bytes(session: aiohttp.ClientSession, url: str) -> Optional[bytes]:
    try:
        async with session.get(url, timeout=10) as r:
            if r.status == 200:
                return await r.read()
    except Exception as e:
        return None
    return None

# ---------- helpers for data: URIs ----------
DATA_URI_RE = re.compile(r"data:(image/[^;]+);base64,(.*)$", flags=re.IGNORECASE)

def decode_data_uri(data_uri: str) -> Optional[bytes]:
    """Return bytes if data_uri is a valid data:image/...;base64,... else None"""
    m = DATA_URI_RE.match(data_uri)
    if not m:
        return None
    b64 = m.group(2)
    try:
        return base64.b64decode(b64)
    except Exception:
        return None

# ---------- Embedding helper ----------
def compute_query_embedding(pil_img):
    q_emb = MODEL.encode(pil_img, convert_to_numpy=True).astype("float32")
    q_emb_norm = q_emb.copy()
    faiss.normalize_L2(q_emb_norm.reshape(1, -1))
    return q_emb_norm

# ---------- Endpoints ----------
@app.post("/search")
async def search(request: Request, image_url: Optional[str] = Form(None), file: UploadFile = File(None), top_k: int = Form(10), include_online: bool = Form(False)):
    # Accept either file, an http(s) URL, or a data: URI (base64 embedded)
    if file:
        q_bytes = await file.read()
        query_pil = pil_from_bytes(q_bytes)
    elif image_url:
        # handle data: URI
        if image_url.startswith("data:"):
            decoded = decode_data_uri(image_url)
            if decoded is None:
                return JSONResponse({"error": "invalid data URI"}, status_code=400)
            q_bytes = decoded
            query_pil = pil_from_bytes(q_bytes)
        else:
            async with aiohttp.ClientSession() as s:
                async with s.get(image_url) as resp:
                    if resp.status != 200:
                        return JSONResponse({"error": f"failed to fetch image: {resp.status}"}, status_code=400)
                    q_bytes = await resp.read()
            query_pil = pil_from_bytes(q_bytes)
    else:
        return JSONResponse({"error": "no image provided"}, status_code=400)

    # local
    local_results = []
    if FAISS_INDEX is not None:
        q_emb_norm = compute_query_embedding(query_pil)
        D_local, I_local = FAISS_INDEX.search(q_emb_norm.reshape(1, -1), top_k)
        base = str(request.base_url).rstrip('/')  # e.g. http://localhost:8000
        for score, idx in zip(D_local[0], I_local[0]):
            prod = PRODUCTS[idx]
            thumb_path = prod.get("thumb") or ""
            if thumb_path.startswith("/"):
                thumb_url = base + thumb_path
            else:
                thumb_url = thumb_path
            local_results.append({
                "id": prod.get("id"),
                "name": prod.get("name"),
                "image": prod.get("image_path"),
                "thumb": thumb_url,
                "score": float(score),
                "source": "local",
                "category": prod.get("category")
            })

    # online via eBay (if requested)
    online_results = []
    if include_online:
        try:
            ebay_resp = await ebay_search_by_image_bytes(q_bytes, top_k=top_k)
            items = ebay_resp.get("itemSummaries", []) if ebay_resp else []
            async with aiohttp.ClientSession() as session:
                tasks = []
                for it in items:
                    image_url_item = None
                    if "image" in it and isinstance(it["image"], dict):
                        image_url_item = it["image"].get("imageUrl")
                    elif it.get("thumbnailImages"):
                        if isinstance(it["thumbnailImages"], list) and len(it["thumbnailImages"])>0:
                            image_url_item = it["thumbnailImages"][0].get("imageUrl")
                    tasks.append((it, image_url_item))
                # fetch thumbnails in serial (simple)
                for it, img_url in tasks:
                    data = None
                    if img_url:
                        try:
                            async with aiohttp.ClientSession() as s:
                                async with s.get(img_url) as r:
                                    if r.status == 200:
                                        data = await r.read()
                        except Exception:
                            data = None
                    score = 0.0
                    if data:
                        try:
                            pil = pil_from_bytes(data)
                            emb = MODEL.encode(pil, convert_to_numpy=True).astype("float32")
                            emb_norm = emb.copy()
                            faiss.normalize_L2(emb_norm.reshape(1, -1))
                            q_emb_norm = compute_query_embedding(query_pil)
                            score = float(np.dot(q_emb_norm, emb_norm))
                        except Exception:
                            score = 0.0
                    # attempt to extract price & seller domain
                    price_display = it.get("price", {}).get("value") if isinstance(it.get("price"), dict) else it.get("price", None)
                    seller_domain = None
                    web_link = it.get("itemWebUrl")
                    if web_link and isinstance(web_link, str):
                        # extract domain from itemWebUrl
                        try:
                            from urllib.parse import urlparse
                            seller_domain = urlparse(web_link).netloc
                        except Exception:
                            seller_domain = None
                    online_results.append({
                        "id": it.get("itemId"),
                        "name": it.get("title"),
                        "image": img_url,
                        "score": score,
                        "source": "ebay",
                        "web_link": web_link,
                        "price_display": price_display,
                        "seller_domain": seller_domain
                    })
        except Exception as e:
            print("eBay error:", e)

    # merge simple (local first)
    combined = (local_results or []) + (online_results or [])
    combined_sorted = sorted(combined, key=lambda x: x.get("score", 0.0), reverse=True)
    # dedupe by name+image and return top_k
    final = []
    seen = set()
    for r in combined_sorted:
        key = (str(r.get("name","")) + "|" + str(r.get("image","")))[:300]
        if key in seen:
            continue
        seen.add(key)
        final.append(r)
        if len(final) >= top_k:
            break
    return {"results": final}


@app.post("/search_local")
async def search_local(request: Request, image_url: Optional[str] = Form(None), file: UploadFile = File(None), top_k: int = Form(10)):
    # Accept file upload, http(s) URL, or data: URI
    if file:
        q_bytes = await file.read()
        query_pil = pil_from_bytes(q_bytes)
    elif image_url:
        # if data: URI, decode locally (no aiohttp)
        if image_url.startswith("data:"):
            decoded = decode_data_uri(image_url)
            if decoded is None:
                return JSONResponse({"error": "invalid data URI"}, status_code=400)
            q_bytes = decoded
            query_pil = pil_from_bytes(q_bytes)
        else:
            # regular http(s) fetch
            async with aiohttp.ClientSession() as s:
                async with s.get(image_url) as resp:
                    if resp.status != 200:
                        return JSONResponse({"error": f"failed to fetch image: {resp.status}"}, status_code=400)
                    q_bytes = await resp.read()
            query_pil = pil_from_bytes(q_bytes)
    else:
        return JSONResponse({"error": "no image provided"}, status_code=400)

    # If index not loaded, return graceful message
    if FAISS_INDEX is None:
        return {"results": [], "note": "local index not available; run index_products.py"}

    # compute embedding and search
    q_emb_norm = compute_query_embedding(query_pil)
    D_local, I_local = FAISS_INDEX.search(q_emb_norm.reshape(1, -1), top_k)
    local_results = []
    base = str(request.base_url).rstrip('/')
    for score, idx in zip(D_local[0], I_local[0]):
        prod = PRODUCTS[idx]
        thumb_path = prod.get("thumb") or ""
        if thumb_path.startswith("/"):
            thumb_url = base + thumb_path
        else:
            thumb_url = thumb_path
        local_results.append({
            "id": prod.get("id"),
            "name": prod.get("name"),
            "image": prod.get("image_path"),
            "thumb": thumb_url,
            "score": float(score),
            "source": "local",
            "category": prod.get("category")
        })
    return {"results": local_results}


@app.post("/search_online")
async def search_online(image_url: Optional[str] = Form(None), file: UploadFile = File(None), top_k: int = Form(10), provider: Optional[str] = Form("ebay")):
    if file:
        q_bytes = await file.read()
        query_pil = pil_from_bytes(q_bytes)
    elif image_url:
        if image_url.startswith("data:"):
            decoded = decode_data_uri(image_url)
            if decoded is None:
                return JSONResponse({"error": "invalid data URI"}, status_code=400)
            q_bytes = decoded
            query_pil = pil_from_bytes(q_bytes)
        else:
            async with aiohttp.ClientSession() as s:
                async with s.get(image_url) as resp:
                    if resp.status != 200:
                        return JSONResponse({"error": f"failed to fetch image: {resp.status}"}, status_code=400)
                    q_bytes = await resp.read()
            query_pil = pil_from_bytes(q_bytes)
    else:
        return JSONResponse({"error": "no image provided"}, status_code=400)

    online_results = []
    if provider == "ebay":
        try:
            ebay_resp = await ebay_search_by_image_bytes(q_bytes, top_k=top_k)
            items = ebay_resp.get("itemSummaries", []) if ebay_resp else []
            async with aiohttp.ClientSession() as session:
                tasks = []
                for it in items:
                    image_url_item = None
                    if "image" in it and isinstance(it["image"], dict):
                        image_url_item = it["image"].get("imageUrl")
                    elif it.get("thumbnailImages"):
                        if isinstance(it["thumbnailImages"], list) and len(it["thumbnailImages"])>0:
                            image_url_item = it["thumbnailImages"][0].get("imageUrl")
                    tasks.append((it, image_url_item))
                for it, img_url in tasks:
                    data = None
                    if img_url:
                        try:
                            async with aiohttp.ClientSession() as s:
                                async with s.get(img_url) as r:
                                    if r.status == 200:
                                        data = await r.read()
                        except Exception:
                            data = None
                    score = 0.0
                    if data:
                        try:
                            pil = pil_from_bytes(data)
                            emb = MODEL.encode(pil, convert_to_numpy=True).astype("float32")
                            emb_norm = emb.copy()
                            faiss.normalize_L2(emb_norm.reshape(1, -1))
                            q_emb_norm = compute_query_embedding(query_pil)
                            score = float(np.dot(q_emb_norm, emb_norm))
                        except Exception:
                            score = 0.0
                    price_display = it.get("price", {}).get("value") if isinstance(it.get("price"), dict) else it.get("price", None)
                    seller_domain = None
                    web_link = it.get("itemWebUrl")
                    if web_link and isinstance(web_link, str):
                        try:
                            from urllib.parse import urlparse
                            seller_domain = urlparse(web_link).netloc
                        except Exception:
                            seller_domain = None
                    online_results.append({
                        "id": it.get("itemId"),
                        "name": it.get("title"),
                        "image": img_url,
                        "score": score,
                        "source": "ebay",
                        "web_link": web_link,
                        "price_display": price_display,
                        "seller_domain": seller_domain
                    })
        except Exception as e:
            print("eBay online error:", e)
    else:
        pass

    online_sorted = sorted(online_results, key=lambda x: x.get("score", 0.0), reverse=True)
    return {"results": online_sorted}
