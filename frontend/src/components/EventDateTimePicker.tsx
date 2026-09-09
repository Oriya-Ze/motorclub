import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface EventScheduleValue {
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const ITEM_H = 36;
const WHEEL_PAD = ITEM_H * 2;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function minutesOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

function bumpEndTime(startHour: number, startMinute: number): Pick<EventScheduleValue, "endHour" | "endMinute"> {
  const endMinutes = minutesOfDay(startHour, startMinute) + 120;
  return { endHour: Math.floor((endMinutes % (24 * 60)) / 60), endMinute: endMinutes % 60 };
}

function endsNextDay(value: Pick<EventScheduleValue, "startHour" | "startMinute" | "endHour" | "endMinute">) {
  return minutesOfDay(value.endHour, value.endMinute) <= minutesOfDay(value.startHour, value.startMinute);
}

export function defaultEventSchedule(): EventScheduleValue {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
  if (now.getMinutes() >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  }
  const end = bumpEndTime(now.getHours(), now.getMinutes());
  return {
    date: toYmd(now),
    startHour: now.getHours(),
    startMinute: now.getMinutes(),
    ...end,
  };
}

export function scheduleToIso(value: EventScheduleValue): { event_date: string; event_end_date: string } {
  const [y, m, d] = value.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, value.startHour, value.startMinute, 0, 0);
  const endDay = endsNextDay(value) ? d + 1 : d;
  const end = new Date(y, m - 1, endDay, value.endHour, value.endMinute, 0, 0);
  return { event_date: start.toISOString(), event_end_date: end.toISOString() };
}

export function isScheduleValid(value: EventScheduleValue): boolean {
  if (!value.date) return false;
  const { event_date, event_end_date } = scheduleToIso(value);
  const start = new Date(event_date);
  const end = new Date(event_end_date);
  if (end <= start) return false;
  return start > new Date();
}

