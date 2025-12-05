import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaBuilding, FaCrown, FaUser, FaUsers, FaEdit, FaTrash, FaPlus, FaTimes, FaDollarSign, FaChartLine, FaUsersCog, FaCamera, FaSignOutAlt, FaSquare, FaCheckSquare, FaBan, FaSpinner, FaCheck, FaFileInvoice, FaExclamationTriangle, FaWhatsapp, FaCreditCard, FaSync, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import SystemLogo from '@/components/SystemLogo';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import { buildFileUrl } from '@/utils/urlHelpers';

interface TenantUser {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  documento?: string;
  role: 'admin' | 'user';
  ativo: boolean;
  avatar?: string;
  permissoes?: {
    whatsapp_api?: boolean;
    whatsapp_qr?: boolean;
    campanhas?: boolean;
    templates?: boolean;
    base_dados?: boolean;
    nova_vida?: boolean;
    verificar_numeros?: boolean;
    gerenciar_proxies?: boolean;
    lista_restricao?: boolean;
    webhooks?: boolean;
    relatorios?: boolean;
    auditoria?: boolean;
    dashboard?: boolean;
    envio_imediato?: boolean;
    catalogo?: boolean;
    desativar_contas_whatsapp?: boolean;
    configuracoes?: boolean;
  };
  created_at: string;
  ultimo_login?: string;
}

// Mapeamento de nomes de permissões para labels amigáveis
const PERMISSION_LABELS: { [key: string]: string } = {
  whatsapp_api: 'WhatsApp API',
  whatsapp_qr: 'WhatsApp QR',
  campanhas: 'Campanhas',
  templates: 'Templates',
  base_dados: 'Base de Dados',
  nova_vida: 'Nova Vida',
  verificar_numeros: 'Verificar Números',
  gerenciar_proxies: 'Gerenciar Proxies',
  lista_restricao: 'Lista Restrição',
  webhooks: 'Webhooks',
  relatorios: 'Relatórios',
  auditoria: 'Auditoria',
  dashboard: 'Dashboard',
  envio_imediato: 'Envio Imediato',
  catalogo: 'Catálogo',
  desativar_contas_whatsapp: 'Desativar Contas WhatsApp',
  configuracoes: '⚙️ Configurações (QR/API)',
};

/**
 * Painel de Informações Financeiras Completas
 * Mostra: Plano, Vencimento, Status, Histórico de Pagamentos
 */
