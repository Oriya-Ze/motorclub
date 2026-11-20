import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pause, Play, Trash2, Upload, Zap } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api, type BotQueueRow } from "@/lib/api";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, formatDateTime } from "@/pages/admin/shared";

const DELETE_CONFIRMATION = "מחק בוטים";

/** Shrink a photo in the browser before sending it: the API takes a few megabytes per request at most. */
async function shrinkPhoto(file: File, side = 2048): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3_000_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

function QueueList({ rows, empty }: { rows: BotQueueRow[]; empty: string }) {
  if (!rows.length) return <AdminEmpty>{empty}</AdminEmpty>;
  return (
    <ol className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1 p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span dir="ltr">@{row.username}</span>
            <span>·</span>
            <span dir="ltr">{row.key}</span>
            {row.published_at && (
              <>
                <span>·</span>
                <span>{formatDateTime(row.published_at)}</span>
              </>
            )}
            {!row.published_at && row.expires_at && (
              <>
                <span>·</span>
                <span>עד {formatDateTime(row.expires_at)}</span>
              </>
            )}
            {row.post_id && (
              <a href={`/posts/${row.post_id}`} target="_blank" rel="noopener" className="text-primary hover:underline">
                לפוסט
              </a>
            )}
            {row.images ? (
              <>
                <span>·</span>
                <span>
                  {row.images} תמונות
                  {row.missing_images?.length ? ` (חסרות: ${row.missing_images.join(", ")})` : ""}
                </span>
              </>
            ) : null}
          </p>
          <p className="line-clamp-2" dir="auto">{row.text}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Content bots (system admins only). The content file (personas, posts and replies) is uploaded here; it is not in
 * the repository. A scheduled tick publishes it gradually while the bots are on.
 */
export default function AdminBots() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);
  const confirmId = useId();
  const [confirm, setConfirm] = useState("");
  const status = useQuery({ queryKey: ["admin-bots"], queryFn: () => api.getBots(), refetchInterval: 60_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-bots"] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      let content: unknown;
      try {
        content = JSON.parse(await file.text());
      } catch {
        throw new Error("הקובץ אינו JSON תקין");
      }
      return api.uploadBotContent(content);
    },
    onSuccess: (res) => {
      toast.success(`נטען: ${res.bots} בוטים (${res.bots_created} חדשים), ${res.queued} פריטים חדשים בתור, ${res.updated} עודכנו`);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const uploadImages = useMutation({
    mutationFn: async (files: File[]) => {
      const done: string[] = [];
      const failed: string[] = [];
      for (const file of files) {
        try {
          await api.uploadBotImage(await shrinkPhoto(file), file.name);
          done.push(file.name);
        } catch (err) {
          failed.push(`${file.name}: ${err instanceof Error ? err.message : "שגיאה"}`);
        }
      }
      return { done, failed };
    },
    onSuccess: ({ done, failed }) => {
      if (done.length) toast.success(`הועלו ${done.length} תמונות`);
      if (failed.length) toast.error(`לא הועלו: ${failed.join(" · ")}`, { duration: 10_000 });
      refresh();
    },
    onSettled: () => {
      if (imagesRef.current) imagesRef.current.value = "";
    },
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.setBotsEnabled(enabled),
    onSuccess: (res) => {
      toast.success(res.enabled ? "הבוטים פעילים" : "הבוטים מושהים");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishNow = useMutation({
    mutationFn: () => api.runBotTick(true),
    onSuccess: (res) => {
      toast.success(res.post ? `פורסם ${res.post}` : "אין פוסטים בתור");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAll = useMutation({
    mutationFn: () => api.deleteAllBots(confirm),
    onSuccess: (res) => {
      toast.success(`נמחקו ${res.bots} בוטים עם כל התוכן שלהם`);
      setConfirm("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = status.data;
  return (
    <AdminSection
      title="בוטים"
      description="חשבונות שמפרסמים תוכן מוכן מראש ונותנים לייקים, כדי שתהיה פעילות בהתחלה. הם לא שולחים הודעות, לא מגיבים לחברים ולא מעלים מוצרים או עסקים."
    >
      {status.isLoading ? (
        <AdminLoading />
      ) : !data ? (
        <AdminEmpty>לא ניתן לטעון את מצב הבוטים.</AdminEmpty>
      ) : (
        <div className="space-y-4">
          <AdminCard className="space-y-3 p-4">
            <p className="text-sm" role="status">
              מצב: <strong>{data.enabled ? "פעילים" : "מושהים"}</strong>
              {" · "}פוסטים {data.posts.published}/{data.posts.total}
              {data.posts.expired > 0 && ` (${data.posts.expired} פג תוקפם ולא יעלו)`}
              {" · "}תגובות {data.replies.published}/{data.replies.total}
            </p>
            {data.missing_images.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                ממתינות לתמונות ({data.missing_images.length}): <span dir="ltr">{data.missing_images.join(", ")}</span>. פוסט עם תמונות יוצא רק אחרי שכולן הועלו, ובינתיים יוצאים הפוסטים הבאים. שם הקובץ צריך להיות זהה לשם בקובץ התוכן.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              כשהם פעילים: בדיקה כל חצי שעה בין 08:00 ל־23:00, כ־2–3 פוסטים ביום, תגובות לפי ההשהיה שבקובץ, ולייקים על פוסטים ציבוריים מהימים האחרונים (עד 3 מבוטים לפוסט).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={data.enabled ? "outline" : "default"} disabled={toggle.isPending} onClick={() => toggle.mutate(!data.enabled)}>
                {data.enabled ? <Pause className="me-1 h-4 w-4" aria-hidden /> : <Play className="me-1 h-4 w-4" aria-hidden />}
                {data.enabled ? "השהיה" : "הפעלה"}
              </Button>
              <Button size="sm" variant="outline" disabled={publishNow.isPending || data.posts.published >= data.posts.total} onClick={() => publishNow.mutate()}>
                <Zap className="me-1 h-4 w-4" aria-hidden />
                פרסם את הפוסט הבא עכשיו
              </Button>
              <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                <Upload className="me-1 h-4 w-4" aria-hidden />
                {upload.isPending ? "טוען…" : "העלאת קובץ תוכן"}
              </Button>
              <Button size="sm" variant="outline" disabled={uploadImages.isPending} onClick={() => imagesRef.current?.click()}>
                <ImagePlus className="me-1 h-4 w-4" aria-hidden />
                {uploadImages.isPending ? "מעלה תמונות…" : "העלאת תמונות"}
              </Button>
              <input
                ref={imagesRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="תמונות לבוטים"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) uploadImages.mutate(files);
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="קובץ תוכן בוטים (JSON)"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
            </div>
          </AdminCard>

          <AdminCard className="p-4">
            <h3 className="mb-2 text-sm font-semibold">בוטים ({data.bots.length})</h3>
            {data.bots.length === 0 ? (
              <AdminEmpty>עדיין אין בוטים. העלו קובץ תוכן כדי ליצור אותם.</AdminEmpty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start font-medium">שם</th>
                      <th className="p-2 text-start font-medium">משתמש</th>
                      <th className="p-2 text-start font-medium">פוסטים</th>
                      <th className="p-2 text-start font-medium">תגובות</th>
                      <th className="p-2 text-start font-medium">לייקים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bots.map((bot) => (
                      <tr key={bot.id} className="border-t border-border">
                        <td className="p-2">{bot.full_name}</td>
                        <td className="p-2" dir="ltr">@{bot.username}</td>
                        <td className="p-2">{bot.posts}</td>
                        <td className="p-2">{bot.replies}</td>
                        <td className="p-2">{bot.likes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard className="p-4">
              <h3 className="mb-2 text-sm font-semibold">הבאים בתור</h3>
              <QueueList rows={data.upcoming} empty="אין פוסטים בתור." />
            </AdminCard>
            <AdminCard className="p-4">
              <h3 className="mb-2 text-sm font-semibold">פורסמו לאחרונה</h3>
              <QueueList rows={data.recent} empty="עדיין לא פורסם כלום." />
            </AdminCard>
          </div>

          {data.bots.length > 0 && (
            <AdminCard className="space-y-2 border-destructive/40 p-4">
              <h3 className="text-sm font-semibold text-destructive">מחיקת כל הבוטים</h3>
              <p className="text-xs text-muted-foreground">
                מוחק את כל חשבונות הבוטים עם הפוסטים, התגובות והלייקים שלהם, וההתראות שהם יצרו לחברים. אי אפשר לבטל.
              </p>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (confirm.trim() === DELETE_CONFIRMATION && !removeAll.isPending) removeAll.mutate();
                }}
              >
                <div className="space-y-1">
                  <label htmlFor={confirmId} className="text-xs font-medium">הקלידו «{DELETE_CONFIRMATION}» לאישור</label>
                  <input
                    id={confirmId}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="off"
                    className="h-9 w-48 rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <Button type="submit" size="sm" variant="destructive" disabled={confirm.trim() !== DELETE_CONFIRMATION || removeAll.isPending}>
                  <Trash2 className="me-1 h-4 w-4" aria-hidden />
                  מחיקה
                </Button>
              </form>
            </AdminCard>
          )}
        </div>
      )}
    </AdminSection>
  );
}
