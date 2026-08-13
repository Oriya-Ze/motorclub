import { useTranslation } from "react-i18next";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === "he" ? "en" : "he";
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";
  };

  return (
    <button
      type="button"
      onClick={toggleLang}
      className={`text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted transition-colors ${className}`}
      aria-label={i18n.language === "he" ? "Switch to English" : "עבור לעברית"}
    >
      {i18n.language === "he" ? "EN" : "עב"}
    </button>
  );
}
