import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import crypto from 'crypto';

export async function listCustomers(filters: { search?: string; page?: number; limit?: number }) {
  return withTenantDb(async (tx) => {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (filters.search) {
      conditions.push(
        or(
          ilike(schema.customers.name, `%${filters.search}%`),
          ilike(schema.customers.phone, `%${filters.search}%`),
          filters.search.includes('@') ? ilike(schema.customers.email, `%${filters.search}%`) : sql`1=0`,
        )
      );
    }

    const items = await tx
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        phone: schema.customers.phone,
        email: schema.customers.email,
        memberId: schema.loyaltyMembers.id,
        memberSince: schema.loyaltyMembers.createdAt,
        totalOrders: sql<number>`cast(count(distinct ${schema.orders.id}) as int)`,
        totalSpent: sql<number>`cast(coalesce(sum(${schema.orders.totalAmount}::numeric), 0) as float)`,
        totalPoints: sql<number>`cast(coalesce(sum(${schema.loyaltyPointsTransactions.points}), 0) as int)`,
      })
      .from(schema.customers)
      .leftJoin(schema.loyaltyMembers, eq(schema.loyaltyMembers.customerId, schema.customers.id))
      .leftJoin(schema.orders, and(
        eq(schema.orders.memberId, schema.loyaltyMembers.id),
        eq(schema.orders.status, 'completed'),
      ))
      .leftJoin(schema.loyaltyPointsTransactions, eq(schema.loyaltyPointsTransactions.memberId, schema.loyaltyMembers.id))
      .where(and(...conditions))
      .groupBy(schema.customers.id, schema.loyaltyMembers.id, schema.loyaltyMembers.createdAt)
      .orderBy(desc(schema.customers.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await tx
      .select({ count: sql<number>`cast(count(distinct ${schema.customers.id}) as int)` })
      .from(schema.customers)
      .leftJoin(schema.loyaltyMembers, eq(schema.loyaltyMembers.customerId, schema.customers.id))
      .where(and(...conditions));

    return { data: items, total: Number(count), page, limit };
  });
}

export async function getCustomerById(customerId: string) {
  return withTenantDb(async (tx) => {
    const [customer] = await tx
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        phone: schema.customers.phone,
        email: schema.customers.email,
        memberId: schema.loyaltyMembers.id,
        memberSince: schema.loyaltyMembers.createdAt,
        totalOrders: sql<number>`cast(count(distinct ${schema.orders.id}) as int)`,
        totalSpent: sql<number>`cast(coalesce(sum(${schema.orders.totalAmount}::numeric), 0) as float)`,
      })
      .from(schema.customers)
      .leftJoin(schema.loyaltyMembers, eq(schema.loyaltyMembers.customerId, schema.customers.id))
      .leftJoin(schema.orders, and(
        eq(schema.orders.memberId, schema.loyaltyMembers.id),
        eq(schema.orders.status, 'completed'),
      ))
      .where(eq(schema.customers.id, customerId))
      .groupBy(schema.customers.id, schema.loyaltyMembers.id, schema.loyaltyMembers.createdAt)
      .limit(1);

    if (!customer) return null;

    const memberId = customer.memberId;

    const programs = memberId ? await tx
      .select({
        programId: schema.loyaltyPrograms.id,
        programName: schema.loyaltyPrograms.name,
        pointsPerUnit: schema.loyaltyPrograms.pointsPerUnit,
        unitAmount: schema.loyaltyPrograms.unitAmount,
        points: sql<number>`cast(coalesce(sum(${schema.loyaltyPointsTransactions.points}), 0) as int)`,
      })
      .from(schema.loyaltyMemberPrograms)
      .innerJoin(schema.loyaltyPrograms, eq(schema.loyaltyPrograms.id, schema.loyaltyMemberPrograms.programId))
      .leftJoin(schema.loyaltyPointsTransactions, and(
        eq(schema.loyaltyPointsTransactions.memberId, schema.loyaltyMemberPrograms.memberId),
        eq(schema.loyaltyPointsTransactions.programId, schema.loyaltyMemberPrograms.programId),
      ))
      .where(eq(schema.loyaltyMemberPrograms.memberId, memberId))
      .groupBy(schema.loyaltyPrograms.id, schema.loyaltyMemberPrograms.memberId)
      .orderBy(desc(schema.loyaltyPrograms.createdAt)) : [];

    const recentOrders = memberId ? await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.memberId, memberId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(20) : [];

    const pointTransactions = memberId ? await tx
      .select({
        id: schema.loyaltyPointsTransactions.id,
        points: schema.loyaltyPointsTransactions.points,
        type: schema.loyaltyPointsTransactions.type,
        programId: schema.loyaltyPointsTransactions.programId,
        programName: schema.loyaltyPrograms.name,
        outletId: schema.loyaltyPointsTransactions.outletId,
        createdAt: schema.loyaltyPointsTransactions.createdAt,
      })
      .from(schema.loyaltyPointsTransactions)
      .leftJoin(schema.loyaltyPrograms, eq(schema.loyaltyPrograms.id, schema.loyaltyPointsTransactions.programId))
      .where(eq(schema.loyaltyPointsTransactions.memberId, memberId))
      .orderBy(desc(schema.loyaltyPointsTransactions.createdAt))
      .limit(50) : [];

    return { ...customer, programs, recentOrders, pointTransactions };
  });
}

