import { useEffect, useState } from "react";
import { api, type UsernameCheckResult } from "@/lib/api";
import { validateUsername } from "@/lib/authValidation";

export type UsernameCheckStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved" | "error";

export function useDebouncedUsernameCheck(username: string, enabled: boolean, debounceMs = 450) {
  const [status, setStatus] = useState<UsernameCheckStatus>("idle");
  const [normalized, setNormalized] = useState<string>("");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setNormalized("");
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("idle");
      setNormalized("");
      return;
    }

    const formatError = validateUsername(trimmed);
    if (formatError) {
      setStatus(formatError === "authValidation.usernameReserved" ? "reserved" : "invalid");
      setNormalized(trimmed);
      return;
    }

    setStatus("checking");
    const timer = window.setTimeout(() => {
      void api
        .checkUsername(trimmed)
        .then((result: UsernameCheckResult) => {
          setNormalized(result.username);
          if (!result.valid) {
            setStatus(result.reason === "reserved" ? "reserved" : "invalid");
            return;
          }
          setStatus(result.available ? "available" : "taken");
        })
        .catch(() => {
          setStatus("error");
        });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [username, enabled, debounceMs]);

  return { status, normalized };
}
