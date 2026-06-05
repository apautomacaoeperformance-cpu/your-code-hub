-- Promote the existing user to admin so they can manage other users
INSERT INTO public.user_roles (user_id, role)
VALUES ('c239bab9-5557-4492-ae6f-1ef866a24117', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;