export async function adjustPoints(memberId: string, programId: string, points: number, reason: string, outletId: string, adjustedBy?: string) {
  return withTenantDb(async (tx) => {
    const [member] = await tx
      .select()
      .from(schema.loyaltyMembers)
      .where(eq(schema.loyaltyMembers.id, memberId))
      .limit(1);

    if (!member) throw new Error('Member not found');

    const [program] = await tx
      .select()
      .from(schema.loyaltyPrograms)
      .where(eq(schema.loyaltyPrograms.id, programId))
      .limit(1);

    if (!program) throw new Error('Program not found');

    const [txn] = await tx.insert(schema.loyaltyPointsTransactions).values({
      id: crypto.randomUUID(),
      memberId,
      programId,
      outletId,
      points,
      type: 'adjust',
      createdAt: new Date(),
    }).returning();

    return txn;
  });
}

export async function enrollCustomerInProgram(customerId: string, programId: string) {
  return withTenantDb(async (tx) => {
    const [program] = await tx
      .select()
      .from(schema.loyaltyPrograms)
      .where(eq(schema.loyaltyPrograms.id, programId))
      .limit(1);
    if (!program) throw new Error('Program not found');

    let [member] = await tx
      .select()
      .from(schema.loyaltyMembers)
      .where(eq(schema.loyaltyMembers.customerId, customerId))
      .limit(1);

    if (!member) {
      [member] = await tx.insert(schema.loyaltyMembers).values({
        id: crypto.randomUUID(),
        customerId,
      }).returning();
    }

    const [existing] = await tx
      .select()
      .from(schema.loyaltyMemberPrograms)
      .where(and(
        eq(schema.loyaltyMemberPrograms.memberId, member.id),
        eq(schema.loyaltyMemberPrograms.programId, programId),
      ))
      .limit(1);

    if (existing) throw new Error('Customer already enrolled in this program');

    const [enrollment] = await tx.insert(schema.loyaltyMemberPrograms).values({
      id: crypto.randomUUID(),
      memberId: member.id,
      programId,
    }).returning();

    return enrollment;
  });
}

export async function createCustomer(data: { name: string; phone: string; email?: string }) {
  return withTenantDb(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phone, data.phone))
      .limit(1);

    if (existing) throw new Error('Customer with this phone already exists');

    const [customer] = await tx.insert(schema.customers).values({
      id: crypto.randomUUID(),
      name: data.name,
      phone: data.phone,
      email: data.email || null,
    }).returning();

    return customer;
  });
}