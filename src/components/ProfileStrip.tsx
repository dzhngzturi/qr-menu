// src/components/ProfileStrip.tsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ProfileModal from "./ProfileModal";

export default function ProfileStrip() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="mb-4 rounded-lg border bg-white p-4 flex items-center justify-between">
      <div>
        <div className="text-sm text-neutral-500">Профил</div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-neutral-600">{user.email}</div>
      </div>
      <button onClick={() => setOpen(true)} className="rounded bg-black text-white text-sm px-3 py-1.5">
        Редакция
      </button>

      {open && <ProfileModal onClose={() => setOpen(false)} />}
    </div>
  );
}
