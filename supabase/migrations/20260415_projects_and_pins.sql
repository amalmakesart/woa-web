-- ============================================================
-- WOA Migration — Projects tab + admin pin posts
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── posts: add admin pin column ──────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Allow admin (amalmakesart@gmail.com) to update any post's is_pinned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'posts_admin_pin'
  ) THEN
    CREATE POLICY "posts_admin_pin" ON posts
      FOR UPDATE
      USING (
        (SELECT email FROM auth.users WHERE id = auth.uid()) = 'amalmakesart@gmail.com'
      );
  END IF;
END $$;

-- ── projects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  description      text        NOT NULL,
  art_types_needed text[]      NOT NULL DEFAULT '{}',
  comment_count    int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (true);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'GIG_POSTER'
  );

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- ── project_comments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_comments_select" ON project_comments
  FOR SELECT USING (true);

CREATE POLICY "project_comments_insert" ON project_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_comments_delete" ON project_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ── notifications: post liked ────────────────────────────────
CREATE OR REPLACE FUNCTION notify_post_liked()
RETURNS TRIGGER AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT user_id, title INTO v_owner, v_title FROM posts WHERE id = NEW.post_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type, preview_text)
    VALUES (v_owner, 'post_liked', NEW.user_id, NEW.post_id, 'post', v_title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_post_liked ON post_likes;
CREATE TRIGGER trg_notify_post_liked
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_post_liked();

-- ── notifications: post commented ────────────────────────────
CREATE OR REPLACE FUNCTION notify_post_commented()
RETURNS TRIGGER AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = NEW.post_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type, preview_text)
    VALUES (v_owner, 'post_comment', NEW.user_id, NEW.post_id, 'post', LEFT(NEW.content, 80));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_post_commented ON comments;
CREATE TRIGGER trg_notify_post_commented
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_post_commented();

-- ── notifications: new follower ───────────────────────────────
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type)
  VALUES (NEW.following_id, 'new_follower', NEW.follower_id, NEW.follower_id, 'profile');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON follows;
CREATE TRIGGER trg_notify_new_follower
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_new_follower();

-- ── notifications: gig interest ───────────────────────────────
CREATE OR REPLACE FUNCTION notify_gig_interest()
RETURNS TRIGGER AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT poster_id, title INTO v_owner, v_title FROM gigs WHERE id = NEW.gig_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, reference_id, reference_type, preview_text)
    VALUES (v_owner, 'gig_interest', NEW.user_id, NEW.gig_id, 'gig', v_title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_gig_interest ON gig_interests;
CREATE TRIGGER trg_notify_gig_interest
  AFTER INSERT ON gig_interests
  FOR EACH ROW EXECUTE FUNCTION notify_gig_interest();

-- ── trigger: keep project comment_count in sync ───────────────
CREATE OR REPLACE FUNCTION increment_project_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET comment_count = comment_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_project_comment_count ON project_comments;
CREATE TRIGGER trg_increment_project_comment_count
  AFTER INSERT ON project_comments
  FOR EACH ROW EXECUTE FUNCTION increment_project_comment_count();
