// auditor_shell_4: o que sobra se o processo da verificação morre (Ctrl-C, timeout, kill) com a zona congelada pelo L7.
// Sobe a base, congela a zona 2 e se mata com SIGKILL (nem finally nem after rodam).
import { subir } from '../scripts/ambiente.mjs'
const a = await subir({})
a.congelarApp('erp-zona-2')
console.log('congelada; morrendo')
process.kill(process.pid, 'SIGKILL')
