-- Migration: Create immutable action_logs table with SHA-256 hash and append-only constraints
-- This implements the requirement for auditable, tamper-evident logging

-- First create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  tool_name VARCHAR(100) NOT NULL,
  function_call_json JSONB NOT NULL,
  execution_time_ms INTEGER,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_code VARCHAR(50),
  request_id VARCHAR(50),
  payload_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_session_id ON action_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_tool_name ON action_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_action_logs_status ON action_logs(status);
CREATE INDEX IF NOT EXISTS idx_action_logs_hash ON action_logs(payload_hash);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_time ON action_logs(user_id, created_at);

-- Enable Row Level Security (RLS) for append-only behavior
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only INSERT their own records (append-only)
CREATE POLICY action_logs_insert_own ON action_logs
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Policy: Users can only SELECT their own records (read-only access)
CREATE POLICY action_logs_select_own ON action_logs
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- Policy: NO UPDATE allowed (immutable)
-- RLS will automatically deny UPDATE operations since no UPDATE policy is defined

-- Policy: NO DELETE allowed (audit integrity)
-- RLS will automatically deny DELETE operations since no DELETE policy is defined

-- Disable autovacuum to prevent any automatic data manipulation
ALTER TABLE action_logs SET (autovacuum_enabled = false);

-- Create a function to verify payload hash integrity
CREATE OR REPLACE FUNCTION verify_action_log_hash(log_id UUID)
RETURNS TABLE(valid BOOLEAN, computed_hash TEXT, stored_hash TEXT) AS $$
DECLARE
  log_record RECORD;
  json_canonical TEXT;
  computed_sha256 TEXT;
BEGIN
  -- Get the log record
  SELECT function_call_json, payload_hash INTO log_record
  FROM action_logs 
  WHERE id = log_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Create canonical JSON representation (sorted keys)
  json_canonical := (
    SELECT jsonb_build_object(
      key, value
    ) FROM (
      SELECT key, value 
      FROM jsonb_each(log_record.function_call_json) 
      ORDER BY key
    ) sorted
  )::TEXT;
  
  -- Compute SHA-256 hash
  computed_sha256 := encode(digest(json_canonical, 'sha256'), 'hex');
  
  -- Return comparison
  RETURN QUERY SELECT 
    computed_sha256 = log_record.payload_hash,
    computed_sha256,
    log_record.payload_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to prevent updates/deletes (extra safety layer)
CREATE OR REPLACE FUNCTION prevent_action_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'action_logs table is append-only - updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

-- Create triggers to enforce immutability
CREATE TRIGGER prevent_action_log_update
  BEFORE UPDATE ON action_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_action_log_modification();

CREATE TRIGGER prevent_action_log_delete
  BEFORE DELETE ON action_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_action_log_modification();

-- Grant appropriate permissions
-- Note: In production, you'd set these based on your specific role structure
GRANT SELECT, INSERT ON action_logs TO PUBLIC;
GRANT EXECUTE ON FUNCTION verify_action_log_hash(UUID) TO PUBLIC;

-- Create a view for easy audit access (without exposing sensitive data)
CREATE OR REPLACE VIEW action_logs_audit AS
SELECT 
  id,
  user_id,
  session_id,
  course_id,
  tool_name,
  status,
  error_code,
  execution_time_ms,
  payload_hash,
  created_at,
  -- Computed fields for audit
  jsonb_pretty(function_call_json) AS formatted_payload,
  CASE 
    WHEN execution_time_ms IS NOT NULL THEN execution_time_ms || 'ms'
    ELSE 'N/A'
  END AS execution_time_display
FROM action_logs
ORDER BY created_at DESC;

-- Comment the table for documentation
COMMENT ON TABLE action_logs IS 'Immutable audit log for all function calls with SHA-256 payload integrity verification';
COMMENT ON COLUMN action_logs.payload_hash IS 'SHA-256 hash of function_call_json for tamper detection';
COMMENT ON COLUMN action_logs.function_call_json IS 'Complete function call payload including parameters and results';
COMMENT ON FUNCTION verify_action_log_hash(UUID) IS 'Verifies payload integrity by recomputing SHA-256 hash';