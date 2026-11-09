export type LegalSection = {
  id?: string;
  title: string;
  /** Plain text; "[label](href)" becomes a link (an app path, or mailto:). */
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
      lastUpdated: "2 באוקטובר 2026",
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
            "תמונות שמועלות לאפליקציה נבדקות אוטומטית בשירות Amazon Rekognition של AWS, כדי לחסום תוכן מיני מפורש, אלימות גרפית וסמלי שנאה. עד שהבדיקה מסתיימת התמונה שמורה במקום פרטי ולא גלויה לאחרים. כשמבקשים בדיקה נוספת, איש צוות רואה את התמונה.",
            "סרטונים מתפרסמים מיד ונבדקים ידנית על ידי הצוות אחרי הפרסום. כל חבר יכול לדווח על תוכן, וצוות הניהול יכול להסיר סרטון או פוסט שמפר את הכללים.",
            "לשיפור חוויית המשתמש ופיתוח פיצ'רים חדשים.",
          ],
        },
        {
          title: "שיתוף מידע עם צדדים שלישיים",
          paragraphs: [
            "אנו משתמשים בתשתיות ענן (AWS, Neon) לצורך אחסון, אימות, בדיקת תמונות והגשת השירות, וב־Resend לשליחת מיילים.",
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
            "אפשר למחוק את החשבון בכל עת בהגדרות, בלשונית אבטחה. המחיקה כוללת את הפרופיל, הפוסטים, התגובות, הסטוריז, הרכבים, המוצרים, ההודעות והתמונות שהעלית. אפשר גם למחוק בנפרד כל פוסט, תגובה, נושא בפורום או סטורי.",
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
      lastUpdated: "9 בנובמבר 2026",
      intro:
        "ברוכים הבאים ל-MotorClub IL. השימוש באפליקציה כפוף לתנאים אלה. אם אינך מסכים/ה — אל תשתמש/י בשירות.",
      sections: [
        {
          title: "כשירות לשימוש",
          paragraphs: [
            "השירות מיועד למשתמשים בני 12 ומעלה.",
            "עליך לספק פרטים נכונים בעת ההרשמה ולשמור על סודיות פרטי ההתחברות.",
          ],
        },
        {
          id: "community-rules",
          title: "כללי הקהילה",
          paragraphs: [
            "אין לפרסם תוכן מיני, אלימות גרפית או סמלי שנאה.",
            "פרסום תכנים ושיתופם באתר ובאפליקציה, ככל שיהיו, נתונים לשיקול דעתה הבלעדי של הנהלת האתר.",
            "השימוש באתר ובאפליקציה הוא באחריות המשתמשים בלבד, והנהלת האתר לא תהיה חשופה לתביעה מכל סוג בגין שימוש לא הגון של משתמשים באתר.",
            "הנהלת האתר רשאית להשתמש בתכנים המפורסמים באתר לצרכיו העסקיים של האתר.",
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
            "בפרסום תוכן, אתה מעניק לנו רשות להציג, לאחסן ולהפיץ את התוכן במסגרת השירות.",
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
            "MotorClub IL לא תישא באחריות לנזקים ישירים או עקיפים הנובעים מהשימוש בשירות, בכפוף לדין.",
          ],
        },
        {
          title: "סיום שימוש",
          paragraphs: [
            "באפשרותך להפסיק את השימוש בכל עת ולמחוק את החשבון [בהגדרות](/settings?tab=account). הנהלת האתר רשאית להשעות או למחוק חשבון לפי שיקול דעתה.",
          ],
        },
        {
          id: "business-terms",
          title: "תנאים לעסקים",
          paragraphs: [
            "פרטי העסק שנמסרו בבקשת השדרוג ובהגדרות העסק נכונים, ומי שמגיש/ה אותם מורשה לפעול בשם העסק.",
            "האחריות למוצרים ולשירותים שהעסק מציע, למחיריהם, לאיכותם ולעמידה בדין, כולל דיני הגנת הצרכן, היא של העסק בלבד. הנהלת האתר אינה צד לעסקה בין העסק ללקוחותיו.",
            "פרטי העסק, המוצרים, השירותים והביקורות מוצגים לכל משתמשי האתר.",
            "הנהלת האתר רשאית לבדוק בקשה לפרופיל עסקי, לאשר או לדחות אותה, ולהסיר פרופיל עסקי, מוצר או שירות לפי שיקול דעתה.",
          ],
        },
        {
          title: "עדכונים לתנאי השימוש",
          paragraphs: [
            "הנהלת האתר רשאית לעדכן את תנאי השימוש, ומעדכנת אותם מעת לעת. אפשר לצפות בנוסח העדכני בכל עת בעמוד זה, ותאריך העדכון האחרון מופיע בראשו.",
          ],
        },
        {
          title: "דין וסמכות שיפוט",
          paragraphs: [
            "על תנאים אלה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית — בתי המשפט המוסמכים בישראל.",
            "לשאלות: [motorclub.co.il@gmail.com](mailto:motorclub.co.il@gmail.com)",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      lastUpdated: "October 2, 2026",
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
            "Uploaded photos are checked automatically by AWS's Amazon Rekognition to block explicit sexual content, graphic violence, and hate symbols. Until the check finishes, the photo is stored privately and is not visible to others. When you ask for another review, a staff member sees the photo.",
            "Videos are published right away and reviewed by staff afterwards. Any member can report content, and the moderation team can remove a video or post that breaks the rules.",
            "To improve user experience and develop new features.",
          ],
        },
        {
          title: "Sharing with third parties",
          paragraphs: [
            "We use cloud infrastructure (AWS, Neon) for storage, authentication, photo checks, and delivery, and Resend to send email.",
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
            "You can delete your account at any time in Settings, under Security. This deletes your profile, posts, comments, stories, vehicles, products, messages, and the photos you uploaded. You can also delete any single post, comment, forum topic, or story.",
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
      lastUpdated: "November 9, 2026",
      intro:
        "Welcome to MotorClub IL. By using the app you agree to these terms. If you do not agree, do not use the service.",
      sections: [
        {
          title: "Eligibility",
          paragraphs: [
            "You must be at least 12 years old to use the service.",
            "You must provide accurate registration details and keep your credentials secure.",
          ],
        },
        {
          id: "community-rules",
          title: "Community rules",
          paragraphs: [
            "Do not publish sexual content, graphic violence, or hate symbols.",
            "Publishing and sharing any content on the site and in the app is at the sole discretion of the site's management.",
            "Users use the site and the app at their own responsibility only, and the site's management will not be exposed to any claim of any kind arising from improper use of the site by users.",
            "The site's management may use content published on the site for the site's business purposes.",
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
            "By posting content, you grant us permission to display, host, and distribute it within the service.",
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
            "MotorClub IL is not liable for direct or indirect damages arising from use of the service, to the extent permitted by law.",
          ],
        },
        {
          title: "Termination",
          paragraphs: [
            "You may stop using the service at any time and delete your account [in Settings](/settings?tab=account). The site's management may suspend or delete an account at its discretion.",
          ],
        },
        {
          id: "business-terms",
          title: "Terms for businesses",
          paragraphs: [
            "The business details given in the upgrade request and in the business settings are accurate, and whoever submits them is authorized to act on behalf of the business.",
            "The business alone is responsible for the products and services it offers, their prices and quality, and compliance with the law, including consumer protection law. The site's management is not a party to any transaction between the business and its customers.",
            "The business details, products, services and reviews are shown to all users of the site.",
            "The site's management may review a business profile request, approve or reject it, and remove a business profile, product or service at its discretion.",
          ],
        },
        {
          title: "Changes to these terms",
          paragraphs: [
            "The site's management may update these terms, and does so from time to time. The current version can be viewed at any time on this page, and the date of the latest update appears at the top.",
          ],
        },
        {
          title: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of the State of Israel. Exclusive jurisdiction: competent courts in Israel.",
            "Questions: [motorclub.co.il@gmail.com](mailto:motorclub.co.il@gmail.com)",
          ],
        },
      ],
    },
  },
};
