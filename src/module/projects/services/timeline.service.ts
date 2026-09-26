import { prisma } from "../../../lib/prisma.js";
import { TimelineRepository } from "../repos/timeline.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateTimelineInput,
  UpdateTimelineInput,
  GetTimelinesQuery,
} from "../validators/timeline.validator.js";

/**
 * Service class handling business logic for Project Timelines
 */
export class TimelineService {
  private timelineRepo: TimelineRepository;

  constructor() {
    this.timelineRepo = new TimelineRepository();
  }

  /**
   * Helper to verify project existence and tenant scoping
   */
  private async verifyProject(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found or access denied", statusCode.Not_Found);
    }
    return project;
  }

  /**
   * Create a new timeline event (custom or system-generated) for a project
   */
  async createTimeline(
    projectId: string,
    organizationId: string,
    data: CreateTimelineInput,
    createdById?: string
  ) {
    await this.verifyProject(projectId, organizationId);
    return this.timelineRepo.create(projectId, data, createdById);
  }

  /**
   * Retrieve list of timeline events for a project with filters and sorting
   */
  async getTimelines(projectId: string, organizationId: string, query: GetTimelinesQuery) {
    await this.verifyProject(projectId, organizationId);
    return this.timelineRepo.findMany(projectId, query);
  }

  /**
   * Retrieve a single timeline event by ID
   */
  async getTimelineById(id: string, projectId: string, organizationId: string) {
    await this.verifyProject(projectId, organizationId);
    const item = await this.timelineRepo.findById(id, projectId);
    if (!item) {
      throw new ErrorResponse("Timeline event not found", statusCode.Not_Found);
    }
    return item;
  }

  /**
   * Update an existing timeline event
   */
  async updateTimeline(
    id: string,
    projectId: string,
    organizationId: string,
    data: UpdateTimelineInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const existing = await this.timelineRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Timeline event not found", statusCode.Not_Found);
    }

    return this.timelineRepo.update(id, projectId, data);
  }

  /**
   * Delete a timeline event
   */
  async deleteTimeline(id: string, projectId: string, organizationId: string) {
    await this.verifyProject(projectId, organizationId);
    const existing = await this.timelineRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Timeline event not found", statusCode.Not_Found);
    }

    await this.timelineRepo.delete(id);
    return { success: true, message: "Timeline event deleted successfully" };
  }
}

export const timelineService = new TimelineService();
