import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearAuthDraft,
  loadAuthDraft,
  saveAuthDraft,
  type AuthFormDraft,
} from "@/lib/authValidation";

const DEFAULT_FORM: AuthFormDraft = {
  mode: "login",
  email: "",
  password: "",
  full_name: "",
  username: "",
  code: "",
  agree: false,
};

function mergeDraft(partial: AuthFormDraft | null): AuthFormDraft {
  if (!partial) return DEFAULT_FORM;
  return { ...DEFAULT_FORM, ...partial };
}

export function useAuthFormDraft() {
  const [form, setFormState] = useState<AuthFormDraft>(() => mergeDraft(loadAuthDraft()));
  const [mode, setModeState] = useState<AuthFormDraft["mode"]>(() => form.mode);
  const formRef = useRef(form);
  const modeRef = useRef(mode);

  formRef.current = form;
  modeRef.current = mode;

  const persist = useCallback((nextForm: AuthFormDraft, nextMode: AuthFormDraft["mode"]) => {
    saveAuthDraft({ ...nextForm, mode: nextMode });
  }, []);

  const restoreFromStorage = useCallback(() => {
    const draft = loadAuthDraft();
    if (!draft) return;
    const merged = mergeDraft(draft);
    setFormState(merged);
    setModeState(merged.mode);
  }, []);

  const setForm = useCallback(
    (patch: Partial<AuthFormDraft>) => {
      setFormState((current) => {
        const next = { ...current, ...patch };
        persist(next, modeRef.current);
        return next;
      });
    },
    [persist],
  );

  const setMode = useCallback(
    (nextMode: AuthFormDraft["mode"]) => {
      setModeState(nextMode);
      setFormState((current) => {
        const next = { ...current, mode: nextMode };
        persist(next, nextMode);
        return next;
      });
    },
    [persist],
  );

  const resetDraft = useCallback(() => {
    clearAuthDraft();
    setFormState(DEFAULT_FORM);
    setModeState("login");
  }, []);

  useEffect(() => {
    const onPageHide = () => {
      persist(formRef.current, modeRef.current);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restoreFromStorage();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [persist, restoreFromStorage]);

  return { form, mode, setMode, setForm, resetDraft, restoreFromStorage };
}
