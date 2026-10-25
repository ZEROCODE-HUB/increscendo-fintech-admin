# Contratos para el backend

Lo que el front del backoffice ya espera y el backend de Increscendo debe implementar.
Cada punto indica **dónde se usa en el front** (archivo de `src/lib/api/`) y **qué hace hoy
el front mientras tanto**. Al implementar un punto, solo se cambia esa función; las pantallas
no se tocan.

Prioridad: **P1** = necesario para la entrega de diciembre · **P2** = fase inmediata posterior.

---

## 1. Movimientos unificados — P1

**Por qué:** es la base que reemplaza las tres bases manuales (Increscendo, Belvo, Druo).

**Vista o tabla `movements`** (una fila por evento de dinero):

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | |
| created_at | timestamptz | fecha del evento |
| user_id | uuid null | null = cobro sin cliente asociado (aparece en Pendientes) |
| type | text | `pago_membresia`, `renovacion_membresia`, `desembolso_prestamo`, `cuota_programada`, `cobro_bajo_demanda`, `reembolso`, `contracargo`, `recarga_tarjeta`, `consumo_tarjeta`, `pago_servicio`, `transferencia` (reservado) |
| product | text | `membresia`, `prestamo`, `tarjeta`, `servicio`, `transferencia` |
| direction | text | `entrada` / `salida` |
| amount | numeric | en pesos (no centavos) |
| status | text | `exitoso`, `en_proceso`, `fallido`, `cancelado`, `reembolsado` |
| provider | text | `conekta`, `respaldo`, `belvo`, `druo`, `onecard`, `tekae`, `manual` |
| method | text | tarjeta, link, transferencia, efectivo, domiciliación… |
| provider_reference | text | ID del cargo en el proveedor (**obligatorio**, se usa para conciliar) |
| description | text | |
| related_id | uuid null | loan_id, user_membership_id o card_id |
| failed_reason | text null | código del proveedor (p. ej. `insufficient_funds`) |

**Reglas:**
- El proveedor es la fuente de verdad del estatus (webhooks idempotentes por `provider_reference`).
- **Sincronización diaria** con Conekta, Belvo y Druo: inserta lo que falte y actualiza estatus.
  Lo que no se pueda asociar a un cliente queda con `user_id = null`.
- RLS: lectura para roles de backoffice.

**Front hoy** (`movements.ts`): arma la lista con `invoices` (o `user_memberships` si está vacía)
+ `loan_disbursements`. Las cuotas de Belvo solo se ven por cliente
(`/belvo/loans/payment-requests?userId=`). Al existir la vista, `listMovements()` pasa a ser
un `select` sobre `movements`.

> Nota: no conocemos el esquema exacto de `invoices`. El front lee de forma defensiva
> `amount, status, user_id, payment_method, conekta_order_id|order_id|reference, description,
> failure_message, created_at`. Si `amount` está en centavos, conviértanlo en la vista.

## 2. Cobro bajo demanda desde el admin — P1

**Endpoint existente:** `POST /belvo/loans/:loanId/payment-request` con `{ installmentNumbers: number[] }`.

**Requisito:** que acepte el token de un usuario admin (hoy lo usa la app del cliente) y que
**enrute por banco**: BBVA Bancomer → Druo, resto → Belvo. Respuesta esperada:
`{ partial?: boolean, payment_requests: [{ payment_request_id }] }`.

## 3. Identidad (KYC) a nivel cliente — P1

**Front hoy** (`clients.ts`): guarda en `users.metadata.kyc`:
`{ status: 'incompleto'|'por_verificar'|'verificado'|'rechazado', reasonCode, reasonMessage, reviewedAt, reviewedBy }`.

**Propuesto:** columnas `users.kyc_status`, `users.kyc_reason_code`, `users.kyc_reason_message`,
`users.kyc_reviewed_at`, `users.kyc_reviewed_by`.

**Reglas de negocio:** la membresía no requiere identidad aprobada (solo subida); tarjeta y
préstamo sí. La app del cliente debe mostrar `kyc_reason_message` cuando esté rechazada.

## 4. Datos nuevos del cliente — P1

Hoy en `users.metadata` (el front ya los lee y escribe):

| metadata | columna propuesta | uso |
|---|---|---|
| `person_type` | `person_type` (`fisica`/`moral`) | pestañas Personas físicas / morales |
| `address_parts` `{calle,numero,colonia,ciudad,estado,pais,cp}` | columnas separadas | dirección desglosada (pedido de Héctor) |
| `executive_id` | `executive_id uuid` → usuario backoffice | atribución de altas |
| `loan_eligible` | `loan_eligible boolean` | préstamo por invitación (la app del cliente solo muestra préstamo si es true) |
| `rfc_url`, `address_proof_url` | columnas | documentos complementarios |
| `created_by`, `contract_mode` | columnas | alta asistida |

## 5. Préstamos: datos nuevos — P1

Hoy en `loans.metadata`:

