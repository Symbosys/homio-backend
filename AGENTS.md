# AGENTS.md - Homio CRM Global Guidelines

## Critical Architecture: Multi-Tenant B2B SaaS Standards

1. **Organization-Centric Model**:
   - Homio CRM is a multi-tenant B2B SaaS platform.
   - **Everything belongs to an Organization (`organizationId @db.Uuid`)**.
   - Every business model (Users, Roles, Customers, Leads, Projects, Tasks, Invoices) MUST have an `organizationId` foreign key and relation to `Organization`.

2. **Role & Permission Isolation**:
   - Roles strictly belong to an organization: `Role.organizationId String @map("organization_id") @db.Uuid` (Required relation).
   - Role slugs are unique per tenant, NOT globally: `@@unique([organizationId, slug])`.
   - Each organization can create and customize their own roles without conflicting with other tenants.

3. **Query Scoping**:
   - Always filter tenant-owned data by `organizationId: req.user.organizationId`.
   - Never allow cross-tenant data leaks.

4. **Image & File Storage Architecture**:
   - All image and file uploads across Homio CRM (categories, organization logos, product media, documents, site photos) MUST be handled through the multi-cloud storage provider service located at `server/src/lib/storage` (`storageService.upload(...)`).
   - Never ask users or admins to manually paste image URLs in input boxes; always provide file upload / picker mechanisms on the frontend and route files through the storage provider on the backend.
   - Decouple all business logic from specific cloud vendors by routing through `StorageService` (`server/src/lib/storage/storage.service.ts`).
   - **Structured JSON Storage (`ImageType`)**:
     - All image fields in Prisma schemas MUST be modeled as `Json?` (e.g. `imageUrl Json? @map("image_url")`, `logoUrl Json? @map("logo_url")`, `coverImageUrl Json? @map("cover_image_url")`).
     - Stored JSON objects must strictly adhere to the `ImageType` interface (`id`, `url`, `bytes`, `format`, `provider`), exactly following the pattern established in `organization.controller.ts` and `organization.service.ts`.
     - Frontend models must parse image fields safely, extracting `image['url']` from structured JSON maps while gracefully supporting raw string URL fallbacks.
   - **Strict Client-Side Image Compression Under 100 KB**:
     - Every single image uploaded anywhere across Homio CRM (WhatsApp template headers & media samples, user/employee avatars, organization logos, project site photos, product catalog media, quotation attachments, customer documents) MUST be compressed to **strictly under 100 KB (`< 100 KB` / max 95-100 KB target)** before dispatching to backend endpoints or storage services.
     - Never upload raw, uncompressed image files to the server. Frontend implementations must strictly utilize `compressImageFile` / `compressUnder100KB` (`@/utils/imageCompressor`).
   - **Cloud Media Auto-Cleanup on Resource Update & Deletion**:
     - Whenever any resource (organization, category, catalog item, product media, PDF page asset, site photo, document, attachment) is updated and the update replaces or removes existing cloud image(s), the backend service MUST immediately delete the replaced/orphaned image asset from cloud storage via `storageService.delete(oldImageId)`.
     - Whenever any resource containing cloud images (e.g. `imageUrl`, `logoUrl`, `galleryImages` array, `image`) is deleted or soft-deleted, all associated cloud image assets MUST be deleted from the cloud storage provider via `storageService.delete(...)` to prevent orphan storage leakage and eliminate cloud storage bloat.

5. **Dirty Payload / Partial Updates Standard**:
   - While updating any resource across the platform (PATCH / PUT endpoints), clients MUST send only those fields in the payload that have actually been changed.
   - Avoid re-sending unmodified data indiscriminately to maintain payload efficiency and prevent race conditions.

6. **Clickable Elements Must Have `cursor-pointer`**:
   - Any element that is interactive, clickable, or dispatches user actions (buttons, clickable cards, custom selectors, modal triggers, accordion toggles, dropdowns, table rows with onClick) MUST explicitly have `cursor-pointer` applied so the user always receives unambiguous visual feedback across all devices.

7. **Frontend Infinite Query Standard for Paginated APIs**:
   - All TanStack Query hooks fetching paginated endpoints on the frontend (`useUsers`, `useOrganizations`, `useDepartments`, `useEmployees`, `useTeams`, etc.) MUST use `useInfiniteQuery` directly.
   - Configure queries with `initialPageParam: 1`, `getNextPageParam`, and `getPreviousPageParam`.

8. **Search Inputs Must Use Debouncing**:
   - Wherever there is a search bar, filter input, or search query that triggers API requests, debouncing (e.g. 300-500ms via `useDebounce`) MUST be applied to prevent redundant server calls on every keystroke.

9. **Custom Professional Scrollbar Standard**:
   - Never use bulky OS default scrollbars (especially default Windows sliders).
   - All scrollable areas, modals, dialogs, dropdowns, tables, and panels MUST use sleek, professional custom scrollbar styling (thin 4-6px width, rounded thumbs, subtle track background, theme-aware colors matching light and dark modes).

