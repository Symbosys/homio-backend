import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  toggleCustomerPortalAccess,
  deleteCustomer,
  addCustomerActivity,
  uploadCustomerDocument,
  deleteCustomerDocument,
} from "../controllers/customer.controller.js";

const customerRoutes = Router();

// Protect all customer routes for CRM Admin & Tenant Staff
customerRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/crm/customers
 * @desc    Create a new customer (or associate existing platform user) with optional avatar upload
 */
customerRoutes.post("/", upload.single("avatar"), createCustomer);

/**
 * @route   GET /api/v1/crm/customers
 * @desc    Fetch paginated list of organization customers with type, search, and status filters
 */
customerRoutes.get("/", getCustomers);

/**
 * @route   GET /api/v1/crm/customers/:id
 * @desc    Get detailed customer profile by ID including leads, documents, and portal user status
 */
customerRoutes.get("/:id", getCustomerById);

/**
 * @route   PATCH /api/v1/crm/customers/:id
 * @desc    Update customer details (partial dirty payload) with optional avatar upload
 */
customerRoutes.patch("/:id", upload.single("avatar"), updateCustomer);

/**
 * @route   PATCH /api/v1/crm/customers/:id/portal-access
 * @desc    Toggle client portal access for customer (invites or enables/disables login)
 */
customerRoutes.patch("/:id/portal-access", toggleCustomerPortalAccess);

/**
 * @route   DELETE /api/v1/crm/customers/:id
 * @desc    Soft-delete a customer from the tenant organization
 */
customerRoutes.delete("/:id", deleteCustomer);

/**
 * @route   POST /api/v1/crm/customers/:id/activities
 * @desc    Add timeline activity / note to customer history
 */
customerRoutes.post("/:id/activities", addCustomerActivity);

/**
 * @route   POST /api/v1/crm/customers/:id/documents
 * @desc    Upload KYC or agreement document for customer via multi-cloud storage
 */
customerRoutes.post(
  "/:id/documents",
  upload.any({ category: "all", maxFileSize: 25 * 1024 * 1024 }),
  uploadCustomerDocument
);

/**
 * @route   DELETE /api/v1/crm/customers/documents/:id
 * @desc    Delete customer KYC / contract document
 */
customerRoutes.delete("/documents/:id", deleteCustomerDocument);

export default customerRoutes;
