// src/pages/NotFound.tsx
import { useNavigate, useLocation } from "react-router-dom";

export default function NotFound() {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-8 text-center">
        <div className="text-6xl mb-3">🛰️</div>
        <h1 className="text-2xl font-semibold">The page was not found</h1>
        <p className="text-gray-600 mt-2 break-all">
          not have url <code className="bg-gray-100 px-1.5 py-0.5 rounded">{loc.pathname}</code>
        </p>

        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => nav(-1)}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
