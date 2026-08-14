import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function EventsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents(),
  });

  const joinEvent = useMutation({
    mutationFn: (id: string) => api.joinEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("joinEvent"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leaveEvent = useMutation({
    mutationFn: (id: string) => api.leaveEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("leftEvent"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("events")}</h1>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{t("noEvents")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                    {t(`eventTypes.${event.event_type as "meetup"}`)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {event.participants_count}
                    {event.max_participants && ` / ${event.max_participants}`}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">{event.title}</h3>
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(event.event_date).toLocaleDateString("he-IL", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> {event.location}
                    </span>
                  )}
                </div>
                {event.is_joined ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => leaveEvent.mutate(event.id)}
                    disabled={leaveEvent.isPending}
                  >
                    {t("leaveEvent")}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => joinEvent.mutate(event.id)} disabled={joinEvent.isPending}>
                    {t("joinEvent")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
