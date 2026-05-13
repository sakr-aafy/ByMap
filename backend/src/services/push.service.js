// src/services/push.service.js
// Sends Expo push notifications via the Expo Push API (no SDK required)
const https = require('https');

function sendOne(token, title, body, data) {
  if (!token || !token.startsWith('ExponentPushToken[')) return Promise.resolve();

  const payload = JSON.stringify({ to: token, title, body, data, sound: 'default', badge: 1 });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        res.resume(); // drain
        res.on('end', resolve);
      }
    );
    req.on('error', resolve); // never throw — fire-and-forget
    req.write(payload);
    req.end();
  });
}

// Send to many tokens, silently ignore failures
async function sendPush(tokens, title, body, data = {}) {
  const list = Array.isArray(tokens) ? tokens : [tokens];
  await Promise.allSettled(list.filter(Boolean).map(t => sendOne(t, title, body, data)));
}

module.exports = { sendPush };
