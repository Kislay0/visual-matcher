# 🖼️ Visual Product Matcher

> **A Google Lens–like visual search app** that finds visually similar products from your local inventory **and online stores (e.g., eBay)** — powered by AI embeddings (CLIP), FAISS vector search, and a modern React + Tailwind UI.

![Demo Screenshot 1](ScreenShots/Screenshot%202025-10-17%20045058.png)
![Demo Screenshot 2](ScreenShots/Screenshot%202025-10-17%20045134.png)

---

## 🚀 Live Demo

🌐 **Frontend (Vercel):** [https://visualmatcher.vercel.app](https://visualmatcher.vercel.app)  
⚙️ **Backend (Render):** [https://visualmatcher-api.onrender.com](https://visualmatcher-api.onrender.com)

---

## 🏗️ Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | React (Vite) • TailwindCSS • Axios |
| **Backend** | FastAPI • Python 3.11+ |
| **AI Model** | SentenceTransformers `clip-ViT-B-32` |
| **Database** | FAISS (Vector Index) |
| **Containerization** | Docker & Docker Compose |
| **Hosting** | Vercel (frontend), Render (backend) |
| **Provider Integration** | eBay Image Search API |

---

## ✨ Key Features

### 🧠 AI Search
- Converts uploaded image → vector embedding using CLIP.
- Performs nearest-neighbor search in FAISS index.
- Optionally queries **eBay** for online results.
- Combines & sorts results by similarity or price.

### 💻 Modern Frontend
- Drag-and-drop upload or paste image URL.
- Live image preview before search.
- Filter & sort options:
  - Minimum similarity slider (with numeric input)
  - Top-K limit
  - Category filter
  - Sort by similarity, price, name
  - Include/exclude online results
- Fully responsive and animated interface (Tailwind + Framer Motion).

### 🔧 Backend Features
- FastAPI REST endpoints:
  - `/search_local` → Local FAISS search  
  - `/search_online` → Online eBay search  
  - `/search` → Combined local + online  
- Supports both file upload and image URL (including `data:` URIs).
- Serves product images via `/static/`.

---

## 🧰 Installation & Usage (Full Stack)

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/kislay0/visual-product-matcher.git
cd visual-product-matcher
```
### 2️⃣ Backend Setup (FastAPI)
```bash
python -m venv venv
venv\Scripts\activate
```
Install dependencies:
```bash
pip install -r requirements.txt
```
Run the backend:
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend → http://localhost:8000

### 3️⃣ Frontend Setup (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Frontend → http://localhost:5173


---

## 🧠 How It Works

1. Upload or paste image URL  
2. Backend encodes using CLIP → 512D embedding  
3. FAISS searches locally  
4. (Optional) eBay adds online results  
5. Combined results returned to frontend

---
## 🗂️ Project Structure
```css
visual-matcher/
│
├── main.py
├── index_products.py
├── requirements.txt
├── .env.example
│
├── data/
│   ├── products/
│   └── index/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── App.jsx
│   └── index.css
│
└── ScreenShots/
    ├── Screenshot 2025-10-17 045058.png
    └── Screenshot 2025-10-17 045134.png
```
## 🔐 Environment Variables
Create a .env file in the project root:
```ini
EBAY_CLIENT_ID=your_ebay_app_id
EBAY_CLIENT_SECRET=your_ebay_secret
EBAY_ENV=sandbox   # or production
```
## 🧭 API Overview
Endpoint	Method	Description
/search_local	POST	Search local FAISS index
/search_online	POST	Search eBay via Image API
/search	POST	Combined search
/static/*	GET	Serve product images

## 🧱 Local Index Creation
```bash
python index_products.py
```
Creates:
```pgsql
data/index/faiss.index  
data/index/embeddings.npy  
data/index/products.json
```
---

## 🐳 Docker Setup
```bash
docker-compose up --build
```
Example docker-compose.yml:
```yaml
version: "3"
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
```
## 💬 About
Visual Product Matcher is an AI-powered tool inspired by **Google Lens**, combining **machine learning**, **vector databases**, and **clean UX** to create a practical, modern visual search app.
