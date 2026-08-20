import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

/**
 * Registro de auditoria.
 *
 * A tabela é append-only por GRANT no banco (ver a migração `0001_audit_append_only.sql`):
 * o usuário da aplicação tem INSERT e SELECT, mas não UPDATE nem DELETE. Assim,
 * mesmo quem comprometer a aplicação não consegue apagar o próprio rastro.
 */

export const Acao = {
  LOGIN_OK: 'login.sucesso',
  LOGIN_FALHA: 'login.falha',
  LOGIN_BLOQUEADO: 'login.bloqueado',
  LOGOUT: 'logout',

  COLABORADOR_CRIAR: 'colaborador.criar',
  COLABORADOR_EDITAR: 'colaborador.editar',
  COLABORADOR_DESLIGAR: 'colaborador.desligar',

  /** Salário é o campo mais sensível: toda alteração fica registrada. */
  VINCULO_ALTERAR_VALOR: 'vinculo.alterar_valor',

  /** Ver contrato assinado é evento auditável por si só. */
  CONTRATO_VISUALIZAR: 'contrato.visualizar',
  CONTRATO_ENVIAR: 'contrato.enviar',
  CONTRATO_REMOVER: 'contrato.remover',

  /** Exportação é o vetor de vazamento mais provável — sempre registrar. */
  DADOS_EXPORTAR: 'dados.exportar',

  AVALIACAO_CRIAR: 'avaliacao.criar',
  USUARIO_CRIAR: 'usuario.criar',
  USUARIO_DESATIVAR: 'usuario.desativar',
} as const;

export type AcaoTipo = (typeof Acao)[keyof typeof Acao];

type Entrada = {
  acao: AcaoTipo;
  usuarioId?: string | null;
  usuarioEmail?: string | null;
  entidade?: string;
  entidadeId?: string;
  metadata?: Record<string, unknown>;
};

/** Extrai o IP real considerando o proxy da Vercel à frente da aplicação. */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'desconhecido';
}

export async function auditar(entrada: Entrada): Promise<void> {
  try {
    const h = await headers();
    await db.insert(auditLog).values({
      acao: entrada.acao,
      usuarioId: entrada.usuarioId ?? null,
      usuarioEmail: entrada.usuarioEmail ?? null,
      entidade: entrada.entidade ?? null,
      entidadeId: entrada.entidadeId ?? null,
      ip: await ipDaRequisicao(),
      userAgent: h.get('user-agent')?.slice(0, 500) ?? null,
      metadata: entrada.metadata ?? null,
    });
  } catch (erro) {
    // Falha de auditoria não pode derrubar a operação do usuário, mas precisa
    // aparecer no log da plataforma para investigação.
    console.error('[auditoria] falha ao registrar', entrada.acao, erro);
  }
}
