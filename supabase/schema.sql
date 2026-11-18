-- Карта для доставщиков. Таблицы dl_* в проекте Baydarka. Всё закрыто RLS, доступ только через RPC.
create extension if not exists pgcrypto with schema extensions;

create table if not exists dl_users(
  id uuid primary key default gen_random_uuid(),
  login text unique not null,
  pass_hash text not null,
  role text not null check (role in ('admin','agent','courier')),
  name text not null default '',
  phone text not null default '',
  capacity numeric not null default 0,      -- вместимость грузовика в «местах» (для доставщика)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists dl_sessions(
  token text primary key,
  user_id uuid not null references dl_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create table if not exists dl_points(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shop','warehouse')),
  name text not null,
  address text not null default '',
  phone text not null default '',
  lat double precision not null,
  lng double precision not null,
  created_by uuid references dl_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists dl_products(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'шт' check (unit in ('шт','блок','коробка')),
  cap numeric not null default 1,           -- сколько «мест» в кузове занимает единица
  created_at timestamptz not null default now()
);
create table if not exists dl_stock(
  warehouse_id uuid not null references dl_points(id) on delete cascade,
  product_id uuid not null references dl_products(id) on delete cascade,
  qty numeric not null default 0 check (qty >= 0),
  primary key (warehouse_id, product_id)
);
create table if not exists dl_moves(
  id bigserial primary key,
  warehouse_id uuid references dl_points(id) on delete set null,
  product_id uuid references dl_products(id) on delete set null,
  delta numeric not null,
  reason text not null default '',
  user_id uuid references dl_users(id) on delete set null,
  order_id uuid,
  ts timestamptz not null default now()
);
create table if not exists dl_orders(
  id uuid primary key default gen_random_uuid(),
  no bigserial,
  shop_id uuid not null references dl_points(id) on delete cascade,
  agent_id uuid references dl_users(id) on delete set null,
  courier_id uuid references dl_users(id) on delete set null,
  status text not null default 'new' check (status in ('new','assigned','picked','delivered','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  picked_at timestamptz,
  delivered_at timestamptz
);
create table if not exists dl_order_items(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references dl_orders(id) on delete cascade,
  product_id uuid not null references dl_products(id) on delete cascade,
  qty numeric not null check (qty > 0),
  picked numeric not null default 0
);
create table if not exists dl_marks(           -- точки, отмеченные доставщику (самим или админом), без заказа
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references dl_users(id) on delete cascade,
  point_id uuid not null references dl_points(id) on delete cascade,
  added_by uuid references dl_users(id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique (courier_id, point_id)
);
create table if not exists dl_locations(
  user_id uuid primary key references dl_users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  ts timestamptz not null default now()
);
create index if not exists dl_orders_status on dl_orders(status);
create index if not exists dl_items_order on dl_order_items(order_id);

alter table dl_users enable row level security;
alter table dl_sessions enable row level security;
alter table dl_points enable row level security;
alter table dl_products enable row level security;
alter table dl_stock enable row level security;
alter table dl_moves enable row level security;
alter table dl_orders enable row level security;
alter table dl_order_items enable row level security;
alter table dl_marks enable row level security;
alter table dl_locations enable row level security;
revoke all on dl_users, dl_sessions, dl_points, dl_products, dl_stock, dl_moves, dl_orders, dl_order_items, dl_marks, dl_locations from anon, authenticated;

-- ===== вспомогательные =====
create or replace function dl_me(p_token text) returns dl_users
language plpgsql security definer set search_path = public, extensions as $$
declare u dl_users;
begin
  select us.* into u from dl_sessions s join dl_users us on us.id = s.user_id
   where s.token = p_token and s.expires_at > now() and us.active;
  if u.id is null then raise exception 'auth'; end if;
  return u;
end $$;

create or replace function dl_need(p_token text, p_roles text[]) returns dl_users
language plpgsql security definer set search_path = public, extensions as $$
declare u dl_users;
begin
  u := dl_me(p_token);
  if not (u.role = any(p_roles)) then raise exception 'forbidden'; end if;
  return u;
end $$;

-- ===== вход =====
create or replace function dl_login(p_login text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u dl_users; t text;
begin
  select * into u from dl_users where lower(login) = lower(trim(p_login)) and active;
  if u.id is null or u.pass_hash <> crypt(p_pass, u.pass_hash) then raise exception 'bad_login'; end if;
  t := encode(gen_random_bytes(24), 'hex');
  insert into dl_sessions(token, user_id) values (t, u.id);
  delete from dl_sessions where expires_at < now();
  return jsonb_build_object('token', t, 'role', u.role, 'id', u.id, 'name', u.name);
end $$;

create or replace function dl_logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from dl_sessions where token = p_token;
$$;

-- ===== снимок данных по роли =====
create or replace function dl_snapshot(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u dl_users; r jsonb;
begin
  u := dl_me(p_token);
  select jsonb_build_object(
    'me', jsonb_build_object('id',u.id,'role',u.role,'name',u.name,'login',u.login,'phone',u.phone,'capacity',u.capacity),
    'users', case when u.role='admin'
        then coalesce((select jsonb_agg(jsonb_build_object('id',id,'login',login,'role',role,'name',name,'phone',phone,'capacity',capacity,'active',active) order by role,name) from dl_users),'[]')
        else coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'name',name,'phone',phone)) from dl_users where role='courier' and active),'[]') end,
    'points', coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'name',name,'address',address,'phone',phone,'lat',lat,'lng',lng,'created_by',created_by) order by name) from dl_points),'[]'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'cap',cap) order by name) from dl_products),'[]'),
    'stock', coalesce((select jsonb_agg(jsonb_build_object('w',warehouse_id,'p',product_id,'q',qty)) from dl_stock where qty>0),'[]'),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',o.id,'no',o.no,'shop_id',o.shop_id,'agent_id',o.agent_id,'courier_id',o.courier_id,'status',o.status,'note',o.note,
        'created_at',o.created_at,'delivered_at',o.delivered_at,
        'items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'p',i.product_id,'q',i.qty,'picked',i.picked)),'[]') from dl_order_items i where i.order_id=o.id)
      ) order by o.created_at desc)
      from dl_orders o
      where (u.role='admin' or (u.role='agent' and o.agent_id=u.id) or (u.role='courier' and o.courier_id=u.id))
        and (o.status in ('new','assigned','picked') or o.created_at > now() - interval '3 days')
    ),'[]'),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('id',id,'courier_id',courier_id,'point_id',point_id,'done',done))
        from dl_marks where (u.role='admin' or courier_id=u.id) and (not done or created_at > now() - interval '1 day')),'[]'),
    'locations', case when u.role='admin'
        then coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'lat',lat,'lng',lng,'ts',ts)) from dl_locations where ts > now() - interval '1 day'),'[]')
        else '[]'::jsonb end
  ) into r;
  return r;
