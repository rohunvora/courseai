import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { chatRoutes } from './routes/chat.js';
import { chatRoutesWithTools } from './routes/chat-tools.js';
import { courseRoutes } from './routes/courses.js';
import { progressRoutes } from './routes/progress.js';
import { authRoutes } from './routes/auth.js';
import { demoRoutes } from './routes/demo.js';
import { actionRoutes } from './routes/actions.js';
import { monitorRoutes } from './routes/monitor.js';
import { actionLoggerMiddleware } from './middleware/actionLogger.js';
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
    
    // Add action logging middleware
    fastify.addHook('preHandler', actionLoggerMiddleware);

    // Health check
    fastify.get('/health', async (request, _reply) => {
      const requestId = (request.headers['x-request-id'] as string) || 'health-check';
      logger.info('server', 'health_check', requestId);
      
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        requestId 
      };
    });

    // Simple test endpoint
    fastify.get('/api/test', async (request, _reply) => {
      const requestId = (request.headers['x-request-id'] as string) || 'test-endpoint';
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
    
    // Use function calling if enabled
    if (process.env.ENABLE_FUNCTION_CALLING === 'true') {
      await fastify.register(chatRoutesWithTools);
      console.log('✨ Function calling enabled for chat');
    } else {
      await fastify.register(chatRoutes);
    }
    
    await fastify.register(courseRoutes);
    await fastify.register(progressRoutes);
    await fastify.register(actionRoutes);
    await fastify.register(monitorRoutes);
    await fastify.register(demoRoutes);

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
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : (process.env.HOST || 'localhost');
    
    await fastify.listen({ port, host });
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CourseAI Backend Server Started!');
    console.log('='.repeat(60));
    console.log(`📡 Server: http://${host}:${port}`);
    console.log(`❤️  Health: http://${host}:${port}/health`);
    console.log(`🧪 Test: http://${host}:${port}/api/test`);
    console.log(`📊 Monitor: http://${host}:${port}/monitor/dashboard`);
    console.log(`🎯 Actions: http://${host}:${port}/api/actions/recent`);
    console.log('='.repeat(60));
    console.log('🔍 MONITORING: All user actions will be logged here');
    console.log('✨ FUNCTION CALLING:', process.env.ENABLE_FUNCTION_CALLING === 'true' ? 'ENABLED' : 'DISABLED');
    console.log('='.repeat(60) + '\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();