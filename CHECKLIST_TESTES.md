# ✅ Checklist de Testes

Use esta lista para verificar se tudo está funcionando corretamente!

---

## 🔧 Pré-requisitos

### Instalações
- [ ] Node.js v18+ instalado
- [ ] PostgreSQL v14+ instalado e rodando
- [ ] Redis v6+ instalado e rodando
- [ ] Git instalado (para clonar)

### Verificações Rápidas
```bash
# Verificar Node.js
node --version  # Deve mostrar v18 ou superior
npm --version

# Verificar PostgreSQL
psql --version
psql -U postgres -c "SELECT version();"

# Verificar Redis
redis-cli ping  # Deve retornar: PONG
```

---

## 📦 Instalação

### Backend
- [ ] Entrou na pasta `backend`
- [ ] Executou `npm install` sem erros
- [ ] Criou arquivo `.env` com configurações corretas
- [ ] Banco de dados `whatsapp_dispatcher` foi criado
- [ ] Executou `npm run migrate` com sucesso
- [ ] Pasta `uploads/media` foi criada

### Frontend
- [ ] Entrou na pasta `frontend`
- [ ] Executou `npm install` sem erros
- [ ] Criou arquivo `.env.local` com a URL da API
- [ ] Pasta `.next` foi criada após build

---

## 🚀 Inicialização

### Backend
- [ ] Executou `npm run dev`
- [ ] Servidor iniciou na porta 3001
- [ ] Mensagem "Database connected successfully!" apareceu
- [ ] Mensagem "Server running on port 3001" apareceu
- [ ] Não há erros no console

### Frontend
- [ ] Executou `npm run dev`
- [ ] Servidor iniciou na porta 3000
- [ ] Mensagem "ready - started server..." apareceu
- [ ] Não há erros no console
- [ ] Consegue acessar http://localhost:3000

---

## 🌐 Testes de API (Backend)

### Health Check
```bash
curl http://localhost:3001/api/health
```
- [ ] Retornou status 200
- [ ] Resposta contém `"success": true`

### Listar Contas (vazio inicialmente)
```bash
curl http://localhost:3001/api/whatsapp-accounts
```
- [ ] Retornou status 200
- [ ] Resposta contém `"data": []`

### Listar Campanhas (vazio inicialmente)
```bash
curl http://localhost:3001/api/campaigns
```
- [ ] Retornou status 200
- [ ] Resposta contém `"data": []`

---

## 🎨 Testes de Frontend

### Dashboard (/)
- [ ] Página carrega sem erros
- [ ] Logo do WhatsApp aparece
- [ ] Menu de navegação aparece
- [ ] Botão "Criar Campanha" aparece
- [ ] Botão "Enviar Mensagem Imediata" aparece
- [ ] Seção "Primeiros Passos" aparece
- [ ] Design verde escuro está aplicado

### Configurações (/configuracoes)
- [ ] Página carrega
- [ ] Botão "Adicionar Conta" aparece
- [ ] Mensagem "Nenhuma conta configurada" aparece (inicialmente)

### Campanhas (/campanhas)
- [ ] Página carrega
- [ ] Botão "Nova Campanha" aparece
- [ ] Mensagem "Nenhuma campanha criada" aparece (inicialmente)

### Criar Campanha (/campanha/criar)
- [ ] Página carrega
- [ ] Formulário de nome da campanha aparece
- [ ] Botão "Adicionar Template" aparece
- [ ] Área de contatos aparece
- [ ] Seção de agendamento aparece
- [ ] Seção de controles de pausa aparece

### Enviar Mensagem (/mensagem/enviar)
- [ ] Página carrega
- [ ] Seletor de conta aparece
- [ ] Campo de número do destinatário aparece
- [ ] Área de busca de templates aparece

---

## 🔐 Testes de Configuração de Conta

### Adicionar Conta WhatsApp
- [ ] Clicou em "Adicionar Conta"
- [ ] Formulário apareceu
- [ ] Todos os campos estão visíveis:
  - [ ] Nome/Identificação
  - [ ] Número de Telefone
  - [ ] Access Token
  - [ ] Phone Number ID
  - [ ] Business Account ID
  - [ ] Checkbox "Ativar esta conta"