end $$;

-- ===== пользователи (админ) =====
create or replace function dl_user_save(p_token text, p_id uuid, p_login text, p_pass text, p_role text, p_name text, p_phone text, p_capacity numeric, p_active boolean) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare a dl_users; nid uuid;
begin
  a := dl_need(p_token, array['admin']);
  if p_role not in ('admin','agent','courier') then raise exception 'bad_role'; end if;
  if p_id is null then
    if coalesce(trim(p_login),'')='' or coalesce(p_pass,'')='' then raise exception 'need_login_pass'; end if;
    if exists(select 1 from dl_users where lower(login)=lower(trim(p_login))) then raise exception 'login_taken'; end if;
    insert into dl_users(login,pass_hash,role,name,phone,capacity,active)
      values (trim(p_login), crypt(p_pass, gen_salt('bf')), p_role, coalesce(p_name,''), coalesce(p_phone,''), coalesce(p_capacity,0), coalesce(p_active,true))
      returning id into nid;
    return nid;
  end if;
  if exists(select 1 from dl_users where lower(login)=lower(trim(p_login)) and id<>p_id) then raise exception 'login_taken'; end if;
  update dl_users set login=coalesce(nullif(trim(p_login),''),login), role=p_role, name=coalesce(p_name,''), phone=coalesce(p_phone,''),
      capacity=coalesce(p_capacity,0), active=coalesce(p_active,true),
      pass_hash = case when coalesce(p_pass,'')<>'' then crypt(p_pass, gen_salt('bf')) else pass_hash end
   where id=p_id;
  if p_id = a.id and (p_role<>'admin' or not coalesce(p_active,true)) then raise exception 'self_lock'; end if;
  if not coalesce(p_active,true) then delete from dl_sessions where user_id=p_id; end if;
  return p_id;
