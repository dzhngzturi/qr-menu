// src/components/ProfileModal.tsx
import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { createPortal } from "react-dom";

type Form = {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
};

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<Form>({
    defaultValues: { name: user?.name, email: user?.email }
  });

  const ui = (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 p-4">
      {/* ВАЖНО: даваме собствен клас и налагаме цвета локално */}
      <form
        onSubmit={handleSubmit(async (v) => {
          setSaving(true);
          try { await updateProfile(v); onClose(); }
          finally { setSaving(false); }
        })}
        className="profile-modal-box w-full max-w-md rounded-xl bg-white p-5 space-y-3"
      >
        <div className="text-lg font-semibold">Редакция на профил</div>

        <div>
          <label className="block text-sm mb-1">Име</label>
          <input className="w-full border rounded p-2" {...register("name")} />
        </div>
        <div>
          <label className="block text-sm mb-1">Имейл</label>
          <input className="w-full border rounded p-2" type="email" {...register("email")} />
        </div>

        <div className="pt-2 text-sm font-medium">Промяна на парола (по избор)</div>
        <div>
          <label className="block text-sm mb-1">Нова парола</label>
          <input className="w-full border rounded p-2" type="password" {...register("password")} />
        </div>
        <div>
          <label className="block text-sm mb-1">Потвърди парола</label>
          <input className="w-full border rounded p-2" type="password" {...register("password_confirmation")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5">Откажи</button>
          <button disabled={saving} className="rounded bg-black text-white px-3 py-1.5">
            {saving ? "Запис..." : "Запази"}
          </button>
        </div>
      </form>

      {/* Локален стил с висока специфичност, за да „убие“ наследения бял цвят */}
      <style>{`
        .profile-modal-box, 
        .profile-modal-box * {
          color: #111 !important;
        }
        .profile-modal-box .text-white { color: #111 !important; }
      `}</style>
    </div>
  );

  return createPortal(ui, document.body);
}
