CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_user_id_unique ON public.refresh_tokens USING btree (user_id);
