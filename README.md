# Increscendo Fintech — Backoffice

Panel administrativo de Increscendo construido sobre la base de Molipay admin
(TanStack Start + React 19 + Tailwind v4), con la marca de Increscendo y conectado
a la misma base de Supabase y a la misma API (`increscendo-api`) que usa hoy la
plataforma del cliente.

La app del cliente, la landing y la firma de contratos **no cambian**: siguen en el
proyecto actual de Increscendo. Este admin se despliega aparte, en paralelo, contra
la misma base; cuando se valide, se apaga `/admin` del proyecto anterior.

## Cómo correrlo

```bash
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173 (o el puerto que indique Vite)
npm run build
```

Sin variables de Supabase el panel abre en **modo demostración**: cualquier correo y
contraseña entran y todo funciona con datos de ejemplo (útil para revisar la interfaz).

Con Supabase configurado, solo entran usuarios con `users.role = 'admin'` o con un
rol de backoffice en `users.metadata.backoffice_role`.

## Estructura del menú

| Grupo | Submenú | Pestañas |
|---|---|---|
| Dashboard | — | Hoy, KPIs, embudo, mora |
| General | Usuarios | Personas físicas · Personas morales · Identidad por verificar → ficha 360° |
| | Movimientos | Todos · Membresías · Préstamos · Tarjetas |
| | Pendientes | Bandeja única con asignación |
| Préstamos | Gestión | Todos · Solicitudes · Firma · Desembolso · Activos · Cerrados |
| | Cobranza | Atrasados · Próximos cobros · Cobros fallidos |
| Membresías | Suscripciones | Todas · Activas · Por vencer · Vencidas · Pago pendiente |
| | Planes y beneficios / Cupones | — |
| Tarjetas · Fase 2 | Campañas · Solicitudes · Activas · Reportadas · Cuenta Maestra · Operaciones | según documento de alcance |
| Administración | Usuarios backoffice | Usuarios · Roles y permisos · Ejecutivos · Actividad |
| | Reportes · Registros | — |
| Sistema | Integraciones · Notificaciones · Catálogos | — |

Ficha del cliente: Resumen · Datos personales · Documentos · Productos (membresía,
préstamos con cronograma, tarjetas) · Cuentas y medios de pago · Movimientos · Historial.
Se ocultaron Impuestos, Subcuentas/CVU, Riesgo y Validaciones de Molipay
(riesgo queda tras el flag `FEATURE_RISK` para cuando llegue PLD).

## Acciones de préstamos (menú ⋯)

Mismo menú en todas las pestañas; las acciones dependen de la etapa:

- **Siempre:** Ver detalle, Ver cronograma, Ir al cliente, Descargar tabla de amortización.
- **Solicitud:** Revisar documentos, Aprobar y enviar contrato (SignNow + correo), Rechazar con motivo, Modificar términos.
- **Firma:** Reenviar contrato, Generar nueva invitación (si falló), Subir contrato firmado (firma asistida).
- **Desembolso:** Cambiar cuenta de desembolso, Registrar desembolso (con voucher).
- **Activo:** Registrar pago externo, Renovar consentimiento, Vender cartera (más de 60 días).
- **Enviar aviso de cobranza** y **Ejecutar cobro** aparecen en todas las pestañas; se
  deshabilitan con explicación cuando el préstamo no tiene cuotas que cobrar.

## Qué es real y qué es de ejemplo

**Conectado a datos reales** (tablas y endpoints existentes):
usuarios y su ficha, documentos (Storage `documents`), cuentas (`payment_methods`),
préstamos y todas sus acciones (`admin_update_loan_status`, `admin_modify_loan_terms`,
`loan_disbursements`, `loan_documents`, SignNow, Belvo), cronograma (Belvo),
suscripciones, planes (Conekta), cupones, correos (`send-email`), alta asistida
(`create-user`), movimientos de membresías y desembolsos, dashboard.

Datos nuevos que hoy se guardan en `users.metadata` / `loans.metadata` hasta que
existan columnas: estatus de identidad y motivo, ejecutivo, tipo de persona,
dirección desglosada, invitación a préstamo, motivo de rechazo, avisos de cobranza,
venta de cartera, pagos externos.

**Datos de ejemplo (con etiqueta visible)** hasta que el backend implemente su contrato:
tarjetas y campañas (OneCard), bitácora, roles en tabla propia, catálogos editables,
salud de integraciones, disparadores automáticos de correo.

El detalle de cada dependencia está en [`docs/CONTRATOS_BACKEND.md`](docs/CONTRATOS_BACKEND.md).

## Dónde está cada cosa

```
src/lib/api/        capa de datos (una función por operación; reemplazable sin tocar pantallas)
  types.ts          contrato de tipos del dominio
  clients.ts loans.ts memberships.ts movements.ts cards.ts backoffice.ts ...
  demo-data.ts      datos de ejemplo
  source.ts         modo demostración y secciones pendientes de backend
src/lib/permissions.ts  matriz de roles (UX; la validación real va en RLS)
src/lib/feature-flags.ts  Tarjetas, Druo, Tekae, Riesgo
src/components/loans/   menú ⋯ y diálogos de préstamos
src/components/clients/ ficha, documentos, identidad, alta asistida
src/routes/          una ruta por pantalla (TanStack file routing)
```
