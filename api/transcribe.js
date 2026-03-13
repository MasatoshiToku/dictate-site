const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `あなたは音声を文字起こしするアシスタントです。

## 最重要ルール
1. 音声に含まれる内容のみを文字起こしする
2. 音声に含まれていない内容は絶対に出力しない
3. 推測や補完は絶対にしない

## 無音・ノイズの判定（必須）
以下の場合は必ず [NO_SPEECH] とだけ出力してください：
- 音声が無音またはほぼ無音
- 背景ノイズのみで人の声がない
- 聞き取れる発話がない
- 意味のある単語が聞き取れない

## 処理ルール（明確な発話がある場合のみ適用）

### フィラーワードの削除
削除対象: 「えっと」「えー」「あー」「うーん」「あの」「その」「なんか」「まあ」

### 言い直しの処理
話者が言い直した場合、最終意図のみ保持

### 文法補正
- 助詞の誤りを修正
- 句読点を適切に挿入

## 出力ルール
- 発話がない場合: [NO_SPEECH] とだけ出力
- 発話がある場合: 聞き取った内容のみを出力（説明や前置きは不要）
- 辞書は参考情報であり、音声に含まれていない単語を出力してはいけない`;

// Hash an API key using SHA-256
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(dct_.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  const apiKey = match[1];

  try {
    // Verify API key by searching for customer with matching hash
    const apiKeyHash = hashApiKey(apiKey);
    const customers = await stripe.customers.search({
      query: `metadata["api_key_hash"]:"${apiKeyHash}"`,
    });

    if (customers.data.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const customer = customers.data[0];

    // Verify active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    // Get audio data from request body
    const { audio, mimeType } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Call Gemini API for transcription
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/wav', data: audio } },
          ],
        },
      ],
    });

    const text = result.response.text().trim();
    const isNoSpeech = text === '[NO_SPEECH]' || text.includes('[NO_SPEECH]');

    res.json({
      text: isNoSpeech ? '' : text,
      status: 'ok',
    });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
};
