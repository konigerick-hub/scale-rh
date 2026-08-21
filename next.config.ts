import type { NextConfig } from 'next';

/**
 * Cabeçalhos de segurança aplicados a toda resposta.
 * Conferir depois do deploy em https://securityheaders.com
 */
const cabecalhosSeguranca = [
  // Não deixa o navegador "adivinhar" o tipo do arquivo (evita XSS por upload).
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // O sistema nunca deve ser embutido em iframe de terceiro (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },

  // Não vaza a URL interna (que contém IDs) ao clicar em link externo.
  { key: 'Referrer-Policy', value: 'no-referrer' },

  // Desliga APIs que este sistema não usa.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },

  // Força HTTPS por 2 anos, incluindo subdomínios.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },

  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' em script ainda é necessário para o bootstrap do Next.
      // Fase de endurecimento: trocar por CSP com nonce gerado no middleware.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      /*
       * O envio de contrato vai do navegador DIRETO para o armazenamento —
       * a função da Vercel recusa corpo acima de ~4,5 MB. Esses dois hosts são
       * o mínimo para isso funcionar: `vercel.com` emite a URL de destino e
       * `*.vercel-storage.com` recebe o arquivo.
       *
       * Sem eles, o token é emitido normalmente e o navegador é bloqueado na
       * hora de enviar — o upload falha sem erro claro na tela.
       */
      "connect-src 'self' https://vercel.com https://*.vercel-storage.com",
      // PDF de contrato é servido pela própria aplicação, via URL assinada.
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Não anuncia a versão do Next para quem está sondando o servidor.
  poweredByHeader: false,

  // Trata erro de tipo como erro de build: um `any` mal colocado na camada de
  // autorização é exatamente o tipo de bug que não pode chegar em produção.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [{ source: '/:path*', headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