function FinancialInfoPanel() {
  const [financialData, setFinancialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadFinancialInfo();
  }, []);

  // Polling para verificar se o pagamento foi confirmado
  useEffect(() => {
    if (!paymentData || !paymentData.id) return;

    const checkPaymentStatus = async () => {
      try {
        const response = await api.get(`/payments/${paymentData.id}/status`);
        const status = response.data.status;

        if (status === 'confirmed' || status === 'CONFIRMED') {
          // Pagamento confirmado!
          toast.success('🎉 Pagamento confirmado! Sua conta foi ativada com sucesso!');
          setPaymentData(null);
          
          // Recarregar página após 2 segundos
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
      }
    };

    // Verificar a cada 3 segundos
    const interval = setInterval(checkPaymentStatus, 3000);

    // Limpar intervalo ao desmontar ou quando paymentData mudar
    return () => clearInterval(interval);
  }, [paymentData, toast]);

  const loadFinancialInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments/financial-info');
      const data = response.data.data;
      
      // Filtrar pagamentos - remover consultas avulsas (são produto diferente) e pagamentos pendentes
      if (data.historico_pagamentos) {
        data.historico_pagamentos = data.historico_pagamentos.filter((payment: any) => {
          // Manter apenas pagamentos de planos (não de consultas avulsas)
          const metadata = payment.metadata || {};
          const isConsultaAvulsa = metadata.tipo === 'consultas_avulsas';
          
          // Remover pagamentos pendentes do histórico (eles já aparecem na seção "Pagamento Pendente")
          const isPending = payment.status === 'PENDING' || payment.status === 'pending';
          
          // Retornar apenas se NÃO for consulta avulsa E NÃO for pendente
          return !isConsultaAvulsa && !isPending;
        });
      }
      
      setFinancialData(data);
    } catch (error: any) {
      console.error('Erro ao carregar informações financeiras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (billingType: 'PIX' | 'BOLETO') => {
    try {
      setProcessing(true);
      console.log('💳 Processando renovação via', billingType);
      
      const response = await api.post('/payments/renew', {
        billing_type: billingType
      });
      
      console.log('📦 Resposta do backend:', response.data);
      console.log('💰 Payment Data:', response.data.payment);
      console.log('🔍 PIX QR Code:', response.data.payment?.pix_qr_code);
      console.log('📋 PIX Copy/Paste:', response.data.payment?.pix_copy_paste);
      
      setPaymentData(response.data.payment);
      toast.success('Cobrança de renovação gerada com sucesso! Após o pagamento, seu plano será estendido por mais 30 dias.');
      
    } catch (error: any) {
      console.error('❌ Erro ao processar renovação:', error);
      toast.error('Erro ao processar renovação: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  // Sincronizar pagamentos com Asaas
  const handleSyncPayments = async () => {
    try {
      setSyncingPayments(true);
      toast.info('🔄 Sincronizando pagamentos com Asaas...');
      
      const response = await api.post('/payments/sync');
      
      if (response.data.updated > 0) {
        toast.success(`✅ ${response.data.updated} pagamento(s) atualizado(s)!`);
        // Recarregar informações financeiras
        await loadFinancialInfo();
      } else {
        toast.info('ℹ️ Nenhum pagamento foi atualizado.');
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar pagamentos:', error);
      toast.error('Erro ao sincronizar: ' + (error.response?.data?.message || error.message));
    } finally {
      setSyncingPayments(false);
    }
  };

  // Marcar pagamento como pago manualmente
  const handleMarkAsPaid = async (paymentId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja marcar este pagamento como PAGO?\n\nIsso vai:\n✅ Ativar o plano do cliente\n✅ Estender a data de vencimento\n✅ Liberar o acesso ao sistema')) {
      return;
    }

    try {
      setMarkingAsPaid(paymentId);
      toast.info('⏳ Marcando pagamento como pago...');
      
      const response = await api.post(`/payments/${paymentId}/mark-as-paid`);
      
      toast.success('✅ Pagamento marcado como pago! Plano ativado com sucesso!');
      
      // Recarregar informações financeiras
      await loadFinancialInfo();
      
      // Recarregar página após 2 segundos para atualizar tudo
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao marcar como pago:', error);
      toast.error('Erro: ' + (error.response?.data?.message || error.message));
    } finally {
      setMarkingAsPaid(null);
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Gestão de Equipe | Disparador NettSistemas</title>
        </Head>
        
        <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8">
          <div className="flex items-center justify-center py-8">
            <FaSpinner className="animate-spin text-4xl text-emerald-400" />
          </div>
        </div>
      </>
    );
  }

  if (!financialData) {
    return null;
  }

  const { plano, vencimento, historico_pagamentos, pagamento_pendente } = financialData;

  // Função para formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Função para formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Cor do badge de status de vencimento
  const getVencimentoColor = (corAlerta: string) => {
    switch (corAlerta) {
      case 'green': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'red': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  // Status de pagamento
  const getPaymentStatusBadge = (status: string) => {
    const statusMap: any = {
      'PENDING': { label: '⏳ Pendente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      'pending': { label: '⏳ Pendente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      'CONFIRMED': { label: '✅ Pago', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
      'confirmed': { label: '✅ Pago', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
      'RECEIVED': { label: '✅ Pago', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
      'received': { label: '✅ Pago', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
      'OVERDUE': { label: '❌ Vencido', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      'overdue': { label: '❌ Vencido', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      'CANCELLED': { label: '🚫 Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      'cancelled': { label: '🚫 Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/50' }
    };
    
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
    return statusInfo;
  };

  return (
    <>
      <div className="space-y-8">
        {/* Card Principal - Plano e Vencimento - SUPER MELHORADO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-900/40 via-dark-800/80 to-emerald-900/40 backdrop-blur-xl border-4 border-purple-500/30 rounded-[2rem] p-10 shadow-2xl hover:shadow-purple-500/30 transition-all duration-500 hover:-translate-y-2">
        {/* Efeito de brilho animado */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
        
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plano Atual com destaque */}
          <div className="group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-xl group-hover:scale-110 transition-transform">
                <FaCrown className="text-white text-2xl" />
              </div>
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider">Plano Atual</h3>
            </div>
            <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-3 animate-gradient">
              {plano.nome || 'Sem Plano'}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl text-emerald-400 font-black drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                {formatCurrency(plano.preco_mensal || 0)}
              </p>
              <span className="text-xl text-gray-400 font-bold">/mês</span>
            </div>
          </div>

          {/* Vencimento com alerta visual */}
          <div className="group">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-transform ${
                vencimento.cor_alerta === 'red' 
                  ? 'bg-gradient-to-br from-red-500 to-red-700' 
                  : vencimento.cor_alerta === 'yellow'
                  ? 'bg-gradient-to-br from-yellow-500 to-yellow-700'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
              }`}>
                <FaDollarSign className="text-white text-2xl" />
              </div>
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider">Vencimento</h3>
            </div>
            <p className="text-4xl font-black text-white mb-4">{formatDate(vencimento.data)}</p>
            <div className="inline-flex">
              <span className={`px-6 py-3 rounded-2xl border-4 font-black text-lg shadow-2xl animate-pulse ${
                vencimento.cor_alerta === 'red'
                  ? 'bg-gradient-to-r from-red-500/30 to-red-600/30 border-red-500/60 text-red-300 shadow-red-500/50'
                  : vencimento.cor_alerta === 'yellow'
                  ? 'bg-gradient-to-r from-yellow-500/30 to-yellow-600/30 border-yellow-500/60 text-yellow-300 shadow-yellow-500/50'
                  : 'bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 border-emerald-500/60 text-emerald-300 shadow-emerald-500/50'
              }`}>
                {vencimento.dias_restantes < 0 
                  ? `⚠️ Vencido há ${Math.abs(vencimento.dias_restantes)} dias`
                  : `⏰ ${vencimento.dias_restantes} dias restantes`}
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação SUPER DESTACADOS */}
        <div className="relative z-10 mt-10 pt-8 border-t-4 border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/mudar-plano"
            className="group relative block w-full text-center px-8 py-6 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-600 hover:from-purple-500 hover:via-purple-600 hover:to-purple-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-105 transform animate-pulse-slow"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl animate-shimmer"></div>
            <div className="relative flex items-center justify-center gap-3 text-xl">
              <FaCrown className="text-3xl" />
              <span>Mudar de Plano</span>
              <span className="absolute -top-3 -right-3 px-3 py-1 bg-yellow-500 text-yellow-900 rounded-full text-xs font-black animate-bounce">
                UPGRADE
              </span>
            </div>
          </a>
          <button
            onClick={() => setShowRenewModal(true)}
            className="group relative w-full text-center px-8 py-6 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 hover:from-emerald-500 hover:via-emerald-600 hover:to-emerald-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/50 hover:shadow-emerald-500/70 hover:scale-105 transform"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl animate-shimmer"></div>
            <div className="relative flex items-center justify-center gap-3 text-xl">
              <FaDollarSign className="text-3xl" />
              <span>Renovar Plano</span>
            </div>
          </button>
        </div>

        {/* Pagamento Pendente */}
        {pagamento_pendente && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FaDollarSign className="text-yellow-400" />
              Pagamento Pendente
            </h3>
            <div className="bg-dark-700/50 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Valor:</span>
                <span className="text-xl font-bold text-white">{formatCurrency(pagamento_pendente.valor)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Vencimento:</span>
                <span className="font-bold text-white">{formatDate(pagamento_pendente.due_date)}</span>
              </div>
              {pagamento_pendente.payment_type === 'PIX' && pagamento_pendente.asaas_pix_copy_paste && (
                <div className="space-y-4">
                  {/* QR Code PIX */}
                  {pagamento_pendente.asaas_pix_qr_code && (
                    <div className="bg-white rounded-xl p-4 flex justify-center">
                      <img 
                        src={(() => {
                          const qr = pagamento_pendente.asaas_pix_qr_code;
                          // Se for URL HTTP, retorna direto
                          if (qr.startsWith('http')) return qr;
                          // Remove duplicação do prefixo data:image se existir
                          let cleanQr = qr;
                          const duplicatedPrefix = 'data:image/png;base64,data:image/png;base64,';
                          if (cleanQr.startsWith(duplicatedPrefix)) {
                            cleanQr = cleanQr.replace(duplicatedPrefix, 'data:image/png;base64,');
                          }
                          // Adiciona o prefixo apenas se não existir
                          return cleanQr.startsWith('data:') ? cleanQr : `data:image/png;base64,${cleanQr}`;
                        })()} 
                        alt="QR Code PIX" 
                        className="w-48 h-48"
                        onError={(e) => {
                          console.error('Erro ao carregar QR Code');
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Botão Copiar PIX */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pagamento_pendente.asaas_pix_copy_paste);
                      toast.success('Código PIX copiado!');
                    }}
                    className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <FaDollarSign />
                    Copiar Código PIX
                  </button>
                </div>
              )}
              {pagamento_pendente.asaas_bank_slip_url && (
                <a
                  href={pagamento_pendente.asaas_bank_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition"
                >
                  Ver Boleto
                </a>
              )}
              
              {/* Botão Ver Fatura Completa */}
              {pagamento_pendente.asaas_invoice_url && (
                <a
                  href={pagamento_pendente.asaas_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <FaFileInvoice />
                  Ver Fatura Completa
                </a>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Modal de Renovação - Escolha de Pagamento */}
      {showRenewModal && !paymentData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-white/20 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-6">Renovar Plano</h2>
            <p className="text-gray-300 mb-2">
              <strong>Plano:</strong> {plano.nome}
            </p>
            <p className="text-gray-300 mb-6">
              <strong>Valor:</strong> {formatCurrency(plano.preco_mensal)}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Após o pagamento, seu plano será estendido por mais 30 dias.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => handleRenew('PIX')}
                disabled={processing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {processing ? <FaSpinner className="animate-spin inline mr-2" /> : null}
                Pagar com PIX
              </button>
              <button
                onClick={() => setShowRenewModal(false)}
                className="w-full py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dados de Pagamento */}
      {paymentData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-emerald-500/50 rounded-3xl p-8 max-w-2xl w-full">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-2">
              <FaCheck className="text-emerald-400" />
              Renovação Gerada!
            </h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-gray-400 mb-2">Valor:</p>
                <p className="text-3xl font-black text-white">{formatCurrency(paymentData.valor)}</p>
              </div>

              {/* PIX */}
              {paymentData.payment_type === 'PIX' && (
                <div>
                  {paymentData.pix_qr_code && (
                    <div className="mb-4">
                      <p className="text-gray-400 mb-2 text-center">Escaneie o QR Code com seu app de pagamento:</p>
                      <div className="flex justify-center">
                        <img 
                          src={(() => {
                            const qr = paymentData.pix_qr_code;
                            // Se for URL HTTP, retorna direto
                            if (qr.startsWith('http')) return qr;
                            // Remove duplicação do prefixo data:image se existir
                            let cleanQr = qr;
                            const duplicatedPrefix = 'data:image/png;base64,data:image/png;base64,';
                            if (cleanQr.startsWith(duplicatedPrefix)) {
                              cleanQr = cleanQr.replace(duplicatedPrefix, 'data:image/png;base64,');
                            }
                            // Adiciona o prefixo apenas se não existir
                            return cleanQr.startsWith('data:') ? cleanQr : `data:image/png;base64,${cleanQr}`;
                          })()} 
                          alt="QR Code PIX" 
                          className="w-64 h-64 bg-white p-4 rounded-xl"
                          onError={(e) => {
                            console.error('Erro ao carregar QR Code:', paymentData.pix_qr_code);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {paymentData.pix_copy_paste && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentData.pix_copy_paste);
                        toast.success('Código PIX copiado!');
                      }}
                      className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <FaDollarSign />
                      Copiar Código PIX
                    </button>
                  )}

                  {!paymentData.pix_qr_code && !paymentData.pix_copy_paste && (
                    <div className="text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                      <p className="font-bold mb-2">⚠️ Os dados do PIX ainda não foram disponibilizados pelo Asaas.</p>
                      <p className="text-sm mb-4">Aguarde alguns instantes e clique no botão abaixo para buscar novamente.</p>
                      <button
                        onClick={async () => {
                          try {
                            console.log('🔄 Buscando dados do PIX novamente...');
                            const response = await api.get(`/payments/${paymentData.id}`);
                            console.log('📦 Dados atualizados:', response.data);
                            if (response.data.success) {
                              setPaymentData(response.data.payment);
                              toast.success('Dados do PIX atualizados!');
                            }
                          } catch (error: any) {
                            console.error('Erro ao buscar PIX:', error);
                            toast.error('Erro ao buscar dados do PIX');
                          }
                        }}
                        className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition"
                      >
                        🔄 Buscar Dados do PIX
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Boleto */}
              {paymentData.bank_slip_url && (
                <a
                  href={paymentData.bank_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
                >
                  Ver Boleto
                </a>
              )}

              {/* Botão Ver Fatura Completa */}
              {paymentData.invoice_url && (
                <a
                  href={paymentData.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <FaFileInvoice />
                  Ver Fatura Completa
                </a>
              )}

              <div className="pt-4 border-t border-white/10 space-y-3">
                <button
                  onClick={async () => {
                    try {
                      setProcessing(true);
                      // Tentar atualizar os dados do PIX
                      if (paymentData.payment_type === 'PIX' && paymentData.id) {
                        const response = await api.post(`/payments/update-pix-data/${paymentData.id}`);
                        if (response.data.success) {
                          setPaymentData(response.data.payment);
                          toast.success('Dados do PIX atualizados com sucesso!');
                        }
                      } else {
                        // Recarregar informações financeiras
                        await loadFinancialInfo();
                        toast.success('Informações recarregadas!');
                      }
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || 'Erro ao atualizar dados');
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <span>🔄</span> Atualizar Dados do PIX
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setPaymentData(null);
                    setShowRenewModal(false);
                    loadFinancialInfo();
                  }}
                  className="w-full py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Pagamentos de Planos - ÚLTIMA SEÇÃO */}
      {historico_pagamentos && historico_pagamentos.length > 0 && (
        <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 mt-6">
          {/* Cabeçalho com Botão de Atualizar */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <FaChartLine className="text-emerald-400" />
              Histórico de Pagamentos de Planos
            </h2>
            <button
              onClick={handleSyncPayments}
              disabled={syncingPayments}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all"
            >
              {syncingPayments ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <FaSync />
                  Atualizar Pagamentos
                </>
              )}
            </button>
          </div>

          {/* Container com scroll customizado */}
          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-dark-700/50 hover:scrollbar-thumb-emerald-500/70">
            {historico_pagamentos.map((payment: any) => {
              const statusInfo = getPaymentStatusBadge(payment.status);
              const isPending = payment.status === 'pending' || payment.status === 'PENDING';
              
              return (
                <div key={payment.id} className="bg-dark-700/50 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-white">{payment.descricao || 'Pagamento'}</p>
                    <p className="text-sm text-gray-400">{formatDate(payment.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-white">{formatCurrency(payment.valor)}</span>
                    <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    
                    {/* Botão Marcar como Pago (apenas para pendentes) */}
                    {isPending && (
                      <button
                        onClick={() => handleMarkAsPaid(payment.id)}
                        disabled={markingAsPaid === payment.id}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-lg transition-all"
                      >
                        {markingAsPaid === payment.id ? (
                          <>
                            <FaSpinner className="animate-spin text-xs" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <FaCheckCircle className="text-sm" />
                            Marcar como Pago
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default function Gestao() {
  const router = useRouter();
  const { user, tenant, signOut, updateTenant } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'usuarios' | 'financeiro' | 'perfil'>('usuarios');
  
  // Estados para Usuários
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  
  // Estados para Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Estados para Desativação de Usuários
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [deactivatingUsers, setDeactivatingUsers] = useState(false);

  // Estados para Contas WhatsApp
  const [availableApiAccounts, setAvailableApiAccounts] = useState<any[]>([]);
  const [availableUazInstances, setAvailableUazInstances] = useState<any[]>([]);
  const [selectedApiAccounts, setSelectedApiAccounts] = useState<Set<number>>(new Set());
  const [selectedUazInstances, setSelectedUazInstances] = useState<Set<number>>(new Set());
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Estados para Limites do Plano
  const [planLimits, setPlanLimits] = useState<{
    limite_usuarios: number | null;
    limite_contas_whatsapp: number | null;
    limite_campanhas_mes: number | null;
    limite_mensagens_dia: number | null;
  }>({
    limite_usuarios: null,
    limite_contas_whatsapp: null,
    limite_campanhas_mes: null,
    limite_mensagens_dia: null,
  });

  // Estados para Uso Atual
  const [currentUsage, setCurrentUsage] = useState<{
    total_usuarios: number;
    total_contas: number;
    campanhas_mes: number;
    mensagens_dia: number;
  }>({
    total_usuarios: 0,
    total_contas: 0,
    campanhas_mes: 0,
    mensagens_dia: 0,
  });

  // Estados para Funcionalidades
  const [funcionalidades, setFuncionalidades] = useState<Record<string, boolean> | null>(null);
  const [loadingFuncionalidades, setLoadingFuncionalidades] = useState(true);


  // Estado para Telefone de Suporte
  const [supportPhone, setSupportPhone] = useState('5562998449494');

  // Estados do Formulário
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    documento: '',
    role: 'user' as 'admin' | 'user',
    ativo: true,
    permissoes: {
      whatsapp_api: false,
      whatsapp_qr: false,
      campanhas: false,
      templates: false,
      base_dados: false,
      nova_vida: false,
      verificar_numeros: false,
      gerenciar_proxies: false,
      lista_restricao: false,
      webhooks: false,
      relatorios: false,
      auditoria: false,
      dashboard: false,
      envio_imediato: false,
      catalogo: false,
      desativar_contas_whatsapp: false,
      configuracoes: false,
    }
  });

  // Proteção de Rota
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      toast.error('Acesso negado! Apenas administradores podem acessar esta página.');
      router.push('/');
      return;
    }
    
    // Carregar telefone de suporte
    loadSupportPhone();
  }, [user, router]);

  // Carregar Usuários
  useEffect(() => {
    if (user && activeTab === 'usuarios') {
      loadUsers();
    }
  }, [user, activeTab]);

  // Carregar Limites do Plano e Estatísticas de Uso
  useEffect(() => {
    if (user && activeTab === 'financeiro') {
      loadPlanLimits();
      loadUsageStats();
      loadFuncionalidades();
    }
  }, [user, activeTab, tenant?.plano]);

  // Função para carregar telefone de suporte
  const loadSupportPhone = async () => {
    try {
      const response = await api.get('/system-settings/public');
      if (response.data.success && response.data.data.support_phone) {
        setSupportPhone(response.data.data.support_phone);
      }
    } catch (error) {
      console.log('⚠️ Usando telefone padrão de suporte');
    }
  };

  const loadPlanLimits = async () => {
    try {
      console.log('🔍 Carregando limites do plano...');
      // Buscar informações do plano atual do tenant
      const response = await api.get('/payments/status');
      console.log('📊 Resposta da API:', response.data);
      const tenantData = response.data.tenant;
      
      if (tenantData) {
        console.log('✅ Limites recebidos:', {
          usuarios: tenantData.limite_usuarios,
          whatsapp: tenantData.limite_contas_whatsapp,
          campanhas: tenantData.limite_campanhas_mes,
          mensagens: tenantData.limite_mensagens_dia
        });
        
        setPlanLimits({
          limite_usuarios: tenantData.limite_usuarios || null,
          limite_contas_whatsapp: tenantData.limite_contas_whatsapp || null,
          limite_campanhas_mes: tenantData.limite_campanhas_mes || null,
          limite_mensagens_dia: tenantData.limite_mensagens_dia || null,
        });
      } else {
        console.warn('⚠️ Dados do tenant não encontrados na resposta');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar limites do plano:', error);
    }
  };

  const loadUsageStats = async () => {
    try {
      console.log('📈 Carregando estatísticas de uso...');
      const response = await api.get('/gestao/usage');
      console.log('📊 Uso atual:', response.data);
      
      if (response.data.success) {
        const usage = response.data.data;
        console.log('✅ Estatísticas de uso recebidas:', usage);
        
        setCurrentUsage({
          total_usuarios: usage.total_usuarios || 0,
          total_contas: usage.total_contas || 0,
          campanhas_mes: usage.campanhas_mes || 0,
          mensagens_dia: usage.mensagens_dia || 0,
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas de uso:', error);
    }
  };

  const loadFuncionalidades = async () => {
    try {
      setLoadingFuncionalidades(true);
      console.log('🔍 Carregando funcionalidades do plano...');
      const response = await api.get('/payments/status');
      console.log('📊 Resposta da API para funcionalidades:', response.data);
      
      if (response.data.success && response.data.tenant) {
        const tenantData = response.data.tenant;
        let currentFuncionalidades = null;

        if (tenantData.funcionalidades_customizadas && tenantData.funcionalidades_config) {
          currentFuncionalidades = tenantData.funcionalidades_config;
          console.log('✅ Usando funcionalidades customizadas do tenant.');
        } else if (tenantData.plano_funcionalidades) {
          currentFuncionalidades = tenantData.plano_funcionalidades;
          console.log('✅ Usando funcionalidades padrão do plano.');
        } else {
          console.warn('⚠️ Nenhuma configuração de funcionalidade encontrada para o tenant ou plano.');
        }
        setFuncionalidades(currentFuncionalidades);
      } else {
        console.warn('⚠️ Dados do tenant não encontrados na resposta da API de status.');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar funcionalidades:', error);
      setFuncionalidades(null); // Resetar em caso de erro
    } finally {
      setLoadingFuncionalidades(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      console.log('🔄 Carregando usuários do tenant');
      const response = await api.get('/gestao/users');
      console.log('✅ Usuários carregados:', response.data);
      
      // Log detalhado dos avatares
      if (response.data.data) {
        response.data.data.forEach((u: TenantUser) => {
          if (u.avatar) {
            console.log(`📸 Usuário ${u.nome} tem avatar: ${u.avatar}`);
          } else {
            console.log(`⚪ Usuário ${u.nome} NÃO tem avatar`);
          }
        });
      }
      
      setUsers(response.data.data || []);
    } catch (error: any) {
      console.error('❌ Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenCreateUserModal = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      telefone: '',
      documento: '',
      role: 'user',
      ativo: true,
      permissoes: {
        whatsapp_api: false,
        whatsapp_qr: false,
        campanhas: false,
        templates: false,
        base_dados: false,
        nova_vida: false,
        verificar_numeros: false,
        gerenciar_proxies: false,
        lista_restricao: false,
        webhooks: false,
        relatorios: false,
        auditoria: false,
        dashboard: false,
        envio_imediato: false,
        catalogo: false,
        desativar_contas_whatsapp: false,
        configuracoes: false,
      }
    });
    setShowCreateModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('🔄 Criando novo usuário:', formData);
      await api.post('/gestao/users', formData);
      toast.success('Usuário criado com sucesso!');
      setShowCreateModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao criar usuário:', error);
      toast.error('Erro ao criar usuário: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleOpenEditUserModal = (userToEdit: TenantUser) => {
    console.log('🔧 handleOpenEditUserModal chamado para usuário:', userToEdit.nome, 'ID:', userToEdit.id);
    setEditingUser(userToEdit);
    
    // Permissões padrão (garantir que todas existam)
    const permissoesDefault = {
      whatsapp_api: false,
      whatsapp_qr: false,
      campanhas: false,
      templates: false,
      base_dados: false,
      nova_vida: false,
      verificar_numeros: false,
      gerenciar_proxies: false,
      lista_restricao: false,
      webhooks: false,
      relatorios: false,
      auditoria: false,
      dashboard: false,
      envio_imediato: false,
      catalogo: false,
      desativar_contas_whatsapp: false,
      configuracoes: false,
    };
    
    // Merge das permissões do usuário com as padrão
    const permissoesMerged = {
      ...permissoesDefault,
      ...(userToEdit.permissoes || {})
    };
    
    setFormData({
      nome: userToEdit.nome,
      email: userToEdit.email,
      senha: '',
      telefone: userToEdit.telefone || '',
      documento: userToEdit.documento || '',
      role: userToEdit.role,
      ativo: userToEdit.ativo,
      permissoes: permissoesMerged
    });
    
    // Buscar contas disponíveis e contas do usuário
    console.log('📞 Chamando loadWhatsAppAccounts para userId:', userToEdit.id);
    loadWhatsAppAccounts(userToEdit.id);
    
    setShowEditModal(true);
  };

  // Função para buscar contas WhatsApp disponíveis e as associadas ao usuário
  const loadWhatsAppAccounts = async (userId: number) => {
    setLoadingAccounts(true);
    try {
      // Buscar todas as contas disponíveis
      console.log('🔍 Buscando contas disponíveis...');
      const availableResponse = await api.get('/gestao/whatsapp-accounts/available');
      console.log('📦 Resposta do servidor:', availableResponse.data);
      console.log(`📱 Contas API: ${availableResponse.data.apiAccounts?.length || 0}`);
      console.log(`🔗 Instâncias QR: ${availableResponse.data.uazInstances?.length || 0}`);
      
      setAvailableApiAccounts(availableResponse.data.apiAccounts || []);
      setAvailableUazInstances(availableResponse.data.uazInstances || []);

      // Buscar contas já associadas ao usuário
      const userAccountsResponse = await api.get(`/gestao/users/${userId}/whatsapp-accounts`);
      const userApiIds = new Set<number>(userAccountsResponse.data.apiAccounts?.map((acc: any) => acc.id) || []);
      const userUazIds = new Set<number>(userAccountsResponse.data.uazInstances?.map((inst: any) => inst.id) || []);
      
      console.log(`✅ Contas API selecionadas: ${userApiIds.size}`);
      console.log(`✅ Instâncias QR selecionadas: ${userUazIds.size}`);
      
      setSelectedApiAccounts(userApiIds);
      setSelectedUazInstances(userUazIds);
    } catch (error: any) {
      console.error('❌ Erro ao buscar contas WhatsApp:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Função para salvar associações de contas WhatsApp
  const handleSaveWhatsAppAccounts = async () => {
    if (!editingUser) return;

    try {
      await api.post(`/gestao/users/${editingUser.id}/whatsapp-accounts`, {
        apiAccountIds: Array.from(selectedApiAccounts),
        uazInstanceIds: Array.from(selectedUazInstances)
      });
      toast.success('Contas WhatsApp associadas com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao salvar associações:', error);
      toast.error('Erro ao salvar associações: ' + (error.response?.data?.message || error.message));
    }
  };

  // Toggle de seleção de conta API
  const handleToggleApiAccount = (accountId: number) => {
    const newSelected = new Set(selectedApiAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedApiAccounts(newSelected);
  };

  // Toggle de seleção de instância UAZ
  const handleToggleUazInstance = (instanceId: number) => {
    const newSelected = new Set(selectedUazInstances);
    if (newSelected.has(instanceId)) {
      newSelected.delete(instanceId);
    } else {
      newSelected.add(instanceId);
    }
    setSelectedUazInstances(newSelected);
  };

  // Função para desativar contas de um usuário específico
  const handleDeactivateUserAccounts = async (userId: number, userName: string) => {
    const confirmed = confirm(`Deseja desativar TODAS as contas de WhatsApp do usuário "${userName}"?`);
    if (!confirmed) return;

    try {
      await api.post(`/gestao/users/${userId}/deactivate-accounts`);
      toast.success(`Contas do usuário "${userName}" desativadas com sucesso!`);
    } catch (error: any) {
      toast.error('Erro: ' + (error.response?.data?.message || error.message));
    }
  };

  // Função para desativar contas de todos os usuários
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatePayload: Omit<typeof formData, 'senha'> & { senha?: string } = { ...formData };
      if (!updatePayload.senha) {
        delete updatePayload.senha;
      }
      
      console.log('🔄 Atualizando usuário:', updatePayload);
      await api.put(`/gestao/users/${editingUser.id}`, updatePayload);
      toast.success('Usuário atualizado com sucesso!');
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao atualizar usuário:', error);
      toast.error('Erro ao atualizar usuário: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja excluir este usuário?')) return;

    try {
      await api.delete(`/gestao/users/${userId}`);
      toast.success('Usuário excluído com sucesso!');
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário: ' + (error.response?.data?.message || error.message));
    }
  };

  // Funções de Seleção e Desativação de Usuários
  const handleToggleSelectUser = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAllUsers = () => {
    const selectableUsers = users.filter(u => u.role !== 'admin'); // Não permitir desativar admins
    if (selectedUsers.size === selectableUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const handleDeactivateSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('Nenhum usuário selecionado!');
      return;
    }

    if (!confirm(`⚠️ Tem certeza que deseja desativar ${selectedUsers.size} usuário(s)?`)) {
      return;
    }

    setDeactivatingUsers(true);
    try {
      await api.post('/gestao/users/deactivate-multiple', {
        user_ids: Array.from(selectedUsers)
      });
      toast.success(`${selectedUsers.size} usuário(s) desativado(s) com sucesso!`);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao desativar usuários:', error);
      toast.error('Erro ao desativar usuários: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeactivatingUsers(false);
    }
  };

  const handleDeactivateAllUsers = async () => {
    const selectableUsers = users.filter(u => u.role !== 'admin');
    if (selectableUsers.length === 0) {
      toast.warning('Nenhum usuário disponível para desativar!');
      return;
    }

    if (!confirm(`🚨 ATENÇÃO: Você está prestes a desativar TODOS os ${selectableUsers.length} usuários comuns! Tem certeza?`)) {
      return;
    }

    setDeactivatingUsers(true);
    try {
      await api.post('/gestao/users/deactivate-all');
      toast.success(`${selectableUsers.length} usuário(s) desativado(s) com sucesso!`);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao desativar usuários:', error);
      toast.error('Erro ao desativar usuários: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeactivatingUsers(false);
    }
  };

  const handleActivateSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('Nenhum usuário selecionado!');
      return;
    }

    if (!confirm(`✅ Tem certeza que deseja ativar ${selectedUsers.size} usuário(s)?`)) {
      return;
    }

    setDeactivatingUsers(true);
    try {
      await api.post('/gestao/users/activate-selected', {
        userIds: Array.from(selectedUsers)
      });
      toast.success(`${selectedUsers.size} usuário(s) ativado(s) com sucesso!`);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao ativar usuários:', error);
      toast.error('Erro ao ativar usuários: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeactivatingUsers(false);
    }
  };

  const handleActivateAllUsers = async () => {
    const selectableUsers = users.filter(u => u.role !== 'admin');
    if (selectableUsers.length === 0) {
      toast.warning('Nenhum usuário disponível para ativar!');
      return;
    }

    if (!confirm(`✅ ATENÇÃO: Você está prestes a ativar TODOS os ${selectableUsers.length} usuários comuns! Tem certeza?`)) {
      return;
    }

    setDeactivatingUsers(true);
    try {
      await api.post('/gestao/users/activate-all');
      toast.success(`${selectableUsers.length} usuário(s) ativado(s) com sucesso!`);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error: any) {
      console.error('❌ Erro ao ativar usuários:', error);
      toast.error('Erro ao ativar usuários: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeactivatingUsers(false);
    }
  };

  // Funções de Avatar
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use: JPG, PNG, GIF ou WEBP');
      return;
    }

    setAvatarFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile || !editingUser) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await api.post(
        `/gestao/users/${editingUser.id}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        toast.success('Foto atualizada com sucesso!');
        setEditingUser({ ...editingUser, avatar: response.data.data.avatar });
        setAvatarFile(null);
        setAvatarPreview(null);
        loadUsers();
      }
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload da foto:', error);
      toast.error('Erro ao fazer upload da foto: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!editingUser) return;
    if (!confirm('⚠️ Tem certeza que deseja remover a foto de perfil?')) return;

    setUploadingAvatar(true);
    try {
      const response = await api.delete(`/gestao/users/${editingUser.id}/avatar`);

      if (response.data.success) {
        toast.success('Foto removida com sucesso!');
        setEditingUser({ ...editingUser, avatar: undefined });
        setAvatarFile(null);
        setAvatarPreview(null);
        loadUsers();
      }
    } catch (error: any) {
      console.error('❌ Erro ao remover foto:', error);
      toast.error('Erro ao remover foto: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Gestão de Equipe | Disparador NettSistemas</title>
      </Head>
      
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(139,92,246,0.15)_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.15)_0%,transparent_50%)]"></div>

      {/* Header */}
      <div className="relative z-10 border-b border-white/10 bg-dark-800/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* Logo do Sistema no Topo */}
          <div className="mb-6 flex justify-center">
            <SystemLogo size="medium" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Voltar
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-2xl border-2 border-emerald-500/40">
                  <FaBuilding className="text-3xl text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white">Gestão Administrativa</h1>
                  <p className="text-gray-400 text-sm">Painel de controle do administrador</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Avatar e Nome do Usuário */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                {user?.avatar ? (
                  <>
                    <img
                      src={
                        buildFileUrl(
                          user.avatar.startsWith('/uploads')
                            ? user.avatar
                            : `/uploads/avatars/${user.avatar}`
                        ) || undefined
                      }
                      alt={user.nome || 'Admin'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-lg"
                      onError={(e) => {
                        console.log('❌ Erro ao carregar avatar do usuário logado:', user.avatar);
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div 
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-2 border-emerald-400 shadow-lg"
                      style={{ display: 'none' }}
                    >
                      <FaUser className="text-white text-xl" />
                    </div>
                  </>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-2 border-emerald-400 shadow-lg">
                    <FaUser className="text-white text-xl" />
                  </div>
                )}
                <p className="text-white text-sm font-medium">
                  {user?.nome || 'Administrador'}
                </p>
              </div>

              {/* Botão Sair */}
              <button
                onClick={() => {
                  signOut();
                  router.push('/login');
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                title="Sair do sistema"
              >
                <FaSignOutAlt /> Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 border-b border-white/10 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`px-6 py-4 font-bold transition-all relative ${
                activeTab === 'usuarios'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaUsersCog className="inline mr-2" />
              Usuários
            </button>
            <button
              onClick={() => setActiveTab('financeiro')}
              className={`px-6 py-4 font-bold transition-all relative ${
                activeTab === 'financeiro'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaDollarSign className="inline mr-2" />
              Financeiro
            </button>
            <button
              onClick={() => setActiveTab('perfil')}
              className={`px-6 py-4 font-bold transition-all relative ${
                activeTab === 'perfil'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaBuilding className="inline mr-2" />
              Empresa
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Alerta - Conta Bloqueada ou Suspensa */}
      {(tenant?.status === 'blocked' || tenant?.status === 'suspended') && (
        <div className="relative z-10 max-w-7xl mx-auto px-8 pt-8">
          <div className="relative overflow-hidden bg-gradient-to-r from-red-600/90 via-red-700/90 to-red-800/90 backdrop-blur-xl border-4 border-red-500/50 rounded-3xl p-8 shadow-2xl animate-pulse-slow">
            {/* Efeito de brilho */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Ícone e Mensagem */}
              <div className="flex items-center gap-6">
                <div className="p-6 bg-white/20 rounded-full shadow-2xl">
                  <FaExclamationTriangle className="text-white text-5xl animate-bounce" />
                </div>
                <div>
                  {/* Mensagem diferente para TRIAL EXPIRADO vs PAGAMENTO VENCIDO */}
                  {tenant?.status === 'blocked' ? (
                    // TRIAL EXPIRADO (nunca pagou)
                    <>
                      <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                        🚫 Período de Teste Expirado
                      </h2>
                      <p className="text-xl text-red-100 mb-1">
                        <strong>Seu teste gratuito de 3 dias acabou.</strong>
                      </p>
                      <p className="text-lg text-red-200">
                        {(tenant?.days_until_deletion ?? 0) > 0 
                          ? `Você tem ${tenant?.days_until_deletion} dias para escolher um plano antes da conta ser deletada.`
                          : 'Escolha um plano para continuar usando o sistema.'
                        }
                      </p>
                    </>
                  ) : (
                    // PAGAMENTO VENCIDO (já foi cliente)
                    <>
                      <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                        💳 Pagamento Vencido
                      </h2>
                      <p className="text-xl text-red-100 mb-1">
                        <strong>Seu plano venceu e precisa ser renovado.</strong>
                      </p>
                      <p className="text-lg text-red-200">
                        Renove agora para continuar utilizando todas as funcionalidades do sistema.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(tenant?.status === 'blocked' ? '/escolher-plano' : '/gestao')}
                  className="px-8 py-4 bg-white hover:bg-gray-100 text-red-600 font-black text-xl rounded-2xl transition-all shadow-2xl hover:scale-105 flex items-center gap-3 whitespace-nowrap"
                >
                  <FaCreditCard className="text-2xl" />
                  {tenant?.status === 'blocked' ? 'Escolher Plano Agora' : 'Renovar Plano'}
                </button>
                <a
                  href={`https://wa.me/${supportPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all text-center flex items-center justify-center gap-2"
                >
                  <FaWhatsapp /> Falar com Suporte
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-8">
        {/* ABA USUÁRIOS */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            {/* Header Aprimorado */}
            <div className="bg-gradient-to-r from-dark-800/80 via-dark-700/80 to-dark-800/80 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-xl">
                    <FaUsers className="text-white text-3xl" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Gerenciar Usuários</h2>
                    <p className="text-gray-400 text-sm">Gerencie e controle todos os usuários da sua empresa</p>
                  </div>
                </div>
                <button
                  onClick={handleOpenCreateUserModal}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl flex items-center gap-3 transition-all shadow-xl hover:shadow-emerald-500/50 hover:scale-105 transform"
                >
                  <FaPlus className="text-xl" /> Novo Usuário
                </button>
              </div>
            </div>

            {/* Barra de Ação em Massa para Desativar Usuários */}
            {!loadingUsers && users.length > 0 && users.filter(u => u.role !== 'admin').length > 0 && (
              <div className="bg-gradient-to-r from-dark-800/90 to-dark-900/90 backdrop-blur-xl border-2 border-emerald-500/40 rounded-3xl p-8 shadow-2xl hover:shadow-emerald-500/20 transition-all">
                <div className="flex items-center justify-between gap-6 flex-wrap">
                  {/* Checkbox Selecionar Todos */}
                  <button
                    onClick={handleSelectAllUsers}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-emerald-600/30 text-white rounded-2xl transition-all border-2 border-emerald-500/40 hover:border-emerald-500/60 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 transform"
                  >
                    {selectedUsers.size === users.filter(u => u.role !== 'admin').length ? (
                      <FaCheckSquare className="text-3xl text-emerald-400" />
                    ) : (
                      <FaSquare className="text-3xl text-gray-400" />
                    )}
                    <span className="font-bold text-lg">
                      {selectedUsers.size === users.filter(u => u.role !== 'admin').length ? 'Desselecionar Todos' : 'Selecionar Todos'}
                    </span>
                  </button>

                  {/* Contador de Selecionados */}
                  {selectedUsers.size > 0 && (
                    <div className="px-6 py-3 bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 border-2 border-emerald-500/50 rounded-2xl shadow-xl">
                      <span className="text-white font-bold text-lg">
                        ✓ {selectedUsers.size} de {users.filter(u => u.role !== 'admin').length} selecionado(s)
                      </span>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex gap-4 flex-wrap">
                    <button
                      onClick={handleActivateSelectedUsers}
                      disabled={deactivatingUsers || selectedUsers.size === 0}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 hover:from-emerald-500/30 hover:to-emerald-600/30 text-emerald-300 rounded-2xl transition-all border-2 border-emerald-500/40 hover:border-emerald-500/60 font-bold shadow-lg hover:shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform"
                    >
                      {deactivatingUsers ? (
                        <FaSpinner className="text-xl animate-spin" />
                      ) : (
                        <FaCheck className="text-xl" />
                      )}
                      Ativar Selecionados
                    </button>

                    <button
                      onClick={handleDeactivateSelectedUsers}
                      disabled={deactivatingUsers || selectedUsers.size === 0}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 text-orange-300 rounded-2xl transition-all border-2 border-orange-500/40 hover:border-orange-500/60 font-bold shadow-lg hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform"
                    >
                      {deactivatingUsers ? (
                        <FaSpinner className="text-xl animate-spin" />
                      ) : (
                        <FaBan className="text-xl" />
                      )}
                      Desativar Selecionados
                    </button>

                    <button
                      onClick={handleActivateAllUsers}
                      disabled={deactivatingUsers}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600/20 to-emerald-700/20 hover:from-emerald-600/30 hover:to-emerald-700/30 text-emerald-400 rounded-2xl transition-all border-2 border-emerald-600/40 hover:border-emerald-600/60 font-bold shadow-lg hover:shadow-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform"
                    >
                      {deactivatingUsers ? (
                        <FaSpinner className="text-xl animate-spin" />
                      ) : (
                        <FaCheck className="text-xl" />
                      )}
                      Ativar TODOS
                    </button>

                    <button
                      onClick={handleDeactivateAllUsers}
                      disabled={deactivatingUsers}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-300 rounded-2xl transition-all border-2 border-red-500/40 hover:border-red-500/60 font-bold shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform"
                    >
                      {deactivatingUsers ? (
                        <FaSpinner className="text-xl animate-spin" />
                      ) : (
                        <FaBan className="text-xl" />
                      )}
                      Desativar TODOS
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingUsers ? (
              <div className="bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-16 text-center shadow-2xl">
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 animate-spin rounded-full border-t-4 border-b-4 border-emerald-500"></div>
                  <div className="absolute inset-2 animate-spin rounded-full border-t-4 border-b-4 border-emerald-400" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaUsers className="text-3xl text-emerald-500" />
                  </div>
                </div>
                <p className="text-white text-xl font-bold mb-2">Carregando usuários...</p>
                <p className="text-gray-400">Aguarde um momento</p>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border-2 border-dashed border-white/20 rounded-3xl p-16 text-center shadow-2xl">
                <div className="inline-block p-6 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl mb-6 shadow-xl">
                  <FaUser className="text-6xl text-gray-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Nenhum usuário cadastrado</h3>
                <p className="text-gray-400 text-lg mb-6">Comece criando seu primeiro usuário</p>
                <button
                  onClick={handleOpenCreateUserModal}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl flex items-center gap-3 transition-all shadow-xl hover:shadow-emerald-500/50 hover:scale-105 transform mx-auto"
                >
                  <FaPlus className="text-xl" /> Criar Primeiro Usuário
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {users.map((u) => (
                  <div 
                    key={u.id} 
                    className="group bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-6 flex-1">
                        {/* Checkbox de Seleção (apenas para usuários comuns) */}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleSelectUser(u.id)}
                            className="flex-shrink-0 p-2 rounded-xl hover:bg-white/5 transition-all"
                          >
                            {selectedUsers.has(u.id) ? (
                              <FaCheckSquare className="text-5xl text-emerald-400 hover:text-emerald-300 transition-all hover:scale-110 transform drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                            ) : (
                              <FaSquare className="text-5xl text-gray-600 hover:text-gray-500 transition-all hover:scale-110 transform" />
                            )}
                          </button>
                        )}
                        
                        {u.avatar ? (
                          <div className="relative">
                            <img
                              src={
                                buildFileUrl(
                                  u.avatar.startsWith('/uploads')
                                    ? u.avatar
                                    : `/uploads/avatars/${u.avatar}`
                                ) || undefined
                              }
                              alt={u.nome}
                              className="w-20 h-20 rounded-2xl object-cover border-4 border-emerald-400 shadow-2xl group-hover:scale-110 transition-transform duration-300"
                              onError={(e) => {
                                console.log('❌ Erro ao carregar avatar:', u.avatar);
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                            {u.role === 'admin' && (
                              <div className="absolute -top-2 -right-2 p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full shadow-lg">
                                <FaCrown className="text-white text-xs" />
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div 
                          className={`relative w-20 h-20 rounded-2xl flex items-center justify-center border-4 shadow-2xl group-hover:scale-110 transition-transform duration-300 ${
                            u.role === 'admin' 
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400' 
                              : 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400'
                          }`}
                          style={{ display: u.avatar ? 'none' : 'flex' }}
                        >
                          {u.role === 'admin' ? (
                            <>
                              <FaCrown className="text-white text-3xl" />
                              <div className="absolute -top-2 -right-2 p-2 bg-gradient-to-br from-orange-600 to-orange-700 rounded-full shadow-lg">
                                <FaCrown className="text-white text-xs" />
                              </div>
                            </>
                          ) : (
                            <FaUser className="text-white text-3xl" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-black text-white">{u.nome}</h3>
                            {u.role === 'admin' ? (
                              <span className="px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-2 border-orange-500/40 text-orange-300 flex items-center gap-2 shadow-lg">
                                <FaCrown className="text-lg" /> Admin
                              </span>
                            ) : (
                              <span className="px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-2 border-blue-500/40 text-blue-300 flex items-center gap-2 shadow-lg">
                                <FaUser /> Usuário
                              </span>
                            )}
                            {u.ativo ? (
                              <span className="px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-500/40 text-green-300 shadow-lg">
                                ✓ Ativo
                              </span>
                            ) : (
                              <span className="px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500/40 text-red-300 shadow-lg">
                                ✕ Inativo
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-base mb-3 flex items-center gap-2">
                            <span className="text-emerald-400">✉</span> {u.email}
                          </p>
                          {u.permissoes && Object.keys(u.permissoes).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {Object.entries(u.permissoes).map(([key, value]) => 
                                value && (
                                  <span key={key} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 text-emerald-300 shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                    ✓ {PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeactivateUserAccounts(u.id, u.nome)}
                          className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 text-orange-300 rounded-2xl transition-all border-2 border-orange-500/40 hover:border-orange-500/60 shadow-lg hover:shadow-orange-500/50 hover:scale-110 transform"
                          title="Desativar contas WhatsApp deste usuário"
                        >
                          <FaBan className="text-xl" />
                        </button>
                        <button
                          onClick={() => handleOpenEditUserModal(u)}
                          className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-300 rounded-2xl transition-all border-2 border-blue-500/40 hover:border-blue-500/60 shadow-lg hover:shadow-blue-500/50 hover:scale-110 transform"
                          title="Editar usuário"
                        >
                          <FaEdit className="text-xl" />
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-300 rounded-2xl transition-all border-2 border-red-500/40 hover:border-red-500/60 shadow-lg hover:shadow-red-500/50 hover:scale-110 transform"
                            title="Excluir usuário"
                          >
                            <FaTrash className="text-xl" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            {/* Informações Financeiras Completas */}
            <FinancialInfoPanel />

            {/* Limites e Uso - MELHORADO */}
            <div className="relative overflow-hidden bg-gradient-to-br from-dark-800/90 via-blue-900/20 to-dark-800/90 backdrop-blur-xl border-4 border-blue-500/30 rounded-[2rem] p-10 shadow-2xl hover:shadow-blue-500/30 transition-all">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-2xl shadow-xl">
                    <FaDollarSign className="text-white text-3xl" />
                  </div>
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                    Limites e Uso
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Limite de Usuários */}
                <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-900/30 to-dark-800/80 backdrop-blur-sm rounded-3xl p-8 border-2 border-emerald-500/30 hover:border-emerald-500/60 transition-all hover:scale-105 transform shadow-xl hover:shadow-emerald-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-lg">
                          <FaUsers className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Usuários</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                          {currentUsage.total_usuarios}
                        </div>
                        <div className="text-sm text-gray-400 font-bold">
                          de {planLimits.limite_usuarios || '∞'}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-dark-600/50 rounded-full h-4 shadow-inner overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 h-4 rounded-full transition-all duration-1000 shadow-lg shadow-emerald-500/50 relative overflow-hidden"
                        style={{
                          width: `${Math.min(
                            100,
                            planLimits.limite_usuarios ? (currentUsage.total_usuarios / planLimits.limite_usuarios) * 100 : 0
                          )}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Limite de Contas WhatsApp */}
                <div className="group relative overflow-hidden bg-gradient-to-br from-blue-900/30 to-dark-800/80 backdrop-blur-sm rounded-3xl p-8 border-2 border-blue-500/30 hover:border-blue-500/60 transition-all hover:scale-105 transform shadow-xl hover:shadow-blue-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg">
                          <FaChartLine className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Contas WhatsApp</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                          {currentUsage.total_contas}
                        </div>
                        <div className="text-sm text-gray-400 font-bold">
                          de {planLimits.limite_contas_whatsapp || '∞'}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-dark-600/50 rounded-full h-4 shadow-inner overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 h-4 rounded-full transition-all duration-1000 shadow-lg shadow-blue-500/50 relative overflow-hidden"
                        style={{
                          width: `${Math.min(
                            100,
                            planLimits.limite_contas_whatsapp ? (currentUsage.total_contas / planLimits.limite_contas_whatsapp) * 100 : 0
                          )}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Limite de Campanhas */}
                <div className="group relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-dark-800/80 backdrop-blur-sm rounded-3xl p-8 border-2 border-purple-500/30 hover:border-purple-500/60 transition-all hover:scale-105 transform shadow-xl hover:shadow-purple-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-lg">
                          <FaChartLine className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Campanhas (mês)</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                          {currentUsage.campanhas_mes}
                        </div>
                        <div className="text-sm text-gray-400 font-bold">
                          de {planLimits.limite_campanhas_mes || '∞'}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-dark-600/50 rounded-full h-4 shadow-inner overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 h-4 rounded-full transition-all duration-1000 shadow-lg shadow-purple-500/50 relative overflow-hidden"
                        style={{
                          width: `${Math.min(
                            100,
                            planLimits.limite_campanhas_mes ? (currentUsage.campanhas_mes / planLimits.limite_campanhas_mes) * 100 : 0
                          )}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Limite de Mensagens */}
                <div className="group relative overflow-hidden bg-gradient-to-br from-orange-900/30 to-dark-800/80 backdrop-blur-sm rounded-3xl p-8 border-2 border-orange-500/30 hover:border-orange-500/60 transition-all hover:scale-105 transform shadow-xl hover:shadow-orange-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl shadow-lg">
                          <FaChartLine className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Mensagens (dia)</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]">
                          {currentUsage.mensagens_dia}
                        </div>
                        <div className="text-sm text-gray-400 font-bold">
                          de {planLimits.limite_mensagens_dia || '∞'}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-dark-600/50 rounded-full h-4 shadow-inner overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 h-4 rounded-full transition-all duration-1000 shadow-lg shadow-orange-500/50 relative overflow-hidden"
                        style={{
                          width: `${Math.min(
                            100,
                            planLimits.limite_mensagens_dia ? (currentUsage.mensagens_dia / planLimits.limite_mensagens_dia) * 100 : 0
                          )}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Funcionalidades do Plano - MELHORADO */}
            <div className="relative overflow-hidden bg-gradient-to-br from-dark-800/90 via-emerald-900/20 to-dark-800/90 backdrop-blur-xl border-4 border-emerald-500/30 rounded-[2rem] p-10 shadow-2xl hover:shadow-emerald-500/30 transition-all">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-xl">
                    <FaChartLine className="text-white text-3xl" />
                  </div>
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    Funcionalidades do Seu Plano
                  </h2>
                </div>
                
                {loadingFuncionalidades ? (
                  <div className="text-center py-12">
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <div className="absolute inset-0 animate-spin rounded-full border-t-4 border-b-4 border-emerald-500"></div>
                      <div className="absolute inset-2 animate-spin rounded-full border-t-4 border-b-4 border-emerald-400" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
                    </div>
                    <p className="text-white text-lg font-bold">Carregando funcionalidades...</p>
                  </div>
                ) : funcionalidades && Object.keys(funcionalidades).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(funcionalidades).map(([key, value]) => (
                      <div
                        key={key}
                        className={`group relative overflow-hidden p-6 rounded-2xl border-2 transition-all transform hover:scale-105 shadow-xl ${
                          value
                            ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border-emerald-500/50 hover:border-emerald-400/70 hover:shadow-emerald-500/50'
                            : 'bg-gradient-to-br from-gray-900/40 to-gray-800/20 border-gray-600/30 hover:border-gray-500/50'
                        }`}
                      >
                        <div className={`absolute inset-0 ${value ? 'bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent' : ''} group-hover:animate-shimmer`}></div>
                        
                        <div className="relative z-10 flex items-center gap-4">
                          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg ${
                            value
                              ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                              : 'bg-gradient-to-br from-gray-600 to-gray-700'
                          }`}>
                            {value ? '✅' : '🔒'}
                          </div>
                          <p className={`text-lg font-black capitalize ${
                            value ? 'text-white' : 'text-gray-400'
                          }`}>
                            {PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}
                          </p>
                        </div>
                        
                        {value && (
                          <div className="absolute top-2 right-2">
                            <span className="px-3 py-1 bg-emerald-500 text-emerald-900 text-xs font-black rounded-full">
                              ATIVO
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="inline-block p-6 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl mb-6 shadow-xl">
                      <FaChartLine className="text-6xl text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-xl font-bold">Nenhuma funcionalidade configurada para este plano.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA EMPRESA */}
        {activeTab === 'perfil' && (
          <div className="space-y-6">
            {/* Dados da Empresa */}
            <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                <FaBuilding className="text-orange-400" /> Dados da Empresa
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    nome: formData.get('nome_empresa') as string,
                    email: formData.get('email_empresa') as string,
                    telefone: formData.get('telefone_empresa') as string,
                    documento: formData.get('documento_empresa') as string,
                  };

                  try {
                    console.log('📤 Enviando dados:', data);
                    const response = await api.put('/users/profile/tenant', data);
                    console.log('✅ Resposta:', response.data);
                    
                    // Atualizar o contexto com os novos dados do tenant
                    if (response.data.success && response.data.data) {
                      updateTenant(response.data.data);
                      console.log('✅ Contexto do tenant atualizado');
                    }
                    
                    toast.success('Dados da empresa atualizados com sucesso!');
                  } catch (error: any) {
                    console.error('❌ Erro ao atualizar:', error);
                    toast.error('Erro ao atualizar dados da empresa: ' + (error.response?.data?.message || error.message));
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Nome da Empresa</label>
                  <input
                    type="text"
                    name="nome_empresa"
                    defaultValue={tenant?.nome || ''}
                    required
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Email da Empresa</label>
                  <input
                    type="email"
                    name="email_empresa"
                    defaultValue={tenant?.email || ''}
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Telefone da Empresa</label>
                  <input
                    type="text"
                    name="telefone_empresa"
                    defaultValue={tenant?.telefone || ''}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">CNPJ / CPF</label>
                  <input
                    type="text"
                    name="documento_empresa"
                    defaultValue={tenant?.documento || ''}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/30"
                >
                  🏢 Salvar Dados da Empresa
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CRIAR USUÁRIO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-white/10 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">Criar Novo Usuário</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Senha</label>
                <input
                  type="password"
                  required
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Função</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="user">Usuário Comum</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-3">Permissões</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(formData.permissoes).map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissoes[key as keyof typeof formData.permissoes]}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissoes: {
                            ...formData.permissoes,
                            [key]: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-white/10 bg-dark-700/50 checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer"
                      />
                      <span className="text-white text-sm">{PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUÁRIO */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-white/10 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">Editar Usuário</h2>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              {/* Foto de Perfil */}
              <div className="bg-dark-700/30 rounded-2xl p-6 border-2 border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">📷 Foto de Perfil</h3>
                <div className="flex items-start gap-6">
                  {/* Foto Atual ou Preview */}
                  <div className="flex-shrink-0 relative">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Preview"
                        className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 shadow-lg"
                      />
                    ) : editingUser.avatar ? (
                      <>
                        <img
                          src={
                            buildFileUrl(
                              editingUser.avatar.startsWith('/uploads')
                                ? editingUser.avatar
                                : `/uploads/avatars/${editingUser.avatar}`
                            ) || undefined
                          }
                          alt={editingUser.nome}
                          className="w-32 h-32 rounded-full object-cover border-4 border-emerald-400 shadow-lg"
                          onError={(e) => {
                            console.log('❌ Erro ao carregar avatar no modal:', editingUser.avatar);
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <div 
                          className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-4 border-emerald-400 shadow-lg"
                          style={{ display: 'none' }}
                        >
                          <FaUser className="text-white text-4xl" />
                        </div>
                      </>
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center border-4 border-emerald-400 shadow-lg">
                        <FaUser className="text-white text-4xl" />
                      </div>
                    )}
                  </div>

                  {/* Controles */}
                  <div className="flex-1 space-y-3">
                    <p className="text-gray-300 text-sm">
                      Como administrador, você pode alterar a foto de perfil de qualquer usuário.
                    </p>
                    
                    {/* Botão Escolher Foto */}
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      <div className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-sm">
                        <FaCamera /> Escolher Nova Foto
                      </div>
                    </label>

                    {/* Botão Enviar (só aparece se tiver arquivo selecionado) */}
                    {avatarFile && (
                      <button
                        type="button"
                        onClick={handleUploadAvatar}
                        disabled={uploadingAvatar}
                        className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                      >
                        {uploadingAvatar ? '⏳ Enviando...' : '✅ Confirmar Upload'}
                      </button>
                    )}

                    {/* Botão Remover (só aparece se tiver avatar) */}
                    {editingUser.avatar && !avatarFile && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar}
                        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                      >
                        <FaTrash /> Remover Foto
                      </button>
                    )}

                    <p className="text-gray-500 text-xs">
                      Formatos: JPG, PNG, GIF, WEBP • Tamanho máximo: 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone || ''}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">CPF</label>
                  <input
                    type="text"
                    value={formData.documento || ''}
                    onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Nova Senha (deixe em branco para não alterar)</label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">Função</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  className="w-full px-4 py-3 bg-dark-700/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="user">Usuário Comum</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-5 h-5 rounded border-2 border-white/10 bg-dark-700/50 checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer"
                  />
                  <span className="text-white font-bold">Usuário Ativo</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-3">Permissões</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(formData.permissoes).map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissoes[key as keyof typeof formData.permissoes]}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissoes: {
                            ...formData.permissoes,
                            [key]: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-2 border-white/10 bg-dark-700/50 checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer"
                      />
                      <span className="text-white text-sm">{PERMISSION_LABELS[key] || key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Botão para desativar contas do usuário */}
              {/* Seção de Contas WhatsApp */}
              <div className="bg-dark-700/30 rounded-2xl p-6 border-2 border-emerald-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">📱 Contas WhatsApp</h3>
                  <button
                    type="button"
                    onClick={handleSaveWhatsAppAccounts}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-all text-sm"
                  >
                    💾 Salvar Contas
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Selecione quais contas WhatsApp este usuário pode acessar e utilizar no sistema.
                </p>

                {loadingAccounts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-emerald-500 border-solid mx-auto"></div>
                    <p className="text-gray-400 mt-2 text-sm">Carregando contas...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Contas API Oficial */}
                    {availableApiAccounts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-emerald-400 text-sm">API Oficial (Meta)</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                          {availableApiAccounts.map((account) => (
                            <label
                              key={account.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                selectedApiAccounts.has(account.id)
                                  ? 'bg-emerald-500/20 border-2 border-emerald-500/60'
                                  : 'bg-dark-700/50 border-2 border-white/10 hover:border-white/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedApiAccounts.has(account.id)}
                                onChange={() => handleToggleApiAccount(account.id)}
                                className="w-5 h-5 rounded cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className="text-white font-bold text-sm">{account.name}</p>
                                <p className="text-gray-400 text-xs">{account.phone_number}</p>
                              </div>
                              {account.is_active ? (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Ativa</span>
                              ) : (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Inativa</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instâncias UAZ (QR) */}
                    {availableUazInstances.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-blue-400 text-sm">QR Connect (UAZ)</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                          {availableUazInstances.map((instance) => (
                            <label
                              key={instance.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                selectedUazInstances.has(instance.id)
                                  ? 'bg-blue-500/20 border-2 border-blue-500/60'
                                  : 'bg-dark-700/50 border-2 border-white/10 hover:border-white/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUazInstances.has(instance.id)}
                                onChange={() => handleToggleUazInstance(instance.id)}
                                className="w-5 h-5 rounded cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className="text-white font-bold text-sm">{instance.name}</p>
                                <p className="text-gray-400 text-xs">{instance.phone || 'Sem número'}</p>
                              </div>
                              {instance.is_active ? (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Ativa</span>
                              ) : (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Inativa</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {availableApiAccounts.length === 0 && availableUazInstances.length === 0 && (
                      <p className="text-gray-500 text-center py-8 text-sm">
                        Nenhuma conta WhatsApp disponível no sistema.
                      </p>
                    )}

                    <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-3 mt-4">
                      <p className="text-blue-300 text-xs">
                        <strong>💡 Dica:</strong> O usuário só poderá visualizar e utilizar as contas selecionadas acima. 
                        {selectedApiAccounts.size + selectedUazInstances.size > 0 
                          ? ` Atualmente: ${selectedApiAccounts.size + selectedUazInstances.size} conta(s) selecionada(s).`
                          : ' Nenhuma conta selecionada significa acesso a todas (comportamento padrão para admins).'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t-2 border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    if (editingUser) {
                      handleDeactivateUserAccounts(editingUser.id, editingUser.nome);
                    }
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  <FaBan /> Desativar Todas as Contas WhatsApp deste Usuário
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
}











