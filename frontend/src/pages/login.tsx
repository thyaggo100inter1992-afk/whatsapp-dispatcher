import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaWhatsapp, FaEnvelope, FaLock, FaSignInAlt, FaUserPlus } from 'react-icons/fa';
import SystemLogo from '@/components/SystemLogo';

export default function Login() {
  const { signIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const { reason } = router.query;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Mensagens baseadas no reason
  const getReasonMessage = () => {
    switch (reason) {
      case 'inactivity':
        return {
          icon: '⏱️',
          title: 'Sessão Expirada por Inatividade',
          message: 'Sua sessão foi encerrada após 1 hora de inatividade. Faça login novamente para continuar.',
          color: 'orange'
        };
      case 'session_invalid':
        return {
          icon: '🔐',
          title: 'Login em Outro Dispositivo',
          message: 'Você fez login em outro dispositivo. Por segurança, esta sessão foi encerrada.',
          color: 'blue'
        };
      case 'tenant_blocked':
        return {
          icon: '🚫',
          title: 'Conta Desativada',
          message: 'Sua conta foi desativada. Entre em contato com o suporte se achar que isso é um erro.',
          color: 'red'
        };
      case 'token_expired':
        return {
          icon: '⏰',
          title: 'Sessão Expirada',
          message: 'Sua sessão expirou. Faça login novamente para continuar.',
          color: 'yellow'
        };
      default:
        return null;
    }
  };

  const reasonMessage = getReasonMessage();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // Redirecionamento é feito automaticamente no AuthContext
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-white text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Login - Disparador NettSistemas</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          
          {/* Logo e Título */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-8">
              <SystemLogo size="large" />
            </div>
            <p className="text-xl text-gray-400 font-medium">
              Faça login para acessar sua conta
            </p>
          </div>

          {/* Mensagem de Aviso (reason) */}
          {reasonMessage && (
            <div className={
              reasonMessage.color === 'orange' ? 'bg-orange-500/20 border-2 border-orange-500/40 rounded-2xl p-6 mb-6 backdrop-blur-xl' :
              reasonMessage.color === 'blue' ? 'bg-blue-500/20 border-2 border-blue-500/40 rounded-2xl p-6 mb-6 backdrop-blur-xl' :
              reasonMessage.color === 'red' ? 'bg-red-500/20 border-2 border-red-500/40 rounded-2xl p-6 mb-6 backdrop-blur-xl' :
              'bg-yellow-500/20 border-2 border-yellow-500/40 rounded-2xl p-6 mb-6 backdrop-blur-xl'
            }>
              <div className="flex items-start gap-4">
                <div className="text-4xl">{reasonMessage.icon}</div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl mb-2">
                    {reasonMessage.title}
                  </h3>
                  <p className="text-gray-200 text-sm">
                    {reasonMessage.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulário de Login */}
          <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mensagem de Erro */}
              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-center font-bold">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-white font-bold mb-2 flex items-center gap-2">
                  <FaEnvelope className="text-emerald-400" /> Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="block text-white font-bold mb-2 flex items-center gap-2">
                  <FaLock className="text-emerald-400" /> Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {/* Lembrar-me */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                  Lembrar-me
                </label>
              </div>

              {/* Botão de Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg text-lg font-black text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Entrando...
                  </>
                ) : (
                  <>
                    <FaSignInAlt /> Entrar
                  </>
                )}
              </button>
            </form>

            {/* Divisor */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-center text-gray-400 mb-4">
                Novo por aqui?
              </p>
              <Link
                href="/registro"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border-2 border-emerald-500/50 rounded-xl shadow-sm text-base font-bold text-emerald-400 bg-transparent hover:bg-emerald-500/10 hover:border-emerald-500 transition-all"
              >
                <FaUserPlus /> Criar nova conta
              </Link>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Sistema de Disparo em Massa - <span className="text-emerald-400 font-semibold">NettSistemas</span> © 2024
          </p>
        </div>
      </div>
    </>
  );
}
