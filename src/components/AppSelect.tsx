// src/components/AppSelect.tsx
import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function AppSelect<T extends string | number>(props: {
  value: T | null;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const { value, onChange, options, placeholder, disabled, className, buttonClassName } = props;

  const selected = options.find((o) => o.value === value) || null;

  return (
    <div className={cx("relative w-full min-w-0", className)}>
      <Listbox value={(value ?? ("" as any)) as any} onChange={onChange} disabled={disabled}>
        <Listbox.Button
          className={cx(
            // ✅ make it behave like a normal input
            "w-full min-w-0 h-11",
            "border border-gray-200 rounded-lg bg-white",
            "px-3 text-left text-sm",
            "flex items-center justify-between gap-3",
            "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30",
            disabled && "opacity-60 cursor-not-allowed",
            buttonClassName
          )}
        >
          <span className={cx("min-w-0 truncate", !selected && "text-gray-400")}>
            {selected?.label ?? placeholder ?? "Select…"}
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
              <Listbox.Option key={String(o.value)} value={o.value} disabled={o.disabled} as={Fragment}>
                {({ active, selected, disabled }) => (
                  <li
                    className={cx(
                      "px-3 py-2 cursor-pointer select-none text-sm",
                      active && "bg-gray-100",
                      selected && "font-semibold",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="block truncate">{o.label}</span>
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