import { applyAppLanguage, type AppLanguage } from "@/i18n";
import { useTranslation } from "react-i18next";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const next: AppLanguage = i18n.language === "he" ? "en" : "he";
    applyAppLanguage(next);
    void i18n.changeLanguage(next);
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
