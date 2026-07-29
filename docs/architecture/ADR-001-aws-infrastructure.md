# ADR-001: ארכיטקטורת AWS ראשונית עבור MotorHub

| | |
|---|---|
| **סטטוס** | מוצע |
| **תאריך** | 29 ביולי 2026 |
| **סביבה ראשונית** | Development / Pre-Production |
| **מערכת** | MotorHub |
| **בעל החלטה** | צוות הפיתוח של MotorHub |

---

## 1. מטרת המסמך

מסמך זה מגדיר את הארכיטקטורה הראשונית לפריסת MotorHub על גבי AWS.

MotorHub היא פלטפורמה חברתית ישראלית לעולם הרכב, המבוססת על משתמשים, פרופילי רכבים, פוסטים, תמונות, סרטונים, עוקבים, תגובות, לייקים והתראות.

### מטרות הארכיטקטורה

- פריסה ראשונית אמינה ב-AWS
- סביבת פיתוח או Pre-Production המדמה את סביבת הייצור
- שמירה על עלויות נמוכות יחסית בשלב הראשון
- הפרדה נכונה בין Frontend, Backend, Database ומדיה
- יכולת הרחבה עתידית ללא בנייה מחדש של המערכת
- אבטחה בסיסית מתאימה למערכת חברתית
- תמיכה בהעלאת תמונות ובהמשך גם סרטונים
- תהליך CI/CD אוטומטי
- ניהול מלא באמצעות Terraform

> **הערה:** MotorHub נמצאת בשלב MVP, ולכן יש להימנע מ-Overengineering ומפיצול מוקדם ל-Microservices. הארכיטקטורה צריכה להתאים למוצר חברתי בתחילת דרכו, תוך דגש על מדיה, מובייל, עברית, RTL, פרטיות וביצועים.

---

## 2. ההחלטה המרכזית

המערכת תיבנה בשלב הראשון כ-**Modular Monolith** ותופעל ב-**Amazon ECS** באמצעות **Fargate**.

### המערכת לא תשתמש בשלב זה ב

- Amazon EKS
- Kubernetes
- Microservices עצמאיים
- Amazon OpenSearch
- Amazon DynamoDB כמסד נתונים ראשי
- Amazon ElastiCache
- API Gateway
- ארכיטקטורת Serverless מלאה

### מודולים פנימיים ב-Backend

ה-Backend יהיה אפליקציה אחת המחולקת פנימית למודולים עסקיים:

| מודול | תיאור |
|---|---|
| `auth` | אימות והרשאות |
| `users` | פרופילי משתמשים |
| `vehicles` | פרופילי רכבים |
| `posts` | פוסטים |
| `media` | ניהול מדיה |
| `comments` | תגובות |
| `likes` | לייקים |
| `follows` | עקיבות |
| `notifications` | התראות |
| `moderation` | ניהול תוכן |

בנוסף ל-API הראשי, יופעל **Worker** נפרד למשימות רקע.

---

## 3. עקרונות הארכיטקטורה

### 3.1 פשטות לפני מורכבות

המערכת צריכה להיות פשוטה מספיק לתחזוקה על ידי צוות קטן, בלי לדרוש ניהול Kubernetes או מספר גדול של שירותים.

### 3.2 הפרדה בין רכיבים כבדים

גם כאשר ה-Backend הוא Modular Monolith, תהיה הפרדה תפעולית בין:

- API
- Worker
- Database
- Object Storage
- Queue
- Frontend

### 3.3 מדיה אינה עוברת דרך שרת האפליקציה

תמונות וסרטונים יועלו ישירות מה-Client אל Amazon S3 באמצעות **Presigned URLs**.

### 3.4 Infrastructure as Code

כל רכיבי התשתית ינוהלו באמצעות Terraform.

אין ליצור רכיבי AWS ידנית, למעט פעולות Bootstrap הכרחיות כגון יצירת Terraform State Backend ראשוני.

### 3.5 Least Privilege

כל רכיב יקבל רק את הרשאות ה-IAM שהוא צריך.

### 3.6 Stateless Application

קונטיינרים של ה-API וה-Worker לא ישמרו מידע קבוע בדיסק המקומי.

כל מידע קבוע יישמר ב:

- PostgreSQL
- Amazon S3
- שירותי AWS ייעודיים

---

## 4. תרשים ארכיטקטורה