### Preenchimento
- [ ] Preencheu todos os campos obrigatórios
- [ ] Checkbox "Ativar" marcado por padrão

### Testar Conexão
- [ ] Botão "Testar Conexão" funciona
- [ ] (Com credenciais válidas) Mostra mensagem de sucesso
- [ ] (Com credenciais inválidas) Mostra mensagem de erro

### Salvar Conta
- [ ] Clicou em "Salvar"
- [ ] Conta apareceu na lista
- [ ] Badge "ATIVO" aparece
- [ ] Número de telefone está correto

### Editar Conta
- [ ] Clicou no botão de editar
- [ ] Formulário abriu com dados preenchidos
- [ ] Alterou algum campo
- [ ] Salvou com sucesso
- [ ] Mudanças refletem na lista

### Ativar/Desativar
- [ ] Clicou no botão de ativar/desativar
- [ ] Status mudou corretamente
- [ ] Badge mudou de "ATIVO" para "INATIVO" ou vice-versa

### Deletar Conta
- [ ] Clicou em deletar
- [ ] Popup de confirmação apareceu
- [ ] Confirmou a exclusão
- [ ] Conta foi removida da lista

---

## 📤 Testes de Upload de Mídia

### Upload de Imagem
- [ ] Arrastou arquivo de imagem
- [ ] Sistema aceitou (JPG, PNG, GIF, WebP)
- [ ] Preview da imagem apareceu
- [ ] Nome do arquivo aparece
- [ ] Tamanho do arquivo aparece
- [ ] Botão "Remover" funciona

### Upload de Vídeo
- [ ] Selecionou arquivo de vídeo (MP4)
- [ ] Sistema aceitou
- [ ] Ícone de vídeo apareceu
- [ ] Informações do arquivo aparecem

### Upload de Áudio
- [ ] Selecionou arquivo de áudio (MP3, OGG)
- [ ] Sistema aceitou
- [ ] Ícone de áudio apareceu

### Upload de Documento
- [ ] Selecionou PDF
- [ ] Sistema aceitou
- [ ] Ícone de documento apareceu

### Validações
- [ ] Arquivo muito grande (>10MB) foi rejeitado
- [ ] Tipo não permitido (.exe, .zip) foi rejeitado
- [ ] Mensagem de erro aparece corretamente

---

## 📅 Testes de Criar Campanha

### Informações Básicas
- [ ] Preencheu nome da campanha
- [ ] Nome aceito e salvo

### Adicionar Templates
- [ ] Clicou em "Adicionar Template"
- [ ] Card de template apareceu
- [ ] Seletor de número de origem funciona
- [ ] Após selecionar conta, templates carregam
- [ ] Consegue selecionar template
- [ ] Pode adicionar múltiplos templates

### Upload de Mídia por Template
- [ ] Cada template tem área de upload separada
- [ ] Upload funciona independentemente
- [ ] Pode adicionar mídia diferente para cada template

### Remover Template
- [ ] Botão de remover funciona
- [ ] Template é removido da lista

### Lista de Contatos
- [ ] Colou contatos no formato:
  ```
  5562999998888, João Silva
  5511888887777, Maria Santos
  ```
- [ ] Contador de contatos aparece
- [ ] Número de contatos está correto

### Agendamento
- [ ] Pode selecionar data futura
- [ ] Pode selecionar hora
- [ ] Campos de horário de funcionamento funcionam

### Controles de Pausa
- [ ] Campos de atraso aceitam números
- [ ] Campos de pausa aceitam números
- [ ] Valores padrão estão preenchidos

### Estimativa de Tempo
- [ ] Após adicionar contatos, estimativa aparece
- [ ] Tempo calculado parece razoável
- [ ] Atualiza ao mudar delays

### Criar Campanha
- [ ] Clicou em "Iniciar Campanha Agora"
- [ ] (Ou) Clicou em "Agendar Campanha"
- [ ] Mensagem de sucesso apareceu
- [ ] Redirecionou para lista de campanhas
- [ ] Campanha aparece na lista

