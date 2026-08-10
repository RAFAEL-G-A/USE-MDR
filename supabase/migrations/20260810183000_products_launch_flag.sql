alter table public.products
add column if not exists is_launch boolean not null default false;

update public.products
set is_launch = true
where id in (
  select id
  from public.products
  order by created_at desc
  limit 4
);
