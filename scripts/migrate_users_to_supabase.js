#!/usr/bin/env node
/*
  migrate_users_to_supabase.js (ESM)

  Usage:
    Set env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    Export legacy users to CSV (use scripts/export_users.sql guidance)
    node scripts/migrate_users_to_supabase.js ./users_export.csv > migration_map.csv

  Notes:
  - You cannot recover plaintext passwords from password hashes. This script creates users
    with a random temporary password and logs the mapping; you should trigger a password-reset
    email or force users to set a new password on first login.
  - Requires @supabase/supabase-js in the project's deps: `npm install @supabase/supabase-js`
*/

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const header = lines.shift().split(',').map(h => h.trim())
  return lines.map(line => {
    // basic CSV parse (no quoted commas support); for complex inputs, pre-clean the CSV
    const cols = line.split(',')
    const obj = {}
    header.forEach((h, i) => { obj[h] = (cols[i] || '').trim() })
    return obj
  })
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), 'users_export.csv')
  const sendResetFlag = process.argv.includes('--send-reset') || process.env.SEND_PASSWORD_RESET === '1'
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  const users = parseCsv(csvPath)
  console.log('legacy_id,new_user_id,email,temp_password,notes')

  for (const u of users) {
    try {
      const email = u.email && u.email.length > 3 ? u.email : `${u.username || 'user'}+legacy${u.id}@example.invalid`
      const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16)

      // Admin create user (preserves no legacy password)
      const { user, error: createErr } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          legacy_id: u.id,
          username: u.username || null,
          display_name: u.display_name || null,
        }
      })

      if (createErr) {
        console.error([u.id, '', email, '', `create_error:${createErr.message}`].join(','))
        continue
      }

      // Insert profile row matching the new auth user id
      const profile = {
        id: user.id,
        username: u.username || (u.email ? u.email.split('@')[0] : `legacy_${u.id}`),
        name: u.display_name || '',
        role: u.role || 'user',
        created_at: u.created_at || null
      }

      const { data: ins, error: insErr } = await supabase.from('profiles').insert(profile)
      if (insErr) {
        console.error([u.id, user.id, email, tempPassword, `profile_insert_error:${insErr.message}`].join(','))
        continue
      }

      // Optionally trigger password reset email (recommended for security)
      if (sendResetFlag) {
        try {
          // This will instruct Supabase to send a password reset email to the user
          await supabase.auth.resetPasswordForEmail(email)
          console.log([u.id, user.id, email, '', 'created_and_reset_sent'].join(','))
        } catch (resetErr) {
          console.error([u.id, user.id, email, tempPassword, `reset_error:${resetErr.message || resetErr}`].join(','))
        }
      } else {
        // Output mapping line with temp password only when not triggering reset
        console.log([u.id, user.id, email, tempPassword, 'created'].join(','))
      }
    } catch (err) {
      console.error([u.id, '', '', '', `exception:${err.message || err}`].join(','))
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
