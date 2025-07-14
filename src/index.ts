import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { chatRoutes } from './routes/chat.js';
import { courseRoutes } from './routes/courses.js';
import { progressRoutes } from './routes/progress.js';
import { authRoutes } from './routes/auth.js';
import { logger } from './utils/logger.js';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Start server
const start = async () => {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-frontend-domain.com'] 
        : true,
      credentials: true,
    });

    // Health check
    fastify.get('/health', async (request, reply) => {
      const requestId = request.headers['x-request-id'] || 'health-check';
      logger.info('server', 'health_check', requestId);
      
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        requestId 
      };
    });

    // Simple test endpoint
    fastify.get('/api/test', async (request, reply) => {
      const requestId = request.headers['x-request-id'] || 'test-endpoint';
      logger.info('server', 'test_endpoint', requestId);
      
      return { 
        message: 'Hello from Courses AI! 👋',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        requestId,
      };
    });

    // Register routes
    await fastify.register(authRoutes);
    await fastify.register(chatRoutes);
    await fastify.register(courseRoutes);
    await fastify.register(progressRoutes);

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error(error);
      
      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.validation,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    });

    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || 'localhost';
    
    await fastify.listen({ port, host });
    
    console.log(`🚀 Courses AI backend running on http://${host}:${port}`);
    console.log(`📋 Health check: http://${host}:${port}/health`);
    console.log(`🧪 Test endpoint: http://${host}:${port}/api/test`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();