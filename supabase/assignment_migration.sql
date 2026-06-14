-- Teacher-assigned classwork: assignments + auto-graded submissions
-- Run this after classroom_migration.sql

-- ── assignments ────────────────────────────────────────────────────────────────
-- Created by a teacher, tied to a chapter. Visible to all students.
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid not null references public.chapters(id) on delete cascade,
  teacher_id   uuid not null references public.teacher_profiles(id) on delete cascade,
  title        text not null,
  instructions text,
  due_date     timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists assignments_chapter_idx on public.assignments (chapter_id);
create index if not exists assignments_teacher_idx on public.assignments (teacher_id);

alter table public.assignments enable row level security;

create policy "assignments_select_authenticated"
  on public.assignments for select
  using (auth.uid() is not null);

-- ── assignment_submissions ────────────────────────────────────────────────────
-- One row per submission attempt. Auto-graded via the notes correction pipeline.
create table if not exists public.assignment_submissions (
  id                   uuid primary key default gen_random_uuid(),
  assignment_id        uuid not null references public.assignments(id) on delete cascade,
  profile_id           uuid not null references public.profiles(id) on delete cascade,
  attempt_number       int  not null default 1,
  image_urls           jsonb not null,
  annotated_image_urls jsonb,
  accuracy_score       int not null,
  teacher_summary      text,
  issues               jsonb,
  positives            jsonb,
  status               text not null check (status in ('passed', 'needs_resubmit')),
  submitted_at         timestamptz not null default now()
);

create index if not exists assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id);
create index if not exists assignment_submissions_profile_idx    on public.assignment_submissions (profile_id);

alter table public.assignment_submissions enable row level security;

create policy "assignment_submissions_select_own"
  on public.assignment_submissions for select
  using (profile_id in (
    select id from public.profiles where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "assignment_submissions_insert_own"
  on public.assignment_submissions for insert
  with check (profile_id in (
    select id from public.profiles where clerk_user_id = auth.jwt() ->> 'sub'
  ));
