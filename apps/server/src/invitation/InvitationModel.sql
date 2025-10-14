CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days')
);

-- Create a partial unique index (this replaces the inline UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_unique_pending
  ON invitations(room_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_room_id ON invitations(room_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_expired ON invitations(expires_at, status) WHERE status = 'pending';

