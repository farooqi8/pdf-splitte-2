-- Reference files, processing jobs, and job rows tables

create table if not exists reference_files (
  id uuid primary key default gen_random_uuid(),
  owner text check (owner in ('saad', 'gorman')) not null,
  permit_number text not null, -- normalised
  raw_permit text, -- original value
  owner_name text,
  plate_number text,
  tonnage text,
  classification text,
  uploaded_at timestamptz default now()
);

create index if not exists reference_files_owner_idx on reference_files (owner);
create index if not exists reference_files_permit_number_idx on reference_files (permit_number);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  status text check (status in ('pending','processing','complete','error')) default 'pending',
  total_rows integer,
  total_responses numeric(12,2),
  total_price numeric(12,2),
  saad_rows integer,
  gorman_rows integer,
  extra_rows integer,
  saad_pdf_url text,
  gorman_pdf_url text,
  extra_pdf_url text,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists processing_jobs_created_at_idx on processing_jobs (created_at desc);
create index if not exists processing_jobs_status_idx on processing_jobs (status);

create table if not exists job_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references processing_jobs(id) on delete cascade,
  permit_number text, -- normalised
  raw_permit text, -- original from PDF
  station text,
  responses numeric(12,2),
  price numeric(12,2),
  assigned_group text check (assigned_group in ('saad','gorman','extra')),
  row_index integer -- position in original PDF
);

create index if not exists job_rows_job_id_idx on job_rows (job_id);
create index if not exists job_rows_assigned_group_idx on job_rows (assigned_group);
create index if not exists job_rows_row_index_idx on job_rows (row_index);
