-- HueTrip GĐ1 – bước 3: nơi ở của chuyến đi (F3, UX-07).
-- Chạy SAU 20261022000001_auth_trip_versions.sql: SQL Editor → dán toàn bộ → Run. Chạy lại nhiều lần được.
-- Nơi ở đã chọn là điểm xuất phát mỗi ngày khi xếp lịch và tính thời gian di chuyển (FR-F3-02).

alter table public.trips add column if not exists stay_place_id uuid references public.places (id);

-- Cập nhật save_trip_version: đọc thêm p_trip.stay_place_id. Phần còn lại giữ nguyên như bước 2.
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
  v_stay uuid := nullif(p_trip ->> 'stay_place_id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'Cần đăng nhập để lưu chuyến đi' using errcode = 'PT401';
  end if;

  if v_trip is null then
    insert into public.trips (owner_id, start_date, day_count, travel_with, party_size, budget_level, pace, status, stay_place_id)
    values (
      auth.uid(),
      (p_trip ->> 'start_date')::date,
      (p_trip ->> 'day_count')::int,
      (p_trip ->> 'travel_with')::public.travel_with,
      (p_trip ->> 'party_size')::int,
      (p_trip ->> 'budget_level')::public.budget_level,
      (p_trip ->> 'pace')::public.trip_pace,
      'proposed',
      v_stay
    )
    returning id into v_trip;
    v_current := 0;
  else
    perform 1 from public.trips t where t.id = v_trip for update;
    if not found then
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
      stay_place_id = v_stay,
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
