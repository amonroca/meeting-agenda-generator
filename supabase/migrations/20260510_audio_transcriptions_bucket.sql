-- Bucket privado para armazenar temporariamente os áudios durante a transcrição em lote
INSERT INTO storage.buckets (id, name, public)
VALUES (
        'audio-transcriptions',
        'audio-transcriptions',
        false
    ) ON CONFLICT (id) DO NOTHING;