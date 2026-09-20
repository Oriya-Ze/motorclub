import { useQuery } from "@tanstack/react-query";
import { Calendar, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function FeedSidebar() {
  const { t, i18n } = useTranslation();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents(),
    staleTime: 120_000,
  });

  const { data: hashtags = [] } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => api.trendingHashtags(),
    staleTime: 120_000,
  });

  const upcoming = events
    .filter((e) => new Date(e.event_date) > new Date())
    .slice(0, 3);

  return (
    <aside className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-28 self-start">
      {upcoming.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="w-4 h-4 text-primary" />
              {t("events")}
            </div>
            <ul className="space-y-2">
              {upcoming.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="font-medium line-clamp-1">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.event_date).toLocaleDateString(i18n.language === "he" ? "he-IL" : "en-US", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {event.location && ` · ${event.location}`}
                  </p>
                </li>
              ))}
            </ul>
            <Link to="/events">
              <Button variant="outline" size="sm" className="w-full">{t("events")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {hashtags.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Hash className="w-4 h-4 text-primary" />
              {t("trendingHashtags")}
            </div>
            <div className="flex flex-wrap gap-2">
              {hashtags.slice(0, 6).map((h) => (
                <Link
                  key={h.tag}
                  to={`/explore?tag=${h.tag}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  #{h.tag}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </aside>
  );
}
