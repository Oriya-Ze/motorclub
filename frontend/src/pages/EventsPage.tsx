import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import CreateEventModal from "@/components/CreateEventModal";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { eventHasEnded } from "@/lib/formatLabels";

function formatEventWhen(start: string, end?: string | null, nextDayLabel = "(+1)") {
  const startDate = new Date(start);
  const datePart = startDate.toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const startTime = startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (!end) return `${datePart}, ${startTime}`;
  const endDate = new Date(end);
  const endTime = endDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const overnight =
    endDate.toDateString() !== startDate.toDateString() ? ` ${nextDayLabel}` : "";
  return `${datePart}, ${startTime}–${endTime}${overnight}`;
}

export default function EventsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const isBusiness = user?.account_type === "business";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents(),
  });

  const { upcoming, past } = useMemo(() => {
    const upcomingEvents: typeof events = [];
    const pastEvents: typeof events = [];
    for (const event of events) {
      if (eventHasEnded(event.event_date, event.event_end_date)) pastEvents.push(event);
      else upcomingEvents.push(event);
    }
    pastEvents.sort(
      (a, b) => new Date(b.event_end_date || b.event_date).getTime() - new Date(a.event_end_date || a.event_date).getTime(),
    );
    return { upcoming: upcomingEvents, past: pastEvents };
  }, [events]);

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

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("eventDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  const renderEvent = (event: (typeof events)[number], ended: boolean) => {
    const isCreator = user?.id === event.creator_id;
    return (
      <Card key={event.id}>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
              {t(`eventTypes.${event.event_type as "meetup"}`)}
            </span>
            <div className="flex items-center gap-2">
              {isCreator && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("confirmDeleteEvent"))) deleteEvent.mutate(event.id);
                  }}
                  disabled={deleteEvent.isPending}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={t("deleteEvent")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {t("participantsCount", { count: event.participants_count })}
                {event.max_participants && ` / ${event.max_participants}`}
              </span>
            </div>
          </div>
          <h3 className="font-semibold text-lg">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatEventWhen(event.event_date, event.event_end_date, t("eventForm.nextDayShort"))}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {event.location}
              </span>
            )}
          </div>
          {ended ? (
            <p className="text-sm text-muted-foreground">{t("eventEnded")}</p>
          ) : event.is_joined ? (
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading subtitle={t("eventsSubtitle")}>{t("events")}</PageHeading>
        {isBusiness && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            {t("eventForm.createButton")}
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{t("noEvents")}</p>
          {isBusiness && (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              {t("eventForm.createButton")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t("upcomingEvents")}</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noUpcomingEvents")}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((event) => renderEvent(event, false))}
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{t("pastEvents")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((event) => renderEvent(event, true))}
              </div>
            </section>
          )}
        </>
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["events"] })}
      />
    </div>
  );
}
