import { createClient } from '@supabase/supabase-js';

const url = 'https://yqbcopyfxlstioocfpqz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYmNvcHlmeGxzdGlvb2NmcHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTQ1MTksImV4cCI6MjA4MTQ5MDUxOX0.afyGYFmrl4TOq40RxfVVcEZ_zq9rPOi6uygXywcC1qw';

const supabase = createClient(url, anonKey);

const email = 'admin@example.com';
const password = 'admin123';

console.log(`Attempting signIn for ${email}...`);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error('Sign-in failed:', error);
  process.exit(1);
}

const authUser = data.user;
const session = data.session;
console.log('Signed in user id:', authUser?.id);

// Ensure client has session for subsequent calls
if (session?.access_token) {
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
}

// Check for existing profile in users table
let { data: profile, error: selErr } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
if (selErr) console.error('Error selecting profile:', selErr);

if (profile) {
  console.log('Found profile in users table:', { id: profile.id, auth_uid: profile.auth_uid });
  if (!profile.auth_uid) {
    const { error: upErr } = await supabase.from('users').update({ auth_uid: authUser.id }).eq('id', profile.id);
    if (upErr) console.error('Error updating profile auth_uid:', upErr);
    else console.log('Updated profile with auth_uid:', authUser.id);
  } else if (profile.auth_uid === authUser.id) {
    console.log('Profile already linked to auth uid.');
  } else {
    console.log('Profile auth_uid differs from auth user:', profile.auth_uid);
  }
} else {
  // No profile - insert a basic one
  const newUser = {
    id: Date.now().toString(),
    name: email.split('@')[0],
    login: email.split('@')[0],
    email,
    auth_uid: authUser.id,
    role: 'ATTENDANT',
    permissions: JSON.stringify(['view_dashboard','view_patients'])
  };
  const { error: insErr } = await supabase.from('users').insert(newUser);
  if (insErr) console.error('Error inserting new profile:', insErr);
  else console.log('Inserted new profile for auth user.');
}

// Re-query and print final profile
const { data: finalProfile } = await supabase.from('users').select('*').eq('email', email).single();
console.log('Final profile:', finalProfile);
