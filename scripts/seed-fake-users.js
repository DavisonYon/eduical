/**
 * Seed fake users for local development/testing.
 *
 * REQUIRES: Supabase Service Role Key (bypasses RLS)
 * Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 * Add to your .env or .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
 *
 * Run: node scripts/seed-fake-users.js
 * Or:  npx node --env-file=.env scripts/seed-fake-users.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  for (const file of ['.env']) {
    const path = resolve(process.cwd(), file)
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = value
        }
      }
    }
  }
}
loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars. Add to .env or .env.local:')
  console.error('  VITE_SUPABASE_URL (or SUPABASE_URL)')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nGet the service role key from: Supabase Dashboard → Project Settings → API')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const FAKE_USERS = [
  { email: 'alex.chen@example.com', full_name: 'Alex Chen' },
  { email: 'samira.khan@example.com', full_name: 'Samira Khan' },
  { email: 'jordan.smith@example.com', full_name: 'Jordan Smith' },
  { email: 'maya.patel@example.com', full_name: 'Maya Patel' },
  { email: 'tyler.wright@example.com', full_name: 'Tyler Wright' },
  { email: 'emma.rodriguez@example.com', full_name: 'Emma Rodriguez' },
  { email: 'marcus.johnson@example.com', full_name: 'Marcus Johnson' },
  { email: 'olivia.nguyen@example.com', full_name: 'Olivia Nguyen' },
]

const PASSWORD = 'password123'

async function seed() {
  console.log('Seeding fake users...\n')

  for (const { email, full_name } of FAKE_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        console.log(`  ⏭️  ${email} (already exists)`)
      } else {
        console.error(`  ❌ ${email}: ${error.message}`)
      }
    } else {
      console.log(`  ✅ ${full_name} <${email}>`)
    }
  }

  console.log('\nDone! All users have password: ' + PASSWORD)
  console.log('You can log in with any of the emails above.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
