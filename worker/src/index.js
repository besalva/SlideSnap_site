const ALLOWED_ORIGINS = [
  'https://besalva.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: corsHeaders(origin) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const { name, email, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return Response.json(
        { error: 'All fields are required (name, email, message)' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: 'Invalid email address' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Send email via MailChannels
    try {
      const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: env.TO_EMAIL, name: env.TO_NAME }],
            },
          ],
          from: {
            email: env.FROM_EMAIL,
            name: env.FROM_NAME,
          },
          reply_to: {
            email: email,
            name: name,
          },
          subject: `[SlideSnap] Mensagem de ${name}`,
          content: [
            {
              type: 'text/plain',
              value: `Nome: ${name}\nEmail: ${email}\n\nMensagem:\n${message}`,
            },
            {
              type: 'text/html',
              value: `
                <h2>Nova mensagem do site SlideSnap</h2>
                <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <hr />
                <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
              `,
            },
          ],
        }),
      });

      if (mailResponse.status === 202 || mailResponse.ok) {
        return Response.json(
          { success: true },
          { status: 200, headers: corsHeaders(origin) }
        );
      }

      const errText = await mailResponse.text();
      console.error('MailChannels error:', mailResponse.status, errText);
      return Response.json(
        { error: 'Failed to send email' },
        { status: 500, headers: corsHeaders(origin) }
      );
    } catch (err) {
      console.error('Worker error:', err);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  },
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
