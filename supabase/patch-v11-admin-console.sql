-- ============================================================
-- patch-v11: Admin Console (Phase 1)
-- - system_settings: key/value config ที่แก้ได้จาก dashboard (เช่น ปุ่มหยุดบอท)
-- - dashboard_login_attempts: rate limit สำหรับ PIN gate (กัน brute force)
-- ปลอดภัยต่อการรันซ้ำ (idempotent)
-- ============================================================

-- 1) system_settings — คีย์/ค่าที่ dashboard แก้ได้
create table if not exists public.system_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.system_settings enable row level security;
revoke all on table public.system_settings from anon, authenticated;

-- ค่าเริ่มต้น: บอทเปิดทำงาน
insert into public.system_settings (key, value)
values ('bot_enabled', 'true'::jsonb)
on conflict (key) do nothing;

insert into public.system_settings (key, value)
values ('maintenance_message', '"ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง"'::jsonb)
on conflict (key) do nothing;

-- 2) dashboard_login_attempts — นับครั้งที่ใส่ PIN ผิด ต่อ IP
create table if not exists public.dashboard_login_attempts (
  ip           text primary key,
  attempts     integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.dashboard_login_attempts enable row level security;
revoke all on table public.dashboard_login_attempts from anon, authenticated;

create index if not exists idx_login_attempts_locked
  on public.dashboard_login_attempts (locked_until);

-- 3) RPC: บันทึกความพยายามล็อกอินที่ล้มเหลว + ล็อกเมื่อเกินโควตา
--    คืนค่า locked_until ปัจจุบัน (null = ยังไม่ล็อก)
create or replace function public.register_failed_login(
  p_ip text,
  p_max_attempts integer default 5,
  p_lock_minutes integer default 15
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_locked   timestamptz;
begin
  insert into public.dashboard_login_attempts (ip, attempts, updated_at)
  values (p_ip, 1, now())
  on conflict (ip) do update
    set attempts = public.dashboard_login_attempts.attempts + 1,
        updated_at = now()
  returning attempts, locked_until into v_attempts, v_locked;

  if v_attempts >= p_max_attempts then
    update public.dashboard_login_attempts
      set locked_until = now() + make_interval(mins => p_lock_minutes),
          attempts = 0
      where ip = p_ip
      returning locked_until into v_locked;
  end if;

  return v_locked;
end;
$$;

-- 4) RPC: เคลียร์ตัวนับเมื่อล็อกอินสำเร็จ
create or replace function public.clear_login_attempts(p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.dashboard_login_attempts where ip = p_ip;
end;
$$;
