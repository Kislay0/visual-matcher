export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 animate-spin border-4 border-amber-200 border-t-amber-600 rounded-full" />
      <div className="text-sm text-gray-600">{text}</div>
    </div>
  );
}
