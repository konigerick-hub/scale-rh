'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { alterarBase } from '@/lib/store/dados';
import { reaisParaCentavos, type Colaborador } from '@/lib/store/tipos';
import { exigirSessao, podeEditar, podeVerEmpresa } from '@/lib/auth/guard';
import { auditar, Acao } from '@/lib/auth/audit';
import { removerContrato } from '@/lib/contratos';

export type Resultado = { ok: true } | { ok: false; erro: string };
/** Devolve o id para que a tela consiga salvar os documentos logo em seguida. */
export type ResultadoComId = { ok: true; id: string } | { ok: false; erro: string };

const dataOpcional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .nullable()
  .or(z.literal('').transform(() => null));

const vinculoSchema = z.object({
  empresaId: z.string().uuid(),
  cargo: z.string().trim().min(1, 'Informe o cargo.').max(120),
  valor: z.number().min(0, 'O valor não pode ser negativo.').max(1_000_000),
});

const colaboradorSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(120),
  nascimento: dataOpcional,
  dataContratacao: dataOpcional,
  vinculos: z.array(vinculoSchema).min(1, 'Informe ao menos uma empresa.'),
});

export type EntradaColaborador = z.input<typeof colaboradorSchema>;

/** Impede que um gestor crie ou mova alguém para empresa que ele não administra. */
function conferirEscopo(
  usuario: Awaited<ReturnType<typeof exigirSessao>>,
  vinculos: { empresaId: string }[],
): string | null {
  for (const v of vinculos) {
    if (!podeVerEmpresa(usuario, v.empresaId)) {
      return 'Você não tem acesso a uma das empresas selecionadas.';
    }
  }
  return null;
}

export async function salvarColaborador(
  id: string | null,
  entrada: EntradaColaborador,
): Promise<ResultadoComId> {
  const usuario = await exigirSessao();
  if (!podeEditar(usuario)) return { ok: false, erro: 'Sem permissão para editar.' };

  const parsed = colaboradorSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const dados = parsed.data;

  const problema = conferirEscopo(usuario, dados.vinculos);
  if (problema) return { ok: false, erro: problema };

  // Duas empresas iguais gerariam dois vínculos duplicados para a mesma pessoa.
  const empresas = new Set(dados.vinculos.map((v) => v.empresaId));
  if (empresas.size !== dados.vinculos.length) {
    return { ok: false, erro: 'A mesma empresa foi informada duas vezes.' };
  }

  const agora = new Date().toISOString();
  let erro: string | null = null;
  let idFinal = id;
  const alteracoesDeValor: { cargo: string; de: number; para: number }[] = [];
  const removidos: { empresaId: string; cargo: string; valor: number }[] = [];

  await alterarBase((base) => {
    if (id) {
      const c = base.colaboradores.find((x) => x.id === id);
      if (!c) {
        erro = 'Colaborador não encontrado.';
        return;
      }
      // Um gestor não pode editar quem está fora do escopo dele.
      if (usuario.empresasPermitidas !== null) {
        const alcanca = c.vinculos.some((v) => podeVerEmpresa(usuario, v.empresaId));
        if (!alcanca) {
          erro = 'Sem acesso a este colaborador.';
          return;
        }
      }

      c.nome = dados.nome;
      c.nascimento = dados.nascimento;
      c.dataContratacao = dados.dataContratacao;

      const antigos = new Map(c.vinculos.map((v) => [v.empresaId, v]));

      /*
       * O formulário NÃO recebe a lista completa de vínculos: `listarPessoas`
       * entrega só os que o usuário pode ver e só os ativos. Tratar o que ele
       * enviou como a lista inteira apagava silenciosamente:
       *   - vínculos de empresas fora do escopo do gestor (salário de outra
       *     empresa some quando ele edita alguém que atua em várias);
       *   - vínculos inativos, que existem justamente para preservar histórico.
       * Por isso o que ele não podia enxergar é preservado intacto.
       */
      const enviadas = new Set(dados.vinculos.map((v) => v.empresaId));
      const preservados = c.vinculos.filter(
        (v) =>
          !enviadas.has(v.empresaId) &&
          (!v.ativo || !podeVerEmpresa(usuario, v.empresaId)),
      );

      const editados = dados.vinculos.map((v) => {
        const antigo = antigos.get(v.empresaId);
        const centavos = reaisParaCentavos(v.valor);
        if (antigo && antigo.valorFixoCentavos !== centavos) {
          alteracoesDeValor.push({
            cargo: v.cargo,
            de: antigo.valorFixoCentavos,
            para: centavos,
          });
        }
        return {
          id: antigo?.id ?? randomUUID(),
          empresaId: v.empresaId,
          cargo: v.cargo,
          valorFixoCentavos: centavos,
          ativo: true,
        };
      });

      // Remoção precisa ser registrada tanto quanto alteração de valor: sem
      // isto, apagar o vínculo de alguém não deixa rastro nenhum na auditoria,
      // e some da folha sem que se saiba quem tirou nem quanto era.
      for (const antigo of c.vinculos) {
        const some =
          !preservados.includes(antigo) && !enviadas.has(antigo.empresaId);
        if (some) {
          removidos.push({
            empresaId: antigo.empresaId,
            cargo: antigo.cargo,
            valor: antigo.valorFixoCentavos / 100,
          });
        }
      }

      c.vinculos = [...preservados, ...editados];
      c.atualizadoEm = agora;
    } else {
      const novo: Colaborador = {
        id: randomUUID(),
        nome: dados.nome,
        nascimento: dados.nascimento,
        dataContratacao: dados.dataContratacao,
        vinculos: dados.vinculos.map((v) => ({
          id: randomUUID(),
          empresaId: v.empresaId,
          cargo: v.cargo,
          valorFixoCentavos: reaisParaCentavos(v.valor),
          ativo: true,
        })),
        ativo: true,
        desligadoEm: null,
        contrato: null,
        avaliacoes: [],
        criadoEm: agora,
        atualizadoEm: agora,
      };
      base.colaboradores.push(novo);
      idFinal = novo.id;
    }
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: id ? Acao.COLABORADOR_EDITAR : Acao.COLABORADOR_CRIAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: id ?? undefined,
    metadata: { nome: dados.nome },
  });

  // Alteração de salário é registrada à parte, com valor antigo e novo.
  for (const a of alteracoesDeValor) {
    await auditar({
      acao: Acao.VINCULO_ALTERAR_VALOR,
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      entidade: 'colaborador',
      entidadeId: id ?? undefined,
      metadata: { nome: dados.nome, cargo: a.cargo, de: a.de / 100, para: a.para / 100 },
    });
  }

  for (const r of removidos) {
    await auditar({
      acao: Acao.VINCULO_REMOVER,
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      entidade: 'colaborador',
      entidadeId: id ?? undefined,
      metadata: { nome: dados.nome, cargo: r.cargo, valorRemovido: r.valor },
    });
  }

  revalidatePath('/painel');
  return { ok: true, id: idFinal! };
}

