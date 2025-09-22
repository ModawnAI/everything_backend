-- Migration: Create Payment Reconciliation Tables
-- Description: Create tables for comprehensive payment reconciliation system
-- Version: 1.0.0
-- Created: 2024-01-15

-- Create settlement data table
CREATE TABLE IF NOT EXISTS settlement_data (
    id VARCHAR(255) PRIMARY KEY,
    settlement_date DATE NOT NULL,
    total_amount BIGINT NOT NULL,
    total_count INTEGER NOT NULL,
    fees BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KRW',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create settlement transactions table
CREATE TABLE IF NOT EXISTS settlement_transactions (
    id VARCHAR(255) PRIMARY KEY,
    settlement_id VARCHAR(255) NOT NULL REFERENCES settlement_data(id) ON DELETE CASCADE,
    payment_id VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    fees BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50) NOT NULL,
    card_number VARCHAR(50),
    approval_number VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create reconciliation records table
CREATE TABLE IF NOT EXISTS reconciliation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_date DATE NOT NULL,
    settlement_id VARCHAR(255) NOT NULL REFERENCES settlement_data(id) ON DELETE CASCADE,
    total_settlement_amount BIGINT NOT NULL DEFAULT 0,
    total_internal_amount BIGINT NOT NULL DEFAULT 0,
    discrepancy_amount BIGINT NOT NULL DEFAULT 0,
    discrepancy_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'discrepancy')),
    matched_transactions INTEGER NOT NULL DEFAULT 0,
    unmatched_transactions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create reconciliation discrepancies table
CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'amount_mismatch', 'missing_transaction', 'extra_transaction', 'status_mismatch', 'fee_mismatch'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    settlement_data JSONB NOT NULL DEFAULT '{}',
    internal_data JSONB NOT NULL DEFAULT '{}',
    expected_value JSONB,
    actual_value JSONB,
    resolution TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create transaction matches table
CREATE TABLE IF NOT EXISTS transaction_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id) ON DELETE CASCADE,
    settlement_transaction_id VARCHAR(255) NOT NULL,
    internal_transaction_id UUID NOT NULL,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('exact', 'fuzzy', 'manual', 'unmatched')),
    confidence DECIMAL(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    discrepancies TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(reconciliation_id, settlement_transaction_id),
    UNIQUE(reconciliation_id, internal_transaction_id)
);

-- Create reconciliation reports table
CREATE TABLE IF NOT EXISTS reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}',
    transaction_breakdown JSONB NOT NULL DEFAULT '{}',
    discrepancy_breakdown JSONB NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Create reconciliation alerts table
CREATE TABLE IF NOT EXISTS reconciliation_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('discrepancy', 'failure', 'completion', 'threshold_exceeded')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_settlement_data_date ON settlement_data(settlement_date);
CREATE INDEX IF NOT EXISTS idx_settlement_data_status ON settlement_data(status);
CREATE INDEX IF NOT EXISTS idx_settlement_data_created_at ON settlement_data(created_at);

CREATE INDEX IF NOT EXISTS idx_settlement_transactions_settlement_id ON settlement_transactions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_payment_id ON settlement_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_status ON settlement_transactions(status);
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_processed_at ON settlement_transactions(processed_at);

