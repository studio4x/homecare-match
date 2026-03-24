-- Adiciona coluna para ocultar usuários de testes das buscas públicas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Garante que o índice exista para performance de filtros
CREATE INDEX IF NOT EXISTS idx_profiles_is_hidden ON profiles(is_hidden);