```text
                              Internet
                                  │
                                  ▼
                             Route 53
                                  │
                                  ▼
                        CloudFront Distribution
                                  │
                  ┌───────────────┴────────────────┐
                  │                                │
                  ▼                                ▼
          Frontend S3 Bucket                Application Load
          React/Vite static files               Balancer
                                                   │
                                                   ▼
                                         ECS Fargate Service
                                            motorhub-api
                                                   │
                        ┌──────────────────────────┼──────────────────────┐
                        │                          │                      │
                        ▼                          ▼                      ▼
                 RDS PostgreSQL                 S3 Media                SQS
                                                                    Background Jobs
                                                                         │
                                                                         ▼
                                                                ECS Fargate Service
                                                                 motorhub-worker
                                                                         │
                                                           ┌─────────────┴────────────┐
                                                           ▼                          ▼
                                                       S3 Media                 PostgreSQL
```

### רכיבים משלימים

| רכיב | תפקיד |
|---|---|
| ECR | Container images |
| CloudWatch | Logs, metrics and alarms |
| Secrets Manager | Application secrets |
| ACM | TLS certificates |
| WAF | Basic edge protection |
| IAM | Roles and permissions |
| GitHub Actions | CI/CD |
| Terraform | Infrastructure management |

---

## 5. סביבות

בשלב הראשון יוגדרו לפחות שתי סביבות לוגיות.

### Development

מיועדת לפיתוח שוטף ולבדיקות.

**מאפיינים:**

- ECS task אחד עבור ה-API
- ECS task אחד או אפס עבור ה-Worker, בהתאם לצורך
- RDS Single-AZ
- משאבים קטנים
- ללא Deletion Protection
- Log retention קצר יחסית
- Auto Scaling בסיסי או כבוי
- אפשרות לעצירת שירותים לצמצום עלויות

### Production

תוגדר בקוד, אך לא בהכרח תיפרס מיד.

**מאפיינים עתידיים:**

- לפחות שני API tasks
- פריסה בשני Availability Zones
- RDS Multi-AZ
- Deletion Protection
- Backup retention ארוך יותר
- WAF מלא
- התראות תפעוליות
- Auto Scaling
- הגדרות אבטחה מחמירות יותר

### מבנה Terraform מומלץ

```text
terraform/
├── bootstrap/
├── modules/
│   ├── network/
│   ├── security/
│   ├── ecr/
│   ├── ecs-cluster/
│   ├── ecs-service/
│   ├── alb/
│   ├── rds/
│   ├── s3-frontend/
│   ├── s3-media/
│   ├── cloudfront/
│   ├── sqs/
│   ├── secrets/
│   ├── monitoring/
│   └── dns/
│
└── environments/
    ├── dev/
    └── prod/
```

---

## 6. Frontend

### 6.1 טכנולוגיה

בהנחה שה-Frontend מבוסס React/Vite, תוצר ה-build יהיה סטטי.

### 6.2 אחסון והפצה

- קובצי ה-Frontend יישמרו ב-S3 Bucket **פרטי**
- CloudFront יהיה הרכיב הציבורי שמפיץ אותם למשתמשים

```text
Browser
   │
   ▼
CloudFront
   │
   ▼
Private S3 Bucket
```

### 6.3 הגדרות נדרשות

- Block Public Access מופעל
- Server-side encryption מופעל
- Versioning מופעל
- גישה ל-Bucket רק דרך CloudFront Origin Access Control
- דחיסת Brotli או Gzip דרך CloudFront
- תמיכה ב-SPA routing
- החזרת `index.html` עבור Routes שאינם קובץ פיזי
- Cache ארוך לקבצים בעלי hash
- Cache קצר או ללא Cache עבור `index.html`

### 6.4 דומיינים

- `motorhub.co.il`
- `www.motorhub.co.il`

שני הדומיינים יופנו ל-CloudFront.

---

## 7. Backend

### 7.1 פלטפורמת הרצה

ה-Backend ירוץ כ-Docker Container על גבי ECS Fargate.

**שם השירות:** `motorhub-api`

### 7.2 התנהגות נדרשת

האפליקציה חייבת:

- להיות Stateless
- לקבל הגדרות באמצעות Environment Variables
- לתמוך ב-Graceful Shutdown
- להגיב נכון ל-`SIGTERM`
- להחזיק endpoint לבדיקת בריאות
- לכתוב לוגים ל-`stdout` ו-`stderr`
- **לא** לשמור קבצים מקומיים באופן קבוע
- **לא** להחזיק Secrets בתוך Docker image
- **לא** להניח כתובת IP קבועה
- **לא** להניח hostname קבוע

### 7.3 Health Check

**Endpoint נדרש:**

```http
GET /health
```

**תגובה בסיסית:**

```json
{
  "status": "healthy",
  "service": "motorhub-api",
  "version": "1.0.0"
}
```

**מומלץ להפריד בעתיד:**

| Endpoint | תפקיד |
|---|---|
| `GET /health/live` | בודק שהאפליקציה רצה |
| `GET /health/ready` | בודק שהאפליקציה מוכנה לקבל בקשות, כולל חיבור למסד הנתונים |

