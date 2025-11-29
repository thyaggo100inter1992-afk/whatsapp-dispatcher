# 📡 API de Usuários Master - Exemplos de Uso

## 🔐 Autenticação

Todos os endpoints requerem:
- Header `Authorization: Bearer {TOKEN}`
- Usuário deve ter role `super_admin`

---

## 📋 ENDPOINTS DISPONÍVEIS

### 1️⃣ Listar Todos os Usuários Master

**Endpoint:** `GET /api/admin/master-users`

**cURL:**
```bash
curl -X GET http://localhost:3001/api/admin/master-users \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**JavaScript/Axios:**
```javascript
const response = await api.get('/admin/master-users');
console.log(response.data.data); // Array de usuários master
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "tenant_id": 5,
      "nome": "Master Access - NETT Sistemas",
      "email": "5@NETTSISTEMAS.COM.BR",
      "ativo": true,
      "created_at": "2024-11-28T10:00:00Z",
      "updated_at": "2024-11-28T10:00:00Z",
      "ultimo_login": "2024-11-28T15:30:00Z",
      "total_logins": 3,
      "tenant_nome": "Empresa XYZ",
      "tenant_slug": "empresa-xyz",
      "tenant_email": "contato@empresaxyz.com",
      "plano": "pro",
      "tenant_status": "active"
    }
  ],
  "total": 1
}
```

---

### 2️⃣ Buscar Usuário Master de um Tenant

**Endpoint:** `GET /api/admin/master-users/:tenantId`

**cURL:**
```bash
curl -X GET http://localhost:3001/api/admin/master-users/5 \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**JavaScript/Axios:**
```javascript
const tenantId = 5;
const response = await api.get(`/admin/master-users/${tenantId}`);
console.log(response.data.data); // Objeto do usuário master
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "tenant_id": 5,
    "nome": "Master Access - NETT Sistemas",
    "email": "5@NETTSISTEMAS.COM.BR",
    "ativo": true,
    "created_at": "2024-11-28T10:00:00Z",
    "updated_at": "2024-11-28T10:00:00Z",
    "ultimo_login": "2024-11-28T15:30:00Z",
    "total_logins": 3,
    "tenant_nome": "Empresa XYZ",
    "tenant_slug": "empresa-xyz"
  }
}
```

---

### 3️⃣ Criar Usuários Master Faltantes

**Endpoint:** `POST /api/admin/master-users/create-missing`

**cURL:**
```bash
curl -X POST http://localhost:3001/api/admin/master-users/create-missing \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**JavaScript/Axios:**
```javascript
const response = await api.post('/admin/master-users/create-missing');
console.log(response.data.message);
console.log(`Criados: ${response.data.created}`);
```

**Resposta:**
```json
{
  "success": true,
  "message": "3 usuário(s) master criado(s) com sucesso",
  "created": 3,
  "data": [
    {
      "tenant_id": 10,
      "tenant_nome": "Empresa ABC",
      "email": "10@NETTSISTEMAS.COM.BR"
    },
    {
      "tenant_id": 15,
      "tenant_nome": "Empresa DEF",
      "email": "15@NETTSISTEMAS.COM.BR"
    },
    {
      "tenant_id": 20,
      "tenant_nome": "Empresa GHI",
      "email": "20@NETTSISTEMAS.COM.BR"
    }
  ]
}
```

---

### 4️⃣ Alterar Senha de um Usuário Master

**Endpoint:** `PUT /api/admin/master-users/:id/change-password`

**cURL:**
```bash
curl -X PUT http://localhost:3001/api/admin/master-users/123/change-password \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "NovaSenhaForte123!"}'
```

**JavaScript/Axios:**
```javascript
const userId = 123;
const newPassword = 'NovaSenhaForte123!';

