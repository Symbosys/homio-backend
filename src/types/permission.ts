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
 * User module permission names
 */
export const USER_PERMISSIONS = {
  CREATE_USER: "CREATE_USER",
  READ_USER: "READ_USER",
  UPDATE_USER: "UPDATE_USER",
  DELETE_USER: "DELETE_USER",
  RESET_PASSWORD_USER: "RESET_PASSWORD_USER",
  ASSIGN_ROLE_USER: "ASSIGN_ROLE_USER",
  ASSIGN_PERMISSION_USER: "ASSIGN_PERMISSION_USER",
} as const;

export type UserPermissionName =
  (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];

/**
 * User module permission slugs
 */
export const USER_PERMISSION_SLUGS = {
  CREATE_USER: "create-user",
  READ_USER: "read-user",
  UPDATE_USER: "update-user",
  DELETE_USER: "delete-user",
  RESET_PASSWORD_USER: "reset-password-user",
  ASSIGN_ROLE_USER: "assign-role-user",
  ASSIGN_PERMISSION_USER: "assign-permission-user",
} as const;

export type UserPermissionSlug =
  (typeof USER_PERMISSION_SLUGS)[keyof typeof USER_PERMISSION_SLUGS];

/**
 * Global union of permission names and slugs across all modules.
 * Extend this as more modules (e.g. Roles, Leads, Deals) are added.
 */
export type PermissionName = UserPermissionName;
export type PermissionSlug = UserPermissionSlug;

/**
 * Type contract for defining a seedable permission
 */
export interface PermissionDefinition {
  name: PermissionName;
  slug: PermissionSlug;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}