### 7.4 Scaling

**בסביבת Development:**

```text
desired_count = 1
minimum_count = 1
maximum_count = 2
```

**בסביבת Production העתידית:**

```text
desired_count = 2
minimum_count = 2
maximum_count = 6
```

**מדדים אפשריים ל-Auto Scaling:**

- CPU utilization
- Memory utilization
- ALB request count per target

---

## 8. Worker ומשימות רקע

יופעל ECS Service נוסף: **`motorhub-worker`**

ה-Worker ישתמש באותו Codebase או באותו Repository, אך יופעל באמצעות Command שונה.

**דוגמה:**

```text
API command:     ./start-api.sh
Worker command:  ./start-worker.sh
```

**משימות רקע אפשריות:**

- עיבוד תמונות
- יצירת thumbnails
- המרת תמונות ל-WebP
- הסרת EXIF ונתוני GPS
- שליחת התראות
- שליחת אימיילים
- מחיקת מדיה
- פעולות moderation עתידיות
- עיבוד סרטונים עתידי
- חישוב נתונים לפיד

---

## 9. Queue

Amazon SQS תשמש להעברת משימות מה-API אל ה-Worker.

| Queue | שם |
|---|---|
| ראשי | `motorhub-background-jobs` |
| Dead Letter | `motorhub-background-jobs-dlq` |

### הגדרות נדרשות

- Server-side encryption
- Visibility Timeout המתאים למשך העבודה
- Long Polling
- מספר ניסיונות מוגדר
- העברת הודעה ל-DLQ לאחר כישלונות חוזרים
- IAM שמאפשר ל-API לשלוח הודעות
- IAM שמאפשר ל-Worker לקרוא ולמחוק הודעות

### מבנה הודעה לדוגמה

```json
{
  "job_type": "PROCESS_IMAGE",
  "job_id": "uuid",
  "media_id": "uuid",
  "source_bucket": "motorhub-dev-media",
  "source_key": "uploads/original/user-id/file-id.jpg",
  "created_at": "2026-07-29T10:00:00Z"
}
```

> כל Job חייב להיות **Idempotent**, כך שעיבוד חוזר של אותה הודעה לא ייצור תוצאה כפולה או שגויה.

---

## 10. העלאת תמונות ומדיה

### 10.1 תהליך העלאה

1. המשתמש בוחר תמונה באפליקציה
2. ה-Client שולח ל-API בקשה לקבלת Upload URL
3. ה-API בודק הרשאות, גודל וסוג קובץ מבוקש
4. ה-API יוצר רשומת Media במצב `pending`
5. ה-API מחזיר Presigned URL
6. ה-Client מעלה ישירות ל-S3
7. האפליקציה מאשרת ל-API שההעלאה הסתיימה
8. ה-API או אירוע S3 שולחים Job ל-SQS
9. ה-Worker מעבד את התמונה
10. ה-Worker שומר גרסאות מעובדות
11. רשומת Media משתנה למצב `ready`

### 10.2 מצבי מדיה

```text
pending → uploaded → processing → ready
                              ↘ failed
                              ↘ deleted
```

### 10.3 מבנה S3

```text
uploads/original/{user_id}/{media_id}/{filename}
processed/images/{media_id}/thumbnail.webp
processed/images/{media_id}/small.webp
processed/images/{media_id}/medium.webp
processed/images/{media_id}/large.webp
processed/videos/{media_id}/thumbnail.webp
processed/videos/{media_id}/720p.mp4
```

### 10.4 כללי אבטחה

- אין לסמוך על ה-Content-Type שמגיע מה-Client
- יש לבדוק MIME אמיתי בעת העיבוד
- יש להגביל גודל קובץ
- יש להגביל סיומות מותרות
- יש ליצור שם קובץ פנימי באמצעות UUID
- אין להשתמש בשם הקובץ המקורי כמפתח ראשי
- יש להסיר EXIF ונתוני מיקום
- יש למנוע העלאת קובצי HTML, SVG לא מבוקר או קבצים ניתנים להרצה
- Presigned URL יהיה קצר תוקף
- המשתמש יורשה להעלות רק ל-Prefix שהוקצה לו

### 10.5 סרטונים

סרטונים לא יהיו מרכיב מלא בגרסת התשתית הראשונה, אך מבנה המערכת לא יחסום אותם.

**בשלב הראשון ניתן:**

- לאפשר תמונות בלבד
- או להגביל סרטונים מאוד בגודל ובמשך
- לדחות Transcoding מתקדם לשלב עתידי

---

## 11. Database

### 11.1 שירות

Amazon RDS for PostgreSQL.

### 11.2 מיקום

- המסד ימוקם ב-Private Database Subnets
- לא תוגדר לו כתובת ציבורית

