-- Yazı görselleri için Supabase Storage ayarı.
-- Prisma migration'larına konmaz (storage şeması Supabase'e özgüdür; `prisma migrate dev`
-- gölge veritabanında bu şema bulunmaz). Supabase SQL Editor'de bir kez çalıştırılır.

-- Herkese açık okunabilen kova; 4 MB sınırı (Vercel fonksiyonlarının istek gövdesi sınırı 4.5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Yükleme, API tarafından kullanıcının kendi access token'ıyla yapılır (gizli anahtar
-- kullanılmaz). Her kullanıcı yalnızca kendi kimliğiyle adlandırılmış klasöre yükleyebilir.
create policy "post-images: kullanici kendi klasorune yukler"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
