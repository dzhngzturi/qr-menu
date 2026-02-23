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
    defaultValues: { name: user?.name, email: user?.email },
  });

  const ui = (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 p-4">
      <form
        id="profile-modal-form"
        onSubmit={handleSubmit(async (v) => {
          setSaving(true);
          try {
            await updateProfile(v);
            onClose();
          } finally {
            setSaving(false);
          }
        })}
        className="w-full max-w-md rounded-xl bg-white p-5 space-y-3"
      >
        <div className="text-lg font-semibold">Редакция на профил</div>

        <div>
          <label className="block text-sm mb-1" htmlFor="profile-name">
            Име
          </label>
          <input
            id="profile-name"
            className="w-full border rounded p-2"
            autoComplete="name"
            disabled={saving}
            {...register("name")}
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="profile-email">
            Имейл
          </label>
          <input
            id="profile-email"
            className="w-full border rounded p-2"
            type="email"
            autoComplete="email"
            disabled={saving}
            {...register("email")}
          />
        </div>

        <div className="pt-2 text-sm font-medium">
          Промяна на парола (по избор)
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="profile-password">
            Нова парола
          </label>
          <input
            id="profile-password"
            className="w-full border rounded p-2"
            type="password"
            autoComplete="new-password"
            disabled={saving}
            {...register("password")}
          />
        </div>

        <div>
          <label
            className="block text-sm mb-1"
            htmlFor="profile-password-confirmation"
          >
            Потвърди парола
          </label>
          <input
            id="profile-password-confirmation"
            className="w-full border rounded p-2"
            type="password"
            autoComplete="new-password"
            disabled={saving}
            {...register("password_confirmation")}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-3 py-1.5 hover:bg-gray-50"
            disabled={saving}
          >
            Откажи
          </button>

          <button
            disabled={saving}
            className={[
              "rounded bg-black text-white px-3 py-1.5",
              saving ? "opacity-60 cursor-not-allowed" : "hover:bg-black/90",
            ].join(" ")}
          >
            {saving ? "Запис..." : "Запази"}
          </button>
        </div>
      </form>
    </div>
  );

  return createPortal(ui, document.body);
}
