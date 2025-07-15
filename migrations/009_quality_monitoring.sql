-- Quality metrics tracking table
CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_call_error_rate DECIMAL(5,4) NOT NULL,
    safety_violations INTEGER NOT NULL DEFAULT 0,
    p95_latency DECIMAL(10,2) NOT NULL,
    p99_latency DECIMAL(10,2),
    alerts JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX idx_quality_metrics_created ON quality_metrics(created_at DESC);

-- Safety violations tracking
CREATE TABLE IF NOT EXISTS safety_violations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    pattern TEXT NOT NULL,
    variant_id VARCHAR(50),
    session_id VARCHAR(255),
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analysis
CREATE INDEX idx_safety_violations_variant ON safety_violations(variant_id);
CREATE INDEX idx_safety_violations_created ON safety_violations(created_at);

-- Admin actions audit trail
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_admin_actions_user ON admin_actions(user_id);
CREATE INDEX idx_admin_actions_created ON admin_actions(created_at);

-- Add response_time_ms to chat_messages if not exists
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Add status to tool_calls if not exists
ALTER TABLE tool_calls
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success';

-- Create view for quality dashboard
CREATE OR REPLACE VIEW quality_dashboard AS
WITH hourly_metrics AS (
    SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        AVG(tool_call_error_rate) as avg_error_rate,
        SUM(safety_violations) as total_violations,
        AVG(p95_latency) as avg_p95_latency,
        COUNT(CASE WHEN jsonb_array_length(alerts) > 0 THEN 1 END) as alert_count
    FROM quality_metrics
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY DATE_TRUNC('hour', created_at)
)
SELECT 
    hour,
    ROUND(avg_error_rate * 100, 2) as error_rate_percent,
    total_violations,
    ROUND(avg_p95_latency::numeric, 0) as p95_latency_ms,
    alert_count
FROM hourly_metrics
ORDER BY hour DESC;

-- Create function to check quality gates
CREATE OR REPLACE FUNCTION check_quality_gates()
RETURNS TABLE (
    metric_name TEXT,
    current_value NUMERIC,
    threshold NUMERIC,
    status TEXT
) AS $$
BEGIN
    -- Tool call error rate check
    RETURN QUERY
    SELECT 
        'tool_call_error_rate'::TEXT,
        ROUND(AVG(CASE WHEN tc.status = 'error' THEN 1 ELSE 0 END)::numeric, 4),
        0.05::numeric,
        CASE 
            WHEN AVG(CASE WHEN tc.status = 'error' THEN 1 ELSE 0 END) > 0.05 THEN 'CRITICAL'
            WHEN AVG(CASE WHEN tc.status = 'error' THEN 1 ELSE 0 END) > 0.03 THEN 'WARNING'
            ELSE 'OK'
        END
    FROM tool_calls tc
    WHERE tc.created_at >= NOW() - INTERVAL '1 hour';

    -- Safety violations check
    RETURN QUERY
    SELECT 
        'safety_violations'::TEXT,
        COUNT(*)::numeric,
        0::numeric,
        CASE 
            WHEN COUNT(*) > 0 THEN 'CRITICAL'
            ELSE 'OK'
        END
    FROM safety_violations
    WHERE created_at >= NOW() - INTERVAL '1 hour';

    -- P95 latency check
    RETURN QUERY
    SELECT 
        'p95_latency'::TEXT,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric,
        3000::numeric,
        CASE 
            WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) > 3000 THEN 'CRITICAL'
            WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) > 2500 THEN 'WARNING'
            ELSE 'OK'
        END
    FROM chat_messages
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND response_time_ms IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Replay test reports table
CREATE TABLE IF NOT EXISTS replay_test_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report TEXT NOT NULL,
    results JSONB NOT NULL,
    regression_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX idx_replay_test_reports_created ON replay_test_reports(created_at DESC);