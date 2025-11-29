/**
 * ============================================
 * TEMPLATE VARIABLES UTILITIES
 * ============================================
 * Funções para trabalhar com variáveis em templates
 * Formato: {{variavel}}
 * ============================================
 */

/**
 * Detecta todas as variáveis em um texto
 * @param text - Texto para procurar variáveis
 * @returns Array de variáveis únicas encontradas (sem as chaves)
 */
export function detectVariables(text: string): string[] {
  if (!text) return [];
  
  // Regex para encontrar {{variavel}}
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = text.matchAll(regex);
  
  // Extrair nomes das variáveis (sem duplicatas)
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1].trim());
  }
  
  return Array.from(variables);
}

/**
 * Gera protocolo aleatório de 6 caracteres
 */
function generateProtocol(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let protocol = '';
  for (let i = 0; i < 6; i++) {
    protocol += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return protocol;
}

/**
 * Retorna saudação baseada na hora atual
 */
function getSaudacao(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Bom dia';
  } else if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  } else {
    return 'Boa noite';
  }
}

/**
 * Retorna valores das variáveis automáticas do sistema
 */
export function getSystemVariables(): Record<string, string> {
  const now = new Date();
  
  // Formatar data (DD/MM/YYYY)
  const data = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  // Formatar hora (HH:MM)
  const hora = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return {
    data,
    hora,
    protocolo: generateProtocol(),
    saudacao: getSaudacao()
  };
}

/**
 * Lista de variáveis automáticas disponíveis
 */
export const SYSTEM_VARIABLES = ['data', 'hora', 'protocolo', 'saudacao'];

/**
 * Verifica se uma variável é do sistema (automática)
 */
export function isSystemVariable(variable: string): boolean {
  return SYSTEM_VARIABLES.includes(variable.toLowerCase());
}

/**
 * Separa variáveis em automáticas e personalizadas
 */
export function categorizeVariables(variables: string[]): {
  system: string[];
  custom: string[];
} {
  const system: string[] = [];
  const custom: string[] = [];
  
  variables.forEach(v => {
    if (isSystemVariable(v)) {
      system.push(v);
    } else {
      custom.push(v);
    }
  });
  
  return { system, custom };
}

/**
 * Substitui variáveis no texto
 * @param text - Texto com variáveis
 * @param values - Objeto com valores das variáveis
 * @returns Texto com variáveis substituídas
 */
export function replaceVariables(
  text: string,
  values: Record<string, string>
): string {
  if (!text) return text;
  
  let result = text;
  
  // Substituir cada variável (aceita espaços opcionais ao redor do nome)
  Object.keys(values).forEach(key => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, values[key] || '');
  });
  
  return result;
}

/**
 * Obtém preview do texto com valores atuais
 * Preenche variáveis do sistema automaticamente
 */
export function getPreview(
  text: string,
  customValues: Record<string, string> = {}
): string {
  const systemVars = getSystemVariables();
  const allValues = { ...systemVars, ...customValues };
  return replaceVariables(text, allValues);
}

/**
 * Valida se todas as variáveis obrigatórias foram preenchidas
 */
export function validateVariables(
  variables: string[],
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  variables.forEach(v => {
    // Variáveis do sistema são sempre preenchidas automaticamente
    if (isSystemVariable(v)) return;
    
    // Verificar se variável personalizada foi preenchida
    if (!values[v] || values[v].trim() === '') {
      missing.push(v);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Formata nome de variável para exibição
 * Exemplo: "nome_cliente" -> "Nome Cliente"
 */
export function formatVariableName(variable: string): string {
  return variable
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}


