export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

type LegalContent = {
  privacy: LegalDocument;
  terms: LegalDocument;
};

export const legalContent: Record<"he" | "en", LegalContent> = {
  he: {
    privacy: {
      lastUpdated: "10 באוגוסט 2026",
      intro:
        "MotorClub IL (\"האפליקציה\", \"אנחנו\") מכבדת את פרטיות המשתמשים. מדיניות זו מסבירה אילו נתונים אנו אוספים, כיצד אנו משתמשים בהם, ומהן זכויותיך.",
      sections: [
        {
          title: "איזה מידע אנו אוספים",
          paragraphs: [
            "פרטי חשבון: שם, שם משתמש, כתובת דוא\"ל, סיסמה (נשמרת באופן מוצפן דרך Amazon Cognito).",
            "תוכן שאתה מפרסם: פוסטים, תמונות, סטוריז, הודעות, תגובות, מיקום (אם הוזן), ופרטי רכב במוסך.",
            "נתוני שימוש: לוגים טכניים, סוג מכשיר, ופעילות באפליקציה לצורך אבטחה, תמיכה ושיפור השירות.",
          ],
        },
        {
          title: "כיצד אנו משתמשים במידע",
          paragraphs: [
            "להפעלת החשבון והצגת התוכן בקהילה.",
            "לשליחת הודעות מערכת (אימות חשבון, איפוס סיסמה) מכתובת accounts@motorclub.co.il.",
            "לשמירה על אבטחה, מניעת שימוש לרעה, וטיפול בתקלות.",
            "לשיפור חוויית המשתמש ופיתוח פיצ'רים חדשים.",
          ],
        },
        {
          title: "שיתוף מידע עם צדדים שלישיים",
          paragraphs: [
            "אנו משתמשים בתשתיות ענן (AWS, Neon) לצורך אחסון, אימות והגשת השירות.",
            "לא נמכור את המידע האישי שלך לצדדים שלישיים.",
            "ייתכן שנחשוף מידע אם נידרש לפי דין, צו בית משפט, או לצורך הגנה על זכויותינו ומשתמשינו.",
          ],
        },
        {
          title: "אחסון ואבטחה",
          paragraphs: [
            "הנתונים מאוחסנים בשרתים מאובטחים. אנו נוקטים באמצעי הגנה סבירים, אך אין אבטחה מוחלטת ברשת.",
            "תוכן שפרסמת בקהילה עשוי להישאר גלוי למשתמשים אחרים בהתאם להגדרות הפרופיל והפלטפורמה.",
          ],
        },
        {
          title: "עוגיות ואחסון מקומי",
          paragraphs: [
            "האפליקציה עשויה לשמור טוקן התחברות ומידע מקומי (localStorage/sessionStorage) לצורך שמירת מצב ההתחברות והעדפות.",
          ],
        },
        {
          title: "זכויותיך",
          paragraphs: [
            "בכפוף לדין, באפשרותך לבקש גישה, תיקון או מחיקה של המידע האישי שלך.",
            "ניתן לפנות אלינו בדוא\"ל: privacy@motorclub.co.il",
          ],
        },
        {
          title: "עדכונים למדיניות",
          paragraphs: [
            "ייתכן שנעדכן מדיניות זו מעת לעת. תאריך העדכון האחרון מופיע בראש העמוד.",
          ],
        },
      ],
    },
    terms: {
      lastUpdated: "10 באוגוסט 2026",
      intro:
        "ברוכים הבאים ל-MotorClub IL. השימוש באפליקציה כפוף לתנאים אלה. אם אינך מסכים/ה — אל תשתמש/י בשירות.",
      sections: [
        {
          title: "כשירות לשימוש",
          paragraphs: [
            "השירות מיועד למשתמשים בני 16 ומעלה.",
            "עליך לספק פרטים נכונים בעת ההרשמה ולשמור על סודיות פרטי ההתחברות.",
          ],
        },
        {
          title: "התנהגות משתמשים",
          paragraphs: [
            "אסור לפרסם תוכן בלתי חוקי, מטעה, פוגעני, מאיים, או המפר זכויות צד שלישי.",
            "אסור להטריד משתמשים, לבצע ספאם, או לנסות לפרוץ את המערכת.",
            "אנו רשאים להסיר תוכן או לחסום חשבונות שמפרים תנאים אלה.",
          ],
        },
        {
          title: "תוכן משתמשים",
          paragraphs: [
            "הבעלות על התוכן שאתה מפרסם נשארת שלך.",
            "בפרסום תוכן, אתה מעניק לנו רישיון לא בלעדי להציג, לאחסן ולהפיץ את התוכן במסגרת השירות.",
            "אתה אחראי/ת לכל תוכן שאתה מפרסם, כולל תמונות וטקסט.",
          ],
        },
        {
          title: "קניין רוחני",
          paragraphs: [
            "הלוגו, העיצוב והקוד של MotorClub IL שייכים לבעלי הפלטפורמה.",
            "אין להעתיק, לשכפל או לעשות שימוש מסחרי בתוכן הפלטפורמה ללא אישור.",
          ],
        },
        {
          title: "הגבלת אחריות",
          paragraphs: [
            "השירות ניתן \"כפי שהוא\" (AS IS). איננו מתחייבים לזמינות רציפה או לתוכן שמפרסמים משתמשים.",
            "MotorClub IL לא תישא באחריות לנזקים עקיפים הנובעים מהשימוש בשירות, בכפוף לדין.",
          ],
        },
        {
          title: "סיום שימוש",
          paragraphs: [
            "באפשרותך להפסיק שימוש בכל עת. אנו רשאים להשעות או למחוק חשבון שמפר תנאים.",
          ],
        },
        {
          title: "דין וסמכות שיפוט",
          paragraphs: [
            "על תנאים אלה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית — בתי המשפט המוסמכים בישראל.",
            "לשאלות: legal@motorclub.co.il",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      lastUpdated: "August 10, 2026",
      intro:
        "MotorClub IL (\"the App\", \"we\") respects your privacy. This policy explains what data we collect, how we use it, and your rights.",
      sections: [
        {
          title: "Information we collect",
          paragraphs: [
            "Account details: name, username, email, password (stored securely via Amazon Cognito).",
            "Content you publish: posts, photos, stories, messages, comments, location (if provided), and garage vehicle details.",
            "Usage data: technical logs, device type, and in-app activity for security, support, and product improvement.",
          ],
        },
        {
          title: "How we use information",
          paragraphs: [
            "To operate your account and display community content.",
            "To send system emails (verification, password reset) from accounts@motorclub.co.il.",
            "To maintain security, prevent abuse, and troubleshoot issues.",
            "To improve user experience and develop new features.",
          ],
        },
        {
          title: "Sharing with third parties",
          paragraphs: [
            "We use cloud infrastructure (AWS, Neon) for storage, authentication, and delivery.",
            "We do not sell your personal information.",
            "We may disclose information when required by law or to protect our users and rights.",
          ],
        },
        {
          title: "Storage and security",
          paragraphs: [
            "Data is stored on secured servers. We apply reasonable safeguards, but no online service is 100% secure.",
            "Content you publish may remain visible to other users according to profile and platform settings.",
          ],
        },
        {
          title: "Cookies and local storage",
          paragraphs: [
            "The app may store login tokens and local preferences (localStorage/sessionStorage) to keep you signed in.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "Subject to applicable law, you may request access, correction, or deletion of your personal data.",
            "Contact: privacy@motorclub.co.il",
          ],
        },
        {
          title: "Policy updates",
          paragraphs: [
            "We may update this policy from time to time. The latest revision date appears at the top of this page.",
          ],
        },
      ],
    },
    terms: {
      lastUpdated: "August 10, 2026",
      intro:
        "Welcome to MotorClub IL. By using the app you agree to these terms. If you do not agree, do not use the service.",
      sections: [
        {
          title: "Eligibility",
          paragraphs: [
            "You must be at least 16 years old to use the service.",
            "You must provide accurate registration details and keep your credentials secure.",
          ],
        },
        {
          title: "User conduct",
          paragraphs: [
            "Do not post illegal, misleading, abusive, threatening, or infringing content.",
            "Do not harass users, spam, or attempt to compromise the platform.",
            "We may remove content or suspend accounts that violate these terms.",
          ],
        },
        {
          title: "User content",
          paragraphs: [
            "You retain ownership of content you publish.",
            "By posting, you grant us a non-exclusive license to host, display, and distribute it within the service.",
            "You are responsible for all content you publish, including images and text.",
          ],
        },
        {
          title: "Intellectual property",
          paragraphs: [
            "MotorClub IL branding, design, and code belong to the platform owners.",
            "Do not copy or commercially reuse platform assets without permission.",
          ],
        },
        {
          title: "Disclaimer",
          paragraphs: [
            "The service is provided \"as is\". We do not guarantee uninterrupted availability or user-generated content accuracy.",
            "MotorClub IL is not liable for indirect damages arising from use of the service, to the extent permitted by law.",
          ],
        },
        {
          title: "Termination",
          paragraphs: [
            "You may stop using the service at any time. We may suspend or delete accounts that violate these terms.",
          ],
        },
        {
          title: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of the State of Israel. Exclusive jurisdiction: competent courts in Israel.",
            "Questions: legal@motorclub.co.il",
          ],
        },
      ],
    },
  },
};
