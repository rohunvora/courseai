import { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ModelError } from '../services/model-selector.js';

// Generate UUID v7 for error IDs (timestamp-based for better sorting)
function generateErrorId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = Math.random().toString(16).substring(2, 14).padStart(12, '0');
  return `${timestampHex.substring(0, 8)}-${timestampHex.substring(8, 12)}-7${randomHex.substring(0, 3)}-${randomHex.substring(3, 7)}-${randomHex.substring(7, 12)}`;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errorId: string;
    details?: any;
  };
}

export function setupErrorHandler(fastify: FastifyInstance) {
  // Error handler with traceable error IDs
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const errorId = generateErrorId();
    
    // Log error with ID for backend tracking
    fastify.log.error({
      errorId,
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body
    }, `Error ${errorId}: ${error.message}`);

    // Handle specific error types with proper codes
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          errorId,
          details: error.validation,
        },
      } as ErrorResponse);
    }

    if (error instanceof ValidationError) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          errorId,
          details: error.details,
        },
      } as ErrorResponse);
    }

    if (error instanceof ModelError) {
      const statusCode = error.code === 'AI_UNAVAILABLE' ? 503 : 
                        error.code === 'TOKEN_LIMIT_EXCEEDED' ? 422 : 500;
      
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          errorId,
        },
      } as ErrorResponse);
    }

    // Rate limiting errors
    if (error.statusCode === 429) {
      reply.header('X-RateLimit-Reason', 'TOO_MANY_CHATS');
      const retryAfter = Math.ceil((error as any).retryAfter || 60);
      
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait before trying again.',
          errorId,
          details: { retryAfterSeconds: retryAfter }
        },
      } as ErrorResponse);
    }

    // Safety/Quality validation errors
    if ((error as any).code === 'AI_VALIDATION_ERROR') {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AI_VALIDATION_ERROR', 
          message: 'AI response failed safety validation',
          errorId,
        },
      } as ErrorResponse);
    }

    // Generic internal errors
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        errorId,
      },
    } as ErrorResponse);
  });
}

// Custom error classes for better error handling
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class QualityValidationError extends Error {
  public code = 'AI_VALIDATION_ERROR';
  
  constructor(message: string) {
    super(message);
    this.name = 'QualityValidationError';
  }
}

export class RateLimitError extends Error {
  public statusCode = 429;
  
  constructor(message: string, public retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
  }
}