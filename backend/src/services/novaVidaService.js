const axios = require('axios');

/**
 * Service para integração com a API Nova Vida
 * Documentação: https://wsnv.novavidati.com.br/
 */
class NovaVidaService {
  constructor() {
    this.baseURL = 'https://wsnv.novavidati.com.br/wslocalizador.asmx';
    this.credentials = {
      usuario: process.env.NOVAVIDA_USUARIO || 'MAYCON.NETTCRED@GMAIL.COM',
      senha: process.env.NOVAVIDA_SENHA || 'Tg130992*',
      cliente: process.env.NOVAVIDA_CLIENTE || 'NETCRED'
    };
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Gera token de autenticação (válido por 24h)
   */
  async gerarToken() {
    try {
      console.log('🔑 Gerando token Nova Vida...');
      console.log('📧 Usuário:', this.credentials.usuario);
      console.log('🔒 Senha length:', this.credentials.senha?.length);
      console.log('🏢 Cliente:', this.credentials.cliente || '(vazio)');
      console.log('🌐 URL:', `${this.baseURL}/GerarTokenJson`);
      
      // Limpar credenciais de possíveis espaços em branco
      const credenciaisLimpas = {
        usuario: this.credentials.usuario.trim(),
        senha: this.credentials.senha.trim(),
        cliente: this.credentials.cliente?.trim() || ''
      };
      
      console.log('📤 Enviando payload:', JSON.stringify({ credencial: credenciaisLimpas }, null, 2));
      
      const response = await axios.post(
        `${this.baseURL}/GerarTokenJson`,
        {
          credencial: credenciaisLimpas
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // O retorno vem em formato texto dentro de response.data.d
      let token = response.data?.d || response.data;
      
      console.log('📦 Resposta completa da API:', JSON.stringify(response.data, null, 2));
      
      if (!token || typeof token !== 'string') {
        throw new Error('Falha ao gerar token: resposta inválida');
      }
      
      // Verificar se a resposta é um XML de erro ANTES de processar
      if (token.includes('<?xml') || token.includes('<ERROS>') || token.includes('ERRO')) {
        console.error('❌ API retornou erro:', token);
        throw new Error('Credenciais inválidas, conta sem créditos ou sem acesso. Verifique com o suporte da Nova Vida.');
      }
      
      // Limpar o token: remover quebras de linha, espaços, aspas e caracteres especiais
      token = token
        .trim()
        .replace(/[\r\n\t]/g, '')  // Remove quebras de linha e tabs
        .replace(/^["']|["']$/g, '') // Remove aspas do início e fim
        .replace(/\s+/g, '');        // Remove todos os espaços
      
      if (!token || token.length < 10) {
        throw new Error('Token inválido ou muito curto');
      }

      // Token válido por 24 horas
      this.token = token;
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      
      console.log('✅ Token gerado com sucesso (válido por 24h)');
      console.log(`🔑 Token length: ${token.length} caracteres`);
      console.log(`🔑 Token preview: ${token.substring(0, 50)}...`);
      return this.token;
    } catch (error) {
      console.error('❌ Erro ao gerar token:', error.message);
      throw new Error(`Falha na autenticação Nova Vida: ${error.message}`);
    }
  }

  /**
   * Verifica se o token é válido
   */
  async getValidToken() {
    // Se não tem token ou expirou, gera novo
    if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.gerarToken();
    }
    return this.token;
  }

  /**
   * Detecta se o documento é CPF ou CNPJ
   */
  detectarTipoDocumento(documento) {
    const apenasNumeros = documento.replace(/\D/g, '');
    
    if (apenasNumeros.length === 11) {
      return 'CPF';
    } else if (apenasNumeros.length === 14) {
      return 'CNPJ';
    }
    
    throw new Error('Documento inválido. Deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)');
  }

  /**
   * Formata o documento (remove caracteres especiais)
   */
  formatarDocumento(documento) {
    return documento.replace(/\D/g, '');
  }

  /**
   * Consulta dados de um CPF ou CNPJ
   */
  async consultarDocumento(documento) {
    try {
      const token = await this.getValidToken();
      const docFormatado = this.formatarDocumento(documento);
      const tipoDoc = this.detectarTipoDocumento(docFormatado);

      console.log(`🔍 Consultando ${tipoDoc}: ${docFormatado}`);
      
      // Validar se o token não contém caracteres inválidos para headers HTTP
      const tokenClean = token.replace(/[^\x20-\x7E]/g, ''); // Apenas ASCII imprimíveis
      
      if (!tokenClean) {
        throw new Error('Token inválido após limpeza');
      }

      const response = await axios.post(
        `${this.baseURL}/NVCHECKJson`,
        {
          nvcheck: {
            Documento: docFormatado
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Token': tokenClean
          }
        }
      );

      // O resultado vem em response.data.d.CONSULTA
      const consulta = response.data?.d?.CONSULTA;

      if (!consulta) {
        throw new Error('Resposta inválida da API');
      }

      console.log(`✅ Consulta realizada com sucesso para ${tipoDoc}: ${docFormatado}`);

      return {
        success: true,
        tipo: tipoDoc,
        documento: docFormatado,
        dados: consulta
      };
    } catch (error) {
      console.error(`❌ Erro ao consultar documento ${documento}:`, error.message);
      
      return {
        success: false,
        tipo: this.detectarTipoDocumento(documento),
        documento: this.formatarDocumento(documento),
        erro: error.message,
        dados: null
      };
    }
  }

  /**
   * Consulta múltiplos documentos com delay
   */
  async consultarDocumentos(documentos, delaySeconds = 0) {
    const resultados = [];

    for (let i = 0; i < documentos.length; i++) {
      const documento = documentos[i];
      
      console.log(`📊 Consultando documento ${i + 1}/${documentos.length}: ${documento}`);

      const resultado = await this.consultarDocumento(documento);
      resultados.push(resultado);

      // Delay entre consultas (exceto na última)
      if (i < documentos.length - 1 && delaySeconds > 0) {
        console.log(`⏳ Aguardando ${delaySeconds}s antes da próxima consulta...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    return resultados;
  }
}

module.exports = NovaVidaService;

