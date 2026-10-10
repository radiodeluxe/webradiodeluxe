-- Rename only the original radio poll prompt. Preserve custom questions and votes.
update public.polls
set question = 'Qual estilo você quer ouvir mais na JK HipHop?'
where question = 'Qual estilo você quer ouvir mais na Deluxe?';
