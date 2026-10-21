-- HueTrip GĐ1 – lược đồ cơ sở dữ liệu, phân quyền (RLS) và nhật ký thao tác.
-- Bám theo docs/SRS.md: "Từ điển dữ liệu chính", "Phân quyền", "Cách triển khai phân quyền ở GĐ1".
-- Chạy một lần trên dự án Supabase mới: SQL Editor → dán toàn bộ file → Run
-- (hoặc `supabase db push` nếu dùng Supabase CLI).
--
-- Khác biệt có chủ đích so với từ điển dữ liệu:
-- - categories.id là mã dạng chữ ('cat-tomb', 'cat-cafe') thay vì uuid: code GĐ1 dùng mã này để
--   phân biệt quán cà phê với quán ăn khi xếp lịch.
-- - places có thêm cột slug (duy nhất) để nạp lại dữ liệu mẫu nhiều lần không bị trùng.

-- =====================================================================
-- 0. Extension
-- =====================================================================
create extension if not exists postgis with schema extensions;

-- =====================================================================
-- 1. Kiểu enum
-- =====================================================================
create type public.app_role as enum ('traveler', 'partner', 'editor', 'admin');
create type public.place_layer as enum ('heritage', 'attraction', 'food', 'stay');
create type public.lodging_type as enum ('hotel', 'homestay');
create type public.price_status as enum ('estimated', 'confirmed', 'unknown');
create type public.confidence_level as enum ('high', 'medium', 'low');
create type public.publish_status as enum ('draft', 'pending', 'published', 'hidden');
create type public.trip_status as enum ('draft', 'proposed', 'confirmed', 'adjusting', 'in_progress', 'completed', 'cancelled');
create type public.trip_pace as enum ('relaxed', 'normal', 'packed');
create type public.budget_level as enum ('saving', 'moderate', 'comfortable');
create type public.travel_with as enum ('solo', 'couple', 'friends', 'family_kids', 'seniors');
create type public.plan_type as enum ('heritage', 'balanced', 'food_relax');
create type public.trip_member_role as enum ('owner', 'member');
create type public.itinerary_kind as enum ('visit', 'meal', 'cafe', 'evening');

-- =====================================================================
-- 2. Hồ sơ và vai trò (PROFILES)
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.app_role not null default 'traveler', -- SEC-ROLE-01
  created_at timestamptz not null default now()
);

-- Hàm kiểm tra vai trò. security definer để dùng được bên trong policy mà không bị đệ quy RLS.
create or replace function public.current_role_name()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() = 'admin', false) $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_name() in ('editor', 'admin'), false) $$;

-- Tạo hồ sơ khi có tài khoản mới (mặc định traveler).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- AC-ROLE-05, SEC-ROLE-06: chỉ admin được đổi vai trò, và không ai tự đổi vai trò của chính mình.
-- Khi chạy trong SQL Editor (auth.uid() null) thì được phép – dùng để tạo admin đầu tiên.
create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if not public.is_admin() or new.id = auth.uid() then
      raise exception 'Không có quyền đổi vai trò' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- =====================================================================
-- 3. Danh mục và địa điểm (PLACE)
-- =====================================================================
create table public.categories (
  id text primary key,
  name text not null,
  layer public.place_layer not null
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location extensions.geography(point, 4326) not null,
  primary_category_id text not null references public.categories (id),
  opening_hours jsonb,
  visit_duration_min int check (visit_duration_min > 0),
  price_min_vnd int check (price_min_vnd >= 0),
  price_max_vnd int check (price_max_vnd >= 0),
  price_status public.price_status not null default 'unknown',   -- BR-PRICE-01
  indoor boolean,
  source text not null,                                           -- BR-SOURCE-01
  updated_at timestamptz not null,                                -- ngày kiểm tra dữ liệu, do người nhập ghi
  confidence public.confidence_level,
  is_sponsored boolean not null default false,                    -- BR-MAP-05
  publish_status public.publish_status not null default 'draft',
  layer public.place_layer not null,
  lodging_type public.lodging_type,
  vegetarian_friendly boolean,
  address text,
  ward text,
  description text,
  highlight_tags text[] not null default '{}',
  image_url text,
  created_at timestamptz not null default now(),
  constraint price_range check (price_min_vnd is null or price_max_vnd is null or price_min_vnd <= price_max_vnd),
  -- lodging_type bắt buộc khi và chỉ khi layer = 'stay'
  constraint lodging_type_for_stay check ((layer = 'stay') = (lodging_type is not null)),
  -- UC-14 4a: thiếu nguồn thì không được xuất bản
  constraint publish_needs_source check (publish_status <> 'published' or length(trim(source)) > 0)
);

