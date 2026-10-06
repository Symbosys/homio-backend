import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

const embedder1 = new GoogleGenerativeAIEmbeddings({
  apiKey: "TEST",
  model: "text-embedding-004",
  taskType: TaskType.RETRIEVAL_DOCUMENT,
});

console.log("Embedder options:", {
  model: (embedder1 as any).model,
  modelName: (embedder1 as any).modelName,
  taskType: (embedder1 as any).taskType,
});
