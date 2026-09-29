# Fikirhane — Backend (API)

> Herkesin yazabildiği, okuyabildiği ve tartışabildiği çok konulu bir blog ve fikir paylaşım platformu.

Bu depo Fikirhane'nin **REST API'sini** içerir. Web sitesi ([FikirhaneWeb](https://github.com/alpkcgl342/FikirhaneWeb)) ve Android uygulaması aynı API'yi kullanır.

---

## İçindekiler

- [Teknoloji Yığını](#teknoloji-yığını)
- [Mimari](#mimari)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [E-posta Doğrulama](#e-posta-doğrulama)
- [Vercel'e Dağıtım](#vercele-dağıtım)
- [API Özeti](#api-özeti)
- [Veri Modeli](#veri-modeli)
- [Yol Haritası](#yol-haritası)
- [Lisans](#lisans)

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Dil / çatı | TypeScript, NestJS 12 (Node.js) |
| Veritabanı | PostgreSQL — [Supabase](https://supabase.com) |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Kimlik doğrulama | Supabase Auth (JWT access + refresh token, ES256 / JWKS ile doğrulama) |
| Dosya depolama | Supabase Storage (S3 uyumlu) |
| API dokümantasyonu | Swagger (OpenAPI) |
| Test | Vitest, Supertest |
| Kod kalitesi | Oxlint, Prettier |
| Dağıtım | Vercel |

---

## Mimari

```
┌──────────────────────┐        ┌──────────────────────┐
│  Web (HTML/CSS/JS)   │        │  Android (Kotlin)    │
└──────────┬───────────┘        └──────────┬───────────┘
           │        REST API (JSON) + JWT  │
           └───────────────┬───────────────┘
                           ▼
              ┌────────────────────────┐
              │   NestJS API Sunucusu  │──────┐
              │  (Vercel Functions)    │      │ kayıt / giriş / yenileme / doğrulama
              └───────────┬────────────┘      ▼
                          │ Prisma   ┌──────────────────┐
                          ▼          │  Supabase Auth   │
                 ┌─────────────────┐ └──────────────────┘
                 │   PostgreSQL    │
                 │   (Supabase)    │
                 └─────────────────┘
```

- İstemciler Supabase'e doğrudan bağlanmaz; her şey bu API üzerinden geçer.
- `/auth/*` istekleri API tarafından Supabase Auth'a iletilir.
- Korunan uç noktalarda access token, Supabase projesinin herkese açık JWKS anahtarlarıyla doğrulanır; sunucuda gizli JWT anahtarı tutulmaz.
- `public` şemasındaki tüm tablolarda RLS açıktır ve policy tanımlanmamıştır. Böylece Supabase'in otomatik REST API'si tablolara erişemez; Prisma `postgres` rolüyle bağlandığı için etkilenmez.

---

## Proje Yapısı

```
FikirhaneBackend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/               # Kayıt, giriş, e-posta doğrulama, token doğrulama, guard
│   ├── categories/         # Kategori listesi
│   ├── posts/              # Yazı CRUD, slug, okuma süresi, etiketler
│   ├── uploads/            # Görsel yükleme (Supabase Storage)
│   ├── prisma/             # PrismaService
│   ├── supabase/           # Supabase istemcisi
│   ├── config/             # Ortam değişkeni doğrulama
│   ├── common/             # Guard, interceptor, filter, dekoratörler
│   └── generated/          # Prisma istemcisi (otomatik üretilir, git'e girmez)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── supabase/
│   └── storage.sql         # Görsel kovası ve yükleme kuralı (SQL Editor'de bir kez)
├── prisma.config.ts
├── .env.example
├── package.json
└── tsconfig.json
```

Sonraki fazlarda `src/` altına `users`, `comments`, `likes`, `bookmarks`, `follows`, `notifications`, `reports` modülleri eklenecek. Etiketler ayrı bir modül yerine yazılarla birlikte yönetilir.

---

## Kurulum

### Gereksinimler
- Node.js 20.19+
- npm
- Bir Supabase projesi
- VS Code (önerilen eklentiler: Prisma, Prettier)

```bash
git clone https://github.com/alpkcgl342/FikirhaneBackend.git
cd FikirhaneBackend
cp .env.example .env         # Değerleri doldurun (aşağıya bakın)
npm install                  # postinstall ile Prisma istemcisi de üretilir
npm run db:migrate           # prisma migrate deploy
npm run db:seed              # Kategoriler
# Supabase SQL Editor'de bir kez: supabase/storage.sql (görsel yükleme)
npm run start:dev
```

API varsayılan olarak `http://localhost:3000/api` adresinde çalışır.
Swagger dokümantasyonu: `http://localhost:3000/api/docs`

> Yeni bir şema değişikliği için: `npx prisma migrate dev --name <degisiklik-adi>`

### Testler
```bash
npm test
npm run lint
```

---

## Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun. Veritabanı ve Supabase değerleri, Supabase Dashboard'da projenin **Connect** ekranında bulunur.

| Değişken | Açıklama |
|---|---|
| `PORT` | Yerel port (varsayılan 3000) |
| `CORS_ORIGIN` | İzin verilen web kökenleri, virgülle ayrılır |
| `WEB_URL` | Web sitesinin adresi; e-posta doğrulamasından sonra buraya yönlendirilir |
| `DATABASE_URL` | Transaction pooler bağlantısı (port 6543) — uygulama kullanır |
| `DIRECT_URL` | Session pooler bağlantısı (port 5432) — Prisma CLI (migrate/seed) kullanır |
| `SUPABASE_URL` | `https://<proje-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

> `.env` dosyası asla GitHub'a gönderilmemelidir; `.gitignore` içinde yer alır. Supabase **secret / service_role** anahtarı bu projede kullanılmaz ve hiçbir dosyaya yazılmamalıdır.

---

## E-posta Doğrulama

**Şu anki durum:** Supabase e-posta şablonları yalnızca özel SMTP bağlandığında düzenlenebildiği için varsayılan şablon kullanılıyor.

1. `POST /auth/register` Supabase'de kullanıcı oluşturur (`emailRedirectTo = WEB_URL/pages/login.html?confirmed=1`); Supabase doğrulama e-postası gönderir.
2. E-postadaki bağlantı Supabase'de doğrulanır ve kullanıcı giriş sayfasına döner. Giriş sayfası sonucu gösterir, Supabase'in adrese eklediği token'ları kullanmadan siler.
3. Bağlantının süresi dolduysa `POST /auth/resend-confirmation` yeni bir e-posta gönderir.

**Supabase Dashboard ayarları:**

- **Authentication → URL Configuration → Site URL:** `https://fikirhane-web.vercel.app`
- **Redirect URLs:** `https://fikirhane-web.vercel.app/**` (yerel geliştirme için `http://localhost:5173/**`)

**İleride — doğrulamayı backend'e taşımak:** özel SMTP (**Authentication → Emails → SMTP Settings**) bağlandıktan sonra **Confirm signup** şablonundaki bağlantı şununla değiştirilir; kod tarafında başka değişiklik gerekmez:

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email">E-postamı doğrula</a>
```

`GET /auth/confirm` token'ı `verifyOtp` ile doğrular ve `WEB_URL/pages/login.html?confirmed=1` (başarısızsa `=0`) adresine yönlendirir.

Not: Supabase'in hazır e-posta servisinin gönderim sınırı çok düşüktür; gerçek kullanıcılara açılmadan önce özel SMTP bağlanmalıdır.

---

## Vercel'e Dağıtım

1. Vercel'de bu depodan yeni bir proje oluşturun (ör. `fikirhane-api`). Framework **NestJS** olarak otomatik algılanır.
2. Ortam değişkenlerini girin: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CORS_ORIGIN`, `WEB_URL`.
3. Veritabanı migration'ları Vercel build'inde çalıştırılmaz; şema değişikliklerinden sonra yerelde `npm run db:migrate` çalıştırılır.

Web sitesinin `vercel.json` dosyası `/api/*` isteklerini bu projenin adresine yönlendirir; proje adı farklıysa oradaki adres güncellenmelidir.

---

## API Özeti

Tüm uç noktalar `/api` ön eki ile başlar. 🔒 işaretliler giriş gerektirir (`Authorization: Bearer <accessToken>`).

| Metot | Uç nokta | Açıklama | Durum |
|---|---|---|---|
| GET | `/health` | Sağlık kontrolü | ✅ |
| POST | `/auth/register` | Kayıt ol | ✅ |
| POST | `/auth/login` | Giriş yap | ✅ |
| POST | `/auth/refresh` | Token yenile | ✅ |
| GET | `/auth/confirm` | E-posta doğrulama bağlantısı (özel SMTP ile kullanılır) | ✅ |
| POST | `/auth/resend-confirmation` | Doğrulama e-postasını tekrar gönder | ✅ |
| GET | `/auth/me` 🔒 | Oturumdaki kullanıcı | ✅ |
| GET | `/users/:username` | Profil bilgisi | |
| PATCH | `/users/me` 🔒 | Profil güncelle | |
| POST | `/users/:id/follow` 🔒 | Takip et / bırak | |
| GET | `/posts` | Yazı listesi (`?category=&tag=&author=&status=&page=&limit=`) | ✅ |
| GET | `/posts/:slug` | Yazı detayı (taslağı yalnızca yazarı görür) | ✅ |
| POST | `/posts` 🔒 | Yazı oluştur | ✅ |
| PATCH | `/posts/:id` 🔒 | Yazı düzenle (sadece yazar) | ✅ |
| DELETE | `/posts/:id` 🔒 | Yazı sil (sadece yazar) | ✅ |
| POST | `/uploads/image` 🔒 | Görsel yükle (multipart `file`, en fazla 4 MB) | ✅ |
| POST | `/posts/:id/like` 🔒 | Beğen / beğeniyi kaldır | |
| POST | `/posts/:id/bookmark` 🔒 | Kaydet / kaldır | |
| GET | `/posts/:id/comments` | Yorumlar | |
| POST | `/posts/:id/comments` 🔒 | Yorum yap | |
| GET | `/categories` | Kategoriler | ✅ |
| GET | `/search?q=` | Arama | |
| GET | `/notifications` 🔒 | Bildirimler | |
| POST | `/reports` 🔒 | Şikâyet oluştur | |
| GET | `/admin/reports` 🔒 | Şikâyetler (moderatör/yönetici) | |

### Yazılar

- `GET /posts` varsayılan olarak yayınlanmış yazıları en yeniden eskiye döner: `{ items, page, pageSize, total, totalPages }`. Liste öğelerinde `content` yerine düz metin `excerpt` bulunur.
- `status=DRAFT` veya `status=ALL` giriş gerektirir ve **her zaman isteyen kullanıcının kendi yazılarını** döner (`author` parametresi yok sayılır).
- Slug başlıktan üretilir (Türkçe karakterler dönüştürülür) ve sonuna rastgele 6 karakter eklenir; yazı düzenlense de değişmez.
- `readingTime` dakikada 200 kelimeye göre hesaplanır. Etiketler küçük harfe çevrilir, en fazla 5 tanedir ve yoksa oluşturulur.
- `coverUrl` yalnızca `POST /uploads/image` ile projenin Storage kovasına yüklenmiş bir görsel olabilir. Yükleme, kullanıcının kendi token'ıyla yapılır ve dosya türü içeriğine (magic bytes) bakılarak doğrulanır; SVG kabul edilmez.

### Kimlik doğrulama yanıtları

`POST /auth/login` ve (oturum açıldıysa) `POST /auth/register`:

```json
{
  "user": { "id": "…", "username": "ayse", "email": "…", "displayName": "Ayşe", "bio": null, "avatarUrl": null, "role": "USER", "createdAt": "…" },
  "session": { "accessToken": "…", "refreshToken": "…", "expiresIn": 3600, "expiresAt": 1790000000 }
}
```

E-posta doğrulaması açıkken kayıt yanıtında `session: null` ve `emailConfirmationRequired: true` döner. Doğrulanmamış hesapla giriş denemesi `403` döner.

Hata yanıtları NestJS biçimindedir: `{ "statusCode": 400, "message": "…" | ["…"], "error": "Bad Request" }`.

---

## Veri Modeli

Temel tablolar ve ilişkiler (`prisma/schema.prisma`):

- **User** (`users`) — id (= Supabase `auth.users.id`), username, email, displayName, bio, avatarUrl, role, createdAt. Şifreler Supabase Auth'ta tutulur.
- **Post** (`posts`) — id, authorId → User, title, slug, content (Markdown), coverUrl, status (`DRAFT` / `PUBLISHED`), categoryId → Category, readingTime, createdAt, updatedAt
- **Category** (`categories`) — id, name, slug, description
- **Tag** (`tags`) — id, name ↔ Post (çoka-çok, `post_tags`)
- **Comment** (`comments`) — id, postId → Post, authorId → User, parentId → Comment (yanıtlar için), content, createdAt
- **Like** (`likes`) — userId + postId (benzersiz)
- **Bookmark** (`bookmarks`) — userId + postId (benzersiz)
- **Follow** (`follows`) — followerId + followingId (benzersiz)
- **Notification** (`notifications`) — id, userId, type (`COMMENT` / `LIKE` / `FOLLOW`), data, isRead, createdAt
- **Report** (`reports`) — id, reporterId, targetType (`POST` / `COMMENT` / `USER`), targetId, reason, status (`PENDING` / `RESOLVED` / `DISMISSED`)

---

## Yol Haritası

- [x] **Faz 1 — Temel:** Proje iskeleti, veritabanı şeması, kayıt / giriş, e-posta doğrulama
- [x] **Faz 2 — Yazılar:** Yazı CRUD, Markdown editör, kategoriler, etiketler, görsel yükleme
- [ ] **Faz 3 — Etkileşim:** Yorumlar, beğeni, kaydetme, takip
- [ ] **Faz 4 — Keşfet:** Ana akış, arama, popüler yazılar
- [ ] **Faz 5 — Topluluk:** Bildirimler, şikâyet ve moderasyon paneli
- [ ] **Faz 6 — Yayın:** Testler, canlı ortama dağıtım, SEO ve performans
- [ ] **Sonrası:** Karanlık tema, şifre sıfırlama, Google ile giriş

Commit mesajlarında [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…) kullanılır.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