create index places_location_gix on public.places using gist (location);
create index places_status_layer_idx on public.places (publish_status, layer);

-- View có sẵn lat/lng cho frontend. security_invoker: RLS của bảng places vẫn áp dụng.
create view public.place_rows with (security_invoker = true) as
select
  p.id, p.slug, p.name,
  extensions.st_y(p.location::extensions.geometry) as lat,
  extensions.st_x(p.location::extensions.geometry) as lng,
  p.primary_category_id, p.opening_hours, p.visit_duration_min, p.price_min_vnd, p.price_max_vnd,
  p.price_status, p.indoor, p.source, p.updated_at, p.confidence, p.is_sponsored, p.publish_status,
  p.layer, p.lodging_type, p.vegetarian_friendly, p.address, p.ward, p.description, p.highlight_tags,
  p.image_url
from public.places p;

-- Truy vấn theo vùng bản đồ cho GET /api/map/places?bbox= (AC-F8.1-02).
create or replace function public.places_in_bbox(min_lng float8, min_lat float8, max_lng float8, max_lat float8)
returns setof public.place_rows
language sql stable security invoker set search_path = public, extensions
as $$
  select r.* from public.place_rows r
  join public.places p on p.id = r.id
  where p.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
$$;

-- =====================================================================
-- 4. Chuyến đi (TRIP / TRIP_MEMBER / TRIP_VERSION / ITINERARY_ITEM) và sở thích
-- =====================================================================
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Chuyến đi Huế',
  status public.trip_status not null default 'draft',
  start_date date not null,
  day_count int not null check (day_count between 1 and 14),
  travel_with public.travel_with not null,
  party_size int not null check (party_size between 1 and 50),
  budget_level public.budget_level not null,
  budget_vnd int check (budget_vnd >= 0),
  pace public.trip_pace not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_owner_idx on public.trips (owner_id);

-- GĐ1 chỉ có owner; bảng tạo sẵn cho GĐ2 (nhóm).
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.trip_member_role not null default 'owner',
  primary key (trip_id, user_id)
);

create table public.trip_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  version_no int not null,                  -- khóa lạc quan (BR-VERSION-01)
  plan_type public.plan_type not null,
  is_current boolean not null default false,
  rule_version text,                        -- truy vết bộ quy tắc sinh lịch
  created_at timestamptz not null default now(),
  unique (trip_id, version_no)
);
-- Mỗi chuyến chỉ một phiên bản hiện hành
create unique index trip_versions_one_current on public.trip_versions (trip_id) where is_current;

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_version_id uuid not null references public.trip_versions (id) on delete cascade,
  place_id uuid references public.places (id),
  kind public.itinerary_kind not null default 'visit',
  day_no int not null check (day_no >= 1),
  start_time time not null,
  duration_min int not null check (duration_min > 0),
  travel_min int check (travel_min >= 0),
  est_cost_vnd int check (est_cost_vnd >= 0),
  is_out_of_range boolean not null default false, -- BR-TRIP-01
  note text
);
create index itinerary_items_version_idx on public.itinerary_items (trip_version_id, day_no, start_time);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interests text[] not null default '{}',
  must_haves jsonb,                 -- BR-PREF-01
  dietary text[] not null default '{}', -- BR-PREF-02: chỉ lưu khi người dùng tự khai
  travel_with public.travel_with,
  updated_at timestamptz not null default now()
);

