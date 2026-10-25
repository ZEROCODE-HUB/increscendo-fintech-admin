import { invokeFunction } from "./http";
import { isDemoMode, wait } from "./source";

export type SendEmailParams = { to: string | string[]; subject: string; html: string; text: string };

/** Envío de correo por la Edge Function `send-email` (la misma del admin actual). */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (isDemoMode) {
    await wait(300);
    return;
  }
  await invokeFunction("send-email", params);
}
