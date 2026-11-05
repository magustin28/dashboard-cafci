// Tests de la lógica de "Mi Portfolio" (src/lib/portfolio.js).
// Correr:  npm test        (runner de Node, sin dependencias nuevas)
import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarCartera, agruparCartera, enriquecerCartera,
  dividirTenencias, resumenCartera,
} from "./portfolio.js";

// Dos suscripciones del mismo fondo (se agrupan) y una rescatada por completo.
const cartera = [
  { id: "a1", fondo_nombre: "Fondo A", moneda: "ARS", cuotapartes_disponibles: "100", precio_compra: "10", cantidad: "100", fecha_compra: "2026-01-01" },
  { id: "a2", fondo_nombre: "Fondo A", moneda: "ARS", cuotapartes_disponibles: "100", precio_compra: "20", cantidad: "100", fecha_compra: "2026-01-11" },
  { id: "b1", fondo_nombre: "Fondo B", moneda: "USD", cuotapartes_disponibles: "0", precio_compra: "50", cantidad: "10", fecha_compra: "2026-01-01" },
];

const planilla = [
  { fondo: "Fondo A", valor: "20000", valorVarPct: "1.5" },
];

test("filtrarCartera: por moneda y por nombre (sin distinguir mayúsculas)", () => {
  assert.deepEqual(filtrarCartera(cartera, { moneda: "USD" }).map((i) => i.id), ["b1"]);
  assert.deepEqual(filtrarCartera(cartera, { q: "  fondo a " }).map((i) => i.id), ["a1", "a2"]);
  assert.equal(filtrarCartera(cartera, {}).length, 3);
});

test("agruparCartera: una posición por fondo+moneda con precio ponderado", () => {
  const grupos = agruparCartera(cartera);
  assert.equal(grupos.length, 2);

  const a = grupos.find((g) => g.fondo_nombre === "Fondo A");
  assert.equal(a.cuotapartes_disponibles, 200);
  assert.equal(a.precio_compra, 15);       // (100×10 + 100×20) / 200
  assert.equal(a.precio_suscripcion, 15);
  assert.equal(a._suscripciones.length, 2);

  const b = grupos.find((g) => g.fondo_nombre === "Fondo B");
  assert.equal(b.cuotapartes_disponibles, 0);
  assert.equal(b.precio_compra, 0);
  // Sin cuotapartes disponibles usa el ponderado de lo COMPRADO, no 0.
  assert.equal(b.precio_suscripcion, 50);
});

test("enriquecerCartera: match con la planilla y cálculo de rendimiento", () => {
  const [a, b] = enriquecerCartera(cartera, planilla, "2026-02-01");

  // valor de la planilla es por 1000 cuotapartes → 20000 / 1000 = 20 por cuotaparte
  assert.equal(a.precioActual, 20);
  assert.equal(a.costoTotal, 3000);        // 200 × 15
  assert.equal(a.vActual, 4000);
  assert.equal(a.rendImporte, 1000);
  assert.ok(Math.abs(a.rendPct - (1000 / 3000) * 100) < 1e-9);
  assert.equal(a.varDiariaPct, 1.5);
  assert.ok(a.tna !== null);               // ponderada por las dos suscripciones

  // Sin match en la planilla no hay precio actual ni rendimiento.
  assert.equal(b.match, undefined);
  assert.equal(b.precioActual, null);
  assert.equal(b.rendPct, null);
});

test("dividirTenencias: separa lo que sigue en cartera de lo rescatado", () => {
  const { actual, historico } = dividirTenencias(enriquecerCartera(cartera, planilla, "2026-02-01"));
  assert.deepEqual(actual.map((i) => i.fondo_nombre), ["Fondo A"]);
  assert.deepEqual(historico.map((i) => i.fondo_nombre), ["Fondo B"]);
});

test("resumenCartera: totales, porcentaje y clase de color", () => {
  const { actual } = dividirTenencias(enriquecerCartera(cartera, planilla, "2026-02-01"));
  const r = resumenCartera(actual);
  assert.equal(r.totalARS, 3000);
  assert.equal(r.totalUSD, 0);
  assert.equal(r.vARS, 4000);
  assert.equal(r.rendARS, 1000);
  assert.equal(r.clsARS, "g");
  assert.ok(Math.abs(r.rendARSpct - (1000 / 3000) * 100) < 1e-9);
  assert.equal(r.rendUSDpct, null);
  assert.equal(r.clsUSD, "y");
});

test("resumenCartera: cartera vacía devuelve ceros y porcentajes null", () => {
  const r = resumenCartera([]);
  assert.equal(r.totalARS, 0);
  assert.equal(r.totalUSD, 0);
  assert.equal(r.rendARSpct, null);
  assert.equal(r.rendUSDpct, null);
});
