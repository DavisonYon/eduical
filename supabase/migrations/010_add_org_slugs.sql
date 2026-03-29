-- Add a URL-friendly slug to organizations for nicer URLs

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing rows with a simple slug based on the name.
-- Note: This does not guarantee global uniqueness if there are duplicate names;
-- in that edge case the second UPDATE below may fail and you can adjust slugs manually.
UPDATE public.organizations
SET slug = lower(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\\s-]', '', 'g'),
    '\\s+',
    '-',
    'g'
  )
)
WHERE slug IS NULL;

-- Enforce slug presence and uniqueness going forward
ALTER TABLE public.organizations
ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations(slug);

