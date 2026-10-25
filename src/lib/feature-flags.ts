/**
 * Feature flags del backoffice de Increscendo.
 *
 * Regla: todo lo que dependa de una integración o tabla que todavía no existe
 * se apaga aquí, en un solo lugar, sin tocar las páginas.
 */

/**
 * Módulo Tarjetas (OneCard) — Documento de alcance Fase 2.
 * Las pantallas están completas con datos de ejemplo. Se encienden cuando
 * exista la integración vía API con OneCard y las tablas de tarjetas.
 * Mientras está en `true` el menú se muestra con la etiqueta "Fase 2".
 */
export const FEATURE_CARDS = true;

/**
 * Cobro por Druo para cuentas BBVA Bancomer.
 * Muestra el proveedor de cobro (Belvo / Druo) en la ficha del cliente y en
 * Integraciones. El enrutamiento real lo hace el backend.
 */
export const FEATURE_DRUO = true;

/**
 * Servicios y giftcards de Tekae dentro de Movimientos.
 * Apagado: hoy esas transacciones no se guardan en la base de Increscendo
 * (la plataforma solo pide un token y abre Tekae embebido).
 * Se enciende cuando Tekae exponga un reporte/API de transacciones por usuario.
 */
export const FEATURE_TEKAE_MOVEMENTS = false;

/**
 * Riesgo y PLD en la ficha del cliente. Apagado hasta que se defina la matriz
 * de riesgo (requerida cuando entren tarjetas y transferencias).
 */
export const FEATURE_RISK = false;
