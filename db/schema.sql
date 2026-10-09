-- Aangan enquiry desk. Lives in the same Neon database as Case 02; every table is prefixed aangan_.

CREATE TABLE IF NOT EXISTS aangan_calls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source             TEXT NOT NULL,                 -- simulator | vaani | api
  external_id        TEXT UNIQUE,                   -- Vaani call id (idempotency)
  sample_ref         TEXT,                          -- T01..T20 when replayed from the September transcripts
  caller_phone       TEXT,                          -- kept here only; never sent to the AI
  caller_name        TEXT,
  started_at         TIMESTAMPTZ NOT NULL,
  duration_sec       INTEGER,
  answer_sec         NUMERIC,                       -- seconds until the call was picked up
  transcript         TEXT NOT NULL,
  recording_url      TEXT,
  raw_payload        JSONB,
  status             TEXT NOT NULL DEFAULT 'processing', -- processing | done | error
  error              TEXT,
  facts              JSONB,                         -- what the AI extracted
  criteria           JSONB,                         -- Nikhil's 5 criteria, decided by code
  route              TEXT,                          -- book | book_note | close | nurture | escalate | incomplete
  route_reason       TEXT,
  flags              TEXT[] NOT NULL DEFAULT '{}',
  handoff_note       TEXT,
  band_low           BIGINT,                        -- internal indicative ₹ band, never said to the caller
  band_high          BIGINT,
  band_basis         TEXT,
  override_route     TEXT,                          -- a person's override of the code's route
  override_note      TEXT,
  overridden_at      TIMESTAMPTZ,
  reviewed_at        TIMESTAMPTZ,                   -- front desk reviewed a closed call
  claimed_by         TEXT,
  claimed_at         TIMESTAMPTZ,
  booking_start      TIMESTAMPTZ,
  booking_uid        TEXT,
  hubspot            JSONB NOT NULL DEFAULT '{}',
  telegram           JSONB NOT NULL DEFAULT '{}',
  calcom             JSONB NOT NULL DEFAULT '{}',
  voice_inr          NUMERIC NOT NULL DEFAULT 0,
  ai_input_tokens    INTEGER NOT NULL DEFAULT 0,
  ai_output_tokens   INTEGER NOT NULL DEFAULT 0,
  ai_inr             NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS aangan_calls_started_idx ON aangan_calls (started_at DESC);
CREATE INDEX IF NOT EXISTS aangan_calls_phone_idx ON aangan_calls (caller_phone);

CREATE TABLE IF NOT EXISTS aangan_events (
  id        BIGSERIAL PRIMARY KEY,
  call_id   UUID REFERENCES aangan_calls(id) ON DELETE CASCADE,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind      TEXT NOT NULL,
  detail    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS aangan_events_call_idx ON aangan_events (call_id, at);

-- Consultations the voice agent booked mid-call (Vaani custom tool). Claimed by the call record once its
-- transcript arrives, matched on time window and caller phone/name.
CREATE TABLE IF NOT EXISTS aangan_tool_bookings (
  booking_uid   TEXT PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_at      TIMESTAMPTZ NOT NULL,
  caller_name   TEXT,
  caller_phone  TEXT,
  site_visit    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  call_id       UUID REFERENCES aangan_calls(id) ON DELETE SET NULL
);
