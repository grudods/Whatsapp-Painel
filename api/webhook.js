// api/webhook.js - Deploy no Vercel
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service",
  "project_id": "ds-painel-whatsapp",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@ds-painel-whatsapp.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
};

// Alternativa: usar Database Secret direto
const databaseURL = "https://ds-painel-whatsapp-default-rtdb.firebaseio.com";
const dbSecret = process.env.FIREBASE_DB_SECRET || "your-database-secret-here";

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Webhook recebido:', JSON.stringify(req.body, null, 2));

    // Estrutura do AutoResponder
    const data = req.body.query;
    
    if (!data || !data.sender || !data.message) {
      return res.status(400).json({ 
        replies: [{ message: 'Erro: dados inválidos' }]
      });
    }

    const { sender, message, isGroup } = data;

    // Ignorar grupos
    if (isGroup) {
      return res.json({
        replies: [{ message: 'Atendimento em grupos não é suportado.' }]
      });
    }

    // ID da conversa (remover caracteres especiais)
    const conversa_id = sender.replace(/[^0-9]/g, '');

    // Salvar no Firebase Realtime Database
    const conversaRef = `conversas/${conversa_id}`;
    
    // Fazer requisição ao Firebase REST API
    const firebaseUrl = `${databaseURL}/${conversaRef}.json?auth=${dbSecret}`;

    // 1. Obter conversa atual
    const getResponse = await fetch(firebaseUrl);
    const conversaAtual = await getResponse.json();

    // 2. Preparar nova conversa com mensagem
    const mensagensAtuais = conversaAtual?.mensagens || [];
    const novasMensagens = [
      ...mensagensAtuais,
      {
        tipo: 'cliente',
        texto: message,
        timestamp: new Date().toISOString(),
        sender: sender
      }
    ];

    const conversaAtualizada = {
      ...(conversaAtual || {}),
      id: conversa_id,
      sender: sender,
      status: 'aguardando',
      mensagens: novasMensagens,
      ultima_mensagem: message,
      ultima_atualizacao: new Date().toISOString(),
      criada_em: conversaAtual?.criada_em || new Date().toISOString()
    };

    // 3. Salvar conversa atualizada no Firebase
    const updateResponse = await fetch(firebaseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversaAtualizada)
    });

    if (!updateResponse.ok) {
      throw new Error(`Firebase error: ${updateResponse.statusText}`);
    }

    console.log(`✅ Conversa ${conversa_id} salva no Firebase`);

    // Retornar resposta pro AutoResponder
    return res.status(200).json({
      replies: [
        { 
          message: `Sua mensagem foi recebida. Um atendente responderá em breve.`
        }
      ]
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(500).json({
      replies: [{ message: 'Erro ao processar mensagem' }]
    });
  }
};
