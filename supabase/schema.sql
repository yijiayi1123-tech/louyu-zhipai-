create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
-- 在全新的 Supabase 项目 SQL Editor 中一次执行。
create table public.profiles(id uuid primary key references auth.users(id), name text not null, role text not null check(role in ('admin','manager')), active boolean not null default true);
create table public.buildings(id uuid primary key default gen_random_uuid(),name text not null,area text not null,manager_id uuid references public.profiles(id),created_by uuid references public.profiles(id),created_at timestamptz default now());
create table public.tasks(id uuid primary key default gen_random_uuid(),building_id uuid not null references public.buildings(id),title text not null,content text,assignee_id uuid not null references public.profiles(id),type text not null,due_date date not null,status text not null default '待完成' check(status in ('待完成','进行中','待补充','已完成')),completion_note text,created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.tickets(id uuid primary key default gen_random_uuid(),building_id uuid not null references public.buildings(id),title text not null,location text not null,content text not null,severity text not null check(severity in ('一般','紧急')),status text not null default '待核查' check(status in ('待核查','处理中','已解决')),completion_note text,created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.speed_tests(id uuid primary key default gen_random_uuid(),building_id uuid not null references public.buildings(id),location text not null,tested_at timestamptz not null,device text not null,connection text not null check(connection in ('Wi-Fi','有线')),download numeric not null check(download>=0 and download<=100000),upload numeric not null check(upload>=0 and upload<=100000),latency numeric not null check(latency>=0 and latency<=100000),content text,created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.inspections(id uuid primary key default gen_random_uuid(),building_id uuid not null references public.buildings(id),location text not null,content text not null,created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.announcements(id uuid primary key default gen_random_uuid(),building_id uuid references public.buildings(id),title text not null,content text not null,created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.weekly_reports(id uuid primary key default gen_random_uuid(),title text not null,content text not null,status text not null default '待审核' check(status in ('待审核','已审核')),created_by uuid not null references public.profiles(id),created_at timestamptz default now());
create table public.announcement_reads(id uuid primary key default gen_random_uuid(),announcement_id uuid not null references public.announcements(id),user_id uuid not null references public.profiles(id),created_at timestamptz default now(),unique(announcement_id,user_id));
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid,table_name text not null,action text not null,record_id uuid,old_data jsonb,new_data jsonb,created_at timestamptz default now());
create function private.is_active() returns boolean language sql stable security definer set search_path=public, pg_temp as $$ select exists(select 1 from profiles where id=auth.uid() and active) $$;
create function private.is_admin() returns boolean language sql stable security definer set search_path=public, pg_temp as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and active) $$;
create function private.can_building(b uuid) returns boolean language sql stable security definer set search_path=public, pg_temp as $$ select private.is_admin() or (private.is_active() and exists(select 1 from buildings where id=b and manager_id=auth.uid())) $$;
alter table public.profiles enable row level security;
-- 账号与角色仅通过 SQL Editor 管理，客户端不能自行提升权限。
create policy profile_read on public.profiles for select to authenticated using((select private.is_admin()) or ((select private.is_active()) and id=(select auth.uid())));
alter table public.buildings enable row level security;
create policy building_read on public.buildings for select to authenticated using(private.can_building(id));
create policy building_admin on public.buildings for all to authenticated using(private.is_admin()) with check(private.is_admin());
do $$ declare t text; begin foreach t in array array['tasks','tickets','speed_tests','inspections'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy scoped_read on public.%I for select to authenticated using(private.can_building(building_id))',t);
execute format('create policy scoped_insert on public.%I for insert to authenticated with check(created_by=auth.uid() and private.can_building(building_id) %s)',t,case when t='tasks' then 'and private.is_admin()' else '' end);
end loop; end $$;
create policy task_update on public.tasks for update to authenticated using(private.is_admin() or (private.can_building(building_id) and assignee_id=auth.uid())) with check(private.is_admin() or (private.can_building(building_id) and assignee_id=auth.uid()));
create policy ticket_update on public.tickets for update to authenticated using(private.can_building(building_id)) with check(private.can_building(building_id));
-- 楼长仅能更新任务或工单的状态与处理记录，禁止改写位置、负责人、发布者等字段。
create function private.guard_progress() returns trigger language plpgsql set search_path=public, pg_temp as $$ begin
if not private.is_admin() and (to_jsonb(new)-'status'-'completion_note') is distinct from (to_jsonb(old)-'status'-'completion_note') then raise exception '仅允许更新状态和处理记录'; end if;
return new; end $$;
create trigger guard_task before update on public.tasks for each row execute function private.guard_progress();
create trigger guard_ticket before update on public.tickets for each row execute function private.guard_progress();
create function private.check_assignee() returns trigger language plpgsql set search_path=public, pg_temp as $$ begin
if not exists(select 1 from public.buildings b join public.profiles p on p.id=b.manager_id where b.id=new.building_id and b.manager_id=new.assignee_id and p.active and p.role='manager') then raise exception '执行人必须是该楼宇启用的负责楼长'; end if; return new; end $$;
create trigger check_task_assignee before insert or update on public.tasks for each row execute function private.check_assignee();
alter table public.announcements enable row level security;
create policy announcement_read on public.announcements for select to authenticated using(private.is_active() and (building_id is null or private.can_building(building_id)));
create policy announcement_admin on public.announcements for all to authenticated using(private.is_admin()) with check(private.is_admin() and created_by=auth.uid());
alter table public.announcement_reads enable row level security;
create policy read_status_select on public.announcement_reads for select to authenticated using(private.is_admin() or (private.is_active() and user_id=auth.uid()));
create policy read_status_insert on public.announcement_reads for insert to authenticated with check(private.is_active() and user_id=auth.uid() and exists(select 1 from public.announcements a where a.id=announcement_id));
alter table public.weekly_reports enable row level security;
create policy report_select on public.weekly_reports for select to authenticated using(private.is_admin() or (private.is_active() and created_by=auth.uid()));
create policy report_insert on public.weekly_reports for insert to authenticated with check(private.is_active() and created_by=auth.uid() and status='待审核');
create policy report_review on public.weekly_reports for update to authenticated using(private.is_admin()) with check(private.is_admin());
alter table public.audit_logs enable row level security;
create policy audit_select on public.audit_logs for select to authenticated using(private.is_admin() or (private.is_active() and actor_id=auth.uid()));
create function private.write_audit() returns trigger language plpgsql security definer set search_path=public, pg_temp as $$ begin
insert into audit_logs(actor_id,table_name,action,record_id,old_data,new_data) values(auth.uid(),tg_table_name,tg_op,new.id,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;end $$;
do $$ declare t text; begin foreach t in array array['profiles','buildings','tasks','tickets','speed_tests','inspections','announcements','weekly_reports','announcement_reads'] loop execute format('create trigger record_audit after insert or update on public.%I for each row execute function private.write_audit()',t);end loop;end $$;
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;
grant insert,update on public.tasks,public.tickets,public.buildings,public.announcements,public.weekly_reports to authenticated;
grant insert on public.speed_tests,public.inspections,public.announcement_reads to authenticated;
revoke all on function private.write_audit() from public;
create index tasks_building on public.tasks(building_id);
create index tickets_building on public.tickets(building_id);
create index speed_building on public.speed_tests(building_id);
-- Authentication > Users 先创建账号，然后以真实 UUID 执行：
-- insert into public.profiles(id,name,role) values ('管理员UUID','管理员','admin'),('楼长UUID','林同学','manager');
-- 禁用账号：update public.profiles set active=false where id='目标UUID';

-- Restrict internal helpers and trigger functions; RLS uses the granted helpers.
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_active(),private.is_admin(),private.can_building(uuid) to authenticated;
create index buildings_manager on public.buildings(manager_id);
create index inspections_building on public.inspections(building_id);
create index reports_author on public.weekly_reports(created_by);
create index audit_actor on public.audit_logs(actor_id);
