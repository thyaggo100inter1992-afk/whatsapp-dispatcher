/**
 * Hook para Logout Automático por Inatividade
 * 
 * Regras:
 * - Se o usuário ficar INATIVO por 1 hora, faz logout automático
 * - Se o usuário estiver ATIVO (clicando, movendo mouse, digitando), NÃO desloga
 * - Ao bloquear tenant, usuário é deslogado imediatamente
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hora em milissegundos
const CHECK_INTERVAL = 60 * 1000; // Verifica a cada 1 minuto

export function useInactivityLogout() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Não ativar em páginas públicas ou embed
    if (!user) return;
    if (router.pathname.startsWith('/embed')) return;

    console.log('🕐 Sistema de logout por inatividade ATIVADO');
    console.log(`⏱️  Timeout configurado: ${INACTIVITY_TIMEOUT / 1000 / 60} minutos`);

    // Função para atualizar última atividade
    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      localStorage.setItem('lastActivity', now.toString());
      
      // Debug apenas a cada 5 minutos
      const lastLog = parseInt(localStorage.getItem('lastActivityLog') || '0');
      if (now - lastLog > 5 * 60 * 1000) {
        console.log('✅ Atividade detectada - sessão renovada');
        localStorage.setItem('lastActivityLog', now.toString());
      }
    };

    // Função para verificar inatividade
    const checkInactivity = () => {
      const now = Date.now();
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || now.toString());
      const timeSinceLastActivity = now - lastActivity;
      const minutesInactive = Math.floor(timeSinceLastActivity / 1000 / 60);

      // Se passou 1 hora sem atividade, faz logout
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        console.warn('⚠️  INATIVIDADE DETECTADA!');
        console.warn(`⏱️  Tempo inativo: ${minutesInactive} minutos`);
        console.warn('🚪 Fazendo logout automático...');
        
        // Limpar storage
        localStorage.removeItem('lastActivity');
        localStorage.removeItem('lastActivityLog');
        
        // Fazer logout (sem alert, será mostrado na página de login)
        signOut();
        router.push('/login?reason=inactivity');
      } else {
        // Log de debug a cada 10 minutos
        if (minutesInactive > 0 && minutesInactive % 10 === 0) {
          console.log(`⏱️  Tempo inativo: ${minutesInactive} minutos (limite: ${INACTIVITY_TIMEOUT / 1000 / 60} minutos)`);
        }
      }
    };

    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Adicionar listeners
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Inicializar última atividade
    updateActivity();

    // Verificar inatividade a cada 1 minuto
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    // Verificar imediatamente na montagem
    checkInactivity();

    // Cleanup
    return () => {
      console.log('🛑 Sistema de logout por inatividade DESATIVADO');
      
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [user, signOut, router]);

  return null;
}



