import { DoubtSolverRepository } from "../repositories/doubt-solver.repository.js";
import {
  DoubtSolverChain,
  type DoubtSolverChainInput,
} from "../../../lib/langchain/index.js";
import { AiChatMessageSender } from "../../../types/types.js";
import type {
  CreateDoubtSolverSessionInput,
  AskDoubtSolverQuestionInput,
  QueryDoubtSolverSessionsInput,
  UpdateDoubtSolverSessionInput,
} from "../validators/doubt-solver.validator.js";

export class DoubtSolverService {
  private repo: DoubtSolverRepository;

  constructor() {
    this.repo = new DoubtSolverRepository();
  }

  /**
   * Determine per-question credit deduction cost
   */
  public async getPerQuestionCost(): Promise<number> {
    const rate = await this.repo.getDoubtSolverServiceRate();
    return rate?.defaultCreditCost ?? 10;
  }

  /**
   * Create a new consultation session thread (with optional immediate first query)
   */
  public async createSession(
    organizationId: string,
    employeeId: string | null,
    input: CreateDoubtSolverSessionInput
  ) {
    const cost = await this.getPerQuestionCost();

    // If an initial question is asked immediately upon creation, verify credit balance first
    if (input.initialQuestion) {
      const wallet = await this.repo.findOrCreateWallet(organizationId);
      if (wallet.currentBalance < cost) {
        const err: any = new Error(
          `Insufficient AI credits. You have ${wallet.currentBalance} credits, but asking a question requires ${cost} credits.`
        );
        err.statusCode = 402;
        err.code = "INSUFFICIENT_CREDITS";
        throw err;
      }
    }

    // 1. Create session thread
    const doubtSession = await this.repo.createSession(
      organizationId,
      employeeId,
      input
    );

    // 2. If initial question provided, execute LangChain and deduct credits
    if (input.initialQuestion) {
      // Add user message
      const userMsg = await this.repo.addMessage(doubtSession.id, {
        sender: AiChatMessageSender.USER,
        messageText: input.initialQuestion,
      });

      // Run LangChain AI generation
      const aiResult = await DoubtSolverChain.execute({
        question: input.initialQuestion,
        topicCategory: doubtSession.topicCategory,
        intelligenceMode: doubtSession.intelligenceMode,
        history: [],
      });

      // Add AI response message
      const aiMsg = await this.repo.addMessage(doubtSession.id, {
        sender: AiChatMessageSender.AI,
        messageText: aiResult.messageText,
        structuredPoints: aiResult.structuredPoints,
        concludingNote: aiResult.concludingNote,
        additionalInformation: { rawText: aiResult.rawText },
      });

      // Atomic credit deduction
      const { wallet } = await this.repo.atomicDeductCredits({
        organizationId,
        employeeId,
        sessionId: doubtSession.sessionId,
        cost,
        description: `Doubt Solver initial query: "${input.initialQuestion.slice(0, 60)}"`,
      });

      return {
        session: doubtSession,
        messages: [userMsg, aiMsg],
        wallet,
        creditsDeducted: cost,
      };
    }

    return {
      session: doubtSession,
      messages: [],
      wallet: await this.repo.findOrCreateWallet(organizationId),
      creditsDeducted: 0,
    };
  }

  /**
   * Ask a question inside an existing consultation thread
   */
  public async askQuestion(
    sessionId: string,
    organizationId: string,
    employeeId: string | null,
    input: AskDoubtSolverQuestionInput
  ) {
    // 1. Verify session ownership
    const doubtSession = await this.repo.getSessionById(sessionId, organizationId);
    if (!doubtSession) {
      const err: any = new Error("Doubt consultation session not found");
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify wallet balance against active service rate
    const cost = await this.getPerQuestionCost();
    const wallet = await this.repo.findOrCreateWallet(organizationId);

    if (wallet.currentBalance < cost) {
      const err: any = new Error(
        `Insufficient AI credits. You have ${wallet.currentBalance} credits, but asking a question requires ${cost} credits.`
      );
      err.statusCode = 402;
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }

    // 3. Record User Prompt Message
    const userMessage = await this.repo.addMessage(doubtSession.id, {
      sender: AiChatMessageSender.USER,
      messageText: input.question,
      additionalInformation: input.additionalInformation as any,
    });

    // 4. Prepare History for LangChain Context
    const history = (doubtSession.messages || []).map((m: any) => ({
      sender: m.sender as "USER" | "AI",
      messageText: m.messageText,
    }));

    // 5. Execute LangChain AI Generation
    const intelligenceMode =
      input.intelligenceMode || doubtSession.intelligenceMode || "smart";
    const topicCategory =
      input.topicCategory || doubtSession.topicCategory || "General";

    const aiResult = await DoubtSolverChain.execute({
      question: input.question,
      topicCategory,
      intelligenceMode,
      history,
    });

    // 6. Record AI Response Message
    const aiMessage = await this.repo.addMessage(doubtSession.id, {
      sender: AiChatMessageSender.AI,
      messageText: aiResult.messageText,
      structuredPoints: aiResult.structuredPoints,
      concludingNote: aiResult.concludingNote,
      additionalInformation: {
        rawText: aiResult.rawText,
        suggestedFollowups: aiResult.suggestedFollowups,
      },
    });

    // 7. Atomic Credit Deduction & Ledger Entry
    const { wallet: updatedWallet } = await this.repo.atomicDeductCredits({
      organizationId,
      employeeId,
      sessionId,
      cost,
      description: `Doubt Solver query: "${input.question.slice(0, 60)}"`,
    });

    return {
      userMessage,
      aiMessage,
      wallet: updatedWallet,
      creditsDeducted: cost,
    };
  }

  /**
   * List paginated sessions
   */
  public async listSessions(
    organizationId: string,
    query: QueryDoubtSolverSessionsInput
  ) {
    return this.repo.listSessions(organizationId, query);
  }

  /**
   * Get single session with full message thread
   */
  public async getSessionById(sessionId: string, organizationId: string) {
    const session = await this.repo.getSessionById(sessionId, organizationId);
    if (!session) {
      const err: any = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    return session;
  }

  /**
   * Rate a message
   */
  public async rateMessage(
    messageId: string,
    rating: number,
    organizationId: string
  ) {
    const result = await this.repo.rateMessage(
      messageId,
      rating,
      organizationId
    );
    if (!result) {
      const err: any = new Error("Message not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }

  /**
   * Update session details
   */
  public async updateSession(
    sessionId: string,
    organizationId: string,
    data: UpdateDoubtSolverSessionInput
  ) {
    const result = await this.repo.updateSession(
      sessionId,
      organizationId,
      data
    );
    if (!result) {
      const err: any = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }

  /**
   * Delete session
   */
  public async deleteSession(sessionId: string, organizationId: string) {
    const result = await this.repo.deleteSession(sessionId, organizationId);
    if (!result) {
      const err: any = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }
}
