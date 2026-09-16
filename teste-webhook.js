/**
 * Script para testar o webhook localmente
 * 
 * Uso:
 *   npm install axios (se ainda não tiver)
 *   node teste-webhook.js
 */

const http = require('http');

const testeCases = [
    {
        nome: "Teste 1: Mensagem simples",
        dados: {
            sender: "João Silva",
            message: "Oi, tudo bem?",
            isGroup: false
        }
    },
    {
        nome: "Teste 2: Mensagem com números",
        dados: {
            sender: "+55 11 99999-8888",
            message: "Preciso de informações sobre o produto",
            isGroup: false
        }
    },
    {
        nome: "Teste 3: Tentativa em grupo (deve ser rejeitada)",
        dados: {
            sender: "Grupo de Vendas",
            message: "Oi pessoal",
            isGroup: true
        }
    },
    {
        nome: "Teste 4: Mensagem longa",
        dados: {
            sender: "Maria",
            message: "Olá, gostaria de saber mais sobre os planos disponíveis. Tenho uma equipe de 5 pessoas e gostaríamos de um desconto especial.",
            isGroup: false
        }
    }
];

function enviarWebhook(dados) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(dados);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const resposta = JSON.parse(body);
                    resolve({
                        statusCode: res.statusCode,
                        resposta
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        resposta: body
                    });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function executarTestes() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║       🧪 Teste de Webhook - WhatsApp Panel             ║
║                                                          ║
║  Certifique-se de que o servidor está rodando:         ║
║  npm run dev                                            ║
╚══════════════════════════════════════════════════════════╝
    `);

    console.log(`\nConectando a http://localhost:3000...\n`);

    for (let i = 0; i < testeCases.length; i++) {
        const teste = testeCases[i];
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`${teste.nome}`);
        console.log(`${'─'.repeat(60)}`);

        console.log(`\n📤 Enviando:`);
        console.log(JSON.stringify(teste.dados, null, 2));

        try {
            const resultado = await enviarWebhook(teste.dados);

            console.log(`\n✅ Resposta (Status: ${resultado.statusCode}):`);
            console.log(JSON.stringify(resultado.resposta, null, 2));

            // Delay entre testes
            if (i < testeCases.length - 1) {
                console.log(`\n⏳ Aguardando 2 segundos antes do próximo teste...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (erro) {
            console.log(`\n❌ ERRO: ${erro.message}`);
            console.log(`\n⚠️  Certifique-se de que o servidor está rodando:`);
            console.log(`   npm run dev`);
            process.exit(1);
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`\n✨ Todos os testes completados!`);
    console.log(`\n📊 Próximos passos:`);
    console.log(`   1. Abra http://localhost:3000 no seu navegador`);
    console.log(`   2. Você deve ver as mensagens de teste listadas`);
    console.log(`   3. Clique em uma conversa para ver os detalhes`);
    console.log(`   4. Digite uma resposta e clique "Enviar"`);
    console.log(`\n`);
}

executarTestes().catch(erro => {
    console.error('Erro fatal:', erro);
    process.exit(1);
});
