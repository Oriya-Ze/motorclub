import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { AdminMediaItem } from "@/lib/adminTypes";
import { mediaUrl } from "@/lib/media";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, FilterTabs, ReasonAction, TARGET_LABELS, appLink, formatDateTime } from "@/pages/admin/shared";

type Tab = "video" | "image" | "stuck" | "rejected";

const TABS: Record<Tab, { decision: string; kind: "image" | "video" | "all"; help: string }> = {
  video: { decision: "needs_review", kind: "video", help: "סרטונים מתפרסמים מיד ונבדקים כאן ידנית. דחייה מורידה את הקובץ ומסירה את הפוסט." },
  image: { decision: "needs_review", kind: "image", help: "תמונות שהסריקה האוטומטית שלחה לבדיקה ידנית. אישור תמונת פוסט מפרסם את הפוסט אם שאר התמונות תקינות." },
  stuck: { decision: "stuck", kind: "all", help: "סריקות שנכשלו או לא הסתיימו. אפשר לנסות שוב, או להחליט ידנית." },
  rejected: { decision: "rejected", kind: "all", help: "קבצים שנדחו. מוצגים לתיעוד בלבד." },
};

function Preview({ item }: { item: AdminMediaItem }) {
  const p = item.preview;
  if (p.kind === "video") {
    const src = mediaUrl(p.src);
    return (
      <div className="w-full sm:w-72">
        {src ? (
          <video controls preload="none" poster={p.poster ? mediaUrl(p.poster) : undefined} src={src} className="aspect-video w-full rounded-lg bg-black" />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">אין תצוגה</div>
        )}
        {p.status !== "ready" && <p className="mt-1 text-xs text-muted-foreground">עיבוד: {p.status}</p>}
      </div>
    );
  }
  const src = p.url || (p.key ? mediaUrl(p.key) : "");
  return src ? (
    <a href={src} target="_blank" rel="noreferrer" className="block w-full sm:w-72">
      <img src={src} alt="תמונה לבדיקה" className="aspect-square w-full rounded-lg bg-muted object-contain" />
    </a>
  ) : (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:w-72">הקובץ לא זמין</div>
  );
}

export default function AdminMedia() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) in TABS ? (params.get("tab") as Tab) : "video";
  const config = TABS[tab];
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ["admin-media", tab], queryFn: () => api.getMediaScans(config.decision, config.kind) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  return (
    <AdminSection
      title="מדיה לבדיקה"
      description={config.help}
      actions={
        tab === "stuck" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const result = await api.retryMediaScans();
              toast.success(`נסרקו מחדש ${result.updated} קבצים`);
              refresh();
            }}
          >
            ניסיון חוזר לכל התקועות
          </Button>
        ) : undefined
      }
    >
      <FilterTabs
        label="סוג מדיה"
        value={tab}
        onChange={(next) => setParams({ tab: next })}
        options={[
          { value: "video", label: "סרטונים" },
          { value: "image", label: "תמונות לבדיקה" },
          { value: "stuck", label: "תקועות" },
          { value: "rejected", label: "נדחו" },
        ]}
      />
      {items.isLoading ? (
        <AdminLoading />
      ) : !items.data?.length ? (
        <AdminEmpty>אין כאן כלום כרגע.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {items.data.map((item) => (
            <AdminCard key={item.id} className="flex flex-col gap-4 sm:flex-row">
              <Preview item={item} />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">הועלה על ידי </span>
                  {item.owner ? (
                    <a className="underline" href={`/profile/${item.owner.id}`} target="_blank" rel="noreferrer">@{item.owner.username}</a>
                  ) : (
                    "לא ידוע"
                  )}
                  <span className="text-muted-foreground"> · {formatDateTime(item.created_at)}</span>
                </p>
                {item.used_in.length > 0 ? (
                  <p className="flex flex-wrap gap-2">
                    <span className="text-muted-foreground">מופיע ב:</span>
                    {item.used_in.map((ref) => {
                      const link = appLink(ref.type, ref.id);
                      const label = TARGET_LABELS[ref.type] ?? ref.type;
                      return link ? (
                        <a key={`${ref.type}-${ref.id}`} className="text-primary underline" href={link} target="_blank" rel="noreferrer">{label}</a>
                      ) : (
                        <span key={`${ref.type}-${ref.id}`}>{label}</span>
                      );
                    })}
                  </p>
                ) : (
                  <p className="text-muted-foreground">לא בשימוש באף תוכן כרגע.</p>
                )}
                {item.labels.length > 0 && (
                  <p className="text-muted-foreground">תוויות סריקה: {item.labels.map((l) => l.name).join(", ")}</p>
                )}
                {item.error_message && <p className="text-amber-500">שגיאת סריקה: {item.error_message}</p>}
                {tab !== "rejected" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ReasonAction
                      label="אישור"
                      variant="default"
                      onSubmit={async (reason) => {
                        await api.reviewMediaScan(item.id, "approved", reason);
                        toast.success("אושר");
                        refresh();
                      }}
                    />
                    <ReasonAction
                      label={item.kind === "video" ? "דחייה והסרה" : "דחייה"}
                      variant="destructive"
                      onSubmit={async (reason) => {
                        await api.reviewMediaScan(item.id, "rejected", reason);
                        toast.success("נדחה והוסר");
                        refresh();
                      }}
                    />
                  </div>
                )}
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
