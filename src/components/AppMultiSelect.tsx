// src/components/AppMultiSelect.tsx
import { Fragment, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function AppMultiSelect<T extends string | number>(props: {
  value: T[]; // ✅ multi
  onChange: (v: T[]) => void; // ✅ multi
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;

  // UX helpers
  maxButtonLabels?: number; // колко етикета да показва в бутона, после "... +N"
}) {
  const {
    value,
    onChange,
    options,
    placeholder,
    disabled,
    className,
    buttonClassName,
    maxButtonLabels = 2,
  } = props;

  const selectedSet = useMemo(
  () => new Set((value ?? []).map((x) => String(x))),
  [value]
);

const selectedOptions = useMemo(
  () => options.filter((o) => selectedSet.has(String(o.value))),
  [options, selectedSet]
);


  const buttonText = useMemo(() => {
    if (!selectedOptions.length) return placeholder ?? "Select…";

    const labels = selectedOptions.map((o) => o.label);
    if (labels.length <= maxButtonLabels) return labels.join(", ");

    const head = labels.slice(0, maxButtonLabels).join(", ");
    const rest = labels.length - maxButtonLabels;
    return `${head} +${rest}`;
  }, [selectedOptions, placeholder, maxButtonLabels]);

  return (
    <div className={cx("relative w-full min-w-0", className)}>
      <Listbox
        value={value as any}
        onChange={(v: any) => onChange((v ?? []) as T[])}
        multiple
        disabled={disabled}
      >
        <Listbox.Button
          className={cx(
            "w-full min-w-0 h-11",
            "border border-gray-200 rounded-lg bg-white",
            "px-3 text-left text-sm",
            "flex items-center justify-between gap-3",
            "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30",
            disabled && "opacity-60 cursor-not-allowed",
            buttonClassName
          )}
        >
          <span className={cx("min-w-0 truncate", !selectedOptions.length && "text-gray-400")}>
            {buttonText}
          </span>
          <span className="shrink-0 text-gray-500">▾</span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className={cx(
              "absolute z-[60] mt-1 w-full",
              "rounded-lg border border-gray-200 bg-white shadow-lg",
              "max-h-60 overflow-auto focus:outline-none"
            )}
          >
            {options.map((o) => (
              <Listbox.Option
                key={String(o.value)}
                value={o.value as any}
                disabled={o.disabled}
                as={Fragment}
              >
                {({ active, selected, disabled }) => (
                  <li
                    className={cx(
                      // ✅ items-start + min-w-0 за да не бута checkbox-а при 2 реда текст
                      "px-3 py-2 select-none text-sm",
                      "flex items-start justify-between gap-3",
                      active && "bg-gray-100",
                      disabled && "opacity-50 cursor-not-allowed",
                      !disabled && "cursor-pointer"
                    )}
                  >
                    {/* ✅ текстът може да се свива/трунква без да влияе на квадратчето */}
                    <span className={cx("min-w-0 flex-1 block truncate", selected && "font-semibold")}>
                      {o.label}
                    </span>

                    {/* ✅ checkbox вдясно (FIXED SIZE, never shrink) */}
                    <span
                      className={cx(
                        "shrink-0",
                        "w-5 h-5 min-w-[20px] min-h-[20px]",
                        "inline-flex items-center justify-center",
                        "rounded border",
                        selected ? "bg-black border-black" : "bg-white border-gray-300"
                      )}
                      aria-hidden="true"
                    >
                      {selected ? (
                        <span className="text-white text-[12px] leading-none">✓</span>
                      ) : null}
                    </span>
                  </li>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  );
}