end $$;

create or replace function dl_user_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a dl_users;
begin
  a := dl_need(p_token, array['admin']);
  if p_id = a.id then raise exception 'self_lock'; end if;
  delete from dl_users where id = p_id;
end $$;

-- смена своего пароля
create or replace function dl_change_pass(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u dl_users;
begin
  u := dl_me(p_token);
  if u.pass_hash <> crypt(p_old, u.pass_hash) then raise exception 'bad_login'; end if;
  if length(coalesce(p_new,'')) < 4 then raise exception 'short_pass'; end if;
  update dl_users set pass_hash = crypt(p_new, gen_salt('bf')) where id = u.id;
end $$;

-- ===== точки =====
create or replace function dl_point_save(p_token text, p_id uuid, p_kind text, p_name text, p_address text, p_phone text, p_lat double precision, p_lng double precision) returns uuid
language plpgsql security definer set search_path = public as $$
declare u dl_users; nid uuid; old dl_points;
begin
  u := dl_me(p_token);
  if p_kind not in ('shop','warehouse') then raise exception 'bad_kind'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'need_name'; end if;
  if p_lat is null or p_lng is null then raise exception 'need_coords'; end if;
  if p_kind='warehouse' and u.role<>'admin' then raise exception 'forbidden'; end if;
  if p_id is null then
    insert into dl_points(kind,name,address,phone,lat,lng,created_by) values (p_kind,trim(p_name),coalesce(p_address,''),coalesce(p_phone,''),p_lat,p_lng,u.id) returning id into nid;
    return nid;
  end if;
  select * into old from dl_points where id=p_id;
  if old.id is null then raise exception 'not_found'; end if;
  if u.role<>'admin' and old.created_by is distinct from u.id then raise exception 'forbidden'; end if;
  update dl_points set name=trim(p_name), address=coalesce(p_address,''), phone=coalesce(p_phone,''), lat=p_lat, lng=p_lng where id=p_id;
  return p_id;
end $$;

create or replace function dl_point_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform dl_need(p_token, array['admin']);
  if exists(select 1 from dl_orders where shop_id=p_id and status in ('new','assigned','picked')) then raise exception 'point_busy'; end if;
  delete from dl_points where id = p_id;
end $$;

-- ===== товары и склад =====
create or replace function dl_product_save(p_token text, p_id uuid, p_name text, p_unit text, p_cap numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  perform dl_need(p_token, array['admin']);
  if coalesce(trim(p_name),'')='' then raise exception 'need_name'; end if;
  if p_unit not in ('шт','блок','коробка') then raise exception 'bad_unit'; end if;
  if p_id is null then
    insert into dl_products(name,unit,cap) values (trim(p_name),p_unit,greatest(coalesce(p_cap,1),0)) returning id into nid; return nid;
  end if;
  update dl_products set name=trim(p_name), unit=p_unit, cap=greatest(coalesce(p_cap,1),0) where id=p_id;
  return p_id;
end $$;

create or replace function dl_product_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform dl_need(p_token, array['admin']);
  if exists(select 1 from dl_order_items i join dl_orders o on o.id=i.order_id where i.product_id=p_id and o.status in ('new','assigned','picked')) then raise exception 'product_busy'; end if;
  delete from dl_products where id = p_id;
end $$;

-- приход (+) / списание или корректировка (−)
create or replace function dl_stock_move(p_token text, p_warehouse uuid, p_product uuid, p_delta numeric, p_reason text) returns numeric
language plpgsql security definer set search_path = public as $$
declare u dl_users; q numeric;
begin
  u := dl_need(p_token, array['admin']);
  if p_delta = 0 or p_delta is null then raise exception 'bad_qty'; end if;
  if not exists(select 1 from dl_points where id=p_warehouse and kind='warehouse') then raise exception 'not_found'; end if;
  insert into dl_stock(warehouse_id,product_id,qty) values (p_warehouse,p_product,0) on conflict do nothing;
  update dl_stock set qty = qty + p_delta where warehouse_id=p_warehouse and product_id=p_product returning qty into q;
  if q < 0 then raise exception 'not_enough_stock'; end if;
  insert into dl_moves(warehouse_id,product_id,delta,reason,user_id) values (p_warehouse,p_product,p_delta,coalesce(p_reason,''),u.id);
  return q;
end $$;

create or replace function dl_moves_list(p_token text, p_warehouse uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform dl_need(p_token, array['admin']);
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id',m.id,'p',m.product_id,'delta',m.delta,'reason',m.reason,'ts',m.ts,'user',us.name,'order_id',m.order_id) x
    from dl_moves m left join dl_users us on us.id=m.user_id
    where m.warehouse_id=p_warehouse order by m.ts desc limit 100) t),'[]');
