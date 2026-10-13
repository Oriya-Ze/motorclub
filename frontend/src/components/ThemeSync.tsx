import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { applyTheme, type Theme } from "@/lib/theme";

export default function ThemeSync() {
  const { user } = useAuth();
  // Shares the settings query that the app prefetches, so the theme does not cost a request of its own.
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (settings) applyTheme(settings.theme as Theme);
  }, [settings]);

  return null;
}
