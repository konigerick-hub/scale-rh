import { redirect } from 'next/navigation';
import { precisaConfigurar } from '@/lib/actions/setup';
import FormularioSetup from './formulario';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaginaSetup() {
  // Já configurado: a página deixa de existir para sempre.
  if (!(await precisaConfigurar())) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <FormularioSetup />
    </main>
  );
}
