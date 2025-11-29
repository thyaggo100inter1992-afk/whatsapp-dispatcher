/**
 * Phone Validation Service
 * Serviço para validação e normalização de números de telefone brasileiros
 * 
 * REGRAS:
 * - Sempre cadastrar 2 versões: COM e SEM nono dígito
 * - Formato com DDI: 5511987654321 (Brasil)
 * - Validar DDD brasileiro
 * - Adicionar DDD padrão se não vier
 */

export interface PhoneValidationResult {
  isValid: boolean;
  mainNumber: string; // Número principal (com nono dígito se aplicável)
  alternativeNumber: string | null; // Número alternativo (sem nono dígito)
  ddd: string;
  hasNinthDigit: boolean;
  errors: string[];
}

export class PhoneValidationService {
  // DDDs válidos no Brasil
  private static readonly VALID_DDDS = [
    '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
    '21', '22', '24', // RJ
    '27', '28', // ES
    '31', '32', '33', '34', '35', '37', '38', // MG
    '41', '42', '43', '44', '45', '46', // PR
    '47', '48', '49', // SC
    '51', '53', '54', '55', // RS
    '61', // DF
    '62', '64', // GO
    '63', // TO
    '65', '66', // MT
    '67', // MS
    '68', // AC
    '69', // RO
    '71', '73', '74', '75', '77', // BA
    '79', // SE
    '81', '87', // PE
    '82', // AL
    '83', // PB
    '84', // RN
    '85', '88', // CE
    '86', '89', // PI
    '91', '93', '94', // PA
    '92', '97', // AM
    '95', // RR
    '96', // AP
    '98', '99', // MA
  ];

  // DDD padrão caso não seja fornecido
  private static readonly DEFAULT_DDD = '11';

  // Código do país (Brasil)
  private static readonly COUNTRY_CODE = '55';

  /**
   * Valida e normaliza um número de telefone brasileiro
   */
  static validate(phoneNumber: string, defaultDDD?: string): PhoneValidationResult {
    const errors: string[] = [];

    // Limpar número (remover caracteres não numéricos)
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Verificar se está vazio
    if (!cleanNumber) {
      return {
        isValid: false,
        mainNumber: '',
        alternativeNumber: null,
        ddd: '',
        hasNinthDigit: false,
        errors: ['Número de telefone vazio'],
      };
    }

    // Remover código do país se presente
    if (cleanNumber.startsWith('55')) {
      cleanNumber = cleanNumber.substring(2);
    }

    // Verificar tamanho
    if (cleanNumber.length < 8) {
      errors.push('Número muito curto');
      return {
        isValid: false,
        mainNumber: phoneNumber,
        alternativeNumber: null,
        ddd: '',
        hasNinthDigit: false,
        errors,
      };
    }

    let ddd = '';
    let localNumber = '';

    // Extrair DDD
    if (cleanNumber.length >= 10) {
      // Tem DDD
      ddd = cleanNumber.substring(0, 2);
      localNumber = cleanNumber.substring(2);
    } else {
      // Não tem DDD, usar padrão
      ddd = defaultDDD || this.DEFAULT_DDD;
      localNumber = cleanNumber;
      errors.push(`DDD não fornecido, usando padrão: ${ddd}`);
    }

    // Validar DDD
    if (!this.VALID_DDDS.includes(ddd)) {
      errors.push(`DDD inválido: ${ddd}`);
    }

    // Verificar tamanho do número local
    if (localNumber.length !== 8 && localNumber.length !== 9) {
      errors.push(`Número local com tamanho inválido: ${localNumber.length} dígitos`);
      return {
        isValid: false,
        mainNumber: phoneNumber,
        alternativeNumber: null,
        ddd,
        hasNinthDigit: false,
        errors,
      };
    }

    // Verificar se é celular (começa com 9)
    const isMobile = localNumber.length === 9 && localNumber.startsWith('9');
    const hasNinthDigit = localNumber.length === 9;

    let mainNumber: string;
    let alternativeNumber: string | null = null;

    if (hasNinthDigit) {
      // Tem 9º dígito
      mainNumber = `${this.COUNTRY_CODE}${ddd}${localNumber}`;
      
      // Criar versão sem 9º dígito (remover primeiro dígito do número local)
      const localWithout9 = localNumber.substring(1);
      alternativeNumber = `${this.COUNTRY_CODE}${ddd}${localWithout9}`;
    } else {
      // Não tem 9º dígito (8 dígitos)
      mainNumber = `${this.COUNTRY_CODE}${ddd}${localNumber}`;
      
      // Se for celular (número começa com 7, 8 ou 9 depois de remover o 9º),
      // criar versão com 9º dígito
      const firstDigit = localNumber.charAt(0);
      if (['7', '8', '9', '6'].includes(firstDigit)) {
        // Adicionar 9 no início
        const localWith9 = '9' + localNumber;
        alternativeNumber = `${this.COUNTRY_CODE}${ddd}${localWith9}`;
      }
    }

    return {
      isValid: errors.length === 0 || (errors.length === 1 && errors[0].includes('usando padrão')),
      mainNumber,
      alternativeNumber,
      ddd,
      hasNinthDigit,
      errors,
    };
  }

