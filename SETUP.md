# 🚀 Guia de Setup - Painel WhatsApp + AutoResponder

## Visão Geral da Arquitetura

```
[Celular - AutoResponder] 
         ↓ (Webhook)
[Backend Node.js - port 3000]
         ↑↓ (Socket.io)
[Painel Web - Operadores]
```

---

## 📋 Pré-requisitos

- ✅ Node.js 16+ instalado ([download](https://nodejs.org))
- ✅ npm ou yarn
- ✅ AutoResponder for WA (versão paga com suporte a Webhook) instalado no celular
- ✅ Um servidor pra hospedar o backend (Render, Railway, ou local)

---

## 🔧 Instalação Rápida

### Passo 1: Criar Pasta do Projeto

```bash
mkdir whatsapp-panel
cd whatsapp-panel
```

### Passo 2: Copiar Arquivos

Copie os seguintes arquivos para a pasta:
- `server.js`
- `painel-whatsapp.html`
- `package.json`
- `.env.example`

### Passo 3: Instalar Dependências

```bash
npm install
```

### Passo 4: Criar Arquivo .env

```bash
cp .env.example .env
```

Edite `.env` e ajuste conforme necessário (opcionalmente, pode deixar o padrão por enquanto).

### Passo 5: Iniciar o Servidor

**Desenvolvimento (com auto-reload):**
```bash
npm run dev
```

**Produção:**
```bash
npm start
```

Você verá:
```
╔════════════════════════════════════════════╗
║  🚀 Servidor WhatsApp Panel Iniciado      ║
║  📍 http://localhost:3000                 ║
║  ✓ Webhook: http://localhost:3000/api/webhook
║  ✓ Status: http://localhost:3000/api/status
╚════════════════════════════════════════════╝
```

### Passo 6: Abrir o Painel

1. Abra seu navegador
2. Vá para: `http://localhost:3000`
3. Será pedido seu nome de operador - digite seu nome

**Pronto!** O painel está rodando e esperando por mensagens.

---

## ⚙️ Configurar AutoResponder para Enviar Webhooks

### No seu Celular (AutoResponder for WA):

1. **Abra AutoResponder**
2. **Crie uma Nova Regra**
   - Trigger: "Todas as mensagens"
   - Action: "Webhook / Servidor Próprio"

3. **Preencha a URL do Webhook**
   - Se for local: `http://seu-ip-local:3000/api/webhook`
   - Se for servidor remoto: `https://seu-dominio.com/api/webhook`

   > 💡 **Para conseguir seu IP local:**
   > ```bash
   > ipconfig getifaddr en0  # Mac
   > # ou
   > hostname -I  # Linux
   > # ou
   > ipconfig  # Windows (procura por "IPv4 Address")
   > ```

4. **Teste a Regra**
   - Mande uma mensagem de teste do WhatsApp pro seu número
   - Veja se aparecer no painel com status "Verde"

---

## 🚀 Deploy em Servidor Remoto

### Opção 1: Render (Recomendado - Fácil)

1. Acesse [render.com](https://render.com)
2. Clique em "New Web Service"
3. Conecte seu repositório GitHub (ou faça upload manual)
4. Preencha:
   - **Name**: whatsapp-panel
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. Deploy automático! 🎉

**Webhook URL do Render:**
```
https://seu-app-render.onrender.com/api/webhook
```

### Opção 2: Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project" → "Deploy from GitHub"
3. Conecte seu repositório
4. Railway detecta `package.json` automaticamente
5. Deploy! 🎉

---

## 📱 Sincronizar Múltiplos Operadores

Se você tem uma equipe:

1. **Operador 1** abre: `http://seu-ip:3000/painel-whatsapp.html`
2. **Operador 2** abre: `http://seu-ip:3000/painel-whatsapp.html`
3. Ambos digitam seus nomes
4. **Automático:** quando uma mensagem chega, aparece verde para os dois
5. **Quando um clica:** fica vermelho pra indicar que já tá sendo atendido

---

## 🔗 Integração Completa com AutoResponder

### Fluxo Atual (Funciona):
```
1. Cliente manda mensagem no WhatsApp
2. AutoResponder lê e envia webhook
3. Painel recebe e mostra (Verde)
4. Operador clica (fica Vermelho)
5. Operador digita resposta
6. Resposta aparece no painel
```

### Falta Implementar (Próxima Fase):
```
7. Resposta é enviada automaticamente pro AutoResponder
8. AutoResponder envia a resposta pro cliente via WhatsApp
```

Para isso, você terá 2 opções:

**Opção A: AutoResponder tem suporte a "Response Callback"**
- Se ele tiver, ele avisará seu backend quando quiser a resposta
- Você responde com a mensagem que o operador digitou

**Opção B: Criar um app Android leve**
- Que lê a fila de respostas do seu banco de dados
- E manda pro WhatsApp via Intent

---

## 📊 Testar o Sistema

### 1. Verificar Status do Servidor

```bash
curl http://localhost:3000/api/status
```

Resposta esperada:
```json
{
  "status": "online",
  "operadores_online": 1,
  "conversas_aguardando": 0,
  "conversas_em_atendimento": 0,
  "total_conversas": 0
}
```

### 2. Simular Webhook (teste rápido)

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "João Silva",
    "message": "Oi, tudo bem?",
    "isGroup": false
  }'
```

Você deve ver aparecer no painel em tempo real!

### 3. Ver Todas as Conversas

```bash
curl http://localhost:3000/api/conversas
```

---

## 🐛 Troubleshooting

### "Conexão recusada em localhost:3000"
- ✓ Servidor está rodando? (`npm run dev`)
- ✓ Porta 3000 está livre? 
  - Se não, mude em `.env`: `PORT=3001`

### "Webhook não está funcionando"
- ✓ IP local está correto? (use `ipconfig` / `ifconfig`)
- ✓ AutoResponder tem permissão de internet? (Configurações > Permissões)
- ✓ Celular e computador estão na mesma rede WiFi?

### "Painel não sincroniza entre operadores"
- ✓ Todos abriram `http://mesmo-ip:3000`?
- ✓ Socket.io consegue conectar? (vê no console do navegador)
- ✓ Servidor tem `socket.io` instalado? (`npm list socket.io`)

---

## 📁 Estrutura de Arquivos Final

```
whatsapp-panel/
├── server.js                 # Backend Node.js
├── painel-whatsapp.html      # Painel web (abra no navegador)
├── package.json              # Dependências
├── .env                       # Configurações (não compartilhe!)
├── .env.example              # Exemplo (compartilhe este)
└── SETUP.md                  # Este arquivo
```

---

## 🔐 Segurança (Importante!)

### Nunca compartilhe:
- ❌ Arquivo `.env` (contém secrets)
- ❌ Arquivo `.env` no GitHub

### Use variáveis de ambiente:
```javascript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
```

### Validar webhooks (Próxima Versão):
```javascript
if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

---

## 🎯 Próximos Passos

1. **Integração Completa com AutoResponder**
   - Fazer respostas irem automaticamente pro WhatsApp
   - Você precisa descobrir como AutoResponder recebe as respostas

2. **Banco de Dados Permanente**
   - Mude de in-memory pra SQLite / PostgreSQL / Firebase
   - Assim histórico não se perde quando servidor reinicia

3. **Autenticação**
   - Login com senha para operadores
   - Dashboard de admin

4. **Relatórios**
   - Quantas mensagens por operador
   - Tempo médio de resposta
   - Satisfação dos clientes

---

## 📞 Dúvidas?

- 📖 Leia a documentação do Socket.io: https://socket.io/docs
- 🔧 Documentação do Express: https://expressjs.com
- 🤖 AutoResponder Docs: https://autoresponder.ai/docs

---

**Boa sorte! Você consegue! 🚀**
