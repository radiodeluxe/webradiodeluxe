create table public.radio_settings (
  id smallint primary key default 1 check (id = 1),
  stream_url text check (stream_url is null or stream_url ~ '^https://'),
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  youtube_url text check (youtube_url is null or youtube_url ~ '^https://'),
  contact_email text,
  updated_at timestamptz not null default now()
);
alter table public.radio_settings enable row level security;
revoke all on public.radio_settings from anon, authenticated;
grant select on public.radio_settings to anon, authenticated;
create policy "Public can read radio configuration" on public.radio_settings for select to anon, authenticated using (true);
insert into public.radio_settings (id) values (1);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) between 3 and 254 and email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  consent boolean not null check (consent = true),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert (email, consent) on public.newsletter_subscribers to anon, authenticated;
create policy "Visitors can subscribe with explicit consent" on public.newsletter_subscribers for insert to anon, authenticated with check (consent = true);
comment on table public.newsletter_subscribers is 'Private subscription list. Public clients can insert email and consent only; no read, update, or delete access. Campaigns are not active.';