```text
publicly_accessible = false
```

### 11.3 אבטחה

```text
ECS Security Group
        │
        │ TCP 5432
        ▼
RDS Security Group
```

**אין לאפשר גישה באמצעות:** `0.0.0.0/0`

### 11.4 הגדרות Development

- Single-AZ
- Instance קטן שמתאים ל-Development
- Storage מסוג gp3
- Storage encryption
- Automated backups
- Backup retention של מספר ימים
- Deletion Protection כבוי
- Final Snapshot ניתן להגדרה
- Performance Insights אופציונלי בהתאם לעלות
- CloudWatch logs עבור PostgreSQL

### 11.5 Credentials

- סיסמת מסד הנתונים **לא** תופיע בקוד או בקובצי Terraform variables
- היא תיווצר ותישמר ב-AWS Secrets Manager
- ה-ECS Task יקבל אותה באמצעות Secrets injection

### 11.6 Migrations

- האפליקציה תשתמש בכלי Migrations המתאים לטכנולוגיה שלה
- **אין** להריץ Migrations אוטומטית מכל Replica של ה-API

**Migrations יופעלו באמצעות:**

- ECS One-Off Task
- או שלב ייעודי ב-CI/CD
- או Task נפרד לפני עדכון השירות

---

## 12. Authentication

החלטה סופית לגבי Cognito מול Authentication פנימי תתקבל בהתאם לקוד הקיים.

ברירת המחדל המומלצת היא **Amazon Cognito**, בתנאי שהמערכת עדיין לא כוללת מערכת Authentication מלאה ומבוססת.

### Cognito יהיה אחראי על

- הרשמה
- התחברות
- אימות מייל
- איפוס סיסמה
- JWT
- Social Login עתידי
- MFA עתידי

### PostgreSQL יהיה אחראי על

- פרופיל המשתמש
- Username
- Biography
- תמונת פרופיל
- רכבים
- הרשאות פנימיות
- Roles
- Privacy settings
- Blocks
- Reports
- קשרים חברתיים

### קישור בין המערכות

```text
users.id                  Internal UUID
users.identity_provider   cognito
users.identity_subject    Cognito sub
```

> אם בקוד הקיים כבר קיימת מערכת Authentication תקינה, אין להחליף אותה אוטומטית לפני בדיקה מסודרת.

---

## 13. Networking

### 13.1 VPC

תיווצר VPC ייעודית ל-MotorHub.

**טווח לדוגמה:** `10.20.0.0/16`

אין להקשיח את הטווח בקוד המודול. הוא יתקבל כמשתנה.

### 13.2 Availability Zones

המערכת תשתמש בשני Availability Zones.

### 13.3 Subnets

```text
Public Subnet AZ-A
Public Subnet AZ-B

Private App Subnet AZ-A
Private App Subnet AZ-B

Private Database Subnet AZ-A
Private Database Subnet AZ-B
```

### 13.4 Public Subnets

יכילו:

- Application Load Balancer
- רכיבי AWS ציבוריים הכרחיים

### 13.5 Private App Subnets

יכילו:

- ECS API tasks
- ECS Worker tasks

### 13.6 Private Database Subnets

יכילו:

- RDS PostgreSQL

### 13.7 Internet Gateway

Internet Gateway יחובר ל-VPC.

Public Route Tables יכילו:

```text
0.0.0.0/0 → Internet Gateway
```

### 13.8 NAT Gateway

בסביבת Development יש להימנע מ-NAT Gateway, כל עוד ניתן לספק ל-ECS את כל הגישה הנדרשת באמצעות VPC Endpoints.

NAT Gateway יתווסף רק כאשר קיים צורך אמיתי בגישה יזומה מה-Private Subnets לאינטרנט.

**דוגמאות לצורך אפשרי:**

- קריאה ל-API חיצוני
- הורדת משאבים ממקור חיצוני בזמן Runtime
- שירות אימייל חיצוני
- Webhooks יוצאים
- שירותי צד שלישי שאינם נגישים דרך AWS PrivateLink

### 13.9 VPC Endpoints

יש לשקול יצירת Endpoints עבור:

- Amazon S3
- Amazon ECR API
- Amazon ECR Docker
- CloudWatch Logs
- Secrets Manager
- SQS
- AWS Systems Manager (רק אם נדרש ECS Exec)

> יש להשוות את העלות המצטברת של Interface Endpoints מול NAT Gateway. בסביבת פיתוח קטנה, מספר גדול של Interface Endpoints עלול להיות יקר יותר מפתרון פשוט אחר.

---

## 14. Load Balancer

Application Load Balancer יהיה נקודת הכניסה ל-Backend.

### 14.1 Listeners

