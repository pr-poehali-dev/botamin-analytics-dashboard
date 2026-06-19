-- Таблица транскриптов звонков
CREATE TABLE t_p87080492_botamin_analytics_da.call_transcripts (
    id SERIAL PRIMARY KEY,
    comm_id VARCHAR(64) NOT NULL UNIQUE,
    audio_url TEXT NOT NULL,
    date VARCHAR(20),
    duration VARCHAR(20),
    duration_sec INTEGER DEFAULT 0,
    full_text TEXT,
    replicas JSONB DEFAULT '[]',
    replica_count INTEGER DEFAULT 0,
    operator_replicas INTEGER DEFAULT 0,
    client_replicas INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица ИИ-анализов звонков
CREATE TABLE t_p87080492_botamin_analytics_da.call_analyses (
    id SERIAL PRIMARY KEY,
    comm_id VARCHAR(64) NOT NULL UNIQUE,
    call_type VARCHAR(20),
    call_type_label VARCHAR(50),
    qualification BOOLEAN,
    qualification_label VARCHAR(50),
    client_interest VARCHAR(20),
    client_interest_label VARCHAR(50),
    outcome VARCHAR(20),
    outcome_label VARCHAR(50),
    fail_reason TEXT,
    success_factor TEXT,
    operator_score INTEGER,
    operator_followed_script BOOLEAN,
    operator_handled_objections BOOLEAN,
    operator_comment TEXT,
    summary TEXT,
    key_phrases_client JSONB DEFAULT '[]',
    key_phrases_operator JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transcripts_comm_id ON t_p87080492_botamin_analytics_da.call_transcripts(comm_id);
CREATE INDEX idx_analyses_comm_id ON t_p87080492_botamin_analytics_da.call_analyses(comm_id);
