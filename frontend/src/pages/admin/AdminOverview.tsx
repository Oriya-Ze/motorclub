import { Link } from "react-router-dom";
import type { AdminOverview } from "@/lib/adminTypes";
import { AdminLoading, AdminSection } from "@/pages/admin/shared";

const CARDS: Array<{ key: keyof AdminOverview; label: string; to: string; urgent?: boolean }> = [
  { key: "pending_business_requests", label: "בקשות עסק ממתינות", to: "/admin/business", urgent: true },
  { key: "open_reports", label: "דיווחים פתוחים", to: "/admin/reports", urgent: true },
  { key: "videos_to_review", label: "סרטונים לבדיקה", to: "/admin/media?tab=video", urgent: true },
  { key: "images_to_review", label: "תמונות לבדיקה ידנית", to: "/admin/media?tab=image", urgent: true },
  { key: "stuck_media", label: "סריקות תקועות", to: "/admin/media?tab=stuck", urgent: true },
  { key: "open_appeals", label: "ערעורים פתוחים", to: "/admin/appeals", urgent: true },
  { key: "members", label: "חברים רשומים", to: "/admin/accounts" },
  { key: "new_members", label: "הצטרפו השבוע", to: "/admin/accounts" },
  { key: "new_reports", label: "דיווחים השבוע", to: "/admin/reports" },
];

export default function AdminOverviewPage({ overview }: { overview?: AdminOverview }) {
  return (
    <AdminSection title="סקירה" description="מה מחכה לטיפול עכשיו. המספרים מתעדכנים כל דקה.">
      {!overview ? (
        <AdminLoading />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CARDS.map((card) => {
            const value = overview[card.key] as number;
            const needsAction = card.urgent && value > 0;
            return (
              <Link
                key={card.key}
                to={card.to}
                className={`rounded-2xl border p-4 transition-colors hover:bg-muted/50 ${needsAction ? "border-primary/60 bg-primary/10" : "border-border bg-card"}`}
              >
                <p className="text-3xl font-display tracking-wide">{value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {needsAction && <p className="mt-1 text-xs font-medium text-primary">דורש טיפול</p>}
              </Link>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
