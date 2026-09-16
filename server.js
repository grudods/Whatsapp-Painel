const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ===== MIDDLEWARES =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve arquivos estáticos (HTML, CSS, JS)

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'sua-chave-secreta';

// ===== DATABASE IN-MEMORY (Muda pra Firebase/Postgres depois) =====
let conversas = {};
let operadoresOnline = {};

// ===== SOCKET.IO - Conexões =====
io.on('connection', (socket) => {
    console.log(`✅ Novo cliente conectado: ${socket.id}`);

    // Receber dados do cliente
    socket.on('operador_conectado', (dados) => {
        const { nome_operador } = dados;
        operadoresOnline[socket.id] = nome_operador;
        console.log(`🟢 Operador online: ${nome_operador}`);
        
        // Enviar todas as conversas pro cliente
        socket.emit('sincronizar_conversas', { conversas });
    });

    // Operador pega uma conversa
    socket.on('pegar_conversa', (dados) => {
        const { conversa_id, operador } = dados;
        if (conversas[conversa_id]) {
            conversas[conversa_id].status = 'em-atendimento';
            conversas[conversa_id].operador_atendimento = operador;
            
            console.log(`🔴 ${operador} pegou conversa ${conversa_id}`);
            
            // Notificar todos
            io.emit('conversa_pega', {
                conversa_id,
                operador
            });
        }
    });

    // Operador envia resposta
    socket.on('enviar_resposta', (dados) => {
        const { conversa_id, operador, resposta } = dados;

        console.log(`💬 Resposta de ${operador} para ${conversa_id}: ${resposta}`);

        if (conversas[conversa_id]) {
            conversas[conversa_id].mensagens.push({
                tipo: 'funcionario',
                texto: resposta,
                timestamp: new Date(),
                operador
            });

            // Notificar todos os clientes
            io.emit('resposta_enviada', {
                conversa_id,
                operador,
                resposta,
                timestamp: new Date()
            });

            // ===== AQUI VOCÊ ENVIA PRO AUTORESPONDER =====
            enviarParaAutoResponder(conversa_id, resposta);
        }
    });

    // Marcar conversa como concluída
    socket.on('marcar_concluida', (dados) => {
        const { conversa_id } = dados;
        if (conversas[conversa_id]) {
            conversas[conversa_id].status = 'concluida';
            
            console.log(`✅ Conversa ${conversa_id} concluída`);
            
            io.emit('conversa_concluida', { conversa_id });
        }
    });

    socket.on('disconnect', () => {
        delete operadoresOnline[socket.id];
        console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
});

// ===== WEBHOOK DO AUTORESPONDER =====
app.post('/api/webhook', (req, res) => {
    const { sender, message, isGroup } = req.body;

    if (!sender || !message) {
        return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Ignorar grupos
    if (isGroup) {
        return res.json({
            replies: [{ message: 'Atendimento automático em grupos não é suportado.' }]
        });
    }

    // Criar ou atualizar conversa
    const conversa_id = sender.replace(/[^0-9]/g, '');
    
    if (!conversas[conversa_id]) {
        conversas[conversa_id] = {
            id: conversa_id,
            sender: sender,
            status: 'aguardando',
            mensagens: [],
            operador_atendimento: null,
            criada_em: new Date()
        };
    }

    // Adicionar mensagem
    conversas[conversa_id].mensagens.push({
        tipo: 'cliente',
        texto: message,
        timestamp: new Date(),
        sender
    });

    conversas[conversa_id].ultima_mensagem = message;
    conversas[conversa_id].ultima_atualizacao = new Date();

    console.log(`📩 Mensagem recebida de ${sender}: ${message}`);

    // Notificar todos os operadores (PAINEL WEB)
    io.emit('nova_mensagem', {
        conversa_id,
        sender,
        message,
        timestamp: new Date()
    });

    // ===== RESPOSTA DO WEBHOOK =====
    // AutoResponder vai esperar por uma resposta daqui
    // Por enquanto, respondemos com uma mensagem genérica
    // Depois, quando o operador responder, enviamos a resposta real
    
    res.json({
        replies: [
            { 
                message: 'Sua mensagem foi recebida por nossa equipe. Aguarde a resposta de um atendente.' 
            }
        ]
    });

    // Guardar conversa no armazenamento para enviar resposta depois
    if (!conversas[conversa_id].webhook_pendente) {
        conversas[conversa_id].webhook_pendente = {
            sender: sender,
            esperando_resposta: true,
            timestamp_chegada: new Date()
        };
    }
});

// ===== FUNÇÃO PARA ENVIAR RESPOSTA PRO AUTORESPONDER =====
function enviarParaAutoResponder(conversa_id, resposta) {
    // Esta é uma função mockada por enquanto
    // Na versão real, você faria uma requisição pro seu Auto Responder
    // Dependendo de como ele recebe as respostas
    
    console.log(`📤 Enviando para AutoResponder (conversa ${conversa_id}): ${resposta}`);
    
    // Opção 1: Se AutoResponder tiver um endpoint pra receber respostas
    // fetch('http://localhost:8888/api/send', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         conversa_id,
    //         resposta
    //     })
    // });

    // Opção 2: Integração direta via Intent (Android)
    // Isso seria feito via outro backend que roda no celular

    // Por enquanto, só logamos
    console.log(`✓ Resposta fila para envio ao cliente via WhatsApp`);
}

// ===== ENDPOINTS AUXILIARES =====

// Status do servidor
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        operadores_online: Object.keys(operadoresOnline).length,
        conversas_aguardando: Object.values(conversas).filter(c => c.status === 'aguardando').length,
        conversas_em_atendimento: Object.values(conversas).filter(c => c.status === 'em-atendimento').length,
        total_conversas: Object.keys(conversas).length
    });
});

