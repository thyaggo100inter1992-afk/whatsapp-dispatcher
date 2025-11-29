# Sistema de Arquivos Públicos

Sistema completo para gerenciamento de arquivos públicos com links compartilháveis.

## 🎯 Funcionalidades

### Upload
- ✅ Drag & Drop para upload rápido
- ✅ Clique para selecionar arquivos
- ✅ Suporte para múltiplos formatos:
  - **Imagens**: JPG, PNG, GIF, WebP, SVG, etc
  - **Vídeos**: MP4, MOV, AVI, MKV, etc
  - **PDFs**: Documentos PDF

### Gerenciamento
- ✅ **Visualização em Grid**: Cards com preview dos arquivos
- ✅ **Preview Visual**: Miniaturas de imagens, vídeos e ícones para PDFs
- ✅ **Copiar Link**: Botão para copiar link público com um clique
- ✅ **Editar Descrição**: Adicione descrições aos arquivos
- ✅ **Deletar**: Remove arquivo do Cloudinary e banco de dados
- ✅ **Informações**: Tamanho do arquivo e data de upload
- ✅ **Link Público**: URL permanente e acessível de qualquer lugar

## 📁 Estrutura do Banco de Dados

### Tabela: `public_files`

| Campo            | Tipo      | Descrição                                    |
|------------------|-----------|----------------------------------------------|
| id               | SERIAL    | ID único do arquivo                          |
| original_name    | VARCHAR   | Nome original do arquivo                     |
| cloudinary_id    | VARCHAR   | ID único no Cloudinary                       |
| cloudinary_url   | TEXT      | URL HTTP do arquivo                          |
| secure_url       | TEXT      | URL HTTPS do arquivo (use esta)              |
| file_type        | VARCHAR   | Tipo do arquivo (image, video, raw)          |
| file_size        | BIGINT    | Tamanho em bytes                             |
| mime_type        | VARCHAR   | Tipo MIME (image/png, video/mp4, etc)        |
| description      | TEXT      | Descrição opcional                           |
| uploaded_by      | INTEGER   | ID do usuário que fez upload                 |
| created_at       | TIMESTAMP | Data/hora de criação                         |
| updated_at       | TIMESTAMP | Data/hora da última atualização              |

## 🚀 Como Usar

### 1. Acessar o Sistema
```
http://localhost:3000/admin/arquivos
```
- Apenas Super Admins têm acesso
- Faça login com credenciais de super admin

### 2. Fazer Upload

#### Método 1: Drag & Drop
1. Arraste um ou mais arquivos
2. Solte na área de upload (borda roxa)
3. Aguarde o upload completar

#### Método 2: Selecionar Arquivo
1. Clique na área de upload
2. Selecione o arquivo no seu computador
3. Aguarde o upload completar

### 3. Gerenciar Arquivos

#### Copiar Link Público
1. Localize o arquivo no grid
2. Clique no botão **AZUL** (ícone de copiar)
3. O link é copiado automaticamente
4. Cole onde quiser: chat, email, site, etc

**Exemplo de link gerado:**
```
https://res.cloudinary.com/seu-cloud/image/upload/v1234567890/public-files/arquivo.jpg
```

#### Editar Descrição
1. Clique no botão **AMARELO** (ícone de editar)
2. Digite a descrição
3. Clique no ✓ (check) para salvar
4. Ou clique no ✕ para cancelar

#### Deletar Arquivo
1. Clique no botão **VERMELHO** (ícone de lixeira)
2. Confirme a exclusão
3. Arquivo é removido do Cloudinary e banco de dados

### 4. Compartilhar Links

Os links gerados são **públicos e permanentes**:
- ✅ Funcionam em qualquer navegador
- ✅ Não exigem login ou autenticação
- ✅ Podem ser usados em:
  - Sites e blogs
  - E-mails
  - WhatsApp, Telegram, etc
  - Redes sociais
  - Aplicativos

## 🔒 Segurança

### Acesso ao Painel
- Apenas **Super Admins** podem acessar
- Requer autenticação com JWT
- Middleware `requireSuperAdmin` protege as rotas

### Arquivos Públicos
- Os links gerados são públicos por design
- Qualquer pessoa com o link pode acessar
- Ideal para conteúdo que você deseja compartilhar
- **Não faça upload de arquivos confidenciais**

## 📊 Casos de Uso

### 1. Marketing e Comunicação
```
- Banners promocionais
- Vídeos de produtos
- Catálogos em PDF
- Logos e imagens institucionais
```

