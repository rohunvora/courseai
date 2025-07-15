import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { authenticateUser } from '../middleware/auth.js';

interface ExperimentStats {
  variantId: string;
  segmentType: string;
  totalRuns: number;
  successRate: number;
  avgToolAccuracy: number;
  avgSpecificity: number;
  safetyCompliance: number;
  avgEngagement: number;
}

const experimentsRoutes: FastifyPluginAsync = async (server) => {
  // Get experiment results
  server.get('/api/experiments/results', {
    preHandler: authenticateUser,
    handler: async (request, reply) => {
      try {
        // Check if user is admin
        const { userId } = request.user as any;
        const userResult = await db.query(
          'SELECT metadata FROM users WHERE id = $1',
          [userId]
        );
        
        if (!userResult.rows[0]?.metadata?.isAdmin) {
          return reply.code(403).send({ error: 'Admin access required' });
        }

        // Fetch experiment summary
        const summaryResult = await db.query(`
          SELECT 
            variant_id,
            segment_type,
            COUNT(*) as total_runs,
            COUNT(CASE WHEN outcome = 'success' THEN 1 END)::float / COUNT(*) as success_rate,
            AVG((metrics->>'toolCallAccuracy')::numeric) as avg_tool_accuracy,
            AVG((metrics->>'responseSpecificity')::numeric) as avg_specificity,
            SUM(CASE WHEN (metrics->>'safetyCompliance')::boolean = true THEN 1 ELSE 0 END)::float / COUNT(*) as safety_compliance,
            AVG((metrics->>'userEngagement')::numeric) as avg_engagement
          FROM prompt_experiments
          WHERE completed_at IS NOT NULL
          GROUP BY variant_id, segment_type
          ORDER BY variant_id, segment_type
        `);

        const stats: ExperimentStats[] = summaryResult.rows.map(row => ({
          variantId: row.variant_id,
          segmentType: row.segment_type,
          totalRuns: parseInt(row.total_runs),
          successRate: parseFloat(row.success_rate || '0'),
          avgToolAccuracy: parseFloat(row.avg_tool_accuracy || '0'),
          avgSpecificity: parseFloat(row.avg_specificity || '0'),
          safetyCompliance: parseFloat(row.safety_compliance || '0'),
          avgEngagement: parseFloat(row.avg_engagement || '0')
        }));

        // Get recent experiments
        const recentResult = await db.query(`
          SELECT 
            id,
            user_id,
            variant_id,
            segment_type,
            outcome,
            metrics,
            created_at,
            completed_at
          FROM prompt_experiments
          ORDER BY created_at DESC
          LIMIT 100
        `);

        return reply.send({
          summary: stats,
          recent: recentResult.rows,
          generated: new Date().toISOString()
        });
      } catch (error) {
        server.log.error('Error fetching experiment results:', error);
        return reply.code(500).send({ error: 'Failed to fetch experiment results' });
      }
    }
  });

  // Get variant performance comparison
  server.get('/api/experiments/compare/:variantA/:variantB', {
    preHandler: authenticateUser,
    handler: async (request, reply) => {
      try {
        const { variantA, variantB } = request.params as any;
        
        // Statistical comparison between two variants
        const comparisonResult = await db.query(`
          WITH variant_stats AS (
            SELECT 
              variant_id,
              COUNT(*) as n,
              AVG((metrics->>'toolCallAccuracy')::numeric) as mean_accuracy,
              STDDEV((metrics->>'toolCallAccuracy')::numeric) as stddev_accuracy,
              AVG((metrics->>'responseSpecificity')::numeric) as mean_specificity,
              STDDEV((metrics->>'responseSpecificity')::numeric) as stddev_specificity
            FROM prompt_experiments
            WHERE completed_at IS NOT NULL
              AND variant_id IN ($1, $2)
            GROUP BY variant_id
          )
          SELECT * FROM variant_stats
        `, [variantA, variantB]);

        if (comparisonResult.rows.length < 2) {
          return reply.code(400).send({ error: 'Insufficient data for comparison' });
        }

        const stats = comparisonResult.rows.reduce((acc, row) => {
          acc[row.variant_id] = row;
          return acc;
        }, {} as Record<string, any>);

        // Calculate statistical significance (simplified t-test)
        const calculatePValue = (mean1: number, mean2: number, std1: number, std2: number, n1: number, n2: number) => {
          const pooledStd = Math.sqrt((std1 * std1 / n1) + (std2 * std2 / n2));
          const tStat = Math.abs(mean1 - mean2) / pooledStd;
          // Simplified p-value calculation (would use proper stats library in production)
          return tStat > 1.96 ? 0.05 : 0.5;
        };

        const accuracyPValue = calculatePValue(
          stats[variantA].mean_accuracy,
          stats[variantB].mean_accuracy,
          stats[variantA].stddev_accuracy,
          stats[variantB].stddev_accuracy,
          stats[variantA].n,
          stats[variantB].n
        );

        return reply.send({
          variantA: stats[variantA],
          variantB: stats[variantB],
          comparison: {
            accuracyDiff: stats[variantA].mean_accuracy - stats[variantB].mean_accuracy,
            specificityDiff: stats[variantA].mean_specificity - stats[variantB].mean_specificity,
            accuracyPValue,
            significant: accuracyPValue < 0.05
          }
        });
      } catch (error) {
        server.log.error('Error comparing variants:', error);
        return reply.code(500).send({ error: 'Failed to compare variants' });
      }
    }
  });

  // Manually trigger experiment outcome recording
  server.post('/api/experiments/:experimentId/outcome', {
    preHandler: authenticateUser,
    handler: async (request, reply) => {
      try {
        const { experimentId } = request.params as any;
        const { outcome, metrics } = request.body as any;

        await db.query(
          `UPDATE prompt_experiments
           SET 
             outcome = $2,
             metrics = $3::jsonb,
             completed_at = NOW()
           WHERE id = $1`,
          [experimentId, outcome, JSON.stringify(metrics)]
        );

        return reply.send({ success: true });
      } catch (error) {
        server.log.error('Error recording experiment outcome:', error);
        return reply.code(500).send({ error: 'Failed to record outcome' });
      }
    }
  });
};

export default experimentsRoutes;