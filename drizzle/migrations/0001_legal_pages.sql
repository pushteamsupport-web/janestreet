CREATE TABLE public.legal_pages (
  slug text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_pages TO anon, authenticated;
GRANT UPDATE ON public.legal_pages TO authenticated;
GRANT ALL ON public.legal_pages TO service_role;
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_read ON public.legal_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY legal_update ON public.legal_pages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.legal_pages (slug, title, body) VALUES ('privacy','Privacy Policy','Welcome'),('terms','Terms of Service','Welcome');