-- Adiciona coluna para o prompt personalizado de geração de atas
ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS minutes_prompt text;