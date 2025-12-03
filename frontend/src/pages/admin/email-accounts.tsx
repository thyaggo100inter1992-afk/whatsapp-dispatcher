import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaEnvelope, FaPlus, FaEdit, FaTrash, FaStar, FaRegStar, FaServer, FaPaperPlane, FaCog, FaEnvelopeOpen, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface EmailAccount {
  id: number;
  name: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  email_from: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function EmailAccounts() {
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const [form, setForm] = useState({
    name: '',
    provider: 'hostinger',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    email_from: '',
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/email-accounts');
      setAccounts(response.data.accounts);
    } catch (error: any) {
      notification.error('Erro ao carregar contas de email');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: string) => {
    if (provider === 'hostinger') {
      setForm({
        ...form,
        provider: 'hostinger',
        smtp_host: 'smtp.hostinger.com',
        smtp_port: 587,
        smtp_secure: false
      });
    } else if (provider === 'gmail') {
      setForm({
        ...form,
        provider: 'gmail',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_secure: false
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!form.name || !form.email_from) {
        notification.error('Nome e email são obrigatórios');
        return;
      }

      if (isEditing && editingId) {
        await api.put(`/admin/email-accounts/${editingId}`, form);
        notification.success('Conta atualizada com sucesso!');
      } else {
        await api.post('/admin/email-accounts', form);
        notification.success('Conta criada com sucesso!');
      }

      setIsCreating(false);
      setIsEditing(false);
      setEditingId(null);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      notification.error(error.response?.data?.message || 'Erro ao salvar conta');
      console.error(error);
    }
  };

  const handleEdit = (account: EmailAccount) => {
    setForm({
      name: account.name,
      provider: account.provider,
      smtp_host: account.smtp_host,
      smtp_port: account.smtp_port,
      smtp_secure: account.smtp_secure,
      smtp_user: account.smtp_user,
      smtp_pass: '',
      email_from: account.email_from,
      is_default: account.is_default,
      is_active: account.is_active
    });
    setEditingId(account.id);
    setIsEditing(true);
    setIsCreating(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm(
      'Confirmar Exclusão',
      'Tem certeza que deseja deletar esta conta? Templates associados usarão a conta padrão.'
    );

    if (confirmed) {
      try {
        await api.delete(`/admin/email-accounts/${id}`);
        notification.success('Conta deletada com sucesso!');
        loadAccounts();
      } catch (error: any) {
        notification.error(error.response?.data?.message || 'Erro ao deletar conta');
        console.error(error);
      }
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.patch(`/admin/email-accounts/${id}/set-default`);
      notification.success('Conta definida como padrão!');
      loadAccounts();
    } catch (error: any) {
      notification.error('Erro ao definir conta padrão');
      console.error(error);
    }
  };

  const handleTest = async (id: number) => {
    if (!testEmail) {
      notification.error('Digite um email para teste');
      return;
    }

    try {
      setTestingEmail(true);
      await api.post(`/admin/email-accounts/${id}/test`, { test_email: testEmail });
      notification.success('Email de teste enviado! Verifique sua caixa de entrada.');
      setTestEmail('');
    } catch (error: any) {
      notification.error(error.response?.data?.message || 'Erro ao enviar email de teste');
      console.error(error);
    } finally {
      setTestingEmail(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      provider: 'hostinger',
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: false,
      smtp_user: '',
      smtp_pass: '',
      email_from: '',
      is_default: false,
      is_active: true
    });
  };

  return (
    <AdminLayout>
      <ConfirmDialog />
      
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FaEnvelope className="text-3xl text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white">Contas de Email</h1>
                  <p className="text-white/80 mt-1">Gerencie múltiplas contas SMTP para envio de emails</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/admin/credentials?tab=email')}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all flex items-center gap-2 backdrop-blur-sm"
                >
                  <FaCog /> Configuração Antiga
                </button>
                <button
                  onClick={() => router.push('/admin/email-templates')}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition-all flex items-center gap-2 backdrop-blur-sm"
                >
                  <FaEnvelopeOpen /> Templates
                </button>
                <button
                  onClick={() => setIsCreating(!isCreating)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                  <FaPlus /> Nova Conta
                </button>
              </div>
            </div>
          </div>

          {/* Form */}
          {isCreating && (
            <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 border border-white/30">
              <h2 className="text-2xl font-black text-white mb-6">
                {isEditing ? 'Editar Conta' : 'Nova Conta de Email'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome e Provider */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-bold mb-2">Nome da Conta *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                      placeholder="Ex: Suporte Nett Sistemas"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">Provedor</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleProviderSelect('hostinger')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          form.provider === 'hostinger'
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        }`}
                      >
                        Hostinger
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProviderSelect('gmail')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          form.provider === 'gmail'
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        }`}
                      >
                        Gmail
                      </button>
                    </div>
                  </div>
                </div>

                {/* SMTP Config */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-white font-bold mb-2">Servidor SMTP</label>
                    <input
                      type="text"
                      value={form.smtp_host}
                      onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                      placeholder="smtp.exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">Porta</label>
                    <input
                      type="number"
                      value={form.smtp_port}
                      onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">Secure (SSL/TLS)</label>
                    <select
                      value={form.smtp_secure ? 'true' : 'false'}
                      onChange={(e) => setForm({ ...form, smtp_secure: e.target.value === 'true' })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                    >
                      <option value="false">Não (587)</option>
                      <option value="true">Sim (465)</option>
                    </select>
                  </div>
                </div>

                {/* User and Password */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-bold mb-2">Usuário SMTP</label>
                    <input
                      type="text"
                      value={form.smtp_user}
                      onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                      placeholder="usuario@dominio.com"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-2">
                      Senha {isEditing && '(deixe vazio para não alterar)'}
                    </label>
                    <input
                      type="password"
                      value={form.smtp_pass}
                      onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                      className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Email From */}
                <div>
                  <label className="block text-white font-bold mb-2">Email Remetente *</label>
                  <input
                    type="email"
                    value={form.email_from}
                    onChange={(e) => setForm({ ...form, email_from: e.target.value })}
                    className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white"
                    placeholder="naoresponda@dominio.com"
                    required
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span>Definir como padrão</span>
                  </label>

                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span>Conta ativa</span>
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all"
                  >
                    {isEditing ? 'Atualizar' : 'Criar'} Conta
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de Contas */}
          {loading ? (
            <div className="text-center text-white text-xl py-12">Carregando...</div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-2xl font-bold text-white">{account.name}</h3>
                        {account.is_default && (
                          <span className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-bold flex items-center gap-1">
                            <FaStar /> Padrão
                          </span>
                        )}
                        {account.is_active ? (
                          <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold flex items-center gap-1">
                            <FaCheckCircle /> Ativa
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold flex items-center gap-1">
                            <FaTimesCircle /> Inativa
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-white/90">
                        <div>
                          <p className="text-sm text-white/60">Provedor</p>
                          <p className="font-bold capitalize">{account.provider}</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/60">Email Remetente</p>
                          <p className="font-bold">{account.email_from}</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/60">Servidor SMTP</p>
                          <p className="font-bold">{account.smtp_host}:{account.smtp_port}</p>
                        </div>
                        <div>
                          <p className="text-sm text-white/60">Usuário</p>
                          <p className="font-bold">{account.smtp_user}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {!account.is_default && (
                        <button
                          onClick={() => handleSetDefault(account.id)}
                          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all flex items-center gap-2"
                          title="Definir como padrão"
                        >
                          <FaStar /> Tornar Padrão
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleEdit(account)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2"
                      >
                        <FaEdit /> Editar
                      </button>
                      
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-2"
                      >
                        <FaTrash /> Deletar
                      </button>
                    </div>
                  </div>

                  {/* Test Email */}
                  <div className="mt-6 pt-6 border-t border-white/20">
                    <div className="flex gap-3">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="flex-1 p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50"
                        placeholder="Digite um email para teste..."
                      />
                      <button
                        onClick={() => handleTest(account.id)}
                        disabled={testingEmail}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <FaPaperPlane /> {testingEmail ? 'Enviando...' : 'Testar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {accounts.length === 0 && (
                <div className="text-center text-white/60 py-12">
                  <FaEnvelope className="text-6xl mx-auto mb-4 opacity-50" />
                  <p className="text-xl">Nenhuma conta de email cadastrada</p>
                  <p className="text-sm mt-2">Clique em "Nova Conta" para começar</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

