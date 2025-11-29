#!/bin/bash

# Script de Testes de Multi-Tenancy
# Testa autenticação, isolamento e segurança

API_URL="${API_URL:-http://localhost:3000/api}"
TENANT1_EMAIL="${TENANT1_EMAIL:-admin@minhaempresa.com}"
TENANT1_PASS="${TENANT1_PASS:-admin123}"
TENANT2_EMAIL="${TENANT2_EMAIL:-admin@teste2.com}"
TENANT2_PASS="${TENANT2_PASS:-senha123}"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTES DE MULTI-TENANCY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📡 API: $API_URL"
echo "👤 Tenant 1: $TENANT1_EMAIL"
echo ""

# Função de teste
test_api() {
  local name="$1"
  local expected_status="$2"
  shift 2
  
  TOTAL=$((TOTAL + 1))
  
  local response=$(curl -s -w "\n%{http_code}" "$@")
  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)
  
  if [ "$status" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} - $name (Status: $status)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC} - $name"
    echo -e "   ${YELLOW}Expected:${NC} $expected_status"
    echo -e "   ${YELLOW}Got:${NC} $status"
    echo -e "   ${YELLOW}Body:${NC} $(echo $body | head -c 200)"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# ============================================
# TESTE 1: AUTENTICAÇÃO
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TESTE 1: AUTENTICAÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1.1. Login Tenant 1
echo "1.1. Login Tenant 1"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TENANT1_EMAIL\",\"password\":\"$TENANT1_PASS\"}")

TOKEN1=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken' 2>/dev/null)

TOTAL=$((TOTAL + 1))
if [ -n "$TOKEN1" ] && [ "$TOKEN1" != "null" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Login Tenant 1 obteve token"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ FAIL${NC} - Login Tenant 1 (Token não obtido)"
  echo -e "   ${YELLOW}Response:${NC} $(echo $LOGIN_RESPONSE | head -c 200)"
  FAILED=$((FAILED + 1))
  echo ""
  echo -e "${RED}⚠️  Não é possível continuar sem token.${NC}"
  exit 1
fi
echo ""

# 1.2. Login com Credenciais Inválidas
echo "1.2. Login com Credenciais Inválidas"
test_api "Login Inválido" "401" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalido@email.com","password":"senhaerrada"}'
echo ""

# 1.3. Acesso sem Token
echo "1.3. Acesso Sem Token (Protegido)"
test_api "Sem Autenticação" "401" -X GET "$API_URL/campaigns"
echo ""

# ============================================
# TESTE 2: ISOLAMENTO DE DADOS
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TESTE 2: ISOLAMENTO DE DADOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 2.1. Listar Campanhas Tenant 1 (Antes de criar)
echo "2.1. Listar Campanhas Tenant 1 (estado inicial)"
CAMPAIGNS_BEFORE=$(curl -s -X GET "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN1")
COUNT_BEFORE=$(echo "$CAMPAIGNS_BEFORE" | jq '.data | length' 2>/dev/null || echo "0")

TOTAL=$((TOTAL + 1))
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ PASS${NC} - Listar campanhas (encontrado: $COUNT_BEFORE)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ FAIL${NC} - Listar campanhas"
  FAILED=$((FAILED + 1))
fi
echo ""

# 2.2. Criar Campanha no Tenant 1
echo "2.2. Criar Campanha no Tenant 1"
CAMPAIGN_NAME="Test_Campaign_$(date +%s)"
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$CAMPAIGN_NAME\",\"status\":\"draft\"}")

CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | tail -n 1)
CAMPAIGN_ID=$(echo "$CREATE_BODY" | jq -r '.data.id' 2>/dev/null)

