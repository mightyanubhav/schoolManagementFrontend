export default function Pagination({ page, total, limit, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-slate-500">Page {page} of {pageCount} · {total} records</span>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <button type="button" className="btn-ghost" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
