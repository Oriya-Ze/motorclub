import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/Card";
import { legalContent } from "@/content/legal";

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "he";
  const doc = legalContent[lang][type];
  const title = type === "privacy" ? t("privacyPolicy") : t("termsOfService");

  return (
    <div className="max-w-3xl mx-auto pb-8">
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
        </CardContent>
      </Card>
    </div>
  );
}