CREATE INDEX IF NOT EXISTS idx_reconciliation_records_date ON reconciliation_records(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_settlement_id ON reconciliation_records(settlement_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_status ON reconciliation_records(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_created_at ON reconciliation_records(created_at);

CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_reconciliation_id ON reconciliation_discrepancies(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_type ON reconciliation_discrepancies(type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_severity ON reconciliation_discrepancies(severity);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_status ON reconciliation_discrepancies(status);

CREATE INDEX IF NOT EXISTS idx_transaction_matches_reconciliation_id ON transaction_matches(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_transaction_matches_settlement_transaction_id ON transaction_matches(settlement_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_matches_internal_transaction_id ON transaction_matches(internal_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_matches_match_type ON transaction_matches(match_type);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_reconciliation_id ON reconciliation_reports(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_report_date ON reconciliation_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_generated_at ON reconciliation_reports(generated_at);

CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_reconciliation_id ON reconciliation_alerts(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_type ON reconciliation_alerts(type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_severity ON reconciliation_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_is_resolved ON reconciliation_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_created_at ON reconciliation_alerts(created_at);

-- Create function to calculate reconciliation summary
CREATE OR REPLACE FUNCTION calculate_reconciliation_summary(reconciliation_id_param UUID)
RETURNS TABLE (
    total_settlement_amount BIGINT,
    total_internal_amount BIGINT,
    discrepancy_amount BIGINT,
    discrepancy_count BIGINT,
    matched_transactions BIGINT,
    unmatched_transactions BIGINT,
    match_rate DECIMAL(5,2)
) AS $$
DECLARE
    settlement_amount BIGINT;
    internal_amount BIGINT;
    discrepancy_amt BIGINT;
    discrepancy_cnt BIGINT;
    matched_cnt BIGINT;
    unmatched_cnt BIGINT;
    match_rate_val DECIMAL(5,2);
BEGIN
    -- Get settlement amount
    SELECT COALESCE(sd.total_amount, 0) INTO settlement_amount
    FROM reconciliation_records rr
    JOIN settlement_data sd ON sd.id = rr.settlement_id
    WHERE rr.id = reconciliation_id_param;

    -- Get internal amount (sum of matched payments)
    SELECT COALESCE(SUM(p.amount), 0) INTO internal_amount
    FROM transaction_matches tm
    JOIN payments p ON p.id = tm.internal_transaction_id
    WHERE tm.reconciliation_id = reconciliation_id_param
      AND tm.match_type != 'unmatched';

    -- Calculate discrepancy
    discrepancy_amt := ABS(settlement_amount - internal_amount);

    -- Get discrepancy count
    SELECT COUNT(*) INTO discrepancy_cnt
    FROM reconciliation_discrepancies
    WHERE reconciliation_id = reconciliation_id_param
      AND status != 'resolved';

    -- Get matched and unmatched transaction counts
    SELECT 
        COUNT(*) FILTER (WHERE match_type != 'unmatched'),
        COUNT(*) FILTER (WHERE match_type = 'unmatched')
    INTO matched_cnt, unmatched_cnt
    FROM transaction_matches
    WHERE reconciliation_id = reconciliation_id_param;

    -- Calculate match rate
    IF (matched_cnt + unmatched_cnt) > 0 THEN
        match_rate_val := (matched_cnt::DECIMAL / (matched_cnt + unmatched_cnt)::DECIMAL) * 100;
    ELSE
        match_rate_val := 0;
    END IF;

    RETURN QUERY
    SELECT 
        settlement_amount,
        internal_amount,
        discrepancy_amt,
        discrepancy_cnt,
        matched_cnt,
        unmatched_cnt,
        match_rate_val;
END;
$$ LANGUAGE plpgsql;

-- Create function to update reconciliation record summary
CREATE OR REPLACE FUNCTION update_reconciliation_summary(reconciliation_id_param UUID)
RETURNS VOID AS $$
DECLARE
    summary RECORD;
BEGIN
    -- Calculate summary
    SELECT * INTO summary
    FROM calculate_reconciliation_summary(reconciliation_id_param);

    -- Update reconciliation record
    UPDATE reconciliation_records
    SET 
        total_settlement_amount = summary.total_settlement_amount,
        total_internal_amount = summary.total_internal_amount,
        discrepancy_amount = summary.discrepancy_amount,
        discrepancy_count = summary.discrepancy_count,
        matched_transactions = summary.matched_transactions,
        unmatched_transactions = summary.unmatched_transactions,
        updated_at = NOW()
    WHERE id = reconciliation_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate reconciliation report
CREATE OR REPLACE FUNCTION generate_reconciliation_report(
    reconciliation_id_param UUID,
    generated_by_param UUID
)
RETURNS UUID AS $$
DECLARE
    report_id UUID;
    reconciliation_record RECORD;
    summary RECORD;
    transaction_breakdown JSONB;
    discrepancy_breakdown JSONB;
    recommendations TEXT[];
BEGIN
    -- Generate report ID
    report_id := gen_random_uuid();

    -- Get reconciliation record
    SELECT * INTO reconciliation_record
    FROM reconciliation_records
    WHERE id = reconciliation_id_param;

    -- Get summary
    SELECT * INTO summary
    FROM calculate_reconciliation_summary(reconciliation_id_param);

    -- Build transaction breakdown
    SELECT jsonb_build_object(
        'exact_matches', COUNT(*) FILTER (WHERE match_type = 'exact'),
        'fuzzy_matches', COUNT(*) FILTER (WHERE match_type = 'fuzzy'),
        'manual_matches', COUNT(*) FILTER (WHERE match_type = 'manual'),
        'unmatched', COUNT(*) FILTER (WHERE match_type = 'unmatched')
    ) INTO transaction_breakdown
    FROM transaction_matches
    WHERE reconciliation_id = reconciliation_id_param;

    -- Build discrepancy breakdown
    SELECT jsonb_build_object(
        'amount_mismatches', COUNT(*) FILTER (WHERE type = 'amount_mismatch'),
        'missing_transactions', COUNT(*) FILTER (WHERE type = 'missing_transaction'),
        'extra_transactions', COUNT(*) FILTER (WHERE type = 'extra_transaction'),
        'status_mismatches', COUNT(*) FILTER (WHERE type = 'status_mismatch'),
        'fee_mismatches', COUNT(*) FILTER (WHERE type = 'fee_mismatch')
    ) INTO discrepancy_breakdown
    FROM reconciliation_discrepancies
    WHERE reconciliation_id = reconciliation_id_param;

    -- Generate recommendations
    recommendations := ARRAY[]::TEXT[];
    
    IF summary.match_rate < 95 THEN
        recommendations := array_append(recommendations, 'Match rate is below 95% - review transaction matching logic');
    END IF;
    
    IF summary.discrepancy_amount > 10000 THEN
        recommendations := array_append(recommendations, 'High discrepancy amount - investigate large amount mismatches');
    END IF;
    
    IF summary.discrepancy_count > 10 THEN
        recommendations := array_append(recommendations, 'High discrepancy count - review transaction processing');
    END IF;

    -- Insert report
    INSERT INTO reconciliation_reports (
        id,
        reconciliation_id,
        report_date,
        summary,
        transaction_breakdown,
        discrepancy_breakdown,
        recommendations,
        generated_by
    ) VALUES (
        report_id,
        reconciliation_id_param,
        reconciliation_record.reconciliation_date,
        jsonb_build_object(
            'total_settlement_amount', summary.total_settlement_amount,
            'total_internal_amount', summary.total_internal_amount,
            'discrepancy_amount', summary.discrepancy_amount,
            'match_rate', summary.match_rate,
            'discrepancy_count', summary.discrepancy_count
        ),
        transaction_breakdown,
        discrepancy_breakdown,
        recommendations,
        generated_by_param
    );

    RETURN report_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to create reconciliation alert
CREATE OR REPLACE FUNCTION create_reconciliation_alert(
    reconciliation_id_param UUID,
    type_param VARCHAR(50),
    severity_param VARCHAR(20),
    title_param VARCHAR(255),
    message_param TEXT,
    data_param JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    alert_id UUID;
BEGIN
    alert_id := gen_random_uuid();

    INSERT INTO reconciliation_alerts (
        id,
        reconciliation_id,
        type,
        severity,
        title,
        message,
        data
    ) VALUES (
        alert_id,
        reconciliation_id_param,
        type_param,
        severity_param,
        title_param,
        message_param,
        data_param
    );

    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get reconciliation statistics
CREATE OR REPLACE FUNCTION get_reconciliation_stats(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_reconciliations BIGINT,
    completed_reconciliations BIGINT,
    failed_reconciliations BIGINT,
    discrepancy_reconciliations BIGINT,
    total_discrepancy_amount BIGINT,
    average_match_rate DECIMAL(5,2),
    total_alerts BIGINT,
    unresolved_alerts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_reconciliations,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_reconciliations,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_reconciliations,
        COUNT(*) FILTER (WHERE status = 'discrepancy') as discrepancy_reconciliations,
        COALESCE(SUM(discrepancy_amount), 0) as total_discrepancy_amount,
        COALESCE(AVG(
            CASE 
                WHEN (matched_transactions + unmatched_transactions) > 0 
                THEN (matched_transactions::DECIMAL / (matched_transactions + unmatched_transactions)::DECIMAL) * 100
                ELSE 0
            END
        ), 0) as average_match_rate,
        (SELECT COUNT(*) FROM reconciliation_alerts ra 
         JOIN reconciliation_records rr ON rr.id = ra.reconciliation_id
         WHERE rr.reconciliation_date >= start_date AND rr.reconciliation_date <= end_date) as total_alerts,
        (SELECT COUNT(*) FROM reconciliation_alerts ra 
         JOIN reconciliation_records rr ON rr.id = ra.reconciliation_id
         WHERE rr.reconciliation_date >= start_date AND rr.reconciliation_date <= end_date
         AND ra.is_resolved = FALSE) as unresolved_alerts
    FROM reconciliation_records
    WHERE reconciliation_date >= start_date AND reconciliation_date <= end_date;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_settlement_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_settlement_data_updated_at
    BEFORE UPDATE ON settlement_data
    FOR EACH ROW
    EXECUTE FUNCTION update_settlement_data_updated_at();

CREATE OR REPLACE FUNCTION update_reconciliation_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reconciliation_records_updated_at
    BEFORE UPDATE ON reconciliation_records
    FOR EACH ROW
    EXECUTE FUNCTION update_reconciliation_records_updated_at();

CREATE OR REPLACE FUNCTION update_reconciliation_discrepancies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reconciliation_discrepancies_updated_at
    BEFORE UPDATE ON reconciliation_discrepancies
    FOR EACH ROW
    EXECUTE FUNCTION update_reconciliation_discrepancies_updated_at();

CREATE OR REPLACE FUNCTION update_reconciliation_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reconciliation_alerts_updated_at
    BEFORE UPDATE ON reconciliation_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_reconciliation_alerts_updated_at();

-- Create view for reconciliation summary
CREATE OR REPLACE VIEW v_reconciliation_summary AS
SELECT 
    rr.id,
    rr.reconciliation_date,
    rr.settlement_id,
    sd.total_amount as settlement_amount,
    rr.total_internal_amount,
    rr.discrepancy_amount,
    rr.discrepancy_count,
    rr.status,
    rr.matched_transactions,
    rr.unmatched_transactions,
    CASE 
        WHEN (rr.matched_transactions + rr.unmatched_transactions) > 0 
        THEN ROUND((rr.matched_transactions::DECIMAL / (rr.matched_transactions + rr.unmatched_transactions)::DECIMAL) * 100, 2)
        ELSE 0
    END as match_rate,
    rr.created_at,
    rr.completed_at
FROM reconciliation_records rr
JOIN settlement_data sd ON sd.id = rr.settlement_id
ORDER BY rr.reconciliation_date DESC;

-- Create view for discrepancy analysis
CREATE OR REPLACE VIEW v_discrepancy_analysis AS
SELECT 
    rd.type,
    rd.severity,
    COUNT(*) as count,
    ROUND(AVG(
        CASE 
            WHEN rd.type = 'amount_mismatch' 
            THEN ABS((rd.expected_value->>'amount')::BIGINT - (rd.actual_value->>'amount')::BIGINT)
            ELSE 0
        END
    ), 2) as avg_amount_difference,
    COUNT(*) FILTER (WHERE rd.status = 'open') as open_count,
    COUNT(*) FILTER (WHERE rd.status = 'resolved') as resolved_count
FROM reconciliation_discrepancies rd
GROUP BY rd.type, rd.severity
ORDER BY count DESC;

-- Add comments
COMMENT ON TABLE settlement_data IS 'Stores settlement data from payment providers';
COMMENT ON TABLE settlement_transactions IS 'Stores individual transactions within settlements';
COMMENT ON TABLE reconciliation_records IS 'Main reconciliation records and summaries';
COMMENT ON TABLE reconciliation_discrepancies IS 'Tracks discrepancies found during reconciliation';
COMMENT ON TABLE transaction_matches IS 'Maps settlement transactions to internal transactions';
COMMENT ON TABLE reconciliation_reports IS 'Generated reconciliation reports and analytics';
COMMENT ON TABLE reconciliation_alerts IS 'Alerts for reconciliation issues and events';

COMMENT ON FUNCTION calculate_reconciliation_summary(UUID) IS 'Calculates summary statistics for a reconciliation';
COMMENT ON FUNCTION update_reconciliation_summary(UUID) IS 'Updates reconciliation record with calculated summary';
COMMENT ON FUNCTION generate_reconciliation_report(UUID, UUID) IS 'Generates a comprehensive reconciliation report';
COMMENT ON FUNCTION create_reconciliation_alert(UUID, VARCHAR(50), VARCHAR(20), VARCHAR(255), TEXT, JSONB) IS 'Creates a reconciliation alert';
COMMENT ON FUNCTION get_reconciliation_stats(DATE, DATE) IS 'Gets reconciliation statistics for a date range';

COMMENT ON VIEW v_reconciliation_summary IS 'Summary view of reconciliation records with calculated metrics';
COMMENT ON VIEW v_discrepancy_analysis IS 'Analysis view of discrepancies by type and severity';

