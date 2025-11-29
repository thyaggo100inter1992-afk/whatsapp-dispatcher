# ✅ CONSULTA NOVA VIDA - QUANDO NÃO ENCONTRADO NA BUSCA

## 🎯 FLUXO IMPLEMENTADO

Quando a **Busca Rápida** não encontrar nenhum cadastro, o sistema agora:

1. ❌ **Mostra modal**: "Nenhum Cadastro Encontrado"
2. ❓ **Pergunta**: "Deseja consultar na Nova Vida?"
3. ✅ **SIM** → Faz consulta na Nova Vida
4. ❌ **NÃO** → Fecha o modal

---

## 📊 FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│  1. VOCÊ BUSCA: João Silva                                  │
│     (Nome que não existe no sistema)                        │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  2. SISTEMA BUSCA NO BANCO                                  │
│     → Nome: 0 resultados                                    │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  3. MODAL APARECE:                                          │
│                                                              │
│     ╔═══════════════════════════════════════════════════╗  │
│     ║  ❌ Nenhum Cadastro Encontrado                    ║  │
│     ║                                                    ║  │
│     ║  Não encontramos nenhum cadastro para:            ║  │
│     ║  "João Silva"                                     ║  │
│     ║                                                    ║  │
│     ║  Deseja consultar na Nova Vida?                   ║  │
│     ║                                                    ║  │
│     ║  [ ❌ Não ]  [ ✅ Sim ]                            ║  │
│     ╚═══════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────┘
                 ↓
        ┌────────┴────────┐
        │                 │
      ❌ NÃO            ✅ SIM
        │                 │
        ↓                 ↓
┌───────────────┐  ┌─────────────────────────────┐
│ FECHA MODAL   │  │ VERIFICA O QUE FOI BUSCADO │
└───────────────┘  └─────────┬───────────────────┘
                             ↓
                   ┌─────────┴─────────┐
                   │                   │
            É CPF/CNPJ?         NÃO É CPF/CNPJ?
           (11 ou 14 dígitos)   (nome, telefone)
                   │                   │
                   ↓                   ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ CONSULTA DIRETO  │  │ MODAL PEDE CPF:  │
        │ NA NOVA VIDA     │  │                   │
        │ COM O DOCUMENTO  │  │ 📄 Digite o CPF  │
        └────────┬─────────┘  │    ou CNPJ       │
                 │             └────────┬─────────┘
                 ↓                      ↓
        ┌──────────────────────────────────────┐
        │ 🔍 CONSULTANDO NA NOVA VIDA...       │
        └────────┬─────────────────────────────┘
                 ↓
        ┌──────────────────────────────────────┐
        │ ✅ Consulta realizada!               │
        │ 💾 Dados salvos automaticamente!     │
        │ 📊 Mostra dados do cliente           │
        └──────────────────────────────────────┘
```

---

## 🧪 EXEMPLOS PRÁTICOS

### Exemplo 1: Busca por CPF não cadastrado

```
1. Digite: 12345678901
2. ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ✅ Sim
5. 🔍 Sistema consulta DIRETO na Nova Vida (já tem o CPF)
6. ✅ Dados retornados e salvos automaticamente
7. 📊 Modal mostra os dados do cliente
```

**Observação**: Se buscou por CPF/CNPJ válido, **NÃO pede CPF de novo**! Consulta direto! 🚀

---

### Exemplo 2: Busca por Nome não cadastrado

```
1. Digite: João Silva
2. ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ✅ Sim
5. 📄 Sistema pede: "Digite o CPF ou CNPJ"
6. Digite: 12345678901
7. Clica em "✅ Consultar"
8. 🔍 Consulta na Nova Vida
9. ✅ Dados retornados e salvos
10. 📊 Modal mostra os dados
```

**Observação**: Se buscou por **nome ou telefone**, pede CPF para consultar.

---

### Exemplo 3: Busca por Telefone não cadastrado

```
1. Digite: 62999888777
2. ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ✅ Sim
5. 📄 Sistema pede: "Digite o CPF ou CNPJ"
6. Digite: 12345678901
7. ✅ Consulta e salva na base
```

---

### Exemplo 4: Não quer consultar

```
1. Digite: qualquer coisa
2. ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ❌ Não
5. ✅ Modal fecha, volta para busca
```

---

## 🎨 INTERFACE DOS MODAIS

### Modal 1: Confirmação

```
╔═══════════════════════════════════════════════╗
║                                               ║
║                    ❌                         ║
║                                               ║
║        Nenhum Cadastro Encontrado             ║
║                                               ║
║    Não encontramos nenhum cadastro para:      ║
║           "João Silva"                        ║
║                                               ║
║   ┌─────────────────────────────────────┐    ║
║   │ Deseja consultar na Nova Vida?      │    ║
║   └─────────────────────────────────────┘    ║
║                                               ║
║   [ ❌ Não ]          [ ✅ Sim ]              ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

