import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useBootSettled } from "@/lib/bootGate";
import { applyTheme, type Theme } from "@/lib/theme";

export default function ThemeSync() {
  const { user } = useAuth();
  // The theme is already applied from this device's last visit (index.html); the server copy can wait.
  const bootSettled = useBootSettled();
  // Shares the settings query that the app prefetches, so the theme does not cost a request of its own.
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: Boolean(user) && bootSettled,
  });

  useEffect(() => {
    if (settings) applyTheme(settings.theme as Theme);
  }, [settings]);

  return null;
}
