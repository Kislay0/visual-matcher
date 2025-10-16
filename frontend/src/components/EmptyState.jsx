import React from "react";

export default function EmptyState({ title = "No results", subtitle = "Try a different image, lower the minimum similarity, or include online results." }) {
  return (
    <div className="empty-state card rounded-2xl">
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/></svg>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="text-sm text-gray-500 text-center max-w-md">{subtitle}</div>
    </div>
  );
}
