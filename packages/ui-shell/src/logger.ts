const ANSI_RESET = '\x1b[0m';
const ANSI_MAGENTA = '\x1b[35m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_GRAY = '\x1b[90m';
const ANSI_RED = '\x1b[31m';

function formatTerminal(tag: string, action: string, metadata?: Record<string, unknown>): string {
  const time = new Date().toISOString().substring(11, 23);
  const color = tag.startsWith('HOST') ? ANSI_MAGENTA : ANSI_CYAN;
  const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
  return `${color}[${tag}]${ANSI_RESET} ${ANSI_GRAY}${time}${ANSI_RESET} - ${action}${metaStr}\n`;
}

export function createZoneLogger(zone: 'HOST' | 'REMOTE') {
  const badgeColor = zone === 'HOST' ? '#6b21a8' : '#0891b2';
  return {
    server(action: string, metadata?: Record<string, unknown>): void {
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(formatTerminal(`${zone}:SERVER`, action, metadata));
      } else {
        console.log(`[${zone}:SERVER] ${action}`, metadata ?? '');
      }
    },
    client(action: string, metadata?: Record<string, unknown>): void {
      if (typeof window === 'undefined') {
        this.server(action, metadata);
        return;
      }
      const badgeStyle = `background: ${badgeColor}; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
      if (metadata !== undefined) {
        console.log(`%c${zone}:CLIENT%c ${action}`, badgeStyle, '', metadata);
      } else {
        console.log(`%c${zone}:CLIENT%c ${action}`, badgeStyle, '');
      }
    },
    error(action: string, error: unknown): void {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(`${ANSI_RED}[${zone}:ERROR]${ANSI_RESET} ${action}: ${errorMsg}\n`);
      } else {
        console.error(`%c${zone}:ERROR%c ${action}`, 'background: #dc2626; color: #fff; padding: 2px 6px;', '', error);
      }
    },
  };
}

export const hostLog = createZoneLogger('HOST');
export const remoteLog = createZoneLogger('REMOTE');
