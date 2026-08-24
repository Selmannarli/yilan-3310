CREATE TABLE IF NOT EXISTS shot_users (
  google_sub TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  picture_url TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '0',
  language TEXT NOT NULL DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
  sound_on INTEGER NOT NULL DEFAULT 1 CHECK (sound_on IN (0, 1)),
  vibration_on INTEGER NOT NULL DEFAULT 1 CHECK (vibration_on IN (0, 1)),
  reduce_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduce_motion IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shot_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_sub TEXT NOT NULL REFERENCES shot_users(google_sub) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shot_sessions_user_sub ON shot_sessions(user_sub);
CREATE INDEX IF NOT EXISTS idx_shot_sessions_expires_at ON shot_sessions(expires_at);

CREATE TABLE IF NOT EXISTS shot_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  user_sub TEXT REFERENCES shot_users(google_sub) ON DELETE SET NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  language TEXT NOT NULL CHECK (language IN ('tr', 'en')),
  app_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shot_feedback_user_sub ON shot_feedback(user_sub);
CREATE INDEX IF NOT EXISTS idx_shot_feedback_created_at ON shot_feedback(created_at);

PRAGMA optimize;
