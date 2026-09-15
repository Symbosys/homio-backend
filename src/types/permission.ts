/**
 * Resource identifiers for system permissions
 */
export const PERMISSION_RESOURCES = {
  USER: "USER",
  ROLE: "ROLE",
  PERMISSION: "PERMISSION",
} as const;

export type PermissionResource =
  (typeof PERMISSION_RESOURCES)[keyof typeof PERMISSION_RESOURCES];

/**
 * Standard actions for permissions
 */
export const PERMISSION_ACTIONS = {
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  RESET_PASSWORD: "RESET_PASSWORD",
  ASSIGN_ROLE: "ASSIGN_ROLE",
  ASSIGN_PERMISSION: "ASSIGN_PERMISSION",
} as const;

export type PermissionAction =
  (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

/**
 * Global Permissions Constant Map
 * All system permissions across all modules are consolidated here.
 * Future module permissions will be appended directly under their respective module section.
 */
export const Permissions = {
  // ==========================================
  // USER MODULE (User, Role, & Permission Catalog)
  // ==========================================
  CREATE_USER: "CREATE_USER",
  READ_USER: "READ_USER",
  UPDATE_USER: "UPDATE_USER",
  DELETE_USER: "DELETE_USER",
  RESET_PASSWORD_USER: "RESET_PASSWORD_USER",
  ASSIGN_ROLE_USER: "ASSIGN_ROLE_USER",
  ASSIGN_PERMISSION_USER: "ASSIGN_PERMISSION_USER",

  CREATE_ROLE: "CREATE_ROLE",
  READ_ROLE: "READ_ROLE",
  UPDATE_ROLE: "UPDATE_ROLE",
  DELETE_ROLE: "DELETE_ROLE",
  ASSIGN_PERMISSION_ROLE: "ASSIGN_PERMISSION_ROLE",

  READ_PERMISSION: "READ_PERMISSION",

  // ==========================================
  // FUTURE MODULES (e.g. Lead, Property, Task...)
  // ==========================================
} as const;

/**
 * Single unified Permission type across the entire platform
 */
export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * Backward compatibility alias for Permission
 */
export type PermissionName = Permission;

/**
 * Type contract for defining a seedable permission definition
 */
export interface PermissionDefinition {
  name: Permission;
  slug: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}
