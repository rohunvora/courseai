import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const _SignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const _LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Sign up endpoint
  fastify.post<{
    Body: z.infer<typeof _SignupSchema>;
  }>('/auth/signup', async (request, reply) => {
    const requestId = uuidv4();
    
    if (!isSupabaseConfigured()) {
      logger.warn('auth', 'signup_disabled', requestId, { reason: 'supabase_not_configured' });
      return reply.status(501).send({
        success: false,
        error: {
          code: 'AUTH_DISABLED',
          message: 'Authentication is not configured. Please set up Supabase environment variables.',
        },
        meta: { requestId, timestamp: new Date() },
      });
    }
    
    try {
      const validation = _SignupSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: validation.error.issues[0].message }
        });
      }
      
      const { email, password, firstName, lastName } = validation.data;
      
      logger.info('auth', 'signup_attempt', requestId, { email });

      // Create user with Supabase Auth
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        logger.error('auth', 'signup_failed', requestId, { 
          email, 
          error: error.message 
        });
        
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SIGNUP_ERROR',
            message: error.message,
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      logger.info('auth', 'signup_success', requestId, { 
        email, 
        userId: data.user?.id 
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: data.user?.id,
            email: data.user?.email,
            emailConfirmed: data.user?.email_confirmed_at ? true : false,
          },
          session: data.session ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at,
          } : null,
        },
        meta: { requestId, timestamp: new Date() },
      });
    } catch (error) {
      logger.error('auth', 'signup_exception', requestId, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during signup',
        },
        meta: { requestId, timestamp: new Date() },
      });
    }
  });

  // Login endpoint
  fastify.post<{
    Body: z.infer<typeof _LoginSchema>;
  }>('/auth/login', async (request, reply) => {
    const requestId = uuidv4();
    
    if (!isSupabaseConfigured()) {
      return reply.status(501).send({
        success: false,
        error: { code: 'AUTH_DISABLED', message: 'Authentication not configured.' },
        meta: { requestId, timestamp: new Date() },
      });
    }
    
    try {
      const validation = _LoginSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: validation.error.issues[0].message }
        });
      }
      
      const { email, password } = validation.data;
      
      logger.info('auth', 'login_attempt', requestId, { email });

      // Sign in with Supabase Auth
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.warn('auth', 'login_failed', requestId, { 
          email, 
          error: error.message 
        });
        
        return reply.status(401).send({
          success: false,
          error: {
            code: 'LOGIN_ERROR',
            message: error.message,
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      logger.info('auth', 'login_success', requestId, { 
        email, 
        userId: data.user?.id 
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: data.user?.id,
            email: data.user?.email,
            emailConfirmed: data.user?.email_confirmed_at ? true : false,
          },
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at,
          },
        },
        meta: { requestId, timestamp: new Date() },
      });
    } catch (error) {
      logger.error('auth', 'login_exception', requestId, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during login',
        },
        meta: { requestId, timestamp: new Date() },
      });
    }
  });

  // Logout endpoint
  fastify.post('/auth/logout', async (request, reply) => {
    const requestId = uuidv4();
    
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'No authorization token provided',
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      logger.info('auth', 'logout_attempt', requestId);

      // Sign out from Supabase
      const { error } = await supabase!.auth.signOut();

      if (error) {
        logger.error('auth', 'logout_failed', requestId, { error: error.message });
        
        return reply.status(500).send({
          success: false,
          error: {
            code: 'LOGOUT_ERROR',
            message: error.message,
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      logger.info('auth', 'logout_success', requestId);

      return reply.send({
        success: true,
        data: { message: 'Successfully logged out' },
        meta: { requestId, timestamp: new Date() },
      });
    } catch (error) {
      logger.error('auth', 'logout_exception', requestId, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during logout',
        },
        meta: { requestId, timestamp: new Date() },
      });
    }
  });

  // Get current user endpoint
  fastify.get('/auth/user', async (request, reply) => {
    const requestId = uuidv4();
    
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'No authorization token provided',
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      // Get user from token
      const { data: { user }, error } = await supabase!.auth.getUser(token);

      if (error || !user) {
        logger.warn('auth', 'get_user_failed', requestId, { 
          error: error?.message 
        });
        
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
          meta: { requestId, timestamp: new Date() },
        });
      }

      logger.info('auth', 'get_user_success', requestId, { 
        userId: user.id 
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            emailConfirmed: user.email_confirmed_at ? true : false,
          },
        },
        meta: { requestId, timestamp: new Date() },
      });
    } catch (error) {
      logger.error('auth', 'get_user_exception', requestId, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error getting user',
        },
        meta: { requestId, timestamp: new Date() },
      });
    }
  });
}