const response = await api.put(`/admin/master-users/${userId}/change-password`, {
  newPassword
});
console.log(response.data.message);
```

**Body:**
```json
{
  "newPassword": "NovaSenhaForte123!"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Senha do usuário master alterada com sucesso",
  "data": {
    "id": 123,
    "email": "5@NETTSISTEMAS.COM.BR",
    "tenant_id": 5
  }
}
```

---

### 5️⃣ Ativar/Desativar Usuário Master

**Endpoint:** `PUT /api/admin/master-users/:id/toggle-active`

**cURL:**
```bash
curl -X PUT http://localhost:3001/api/admin/master-users/123/toggle-active \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**JavaScript/Axios:**
```javascript
const userId = 123;

const response = await api.put(`/admin/master-users/${userId}/toggle-active`);
console.log(response.data.message);
console.log(`Novo status: ${response.data.data.ativo}`);
```

**Resposta (Desativar):**
```json
{
  "success": true,
  "message": "Usuário master desativado com sucesso",
  "data": {
    "id": 123,
    "email": "5@NETTSISTEMAS.COM.BR",
    "ativo": false
  }
}
```

**Resposta (Ativar):**
```json
{
  "success": true,
  "message": "Usuário master ativado com sucesso",
  "data": {
    "id": 123,
    "email": "5@NETTSISTEMAS.COM.BR",
    "ativo": true
  }
}
```

---

### 6️⃣ Obter Configuração

**Endpoint:** `GET /api/admin/master-users/config`

