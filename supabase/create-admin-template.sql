-- 仅当应用账号已在 Authentication > Users 创建后执行。
-- 将邮箱替换为你创建的管理员应用账号；不需要提供密码。
insert into public.profiles(id,name,role,active)
select id,'管理员','admin',true from auth.users where email='替换管理员邮箱' and email_confirmed_at is not null
on conflict(id) do nothing;
-- 验证：select name,role,active from public.profiles;
