import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateChefPreferences } from '@/lib/db/profile'
import { isChefPersona, isChefSkillPref, isChefPacing } from '@/lib/cook/chef-preferences'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    if (!isChefPersona(body.chef_persona)) {
      return NextResponse.json({ error: 'Invalid chef persona' }, { status: 400 })
    }
    if (!isChefSkillPref(body.chef_skill_pref)) {
      return NextResponse.json({ error: 'Invalid chef skill level' }, { status: 400 })
    }
    if (!isChefPacing(body.chef_pacing)) {
      return NextResponse.json({ error: 'Invalid chef pacing' }, { status: 400 })
    }
    // Voice is a device-specific SpeechSynthesis voiceURI; empty/absent clears it.
    const voice = body.chef_voice_uri
    if (voice != null && typeof voice !== 'string') {
      return NextResponse.json({ error: 'Invalid chef voice' }, { status: 400 })
    }

    await updateChefPreferences(user.id, {
      chef_persona: body.chef_persona,
      chef_skill_pref: body.chef_skill_pref,
      chef_pacing: body.chef_pacing,
      chef_voice_uri: voice ? String(voice).slice(0, 300) : null,
    })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update chef preferences error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update chef preferences' }, { status: 500 })
  }
}