**cURL:**
```bash
curl -X GET http://localhost:3001/api/admin/master-users/config \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**JavaScript/Axios:**
```javascript
const response = await api.get('/admin/master-users/config');
console.log(response.data.data);
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "default_password": "master123@nettsistemas",
    "email_pattern": "{tenant_id}@NETTSISTEMAS.COM.BR",
    "auto_create": true
  }
}
```

---

## 🎯 EXEMPLOS PRÁTICOS

### Exemplo 1: Listar e Filtrar Masters Ativos

```javascript
async function listarMastersAtivos() {
  try {
    const response = await api.get('/admin/master-users');
    const masters = response.data.data;
    
    const ativos = masters.filter(m => m.ativo);
    
    console.log(`Total de masters: ${masters.length}`);
    console.log(`Masters ativos: ${ativos.length}`);
    
    ativos.forEach(master => {
      console.log(`- ${master.email} (Tenant: ${master.tenant_nome})`);
    });
  } catch (error) {
    console.error('Erro:', error.response?.data?.message);
  }
}
```

---

### Exemplo 2: Criar Masters para Novos Tenants

```javascript
async function verificarECriarMastersFaltantes() {
  try {
    console.log('Verificando tenants sem usuário master...');
    
    const response = await api.post('/admin/master-users/create-missing');
    
    if (response.data.created === 0) {
      console.log('✅ Todos os tenants já possuem usuário master');
    } else {
      console.log(`✅ ${response.data.created} usuário(s) master criado(s):`);
      response.data.data.forEach(item => {
        console.log(`  - Tenant ${item.tenant_id}: ${item.email}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.message);
  }
}
```

---

### Exemplo 3: Alterar Senha de Vários Masters

```javascript
async function alterarSenhaEmLote(userIds, novaSenha) {
  const resultados = [];
  
  for (const userId of userIds) {
    try {
      const response = await api.put(
        `/admin/master-users/${userId}/change-password`,
        { newPassword: novaSenha }
      );
      
      resultados.push({
        userId,
        success: true,
        email: response.data.data.email
      });
      
      console.log(`✅ Senha alterada: ${response.data.data.email}`);
    } catch (error) {
      resultados.push({
        userId,
        success: false,
        error: error.response?.data?.message
      });
      
      console.error(`❌ Erro no usuário ${userId}: ${error.response?.data?.message}`);
    }
  }
  
  return resultados;
}

// Uso:
const userIds = [123, 124, 125];
alterarSenhaEmLote(userIds, 'NovaSenhaForte123!');
```

---

### Exemplo 4: Desativar Masters de Tenants Inativos

```javascript
async function desativarMastersInativos() {
  try {
    // Buscar todos os masters
    const response = await api.get('/admin/master-users');
    const masters = response.data.data;
    
    // Filtrar masters de tenants inativos
    const mastersInativos = masters.filter(m => 
      m.tenant_status !== 'active' && m.ativo === true
    );
    
    console.log(`Encontrados ${mastersInativos.length} masters de tenants inativos`);
    
    // Desativar cada um
    for (const master of mastersInativos) {
      try {
        await api.put(`/admin/master-users/${master.id}/toggle-active`);
        console.log(`✅ Master desativado: ${master.email}`);
      } catch (error) {
        console.error(`❌ Erro ao desativar ${master.email}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.message);
  }
}
```

---

### Exemplo 5: Relatório de Uso

```javascript
async function gerarRelatorioUso() {
  try {
    const response = await api.get('/admin/master-users');
    const masters = response.data.data;
    
    const relatorio = {
      total: masters.length,
      ativos: masters.filter(m => m.ativo).length,
      inativos: masters.filter(m => !m.ativo).length,
      nuncaUsados: masters.filter(m => !m.ultimo_login).length,
      comAcessos: masters.filter(m => m.ultimo_login).length,
      totalLogins: masters.reduce((sum, m) => sum + (m.total_logins || 0), 0)
    };
    
    console.log('📊 Relatório de Uso dos Usuários Master:');
    console.log(`   Total de masters: ${relatorio.total}`);
    console.log(`   Ativos: ${relatorio.ativos}`);
    console.log(`   Inativos: ${relatorio.inativos}`);
    console.log(`   Nunca usados: ${relatorio.nuncaUsados}`);
    console.log(`   Com acessos: ${relatorio.comAcessos}`);
    console.log(`   Total de logins: ${relatorio.totalLogins}`);
    
    // Masters mais usados (top 5)
    const maisUsados = masters
      .filter(m => m.total_logins > 0)
      .sort((a, b) => b.total_logins - a.total_logins)
      .slice(0, 5);
    
    console.log('\n🏆 Top 5 Masters Mais Usados:');
    maisUsados.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.email} - ${m.total_logins} logins`);
    });
    
    return relatorio;
  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.message);
  }
}
```

---

## 🔐 Tratamento de Erros

### Erros Comuns:

**401 - Não Autenticado:**
```json
{
  "success": false,
  "message": "Usuário não autenticado"
}
```

**403 - Sem Permissão:**
```json
{
  "success": false,
  "message": "Acesso negado. Apenas super administradores podem acessar este recurso."
}
```

**404 - Não Encontrado:**
```json
{
  "success": false,
  "message": "Usuário master não encontrado para este tenant"
}
```

**400 - Dados Inválidos:**
```json
{
  "success": false,
  "message": "Senha inválida. Mínimo de 6 caracteres."
}
```

### Exemplo de Tratamento:

```javascript
try {
  const response = await api.put('/admin/master-users/123/change-password', {
    newPassword: 'nova'
  });
} catch (error) {
  if (error.response) {
    // Erro da API
    const status = error.response.status;
    const message = error.response.data.message;
    
    switch (status) {
      case 400:
        console.error('❌ Dados inválidos:', message);
        break;
      case 401:
        console.error('❌ Não autenticado. Faça login novamente.');
        break;
      case 403:
        console.error('❌ Sem permissão. Apenas super admins.');
        break;
      case 404:
        console.error('❌ Usuário não encontrado.');
        break;
      default:
        console.error('❌ Erro:', message);
    }
  } else {
    // Erro de rede
    console.error('❌ Erro de conexão:', error.message);
  }
}
```

---

## 📚 Recursos Adicionais

- **Documentação Completa:** `✅-SISTEMA-USUARIOS-MASTER-IMPLEMENTADO.md`
- **Guia Rápido:** `🚀-GUIA-RAPIDO-USUARIOS-MASTER.md`
- **Queries SQL:** `VERIFICAR-USUARIOS-MASTER.sql`

---

**🎯 Pronto para integrar!**

