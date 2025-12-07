/**
 * Normaliza número de telefone brasileiro para comparação
 * Remove variações como 9º dígito extra em celulares
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove espaços, traços, parênteses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  
  // Remove o + se tiver
  normalized = normalized.replace(/^\+/, '');
  
  // Se é número brasileiro (começa com 55)
  if (normalized.startsWith('55') && normalized.length >= 12) {
    // Extrai: 55 + DDD (2 dígitos) + resto
    const countryCode = normalized.substring(0, 2); // 55
    const areaCode = normalized.substring(2, 4); // 62
    const number = normalized.substring(4); // resto
    
    // Se o número tem 9 dígitos e começa com 9, remover o 9 extra
    // Ex: 5562991785664 -> 556291785664
    if (number.length === 9 && number.startsWith('9')) {
      return `${countryCode}${areaCode}${number.substring(1)}`;
    }
  }
  
  return normalized;
}

/**
 * Verifica se dois números são iguais após normalização
 */
export function arePhoneNumbersEqual(phone1: string, phone2: string): boolean {
  return normalizePhoneNumber(phone1) === normalizePhoneNumber(phone2);
}

