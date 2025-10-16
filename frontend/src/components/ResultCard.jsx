import React from "react";

function SourceBadge({ source }) {
  if (!source) return null;
  const color = source === "local" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{source}</span>;
}

export default function ResultCard({ item }) {
  // price_display fallback
  const priceLabel = item?.price_display || (item?.price ? String(item.price) : null);
  const sellerDomain = item?.seller_domain || null;
  const favUrl = sellerDomain ? `https://www.google.com/s2/favicons?domain=${sellerDomain}` : null;

  return (
    <div className="result-card card p-3 rounded-2xl">
      <div className="flex flex-col h-full">
        <div className="h-44 rounded-lg overflow-hidden bg-gray-50">
          <img src={item.thumb || item.image} alt={item.name || "product"} className="result-img w-full h-full" />
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800">{item.name || "Unknown product"}</h3>
              {priceLabel ? (
                <div className="price-pill">{priceLabel}</div>
              ) : null}
            </div>

            <div className="mt-2 seller-row">
              {favUrl && <img className="seller-fav" src={favUrl} alt="" />}
              <div>
                {item.seller ? <span className="text-xs text-gray-600">{item.seller}</span> : null}
                {sellerDomain ? <span className="text-xs text-gray-500 ml-1"> {sellerDomain}</span> : null}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold">{(item.score ?? 0).toFixed(3)}</div>
            <div className="mt-2">
              <SourceBadge source={item.source} />
            </div>
            {item.web_link && <a className="block text-xs text-amber-600 mt-2" href={item.web_link} target="_blank" rel="noreferrer">View</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
