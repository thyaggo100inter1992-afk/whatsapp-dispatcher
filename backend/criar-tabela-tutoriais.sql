-- Tabela para Vídeos Tutoriais da Plataforma
CREATE TABLE IF NOT EXISTS tutorial_videos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  filename VARCHAR(500) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  duracao INTEGER, -- duração em segundos (opcional)
  categoria VARCHAR(100), -- ex: "Campanhas", "Templates", "API", "QR Connect", etc
  ordem INTEGER DEFAULT 0, -- ordem de exibição
  ativo BOOLEAN DEFAULT true,
  uploaded_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_ativo ON tutorial_videos(ativo);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_categoria ON tutorial_videos(categoria);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_ordem ON tutorial_videos(ordem);

-- Comentários
COMMENT ON TABLE tutorial_videos IS 'Vídeos tutoriais da plataforma gerenciados pelo Super Admin';
COMMENT ON COLUMN tutorial_videos.titulo IS 'Título do vídeo tutorial';
COMMENT ON COLUMN tutorial_videos.descricao IS 'Descrição/resumo do conteúdo do vídeo';
COMMENT ON COLUMN tutorial_videos.filename IS 'Nome do arquivo de vídeo';
COMMENT ON COLUMN tutorial_videos.filepath IS 'Caminho do arquivo no servidor';
COMMENT ON COLUMN tutorial_videos.duracao IS 'Duração do vídeo em segundos';
COMMENT ON COLUMN tutorial_videos.categoria IS 'Categoria do tutorial';
COMMENT ON COLUMN tutorial_videos.ordem IS 'Ordem de exibição (menor número aparece primeiro)';
COMMENT ON COLUMN tutorial_videos.ativo IS 'Se o vídeo está ativo/visível para usuários';