-- PR-01: sổ ghi nhận đồng ý (dùng ở màn UX-08)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose text not null,
  data_categories text[] not null default '{}',
  policy_version text not null,
  status text not null check (status in ('granted', 'withdrawn')),
  granted_at timestamptz,
  withdrawn_at timestamptz,
  evidence jsonb
);
create index consents_user_idx on public.consents (user_id);

-- Chủ chuyến tự động là owner trong trip_members.
create or replace function public.add_trip_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;

create trigger trips_add_owner
  after insert on public.trips
  for each row execute function public.add_trip_owner();

-- =====================================================================
-- 5. Nhật ký thao tác (AUDIT_LOG) – SEC-ROLE-02, AC-ROLE-04
-- =====================================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (action in ('create', 'update', 'publish', 'hide', 'delete', 'role_change')),
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);

create or replace function public.audit_places()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then
    act := 'create';
  elsif tg_op = 'DELETE' then
    act := 'delete';
  elsif new.publish_status is distinct from old.publish_status and new.publish_status = 'published' then
    act := 'publish';
  elsif new.publish_status is distinct from old.publish_status and new.publish_status = 'hidden' then
    act := 'hide';
  else
    act := 'update';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    auth.uid(), act, 'places',
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger places_audit
  after insert or update or delete on public.places
  for each row execute function public.audit_places();

create or replace function public.audit_role_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), 'role_change', 'profiles', new.id,
          jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  return new;
end $$;

create trigger profiles_audit_role
  after update of role on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function public.audit_role_change();

-- =====================================================================
-- 6. Row Level Security – bật cho MỌI bảng (SEC-ROLE-05, NFR-06)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.places enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_versions enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.audit_log enable row level security;

-- profiles: xem/sửa hồ sơ của mình; admin xem tất cả và đổi vai trò người khác.
create policy "profiles: xem của mình" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: sửa của mình" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- categories: ai cũng đọc; editor/admin ghi.
create policy "categories: đọc" on public.categories for select using (true);
create policy "categories: staff ghi" on public.categories for all using (public.is_staff()) with check (public.is_staff());

-- places: mọi người đọc điểm đã xuất bản; editor/admin đọc mọi trạng thái, thêm, sửa;
-- chỉ admin xóa vĩnh viễn (ma trận quyền).
create policy "places: đọc đã xuất bản" on public.places for select using (publish_status = 'published' or public.is_staff());
create policy "places: staff thêm" on public.places for insert with check (public.is_staff());
create policy "places: staff sửa" on public.places for update using (public.is_staff()) with check (public.is_staff());
create policy "places: admin xóa" on public.places for delete using (public.is_admin());

-- Chuyến đi: chỉ chủ chuyến (SEC-ROLE-03: editor/admin cũng không xem được chuyến của người khác).
create policy "trips: chủ chuyến" on public.trips for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "trip_members: thành viên xem" on public.trip_members for select using (user_id = auth.uid());

create policy "trip_versions: chủ chuyến" on public.trip_versions for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "itinerary_items: chủ chuyến" on public.itinerary_items for all
  using (exists (
    select 1 from public.trip_versions v join public.trips t on t.id = v.trip_id
    where v.id = trip_version_id and t.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.trip_versions v join public.trips t on t.id = v.trip_id
    where v.id = trip_version_id and t.owner_id = auth.uid()));

create policy "user_preferences: của mình" on public.user_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "consents: của mình" on public.consents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_log: chỉ admin đọc; ghi qua trigger (security definer), không ai sửa/xóa.
create policy "audit_log: admin đọc" on public.audit_log for select using (public.is_admin());
