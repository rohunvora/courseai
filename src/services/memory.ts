import OpenAI from 'openai';
import { db } from '../db';
import { userMemory, progressLogs } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface MemoryEntry {
  content: string;
  metadata?: any;
  importanceScore?: number;
  courseId?: string;
}

interface RelevantMemory {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  createdAt: Date;
}

export class MemoryService {
  private client: OpenAI;
  private embeddingQueue: Map<string, MemoryEntry[]> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.client = new OpenAI({ apiKey });
    
    // Start batch processing every minute
    this.startBatchProcessing();
  }
  
  // Queue memory for embedding
  async queueMemory(userId: string, entry: MemoryEntry): Promise<void> {
    const userQueue = this.embeddingQueue.get(userId) || [];
    userQueue.push(entry);
    this.embeddingQueue.set(userId, userQueue);
    
    // If queue is getting large, process immediately
    if (userQueue.length >= 10) {
      await this.processUserQueue(userId);
    }
  }
  
  // Process all queued memories every minute
  private startBatchProcessing(): void {
    this.processingInterval = setInterval(async () => {
      const userIds = Array.from(this.embeddingQueue.keys());
      
      for (const userId of userIds) {
        await this.processUserQueue(userId);
      }
    }, 60000); // 1 minute
  }
  
  // Process a single user's queue
  private async processUserQueue(userId: string): Promise<void> {
    const queue = this.embeddingQueue.get(userId);
    if (!queue || queue.length === 0) return;
    
    // Clear the queue immediately to avoid double processing
    this.embeddingQueue.set(userId, []);
    
    try {
      // Batch up to 100 messages for embedding
      const batches = this.chunkArray(queue, 100);
      
      for (const batch of batches) {
        const texts = batch.map(entry => entry.content);
        
        // Generate embeddings
        const response = await this.client.embeddings.create({
          model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          input: texts,
        });
        
        // Save to database
        const memoryEntries = batch.map((entry, index) => ({
          userId,
          courseId: entry.courseId,
          content: entry.content,
          embedding: response.data[index].embedding,
          embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          metadata: entry.metadata || {},
          importanceScore: entry.importanceScore || 1.0,
          redacted: false,
        }));
        
        await db.insert(userMemory).values(memoryEntries);
      }
    } catch (error) {
      console.error(`Error processing memory queue for user ${userId}:`, error);
      // Re-queue failed items
      const currentQueue = this.embeddingQueue.get(userId) || [];
      this.embeddingQueue.set(userId, [...currentQueue, ...queue]);
    }
  }
  
  // Get relevant memories for a query
  async getRelevantMemories(
    userId: string,
    query: string,
    options: {
      courseId?: string;
      limit?: number;
      tokenBudget?: number;
    } = {}
  ): Promise<RelevantMemory[]> {
    const { courseId, limit = 10, tokenBudget = 1500 } = options;
    
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build the similarity query
      let whereClause = and(
        eq(userMemory.userId, userId),
        eq(userMemory.redacted, false)
      );
      
      if (courseId) {
        whereClause = and(whereClause, eq(userMemory.courseId, courseId));
      }
      
      // Use cosine similarity with pgvector
      const similarityQuery = sql`1 - (${userMemory.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;
      
      // Fetch relevant memories
      const memories = await db
        .select({
          id: userMemory.id,
          content: userMemory.content,
          metadata: userMemory.metadata,
          createdAt: userMemory.createdAt,
          similarity: similarityQuery,
        })
        .from(userMemory)
        .where(whereClause)
        .orderBy(desc(similarityQuery))
        .limit(limit * 2); // Fetch extra to account for token limit
      
      // Filter by token budget
      let tokenCount = 0;
      const filteredMemories: RelevantMemory[] = [];
      
      for (const memory of memories) {
        const memoryTokens = this.estimateTokens(memory.content);
        if (tokenCount + memoryTokens > tokenBudget) break;
        
        tokenCount += memoryTokens;
        filteredMemories.push({
          ...memory,
          similarity: Number(memory.similarity),
          createdAt: memory.createdAt || new Date(),
        });
      }
      
      return filteredMemories;
    } catch (error) {
      console.error('Error fetching relevant memories:', error);
      return [];
    }
  }
  
  // Generate embedding for a single text
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  // Estimate token count (rough approximation)
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  // Helper to chunk array
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  // Queue memories from chat messages
  async queueChatMemory(
    userId: string,
    courseId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    // Queue user message
    await this.queueMemory(userId, {
      content: `User: ${userMessage}`,
      courseId,
      metadata: { type: 'chat', role: 'user' },
      importanceScore: 1.0,
    });
    
    // Queue assistant response
    await this.queueMemory(userId, {
      content: `Assistant: ${assistantResponse}`,
      courseId,
      metadata: { type: 'chat', role: 'assistant' },
      importanceScore: 0.8,
    });
  }
  
  // Queue memories from workout logs
  async queueWorkoutMemory(
    userId: string,
    courseId: string,
    workout: any
  ): Promise<void> {
    const summary = `Workout logged: ${workout.exercise} - ${workout.sets} sets, ${workout.reps.join(', ')} reps${
      workout.weight ? ` at ${workout.weight.join(', ')} ${workout.unit}` : ''
    }${workout.notes ? `. Notes: ${workout.notes}` : ''}`;
    
    await this.queueMemory(userId, {
      content: summary,
      courseId,
      metadata: { 
        type: 'workout',
        exercise: workout.exercise,
        totalVolume: workout.totalVolume,
        date: new Date().toISOString(),
      },
      importanceScore: 1.5, // Higher importance for workouts
    });
  }
  
  // Get recent workouts for context
  async getRecentWorkouts(
    userId: string,
    courseId?: string,
    limit: number = 5
  ): Promise<any[]> {
    let whereClause = and(
      eq(progressLogs.userId, userId),
      eq(progressLogs.activityType, 'exercise')
    );
    
    if (courseId) {
      whereClause = and(whereClause, eq(progressLogs.courseId, courseId));
    }
    
    const workouts = await db
      .select()
      .from(progressLogs)
      .where(whereClause)
      .orderBy(desc(progressLogs.timestamp))
      .limit(limit);
    
    return workouts;
  }
  
  // Cleanup
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

// Singleton instance
let memoryService: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!memoryService) {
    memoryService = new MemoryService();
  }
  return memoryService;
}