end $$;

-- ===== заказы =====
create or replace function dl_order_create(p_token text, p_shop uuid, p_items jsonb, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u dl_users; oid uuid; it jsonb;
begin
  u := dl_need(p_token, array['admin','agent']);
  if not exists(select 1 from dl_points where id=p_shop and kind='shop') then raise exception 'not_found'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'need_items'; end if;
  insert into dl_orders(shop_id,agent_id,note) values (p_shop, u.id, coalesce(p_note,'')) returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'q')::numeric <= 0 then raise exception 'bad_qty'; end if;
    insert into dl_order_items(order_id,product_id,qty) values (oid,(it->>'p')::uuid,(it->>'q')::numeric);
  end loop;
  return oid;
end $$;

create or replace function dl_order_cap(p_courier uuid, p_exclude uuid) returns numeric
language sql security definer set search_path = public as $$
  select coalesce(sum(i.qty * p.cap),0) from dl_orders o join dl_order_items i on i.order_id=o.id join dl_products p on p.id=i.product_id
   where o.courier_id=p_courier and o.status in ('assigned','picked') and o.id is distinct from p_exclude;
$$;

create or replace function dl_order_assign(p_token text, p_order uuid, p_courier uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o dl_orders; c dl_users; need numeric;
begin
  perform dl_need(p_token, array['admin']);
  select * into o from dl_orders where id=p_order;
  if o.id is null then raise exception 'not_found'; end if;
  if o.status not in ('new','assigned') then raise exception 'bad_status'; end if;
  if p_courier is null then
    update dl_orders set courier_id=null, status='new', assigned_at=null where id=p_order; return;
  end if;
  select * into c from dl_users where id=p_courier and role='courier' and active;
  if c.id is null then raise exception 'not_found'; end if;
  select coalesce(sum(i.qty*p.cap),0) into need from dl_order_items i join dl_products p on p.id=i.product_id where i.order_id=p_order;
  if c.capacity > 0 and dl_order_cap(p_courier, p_order) + need > c.capacity then raise exception 'over_capacity'; end if;
  update dl_orders set courier_id=p_courier, status='assigned', assigned_at=now() where id=p_order;
end $$;

create or replace function dl_order_cancel(p_token text, p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users; o dl_orders; i record;
begin
  u := dl_need(p_token, array['admin','agent']);
  select * into o from dl_orders where id=p_order;
  if o.id is null then raise exception 'not_found'; end if;
  if u.role='agent' and (o.agent_id is distinct from u.id or o.status<>'new') then raise exception 'forbidden'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'bad_status'; end if;
  -- возвращаем уже забранное обратно на склад-источник нельзя определить; возврат делает админ приходом
  update dl_orders set status='cancelled' where id=p_order;
end $$;

-- доставщик забирает на складе всё, что ему нужно и что есть
create or replace function dl_pickup(p_token text, p_warehouse uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u dl_users; it record; have numeric; take numeric; got jsonb := '[]'; oid uuid;
begin
  u := dl_need(p_token, array['courier']);
  if not exists(select 1 from dl_points where id=p_warehouse and kind='warehouse') then raise exception 'not_found'; end if;
  for it in
    select i.id, i.order_id, i.product_id, i.qty - i.picked as rest
      from dl_order_items i join dl_orders o on o.id=i.order_id
     where o.courier_id=u.id and o.status='assigned' and i.picked < i.qty
     order by o.created_at
  loop
    select qty into have from dl_stock where warehouse_id=p_warehouse and product_id=it.product_id for update;
    have := coalesce(have,0);
    take := least(have, it.rest);
    if take > 0 then
      update dl_stock set qty = qty - take where warehouse_id=p_warehouse and product_id=it.product_id;
      update dl_order_items set picked = picked + take where id=it.id;
      insert into dl_moves(warehouse_id,product_id,delta,reason,user_id,order_id) values (p_warehouse,it.product_id,-take,'order',u.id,it.order_id);
      got := got || jsonb_build_object('p',it.product_id,'q',take);
    end if;
  end loop;
  for oid in select o.id from dl_orders o where o.courier_id=u.id and o.status='assigned'
              and not exists(select 1 from dl_order_items i where i.order_id=o.id and i.picked < i.qty) loop
    update dl_orders set status='picked', picked_at=now() where id=oid;
  end loop;
  return got;
end $$;

create or replace function dl_deliver(p_token text, p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users; o dl_orders;
begin
  u := dl_need(p_token, array['courier']);
  select * into o from dl_orders where id=p_order and courier_id=u.id;
  if o.id is null then raise exception 'not_found'; end if;
  if o.status <> 'picked' then raise exception 'not_picked'; end if;
  update dl_orders set status='delivered', delivered_at=now() where id=p_order;
end $$;

-- ===== отмеченные точки =====
create or replace function dl_mark_add(p_token text, p_point uuid, p_courier uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users; cid uuid;
begin
  u := dl_need(p_token, array['admin','courier']);
  cid := case when u.role='courier' then u.id else p_courier end;
  if cid is null or not exists(select 1 from dl_users where id=cid and role='courier') then raise exception 'not_found'; end if;
  if not exists(select 1 from dl_points where id=p_point) then raise exception 'not_found'; end if;
  insert into dl_marks(courier_id,point_id,added_by) values (cid,p_point,u.id)
    on conflict (courier_id,point_id) do update set done=false;
end $$;

create or replace function dl_mark_done(p_token text, p_mark uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users;
begin
  u := dl_need(p_token, array['admin','courier']);
  update dl_marks set done=coalesce(p_done,true) where id=p_mark and (u.role='admin' or courier_id=u.id);
end $$;

create or replace function dl_mark_delete(p_token text, p_mark uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users;
begin
  u := dl_need(p_token, array['admin','courier']);
  delete from dl_marks where id=p_mark and (u.role='admin' or courier_id=u.id);
end $$;

-- ===== положение доставщика =====
create or replace function dl_location(p_token text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users;
begin
  u := dl_need(p_token, array['courier']);
  insert into dl_locations(user_id,lat,lng,ts) values (u.id,p_lat,p_lng,now())
    on conflict (user_id) do update set lat=excluded.lat, lng=excluded.lng, ts=now();
end $$;

revoke execute on function dl_me(text), dl_need(text,text[]), dl_order_cap(uuid,uuid) from public, anon, authenticated;
grant execute on function
  dl_login(text,text), dl_logout(text), dl_snapshot(text),
  dl_user_save(text,uuid,text,text,text,text,text,numeric,boolean), dl_user_delete(text,uuid), dl_change_pass(text,text,text),
  dl_point_save(text,uuid,text,text,text,text,double precision,double precision), dl_point_delete(text,uuid),
  dl_product_save(text,uuid,text,text,numeric), dl_product_delete(text,uuid),
  dl_stock_move(text,uuid,uuid,numeric,text), dl_moves_list(text,uuid),
  dl_order_create(text,uuid,jsonb,text), dl_order_assign(text,uuid,uuid), dl_order_cancel(text,uuid),
  dl_pickup(text,uuid), dl_deliver(text,uuid),
  dl_mark_add(text,uuid,uuid), dl_mark_done(text,uuid,boolean), dl_mark_delete(text,uuid),
  dl_location(text,double precision,double precision)
  to anon, authenticated;

-- v1.1.0: отчёты админа (см. миграцию dl_report)
create or replace function dl_report(p_token text, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; r jsonb; d int := least(greatest(coalesce(p_days,1),1),366);
begin
  perform dl_need(p_token, array['admin']);
  v_from := (date_trunc('day', now() at time zone 'Asia/Tashkent') - (d-1) * interval '1 day') at time zone 'Asia/Tashkent';
  select jsonb_build_object(
    'created',(select count(*) from dl_orders where created_at >= v_from),
    'delivered',(select count(*) from dl_orders where status='delivered' and delivered_at >= v_from),
    'cancelled',(select count(*) from dl_orders where status='cancelled' and created_at >= v_from),
    'open',(select count(*) from dl_orders where status in ('new','assigned','picked')),
    'couriers',coalesce((select jsonb_agg(x order by (x->>'delivered')::int desc) from (select jsonb_build_object('id',u.id,'name',u.name,'delivered',count(o.id),'units',coalesce((select sum(i.qty) from dl_order_items i where i.order_id = any(array_agg(o.id))),0)) x from dl_users u join dl_orders o on o.courier_id=u.id and o.status='delivered' and o.delivered_at >= v_from group by u.id,u.name) t),'[]'),
    'agents',coalesce((select jsonb_agg(x order by (x->>'orders')::int desc) from (select jsonb_build_object('id',u.id,'name',u.name,'orders',count(o.id),'delivered',count(o.id) filter (where o.status='delivered')) x from dl_users u join dl_orders o on o.agent_id=u.id and o.created_at >= v_from group by u.id,u.name) t),'[]'),
    'products',coalesce((select jsonb_agg(x order by (x->>'q')::numeric desc) from (select jsonb_build_object('p',i.product_id,'q',sum(i.qty)) x from dl_order_items i join dl_orders o on o.id=i.order_id where o.status='delivered' and o.delivered_at >= v_from group by i.product_id) t),'[]'),
    'shops',coalesce((select jsonb_agg(x order by (x->>'n')::int desc) from (select jsonb_build_object('id',o.shop_id,'n',count(*)) x from dl_orders o where o.status='delivered' and o.delivered_at >= v_from group by o.shop_id limit 10) t),'[]')
  ) into r;
  return r;
end $$;
grant execute on function dl_report(text,int) to anon, authenticated;

-- v1.2.0: агент тоже передаёт положение; админ может войти под сотрудником без пароля
create or replace function dl_location(p_token text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
declare u dl_users;
begin
  u := dl_need(p_token, array['courier','agent']);
  insert into dl_locations(user_id,lat,lng,ts) values (u.id,p_lat,p_lng,now())
    on conflict (user_id) do update set lat=excluded.lat, lng=excluded.lng, ts=now();
end $$;
create or replace function dl_impersonate(p_token text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t text; u dl_users;
begin
  perform dl_need(p_token, array['admin']);
  select * into u from dl_users where id = p_user and active;
  if u.id is null then raise exception 'not_found'; end if;
  t := encode(gen_random_bytes(24), 'hex');
  insert into dl_sessions(token, user_id, expires_at) values (t, u.id, now() + interval '12 hours');
  return jsonb_build_object('token', t, 'role', u.role, 'id', u.id, 'name', u.name);
end $$;
grant execute on function dl_impersonate(text,uuid) to anon, authenticated;