### Modal 2: Pedir CPF (se necessário)

```
╔═══════════════════════════════════════════════╗
║                                               ║
║                    📄                         ║
║                                               ║
║           Consultar Nova Vida                 ║
║                                               ║
║      Digite o CPF ou CNPJ para consultar      ║
║                                               ║
║   ┌─────────────────────────────────────┐    ║
║   │  [  Digite o CPF ou CNPJ  ]         │    ║
║   │  CPF: 11 dígitos | CNPJ: 14 dígitos│    ║
║   └─────────────────────────────────────┘    ║
║                                               ║
║   [ ❌ Cancelar ]    [ ✅ Consultar ]         ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

---

## 🔍 LÓGICA DE DETECÇÃO

### Se você buscou um CPF/CNPJ válido:
```javascript
Busca: "12345678901"  → 11 dígitos
                       ↓
Detecta como CPF/CNPJ  → ✅
                       ↓
Consulta DIRETO na Nova Vida → 🚀
(NÃO pede CPF de novo)
```

### Se você buscou um Nome ou Telefone:
```javascript
Busca: "João Silva"  → Tem letras
                      ↓
NÃO é CPF/CNPJ       → ❌
                      ↓
Abre modal pedindo CPF → 📄
                      ↓
Você digita o CPF     → 12345678901
                      ↓
Consulta na Nova Vida → 🚀
```

---

## 📊 ANTES vs AGORA

| Situação | ANTES | AGORA |
|----------|-------|-------|
| Não encontra cadastro | Toast + Nada | Modal pergunta se quer consultar NV |
| Quer cadastrar | Cadastro manual | ✅ Consulta Nova Vida! |
| Buscou CPF | Digita CPF de novo | ✅ Consulta direto (já tem CPF)! |
| Buscou Nome | Vai em "Consulta Única" | ✅ Pede CPF e consulta NV! |

---

## 🎯 BENEFÍCIOS

1. ✅ **Integrado**: Consulta Nova Vida direto da busca
2. ✅ **Inteligente**: Se buscou CPF, não pede de novo
3. ✅ **Automático**: Dados salvos automaticamente
4. ✅ **Rápido**: Menos cliques, fluxo direto
5. ✅ **Visual**: Mostra dados consultados no modal

---

## 🚀 COMO TESTAR

Execute:
```
TESTAR-CONSULTA-NOVA-VIDA-BUSCA.bat
```

### Ou teste manualmente:

#### Teste 1: Buscar CPF não cadastrado
```
1. Digite: 03769336151 (CPF do Thiago)
2. Buscar → ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ✅ Sim
5. 🔍 Consulta DIRETO (não pede CPF de novo)
6. ✅ Dados aparecem!
```

#### Teste 2: Buscar Nome não cadastrado
```
1. Digite: Fulano de Tal
2. Buscar → ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ✅ Sim
5. 📄 Modal pede CPF
6. Digite CPF válido
7. ✅ Consulta e mostra dados!
```

#### Teste 3: Recusar consulta
```
1. Digite: qualquer coisa
2. Buscar → ❌ Não encontrado
3. Modal: "Deseja consultar na Nova Vida?"
4. Clica em ❌ Não
5. ✅ Fecha modal
```

---

## 🎊 RESUMO

**Agora quando não encontrar um cadastro:**
- ✅ Pergunta se quer consultar na Nova Vida
- ✅ Se SIM e buscou CPF → Consulta direto
- ✅ Se SIM e buscou Nome → Pede CPF primeiro
- ✅ Dados salvos automaticamente
- ✅ Mostra resultado no modal

**Fluxo integrado e super rápido!** 🚀🎉