---

## 💬 Testes de Enviar Mensagem Imediata

### Seleção de Conta
- [ ] Lista de contas aparece
- [ ] Consegue selecionar uma conta
- [ ] Apenas contas ativas aparecem

### Número do Destinatário
- [ ] Campo aceita número
- [ ] Validação de formato funciona
- [ ] Placeholder está claro

### Busca de Templates
- [ ] Campo de busca funciona
- [ ] Templates são filtrados ao digitar
- [ ] Campo "Excluir" funciona
- [ ] Templates excluídos somem da lista

### Lista de Templates
- [ ] Templates aparecem em cards
- [ ] Badges (UTILITY, APPROVED) aparecem
- [ ] Consegue selecionar um template
- [ ] Template selecionado fica destacado

### Upload de Mídia
- [ ] Área de upload aparece
- [ ] Upload funciona
- [ ] Preview aparece

### Resumo
- [ ] Seção de resumo aparece
- [ ] Mostra conta selecionada
- [ ] Mostra número do destinatário
- [ ] Mostra template selecionado
- [ ] Mostra mídia (se anexada)

### Enviar
- [ ] Botão "Enviar Mensagem Agora" funciona
- [ ] Mensagem de sucesso aparece
- [ ] (Com credenciais válidas) Mensagem é enviada

---

## 📊 Testes de Monitoramento

### Lista de Campanhas
- [ ] Campanhas criadas aparecem
- [ ] Status aparece (Pendente, Em Execução, Concluída)
- [ ] Barra de progresso funciona
- [ ] Contadores aparecem:
  - [ ] Total
  - [ ] Enviadas
  - [ ] Entregues
  - [ ] Lidas
  - [ ] Falhas

### Atualizações em Tempo Real
- [ ] Durante envio, progresso atualiza sozinho
- [ ] Contadores aumentam automaticamente
- [ ] Não precisa recarregar página
- [ ] WebSocket está conectado (verificar console)

---

## 🔄 Testes de Sistema de Filas

### Backend
Verificar logs no terminal do backend durante envio:

- [ ] Mensagens "Processing message..." aparecem
- [ ] Mensagens "Message sent successfully" aparecem
- [ ] Não há erros críticos

### Redis
```bash
# Verificar filas
redis-cli
> KEYS *queue*
```
- [ ] Chaves de filas existem
- [ ] Jobs estão sendo processados

### PostgreSQL
```sql
-- Conectar ao banco
psql -U postgres -d whatsapp_dispatcher

-- Ver mensagens
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
```
- [ ] Mensagens estão sendo salvas
- [ ] Status está sendo atualizado
- [ ] Timestamps estão corretos

---

## 🧪 Testes de Integração Completa

### Fluxo 1: Envio Imediato
1. [ ] Configurou conta WhatsApp
2. [ ] Testou conexão (sucesso)
3. [ ] Enviou mensagem imediata
4. [ ] Mensagem foi enviada
5. [ ] Status atualizado no banco
6. [ ] Confirmação apareceu no frontend

### Fluxo 2: Campanha Simples
1. [ ] Criou campanha com 1 template
2. [ ] Adicionou 3 contatos
3. [ ] Iniciou campanha
4. [ ] 3 mensagens foram enviadas
5. [ ] Progresso 100%
6. [ ] Status "Concluída"

### Fluxo 3: Campanha com Múltiplos Templates
1. [ ] Criou campanha
2. [ ] Adicionou 3 templates diferentes
3. [ ] Adicionou 9 contatos
4. [ ] Iniciou campanha
5. [ ] Templates foram rotacionados
6. [ ] Cada conta enviou 3 mensagens

### Fluxo 4: Campanha Agendada
1. [ ] Criou campanha
2. [ ] Agendou para 5 minutos no futuro
3. [ ] Campanha ficou com status "Agendada"
4. [ ] Após 5 minutos, campanha iniciou
5. [ ] Status mudou para "Em Execução"
6. [ ] Mensagens foram enviadas

