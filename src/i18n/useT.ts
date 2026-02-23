import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export function useT() {
  const { t } = useTranslation();

  const msg = useCallback(
    (key: string, vars?: Record<string, any>) => t(key, vars) as string,
    [t]
  );

  return { t, msg };
}