| Port | פעולה |
|---|---|
| 80 | Redirect to HTTPS |
| 443 | Forward to `motorhub-api` target group |

### 14.2 Target Group

| מאפיין | ערך |
|---|---|
| Target Type | `ip` (נדרש עבור ECS Fargate) |

### 14.3 Health Check

| מאפיין | ערך |
|---|---|
| Path | `/health` |
| Protocol | HTTP |
| Expected code | 200 |

### 14.4 Security Groups

**ALB Security Group:**

```text
Inbound:
  80  from 0.0.0.0/0
  443 from 0.0.0.0/0

Outbound:
  API port to ECS Security Group
```

**ECS Security Group:**

```text
Inbound:
  Application port from ALB Security Group only
```

> אין לפתוח את פורט האפליקציה ישירות לאינטרנט.

---

## 15. DNS ו-TLS

### 15.1 Route 53

**רשומות מתוכננות:**

| דומיין | יעד |
|---|---|
| `motorhub.co.il` | CloudFront frontend |
| `www.motorhub.co.il` | CloudFront frontend |
| `api.motorhub.co.il` | ALB או CloudFront לפני ALB |
| `media.motorhub.co.il` | CloudFront media distribution |

### 15.2 ACM

תעודות SSL/TLS ינוהלו באמצעות AWS Certificate Manager.

| שימוש | אזור |
|---|---|
| CloudFront | `us-east-1` |
| ALB | אזור שבו נמצאת התשתית |

---

## 16. Container Registry

**ECR Repositories מתוכננים:**

- `motorhub-api`
- `motorhub-worker`

אם שני השירותים משתמשים בדיוק באותו Image, ניתן להשתמש ב-Repository אחד:

```text
motorhub-backend
```

ולהפעיל Commands שונים ב-Task Definitions.

### 16.1 הגדרות

- Image scanning מופעל
- Encryption מופעל
- Mutable tags מותרים ב-Development, אך Deployments ישתמשו ב-Image digest או tag ייחודי
- Lifecycle Policy תשמור מספר מוגבל של Images
- **אין** לפרוס לפרודקשן באמצעות tag בשם `latest`

**Tag מומלץ:** `git-sha`

```text
motorhub-backend:a83d91f
```

---

## 17. Secrets ו-Configuration

### 17.1 Secrets Manager

**Secrets אפשריים:**

- `motorhub/dev/database`
- `motorhub/dev/application`
- `motorhub/dev/external-services`

**מידע רגיש:**

- Database password
- JWT secret
- Cognito client secret (אם קיים)
- Email provider credentials
- External API keys

### 17.2 Environment Variables

**מידע שאינו סודי:**

```text
ENVIRONMENT
AWS_REGION
LOG_LEVEL
S3_MEDIA_BUCKET
SQS_JOBS_QUEUE_URL
MEDIA_BASE_URL
FRONTEND_URL
CORS_ALLOWED_ORIGINS
DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
```

**מידע סודי:**

```text
DATABASE_PASSWORD
JWT_SECRET
EXTERNAL_API_KEY
```

### 17.3 כללים

- אין לשמור Secrets ב-Git
- אין לשמור Secrets בתוך Docker image
- אין לשמור Secrets ב-Terraform State כ-plain input אם ניתן להימנע מכך
- אין להדפיס Secrets ללוגים
- `.env.example` יכיל שמות משתנים בלבד, ללא ערכים אמיתיים

---

## 18. IAM

### 18.1 ECS Task Execution Role

תפקיד זה יאפשר ל-ECS:

- למשוך Images מ-ECR
- לשלוח לוגים ל-CloudWatch
- לקרוא Secrets הנדרשים להפעלת הקונטיינר

### 18.2 API Task Role

**הרשאות אפשריות:**

- יצירת Presigned URLs עבור Prefixes מתאימים ב-S3
- כתיבת הודעות ל-SQS
- קריאת Secrets נדרשים (אם אינם מוזרקים מראש)
- גישה נקודתית לשירותי AWS נדרשים

### 18.3 Worker Task Role

**הרשאות אפשריות:**

- קריאה ומחיקה מ-SQS
- קריאה מ-S3 uploads
- כתיבה ל-S3 processed
- עדכון משאבים נדרשים
- קריאת Secrets נדרשים

### 18.4 עיקרון הרשאות

**אין להשתמש ב:**

```text
Action   = "*"
Resource = "*"
```

אלא כאשר אין חלופה טכנית מוצדקת, וגם אז יש לתעד זאת.

---

## 19. אבטחת S3

**Buckets מתוכננים:**

- `motorhub-dev-frontend`
- `motorhub-dev-media`

ניתן להוסיף Bucket נפרד ל-Logs בעתיד.

### 19.1 כל Bucket יכלול

