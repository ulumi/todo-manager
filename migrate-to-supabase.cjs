#!/usr/bin/env node
// ══════════════════════════════════════════════════════════
//  Migrate Firebase → Supabase (one-time script)
//  1. Export all non-anonymous users + their data from Firebase
//  2. Create matching Supabase Auth users
//  3. Import user_data, presence, admin_messages into Supabase
// ══════════════════════════════════════════════════════════

const fs = require('fs');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// ── Load Firebase SA ──
const sa = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Supabase client (service_role) ──
const supabase = createClient(
  'https://ztibrrmebnpzmflzghjb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWJycm1lYm5wem1mbHpnaGpiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY3NzE4MCwiZXhwIjoyMDg4MjUzMTgwfQ.VkgQULfdcqY1S6x8UF6CPNDy3vOh5AwUUkMh-B-zFJs'
);

// ── ADMIN_UIDS (main users to prioritize) ──
const ADMIN_UIDS = ['h3ctt4F0zrf5SQTtGOVY8xTJT0Y2', 'QuTBudQzz6SWkIDa50WggbnF4kK2'];

async function migrate() {
  console.log('=== Phase 1: Export Firebase users ===');

  const { users } = await admin.auth().listUsers(1000);
  const nonAnon = users.filter(u => u.providerData.length > 0 || ADMIN_UIDS.includes(u.uid));
  const anon = users.filter(u => u.providerData.length === 0 && !ADMIN_UIDS.includes(u.uid));

  console.log(`Total users: ${users.length} (${nonAnon.length} real, ${anon.length} anonymous — skipping anon)`);

  // ── Map: firebase_uid → supabase_uuid ──
  const uidMap = {};

  console.log('\n=== Phase 2: Create Supabase Auth users ===');

  for (const user of nonAnon) {
    const email = user.email;
    const providers = user.providerData.map(p => p.providerId);

    try {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: email || `firebase_${user.uid}@migrated.local`,
        email_confirm: true,
        user_metadata: {
          display_name: user.displayName || '',
          firebase_uid: user.uid,
          providers: providers,
        },
        // Generate a random password — users will need to reset or use OAuth
        password: crypto.randomUUID() + crypto.randomUUID(),
      });

      if (error) {
        // User might already exist
        if (error.message.includes('already been registered')) {
          console.log(`  ⚠ ${email} already exists in Supabase, looking up...`);
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(u => u.email === email);
          if (existing) {
            uidMap[user.uid] = existing.id;
            console.log(`  → Mapped ${user.uid} → ${existing.id}`);
          }
        } else {
          console.error(`  ✗ Failed ${email}: ${error.message}`);
        }
        continue;
      }

      uidMap[user.uid] = data.user.id;
      console.log(`  ✓ ${email || user.uid} (${providers.join(',')}) → ${data.user.id}`);
    } catch (err) {
      console.error(`  ✗ Exception for ${email}: ${err.message}`);
    }
  }

  // ── Orphan UID: h3ctt4F0zrf5SQTtGOVY8xTJT0Y2 ──
  // This UID has Firestore data but no Firebase Auth user.
  // Attach its data to hugues1981@gmail.com's Supabase account.
  const ORPHAN_UID = 'h3ctt4F0zrf5SQTtGOVY8xTJT0Y2';
  const HUGUES_FIREBASE_UID = 'QuTBudQzz6SWkIDa50WggbnF4kK2';
  if (!uidMap[ORPHAN_UID] && uidMap[HUGUES_FIREBASE_UID]) {
    uidMap[ORPHAN_UID] = uidMap[HUGUES_FIREBASE_UID];
    console.log(`  → Orphan ${ORPHAN_UID} → mapped to hugues account ${uidMap[HUGUES_FIREBASE_UID]}`);
  }

  console.log(`\nMapped ${Object.keys(uidMap).length} users`);

  console.log('\n=== Phase 3: Migrate user data ===');

  for (const [firebaseUid, supabaseId] of Object.entries(uidMap)) {
    try {
      // Read Firestore user data
      const snap = await db.doc(`users/${firebaseUid}/data/main`).get();
      if (!snap.exists) {
        console.log(`  - ${firebaseUid}: no Firestore data, skipping`);
        continue;
      }

      const { updatedAt, _pushedBySession, ...data } = snap.data();
      const updatedAtMs = updatedAt?.toDate?.() || new Date();

      // Insert into user_data
      const { error } = await supabase.from('user_data').upsert({
        user_id: supabaseId,
        data: data,
        updated_at: updatedAtMs.toISOString(),
      });

      if (error) {
        console.error(`  ✗ user_data ${firebaseUid}: ${error.message}`);
      } else {
        const todoCount = data.calendar?.length || 0;
        console.log(`  ✓ user_data ${firebaseUid} → ${supabaseId} (${todoCount} todos)`);
      }
    } catch (err) {
      console.error(`  ✗ Exception reading ${firebaseUid}: ${err.message}`);
    }
  }

  console.log('\n=== Phase 4: Migrate presence ===');

  for (const [firebaseUid, supabaseId] of Object.entries(uidMap)) {
    try {
      const snap = await db.doc(`presence/${firebaseUid}`).get();
      if (!snap.exists) continue;

      const p = snap.data();
      const { error } = await supabase.from('presence').upsert({
        user_id: supabaseId,
        online: false, // Reset — they'll reconnect
        last_seen: p.lastSeen?.toDate?.()?.toISOString() || new Date().toISOString(),
        session_start: p.sessionStart?.toDate?.()?.toISOString() || null,
        click_count: p.clickCount || 0,
        email: p.email || null,
        display_name: p.displayName || null,
        is_anonymous: false,
        avatar: p.avatar || null,
      });

      if (error) console.error(`  ✗ presence ${firebaseUid}: ${error.message}`);
      else console.log(`  ✓ presence ${firebaseUid}`);
    } catch (err) {
      // Presence doc might not exist for all users
    }
  }

  console.log('\n=== Phase 5: Migrate admin messages ===');

  for (const [firebaseUid, supabaseId] of Object.entries(uidMap)) {
    try {
      const inbox = await db.collection(`admin_messages/${firebaseUid}/inbox`).get();
      if (inbox.empty) continue;

      const messages = [];
      inbox.forEach(doc => {
        const m = doc.data();
        messages.push({
          user_id: supabaseId,
          message: m.message,
          sender: m.from || 'admin',
          sent_at: m.sentAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          read: m.read || false,
          broadcast_id: m.broadcastId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.broadcastId) ? m.broadcastId : null,
        });
      });

      if (messages.length) {
        const { error } = await supabase.from('admin_messages').insert(messages);
        if (error) console.error(`  ✗ messages ${firebaseUid}: ${error.message}`);
        else console.log(`  ✓ ${messages.length} messages for ${firebaseUid}`);
      }
    } catch (err) {
      // Collection might not exist
    }
  }

  console.log('\n=== Phase 6: Migrate broadcasts ===');

  try {
    const bSnap = await db.collection('broadcasts').get();
    if (!bSnap.empty) {
      const broadcasts = [];
      bSnap.forEach(doc => {
        const b = doc.data();
        broadcasts.push({
          message: b.message,
          sent_at: b.sentAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          recipient_count: b.recipientCount || null,
        });
      });
      const { error } = await supabase.from('broadcasts').insert(broadcasts);
      if (error) console.error(`  ✗ broadcasts: ${error.message}`);
      else console.log(`  ✓ ${broadcasts.length} broadcasts`);
    }
  } catch (err) {
    console.log('  - No broadcasts collection');
  }

  // ── Save UID mapping for reference ──
  fs.writeFileSync('uid-mapping.json', JSON.stringify(uidMap, null, 2));
  console.log('\n=== Done! UID mapping saved to uid-mapping.json ===');
  console.log('\nMapping:');
  for (const [fb, sb] of Object.entries(uidMap)) {
    console.log(`  ${fb} → ${sb}`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
