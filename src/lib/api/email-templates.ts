import { CLIENT_APP_URL } from "@/lib/env";

/**
 * Plantillas de correo portadas del admin actual de Increscendo.
 * Los enlaces apuntan a la app del cliente (CLIENT_APP_URL), no al admin.
 */
const BRAND = {
  primary: '#1B2A45',
  success: '#2EBF91',
  danger: '#C92A2A',
  warning: '#E8A622',
  bg: '#F4F6F9',
  fg: '#152035',
  muted: '#6B7280',
  white: '#FFFFFF',
};

const wrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Segoe UI',system-ui,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        ${content}
        <tr><td style="padding:24px;text-align:center;font-size:12px;color:${BRAND.muted};border-top:1px solid #E5E7EB">
          &copy; ${new Date().getFullYear()} Increscendo &mdash; Todos los derechos reservados.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const header = (bgColor: string, title: string) => `
<tr><td style="background-color:${bgColor};padding:32px 24px;text-align:center">
  <h1 style="margin:0;color:${BRAND.white};font-size:22px;font-weight:700">${title}</h1>
</td></tr>`;

const section = (label: string, value: string) => `
<tr><td style="padding:8px 24px">
  <table role="presentation" width="100%">
    <tr>
      <td style="font-size:13px;color:${BRAND.muted};padding:4px 0;width:40%">${label}</td>
      <td style="font-size:14px;color:${BRAND.fg};font-weight:600;padding:4px 0">${value}</td>
    </tr>
  </table>
</td></tr>`;

const divider = `<tr><td style="padding:0 24px"><div style="height:1px;background-color:#E5E7EB;margin:4px 0"></div></td></tr>`;

export const loanApprovedTemplate = (data: {
  name: string;
  loanId: string;
  amount: string;
  installments: string;
  bank: string;
  clabe: string;
}) => wrapper(`
  ${header(BRAND.primary, '¡Préstamo Pre Aprobado!')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Nos complace informarte que tu solicitud de préstamo ha sido <strong style="color:${BRAND.success}">preaprobada</strong>.
      Revisa tu correo para firmar el contrato digital y completar el proceso.
    </p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" style="background-color:${BRAND.bg};border-radius:8px;padding:12px">
      ${section('Folio', data.loanId)}
      ${section('Monto', `$${data.amount} MXN`)}
      ${section('Plazo', `${data.installments} cuotas`)}
      ${section('Banco', data.bank)}
      ${section('CLABE', data.clabe)}
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/my-loans" style="display:inline-block;background-color:${BRAND.success};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Ir a Mis Préstamos</a>
  </td></tr>
`);

export const loanRejectedTemplate = (data: {
  name: string;
  loanId: string;
  reason?: string;
}) => wrapper(`
  ${header(BRAND.danger, 'Solicitud rechazada')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Lamentamos informarte que tu solicitud de préstamo <strong>Folio ${data.loanId}</strong>
      no ha sido aprobada en esta ocasión.
    </p>
    ${data.reason ? `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6;background-color:${BRAND.bg};border-radius:8px;padding:12px"><strong>Motivo:</strong> ${data.reason}</p>` : ""}
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Si tienes dudas, contáctanos para recibir más información.
    </p>
  </td></tr>
`);

export const paymentReminderTemplate = (data: {
  name: string;
  loanId: string;
  amount: string;
  nextPaymentDate: string;
  installment: string;
  clabe: string;
}) => wrapper(`
  ${header(BRAND.warning, 'Recordatorio de Pago')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Te recordamos que tu próxima cuota está por vencer. Realiza tu pago a tiempo para evitar cargos adicionales.
    </p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" style="background-color:${BRAND.bg};border-radius:8px;padding:12px">
      ${section('Préstamo', data.loanId)}
      ${section('Cuota', data.installment)}
      ${section('Monto', `$${data.amount} MXN`)}
      ${section('Fecha límite', data.nextPaymentDate)}
      ${section('CLABE', data.clabe)}
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/my-loans" style="display:inline-block;background-color:${BRAND.primary};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Ir a Mis Préstamos</a>
  </td></tr>
`);

export const disbursementConfirmedTemplate = (data: {
  name: string;
  loanId: string;
  amount: string;
  bank: string;
  clabe: string;
}) => wrapper(`
  ${header(BRAND.success, '¡Desembolso Exitoso!')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      El desembolso de tu préstamo ha sido procesado exitosamente.
      Los fondos están siendo transferidos a tu cuenta.
    </p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" style="background-color:${BRAND.bg};border-radius:8px;padding:12px">
      ${section('Préstamo', data.loanId)}
      ${section('Monto desembolsado', `$${data.amount} MXN`)}
      ${section('Banco', data.bank)}
      ${section('CLABE', data.clabe)}
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/my-loans" style="display:inline-block;background-color:${BRAND.success};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Ver Detalles</a>
  </td></tr>
`);

export const membershipAcquiredTemplate = (data: {
  name: string;
  planName: string;
  amount: string;
  startDate: string;
  expirationDate: string;
}) => wrapper(`
  ${header(BRAND.primary, '¡Membresía Activada!')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Tu membresía ha sido activada correctamente. Ya puedes disfrutar de todos los beneficios exclusivos.
    </p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" style="background-color:${BRAND.bg};border-radius:8px;padding:12px">
      ${section('Plan', data.planName)}
      ${section('Monto', `$${data.amount} MXN`)}
      ${section('Inicio', data.startDate)}
      ${section('Vigencia', data.expirationDate)}
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/memberships" style="display:inline-block;background-color:${BRAND.primary};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Ir a Membresías</a>
  </td></tr>
`);

/** Aviso de cobranza: informa al cliente que se realizará el cargo de su cuota. */
export const collectionNoticeTemplate = (data: {
  name: string;
  loanId: string;
  amount: string;
  installment: string;
  chargeDate: string;
  bank: string;
  clabe: string;
}) => wrapper(`
  ${header(BRAND.primary, 'Aviso de cargo a tu cuenta')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">
      Te informamos que se realizará el cargo de tu cuota pendiente a la cuenta que registraste.
      Asegúrate de contar con saldo suficiente para evitar cargos por atraso.
    </p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 24px">
    <table role="presentation" width="100%" style="background-color:${BRAND.bg};border-radius:8px;padding:12px">
      ${section('Préstamo', data.loanId)}
      ${section('Cuota', data.installment)}
      ${section('Monto', `$${data.amount} MXN`)}
      ${section('Fecha del cargo', data.chargeDate)}
      ${section('Cuenta', `${data.bank} ${data.clabe}`)}
    </table>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/my-loans" style="display:inline-block;background-color:${BRAND.primary};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Ver mi préstamo</a>
  </td></tr>
`);

/** Identidad rechazada: mensaje orientador para que el cliente corrija sus documentos. */
export const kycRejectedTemplate = (data: { name: string; message: string }) => wrapper(`
  ${header(BRAND.warning, 'Revisa tus documentos')}
  <tr><td style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND.fg}">Hola <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND.fg};line-height:1.6">${data.message}</p>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};line-height:1.6">
      Consejos: toma la foto sobre una superficie lisa, con buena luz, sin flash y sin cortar los bordes.
    </p>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <a href="${CLIENT_APP_URL}/mi-cuenta" style="display:inline-block;background-color:${BRAND.success};color:${BRAND.white};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Actualizar documentos</a>
  </td></tr>
`);
