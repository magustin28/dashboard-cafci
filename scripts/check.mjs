// scripts/check.mjs — corre lint + test + build y devuelve un resumen de pocas líneas.
//
// Para qué existe: el chequeo completo (lint + test + build) genera cientos de líneas y en la
// terminal se vuelve incómodo de leer y de copiar. Acá cada paso escribe su salida completa en
// tmp/check-<paso>.txt y en pantalla queda sólo el veredicto. Si algo falla, imprime las últimas
// líneas de ese log para no tener que abrirlo.
//
// Uso:  npm run check      (o directamente: node scripts/check.mjs)
// Sale con código 1 si algún paso falló, para poder usarlo también en un hook o CI.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PASOS = [
  { nombre: 'lint',  desc: 'eslint' },
  { nombre: 'test',  desc: 'node --test' },
  { nombre: 'build', desc: 'vite build' },
];

mkdirSync('tmp', { recursive: true });

const fallaron = [];
const resumen = [];

for (const paso of PASOS) {
  process.stdout.write(`▶ ${paso.nombre} (${paso.desc})… `);

  // shell:true para que "npm" se resuelva igual en Windows (npm.cmd) y en Linux/macOS.
  const r = spawnSync('npm', ['run', paso.nombre], { shell: true, encoding: 'utf8' });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  const logPath = `tmp/check-${paso.nombre}.txt`;
  writeFileSync(logPath, salida);

  const ok = r.status === 0;
  if (!ok) fallaron.push(paso.nombre);

  // Pistas cortas y útiles de cada paso
  let pista = '';
  if (paso.nombre === 'test') {
    const m = salida.match(/[^\s]*fail (\d+)/);
    if (m) pista = ` (fail ${m[1]})`;
  } else if (paso.nombre === 'build') {
    const m = salida.match(/built in ([\d.]+s)/);
    if (m) pista = ` (${m[1]})`;
  } else {
    const m = salida.match(/(\d+) problems?/);
    pista = m ? ` (${m[1]} problemas)` : ' (sin problemas)';
  }

  console.log(ok ? `✔${pista}` : `✖${pista} → ${logPath}`);
  resumen.push({ nombre: paso.nombre, ok, logPath });

  if (!ok) {
    const ultimas = salida.trim().split('\n').slice(-12).join('\n  ');
    console.log(`  ${ultimas}`);
  }
}

console.log('─────');
if (fallaron.length === 0) {
  console.log('✔ lint + test + build OK');
} else {
  console.log(`✖ falló: ${fallaron.join(', ')} (log completo en ${resumen.map(r => r.logPath).join(', ')})`);
}
process.exit(fallaron.length === 0 ? 0 : 1);
