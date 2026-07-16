-- Safe to run multiple times.
alter table orders add column if not exists payment_status text not null default 'unpaid';
alter table orders add column if not exists payment_timing text not null default 'upon_delivery';
alter table orders add column if not exists amount_paid numeric(10,2) not null default 0;
alter table orders add column if not exists payment_submitted_at timestamptz;

do $$ begin
  alter table orders add constraint orders_payment_status_check
    check (payment_status in ('unpaid','submitted','partial','paid'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table orders add constraint orders_payment_timing_check
    check (payment_timing in ('before_delivery','upon_delivery','after_delivery'));
exception when duplicate_object then null; end $$;

create table if not exists payments (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  amount      numeric(10,2) not null,
  note        text,
  created_at  timestamptz default now()
);
alter table payments enable row level security;
drop policy if exists "Admin full access" on payments;
create policy "Admin full access" on payments for all using (auth.role() = 'authenticated');

create or replace view customer_balances as
select
  c.id as customer_id,
  coalesce(sum(o.total),0)                    as total_ordered,
  coalesce(sum(o.amount_paid),0)               as total_paid,
  coalesce(sum(o.total - o.amount_paid),0)     as balance_due
from customers c
left join orders o on o.customer_id = c.id and o.status != 'cancelled'
group by c.id;

do $$ begin
  alter publication supabase_realtime add table payments;
exception when duplicate_object then null; end $$;
