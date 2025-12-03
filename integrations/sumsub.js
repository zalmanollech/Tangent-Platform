const crypto = require('crypto');
const axios = require('axios');

const APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';
const LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME || 'id-and-liveness';

function sign(path, method = 'POST', body = '') {
  const ts = Math.floor(Date.now() / 1000);
  const message = ts + method.toUpperCase() + path + body;

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return { ts, signature };
}

async function generateAccessToken(userId) {
  if (!APP_TOKEN || !SECRET_KEY) {
    throw new Error('SUMSUB_APP_TOKEN or SUMSUB_SECRET_KEY missing');
  }

  const path = '/resources/accessTokens/sdk';
  const payload = {
    userId: String(userId),
    levelName: LEVEL_NAME,
    ttlInSecs: 600
  };

  const body = JSON.stringify(payload);
  const { ts, signature } = sign(path, 'POST', body);

  const res = await axios.post(BASE_URL + path, payload, {
    headers: {
      'X-App-Token': APP_TOKEN,
      'X-App-Access-Ts': ts,
      'X-App-Access-Sig': signature,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

module.exports = { generateAccessToken };

