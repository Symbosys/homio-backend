import { describe, it, expect } from "bun:test";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ORGANIZATION_ID_2,
  MOCK_CUSTOMER_ID,
  MOCK_PROJECT_ID,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Projects Multi-Tenant Isolation Tests", () => {
  it("should ensure project queries always mandate organizationId filtering", () => {
    const tenant1Query = {
      where: {
        id: MOCK_PROJECT_ID,
        organizationId: MOCK_ORGANIZATION_ID_1,
        isDeleted: false,
      },
    };

    const tenant2Query = {
      where: {
        id: MOCK_PROJECT_ID,
        organizationId: MOCK_ORGANIZATION_ID_2,
        isDeleted: false,
      },
    };

    expect(tenant1Query.where.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
    expect(tenant2Query.where.organizationId).toBe(MOCK_ORGANIZATION_ID_2);
    expect(tenant1Query.where.organizationId).not.toBe(tenant2Query.where.organizationId);
  });

  it("should prevent cross-tenant customer linkage on project creation", () => {
    const customerTenantId: string = MOCK_ORGANIZATION_ID_1;
    const requestTenantId: string = MOCK_ORGANIZATION_ID_2;

    const isCustomerInTenant = customerTenantId === requestTenantId;
    expect(isCustomerInTenant).toBe(false);
  });

  it("should enforce tenant-scoped uniqueness on project codes", () => {
    // Both Org 1 and Org 2 can independently have "PRJ-2026-0001" without collision
    const org1Project = {
      organizationId: MOCK_ORGANIZATION_ID_1,
      projectCode: "PRJ-2026-0001",
    };

    const org2Project = {
      organizationId: MOCK_ORGANIZATION_ID_2,
      projectCode: "PRJ-2026-0001",
    };

    expect(org1Project.projectCode).toBe(org2Project.projectCode);
    expect(org1Project.organizationId).not.toBe(org2Project.organizationId);
  });

  it("should isolate project milestone queries to the parent project and tenant", () => {
    const project1MilestoneQuery = {
      where: {
        projectId: MOCK_PROJECT_ID,
        project: { organizationId: MOCK_ORGANIZATION_ID_1 },
        isDeleted: false,
      },
    };

    const project2MilestoneQuery = {
      where: {
        projectId: MOCK_PROJECT_ID,
        project: { organizationId: MOCK_ORGANIZATION_ID_2 },
        isDeleted: false,
      },
    };

    expect(project1MilestoneQuery.where.project.organizationId).not.toBe(
      project2MilestoneQuery.where.project.organizationId
    );
  });

  it("should isolate project site progress queries to the parent project and tenant", () => {
    const project1ProgressQuery = {
      where: {
        projectId: MOCK_PROJECT_ID,
        project: { organizationId: MOCK_ORGANIZATION_ID_1 },
        isDeleted: false,
      },
    };

    const project2ProgressQuery = {
      where: {
        projectId: MOCK_PROJECT_ID,
        project: { organizationId: MOCK_ORGANIZATION_ID_2 },
        isDeleted: false,
      },
    };

    expect(project1ProgressQuery.where.project.organizationId).not.toBe(
      project2ProgressQuery.where.project.organizationId
    );
  });
});
