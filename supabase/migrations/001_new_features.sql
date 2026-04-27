-- ============================================================
-- WOA Migration 001 — New Features
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS collective_type text,
  ADD COLUMN IF NOT EXISTS member_count    int,
  ADD COLUMN IF NOT EXISTS booked_count    int NOT NULL DEFAULT 0;

-- ── posts ───────────────────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_portfolio boolean NOT NULL DEFAULT false;

-- ── gig_interests ───────────────────────────────────────────
ALTER TABLE gig_interests
  ADD COLUMN IF NOT EXISTS availability_note text;

-- ── conversations ────────────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS booking_status    text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS booked_at         timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_type text NOT NULL DEFAULT 'gig';

-- ── portfolio_sections ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           text NOT NULL,
  cover_image_url text,
  display_order   int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_sections_select" ON portfolio_sections
  FOR SELECT USING (true);

CREATE POLICY "portfolio_sections_insert" ON portfolio_sections
  FOR INSERT WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "portfolio_sections_update" ON portfolio_sections
  FOR UPDATE USING (auth.uid() = artist_id);

CREATE POLICY "portfolio_sections_delete" ON portfolio_sections
  FOR DELETE USING (auth.uid() = artist_id);

-- ── portfolio_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES portfolio_sections(id) ON DELETE CASCADE,
  post_id       uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, post_id)
);

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_items_select" ON portfolio_items
  FOR SELECT USING (true);

CREATE POLICY "portfolio_items_insert" ON portfolio_items
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT artist_id FROM portfolio_sections WHERE id = section_id)
  );

CREATE POLICY "portfolio_items_update" ON portfolio_items
  FOR UPDATE USING (
    auth.uid() = (SELECT artist_id FROM portfolio_sections WHERE id = section_id)
  );

CREATE POLICY "portfolio_items_delete" ON portfolio_items
  FOR DELETE USING (
    auth.uid() = (SELECT artist_id FROM portfolio_sections WHERE id = section_id)
  );

-- ── shows ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  venue       text,
  city        text,
  show_date   timestamptz NOT NULL,
  ticket_url  text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shows_select" ON shows
  FOR SELECT USING (true);

CREATE POLICY "shows_insert" ON shows
  FOR INSERT WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "shows_update" ON shows
  FOR UPDATE USING (auth.uid() = artist_id);

CREATE POLICY "shows_delete" ON shows
  FOR DELETE USING (auth.uid() = artist_id);

-- ── reviews ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      int  NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, reviewer_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ── post_collaborators ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_collaborators (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collaborator_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, collaborator_id)
);

ALTER TABLE post_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_collaborators_select" ON post_collaborators
  FOR SELECT USING (true);

CREATE POLICY "post_collaborators_insert" ON post_collaborators
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "post_collaborators_update" ON post_collaborators
  FOR UPDATE USING (auth.uid() = collaborator_id);

CREATE POLICY "post_collaborators_delete" ON post_collaborators
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM posts WHERE id = post_id)
    OR auth.uid() = collaborator_id
  );

-- ── trigger: update profiles.rating on review insert ─────────
CREATE OR REPLACE FUNCTION update_artist_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    rating = (
      SELECT AVG(rating)::numeric(3,2)
      FROM reviews WHERE reviewee_id = NEW.reviewee_id
    ),
    rating_count = (
      SELECT COUNT(*) FROM reviews WHERE reviewee_id = NEW.reviewee_id
    )
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_artist_rating ON reviews;
CREATE TRIGGER trg_update_artist_rating
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_artist_rating();

-- ── trigger: increment booked_count on booking ───────────────
CREATE OR REPLACE FUNCTION increment_booked_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_status = 'booked' AND OLD.booking_status != 'booked' THEN
    UPDATE profiles SET booked_count = booked_count + 1
    WHERE id = NEW.artist_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_booked_count ON conversations;
CREATE TRIGGER trg_increment_booked_count
  AFTER UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION increment_booked_count();
