import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { legalContent } from "@/content/legal";

type LegalLocationState = {
  returnTo?: string;
};

/** A paragraph with "[label](href)" links: app paths open in the app, mailto: opens the mail client. */
function renderParagraph(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, label, href] = match;
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      href.startsWith("/") ? (
        <Link key={at} to={href} className="text-primary underline-offset-2 hover:underline">{label}</Link>
      ) : (
        <a key={at} href={href} dir="ltr" className="text-primary underline-offset-2 hover:underline">{label}</a>
      ),
    );
    last = at + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

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
        <ArrowRight className="w-4 h-4 ltr:rotate-180" aria-hidden />
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
            <section key={section.title} id={section.id} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-relaxed text-sm">
                  {renderParagraph(paragraph)}
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
