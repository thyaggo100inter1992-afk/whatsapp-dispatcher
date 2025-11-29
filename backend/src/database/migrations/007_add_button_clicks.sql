-- Tabela para rastrear cliques em botões dos templates
CREATE TABLE IF NOT EXISTS button_clicks (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    button_text VARCHAR(255) NOT NULL,
    button_payload VARCHAR(500),
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_button_clicks_campaign ON button_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_button_clicks_message ON button_clicks(message_id);
CREATE INDEX IF NOT EXISTS idx_button_clicks_contact ON button_clicks(contact_id);
CREATE INDEX IF NOT EXISTS idx_button_clicks_date ON button_clicks(clicked_at);

-- Comentários
COMMENT ON TABLE button_clicks IS 'Registra cliques em botões de templates do WhatsApp';
COMMENT ON COLUMN button_clicks.button_text IS 'Texto do botão clicado';
COMMENT ON COLUMN button_clicks.button_payload IS 'Payload/ação do botão';
COMMENT ON COLUMN button_clicks.clicked_at IS 'Data e hora do clique';