| metadata | uso |
|---|---|
| `rejection {code, message, at}` | motivo de rechazo codificado (lo ve el cliente) |
| `collection_notices [{sentAt, sentBy, channel, installment}]` | historial de avisos de cobranza |
| `portfolio_sold {at, comment, file_url}` | venta de cartera |
| `external_payments [{amount, reference, at}]` + `paid_amount` | pagos fuera de domiciliación |
| `signnow_error` | error al enviar la invitación (muestra "Generar nueva invitación") |
| `belvo_failed_reason` | último código de fallo de Belvo (sugiere el motivo de rechazo) |

**Sincronización con Belvo:** mantener `metadata.next_payment_date`, `last_payment_date` y
`paid_amount` actualizados por webhook (el front calcula días de atraso con esto).

**Firma asistida:** el front marca `status='signed', signed_at=now()` directo en `loans`
después de subir el contrato a `loan_documents (type='contract')`. Si prefieren una acción en
`admin_update_loan_status` (p. ej. `p_action='sign'`), avisen y se cambia en `attachSignedContract()`.

## 6. Contrato de membresía por SignNow — P1

**Endpoint nuevo:** `POST /signnow-membership-invite` con
`{ user_id, recipient_email, membership_plan_id }`. Lo llama el alta asistida cuando se elige
"Enviar contrato por SignNow". Si falla, el admin ve un aviso (no bloquea el alta).

## 7. Roles de backoffice — P1

**Front hoy:** rol en `users.metadata.backoffice_role` (`admin`, `operaciones`, `agente`,
`cobranza`, `lectura`, `tecnico`) y `backoffice_active`, `backoffice_location`. La matriz de
permisos vive en `src/lib/permissions.ts`.

**Propuesto:** tabla `backoffice_roles (user_id, role, active, location)` y **RLS por rol**:
un agente solo lee clientes con `executive_id = auth.uid()` y no puede ejecutar cobros ni
cargar saldo. La matriz del front es solo UX; la seguridad debe estar en RLS.

**Invitar usuario:** Edge Function que cree el usuario de auth con su rol (hoy la invitación
solo funciona en modo demostración).

## 8. Bitácora — P1

**Tabla `backoffice_activity`:** `id, created_at, user_name, user_id, action, entity, entity_id, detail`.
Para activarla: poner `BACKEND_PENDING.activity = false` en `src/lib/api/source.ts`;
`logActivity()` y `listActivity()` ya hacen insert/select.

## 9. Catálogos — P2

- `catalog_rejection_reasons (code, label, client_message, applies_to text[], belvo_codes text[])`.
  Valores por defecto en `src/lib/api/catalogs-data.ts`.
- Bancos: el front intenta `GET /belvo/institutions`; si falla usa la lista local.
  Bancos agregados a mano quedan marcados "validar con Belvo".

## 10. Salud de integraciones — P2

`GET {API}/health/{belvo|druo|conekta|signnow|tekae|onecard}` → `200` si responde, otro código
si no. Mientras no exista, el panel muestra "Desconocido" (no un falso "En línea").

## 11. Correos automáticos — P2

Tarea programada (cron) que envíe con `send-email`: recordatorio 1 y 3 días antes del
vencimiento, cargo no realizado (webhook de rechazo), membresía por vencer (7 días).
La pantalla Sistema › Notificaciones enciende/apaga cada uno; persistir en `app_settings`.

## 12. Tarjetas OneCard — P2 (documento de alcance Fase 2)

Tablas sugeridas: `card_campaigns`, `card_campaign_recipients (token, expires_at, status)`,
`card_requests`, `cards (user_id, onecard_id, last4, kind, status, balance, credit_line, online_purchases)`,
`card_movements`, `master_account_movements`.

Endpoints (uno por servicio de OneCard del documento de alcance):

| Pantalla | Servicio OneCard | Endpoint sugerido |
|---|---|---|
| Solicitudes › Aprobar | Alta de tarjeta + Carga de saldo | `POST /onecard/cards` |
| Solicitudes › Reintentar | Alta de tarjeta | `POST /onecard/cards/:requestId/retry` |
| Activas › Recargar | Carga de saldo | `POST /onecard/cards/:id/load` |
| Activas › Bloquear/Desbloquear | Bloquear / desbloquear | `POST /onecard/cards/:id/block` |
| Reportadas › Reemplazar | Reemplazo de plástico | `POST /onecard/cards/:id/replace` |
| Cuenta Maestra | Saldo / Movimientos de la Cuenta Maestra | `GET /onecard/master`, `GET /onecard/master/movements` |
| Operaciones | Consultas directas | `POST /onecard/ops` |
| Campañas | — (correos + tokens) | `POST /card-campaigns` |

Las funciones correspondientes están en `src/lib/api/cards.ts`. El módulo se oculta con
`FEATURE_CARDS = false` en `src/lib/feature-flags.ts`.

## 13. Servicios de Tekae — P2

Hoy las transacciones de servicios y giftcards no se guardan en la base (solo se pide un
token y se abre Tekae embebido). Si Tekae ofrece un reporte o API de transacciones por
usuario, se insertan en `movements` con `product='servicio'` y se enciende
`FEATURE_TEKAE_MOVEMENTS`.

## 14. Pasarela de respaldo — P2

Reintento automático con el segundo proveedor cuando Conekta rechaza. Los cobros se registran
en `movements` con `provider='respaldo'` (el front ya lo muestra así).
