-- HueTrip GĐ1 – bước 2: đăng nhập (UX-08) và lưu chuyến đi.
-- Chạy SAU 20261021000001_init.sql: SQL Editor → dán toàn bộ → Run. Chạy lại nhiều lần được.
--
-- 1. Ghi nhận đồng ý ngay khi đăng ký (PR-01): app gửi danh sách đồng ý trong user metadata,
--    trigger tạo hồ sơ ghi luôn vào bảng consents → có bằng chứng phía server, không phụ thuộc trình duyệt.
-- 2. save_trip_version(): lưu một phiên bản lịch mới, nguyên tử, có khóa lạc quan theo version_no
--    (BR-VERSION-01). Sai số phiên bản → lỗi HTTP 409 kèm phiên bản hiện tại (quy ước mã lỗi trong SRS).

-- Lý do "Hợp với bạn" của phương án (để mở lại lịch trên thiết bị khác vẫn thấy).
alter table public.trip_versions add column if not exists reasons jsonb not null default '[]';

-- ---------------------------------------------------------------------
-- 1. Hồ sơ + sổ đồng ý khi có tài khoản mới
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  c jsonb;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  for c in select * from jsonb_array_elements(coalesce(new.raw_user_meta_data -> 'consents', '[]'::jsonb))
  loop
    insert into public.consents (user_id, purpose, data_categories, policy_version, status, granted_at, evidence)
    values (
      new.id,
      c ->> 'purpose',
      coalesce(array(select jsonb_array_elements_text(c -> 'data_categories')), '{}'),
      coalesce(c ->> 'policy_version', 'unknown'),
      'granted',
      now(),
      jsonb_build_object('source', 'signup_form', 'ui_text', c ->> 'ui_text', 'client_at', c ->> 'client_at')
    );
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Lưu phiên bản lịch
-- ---------------------------------------------------------------------
-- p_trip: { start_date, day_count, travel_with, party_size, budget_level, pace }
-- p_items: [{ place_id, kind, day_no, start_time "HH:MM", duration_min, travel_min, est_cost_vnd }]
-- p_trip_id null → tạo chuyến mới (phiên bản 1). Ngược lại p_expected_version phải bằng phiên bản hiện hành.
create or replace function public.save_trip_version(
  p_trip_id uuid,
  p_expected_version int,
  p_trip jsonb,
  p_plan_type public.plan_type,
  p_rule_version text,
  p_reasons jsonb,
  p_items jsonb
)
returns table (trip_id uuid, version_no int)
language plpgsql security invoker set search_path = public
as $$
declare
  v_trip uuid := p_trip_id;
  v_current int;
  v_version uuid;
begin
  if auth.uid() is null then
    raise exception 'Cần đăng nhập để lưu chuyến đi' using errcode = 'PT401';
  end if;

  if v_trip is null then
    insert into public.trips (owner_id, start_date, day_count, travel_with, party_size, budget_level, pace, status)
    values (
      auth.uid(),
      (p_trip ->> 'start_date')::date,
      (p_trip ->> 'day_count')::int,
      (p_trip ->> 'travel_with')::public.travel_with,
      (p_trip ->> 'party_size')::int,
      (p_trip ->> 'budget_level')::public.budget_level,
      (p_trip ->> 'pace')::public.trip_pace,
      'proposed'
    )
    returning id into v_trip;
    v_current := 0;
  else
    -- Khóa dòng chuyến đi để hai lần lưu đồng thời không cùng tạo phiên bản. RLS: chỉ thấy chuyến của mình.
    perform 1 from public.trips t where t.id = v_trip for update;
    if not found then
      -- AC-ROLE-02: không tiết lộ chuyến đi có tồn tại hay không.
      raise exception 'Không tìm thấy chuyến đi' using errcode = 'PT404';
    end if;

    select coalesce(max(v.version_no), 0) into v_current from public.trip_versions v where v.trip_id = v_trip;
    if p_expected_version is distinct from v_current then
      raise exception 'VERSION_CONFLICT'
        using errcode = 'PT409', detail = json_build_object('current_version', v_current)::text;
    end if;

    update public.trips set
      start_date = (p_trip ->> 'start_date')::date,
      day_count = (p_trip ->> 'day_count')::int,
      travel_with = (p_trip ->> 'travel_with')::public.travel_with,
      party_size = (p_trip ->> 'party_size')::int,
      budget_level = (p_trip ->> 'budget_level')::public.budget_level,
      pace = (p_trip ->> 'pace')::public.trip_pace,
      updated_at = now()
    where id = v_trip;

    update public.trip_versions set is_current = false where trip_versions.trip_id = v_trip and is_current;
  end if;

  insert into public.trip_versions (trip_id, version_no, plan_type, is_current, rule_version, reasons)
  values (v_trip, v_current + 1, p_plan_type, true, p_rule_version, coalesce(p_reasons, '[]'))
  returning id into v_version;

  insert into public.itinerary_items
    (trip_version_id, place_id, kind, day_no, start_time, duration_min, travel_min, est_cost_vnd)
  select v_version, i.place_id, i.kind, i.day_no, i.start_time::time, i.duration_min, i.travel_min, i.est_cost_vnd
  from jsonb_to_recordset(coalesce(p_items, '[]')) as i(
    place_id uuid, kind public.itinerary_kind, day_no int, start_time text,
    duration_min int, travel_min int, est_cost_vnd int
  );

  return query select v_trip, v_current + 1;
end $$;
