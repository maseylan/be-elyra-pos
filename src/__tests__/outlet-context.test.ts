import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveOutletContext, resolveOptionalOutletContext } from '../middlewares/outlet-context.middleware';

vi.mock('../services/user-outlet.service', () => ({
  getAccessibleOutlets: vi.fn(async (userId: string) => {
    if (userId === 'user-restricted') return ['outlet-1'];
    return 'all';
  }),
}));

describe('Outlet Context Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {},
      header: (name: string) => req.headers[name.toLowerCase()],
      query: {},
      params: {},
      body: {},
      user: { id: 'user-admin', role: 'admin' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('resolveOutletContext', () => {
    it('returns 400 if no outletId candidate is provided', async () => {
      await resolveOutletContext(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Outlet context required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('sets req.outletId and calls next when outletId is provided via header', async () => {
      req.headers['x-outlet-id'] = 'outlet-123';
      await resolveOutletContext(req, res, next);
      expect(req.outletId).toBe('outlet-123');
      expect(next).toHaveBeenCalled();
    });

    it('returns 400 on conflicting outlet candidates', async () => {
      req.headers['x-outlet-id'] = 'outlet-1';
      req.query = { outletId: 'outlet-2' };
      await resolveOutletContext(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Conflicting outlet context' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 if non-admin user lacks access to target outlet', async () => {
      req.user = { id: 'user-restricted', role: 'cashier' };
      req.headers['x-outlet-id'] = 'outlet-2';
      await resolveOutletContext(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'No access to this outlet' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('resolveOptionalOutletContext', () => {
    it('sets req.outletId to undefined and calls next when no outlet context is supplied (global mode)', async () => {
      await resolveOptionalOutletContext(req, res, next);
      expect(req.outletId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('sets req.outletId to undefined when outletId is "all"', async () => {
      req.query = { outletId: 'all' };
      await resolveOptionalOutletContext(req, res, next);
      expect(req.outletId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('resolves req.outletId when a valid outlet is supplied', async () => {
      req.headers['x-outlet-id'] = 'outlet-123';
      await resolveOptionalOutletContext(req, res, next);
      expect(req.outletId).toBe('outlet-123');
      expect(next).toHaveBeenCalled();
    });
  });
});
