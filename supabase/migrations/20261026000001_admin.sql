-- HueTrip GĐ1 – bước 4: khu vực Admin (UX-A1 → A5, FR-ADM-01 → 06).
-- Chạy SAU các migration trước: SQL Editor → dán toàn bộ → Run. Chạy lại nhiều lần được.

-- FR-ADM-05: danh sách tài khoản kèm email cho admin. Email nằm ở auth.users (trình duyệt không đọc được),
-- nên dùng hàm security definer và tự kiểm tra quyền admin bên trong.
create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, role public.app_role, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Không có quyền' using errcode = 'PT403';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- FR-ADM-06: lọc nhật ký theo người thực hiện; hiển thị email thay vì uuid.
create or replace function public.admin_audit_log(p_actor uuid default null, p_from timestamptz default null, p_to timestamptz default null, p_limit int default 200)
returns table (id bigint, actor_id uuid, actor_email text, action text, entity text, entity_id uuid, before jsonb, after jsonb, at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Không có quyền' using errcode = 'PT403';
  end if;
  return query
    select a.id, a.actor_id, u.email::text, a.action, a.entity, a.entity_id, a.before, a.after, a.at
    from public.audit_log a
    left join auth.users u on u.id = a.actor_id
    where (p_actor is null or a.actor_id = p_actor)
      and (p_from is null or a.at >= p_from)
      and (p_to is null or a.at < p_to)
    order by a.at desc
    limit least(greatest(p_limit, 1), 1000);
end $$;

revoke all on function public.admin_audit_log(uuid, timestamptz, timestamptz, int) from public, anon;
grant execute on function public.admin_audit_log(uuid, timestamptz, timestamptz, int) to authenticated;
