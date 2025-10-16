// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import UploadArea from "./components/UploadArea";
import ResultCard from "./components/ResultCard";
import Loader from "./components/Loader";
import EmptyState from "./components/EmptyState";

export default function App() {
  const [localResults, setLocalResults] = useState([]);
  const [onlineResults, setOnlineResults] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [status, setStatus] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [minSim, setMinSim] = useState(0.0);
  const [appliedMinSim, setAppliedMinSim] = useState(0.0);

  const heroRef = useRef();

  useEffect(() => {
    function onScroll() {
      const el = heroRef.current;
      if (!el) return;
      const scrollY = window.scrollY;
      el.style.transform = `translateY(${scrollY * -0.06}px)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSearch({ file, url }) {
    setStatus("");
    setLocalResults([]);
    setOnlineResults([]);
    setLoadingLocal(true);
    setLoadingOnline(false);

    try {
      const topk = document.getElementById("topk")?.value || 10;
      const includeOnline = document.getElementById("includeOnline")?.checked ?? true;

      // LOCAL
      const formLocal = new FormData();
      formLocal.append("top_k", topk);
      if (file) formLocal.append("file", file);
      else if (url) formLocal.append("image_url", url);

      setStatus("Searching local inventory...");
      const respLocal = await axios.post("/api/search_local", formLocal, { headers: { "Content-Type": "multipart/form-data" }, timeout: 20000 });
      const lres = (respLocal.data.results || []).map(r => ({ ...r }));
      setLocalResults(lres.filter(r => (r.score ?? 0) >= appliedMinSim));
      setStatus(`Local: ${(respLocal.data.results || []).length} results`);
      setLoadingLocal(false);

      // ONLINE
      if (includeOnline) {
        setLoadingOnline(true);
        setStatus("Fetching online/global results ...");
        const formOnline = new FormData();
        formOnline.append("top_k", topk);
        formOnline.append("provider", "ebay");
        if (file) formOnline.append("file", file);
        else if (url) formOnline.append("image_url", url);

        const respOnline = await axios.post("/api/search_online", formOnline, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
        const ores = (respOnline.data.results || []).map(r => ({ ...r }));
        setOnlineResults(ores.filter(r => (r.score ?? 0) >= appliedMinSim));
        setStatus(`Online: ${(respOnline.data.results || []).length} results`);
        setLoadingOnline(false);
      }
    } catch (err) {
      console.error(err);
      setStatus("Error: " + (err.response?.data || err.message || "unknown"));
      setLoadingLocal(false);
      setLoadingOnline(false);
    }
  }

  const categories = React.useMemo(() => {
    const cats = new Set();
    [...localResults, ...onlineResults].forEach(r => {
      const c = r.category || r.cat || r.type;
      if (c) cats.add(c);
    });
    return ["all", ...Array.from(cats)];
  }, [localResults, onlineResults]);

  function applyFilterSort(items) {
    if (!items) return [];
    let out = items.slice();
    out = out.filter(it => (it.score ?? 0) >= appliedMinSim);

    if (categoryFilter && categoryFilter !== "all") {
      out = out.filter(it => (it.category || it.cat || it.type) === categoryFilter);
    }

    const cmp = (a, b) => {
      if (sortBy === "score_desc") return (b.score || 0) - (a.score || 0);
      if (sortBy === "price_asc") {
        const pa = Number((a.price ?? parseFloat(String(a.price_display || "").replace(/[^0-9.]/g, ""))) || Infinity);
        const pb = Number((b.price ?? parseFloat(String(b.price_display || "").replace(/[^0-9.]/g, ""))) || Infinity);
        return pa - pb;
      }
      if (sortBy === "price_desc") {
        const pa = Number((a.price ?? parseFloat(String(a.price_display || "").replace(/[^0-9.]/g, ""))) || -Infinity);
        const pb = Number((b.price ?? parseFloat(String(b.price_display || "").replace(/[^0-9.]/g, ""))) || -Infinity);
        return pb - pa;
      }
      if (sortBy === "name_asc") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return 0;
    };

    out.sort(cmp);
    return out;
  }

  const localDisplayed = applyFilterSort(localResults);
  const onlineDisplayed = applyFilterSort(onlineResults);

  function handleApplyFilters() {
    setAppliedMinSim(Number(minSim));
    setStatus(`Filters applied: minSim = ${Number(minSim)}`);
  }

  function handleRevertMinSim() {
    setMinSim(appliedMinSim);
    setStatus("Reverted to applied value");
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-6 hero">
          <div ref={heroRef} className="hero-inner">
            <h1 className="text-4xl lg:text-5xl font-extrabold" style={{ color: "var(--ink)" }}>Visual Product Matcher</h1>
            <p className="mt-2 text-gray-600">Find visually similar products from your local index and online marketplaces.</p>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6">
          {/* Upload area */}
          <section className="card p-6">
            <UploadArea onSearch={handleSearch} loading={loadingLocal || loadingOnline} />
          </section>

          {/* Controls card (Search options + Min similarity + Category inside this same card) */}
          <section className="card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Search options & filters</h3>
                <div className="text-sm text-gray-500">Top K, include online results, minimum similarity and category filter.</div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Top K</label>
                <input id="topk" defaultValue={10} type="number" className="num-input" />

                <label className="flex items-center gap-2 text-sm text-gray-600 ml-4">
                  <input id="includeOnline" type="checkbox" defaultChecked className="h-4 w-4" />
                  Include online results
                </label>
              </div>
            </div>

            {/* Category and Min similarity controls placed inside this card */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full rounded-md border-gray-200 p-2 mt-2">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Minimum similarity</label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={minSim}
                    onChange={(e) => setMinSim(Number(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={minSim}
                    onChange={(e) => setMinSim(Number(e.target.value))}
                    className="num-input"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              <button onClick={handleApplyFilters} className="px-3 py-2 bg-[var(--accent)] text-white rounded-md">Apply filters</button>
              <button onClick={handleRevertMinSim} className="px-3 py-2 border rounded-md">Revert</button>
            </div>

            <div className="text-xs text-gray-500 mt-2">Active min similarity: {appliedMinSim}</div>
          </section>

          {/* Status card below Controls */}
          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-2">Status</h3>
            <div className="text-sm text-gray-700">{status || "Ready"}</div>
          </section>

          {/* Results layout */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Local results</h2>
                    <div className="text-sm text-gray-500">{localResults.length} results</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">Sort</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-md border-gray-200 p-2">
                      <option value="score_desc">Similarity (best)</option>
                      <option value="price_asc">Price (low → high)</option>
                      <option value="price_desc">Price (high → low)</option>
                      <option value="name_asc">Name A → Z</option>
                      <option value="name_desc">Name Z → A</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {loadingLocal ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`sk-${i}`} className="card p-3 rounded-2xl">
                        <div className="skeleton h-36 mb-3" />
                        <div className="skeleton h-4 w-3/4 mb-2" />
                        <div className="skeleton h-3 w-1/2" />
                      </div>
                    ))
                  ) : localDisplayed.length === 0 ? (
                    <div className="col-span-full"><EmptyState title="No local matches" subtitle="Try a different image, lower the minimum similarity, or include online results." /></div>
                  ) : (
                    localDisplayed.map((r, i) => <ResultCard key={`l-${i}`} item={r} />)
                  )}
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Online results</h2>
                    <div className="text-sm text-gray-500">{onlineResults.length} results</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {loadingOnline ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`osk-${i}`} className="card p-3 rounded-2xl">
                        <div className="skeleton h-36 mb-3" />
                        <div className="skeleton h-4 w-3/4 mb-2" />
                        <div className="skeleton h-3 w-1/2" />
                      </div>
                    ))
                  ) : onlineDisplayed.length === 0 ? (
                    <div className="col-span-full"><EmptyState title="No online results yet" subtitle="Try enabling 'Include online results' or check your provider credentials." /></div>
                  ) : (
                    onlineDisplayed.map((r, i) => <ResultCard key={`o-${i}`} item={r} />)
                  )}
                </div>
              </div>
            </div>

            {/* Right column with quick helpers */}
            {/* <aside className="space-y-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-2">Quick helpers</h3>
                <div className="text-sm text-gray-600">You can also change sorting or the active category from the search options above.</div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-2">Status</h3>
                <div className="text-sm text-gray-700">{status || "Ready"}</div>
                {(loadingLocal || loadingOnline) && <div className="mt-3"><Loader text="Searching…" /></div>}
              </div>
            </aside> */}
          </section>

        </main>

        {/* About (dark high-contrast) */}
        <footer className="mt-8">
          <section className="about-dark mt-8">
            <h3 className="text-2xl font-semibold mb-3">About Visual Product Matcher</h3>
            <p style={{ color: "#dbeef0" }} className="mb-2">
              Visual Product Matcher is a demonstration application built to find visually similar products using an image.
              It converts images into embeddings using a CLIP-like model (via SentenceTransformers) and performs nearest-neighbor search with FAISS
              for local inventory comparisons. Optionally, it can query marketplace APIs (e.g., eBay) to expand results to online listings.
            </p>

            <p style={{ color: "#c7e6ea" }} className="mb-2">
              Use cases: reverse image shopping, catalog matching, duplicate detection, or helping users locate products from photos.
              Results include similarity scores and — when provided by the data source — price, seller, and a direct link.
            </p>

            <p style={{ color: "#bfe3e8" }} className="text-sm">
              Note: for online searches you must configure provider credentials. For production readiness, add caching, pagination,
              rate-limit handling, and multiple-provider aggregation to improve coverage and performance.
            </p>
          </section>
        </footer>
      </div>
    </div>
  );
}
