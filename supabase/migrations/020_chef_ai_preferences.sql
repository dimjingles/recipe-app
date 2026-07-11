-- Chef AI personalisation: persona, skill level, pacing, and TTS voice.
-- Applied to the guided "Cook with AI" flow and the per-step "Ask Chef" chat.
alter table profiles
  add column if not exists chef_persona text not null default 'warm'
    check (chef_persona in ('warm', 'pro', 'minimal', 'playful', 'calm')),
  add column if not exists chef_skill_pref text not null default 'auto'
    check (chef_skill_pref in ('auto', 'beginner', 'intermediate', 'expert')),
  add column if not exists chef_pacing text not null default 'step_by_step'
    check (chef_pacing in ('step_by_step', 'hands_free', 'overview_first')),
  -- Web SpeechSynthesis voiceURI chosen for text-to-audio. Device-specific;
  -- null (or an unavailable URI) falls back to the browser default voice.
  add column if not exists chef_voice_uri text;
