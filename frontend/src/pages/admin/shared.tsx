import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function AdminSection({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display tracking-wide">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("rounded-2xl border border-border bg-card p-4", className)}>{children}</article>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function AdminLoading() {
  return <p className="p-8 text-center text-sm text-muted-foreground" role="status">טוען…</p>;
}

export function FilterTabs<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-sm",
            value === option.value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A button that asks for a reason before acting. Every admin action is logged with its reason.
 * `confirmText`, when given, must also be typed exactly (for irreversible actions).
 */
export function ReasonAction({
  label,
  onSubmit,
  variant = "outline",
  placeholder = "סיבה (נשמרת ביומן)",
  confirmText,
  confirmLabel,
  disabled,
}: {
  label: string;
  onSubmit: (reason: string) => Promise<unknown>;
  variant?: "default" | "outline" | "destructive" | "ghost";
  placeholder?: string;
  confirmText?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const confirmId = useId();

  if (!open) {
    return (
      <Button type="button" size="sm" variant={variant} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  const ready = reason.trim().length > 0 && (!confirmText || typed.trim().replace(/^@/, "").toLowerCase() === confirmText.toLowerCase());
  return (
    <form
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:w-auto sm:min-w-72"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        try {
          await onSubmit(reason.trim());
          setOpen(false);
          setReason("");
          setTyped("");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "הפעולה נכשלה");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-medium" htmlFor={reasonId}>{label}: {placeholder}</label>
      <input
        id={reasonId}
        autoFocus
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
      />
      {confirmText && (
        <>
          <label className="text-xs font-medium" htmlFor={confirmId}>{confirmLabel ?? `הקלידו ${confirmText} לאישור`}</label>
          <input
            id={confirmId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            dir="ltr"
            autoComplete="off"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          />
        </>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={variant === "outline" ? "default" : variant} disabled={!ready || busy}>
          {busy ? "שומר…" : "אישור"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export const REPORT_REASONS: Record<string, string> = {
  spam: "ספאם",
  harassment: "הטרדה",
  sexual_or_violence: "תוכן מיני או אלימות",
  impersonation: "התחזות",
  fraud: "חשד להונאה",
  irrelevant: "תוכן לא רלוונטי",
};

export const TARGET_LABELS: Record<string, string> = {
  post: "פוסט",
  product: "מוצר",
  profile: "פרופיל",
  story: "סטורי",
  vehicle: "רכב",
  message: "הודעה פרטית",
  group: "קבוצה",
  event: "אירוע",
  media: "מדיה",
};

export function appLink(type: string, id: string): string | null {
  switch (type) {
    case "post":
      return `/posts/${id}`;
    case "product":
      return `/marketplace?product=${id}`;
    case "profile":
      return `/profile/${id}`;
    case "story":
      return `/stories/${id}`;
    case "vehicle":
      return `/vehicles/${id}`;
    case "group":
      return `/groups/${id}`;
    default:
      return null;
  }
}
