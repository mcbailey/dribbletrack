-- Sample data for previewing the app layout.
-- Safe to run more than once.

insert into public.players (name)
values
  ('Enela'),
  ('Alice'),
  ('Vibha'),
  ('Sophie'),
  ('Kinsley')
on conflict (name) do nothing;

with sample_sessions (player_name, practiced_on) as (
  values
    -- Recent sessions so streaks and "this week" look alive today.
    ('Alice', date '2026-03-16'),
    ('Alice', date '2026-03-17'),
    ('Enela', date '2026-03-15'),
    ('Enela', date '2026-03-16'),
    ('Enela', date '2026-03-17'),
    ('Vibha', date '2026-03-17'),
    ('Kinsley', date '2026-03-16'),
    ('Kinsley', date '2026-03-17'),

    -- Challenge sessions starting Monday, March 23, 2026.
    ('Alice', date '2026-03-23'),
    ('Alice', date '2026-03-24'),
    ('Alice', date '2026-03-26'),
    ('Alice', date '2026-03-27'),
    ('Alice', date '2026-03-30'),
    ('Alice', date '2026-04-01'),
    ('Alice', date '2026-04-03'),
    ('Alice', date '2026-04-06'),
    ('Alice', date '2026-04-08'),
    ('Alice', date '2026-04-10'),

    ('Enela', date '2026-03-23'),
    ('Enela', date '2026-03-25'),
    ('Enela', date '2026-03-26'),
    ('Enela', date '2026-03-27'),
    ('Enela', date '2026-03-30'),
    ('Enela', date '2026-03-31'),
    ('Enela', date '2026-04-02'),
    ('Enela', date '2026-04-04'),
    ('Enela', date '2026-04-06'),
    ('Enela', date '2026-04-08'),
    ('Enela', date '2026-04-10'),
    ('Enela', date '2026-04-13'),

    ('Vibha', date '2026-03-23'),
    ('Vibha', date '2026-03-24'),
    ('Vibha', date '2026-03-28'),
    ('Vibha', date '2026-03-31'),
    ('Vibha', date '2026-04-02'),
    ('Vibha', date '2026-04-05'),
    ('Vibha', date '2026-04-07'),
    ('Vibha', date '2026-04-09'),

    ('Sophie', date '2026-03-23'),
    ('Sophie', date '2026-03-24'),
    ('Sophie', date '2026-03-25'),
    ('Sophie', date '2026-03-27'),
    ('Sophie', date '2026-03-30'),
    ('Sophie', date '2026-04-01'),
    ('Sophie', date '2026-04-02'),
    ('Sophie', date '2026-04-04'),
    ('Sophie', date '2026-04-06'),
    ('Sophie', date '2026-04-07'),
    ('Sophie', date '2026-04-09'),
    ('Sophie', date '2026-04-11'),
    ('Sophie', date '2026-04-14'),
    ('Sophie', date '2026-04-16'),

    ('Kinsley', date '2026-03-23'),
    ('Kinsley', date '2026-03-26'),
    ('Kinsley', date '2026-03-27'),
    ('Kinsley', date '2026-03-31'),
    ('Kinsley', date '2026-04-03'),
    ('Kinsley', date '2026-04-07'),
    ('Kinsley', date '2026-04-10')
)
insert into public.sessions (player_id, practiced_on)
select players.id, sample_sessions.practiced_on
from sample_sessions
join public.players as players
  on players.name = sample_sessions.player_name
on conflict (player_id, practiced_on) do nothing;
