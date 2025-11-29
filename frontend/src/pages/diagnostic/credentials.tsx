import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import styles from './credentials.module.css';

interface DiagnosticData {
  success: boolean;
  diagnostic: {
    tenant: {
      id: number;
      nome: string;
      slug: string;
    };
    credencial_configurada: {
      id: number | null;
      nome: string;
      url: string;
      padrao: boolean;
      ativa: boolean;
    };
    credencial_em_uso: {
      serverUrl: string;
      adminToken: string;
      credentialId: number;
      credentialName: string;
    } | { error: string };
    instancias: {
      total: number;
      conectadas: number;
      desconectadas: number;
      com_problema: number;
    };
    verificacao_detalhada: Array<{
      id: number;
      name: string;
      token: string;
      is_connected: boolean;
      status: string;
      phone_number: string | null;
      existe_na_conta_atual: boolean;
      problema: string | null;
    }>;
    status: 'OK' | 'COM_PROBLEMAS';
    recomendacao: string;
  };
}

const CredentialsDiagnostic: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostic = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<DiagnosticData>('/diagnostic/credentials/tenant-info');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao buscar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  if (loading) {
    return (
      <div className={styles.diagnosticContainer}>
        <h1>🔍 Diagnóstico de Credenciais UAZAP</h1>
        <div className={styles.loading}>Carregando diagnóstico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.diagnosticContainer}>
        <h1>🔍 Diagnóstico de Credenciais UAZAP</h1>
        <div className={styles.errorBox}>
          <h3>❌ Erro ao carregar diagnóstico</h3>
          <p>{error}</p>
          <button onClick={fetchDiagnostic}>🔄 Tentar Novamente</button>
        </div>
      </div>
    );
  }

  if (!data || !data.diagnostic) {
    return (
      <div className={styles.diagnosticContainer}>
        <h1>🔍 Diagnóstico de Credenciais UAZAP</h1>
        <div className={styles.errorBox}>Nenhum dado disponível</div>
      </div>
    );
  }

  const { diagnostic } = data;
  const hasProblems = diagnostic.status === 'COM_PROBLEMAS';

  return (
    <div className={styles.diagnosticContainer}>
      <div className={styles.diagnosticHeader}>
        <h1>🔍 Diagnóstico de Credenciais UAZAP</h1>
        <button onClick={fetchDiagnostic} className={styles.refreshBtn}>
          🔄 Atualizar
        </button>
      </div>

      {/* Status Geral */}
      <div className={`${styles.statusBox} ${hasProblems ? styles.statusError : styles.statusOk}`}>
        <h2>{hasProblems ? '⚠️ PROBLEMAS DETECTADOS' : '✅ TUDO OK'}</h2>
        <p>{diagnostic.recomendacao}</p>
      </div>

      {/* Informações do Tenant */}
      <div className={styles.infoSection}>
        <h3>👤 Informações do Tenant</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>ID:</strong>
            <span>{diagnostic.tenant.id}</span>
          </div>
          <div className={styles.infoItem}>
            <strong>Nome:</strong>
            <span>{diagnostic.tenant.nome}</span>
          </div>
          <div className={styles.infoItem}>
            <strong>Slug:</strong>
            <span>{diagnostic.tenant.slug}</span>
          </div>
        </div>
      </div>

      {/* Credencial Configurada */}
      <div className={styles.infoSection}>
        <h3>🔑 Credencial UAZAP Configurada</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>Nome:</strong>
            <span>{diagnostic.credencial_configurada.nome}</span>
          </div>
          <div className={styles.infoItem}>
            <strong>URL:</strong>
            <span className={styles.urlText}>{diagnostic.credencial_configurada.url}</span>
          </div>
          <div className={styles.infoItem}>
            <strong>Padrão:</strong>
            <span>{diagnostic.credencial_configurada.padrao ? '✅ Sim' : '❌ Não'}</span>
          </div>
          <div className={styles.infoItem}>
            <strong>Ativa:</strong>
            <span>{diagnostic.credencial_configurada.ativa ? '✅ Sim' : '❌ Não'}</span>
          </div>
        </div>
      </div>

      {/* Credencial em Uso */}
      <div className={styles.infoSection}>
        <h3>🔐 Credencial Sendo Usada (Runtime)</h3>
        {'error' in diagnostic.credencial_em_uso ? (
          <div className={styles.errorBox}>
            <p>❌ Erro: {diagnostic.credencial_em_uso.error}</p>
          </div>
        ) : (
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <strong>Nome:</strong>
              <span>{diagnostic.credencial_em_uso.credentialName}</span>
            </div>
            <div className={styles.infoItem}>
              <strong>URL:</strong>
              <span className={styles.urlText}>{diagnostic.credencial_em_uso.serverUrl}</span>
            </div>
            <div className={styles.infoItem}>
              <strong>ID:</strong>
              <span>{diagnostic.credencial_em_uso.credentialId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Resumo das Instâncias */}
      <div className={styles.infoSection}>
        <h3>📱 Resumo das Instâncias</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{diagnostic.instancias.total}</div>
            <div className={styles.statLabel}>Total</div>
          </div>
          <div className={`${styles.statCard} ${styles.statSuccess}`}>
            <div className={styles.statValue}>{diagnostic.instancias.conectadas}</div>
            <div className={styles.statLabel}>Conectadas</div>
          </div>
          <div className={`${styles.statCard} ${styles.statWarning}`}>
            <div className={styles.statValue}>{diagnostic.instancias.desconectadas}</div>
            <div className={styles.statLabel}>Desconectadas</div>
          </div>
          <div className={`${styles.statCard} ${diagnostic.instancias.com_problema > 0 ? styles.statError : ''}`}>
            <div className={styles.statValue}>{diagnostic.instancias.com_problema}</div>
            <div className={styles.statLabel}>Com Problema</div>
          </div>
        </div>
      </div>

      {/* Verificação Detalhada */}
      {diagnostic.verificacao_detalhada.length > 0 && (
        <div className={styles.infoSection}>
          <h3>🔍 Verificação Detalhada das Instâncias</h3>
          <div className={styles.instancesTable}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Telefone</th>
                  <th>Existe na Conta?</th>
                  <th>Problema</th>
                </tr>
              </thead>
              <tbody>
                {diagnostic.verificacao_detalhada.map((inst) => (
                  <tr key={inst.id} className={inst.problema ? styles.rowError : ''}>
                    <td>{inst.id}</td>
                    <td>{inst.name}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles['status' + inst.status.charAt(0).toUpperCase() + inst.status.slice(1)]}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td>{inst.phone_number || '-'}</td>
                    <td>
                      {inst.existe_na_conta_atual ? (
                        <span className={styles.badgeSuccess}>✅ Sim</span>
                      ) : (
                        <span className={styles.badgeError}>❌ Não</span>
                      )}
                    </td>
                    <td>
                      {inst.problema ? (
                        <span className={styles.problemText}>{inst.problema}</span>
                      ) : (
                        <span className={styles.okText}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instruções de Correção */}
      {hasProblems && (
        <div className={`${styles.infoSection} ${styles.instructionsSection}`}>
          <h3>🛠️ Como Corrigir</h3>
          <div className={styles.instructions}>
            <p><strong>Você tem 2 opções:</strong></p>
            
            <div className={styles.optionBox}>
              <h4>Opção 1: Deletar e Recriar as Instâncias</h4>
              <ol>
                <li>Vá em "Gerenciar Conexões"</li>
                <li>Delete as instâncias com problema</li>
                <li>Crie novas conexões</li>
                <li>Leia o QR Code novamente</li>
              </ol>
            </div>

            <div className={styles.optionBox}>
              <h4>Opção 2: Alterar a Credencial do Tenant</h4>
              <ol>
                <li>Contate o administrador do sistema</li>
                <li>Peça para alterar a credencial UAZAP do seu tenant</li>
                <li>Selecione a credencial correta (onde as instâncias foram criadas)</li>
                <li>Aguarde alguns segundos e atualize esta página</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialsDiagnostic;