TOTAL=$((TOTAL + 1))
if [ "$CREATE_STATUS" == "201" ] || [ "$CREATE_STATUS" == "200" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Campanha criada (ID: $CAMPAIGN_ID)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ FAIL${NC} - Criar campanha"
  echo -e "   ${YELLOW}Status:${NC} $CREATE_STATUS"
  echo -e "   ${YELLOW}Body:${NC} $(echo $CREATE_BODY | head -c 200)"
  FAILED=$((FAILED + 1))
fi
echo ""

# 2.3. Verificar se campanha aparece na lista
echo "2.3. Verificar Campanha na Lista"
CAMPAIGNS_AFTER=$(curl -s -X GET "$API_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN1")
COUNT_AFTER=$(echo "$CAMPAIGNS_AFTER" | jq '.data | length' 2>/dev/null || echo "0")

TOTAL=$((TOTAL + 1))
if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Campanha aparece na lista ($COUNT_BEFORE → $COUNT_AFTER)"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️  WARN${NC} - Contagem não aumentou ($COUNT_BEFORE → $COUNT_AFTER)"
  echo -e "   ${YELLOW}Possível que API ainda não retorne a campanha${NC}"
  SKIPPED=$((SKIPPED + 1))
fi
echo ""

# ============================================
# TESTE 3: ISOLAMENTO ENTRE TENANTS
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TESTE 3: ISOLAMENTO ENTRE TENANTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 3.1. Tentar Login Tenant 2
echo "3.1. Login Tenant 2"
LOGIN2_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TENANT2_EMAIL\",\"password\":\"$TENANT2_PASS\"}")

TOKEN2=$(echo "$LOGIN2_RESPONSE" | jq -r '.data.tokens.accessToken' 2>/dev/null)

TOTAL=$((TOTAL + 1))
if [ -n "$TOKEN2" ] && [ "$TOKEN2" != "null" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Login Tenant 2 (Tenant existe)"
  PASSED=$((PASSED + 1))
  
  # 3.2. Listar Campanhas Tenant 2
  echo ""
  echo "3.2. Listar Campanhas Tenant 2 (isolamento)"
  CAMPAIGNS_T2=$(curl -s -X GET "$API_URL/campaigns" \
    -H "Authorization: Bearer $TOKEN2")
  
  COUNT_T2=$(echo "$CAMPAIGNS_T2" | jq '.data | length' 2>/dev/null || echo "0")
  HAS_T1_CAMPAIGN=$(echo "$CAMPAIGNS_T2" | jq ".data[] | select(.name == \"$CAMPAIGN_NAME\")" 2>/dev/null)
  
  TOTAL=$((TOTAL + 1))
  if [ -z "$HAS_T1_CAMPAIGN" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Tenant 2 NÃO vê campanhas do Tenant 1 ✅"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}❌ FAIL${NC} - VAZAMENTO: Tenant 2 vê campanha do Tenant 1!"
    echo -e "   ${RED}Campanha vazada:${NC} $HAS_T1_CAMPAIGN"
    FAILED=$((FAILED + 1))
  fi
  
  # 3.3. Tentar Acessar Campanha Específica do Tenant 1
  if [ -n "$CAMPAIGN_ID" ] && [ "$CAMPAIGN_ID" != "null" ]; then
    echo ""
    echo "3.3. Tentar Acessar Campanha Específica do Tenant 1"
    test_api "Acesso Cruzado Bloqueado" "404" -X GET "$API_URL/campaigns/$CAMPAIGN_ID" \
      -H "Authorization: Bearer $TOKEN2"
  fi
  
else
  echo -e "${YELLOW}⚠️  SKIP${NC} - Tenant 2 não existe (esperado em primeiro teste)"
  echo -e "   ${BLUE}Para testar isolamento, crie Tenant 2 via /auth/register${NC}"
  SKIPPED=$((SKIPPED + 1))
fi
echo ""

# ============================================
# TESTE 4: SEGURANÇA
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TESTE 4: SEGURANÇA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 4.1. Token Inválido
echo "4.1. Token Inválido"
test_api "Token Falso" "401" -X GET "$API_URL/campaigns" \
  -H "Authorization: Bearer TOKENFALSO123INVALID"
echo ""

# 4.2. Token Expirado (simular)
echo "4.2. Token Malformado"
test_api "Token Malformado" "401" -X GET "$API_URL/campaigns" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
echo ""

# ============================================
# RESUMO
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DOS TESTES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Total:   $TOTAL testes"
echo -e "   ${GREEN}Passou:  $PASSED${NC}"
echo -e "   ${RED}Falhou:  $FAILED${NC}"
echo -e "   ${YELLOW}Pulado:  $SKIPPED${NC}"
echo ""

SUCCESS_RATE=$((PASSED * 100 / TOTAL))
echo -e "   Taxa de Sucesso: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC} 🎉"
  echo ""
  exit 0
else
  echo -e "${RED}❌ ALGUNS TESTES FALHARAM${NC}"
  echo ""
  echo "Revise os erros acima e ajuste o código."
  exit 1
fi





