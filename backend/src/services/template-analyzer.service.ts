import axios from 'axios';

interface TemplateAnalysisResult {
  success: boolean;
  existingTemplates?: any[];
  analysis?: string[];
  recommendedFormat?: any;
  error?: string;
}

/**
 * Serviço para analisar templates existentes e descobrir o formato correto
 */
export class TemplateAnalyzerService {
  private baseUrl = 'https://graph.facebook.com/v21.0';

  /**
   * Buscar todos os templates de uma conta e analisar os que têm imagens
   */
  async analyzeExistingTemplates(
    accessToken: string,
    businessAccountId: string
  ): Promise<TemplateAnalysisResult> {
    try {
      console.log('\n');
      console.log('='.repeat(100));
      console.log('🔍 ANALISANDO TEMPLATES EXISTENTES NA CONTA WHATSAPP');
      console.log('='.repeat(100));
      console.log('');
      console.log('🏢 Business Account ID:', businessAccountId);
      console.log('🔑 Access Token:', accessToken.substring(0, 20) + '...');
      console.log('');

      // Buscar TODOS os templates da conta
      const response = await axios.get(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            limit: 100, // Pegar muitos templates
            fields: 'id,name,status,category,language,components', // Campos detalhados
          },
        }
      );

      const allTemplates = response.data.data || [];
      console.log('📊 Total de templates encontrados:', allTemplates.length);
      console.log('');

      // Filtrar templates que têm HEADER com IMAGE
      const templatesWithImages = allTemplates.filter((template: any) => {
        const hasImageHeader = template.components?.some(
          (comp: any) => comp.type === 'HEADER' && comp.format === 'IMAGE'
        );
        return hasImageHeader;
      });

      console.log('🖼️  Templates com IMAGEM no header:', templatesWithImages.length);
      console.log('');

      if (templatesWithImages.length === 0) {
        console.log('⚠️  NENHUM TEMPLATE COM IMAGEM ENCONTRADO!');
        console.log('   Não é possível analisar o formato correto sem exemplos existentes.');
        console.log('');
        return {
          success: true,
          existingTemplates: [],
          analysis: [
            'Nenhum template com imagem foi encontrado nesta conta.',
            'Isso significa que nunca foi criado um template com imagem aprovado.',
            'Vamos tentar criar usando o formato padrão da documentação oficial.',
          ],
        };
      }

      // Analisar cada template com imagem
      const analysis: string[] = [];
      const detailedTemplates: any[] = [];

      for (const template of templatesWithImages.slice(0, 5)) {
        // Pegar os primeiros 5
        console.log('─'.repeat(100));
        console.log(`📋 TEMPLATE: ${template.name}`);
        console.log('   ID:', template.id);
        console.log('   Status:', template.status);
        console.log('   Categoria:', template.category);
        console.log('   Idioma:', template.language);
        console.log('');
        console.log('   🧩 COMPONENTS:');

        template.components.forEach((comp: any, idx: number) => {
          console.log(`   [${idx}] Tipo: ${comp.type}`);
          if (comp.format) console.log(`       Format: ${comp.format}`);
          if (comp.text) console.log(`       Text: ${comp.text.substring(0, 100)}...`);
          if (comp.example) {
            console.log(`       ✅ Example PRESENTE:`);
            console.log(JSON.stringify(comp.example, null, 10));
          }
        });

        console.log('');
        console.log('   📦 ESTRUTURA COMPLETA:');
        console.log(JSON.stringify(template.components, null, 2));
        console.log('');

        // Adicionar à análise
        detailedTemplates.push({
          name: template.name,
          status: template.status,
          components: template.components,
        });

        // Verificar se tem example no HEADER
        const headerComponent = template.components.find(
          (c: any) => c.type === 'HEADER'
        );
        if (headerComponent) {
          if (headerComponent.example) {
            analysis.push(
              `✅ Template "${template.name}" TEM example no HEADER component`
            );
            analysis.push(
              `   Formato: ${JSON.stringify(headerComponent.example)}`
            );
          } else {
            analysis.push(
              `❌ Template "${template.name}" NÃO TEM example no HEADER component`
            );
          }
        }
      }

      // Criar recomendação baseada nos templates encontrados
      let recommendedFormat: any = null;
      const firstTemplate = templatesWithImages[0];
      const headerComp = firstTemplate.components.find(
        (c: any) => c.type === 'HEADER'
      );

