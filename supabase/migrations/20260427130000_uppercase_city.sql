-- Normalize city to uppercase on every insert/update, regardless of source (app or web)
CREATE OR REPLACE FUNCTION normalize_city()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.city IS NOT NULL THEN
    NEW.city := UPPER(TRIM(NEW.city));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_city ON profiles;
CREATE TRIGGER trg_normalize_city
  BEFORE INSERT OR UPDATE OF city ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_city();

-- Backfill existing rows
UPDATE profiles SET city = UPPER(TRIM(city)) WHERE city IS NOT NULL AND city != UPPER(TRIM(city));
