/**
 * Caminho do stream SSE na mesma origem da página. Leva o basePath da zona,
 * então funciona tanto pelo shell (:3000, via rewrite) quanto direto na zona
 * (:3001). Sem o prefixo, o pedido sai do basePath e cai no 404.
 */
export const SSE_EVENTS_PATH = '/remote-app/api/sse-events';
