type RegistrationNotification = {
  fullName: string;
  email: string;
};

type NotificationResult = {
  sent: boolean;
  reason?: 'not-configured' | 'failed';
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;',
  }[character] ?? character));
}

function getAdminReviewUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return null;

  try {
    return new URL('/admin/teachers', appUrl).toString();
  } catch {
    return null;
  }
}

export async function sendRegistrationNotification(
  registration: RegistrationNotification
): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const recipients = (process.env.REGISTRATION_NOTIFICATION_EMAIL || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const reviewUrl = getAdminReviewUrl();

  if (!apiKey || !from || recipients.length === 0 || !reviewUrl) {
    console.error(
      'Registration email is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, REGISTRATION_NOTIFICATION_EMAIL, and APP_URL.'
    );
    return { sent: false, reason: 'not-configured' };
  }

  const safeName = escapeHtml(registration.fullName);
  const safeEmail = escapeHtml(registration.email);
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SpottedAI registration notifications',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `Новая заявка на регистрацию: ${registration.fullName.replace(/[\r\n]+/g, ' ')}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#1d1d1f;line-height:1.5">
            <h2 style="margin:0 0 16px">Новая заявка на регистрацию</h2>
            <p><strong>ФИО:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p>Войдите в аккаунт администратора, чтобы подтвердить заявку и назначить роль.</p>
            <p style="margin:24px 0">
              <a href="${reviewUrl}" style="display:inline-block;background:#0071e3;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">
                Открыть заявки
              </a>
            </p>
          </div>
        `,
        text: [
          'Новая заявка на регистрацию',
          `ФИО: ${registration.fullName}`,
          `Email: ${registration.email}`,
          'Войдите в аккаунт администратора, чтобы подтвердить заявку и назначить роль:',
          reviewUrl,
        ].join('\n'),
      }),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('Resend registration notification request failed:', error);
    return { sent: false, reason: 'failed' };
  }

  if (!response.ok) {
    console.error('Resend could not send registration notification:', response.status, await response.text());
    return { sent: false, reason: 'failed' };
  }

  return { sent: true };
}
