import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import EventScheduleField, {
  defaultEventSchedule,
  isScheduleValid,
  scheduleToIso,
  type EventScheduleValue,
} from "@/components/EventDateTimePicker";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const EVENT_TYPES = ["meetup", "workshop", "exhibition", "trip", "race", "training"] as const;

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateEventModal({ open, onClose, onCreated }: CreateEventModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>("meetup");
  const [location, setLocation] = useState("");
  const [schedule, setSchedule] = useState<EventScheduleValue>(defaultEventSchedule);
  const [maxParticipants, setMaxParticipants] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setLocation(user.business_address ?? "");
    setSchedule(defaultEventSchedule());
  }, [open, user]);

  const createEvent = useMutation({
    mutationFn: () => {
      const { event_date, event_end_date } = scheduleToIso(schedule);
      return api.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        event_type: eventType,
        location: location.trim() || undefined,
        event_date,
        event_end_date,
        max_participants: maxParticipants ? Number(maxParticipants) : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t("eventForm.createSuccess"));
      setTitle("");
      setDescription("");
      setEventType("meetup");
      setLocation("");
      setSchedule(defaultEventSchedule());
      setMaxParticipants("");
      onCreated();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  const valid = title.trim().length >= 2 && schedule.date.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-glow">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/95 backdrop-blur">
          <h2 className="text-lg font-bold">{t("eventForm.createTitle")}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            if (!isScheduleValid(schedule)) {
              toast.error(t("eventForm.invalidSchedule"));
              return;
            }
            createEvent.mutate();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("eventForm.fieldTitle")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("eventForm.fieldTitlePlaceholder")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("eventForm.fieldType")}</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors",
                    eventType === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {t(`eventTypes.${type}`)}
                </button>
              ))}
            </div>
          </div>

          <EventScheduleField value={schedule} onChange={setSchedule} />

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("eventForm.fieldLocation")}</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("eventForm.fieldLocationPlaceholder")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("eventForm.fieldMaxParticipants")}</label>
            <Input
              type="number"
              min="1"
              step="1"
              dir="ltr"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder={t("eventForm.fieldMaxParticipantsPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("eventForm.fieldDescription")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={t("eventForm.fieldDescriptionPlaceholder")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!valid || createEvent.isPending}>
            {createEvent.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("eventForm.creating")}
              </>
            ) : (
              t("eventForm.createSubmit")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
