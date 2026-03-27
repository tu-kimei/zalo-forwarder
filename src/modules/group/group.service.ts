import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all group configurations.
 */
export async function getAllGroups() {
  return prisma.groupConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single group config by ID.
 */
export async function getGroupById(id: string) {
  return prisma.groupConfig.findUnique({ where: { id } });
}

/**
 * Create a new group configuration.
 */
export async function createGroup(data: {
  groupId: string;
  groupName?: string;
  category?: string;
  active?: boolean;
}) {
  return prisma.groupConfig.create({
    data: {
      groupId: data.groupId,
      groupName: data.groupName ?? null,
      category: data.category ?? null,
      active: data.active ?? true,
    },
  });
}

/**
 * Update a group configuration.
 */
export async function updateGroup(
  id: string,
  data: {
    groupId?: string;
    groupName?: string;
    category?: string;
    active?: boolean;
  },
) {
  return prisma.groupConfig.update({
    where: { id },
    data,
  });
}

/**
 * Delete a group configuration.
 */
export async function deleteGroup(id: string) {
  return prisma.groupConfig.delete({ where: { id } });
}

/**
 * Check if a group (by its Zalo groupId) is allowed/active.
 * Returns true if the group is configured and active,
 * or if no groups are configured (allow all).
 */
export async function isGroupAllowed(groupId: string): Promise<boolean> {
  const totalGroups = await prisma.groupConfig.count();

  // If no groups configured, allow all
  if (totalGroups === 0) return true;

  const group = await prisma.groupConfig.findUnique({
    where: { groupId },
  });

  return group?.active ?? false;
}
