'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';

const MAX_MB = 20;

type Props = {
  colaboradorId: string;
  colaboradorNome: string;
  temContrato: boolean;
  /** true quando o armazenamento é o Vercel Blob (produção). */
  envioDireto: boolean;
};

export default function Contrato({
  colaboradorId,
  colaboradorNome,
  temContrato,
  envioDireto,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    setErro(null);

    if (arquivo.size > MAX_MB * 1024 * 1024) {
      setErro(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. O limite é ${MAX_MB} MB.`);
      return;
    }

    setEnviando(true);
    try {
      if (envioDireto) {
        // Vai do navegador direto ao armazenamento: a função da Vercel recusa
        // corpo acima de ~4,5 MB, então o arquivo não pode passar por ela.
        const caminho = `contratos/${colaboradorId}/${crypto.randomUUID()}.pdf`;
        const blob = await upload(caminho, arquivo, {
          access: 'private',
          handleUploadUrl: '/api/contratos/token',
          contentType: 'application/pdf',
        });

        const res = await fetch(`/api/contratos/${colaboradorId}/confirmar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caminho: blob.pathname, nomeArquivo: arquivo.name }),
        });
        if (!res.ok) throw new Error((await res.json()).erro ?? 'Falha ao registrar.');
      } else {
        const form = new FormData();
        form.append('arquivo', arquivo);
        const res = await fetch(`/api/contratos/${colaboradorId}/direto`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) throw new Error((await res.json()).erro ?? 'Falha no envio.');
      }

      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no envio.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {temContrato && (
          <a
            href={`/api/contratos/${colaboradorId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-teal-700 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            ver PDF
          </a>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          {enviando ? 'enviando…' : temContrato ? 'substituir' : 'enviar PDF'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={aoEscolher}
        className="hidden"
        aria-label={`Contrato de ${colaboradorNome}`}
      />

      {erro && <span className="max-w-52 text-xs text-red-700">{erro}</span>}
    </div>
  );
}
