-- Private photos; users can only read, insert or remove their own files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-photos','chat-photos',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy chat_photos_owner_read on storage.objects for select to authenticated
using(bucket_id='chat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_photos_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='chat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_photos_owner_delete on storage.objects for delete to authenticated
using(bucket_id='chat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
