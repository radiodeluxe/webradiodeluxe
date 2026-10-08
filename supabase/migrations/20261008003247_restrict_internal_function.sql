-- This project-provided event trigger is internal, not a public RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
