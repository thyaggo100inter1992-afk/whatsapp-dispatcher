-- Migration 010: Adicionar lista "Sem WhatsApp"
-- Adiciona automaticamente números que não têm WhatsApp ou são inválidos

-- ============================================================
-- Adicionar o novo tipo de lista: no_whatsapp
-- ============================================================
INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) VALUES
('no_whatsapp', 'Sem WhatsApp', 'Números sem WhatsApp ou inválidos (adicionados automaticamente pelas campanhas)', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================