function ScrollWheel({
  items,
  value,
  onChange,
  format,
}: {
  items: readonly number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number>();

  useEffect(() => {
    const idx = items.indexOf(value);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * ITEM_H;
    }
  }, [value, items]);

  const snapToNearest = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    ref.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    if (items[clamped] !== value) onChange(items[clamped]);
  };

  return (
    <div className="relative h-[160px] w-14 shrink-0">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-lg border border-primary/25 bg-primary/10" />
      <div
        ref={ref}
        className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth scrollbar-hide"
        style={{ paddingTop: WHEEL_PAD, paddingBottom: WHEEL_PAD }}
        onScroll={() => {
          window.clearTimeout(scrollTimer.current);
          scrollTimer.current = window.setTimeout(snapToNearest, 80);
        }}
        onTouchEnd={snapToNearest}
        onMouseUp={snapToNearest}
      >
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={cn(
              "flex h-9 w-full snap-center items-center justify-center text-sm tabular-nums transition-colors",
              value === item ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {format(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeWheels({
  hour,
  minute,
  onHour,
  onMinute,
}: {
  hour: number;
  minute: number;
  onHour: (v: number) => void;
  onMinute: (v: number) => void;
}) {
  return (
    <div dir="ltr" className="flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/50 py-1">
      <ScrollWheel items={HOURS} value={hour} onChange={onHour} format={pad2} />
      <span className="text-lg font-semibold text-muted-foreground">:</span>
      <ScrollWheel items={MINUTES} value={minute} onChange={onMinute} format={pad2} />
    </div>
  );
}

function TimeRangeWheels({
  startHour,
  startMinute,
  endHour,
  endMinute,
  onStartHour,
  onStartMinute,
  onEndHour,
  onEndMinute,
}: {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  onStartHour: (v: number) => void;
  onStartMinute: (v: number) => void;
  onEndHour: (v: number) => void;
  onEndMinute: (v: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("eventForm.startTime")}</p>
        <TimeWheels hour={startHour} minute={startMinute} onHour={onStartHour} onMinute={onStartMinute} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("eventForm.endTime")}</p>
        <TimeWheels hour={endHour} minute={endMinute} onHour={onEndHour} onMinute={onEndMinute} />
        {endsNextDay({ startHour, startMinute, endHour, endMinute }) && (
          <p className="text-[11px] text-muted-foreground text-center mt-1.5">{t("eventForm.endsNextDay")}</p>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({
  value,
  onChange,
  locale,
}: {
  value: string;
  onChange: (ymd: string) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    if (!value) return;
    const d = new Date(`${value}T12:00:00`);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  const todayYmd = toYmd(new Date());
  const monthLabel = viewMonth.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  });

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", { weekday: "short" });
    const start = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }, [locale]);

  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ ymd: string; day: number } | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ ymd: toYmd(new Date(year, month, day)), day });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
          aria-label={t("eventForm.prevMonth")}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
          aria-label={t("eventForm.nextMonth")}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-[10px] font-medium text-muted-foreground py-1">
            {label.replace(".", "")}
          </div>
        ))}
        {weeks.flat().map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-8" />;
          const isPast = cell.ymd < todayYmd;
          const isSelected = cell.ymd === value;
          const isToday = cell.ymd === todayYmd;
          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={isPast}
              onClick={() => onChange(cell.ymd)}
              className={cn(
                "h-8 rounded-lg text-sm transition-colors",
                isPast && "opacity-30 cursor-not-allowed",
                isSelected && "bg-primary text-primary-foreground font-semibold",
                !isSelected && !isPast && "hover:bg-muted/60",
                isToday && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatScheduleSummary(value: EventScheduleValue, locale: string, pickDateLabel: string, nextDayLabel: string) {
  if (!value.date) return pickDateLabel;
  const dateStr = new Date(`${value.date}T12:00:00`).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const overnight = endsNextDay(value) ? ` ${nextDayLabel}` : "";
  return `${dateStr} · ${pad2(value.startHour)}:${pad2(value.startMinute)}–${pad2(value.endHour)}:${pad2(value.endMinute)}${overnight}`;
}

interface EventScheduleFieldProps {
  value: EventScheduleValue;
  onChange: (value: EventScheduleValue) => void;
}

export default function EventScheduleField({ value, onChange }: EventScheduleFieldProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("he") ? "he" : "en";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const updateDraft = (patch: Partial<EventScheduleValue>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleConfirm = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("eventForm.fieldDate")}</label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-12 w-full items-center gap-2 rounded-xl border border-input bg-background/50 px-4 text-sm",
            "hover:bg-muted/40 transition-colors text-start",
            !value.date && "text-muted-foreground"
          )}
        >
          <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatScheduleSummary(value, locale, t("eventForm.pickDateTime"), t("eventForm.nextDayShort"))}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm max-h-[min(88vh,560px)] overflow-y-auto rounded-2xl border border-border bg-card shadow-glow">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-card/95 px-4 py-3 backdrop-blur">
              <h3 className="text-sm font-semibold">{t("eventForm.pickDateTime")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("cancel")}
              </button>
            </div>

            <div className="p-4 space-y-4">
              <MiniCalendar value={draft.date} locale={locale} onChange={(date) => updateDraft({ date })} />
              <TimeRangeWheels
                startHour={draft.startHour}
                startMinute={draft.startMinute}
                endHour={draft.endHour}
                endMinute={draft.endMinute}
                onStartHour={(startHour) => updateDraft({ startHour })}
                onStartMinute={(startMinute) => updateDraft({ startMinute })}
                onEndHour={(endHour) => updateDraft({ endHour })}
                onEndMinute={(endMinute) => updateDraft({ endMinute })}
              />
              <Button type="button" className="w-full" onClick={handleConfirm} disabled={!draft.date || !isScheduleValid(draft)}>
                {t("eventForm.confirmSchedule")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Backward-compatible exports for any legacy imports
export type EventDateTimeValue = EventScheduleValue;
export const defaultEventDateTime = defaultEventSchedule;
export function eventDateTimeToIso(value: EventScheduleValue): string {
  return scheduleToIso(value).event_date;
}
