import { Request, Response, NextFunction } from 'express';

type FeatureMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const allowAll: FeatureMiddleware = (_req, _res, next) => next();

export const checkFeature = (_featureName: string): FeatureMiddleware => (_req, _res, next) => next();

export const checkTemplates = allowAll;
export const checkCampaigns = allowAll;
export const checkNovaVida = allowAll;
export const checkDatabase = allowAll;
export const checkWhatsAppQR = allowAll;
export const checkWhatsAppAPI = allowAll;

module.exports = {
  checkTemplates,
  checkCampaigns,
  checkNovaVida,
  checkDatabase,
  checkWhatsAppQR,
  checkWhatsAppAPI,
  checkFeature,
};

