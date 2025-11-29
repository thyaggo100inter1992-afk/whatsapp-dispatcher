-- Criar tabela para arquivos públicos
CREATE TABLE IF NOT EXISTS public_files (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(500) NOT NULL,
  cloudinary_id VARCHAR(255) NOT NULL UNIQUE,
  cloudinary_url TEXT NOT NULL,
  secure_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  description TEXT,
  uploaded_by INTEGER REFERENCES tenant_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_public_files_cloudinary_id ON public_files(cloudinary_id);
CREATE INDEX IF NOT EXISTS idx_public_files_uploaded_by ON public_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_public_files_created_at ON public_files(created_at DESC);

-- Comentários
COMMENT ON TABLE public_files IS 'Tabela para armazenar informações de arquivos públicos (imagens, vídeos, PDFs)';
COMMENT ON COLUMN public_files.cloudinary_id IS 'ID único do arquivo no Cloudinary';
COMMENT ON COLUMN public_files.secure_url IS 'URL segura (HTTPS) para acesso público ao arquivo';
COMMENT ON COLUMN public_files.file_type IS 'Tipo do recurso no Cloudinary (image, video, raw)';



