// src/pages/RestaurantLangs.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { useT } from "../i18n/useT";

import {
  fetchRestaurantLangs,
  updateRestaurantLangs,
  type RestaurantLangs,
} from "../services/restaurantI18n";

import { fetchUiLangs, saveUiLangs, type UiLangsDTO } from "../services/uiLangs";

type LangItem = { code: string; label: string };

// ✅ само за label-и (не лимитира системата)
const BASE: LangItem[] = [
  { code: "bg", label: "Български" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "tr", label: "Türkçe" },
];

const norm = (v: any) => String(v ?? "").trim().toLowerCase();
const normList = (arr: any): string[] =>
  (Array.isArray(arr) ? arr : []).map((x) => norm(x)).filter(Boolean);

const uniq = (arr: string[]) => Array.from(new Set(arr));

const labelOf = (code: string) => {
  const c = norm(code);
  const hit = BASE.find((x) => x.code === c);
  return hit ? hit.label : c.toUpperCase();
};

export default function RestaurantLangsPage() {
  const { msg } = useT();
  const { slug } = useParams<{ slug: string }>();
  const { isAdmin } = useAuth();

  if (!slug) return null;

  // only superadmin
  if (!isAdmin) {
    return <Navigate to={`/admin/r/${slug}/categories`} replace />;
  }

  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [savingUi, setSavingUi] = useState(false);

  // content
  const [langs, setLangs] = useState<string[]>([]);
  const [defaultLang, setDefaultLang] = useState<string>("bg");

  // ui
  const [uiLangs, setUiLangs] = useState<string[]>([]);
  const [uiDefaultLang, setUiDefaultLang] = useState<string>("bg");

  // catalog for checkboxes
  const [catalog, setCatalog] = useState<LangItem[]>(BASE);

  // add code
  const [newCode, setNewCode] = useState("");

  const availableDefaultOptions = useMemo(() => {
    const set = new Set(langs);
    return catalog.filter((x) => set.has(x.code));
  }, [langs, catalog]);

  const availableUiDefaultOptions = useMemo(() => {
    const set = new Set(uiLangs);
    return catalog.filter((x) => set.has(x.code));
  }, [uiLangs, catalog]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const [contentRes, uiRes] = await Promise.all([
          fetchRestaurantLangs(slug),
          fetchUiLangs(slug),
        ]);

        if (!mounted) return;

        // content normalize
        const currentContent = normList(contentRes?.langs);
        const safeContentLangs = currentContent.length ? currentContent : ["bg"];

        const contentDef = norm(contentRes?.default_lang || safeContentLangs[0] || "bg");
        const safeContentDef = safeContentLangs.includes(contentDef)
          ? contentDef
          : safeContentLangs[0];

        setLangs(safeContentLangs);
        setDefaultLang(safeContentDef);

        // ui normalize
        const currentUi = normList(uiRes?.ui_langs);
        const safeUiLangs = currentUi.length ? currentUi : ["bg"];

        const uiDef = norm(uiRes?.ui_default_lang || safeUiLangs[0] || "bg");
        const safeUiDef = safeUiLangs.includes(uiDef) ? uiDef : safeUiLangs[0];

        setUiLangs(safeUiLangs);
        setUiDefaultLang(safeUiDef);

        // catalog: BASE + saved langs (ако има ru ще се появи)
        const allCodes = uniq([
          ...BASE.map((x) => x.code),
          ...safeContentLangs,
          ...safeUiLangs,
        ]).sort();

        setCatalog(allCodes.map((c) => ({ code: c, label: labelOf(c) })));
      } catch {
        toast.error(msg("admin.langs.load_failed", { defaultValue: "Failed to load languages" }));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]); // важно: НЕ добавяй msg

  // add new language code into catalog (UI only; to persist you tick it and Save)
  const onAddLanguage = () => {
    const c = norm(newCode);

    if (!/^[a-z]{2,8}$/.test(c)) {
      toast.error(
        msg("admin.langs.add_invalid", { defaultValue: "Invalid language code (example: ru)" })
      );
      return;
    }

    setCatalog((prev) => {
      if (prev.some((x) => x.code === c)) return prev;
      const next = [...prev, { code: c, label: labelOf(c) }];
      next.sort((a, b) => a.code.localeCompare(b.code));
      return next;
    });

    setNewCode("");
    toast.success(
      msg("admin.langs.added", { defaultValue: "Added. Now tick it below and click Save." })
    );
  };

  // optional: remove code from catalog (only if it’s not used in content/ui)
  const removeFromCatalog = (code: string) => {
    const c = norm(code);
    if (BASE.some((x) => x.code === c)) return; // базовите не ги махаме
    if (langs.includes(c) || uiLangs.includes(c)) {
      toast.error(
        msg("admin.langs.remove_used", { defaultValue: "Uncheck the language first, then remove." })
      );
      return;
    }
    setCatalog((prev) => prev.filter((x) => x.code !== c));
  };

  const toggleContent = (code: string) => {
    const c = norm(code);
    setLangs((prev) => {
      const has = prev.includes(c);
      if (has && prev.length === 1) return prev;

      const next = has ? prev.filter((x) => x !== c) : [...prev, c];
      if (!next.includes(defaultLang)) setDefaultLang(next[0] ?? "bg");
      return next;
    });
  };

  const toggleUi = (code: string) => {
    const c = norm(code);
    setUiLangs((prev) => {
      const has = prev.includes(c);
      if (has && prev.length === 1) return prev;

      const next = has ? prev.filter((x) => x !== c) : [...prev, c];
      if (!next.includes(uiDefaultLang)) setUiDefaultLang(next[0] ?? "bg");
      return next;
    });
  };

  const onSaveContent = async () => {
    if (!langs.length) {
      toast.error(msg("admin.langs.errors.pick_one", { defaultValue: "Pick at least 1 language" }));
      return;
    }
    if (!langs.includes(defaultLang)) {
      toast.error(
        msg("admin.langs.errors.default_must_be_selected", {
          defaultValue: "Default language must be selected in the list",
        })
      );
      return;
    }

    const payload: RestaurantLangs = { default_lang: defaultLang, langs };

    try {
      setSavingContent(true);
      await toast.promise(updateRestaurantLangs(slug, payload), {
        loading: msg("admin.langs.toasts.saving", { defaultValue: "Saving..." }),
        success: msg("admin.langs.toasts.saved", { defaultValue: "Saved" }),
        error: msg("admin.langs.toasts.save_error", { defaultValue: "Save error" }),
      });
    } finally {
      setSavingContent(false);
    }
  };

  const onSaveUi = async () => {
    if (!uiLangs.length) {
      toast.error(msg("admin.langs.errors.pick_one", { defaultValue: "Pick at least 1 language" }));
      return;
    }
    if (!uiLangs.includes(uiDefaultLang)) {
      toast.error(
        msg("admin.langs.errors.default_must_be_selected", {
          defaultValue: "Default language must be selected in the list",
        })
      );
      return;
    }

    const payload: UiLangsDTO = { ui_default_lang: uiDefaultLang, ui_langs: uiLangs };

    try {
      setSavingUi(true);
      await toast.promise(saveUiLangs(slug, payload), {
        loading: msg("admin.langs.toasts.saving", { defaultValue: "Saving..." }),
        success: msg("admin.langs.toasts.saved", { defaultValue: "Saved" }),
        error: msg("admin.langs.toasts.save_error", { defaultValue: "Save error" }),
      });
    } finally {
      setSavingUi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {msg("admin.langs.title", { defaultValue: "Languages" })}
        </h2>
      </div>

      {/* add language code */}
      <div className="border rounded bg-white p-4">
        <div className="text-sm font-medium mb-2">
          {msg("admin.langs.add_title", { defaultValue: "Add language code" })}
        </div>
        <div className="flex items-center gap-2 max-w-md">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="ru"
            className="border rounded p-2 w-full"
            disabled={loading || savingContent || savingUi}
          />
          <button
            type="button"
            onClick={onAddLanguage}
            disabled={loading || savingContent || savingUi}
            className={[
              "px-4 py-2 rounded text-white bg-black",
              loading || savingContent || savingUi ? "opacity-60 cursor-not-allowed" : "hover:bg-black/90",
            ].join(" ")}
          >
            {msg("admin.common.add", { defaultValue: "Add" })}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {msg("admin.langs.add_hint", {
            defaultValue: "Example: ru. After adding, tick it below and click Save.",
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="border rounded bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold">
            {msg("admin.langs.content_header", { defaultValue: "Menu content languages" })}
          </div>

          <button
            type="button"
            onClick={onSaveContent}
            disabled={loading || savingContent}
            className={[
              "px-4 py-2 rounded text-white bg-black",
              loading || savingContent ? "opacity-60 cursor-not-allowed" : "hover:bg-black/90",
            ].join(" ")}
          >
            {msg("admin.common.save", { defaultValue: "Save" })}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">
            {msg("admin.common.loading", { defaultValue: "Loading..." })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catalog.map((l) => {
                const removable = !BASE.some((b) => b.code === l.code);
                return (
                  <label key={l.code} className="flex items-center gap-2 border rounded p-2">
                    <input
                      type="checkbox"
                      checked={langs.includes(l.code)}
                      onChange={() => toggleContent(l.code)}
                      disabled={savingContent || (langs.includes(l.code) && langs.length === 1)}
                    />
                    <span>{l.label}</span>
                    <span className="ml-auto text-xs text-gray-500">{l.code}</span>

                    {removable && (
                      <button
                        type="button"
                        onClick={() => removeFromCatalog(l.code)}
                        className="ml-2 text-xs px-2 py-1 rounded border hover:bg-gray-50"
                        disabled={savingContent || savingUi}
                      >
                        {msg("admin.common.remove", { defaultValue: "Remove" })}
                      </button>
                    )}
                  </label>
                );
              })}
            </div>

            <select
              className="border rounded p-2 w-full max-w-sm"
              value={defaultLang}
              onChange={(e) => setDefaultLang(norm(e.target.value))}
              disabled={!langs.length || savingContent || !availableDefaultOptions.length}
            >
              {availableDefaultOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label} ({o.code})
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* UI */}
      <div className="border rounded bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-base font-semibold">
            {msg("admin.langs.ui_header", { defaultValue: "Admin UI languages" })}
          </div>

          <button
            type="button"
            onClick={onSaveUi}
            disabled={loading || savingUi}
            className={[
              "px-4 py-2 rounded text-white bg-black",
              loading || savingUi ? "opacity-60 cursor-not-allowed" : "hover:bg-black/90",
            ].join(" ")}
          >
            {msg("admin.common.save", { defaultValue: "Save" })}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">
            {msg("admin.common.loading", { defaultValue: "Loading..." })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catalog.map((l) => (
                <label key={l.code} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={uiLangs.includes(l.code)}
                    onChange={() => toggleUi(l.code)}
                    disabled={savingUi || (uiLangs.includes(l.code) && uiLangs.length === 1)}
                  />
                  <span>{l.label}</span>
                  <span className="ml-auto text-xs text-gray-500">{l.code}</span>
                </label>
              ))}
            </div>

            <select
              className="border rounded p-2 w-full max-w-sm"
              value={uiDefaultLang}
              onChange={(e) => setUiDefaultLang(norm(e.target.value))}
              disabled={!uiLangs.length || savingUi || !availableUiDefaultOptions.length}
            >
              {availableUiDefaultOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label} ({o.code})
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
