"use server";

import { Resend } from "resend";

export type ContactFormData = {
  name: string;
  email: string;
  msg: string;
};

export type ContactActionResult = { ok: true } | { ok: false; error: string };

export async function sendContactMessage(
  formData: ContactFormData
): Promise<ContactActionResult> {
  const { name, email, msg } = formData;

  if (!name.trim() || !email.trim() || !msg.trim()) {
    return { ok: false, error: "Todos los campos son obligatorios." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.CONTACT_EMAIL as string,
      replyTo: email,
      subject: `Nuevo mensaje de contacto de ${name}`,
      html: `
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Correo:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${msg}</p>
      `,
    });

    if (error) {
      return { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }
}
