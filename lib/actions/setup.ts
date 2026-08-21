'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { hashSenha, validarForcaSenha } from '@/lib/auth/password';
import { auditar, Acao } from '@/lib/auth/audit';
import { COLABORADORES_INICIAIS, EMPRESAS_INICIAIS } from '@/lib/dados-iniciais';
import { reaisParaCentavos, type Colaborador } from '@/lib/store/tipos';

export type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Primeira configuração — só funciona enquanto NÃO existir nenhum usuário.
 *
 * É a única rota do sistema que aceita requisição sem sessão, porque no
 * primeiro acesso não existe conta para autenticar. A trava é a contagem de
 * usuários: assim que a primeira conta existir, esta ação recusa para sempre.
 */

export async function precisaConfigurar(): Promise<boolean> {
  const { base } = await carregarBase();
  return base.usuarios.length === 0;
}

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().email('E-mail inválido.').max(255),
  senha: z.string().min(1, 'Informe a senha.'),
  importarPlanilha: z.boolean(),
});

export async function configurarPrimeiroAdmin(
  entrada: z.input<typeof schema>,
): Promise<Resultado> {
  const parsed = schema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  const fraca = validarForcaSenha(d.senha);
  if (fraca) return { ok: false, erro: fraca };

  // Confere antes de gastar tempo com o hash da senha.
  const { base: atual } = await carregarBase();
  if (atual.usuarios.length > 0) {
    return { ok: false, erro: 'O sistema já foi configurado.' };
  }

  const senhaHash = await hashSenha(d.senha);
  const email = d.email.toLowerCase().trim();
  const agora = new Date().toISOString();

  let recusado = false;

  await alterarBase((b) => {
    // Confere DE NOVO dentro da escrita: entre a checagem acima e este ponto,
    // outra requisição poderia ter criado a primeira conta. A escrita é
    // condicional por ETag, então quem chegar depois recarrega e cai aqui.
    if (b.usuarios.length > 0) {
      recusado = true;
      return;
    }

    if (b.empresas.length === 0) {
      b.empresas = EMPRESAS_INICIAIS.map((e) => ({ ...e, id: randomUUID() }));
    }

    b.usuarios.push({
      id: randomUUID(),
      email,
      senhaHash,
      nome: d.nome,
      papel: 'admin',
      ativo: true,
      empresaIds: [],
      mfaSecret: null,
      trocarSenha: false,
      ultimoLoginEm: null,
      criadoEm: agora,
    });

    if (d.importarPlanilha && b.colaboradores.length === 0) {
      const idPorNome = new Map(b.empresas.map((e) => [e.nome, e.id]));
      const novos: Colaborador[] = [];

      for (const p of COLABORADORES_INICIAIS) {
        const vinculos = p.vinculos
          .map((v) => {
            const empresaId = idPorNome.get(v.empresa);
            return empresaId
              ? {
                  id: randomUUID(),
                  empresaId,
                  cargo: v.cargo,
                  valorFixoCentavos: reaisParaCentavos(v.valor),
                  ativo: true,
                }
              : null;
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        if (vinculos.length === 0) continue;

        novos.push({
          id: randomUUID(),
          nome: p.nome,
          nascimento: null,
          dataContratacao: null,
          vinculos,
          ativo: true,
          desligadoEm: null,
          contrato: null,
          avaliacoes: [],
          criadoEm: agora,
          atualizadoEm: agora,
        });
      }
      b.colaboradores = novos;
    }
  });

  if (recusado) return { ok: false, erro: 'O sistema já foi configurado.' };

  await auditar({
    acao: Acao.USUARIO_CRIAR,
    usuarioEmail: email,
    entidade: 'usuario',
    metadata: { primeiroAdmin: true, importouPlanilha: d.importarPlanilha },
  });

  return { ok: true };
}
