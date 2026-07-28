import { Request, Response } from 'express';
import { z } from 'zod';
import * as tenantService from '../services/tenant.service';

const registerSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  ownerName: z.string().min(1),
  whatsappNumber: z.string().optional()
});

export const registerTenant = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const tenant = await tenantService.registerTenant(data);
    
    res.status(201).json({
      message: 'Tenant registered successfully. Please proceed to subscription/pricing selection.',
      tenant
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    if (error.message === 'SUBDOMAIN_TAKEN') {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const provisionSchema = z.object({
  plan: z.string().min(1)
});

export const provisionTenant = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { plan } = provisionSchema.parse(req.body);
    
    const result = await tenantService.provisionTenant(tenantId as string, plan);
    
    res.status(200).json({
      message: 'Tenant provisioned successfully',
      ...result
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    console.error('Provisioning error:', error);
    res.status(500).json({ error: 'Failed to provision tenant', details: error.message });
  }
};

export const resolveTenant = async (req: Request, res: Response) => {
  try {
    const { subdomain } = req.query;
    if (!subdomain || typeof subdomain !== 'string') {
      return res.status(400).json({ error: 'Subdomain query parameter is required' });
    }

    const tenant = await tenantService.resolveTenant(subdomain);
    res.json(tenant);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') return res.status(404).json({ error: 'Tenant not found' });
    if (error.message === 'TENANT_DEACTIVATED') return res.status(403).json({ error: 'Tenant is deactivated' });
    if (error.message === 'TENANT_NOT_PROVISIONED') return res.status(403).json({ error: 'Tenant schema is not yet provisioned. Please setup the database first.' });
    if (error.message === 'TENANT_EXPIRED') return res.status(402).json({ error: 'Your subscription has ended. Please make payment to continue.' });
    
    console.error('Resolve tenant error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant' });
  }
};

export const setupDatabase = async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId || req.body?.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    const result = await tenantService.setupDatabase(tenantId);
    
    res.status(200).json({
      message: `Database setup completed successfully for tenant ${tenantId}`,
      ...result
    });
  } catch (error: any) {
    console.error('Database setup error:', error);
    res.status(500).json({ error: 'Failed to setup database', details: error.message });
  }
};

export const getAllTenants = async (req: Request, res: Response) => {
  try {
    const allTenants = await tenantService.getAllTenants();
    res.status(200).json(allTenants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getTenantDetails = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const tenant = await tenantService.getTenantById(tenantId as string);
    res.status(200).json(tenant);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.error('getTenantDetails error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant details' });
  }
};

export const toggleTenantStatus = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive boolean field is required' });
    }

    const result = await tenantService.toggleTenantStatus(tenantId as string, isActive);
    res.status(200).json({
      message: `Tenant ${isActive ? 'activated' : 'deactivated'} successfully`,
      ...result
    });
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.error('toggleTenantStatus error:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
};

export const updateTenantPlan = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { plan } = req.body;
    if (!plan || typeof plan !== 'string') {
      return res.status(400).json({ error: 'plan string field is required' });
    }

    const result = await tenantService.updateTenantPlan(tenantId as string, plan);
    res.status(200).json({
      message: `Tenant subscription plan updated to ${plan}`,
      ...result
    });
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    console.error('updateTenantPlan error:', error);
    res.status(500).json({ error: 'Failed to update tenant plan' });
  }
};

