// api/webhook.js - Deploy no Vercel
// Grava as mensagens do AutoResponder no Firebase Realtime Database via REST.

const databaseURL = "https://ds-painel-whatsapp-default-rtdb.firebaseio.com";

// Quanto tempo o webhook fica esperando o operador escrever (em ms).
// O Vercel encerra a funcao em maxDuration, entao deixamos uma folga.
const TEMPO_ESPERA = 25000;
const INTERVALO = 1500;

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// Fica consultando o Firebase ate o operador digitar algo no painel.
// Quando acha, limpa a fila e devolve os textos.
async function esperarOperador(firebaseUrl) {
  const limite = Date.now() + TEMPO_ESPERA;

  while (Date.now() < limite) {
    await dormir(INTERVALO);

    try {
      const r = await fetch(firebaseUrl);
      const atual = await r.json();
      const fila = Array.isArray(atual?.pendentes)
        ? atual.pendentes.filter(t => typeof t === 'string' && t.trim())
        : [];

      if (fila.length) {
        // limpa a fila para nao reenviar depois
        await fetch(`${firebaseUrl.replace('.json', '')}/pendentes.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([])
        });
        return fila;
      }
    } catch (e) {
      console.error('Erro ao consultar fila:', e.message);
    }
  }

  return [];
}

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
      return res.status(400).json({ replies: [] });
    }

    const { sender, message, isGroup } = data;

    // Ignorar grupos
    if (isGroup) {
      return res.json({ replies: [] });
    }

    // ID da conversa (remover caracteres especiais)
    const conversa_id = sender.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100) || 'desconhecido';

    // Salvar no Firebase Realtime Database
    const conversaRef = `conversas/${conversa_id}`;
    
    // Fazer requisição ao Firebase REST API
    const firebaseUrl = `${databaseURL}/${conversaRef}.json`;

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

    // Respostas que o operador escreveu no painel e ainda nao foram entregues
    const pendentes = Array.isArray(conversaAtual?.pendentes)
      ? conversaAtual.pendentes.filter(t => typeof t === 'string' && t.trim())
      : [];

    const conversaAtualizada = {
      ...(conversaAtual || {}),
      pendentes: [],
      id: conversa_id,
      sender: sender,
      status: conversaAtual?.status === 'em-atendimento' ? 'em-atendimento' : 'aguardando',
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

    // 4. Se ja havia resposta na fila, entrega agora mesmo.
    if (pendentes.length) {
      console.log(`Entregando ${pendentes.length} resposta(s) da fila`);
      return res.status(200).json({
        replies: pendentes.map(texto => ({ message: texto }))
      });
    }

    // 5. Senao, segura a conexao esperando o operador digitar no painel.
    const novas = await esperarOperador(firebaseUrl);

    if (novas.length) {
      console.log(`Operador respondeu a tempo: ${novas.length} mensagem(ns)`);
      return res.status(200).json({
        replies: novas.map(texto => ({ message: texto }))
      });
    }

    console.log('Operador nao respondeu no tempo. Nada sera enviado.');
    return res.status(200).json({ replies: [] });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return res.status(500).json({ replies: [] });
  }
};

// Vercel: permite que a funcao fique aberta esperando o operador
module.exports.config = { maxDuration: 30 };
      