### Fluxo 5: Upload e Envio de Mídia
1. [ ] Criou campanha
2. [ ] Adicionou template com mídia (imagem)
3. [ ] Fez upload da imagem
4. [ ] Iniciou campanha
5. [ ] Mensagem com imagem foi enviada

---

## 🐛 Testes de Tratamento de Erros

### Erro: Token Inválido
- [ ] Configurou conta com token errado
- [ ] Tentou enviar mensagem
- [ ] Erro foi capturado
- [ ] Mensagem de erro clara apareceu
- [ ] Status "failed" foi salvo

### Erro: Template Não Existe
- [ ] Tentou enviar com template inexistente
- [ ] Erro foi tratado
- [ ] Mensagem explicativa apareceu

### Erro: Número Inválido
- [ ] Tentou enviar para número inválido
- [ ] Erro foi capturado
- [ ] Retry foi tentado
- [ ] Após 3 falhas, marcado como "failed"

### Erro: Sem Conexão com Internet
- [ ] Desconectou internet
- [ ] Tentou enviar mensagem
- [ ] Erro foi tratado
- [ ] Ao reconectar, retry funcionou

---

## 🔒 Testes de Segurança

### Validações
- [ ] Campos obrigatórios validam
- [ ] Tipos de arquivo são validados
- [ ] Tamanhos de arquivo são limitados
- [ ] SQL Injection: Testou caracteres especiais (não gera erro)

### CORS
- [ ] Backend aceita requisições do frontend
- [ ] Outras origens são bloqueadas

### Tokens
- [ ] Access tokens não aparecem em logs do frontend
- [ ] Tokens são armazenados apenas no backend

---

## 📈 Testes de Performance

### Pequena Escala
- [ ] Enviou 10 mensagens
- [ ] Todas foram enviadas
- [ ] Tempo razoável (< 1 minuto com delay de 2-5s)

### Média Escala
- [ ] Enviou 100 mensagens
- [ ] Sistema não travou
- [ ] Frontend continuou responsivo
- [ ] Progresso atualizou corretamente

### Pausas
- [ ] Configurou pausa a cada 10 mensagens
- [ ] Sistema pausou corretamente
- [ ] Retomou após tempo configurado

---

## 🎨 Testes de UI/UX

### Design
- [ ] Cores verdes escuras estão aplicadas
- [ ] Tema consistente em todas as páginas
- [ ] Ícones são intuitivos
- [ ] Badges têm cores adequadas

### Responsividade
- [ ] Testou em tela pequena (< 768px)
- [ ] Menu colapsou corretamente
- [ ] Cards adaptaram layout
- [ ] Formulários são usáveis em mobile

### Animações
- [ ] Transições são suaves
- [ ] Fade in funciona nas páginas
- [ ] Hover effects funcionam
- [ ] Loading spinners aparecem quando necessário

---

## ✅ Resultado Final

### Funcionalidades Principais
- [ ] ✅ Configurar contas WhatsApp
- [ ] ✅ Enviar mensagem imediata
- [ ] ✅ Criar campanha
- [ ] ✅ Múltiplos templates
- [ ] ✅ Upload de mídia
- [ ] ✅ Agendamento
- [ ] ✅ Monitoramento em tempo real
- [ ] ✅ Sistema de filas funciona
- [ ] ✅ Rotação de templates
- [ ] ✅ Pausas automáticas

### Sistema Geral
- [ ] ✅ Backend estável
- [ ] ✅ Frontend responsivo
- [ ] ✅ Banco de dados persistente
- [ ] ✅ Filas processando
- [ ] ✅ WebSocket conectado
- [ ] ✅ Sem erros críticos

---

## 🎉 Conclusão

**Se todos (ou a maioria) dos itens estão marcados: Parabéns! Sistema está funcionando perfeitamente! 🚀**

### Próximos Passos:
1. Fazer backup do banco de dados
2. Configurar deploy em produção
3. Criar mais templates no Meta Business
4. Começar envios reais (com cuidado!)

---

**Boa sorte com seus disparos! 📱✉️**