  /**
   * Valida múltiplos números de uma vez
   */
  static validateBatch(phoneNumbers: string[], defaultDDD?: string): PhoneValidationResult[] {
    return phoneNumbers.map(phone => this.validate(phone, defaultDDD));
  }

  /**
   * Extrai apenas números válidos de uma lista
   */
  static filterValid(phoneNumbers: string[], defaultDDD?: string): PhoneValidationResult[] {
    return this.validateBatch(phoneNumbers, defaultDDD).filter(result => result.isValid);
  }

  /**
   * Normaliza um número para o formato padrão (com DDI)
   */
  static normalize(phoneNumber: string, defaultDDD?: string): string | null {
    const result = this.validate(phoneNumber, defaultDDD);
    return result.isValid ? result.mainNumber : null;
  }

  /**
   * Verifica se um número está em uma lista (considerando as duas versões)
   */
  static isInList(phoneNumber: string, phoneList: string[], defaultDDD?: string): boolean {
    const result = this.validate(phoneNumber, defaultDDD);
    
    if (!result.isValid) {
      return false;
    }

    // Verificar se o número principal ou alternativo está na lista
    if (phoneList.includes(result.mainNumber)) {
      return true;
    }

    if (result.alternativeNumber && phoneList.includes(result.alternativeNumber)) {
      return true;
    }

    return false;
  }

  /**
   * Gera as duas versões do número (para cadastro duplo)
   */
  static generateBothVersions(phoneNumber: string, defaultDDD?: string): {
    version1: string;
    version2: string | null;
  } | null {
    const result = this.validate(phoneNumber, defaultDDD);
    
    if (!result.isValid) {
      return null;
    }

    return {
      version1: result.mainNumber,
      version2: result.alternativeNumber,
    };
  }

  /**
   * Formata número para exibição
   */
  static format(phoneNumber: string, includeCountryCode: boolean = false): string {
    const result = this.validate(phoneNumber);
    
    if (!result.isValid) {
      return phoneNumber;
    }

    const cleanNumber = result.mainNumber.replace(this.COUNTRY_CODE, '');
    const ddd = cleanNumber.substring(0, 2);
    const localNumber = cleanNumber.substring(2);

    if (localNumber.length === 9) {
      // Formato: (11) 98765-4321
      const formatted = `(${ddd}) ${localNumber.substring(0, 5)}-${localNumber.substring(5)}`;
      return includeCountryCode ? `+${this.COUNTRY_CODE} ${formatted}` : formatted;
    } else {
      // Formato: (11) 8765-4321
      const formatted = `(${ddd}) ${localNumber.substring(0, 4)}-${localNumber.substring(4)}`;
      return includeCountryCode ? `+${this.COUNTRY_CODE} ${formatted}` : formatted;
    }
  }

  /**
   * Valida formato de arquivo CSV
   */
  static validateCSV(csvData: string[][]): {
    valid: PhoneValidationResult[];
    invalid: { row: number; phone: string; errors: string[] }[];
  } {
    const valid: PhoneValidationResult[] = [];
    const invalid: { row: number; phone: string; errors: string[] }[] = [];

    csvData.forEach((row, index) => {
      const phoneNumber = row[0]; // Assumir que o número está na primeira coluna
      const result = this.validate(phoneNumber);

      if (result.isValid) {
        valid.push(result);
      } else {
        invalid.push({
          row: index + 1,
          phone: phoneNumber,
          errors: result.errors,
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * Remove duplicatas considerando as duas versões do número
   */
  static removeDuplicates(phoneNumbers: string[], defaultDDD?: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const phone of phoneNumbers) {
      const validation = this.validate(phone, defaultDDD);
      
      if (!validation.isValid) {
        continue;
      }

      // Verificar se já vimos este número (qualquer versão)
      if (seen.has(validation.mainNumber)) {
        continue;
      }

      if (validation.alternativeNumber && seen.has(validation.alternativeNumber)) {
        continue;
      }

      // Adicionar ambas as versões ao Set
      seen.add(validation.mainNumber);
      if (validation.alternativeNumber) {
        seen.add(validation.alternativeNumber);
      }

      result.push(validation.mainNumber);
    }

    return result;
  }
}

export default PhoneValidationService;




