export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The page you requested is not available in this workspace.
        </p>
      </div>
    </main>
  );
}
