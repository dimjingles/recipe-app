-- Add gallery_images column to recipes
alter table recipes add column if not exists gallery_images text[] default '{}';

-- Storage bucket for user-uploaded recipe images
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "Users can upload recipe images"
on storage.objects for insert
with check (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view recipe images"
on storage.objects for select
using (bucket_id = 'recipe-images');

create policy "Users can delete own recipe images"
on storage.objects for delete
using (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
