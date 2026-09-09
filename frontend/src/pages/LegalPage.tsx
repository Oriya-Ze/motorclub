import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { legalContent } from "@/content/legal";

type LegalLocationState = {
  returnTo?: string;
};

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const lang = i18n.language === "en" ? "en" : "he";
  const doc = legalContent[lang][type];
  const title = type === "privacy" ? t("privacyPolicy") : t("termsOfService");
  const returnTo = (location.state as LegalLocationState | null)?.returnTo ?? "/auth";

  return (
    <div className="max-w-3xl mx-auto pb-8 px-4 pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-4 gap-2"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
            return;
          }
          navigate(returnTo);
        }}
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        {t("backToAuth")}
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {lang === "he" ? "עודכן לאחרונה:" : "Last updated:"} {doc.lastUpdated}
            </p>
          </div>

          <p className="text-muted-foreground leading-relaxed">{doc.intro}</p>

          {doc.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-relaxed text-sm">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <div className="pt-2">
            <Link to={returnTo} className="text-sm text-primary hover:underline">
              {t("backToAuth")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