- Block Public Access
- Encryption
- Versioning (לפי הצורך)
- Lifecycle rules
- Ownership controls
- Bucket policies מוגבלות
- HTTPS-only policy

### 19.2 Lifecycle למדיה

**דוגמאות:**

- מחיקת multipart uploads שלא הושלמו
- מעבר גרסאות ישנות ל-Storage Class זול יותר (אם יש צורך)
- ניקוי קבצים במצב abandoned
- שמירת Originals בהתאם למדיניות המוצר

> אין למחוק Originals אוטומטית לפני שהוגדרה מדיניות עסקית ברורה.

---

## 20. CloudFront

מומלץ להשתמש בשתי Distributions או ב-Distribution אחת עם מספר Origins.

### אפשרות מומלצת ל-MVP

| Distribution | דומיינים |
|---|---|
| Frontend | `motorhub.co.il`, `www.motorhub.co.il` |
| Media | `media.motorhub.co.il` |

### יתרונות ההפרדה

- Cache policies שונות
- Security policies שונות
- ניהול Lifecycle שונה
- הפרדה בין קוד סטטי לתוכן משתמשים
- אפשרות ל-Signed URLs בעתיד

### הגדרות בסיסיות

- HTTPS redirect
- Compression
- Origin Access Control
- TLS מודרני
- Response headers policy
- Security headers
- Cache policy מותאמת לפי סוג תוכן

---

## 21. AWS WAF

- בסביבת Development: ניתן להפוך את WAF לאופציונלי באמצעות משתנה Terraform
- בסביבת Production: יהיה פעיל

**כללים ראשוניים:**

- AWS Managed Common Rule Set
- Known Bad Inputs
- Amazon IP Reputation List
- Rate-based rule (הגבלת בקשות חריגה לפי IP)

> אין להסתמך על WAF במקום Validation ו-Authorization בתוך האפליקציה.

---

## 22. Logging

האפליקציה תכתוב **Structured JSON Logs**.

**דוגמה:**

```json
{
  "timestamp": "2026-07-29T10:00:00Z",
  "level": "INFO",
  "service": "motorhub-api",
  "environment": "dev",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/posts",
  "status_code": 201,
  "duration_ms": 84,
  "user_id": "uuid"
}
```

### אין לרשום ללוגים

- Passwords
- Tokens
- Authorization headers
- Cookies רגישים
- Database credentials
- Presigned URLs מלאים
- תוכן פרטי שאינו נדרש

### Log Groups

```text
/ecs/motorhub-dev-api
/ecs/motorhub-dev-worker
```

Retention ב-Development יהיה מוגבל כדי לצמצם עלויות.

---

## 23. Monitoring ו-Alerts

### 23.1 ECS

- CPU utilization
- Memory utilization
- Running task count
- Task restarts
- Deployment failures

### 23.2 ALB

- HTTP 5XX
- Target 5XX
- Response time
- Unhealthy hosts
- Request count

### 23.3 RDS

- CPU utilization
- Free storage
- Database connections
- Freeable memory
- Read/write latency

### 23.4 SQS

- Approximate number of visible messages
- Age of oldest message
- DLQ message count

### 23.5 CloudFront

- Error rate
- Requests
- Cache hit ratio

### 23.6 Billing

יש ליצור AWS Budget או Cost Anomaly Detection.

אין צורך להגדיר סכום קשיח במסמך זה. הסכום ייקבע לפי התקציב הזמין לפרויקט.

---

## 24. CI/CD

### 24.1 Backend Pipeline

```text
Push or merge to main
        │
        ▼
Install dependencies
        │
        ▼
Lint and tests
        │
        ▼
Build Docker image
        │
        ▼
Security scan
        │
        ▼
Push image to ECR
        │
        ▼
Run database migration task
        │
        ▼
Update ECS task definition
        │
        ▼
Deploy ECS service
        │
        ▼
Wait for service stability
        │
        ▼
Run smoke test
```

### 24.2 Frontend Pipeline

```text
Push or merge to main
        │
        ▼
Install dependencies
        │
        ▼
Lint and tests
        │
        ▼
Build production bundle
        │
        ▼
Upload to S3
        │
        ▼
Invalidate index.html in CloudFront
        │
        ▼
Run smoke test
```

### 24.3 Authentication מול AWS

- GitHub Actions ישתמש ב-**OpenID Connect**
- **אין** לשמור AWS Access Key ו-Secret Access Key קבועים ב-GitHub Secrets

---

## 25. Terraform State

Terraform State יישמר מרחוק.

**Bootstrap resources:**

- S3 Bucket עבור State
- State encryption
- Versioning
- Locking בהתאם ליכולת הנתמכת ולגישה שנבחרה
- IAM policy מוגבלת