/**
 * Desligamento é soft delete: prazos trabalhistas exigem preservar o histórico.
 * O contrato em PDF é apagado, porque guardá-lo indefinidamente sem necessidade
 * contraria a minimização de dados.
 */
export async function desligarColaborador(id: string): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeEditar(usuario)) return { ok: false, erro: 'Sem permissão.' };

  let nome = '';
  let erro: string | null = null;

  await alterarBase((base) => {
    const c = base.colaboradores.find((x) => x.id === id);
    if (!c) {
      erro = 'Colaborador não encontrado.';
      return;
    }
    /*
     * Desligar remove a pessoa do painel de TODAS as empresas e apaga o
     * contrato. Um gestor que enxerga só uma das empresas não pode tomar essa
     * decisão pelas outras — por isso exige-se escopo sobre todos os vínculos,
     * não apenas sobre um deles.
     */
    if (usuario.empresasPermitidas !== null) {
      const forasDoEscopo = c.vinculos.filter(
        (v) => v.ativo && !podeVerEmpresa(usuario, v.empresaId),
      );
      if (forasDoEscopo.length > 0) {
        erro =
          'Esta pessoa também atua em outra empresa. Só um administrador pode desligá-la.';
        return;
      }
      if (!c.vinculos.some((v) => podeVerEmpresa(usuario, v.empresaId))) {
        erro = 'Sem acesso a este colaborador.';
        return;
      }
    }
    nome = c.nome;
    c.ativo = false;
    c.desligadoEm = new Date().toISOString().slice(0, 10);
    c.atualizadoEm = new Date().toISOString();
  });

  if (erro) return { ok: false, erro };

  await removerContrato(usuario, id).catch(() => {});

  await auditar({
    acao: Acao.COLABORADOR_DESLIGAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: id,
    metadata: { nome },
  });

  revalidatePath('/painel');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Avaliação de clima
 * ------------------------------------------------------------------ */

const avaliacaoSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido.'),
  classificacao: z.enum(['excelente', 'saudavel', 'atencao', 'critico']),
  nota: z.number().min(0).max(10),
});

export async function registrarAvaliacao(
  colaboradorId: string,
  entrada: z.input<typeof avaliacaoSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeEditar(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = avaliacaoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  let erro: string | null = null;

  await alterarBase((base) => {
    const c = base.colaboradores.find((x) => x.id === colaboradorId);
    if (!c) {
      erro = 'Colaborador não encontrado.';
      return;
    }
    if (usuario.empresasPermitidas !== null) {
      const alcanca = c.vinculos.some((v) => podeVerEmpresa(usuario, v.empresaId));
      if (!alcanca) {
        erro = 'Sem acesso a este colaborador.';
        return;
      }
    }
    // Uma avaliação por mês: reenviar o mesmo mês substitui a anterior.
    c.avaliacoes = c.avaliacoes.filter((a) => a.mes !== parsed.data.mes);
    c.avaliacoes.push({
      mes: parsed.data.mes,
      classificacao: parsed.data.classificacao,
      nota: parsed.data.nota,
      avaliadorId: usuario.id,
      criadoEm: new Date().toISOString(),
    });
    c.atualizadoEm = new Date().toISOString();
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: Acao.AVALIACAO_CRIAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: colaboradorId,
    metadata: { mes: parsed.data.mes, nota: parsed.data.nota },
  });

  revalidatePath('/painel');
  return { ok: true };
}
