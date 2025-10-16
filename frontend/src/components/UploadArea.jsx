import React, { useRef, useState, useEffect } from "react";

export default function UploadArea({ onSearch, loading }) {
  const fileRef = useRef();
  const urlRef = useRef();
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onFiles(files) {
    const f = files && files[0];
    if (!f) { setPreview(null); setFileName(""); return; }
    if (!f.type.startsWith("image/")) { alert("Please upload an image file."); return; }
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setFileName(f.name);
    if (urlRef.current) urlRef.current.value = "";
  }

  function handleFileChange(e) { onFiles(e.target.files); }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) onFiles(e.dataTransfer.files);
  }
  function handleDragOver(e) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave() { setDragOver(false); }

  function handleUrlInput(e) {
    const v = e.target.value.trim();
    if (!v) { setPreview(null); setFileName(""); return; }
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(v);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSearch() {
    const file = fileRef.current?.files?.[0];
    const url = urlRef.current?.value?.trim();
    if (!file && !url && !preview) { alert("Upload a file or paste an image URL"); return; }
    await onSearch({ file, url });
  }

  const canSearch = !loading && ( (fileRef.current && fileRef.current.files && fileRef.current.files.length>0) || (urlRef.current && urlRef.current.value && urlRef.current.value.trim() !== "") || preview );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`drop-area ${dragOver ? 'drag' : ''}`}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
      >
        <div className="text-center">
          <svg className="mx-auto mb-2" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={getComputedStyle(document.documentElement).getPropertyValue('--accent') || "#0ea5a4"} strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="17"/></svg>
          <div className="text-lg font-medium" style={{color: "var(--ink)"}}>Drop an image here or click to upload</div>
          <div className="text-sm text-gray-500 mt-1">PNG, JPG, or GIF — up to 10 MB</div>
          <input ref={fileRef} onChange={handleFileChange} type="file" accept="image/*" className="hidden" />
        </div>
      </div>

      <div className="text-center text-sm text-gray-400">OR</div>

      <div>
        <input ref={urlRef} onChange={handleUrlInput} type="url" placeholder="Paste image URL here (https://...)" className="w-full rounded-md border border-gray-200 p-3 shadow-sm" />
      </div>

      <div>
        <div className="preview-h w-full rounded-lg overflow-hidden bg-panel card">
          {preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400">No preview yet</div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSearch}
          disabled={!canSearch}
          className={`px-5 py-3 rounded-xl font-medium shadow-sm ${canSearch ? "bg-accent text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          style={{ background: canSearch ? "var(--accent)" : undefined }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
    </div>
  );
}
