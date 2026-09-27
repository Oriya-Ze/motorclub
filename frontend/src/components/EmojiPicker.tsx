import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😴", "😢", "😡", "🤯", "🥳", "😅", "😉",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "❤️", "💯",
  "🚗", "🏎️", "🏍️", "🛻", "🚙", "🔧", "⛽", "🏁",
  "🛣️", "🏔️", "☀️", "🌧️", "⭐", "✨", "🎉", "✅",
];

export function insertEmoji(
  input: HTMLInputElement | null,
  value: string,
  emoji: string,
  setValue: (next: string) => void,
) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + emoji + value.slice(end);
  setValue(next);
  const cursor = start + emoji.length;
  requestAnimationFrame(() => {
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  });
}

export default function EmojiPicker({
  onPick,
  disabled,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={t("emojiPicker")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Smile className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute bottom-12 end-0 z-50 w-64 rounded-2xl border border-border bg-card p-2 shadow-lg">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="h-8 rounded-lg text-lg leading-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onPick(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
