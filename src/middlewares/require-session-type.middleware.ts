import { Request, Response, NextFunction } from 'express';
import { SessionType } from '../services/token.service';

export function requireSessionType(...allowed: SessionType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !allowed.includes(req.auth.sessionType)) {
      return res.status(403).json({ error: 'Session type tidak diizinkan mengakses endpoint ini' });
    }
    next();
  };
}
