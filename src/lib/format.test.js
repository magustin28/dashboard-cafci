// Tests de los formateadores compartidos (src/lib/format.js).
// Correr:  npm test        (runner de Node, sin dependencias nuevas)
import test from "node:test";
import assert from "node:assert/strict";
import {
  simboloMoneda, nombreMoneda, numero, cuotapartes, precioCuotaparte,
  moneda, porcentaje, claseSigno, colorVariacion,
  fechaCorta, fechaCompleta, hoyCompleta, VERDE, ROJO,
} from "./format.js";

test("simboloMoneda: ARS y USD/USB con espacio final", () => {
  assert.equal(simboloMoneda("ARS"), "$ ");
  assert.equal(simboloMoneda("USD"), "U$S ");
  assert.equal(simboloMoneda("USB"), "U$S ");
});

test("nombreMoneda: nombre largo de la moneda para los campos fijos de los modales", () => {
  assert.equal(nombreMoneda("ARS"), "ARS — Pesos");
  assert.equal(nombreMoneda("USD"), "USD — Dólar");
  assert.equal(nombreMoneda("USB"), "USB — Dólar Billete");
  // Una moneda desconocida se muestra tal cual (no se le inventa nombre); sin valor va el guion.
  assert.equal(nombreMoneda("XXX"), "XXX");
  assert.equal(nombreMoneda(null), "—");
});

test("numero: separador es-AR y guion si no es numérico", () => {
  assert.equal(numero(1234.5), "1.234,50");
  assert.equal(numero("1234.5", 2, 2), "1.234,50");
  assert.equal(numero(null), "—");
  assert.equal(numero(""), "—");
  assert.equal(numero("abc"), "—");
});

test("cuotapartes: siempre 4 decimales", () => {
  assert.equal(cuotapartes(1.234567), "1,2346");
  assert.equal(cuotapartes(1250), "1.250,0000");
});

test("precioCuotaparte: de 4 a 6 decimales", () => {
  assert.equal(precioCuotaparte(0.123456789), "0,123457");
  assert.equal(precioCuotaparte(1250.48), "1.250,4800");
});

test("moneda: absoluto por defecto, signo opcional y cero sin signo", () => {
  assert.equal(moneda(1234.5, "ARS"), "$ 1.234,50");
  assert.equal(moneda(-1234.5, "USD"), "U$S 1.234,50");
  assert.equal(moneda(1234.5, "ARS", { signo: true }), "+$ 1.234,50");
  assert.equal(moneda(-5, "ARS", { signo: true }), "-$ 5,00");
  assert.equal(moneda(0, "ARS", { signo: true }), "$ 0,00");
  assert.equal(moneda(1.234567, "ARS", { dec: 4 }), "$ 1,2346");
  assert.equal(moneda(null, "ARS"), "—");
});

test("porcentaje: signo + si es positivo, agrupado opcional", () => {
  assert.equal(porcentaje(12.3456), "+12.35%");
  assert.equal(porcentaje(-3.1), "-3.10%");
  assert.equal(porcentaje(0), "0.00%");
  assert.equal(porcentaje(null), "—");
  assert.equal(porcentaje(1234.567, 2, { agrupado: true }), "+1.234,57%");
});

test("claseSigno: pos, neg o zero", () => {
  assert.equal(claseSigno(5), "pos");
  assert.equal(claseSigno(-1), "neg");
  assert.equal(claseSigno(0), "zero");
  assert.equal(claseSigno("x"), "zero");
});

test("colorVariacion: verde desde cero, rojo si es negativa", () => {
  assert.equal(colorVariacion(0), VERDE);
  assert.equal(colorVariacion(0.1), VERDE);
  assert.equal(colorVariacion(-0.1), ROJO);
  assert.equal(colorVariacion(null), undefined);
});

test("fechaCorta: ISO → DD/MM/AA y no ISO sin cambios", () => {
  assert.equal(fechaCorta("2026-10-26"), "26/10/26");
  assert.equal(fechaCorta(""), "");
});

test("fechaCompleta: ISO y DD/MM/AA o DD/MM/AAAA → DD/MM/AAAA", () => {
  assert.equal(fechaCompleta("2026-10-26"), "26/10/2026");
  assert.equal(fechaCompleta("26/10/26"), "26/10/2026");
  assert.equal(fechaCompleta("26/10/2026"), "26/10/2026");
  assert.equal(fechaCompleta(null), "—");
});

test("hoyCompleta: formato DD/MM/AAAA", () => {
  assert.match(hoyCompleta(), /^\d{2}\/\d{2}\/\d{4}$/);
});