**מבנה State אפשרי:**

```text
motorhub/
├── dev/
│   └── terraform.tfstate
└── prod/
    └── terraform.tfstate
```

> אין לשתף State בין Development ל-Production.

---

## 26. Terraform Conventions

### 26.1 Naming

**פורמט:**

```text
{project}-{environment}-{resource}
```

**דוגמאות:**

```text
motorhub-dev-vpc
motorhub-dev-api
motorhub-dev-worker
motorhub-dev-media
motorhub-dev-db
```

### 26.2 Tags

כל Resource שתומך ב-Tags יקבל:

| Tag | ערך |
|---|---|
| `Project` | MotorHub |
| `Environment` | dev |
| `ManagedBy` | Terraform |
| `Owner` | MotorHub |

**ניתן להוסיף:** `Component`, `CostCenter`, `Repository`

### 26.3 Variables

**אין להקשיח בקוד:**

- Region
- CIDR ranges
- Instance sizes
- Domain names
- Desired counts
- Retention periods
- Database name
- Container port
- Image tags

### 26.4 Validation

יש להוסיף Variable Validation כאשר הדבר שימושי.

**לדוגמה:**

- Environment חייב להיות `dev`, `staging` או `prod`
- CIDR חייב להיות בפורמט תקין
- Container port חייב להיות בטווח תקין
- Desired count לא יכול להיות שלילי

---

## 27. דרישות קוד מהאפליקציה

לפני הפריסה, Cursor צריך לבדוק שהאפליקציה עומדת בדרישות הבאות.

### Configuration

- כל ההגדרות מתקבלות מ-Environment Variables

### Database

- Connection pooling
- Retry מבוקר בעת startup
- Graceful shutdown
- Migrations
- אין hardcoded host או password

### Health Checks

- `/health`
- עדיפות להפרדה בין liveness ו-readiness

### Logging

- JSON structured logs
- Request ID
- Response duration
- Status code
- אין Secrets

### Media

- Presigned URL upload
- שמירת metadata במסד הנתונים
- סטטוסים לעיבוד
- הגבלת סוג וגודל קובץ

### SQS

- Producer ב-API
- Consumer ב-Worker
- Retry
- Idempotency
- DLQ awareness

### Docker

- Multi-stage build
- Non-root user
- `.dockerignore`
- אין development dependencies מיותרות
- Command מוגדר
- Healthcheck מתאים
- SIGTERM מטופל

### CORS

- רשימת Origins תתקבל ממשתנה סביבה
- **אין** להשתמש ב-Wildcard עם Credentials

### Pagination

Endpoints של פיד, משתמשים, רכבים, תגובות וחיפוש יתמכו ב-Pagination.

לפיד מומלץ להשתמש ב-**Cursor Pagination**.

---

## 28. החלטות שנדחו

| החלטה | סיבה |
|---|---|
| **EKS** | מוסיף מורכבות תפעולית ועלויות שאינן נדרשות ל-MVP |
| **Microservices** | המערכת עדיין אינה זקוקה לפריסה עצמאית של כל Domain |
| **OpenSearch** | נדחה עד שחיפוש PostgreSQL לא יספיק |
| **Redis** | נדחה עד שיופיע צורך מדיד ב-Caching, Rate Limiting מבוזר או Feed Precomputation |
| **DynamoDB** | מודל הנתונים כולל קשרים רבים המתאימים ל-PostgreSQL |
| **MediaConvert** | נדחה עד שסרטונים יהפכו לפיצ'ר מרכזי |
| **Multi-AZ RDS ב-Development** | נדחה לצורך חיסכון בעלויות; יופעל ב-Production |

---

## 29. סיכונים

### עלויות VPC Endpoints

מספר גדול של Interface Endpoints עלול ליצור עלות קבועה משמעותית.

**יש לבצע השוואה בין:**

- NAT Gateway
- VPC Endpoints
- Public IP זמני ל-Development
- ארכיטקטורה היברידית

### Cognito Integration

Cognito עשוי לדרוש שינויים משמעותיים אם כבר קיימת מערכת Authentication פנימית. יש לבדוק את הקוד לפני החלטה סופית.

### עיבוד תמונות

עיבוד תמונות בתוך Worker מתמשך עשוי להיות פחות חסכוני כאשר כמות המשימות נמוכה מאוד. בעתיד ניתן לבחון Lambda עבור עיבוד נקודתי, אך אין להוסיף אותה בשלב הראשון ללא צורך.

### עלויות RDS

RDS יוצר עלות קבועה גם כאשר אין משתמשים. בסביבת Development ניתן לשקול עצירה מתוזמנת או Instance קטן, בלי לפגוע בהתאמה לפרודקשן.

### סרטונים

