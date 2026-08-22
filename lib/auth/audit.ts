import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { escreverImutavel, listarChaves, lerTexto } from '@/lib/store/blob';

/**
 * Registro de auditoria.
 *
 * Cada evento é gravado como um arquivo próprio, com `allowOverwrite: false`.
 * Isso torna os registros imutáveis: não é possível editar um evento já gravado.
 *
 * LIMITAÇÃO CONHECIDA: sem um banco recusando DELETE, um invasor com as
 * credenciais da aplicação ainda consegue APAGAR eventos, embora não consiga
 * alterá-los. Com Postgres dava para bloquear as duas coisas. Se a auditoria
 * inviolável virar exigência (auditoria externa, exigência de cliente), este é
 * o motivo para reconsiderar um banco de verdade.
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

  /** Remover um vinculo tira dinheiro da folha e precisa deixar rastro. */
  VINCULO_REMOVER: 'vinculo.remover',

  /** Ver contrato assinado é evento auditável por si só. */
  CONTRATO_VISUALIZAR: 'contrato.visualizar',
  CONTRATO_ENVIAR: 'contrato.enviar',
  CONTRATO_REMOVER: 'contrato.remover',

  /** Exportação é o vetor de vazamento mais provável — sempre registrar. */
  DADOS_EXPORTAR: 'dados.exportar',

  AVALIACAO_CRIAR: 'avaliacao.criar',

  /** Modelo de contrato define o texto que vai ser assinado. */
  MODELO_SALVAR: 'modelo.salvar',
  MODELO_REMOVER: 'modelo.remover',

  /** CPF, RG e endereco sao dados pessoais: alteracao e acesso ficam registrados. */
  DOCUMENTOS_EDITAR: 'documentos.editar',
  EMPRESA_EDITAR: 'empresa.editar',
  CONTRATO_GERAR: 'contrato.gerar',
  USUARIO_CRIAR: 'usuario.criar',
  USUARIO_DESATIVAR: 'usuario.desativar',
} as const;

export type AcaoTipo = (typeof Acao)[keyof typeof Acao];

export type EventoAuditoria = {
  id: string;
  ts: string;
  acao: AcaoTipo;
  usuarioId: string | null;
  usuarioEmail: string | null;
  entidade: string | null;
  entidadeId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
};

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
    const agora = new Date();
    const evento: EventoAuditoria = {
      id: randomUUID(),
      ts: agora.toISOString(),
      acao: entrada.acao,
      usuarioId: entrada.usuarioId ?? null,
      usuarioEmail: entrada.usuarioEmail ?? null,
      entidade: entrada.entidade ?? null,
      entidadeId: entrada.entidadeId ?? null,
      ip: await ipDaRequisicao(),
      userAgent: h.get('user-agent')?.slice(0, 500) ?? null,
      metadata: entrada.metadata ?? null,
    };

    // Caminho por dia, com timestamp no nome: a listagem sai em ordem
    // cronológica sem precisar de índice.
    const dia = evento.ts.slice(0, 10);
    const chave = `auditoria/${dia}/${evento.ts.replace(/[:.]/g, '-')}-${evento.id}.json`;

    await escreverImutavel(chave, JSON.stringify(evento));
  } catch (erro) {
    // Falha de auditoria não pode derrubar a operação, mas precisa aparecer
    // no log da plataforma para investigação.
    console.error('[auditoria] falha ao registrar', entrada.acao, erro);
  }
}

/** Lê os eventos de um dia (YYYY-MM-DD), em ordem cronológica. */
export async function lerAuditoriaDoDia(dia: string): Promise<EventoAuditoria[]> {
  const chaves = await listarChaves(`auditoria/${dia}`);
  const eventos = await Promise.all(
    chaves.map(async (c) => {
      const lido = await lerTexto(c);
      if (!lido) return null;
      try {
        return JSON.parse(lido.conteudo) as EventoAuditoria;
      } catch {
        return null;
      }
    }),
  );
  return eventos
    .filter((e): e is EventoAuditoria => e !== null)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}