10. **Multi-line JSDoc Comments Architecture Standard**:
    - All backend routes, controllers, services, repositories, and validators MUST include rich, comprehensive multi-line JSDoc comments for clarity and developer understanding.
    - **Routes Documentation Pattern**:
      ```typescript
      /**
       * @route   GET /api/v1/crm/leads
       * @desc    Fetch paginated list of leads with pipeline stage and budget filters
       */
      ```
    - Controllers, Services, Repositories, and Validators must document purpose, parameter types, error handling, tenant scoping, and return values.

11. **Employee Selection Standard (`EmployeePickerModal`)**:
    - Wherever employee / personnel selection or assignment is required across any module (CRM Leads, Meetings, Tasks, Follow-ups, HRMS, Projects, etc.), ALWAYS use the centralized `EmployeePickerModal` located at `@/components/shared/employee` (`EmployeePickerModal`).
    - Never use plain `<select>` dropdowns or custom ad-hoc user pickers for selecting workforce personnel.
    - Render a sleek interactive trigger card (with `User` / `UserCheck` icon, employee name, designation, and code) that opens `EmployeePickerModal` on click with `cursor-pointer`.

12. **Frontend Modular Page & Component Folder Architecture Standard**:
    - Every feature module in `frontend/src/pages/<module>/` must strictly follow the dedicated page subfolder pattern:
      ```
      frontend/src/pages/<module>/
        ├── <page-folder-1>/ (e.g., create-project)
        │     ├── components/
        │     │     ├── SectionA.tsx
        │     │     └── SectionB.tsx
        │     └── index.tsx
        ├── <page-folder-2>/ (e.g., project-details)
        │     ├── components/
        │     │     ├── HeaderBanner.tsx
        │     │     └── TabSection.tsx
        │     └── index.tsx
        ├── <page-folder-3>/ (e.g., edit-project)
        │     ├── components/
        │     └── index.tsx
        └── index.tsx (or projects list catalog entry point)
      ```
    - Each page directory contains its own dedicated `components/` subfolder for modular sub-views, forms, sections, and modals specific to that page.
    - The `index.tsx` file inside each page folder acts as the clean orchestrator coordinating page state, routing parameters, and TanStack Query hooks.

13. **TanStack Query Form Handling Standard**:
    - All form submissions (creation, updates, deletions, status transitions) across the frontend MUST be handled using TanStack Query mutations (`useMutation` custom hooks).
    - Always handle loading states (`isPending`), error alerts (`handleMutationError`), success messages (`handleMutationSuccess`), query cache invalidation (`queryClient.invalidateQueries`), and partial dirty payload submission.

14. **Centralized Root Test Suite Location Standard**:
    - All frontend test suites MUST be organized inside the root test folder:
      ```
      frontend/tests/<module>/<page-name>.test.tsx
      ```
    - Do NOT scatter tests into arbitrary nested `__tests__` directories inside feature components. All test suites reside systematically under `frontend/tests/<module>/`.

15. **Page Container Sizing and Breathing Room Standard**:
    - All full-page module views and catalogs MUST use the standard container wrapper:
      ```tsx
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      ```
    - Never omit vertical and horizontal padding (`p-4 sm:p-6 lg:p-8`), as omitting it causes the top header to clip into the fixed navbar and touch the sidebar with zero margin.
    - Avoid excessively constrained widths on catalog tables; use `max-w-7xl` to prevent oversized empty side gaps while maintaining balanced distancing.

16. **Persistent Catalog View Modes Standard (`useViewStore`)**:
    - When providing layout view switchers (Grid, Table, Kanban, List) across feature catalogs, ALWAYS persist the selection using the centralized Zustand store (`useViewStore` from `@/store`).
    - Never store catalog view modes in ephemeral local component state alone; user view preferences must persist across route transitions and browser refreshes.

17. **Strict TypeScript Validation (`tsc --noEmit`)**:
    - ALWAYS verify TypeScript type safety across the project using `npx tsc --noEmit` (in both `frontend` and `server`) before concluding any task.
    - Never bypass type errors or leave unresolved diagnostics; enforce 0 TypeScript errors before finalizing code changes.

18. **Universal Additional Information (`additionalInformation`) Standard Across All DB Models & Features**:
    - **Database & Prisma Architecture**: Every new and existing DB entity/business model across Homio CRM (Leads, Projects, ProjectSite, ProjectSchedule, ProjectCommercial, Tasks, Invoices, Customers, HRMS, etc.) MUST include an `additionalInformation Json? @map("additional_information")` field.
    - **Custom Key-Value Fields**: Enables organizations and tenants to dynamically define custom input fields and their typed values (strings, numbers, booleans, dates) in JSON format without requiring schema migrations.
    - **Full-Stack Lifecycle Integration**:
      - **Backend**: Every controller, service, repository, and validation schema (Zod/Joi/DTO) MUST accept, validate, store, and return `additionalInformation`.
      - **Creation Forms**: Must embed the dynamic custom fields editor allowing users to add arbitrary key-value custom attributes.
      - **Edit Forms**: Must pre-populate existing `additionalInformation` fields and allow adding new fields, modifying values, and deleting individual rows.
      - **Detail / View Tabs**: Must render custom fields as clean, responsive, dedicated individual cards using `AdditionalInformationViewer`.

