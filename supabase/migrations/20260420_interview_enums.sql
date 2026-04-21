do $$ begin create type public.stake_presidency_interviewer as enum (
    'presidente_estaca_sidney_ataide',
    'primeiro_conselheiro_rodrigo_pinheiro',
    'segundo_conselheiro_denilson_rodrigues'
);
exception
when duplicate_object then null;
end $$;
do $$ begin create type public.interview_nature as enum (
    'renovacao_recomendacao_templo',
    'primeira_recomendacao_templo',
    'entrevista_missao_tempo_integral',
    'entrevista_missao_servico',
    'entrevista_para_chamado',
    'outros'
);
exception
when duplicate_object then null;
end $$;
do $$ begin create type public.interview_attendance_mode as enum ('presencial', 'online');
exception
when duplicate_object then null;
end $$;