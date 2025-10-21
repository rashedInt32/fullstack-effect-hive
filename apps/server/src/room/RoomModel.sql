-- We need to create two tables here, one for room itself and another one for room_members which pointed out to rooms table
-- For room table content id, name, type, description (channel/dm) create_by , created_at, updated_at
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  TYPE TEXT NOT NULL CHECK (TYPE IN ('channel', 'dm')),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);


CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);


CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);


CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);


CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);


CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(TYPE);
