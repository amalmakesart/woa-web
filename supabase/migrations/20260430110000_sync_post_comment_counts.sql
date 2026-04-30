-- Keep post comment counters aligned with the comments table.

CREATE OR REPLACE FUNCTION sync_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_post_comment_count ON public.comments;

CREATE TRIGGER trg_sync_post_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION sync_post_comment_count();

WITH comment_totals AS (
  SELECT post_id, COUNT(*)::int AS count
  FROM public.comments
  GROUP BY post_id
)
UPDATE public.posts AS posts
SET comment_count = COALESCE(comment_totals.count, 0)
FROM comment_totals
WHERE posts.id = comment_totals.post_id;

UPDATE public.posts
SET comment_count = 0
WHERE id NOT IN (
  SELECT DISTINCT post_id
  FROM public.comments
);
