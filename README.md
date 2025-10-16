# 🖼️ Visual Product Matcher

> An intelligent visual search app that finds **visually similar products** from a local dataset and **online marketplaces** (like eBay) — powered by AI embeddings (CLIP), FAISS vector search, and a modern React + Tailwind frontend.

![Demo Screenshot](docs/demo-screenshot.png) <!-- optional; add a screenshot if available -->

---

## 🌟 Features

### 🧠 Core Capabilities
- **Visual similarity search** using [Sentence Transformers (CLIP ViT-B/32)](https://www.sbert.net/).
- **FAISS index** for fast nearest-neighbor image retrieval from your local product catalog.
- **Optional online results** — integrates with the **eBay Image Search API**.
- **Unified results view** combining local + online matches.

### 💻 Frontend
- Built with **React + Vite + TailwindCSS**.
- Drag-and-drop or URL-based image upload.
- Real-time image preview before search.
- Two results sections: **Local Matches** & **Online Matches**.
- Built-in filters:
  - **Minimum similarity** (slider + numeric entry)
  - **Sort by**: similarity, price, name
  - **Category filter**
  - **Apply/Revert filters**
- Responsive layout (mobile-friendly).
- Smooth hover transitions, hero parallax, and modern gradient UI.

### ⚙️ Backend
- Built with **FastAPI**.
- Serves both API and static image files.
- Local FAISS search endpoint: `/search_local`
- Combined local + online endpoint: `/search`
- Modular design ready for future online providers (Amazon, Flipkart, etc.)
- CORS enabled for local frontend development.

---

## 🧩 Tech Stack

| Layer               | Technologies                                        |
|---------------------|-----------------------------------------------------|
| **Frontend**        | React (Vite), TailwindCSS, Axios                    |
| **Backend**         | FastAPI, Python 3.11+, FAISS, Sentence Transformers |
| **AI Model**        | `sentence-transformers/clip-ViT-B-32`               |
| **Search**          | FAISS vector index (L2-normalized embeddings)       |
| **Online Provider** | eBay Browse API (Image Search endpoint)             |
| **Deployment**      | (To be added — e.g. Render, Vercel, or AWS)         |

---

## 🚀 Setup Guide (Windows)

### 1️⃣ Clone the Repository
```powershell
git clone https://github.com/kislay0/visual-product-matcher.git
cd visual-product-matcher
