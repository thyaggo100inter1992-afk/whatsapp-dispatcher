-- Assuntos múltiplos (opcionais) nos templates de e-mail marketing
ALTER TABLE email_marketing_templates
  ALTER COLUMN subject DROP NOT NULL;

ALTER TABLE email_marketing_templates
  ALTER COLUMN subject SET DEFAULT '';

UPDATE email_marketing_templates SET subject = '' WHERE subject IS NULL;

ALTER TABLE email_marketing_templates
  ADD COLUMN IF NOT EXISTS subjects JSONB;

-- Preenche subjects a partir do subject único existente
UPDATE email_marketing_templates
SET subjects = jsonb_build_array(subject)
WHERE subjects IS NULL
  AND subject IS NOT NULL
  AND TRIM(subject) <> '';
