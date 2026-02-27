-- GF_STRIPE_START
-- +goose Up
-- create "subscriptions" table
create table if not exists subscriptions (
    id uuid primary key default uuidv7(),
    created timestamptz not null default current_timestamp,
    updated timestamptz not null default current_timestamp,
    user_id uuid not null references users(id) on delete cascade,
    stripe_customer_id text not null,
    stripe_subscription_id text not null,
    stripe_price_id text not null,
    status text not null default 'active',
    current_period_start timestamptz not null,
    current_period_end timestamptz not null,
    canceled_at timestamptz,
    unique (stripe_subscription_id)
);

create index idx_subscriptions_user_id on subscriptions(user_id);
create index idx_subscriptions_stripe_customer_id on subscriptions(stripe_customer_id);

-- +goose Down
drop table if exists subscriptions;
-- GF_STRIPE_END
