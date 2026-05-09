-- Optional join-by-code for player web: GM sets campaigns.join_code; players call join_campaign_with_code.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS join_code TEXT;

COMMENT ON COLUMN public.campaigns.join_code IS 'Optional secret; players who know campaign ID + code can join (see join_campaign_with_code).';

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_join_code_unique
  ON public.campaigns (join_code)
  WHERE join_code IS NOT NULL AND length(trim(join_code)) > 0;

CREATE OR REPLACE FUNCTION public.join_campaign_with_code(p_campaign_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT c.join_code INTO expected
  FROM public.campaigns c
  WHERE c.id = p_campaign_id;

  IF expected IS NULL OR trim(expected) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'join_not_enabled');
  END IF;

  IF trim(expected) <> trim(p_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (p_campaign_id, auth.uid(), 'player')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.join_campaign_with_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_campaign_with_code(UUID, TEXT) TO authenticated;
