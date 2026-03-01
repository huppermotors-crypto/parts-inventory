create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  action text not null,
  details text,
  part_id uuid references parts(id) on delete set null,
  created_at timestamptz default now() not null
);

-- RLS: only authenticated admin can insert/read
alter table activity_log enable row level security;

create policy "Admin can insert activity_log"
  on activity_log for insert
  to authenticated
  with check (auth.email() = 'nvn9586@gmail.com');

create policy "Admin can read activity_log"
  on activity_log for select
  to authenticated
  using (auth.email() = 'nvn9586@gmail.com');

-- Admin can delete (for rotation)
create policy "Admin can delete activity_log"
  on activity_log for delete
  to authenticated
  using (auth.email() = 'nvn9586@gmail.com');

-- Index for fast lookups
create index idx_activity_log_created_at on activity_log (created_at desc);

-- RPC: get activity_log table size in bytes
create or replace function get_activity_log_size()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'size_bytes', pg_total_relation_size('activity_log'),
    'row_count', (select count(*) from activity_log)
  );
$$;

-- Archive table for rotated logs
create table if not exists activity_log_archive (
  id uuid primary key,
  action text not null,
  details text,
  part_id uuid,
  created_at timestamptz not null,
  archived_at timestamptz default now() not null
);

alter table activity_log_archive enable row level security;

create policy "Admin can read activity_log_archive"
  on activity_log_archive for select
  to authenticated
  using (auth.email() = 'nvn9586@gmail.com');

create policy "Admin can insert activity_log_archive"
  on activity_log_archive for insert
  to authenticated
  with check (auth.email() = 'nvn9586@gmail.com');

-- RPC: rotate activity_log — move old entries to archive, keep last 1000
create or replace function rotate_activity_log()
returns void
language sql
security definer
as $$
  insert into activity_log_archive (id, action, details, part_id, created_at)
  select id, action, details, part_id, created_at
  from activity_log
  where id not in (
    select id from activity_log
    order by created_at desc
    limit 1000
  );

  delete from activity_log
  where id not in (
    select id from activity_log
    order by created_at desc
    limit 1000
  );
$$;

-- RPC: get archive info
create or replace function get_activity_log_archives()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'size_bytes', pg_total_relation_size('activity_log_archive'),
    'row_count', (select count(*) from activity_log_archive),
    'oldest', (select min(created_at) from activity_log_archive),
    'newest', (select max(created_at) from activity_log_archive)
  );
$$;
