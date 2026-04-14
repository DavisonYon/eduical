import { supabase } from '../lib/supabase'

interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    student_id?: string
  }
}

export async function ensureProfile(user: User) {
  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existingProfile) {
    return existingProfile
  }

  // Create profile if it doesn't exist
  const fullName = user.user_metadata?.full_name || null
  const email = user.email || null
  const studentId = user.user_metadata?.student_id || null

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      email: email,
      student_id: studentId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating profile:', error)
    return null
  }

  return newProfile
}