19. **Complete Resource Editability Standard (Symmetric Creation & Editing)**:
    - Organizations and users MUST be able to edit all fields of any resource that were present and configurable during its creation.
    - If a field is configurable, assignable, or selectable during resource creation (e.g., target project, assigned personnel, dates, channels, objectives, ratings, notes, outcomes, custom additional information), the corresponding edit modal or form MUST allow editing those same fields.
    - Edit modals/views must pre-populate existing values accurately, provide appropriate pickers/inputs (such as `EmployeePickerModal`), and submit partial dirty updates (Rule 5) via TanStack Query mutations (Rule 13).

20. **Full Field Completeness in Resource Creation & Editing Forms**:
    - Creation and Edit forms across all platform modules MUST expose and capture every single field defined in the entity's backend validation schemas (Zod/DTOs) and DB models.
    - Never omit schema-supported properties (such as property location details: `propertyName`, `propertySizeSqft`, `propertyAddress`, `propertyCity`, `propertyState`, `propertyPincode`, `possessionStatus`, `possessionDate`, work description, project types, dual budgets in Lakh and INR, channel partner linkage, and attachments).
    - When creating a resource, users must be provided complete, first-class UI inputs, pickers, and searchable dropdowns for all attributes.

21. **Standardized Collapsible & Compact Single-Line Analytics/KPI Cards Standard**:
    - Across all platform catalogs and module dashboards (Leads, Projects, Tasks, Invoices, Clients/Customers, HRMS, etc.), never let bulky KPI metric cards consume half the screen and push the primary data table, catalog, or Kanban board below the fold.
    - **Dual-Mode Display Standard**:
      1. **Compact Single-Line Ribbon (Default View)**: Renders a sleek, single horizontal bar (`rounded-xl border border-border/70 bg-card/40 backdrop-blur-xs px-3.5 py-2 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar`) displaying all metrics compactly with badge icons, titles, bold values, and an "Expand Cards" button (~34px vertical height).
      2. **Full Detailed Cards Mode**: When expanded, renders the 4-column responsive grid with full metric icons, titles, large values, and subtitle descriptions.
    - **State Persistence & Header Toggle**:
      - Provide an "Analytics" toggle button in the page header with `<BarChart3 className="w-3.5 h-3.5 text-primary" />` and `<ChevronDown />`.
      - Persist the toggle state in `localStorage` (e.g. `homio_<module>_kpi_expanded`), defaulting to `false` (compact view) so users always get maximum workspace visibility on initial page load while preserving their display preference.

22. **Backend Type Import & Zod NativeEnum Standard (`types.ts`)**:
    - In backend code, ALWAYS import types, interfaces, models, and enums from `server/src/types/types.ts` (e.g., `import { ... } from "../../../types/types"`), where the default generated Prisma Client is exported (`export * from "../../generated/prisma/client.js"`).
    - In all Zod validation schemas across the backend, NEVER write custom, manually hardcoded string enum arrays (e.g. `z.enum([...])`) for database entities or Prisma enums.
    - ALWAYS use `z.nativeEnum(PrismaEnum)` with the generated Prisma enum directly imported from `types.ts` (e.g. `export const ProjectTypeEnum = z.nativeEnum(ProjectType);`). This guarantees 100% synchronization with the Prisma database schema and prevents runtime validation mismatches when enum values are added or updated.

23. **Implementation Plans Must Always Be Created as Artifacts (`write_to_file`)**:
    - Whenever designing, architecting, or proposing an implementation plan for new features, major updates, or complex workflows, ALWAYS create a dedicated markdown artifact file in the agent artifact directory using `write_to_file`.
    - Never dump lengthy implementation plan specifications directly into conversational chat text alone.
    - The artifact must include clear architectural diagrams (Mermaid), phased checklists, data flow structures, type definitions, and schema changes, with `UserFacing: true` and `RequestFeedback: true` so the user can review and approve it cleanly.

24. **Token-Oriented Object Notation (TOON) Context Standard for LLM Prompts (`@toon-format/toon`)**:
    - Whenever serializing, injecting, or feeding structured context (customer details, lead information, project specs, product catalog data, conversational history, funnel attributes, quotation lines) to the LLM across any AI workflow (RAG, autonomous WhatsApp replies, AI training playground, extraction, or classification), ALWAYS use TOON format via `@toon-format/toon` (`serializeToToon` from `@/ai/utils/toon.serializer`) instead of raw JSON.
    - Never feed raw JSON (`JSON.stringify`) into LLM system prompts or prompt templates; TOON eliminates syntactic token waste (curly braces, colons with quotation marks, trailing commas) to drastically minimize token consumption, reduce inference latency, and maximize LLM reasoning clarity.
