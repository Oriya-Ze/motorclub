import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { applyTheme, type Theme } from "@/lib/theme";

export default function ThemeSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    api.getSettings()
      .then((settings) => applyTheme(settings.theme as Theme))
      .catch(() => {});
  }, [user]);

  return null;
}
