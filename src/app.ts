import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { tenantResolutionMiddleware } from './middlewares/tenant-resolution.middleware';
import { requireAuth } from './middlewares/auth.middleware';
import publicRouter from './publicRoutes';
import apiRouter from './routes';
import superadminAuthRouter from './routes/superadmin-auth.routes';
import ownerBillingAuthRouter from './routes/owner-billing-auth.routes';
import tenantAuthRouter from './routes/tenant-auth.routes';
import { getCashiers } from './controllers/user.controller';
import { HttpError } from './utils/errors';

const app: Express = express();

app.set('trust proxy', 1);

app.use(helmet());

const allowedDomains = (process.env.CORS_ALLOWED_DOMAINS || '').split(',').filter(Boolean);
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isAllowed = allowedDomains.some((domain) => {
      if (origin === domain) return true;
      try {
        const originUrl = new URL(origin);
        const domainUrl = new URL(domain);
        if (originUrl.protocol === domainUrl.protocol && originUrl.hostname.endsWith('.' + domainUrl.hostname)) {
          return true;
        }
      } catch (e) {
        return false;
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const publicGroup = express.Router();
publicGroup.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
publicGroup.use('/auth/superadmin', superadminAuthRouter);
publicGroup.use('/auth/owner', ownerBillingAuthRouter);
publicGroup.use(publicRouter);

// --- GRUP 1: Fully public, tidak butuh tenant context ---
app.use('/api', publicGroup);

// --- MULAI AREA TENANT RESOLUTION (FAIL-CLOSED) ---
app.use(tenantResolutionMiddleware);

// --- GRUP 2: Butuh tenant context, TIDAK butuh JWT valid ---
const tenantGroup = express.Router();
tenantGroup.get('/users/cashiers', getCashiers);
tenantGroup.use('/auth', tenantAuthRouter);
app.use('/api', tenantGroup);

// --- GRUP 3: Butuh tenant context DAN JWT valid ---
const protectedGroup = express.Router();
protectedGroup.use(requireAuth, apiRouter);
app.use('/api', protectedGroup);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