      if (headerComp) {
        recommendedFormat = {
          type: 'HEADER',
          format: headerComp.format,
          example: headerComp.example || 'NÃO PRESENTE NO TEMPLATE EXISTENTE',
        };

        console.log('='.repeat(100));
        console.log('💡 FORMATO RECOMENDADO (baseado em templates existentes):');
        console.log('='.repeat(100));
        console.log(JSON.stringify(recommendedFormat, null, 2));
        console.log('');
      }

      console.log('='.repeat(100));
      console.log('📊 RESUMO DA ANÁLISE:');
      console.log('='.repeat(100));
      analysis.forEach((line) => console.log(line));
      console.log('');

      return {
        success: true,
        existingTemplates: detailedTemplates,
        analysis,
        recommendedFormat,
      };
    } catch (error: any) {
      console.error('❌ Erro ao analisar templates:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Testar diferentes formatos de criação de template com imagem
   */
  async testDifferentFormats(
    accessToken: string,
    businessAccountId: string,
    testImageUrl: string
  ): Promise<any> {
    const results: any[] = [];
    const testTemplateName = `test_format_${Date.now()}`;

    console.log('\n');
    console.log('='.repeat(100));
    console.log('🧪 TESTANDO DIFERENTES FORMATOS DE CRIAÇÃO DE TEMPLATE');
    console.log('='.repeat(100));
    console.log('');

    // Formato 1: Example no nível raiz com header_handle
    const format1 = {
      name: testTemplateName + '_f1',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Teste de formato 1' },
      ],
      example: {
        header_handle: [testImageUrl],
      },
    };

    // Formato 2: Example dentro do component HEADER
    const format2 = {
      name: testTemplateName + '_f2',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: {
            header_handle: [testImageUrl],
          },
        },
        { type: 'BODY', text: 'Teste de formato 2' },
      ],
    };

    // Formato 3: Sem example (para ver o erro)
    const format3 = {
      name: testTemplateName + '_f3',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Teste de formato 3' },
      ],
    };

    // Formato 4: Example no nível raiz com header_url (ao invés de header_handle)
    const format4 = {
      name: testTemplateName + '_f4',
      category: 'MARKETING',
      language: 'pt_BR',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Teste de formato 4' },
      ],
      example: {
        header_url: [testImageUrl],
      },
    };

    const formats = [
      { name: 'Formato 1: example no raiz com header_handle', payload: format1 },
      { name: 'Formato 2: example dentro do HEADER component', payload: format2 },
      { name: 'Formato 3: sem example (esperado erro)', payload: format3 },
      { name: 'Formato 4: example no raiz com header_url', payload: format4 },
    ];

    for (const format of formats) {
      console.log('');
      console.log('─'.repeat(100));
      console.log(`🧪 TESTANDO: ${format.name}`);
      console.log('─'.repeat(100));
      console.log('Payload:');
      console.log(JSON.stringify(format.payload, null, 2));
      console.log('');

      try {
        const response = await axios.post(
          `${this.baseUrl}/${businessAccountId}/message_templates`,
          format.payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ SUCESSO!');
        console.log('   Template ID:', response.data.id);
        console.log('   Status:', response.data.status);
        console.log('');

        results.push({
          format: format.name,
          success: true,
          templateId: response.data.id,
          response: response.data,
        });

        // Se funcionou, não precisa testar os outros
        console.log('🎉 FORMATO CORRETO ENCONTRADO!');
        console.log('   Use este formato para criar templates com imagem.');
        console.log('');
        break;
      } catch (error: any) {
        console.log('❌ ERRO');
        console.log('   Mensagem:', error.response?.data?.error?.message);
        console.log('   Código:', error.response?.data?.error?.code);
        console.log('   Sub-código:', error.response?.data?.error?.error_subcode);
        if (error.response?.data?.error?.error_user_msg) {
          console.log('   Detalhes:', error.response.data.error.error_user_msg);
        }
        console.log('');

        results.push({
          format: format.name,
          success: false,
          error: error.response?.data?.error?.message,
          errorDetails: error.response?.data?.error,
        });
      }
    }

    console.log('='.repeat(100));
    console.log('📊 RESUMO DOS TESTES:');
    console.log('='.repeat(100));
    results.forEach((result, idx) => {
      console.log(
        `${idx + 1}. ${result.format}: ${result.success ? '✅ SUCESSO' : '❌ FALHOU'}`
      );
      if (result.error) {
        console.log(`   Erro: ${result.error}`);
      }
    });
    console.log('');

    return {
      success: true,
      results,
      workingFormat: results.find((r) => r.success),
    };
  }
}

export const templateAnalyzerService = new TemplateAnalyzerService();




