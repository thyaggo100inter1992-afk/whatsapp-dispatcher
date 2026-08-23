/**
 * Opt-in público do site institucional NETTSISTEMAS (compliance SendGrid)
 * POST /api/public/institucional/opt-in
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../database/connection';

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS institucional_optins (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200),
      email VARCHAR(320) NOT NULL,
      company VARCHAR(200),
      source VARCHAR(100),
      consent BOOLEAN NOT NULL DEFAULT TRUE,
      privacy_url TEXT,
      ip VARCHAR(64),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_institucional_optins_email
      ON institucional_optins (LOWER(email));
  `);
}

router.post('/opt-in', async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 200);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 320);
    const company = String(req.body?.company || '').trim().slice(0, 200);
    const source = String(req.body?.source || 'institucional').slice(0, 100);
    const privacyUrl = String(req.body?.privacy_url || '').slice(0, 500);
    const consent = req.body?.consent === true || req.body?.consent === 'true' || req.body?.consent === 1;

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'E-mail inválido' });
    }
    if (!consent) {
      return res.status(400).json({ success: false, message: 'Consentimento obrigatório' });
    }

    await ensureTable();

    const ip =
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      null;
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);

    await pool.query(
      `INSERT INTO institucional_optins (name, email, company, source, consent, privacy_url, ip, user_agent)
       VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7)`,
      [name || null, email, company || null, source, privacyUrl || null, ip, ua]
    );

    return res.json({ success: true, message: 'Opt-in registrado' });
  } catch (e: any) {
    console.error('[institucional-optin]', e?.message || e);
    return res.status(500).json({ success: false, message: 'Erro ao registrar opt-in' });
  }
});

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'institucional-public' });
});

export default router;
