-- Create prompt experiments table for A/B testing
CREATE TABLE IF NOT EXISTS prompt_experiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    session_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(50) NOT NULL,
    segment_type VARCHAR(50) NOT NULL,
    variant_config JSONB NOT NULL,
    outcome VARCHAR(50),
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for analysis
CREATE INDEX idx_prompt_experiments_user_session ON prompt_experiments(user_id, session_id);
CREATE INDEX idx_prompt_experiments_variant ON prompt_experiments(variant_id);
CREATE INDEX idx_prompt_experiments_segment ON prompt_experiments(segment_type);
CREATE INDEX idx_prompt_experiments_created ON prompt_experiments(created_at);
CREATE INDEX idx_prompt_experiments_outcome ON prompt_experiments(outcome) WHERE outcome IS NOT NULL;

-- Create view for experiment analysis
CREATE VIEW prompt_experiment_summary AS
SELECT 
    variant_id,
    segment_type,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN outcome = 'success' THEN 1 END) as successes,
    COUNT(CASE WHEN outcome = 'failure' THEN 1 END) as failures,
    AVG((metrics->>'toolCallAccuracy')::numeric) as avg_tool_accuracy,
    AVG((metrics->>'responseSpecificity')::numeric) as avg_specificity,
    SUM(CASE WHEN (metrics->>'safetyCompliance')::boolean = true THEN 1 ELSE 0 END) as safety_compliant,
    AVG((metrics->>'userEngagement')::numeric) as avg_engagement
FROM prompt_experiments
WHERE completed_at IS NOT NULL
GROUP BY variant_id, segment_type;