סרטונים מגדילים משמעותית:

- Storage
- Bandwidth
- Processing
- Moderation complexity
- Upload failure rates

לכן יש להגביל אותם בשלבים הראשונים.

---

## 30. שלבי מימוש

| Phase | תוכן |
|---|---|
| **Phase 1: Foundation** | Terraform backend, AWS Provider, Naming conventions, Tags, VPC, Subnets, Route tables, Security Groups |
| **Phase 2: Data and Storage** | RDS PostgreSQL, Secrets Manager, Media S3, Frontend S3, SQS ו-DLQ |
| **Phase 3: Compute** | ECR, ECS Cluster, API Task Definition, Worker Task Definition, ECS Services, CloudWatch Log Groups |
| **Phase 4: Public Access** | ALB, Target Group, ACM, Route 53, CloudFront, Origin Access Control |
| **Phase 5: Security and Monitoring** | WAF אופציונלי ב-Development, CloudWatch Alarms, AWS Budget, IAM hardening, Security headers |
| **Phase 6: CI/CD** | GitHub OIDC, Backend pipeline, Frontend pipeline, Migration task, Smoke tests |
| **Phase 7: Application Integration** | Environment configuration, Health endpoints, S3 Presigned URLs, SQS producer, Worker consumer, Structured logging, Graceful shutdown |

---

## 31. Definition of Done

הארכיטקטורה הראשונית תיחשב מוכנה כאשר:

- [ ] כל התשתית נוצרת באמצעות Terraform
- [ ] `terraform fmt` עובר
- [ ] `terraform validate` עובר
- [ ] `terraform plan` אינו מציג שגיאות
- [ ] ה-Frontend זמין ב-HTTPS
- [ ] ה-API זמין ב-HTTPS
- [ ] ECS מפעיל API task תקין
- [ ] ALB health checks עוברים
- [ ] ה-API מתחבר ל-RDS
- [ ] RDS אינו ציבורי
- [ ] ניתן לקבל Presigned URL
- [ ] ניתן להעלות תמונה ישירות ל-S3
- [ ] ה-API יכול לשלוח הודעה ל-SQS
- [ ] ה-Worker יכול לצרוך הודעה
- [ ] לוגים מגיעים ל-CloudWatch
- [ ] Secrets אינם קיימים בקוד או ב-Terraform variables
- [ ] פריסה מתבצעת דרך GitHub Actions עם OIDC
- [ ] התשתית מתויגת באופן אחיד
- [ ] קיים README עם הוראות פריסה והריסה
- [ ] קיימת הפרדה בין dev ל-prod

---

## 32. הנחיה ל-Cursor

מסמך זה הוא **מקור האמת הארכיטקטוני** של הפרויקט.

**בעת יצירת Terraform או שינוי האפליקציה:**

1. יש לבדוק תחילה את מבנה הקוד הקיים
2. אין להניח שפת תכנות או Framework בלי לזהות אותם מהפרויקט
3. אין להחליף טכנולוגיה קיימת ללא הצדקה
4. אין ליצור משאבים שאינם מופיעים במסמך בלי להסביר את הצורך
5. **אין** להוסיף EKS, Kubernetes, Redis, OpenSearch או DynamoDB
6. יש להעדיף פתרון פשוט ל-Development שאינו חוסם Production
7. יש להציג Plan מפורט לפני ביצוע שינויים
8. יש לבצע את השינויים בשלבים קטנים
9. לאחר כל שלב יש להריץ Validation או Tests מתאימים
10. יש לתעד כל הנחה וכל החלטה שלא הוגדרה במפורש

---

## 33. החלטה מסכמת

MotorHub תופעל בשלב הראשוני באמצעות ארכיטקטורה מנוהלת ופשוטה יחסית:

| רכיב | שימוש |
|---|---|
| S3 + CloudFront | Frontend |
| ALB + ECS Fargate | Backend API |
| ECS Fargate + SQS | Background Worker |
| RDS PostgreSQL | Relational Database |
| S3 + CloudFront | User Media |
| Secrets Manager | Secrets |
| ECR | Container Registry |
| CloudWatch | Logs and Monitoring |
| Route 53 + ACM | DNS and TLS |
| Terraform | Infrastructure as Code |
| GitHub Actions | CI/CD |

המערכת תישאר **Modular Monolith** בשלב הראשון, אך תיבנה כך שניתן יהיה להפריד בעתיד שירותים בעלי עומס או קצב פיתוח עצמאי.

**ההפרדה החשובה כבר בשלב זה היא בין:**

- API
- Worker
- Database
- Media Storage
- Queue
- Frontend

מבנה זה מספק איזון נכון בין פשטות, עלויות, אבטחה ויכולת גדילה עבור ה-MVP של MotorHub.
