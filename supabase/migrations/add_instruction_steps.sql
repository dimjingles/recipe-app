-- Structured step representation derived from the instructions text blob.
-- The raw `instructions` text column remains the editable source of truth;
-- this column stores a JSONB array of InstructionStep objects computed by AI
-- at save time so the UI can render numbered cards with typed highlight tokens.
alter table recipes add column if not exists instruction_steps jsonb;
