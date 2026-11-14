insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-files','chat-files',false,4194304,array['application/pdf','text/plain']) on conflict(id) do nothing;
create policy chat_files_owner_read on storage.objects for select to authenticated
using(bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_files_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_files_owner_delete on storage.objects for delete to authenticated
using(bucket_id='chat-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
