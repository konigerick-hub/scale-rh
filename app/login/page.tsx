import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { precisaConfigurar } from '@/lib/actions/setup';
import FormularioLogin from './formulario';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaginaLogin() {
  // Sem nenhuma conta criada, a tela de login seria intransponível.
  if (await precisaConfigurar()) redirect('/setup');

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
