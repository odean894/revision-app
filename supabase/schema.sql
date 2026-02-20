-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor) to create the tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Modules (each user has their own)
create table if not exists modules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at bigint not null
);

-- Files (uploaded PDF content)
create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  type text not null check (type in ('slides', 'tutorial', 'pastpaper')),
  name text not null,
  content text not null,
  uploaded_at bigint not null
);

-- Notes (AI-generated)
create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  source_file_id uuid references files(id) on delete set null,
  topic text not null,
  content text not null,
  created_at bigint not null
);

-- Quiz questions
create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  module_id uuid references modules(id) on delete cascade not null,
  question text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text
);

-- Quiz progress
create table if not exists quiz_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  module_id uuid not null,
  current_index int not null,
  score int not null,
  selected int,
  show_result boolean not null,
  question_count int not null,
  saved_at bigint not null,
  primary key (user_id, module_id)
);

-- Row Level Security: users can only access their own data
alter table modules enable row level security;
alter table files enable row level security;
alter table notes enable row level security;
alter table quizzes enable row level security;
alter table quiz_progress enable row level security;

create policy "Users can manage own modules" on modules
  for all using (auth.uid() = user_id);

create policy "Users can manage own files" on files
  for all using (auth.uid() = user_id);

create policy "Users can manage own notes" on notes
  for all using (auth.uid() = user_id);

create policy "Users can manage own quizzes" on quizzes
  for all using (auth.uid() = user_id);

create policy "Users can manage own quiz_progress" on quiz_progress
  for all using (auth.uid() = user_id);
