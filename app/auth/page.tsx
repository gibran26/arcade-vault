import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';
import AuthPageClient from './AuthPageClient';

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect('/games');
  }

  return <AuthPageClient />;
}