### 2. Suporte ao Cliente
```
- Manuais em PDF
- Vídeos tutoriais
- Imagens de produtos
- Guias de instalação
```

### 3. Compartilhamento Rápido
```
- Enviar arquivos para clientes via WhatsApp
- Compartilhar imagens em e-mails
- Postar conteúdo em redes sociais
- Integrar mídia em sites externos
```

### 4. Backup de Mídia
```
- Armazenamento seguro na nuvem
- Acesso rápido via CDN
- Redundância automática
- Histórico de uploads
```

## 🎨 Interface

### Área de Upload
- **Drag & Drop**: Borda roxa tracejada
- **Loading**: Animação durante upload
- **Feedback**: Mensagem de sucesso/erro

### Grid de Arquivos
- **Cards Responsivos**: 1-4 colunas dependendo da tela
- **Preview Visual**: Imagem/vídeo ou ícone
- **Informações**: Nome, tamanho, data
- **Ações**: 3 botões (copiar, editar, deletar)
- **Link Visível**: Campo com URL completa

### Cores dos Botões
- 🔵 **Azul**: Copiar link (muda para verde após copiar)
- 🟡 **Amarelo**: Editar descrição
- 🔴 **Vermelho**: Deletar arquivo

## 🛠️ Tecnologias

### Backend
- **Express.js**: Rotas e controllers
- **Cloudinary SDK**: Upload e storage
- **PostgreSQL**: Metadados dos arquivos
- **express-fileupload**: Processamento de uploads

### Frontend
- **Next.js**: Framework React
- **Tailwind CSS**: Estilização
- **React Icons**: Ícones
- **date-fns**: Formatação de datas

### Cloud
- **Cloudinary**: Armazenamento e CDN
- **Folder**: `public-files/`
- **Otimização**: Automática
- **Backup**: Redundante

## 📝 Exemplos de API

### Upload de Arquivo
```bash
POST /api/admin/files/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: [binary data]
description: "Descrição opcional"
```

### Listar Arquivos
```bash
GET /api/admin/files
Authorization: Bearer {token}
```

### Atualizar Descrição
```bash
PUT /api/admin/files/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Nova descrição"
}
```

### Deletar Arquivo
```bash
DELETE /api/admin/files/:id
Authorization: Bearer {token}
```

## 🔄 Fluxo Completo

1. **Upload**
   - Usuário seleciona arquivo
   - Frontend envia para backend
   - Backend faz upload para Cloudinary
   - Backend salva metadados no PostgreSQL
   - Retorna informações do arquivo

2. **Listagem**
   - Frontend requisita lista de arquivos
   - Backend busca do PostgreSQL
   - Inclui informações do uploader
   - Exibe em grid responsivo

3. **Compartilhamento**
   - Usuário clica em "Copiar Link"
   - Link HTTPS é copiado
   - Link pode ser usado em qualquer lugar
   - Cloudinary entrega via CDN global

4. **Deleção**
   - Usuário confirma exclusão
   - Backend deleta do Cloudinary
   - Backend deleta do PostgreSQL
   - Arquivo removido permanentemente

## 💡 Dicas

### Performance
- Os arquivos são entregues via CDN global
- Cache automático para acesso rápido
- Otimização automática de imagens

### Organização
- Use descrições descritivas
- Nomeie arquivos adequadamente
- Delete arquivos não utilizados

### Limites
- Tamanho máximo: 50MB (configurável)
- Formatos aceitos: Definidos no controller
- Armazenamento: Depende do plano Cloudinary

## 🆘 Troubleshooting

### Upload Falha
- Verifique o tamanho do arquivo (máx 50MB)
- Confirme que é um formato suportado
- Verifique as credenciais do Cloudinary

### Link Não Funciona
- Use sempre `secure_url` (HTTPS)
- Verifique se arquivo não foi deletado
- Confirme que Cloudinary está configurado

### Erro de Permissão
- Apenas Super Admins têm acesso
- Faça login com conta adequada
- Verifique o token JWT

## 📱 Acesso Móvel

A interface é **totalmente responsiva**:
- ✅ Funciona em smartphones
- ✅ Funciona em tablets
- ✅ Grid adaptável
- ✅ Botões grandes para toque
- ✅ Upload touch-friendly

---

**Sistema criado para facilitar o compartilhamento de arquivos públicos com links permanentes e acessíveis de qualquer lugar! 🚀**