// Listar todas as conversas (para debug)
app.get('/api/conversas', (req, res) => {
    res.json(conversas);
});

// Limpar conversas antigas (opcional)
app.post('/api/limpar-antigas', (req, res) => {
    const agora = new Date();
    const umaHoraAtras = new Date(agora - 60 * 60 * 1000);

    let removidas = 0;
    Object.keys(conversas).forEach(id => {
        if (conversas[id].ultima_atualizacao < umaHoraAtras && conversas[id].status === 'concluida') {
            delete conversas[id];
            removidas++;
        }
    });

    res.json({ removidas, mensagem: `${removidas} conversas antigas removidas` });
});

// ===== INICIAR SERVIDOR =====
server.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║  🚀 Servidor WhatsApp Panel Iniciado      ║
    ║  📍 http://localhost:${PORT}                    ║
    ║  ✓ Webhook: http://localhost:${PORT}/api/webhook ║
    ║  ✓ Status: http://localhost:${PORT}/api/status   ║
    ╚════════════════════════════════════════════╝
    `);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Encerrando gracefully...');
    server.close(() => {
        console.log('Servidor encerrado.');
        process.exit(0);
    });
});
        console.log(`🟢 Operador online: ${nome_operador}`);
        
        // Enviar todas as conversas pro cliente
        socket.emit('sincronizar_conversas', { conversas });
    });

    // Operador pega uma conversa
    socket.on('pegar_conversa', (dados) => {
        const { conversa_id, operador } = dados;
        if (conversas[conversa_id]) {
            conversas[conversa_id].status = 'em-atendimento';
            conversas[conversa_id].operador_atendimento = operador;
            
            console.log(`🔴 ${operador} pegou conversa ${conversa_id}`);
            
            // Notificar todos
            io.emit('conversa_pega', {
                conversa_id,
                operador
            });
        }
    });

    // Operador envia resposta
    socket.on('enviar_resposta', (dados) => {
        const { conversa_id, operador, resposta } = dados;

        console.log(`💬 Resposta de ${operador} para ${conversa_id}: ${resposta}`);

        if (conversas[conversa_id]) {
            conversas[conversa_id].mensagens.push({
                tipo: 'funcionario',
                texto: resposta,
                timestamp: new Date(),
                operador
            });

            // Notificar todos os clientes
            io.emit('resposta_enviada', {
                conversa_id,
                operador,
                resposta,
                timestamp: new Date()
            });

            // ===== AQUI VOCÊ ENVIA PRO AUTORESPONDER =====
            enviarParaAutoResponder(conversa_id, resposta);
        }
    });

    // Marcar conversa como concluída
    socket.on('marcar_concluida', (dados) => {
        const { conversa_id } = dados;
        if (conversas[conversa_id]) {
            conversas[conversa_id].status = 'concluida';
            
            console.log(`✅ Conversa ${conversa_id} concluída`);
            
            io.emit('conversa_concluida', { conversa_id });
        }
    });

    socket.on('disconnect', () => {
        delete operadoresOnline[socket.id];
        console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
});

// ===== WEBHOOK DO AUTORESPONDER =====
app.post('/api/webhook', (req, res) => {
    const { sender, message, isGroup } = req.body;

    if (!sender || !message) {
        return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Ignorar grupos
    if (isGroup) {
        return res.json({
            replies: [{ message: 'Atendimento automático em grupos não é suportado.' }]
        });
    }

    // Criar ou atualizar conversa
    const conversa_id = sender.replace(/[^0-9]/g, '');
    
    if (!conversas[conversa_id]) {
        conversas[conversa_id] = {
            id: conversa_id,
            sender: sender,
            status: 'aguardando',
            mensagens: [],
            operador_atendimento: null,
            criada_em: new Date()
        };
    }

    // Adicionar mensagem
    conversas[conversa_id].mensagens.push({
        tipo: 'cliente',
        texto: message,
        timestamp: new Date(),
        sender
    });

    conversas[conversa_id].ultima_mensagem = message;
    conversas[conversa_id].ultima_atualizacao = new Date();

    console.log(`📩 Mensagem recebida de ${sender}: ${message}`);

    // Notificar todos os operadores (PAINEL WEB)
    io.emit('nova_mensagem', {
        conversa_id,
        sender,
        message,
        timestamp: new Date()
    });

    // ===== RESPOSTA DO WEBHOOK =====
    // AutoResponder vai esperar por uma resposta daqui
    // Por enquanto, respondemos com uma mensagem genérica
    // Depois, quando o operador responder, enviamos a resposta real
    
    res.json({
        replies: [
            { 
                message: 'Sua mensagem foi recebida por nossa equipe. Aguarde a resposta de um atendente.' 
            }
        ]
    });

    // Guardar conversa no armazenamento para enviar resposta depois
    if (!conversas[conversa_id].webhook_pendente) {
        conversas[conversa_id].webhook_pendente = {
            sender: sender,
            esperando_resposta: true,
            timestamp_chegada: new Date()
        };
    }
});

// ===== FUNÇÃO PARA ENVIAR RESPOSTA PRO AUTORESPONDER =====
function enviarParaAutoResponder(conversa_id, resposta) {
    // Esta é uma função mockada por enquanto
    // Na versão real, você faria uma requisição pro seu Auto Responder
    // Dependendo de como ele recebe as respostas
    
    console.log(`📤 Enviando para AutoResponder (conversa ${conversa_id}): ${resposta}`);
    
    // Opção 1: Se AutoResponder tiver um endpoint pra receber respostas
    // fetch('http://localhost:8888/api/send', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         conversa_id,
    //         resposta
    //     })
    // });

    // Opção 2: Integração direta via Intent (Android)
    // Isso seria feito via outro backend que roda no celular

    // Por enquanto, só logamos
    console.log(`✓ Resposta fila para envio ao cliente via WhatsApp`);
}

// ===== ENDPOINTS AUXILIARES =====

// Status do servidor
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        operadores_online: Object.keys(operadoresOnline).length,
        conversas_aguardando: Object.values(conversas).filter(c => c.status === 'aguardando').length,
        conversas_em_atendimento: Object.values(conversas).filter(c => c.status === 'em-atendimento').length,
        total_conversas: Object.keys(conversas).length
    });
});

// Listar todas as conversas (para debug)
app.get('/api/conversas', (req, res) => {
    res.json(conversas);
});

// Limpar conversas antigas (opcional)
app.post('/api/limpar-antigas', (req, res) => {
    const agora = new Date();
    const umaHoraAtras = new Date(agora - 60 * 60 * 1000);

    let removidas = 0;
    Object.keys(conversas).forEach(id => {
        if (conversas[id].ultima_atualizacao < umaHoraAtras && conversas[id].status === 'concluida') {
            delete conversas[id];
            removidas++;
        }
    });

    res.json({ removidas, mensagem: `${removidas} conversas antigas removidas` });
});

// ===== INICIAR SERVIDOR =====
server.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║  🚀 Servidor WhatsApp Panel Iniciado      ║
    ║  📍 http://localhost:${PORT}                    ║
    ║  ✓ Webhook: http://localhost:${PORT}/api/webhook ║
    ║  ✓ Status: http://localhost:${PORT}/api/status   ║
    ╚════════════════════════════════════════════╝
    `);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Encerrando gracefully...');
    server.close(() => {
        console.log('Servidor encerrado.');
        process.exit(0);
    });
});
