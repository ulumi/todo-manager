-- ══════════════════════════════════════════════════
--  Todo Manager — Supabase Schema
--  Run this in the Supabase SQL Editor
-- ══════════════════════════════════════════════════

-- 1. User data (replaces Firestore users/{uid}/data/main)
CREATE TABLE IF NOT EXISTS user_data (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own data"
  ON user_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE user_data;

-- 2. Presence (queried cross-user by admin)
CREATE TABLE IF NOT EXISTS presence (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  online        BOOLEAN NOT NULL DEFAULT false,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_start TIMESTAMPTZ,
  click_count   INTEGER NOT NULL DEFAULT 0,
  email         TEXT,
  display_name  TEXT,
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  avatar        JSONB
);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own presence"
  ON presence FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Admin messages
CREATE TABLE IF NOT EXISTS admin_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  sender       TEXT NOT NULL DEFAULT 'admin',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read         BOOLEAN NOT NULL DEFAULT false,
  broadcast_id UUID
);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages"
  ON admin_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_user ON admin_messages(user_id);

-- Enable Realtime for inbox notifications
ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;

-- 4. Broadcasts (admin-only, accessed via service_role)
CREATE TABLE IF NOT EXISTS broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER
);
