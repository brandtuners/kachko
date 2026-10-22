-- A neutral base for pages that are customized without inheriting a preset.
INSERT INTO "Theme" ("id", "name", "slug", "background", "typography", "buttons", "cards", "updatedAt")
VALUES (
  'eeff771b-b365-4f3f-b592-c35b588136d3',
  'Default',
  'default',
  '{"type": "solid", "color": "#FFFFFF"}'::jsonb,
  '{"fontFamily": "system", "titleSize": 32, "color": "#111312", "titleColor": "#111312"}'::jsonb,
  '{"variant": "filled", "radius": 0, "background": "#111312", "color": "#FFFFFF", "shadow": false}'::jsonb,
  '{"radius": 0, "background": "#FFFFFF", "blur": 0}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "background" = EXCLUDED."background",
  "typography" = EXCLUDED."typography",
  "buttons" = EXCLUDED."buttons",
  "cards" = EXCLUDED."cards",
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "Page" ALTER COLUMN "themeKey" SET DEFAULT 'default';
