import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/Card";

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const { t } = useTranslation();
  const title = type === "privacy" ? t("privacyPolicy") : t("termsOfService");

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardContent className="pt-6 prose prose-invert max-w-none">
          <h1 className="text-2xl font-bold mb-4">{title}</h1>
          <p className="text-muted-foreground">
            {type === "privacy"
              ? "מדיניות פרטיות של MotorClub IL — גרסה מקומית לפיתוח."
              : "תנאי שימוש של MotorClub IL — גרסה מקומית לפיתוח."}
          </p>
          <p className="text-muted-foreground mt-4">
            השימוש באפליקציה מהווה הסכמה לתנאים. גיל מינימלי: 16+. דין: מדינת ישראל.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
