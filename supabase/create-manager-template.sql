-- 可在真实楼长账号创建后执行；按需重复填入不同账号。
insert into public.profiles(id,name,role,active)
select id,'楼长姓名','manager',true from auth.users where email='替换楼长邮箱' and email_confirmed_at is not null
on conflict(id) do nothing;
