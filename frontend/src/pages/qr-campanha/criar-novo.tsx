import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaRocket, FaClock, FaUpload } from 'react-icons/fa';
import { qrCampaignsAPI } from '@/services/api';
import ToastContainer from '@/components/ToastContainer';
import { useToast } from '@/hooks/useToast';
import * as XLSX from 'xlsx';
import axios from 'axios';

interface QrTemplate {
  id: number;
  name: string;
  description: string;
  type: string;
}

interface UazInstance {
  id: number;
  instance_name: string;
  phone_number: string;
  connected: boolean;
  is_connected: boolean;
  is_active: boolean;
}

interface Contact {
  phone: string;
  variables: string[];
}

export default function CriarCampanhaQR() {
  const router = useRouter();
  const toast = useToast();
  
  // Dados básicos
  const [campaignName, setCampaignName] = useState('');
  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [templates, setTemplates] = useState<QrTemplate[]>([]);
  
  // NOVA ESTRUTURA: Seleção independente
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<number[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsInput, setContactsInput] = useState('');
  
  // Agendamento
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('20:00');
  const [intervalSeconds, setIntervalSeconds] = useState('5');
  
  // Pausas
  const [pauseAfter, setPauseAfter] = useState('100');
  const [pauseDuration, setPauseDuration] = useState('30');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInstances();
    loadTemplates();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await api.get(`/uaz/instances?_t=${Date.now()}`);
      // Filtrar apenas conectadas E ativas (não pausadas)
      const activeInstances = response.data.data.filter((i: UazInstance) => 
        i.is_connected && i.is_active
      );
      setInstances(activeInstances);
      
      if (activeInstances.length === 0) {
        toast.warning('⚠️ Nenhuma instância ativa disponível. Verifique as configurações.');
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      toast.error('Erro ao carregar instâncias UAZ');
    }
  };

  const loadTemplates = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await axios.get(`${API_URL}/qr-templates`);
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates QR');
    }
  };

  // Toggle de seleção de instância
  const handleToggleInstance = (instanceId: number) => {
    if (selectedInstanceIds.includes(instanceId)) {
      setSelectedInstanceIds(selectedInstanceIds.filter(id => id !== instanceId));
    } else {
      setSelectedInstanceIds([...selectedInstanceIds, instanceId]);
    }
  };

  // Selecionar todas as instâncias
  const handleSelectAllInstances = () => {
    if (selectedInstanceIds.length === instances.length) {
      setSelectedInstanceIds([]);
    } else {
      setSelectedInstanceIds(instances.map(i => i.id));
    }
  };

  // Toggle de seleção de template
  const handleToggleTemplate = (templateId: number) => {
    if (selectedTemplateIds.includes(templateId)) {
      setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== templateId));
    } else {
      setSelectedTemplateIds([...selectedTemplateIds, templateId]);
    }
  };

  // Selecionar todos os templates
  const handleSelectAllTemplates = () => {
    if (selectedTemplateIds.length === templates.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(templates.map(t => t.id));
    }
  };

  // ✅ Função auxiliar para converter notação científica
  const fixScientificNotation = (value: string): string => {
    if (!value || !/\d/.test(value)) return value;
    
    const scientificRegex = /^(\d+\.?\d*)[BE]\+(\d+)$/i;
    const match = value.match(scientificRegex);
    
    if (match) {
      try {
        const num = parseFloat(value.replace(/B/gi, 'E'));
        return num.toFixed(0);
      } catch (e) {
        return value;
      }
    }
    
    return value.replace(/[^\d+]/g, '');
  };

  const parseContacts = (text: string): Contact[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const parsed: Contact[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length > 0) {
        const phone = parts[0].replace(/\D/g, ''); // Remove não-dígitos
        if (phone) {
          parsed.push({
            phone,
            variables: parts.slice(1)
          });
        }
      }
    }

    return parsed;
  };

  const handleContactsChange = (text: string) => {
    setContactsInput(text);
    if (text.trim()) {
      const parsed = parseContacts(text);
      setContacts(parsed);
    } else {
      setContacts([]);
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log(`📁 Processando: ${file.name}`);
      
      const data = await file.arrayBuffer();
      // ✅ Usar opções para evitar conversão automática
      const workbook = XLSX.read(data, { 
        raw: true,
        cellText: true,
        cellDates: false
      });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: true,
        defval: ''
      }) as any[][];

      console.log('📊 Primeira linha:', jsonData[0]);
      console.log('📊 Segunda linha:', jsonData[1]);

      const parsed: Contact[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row[0]) {
          // ✅ CORRIGIR: Aplicar fixScientificNotation
          const rawPhone = String(row[0]);
          const phone = fixScientificNotation(rawPhone).replace(/\D/g, '');
          
          console.log(`📞 Linha ${i}: ${rawPhone} -> ${phone}`);
          
          if (phone) {
            parsed.push({
              phone,
              variables: row.slice(1).map(v => fixScientificNotation(String(v || '')))
            });
          }
        }
      }

      setContacts(parsed);
      toast.success(`✅ ${parsed.length} contatos importados!`);
    } catch (error) {
      console.error('Erro ao ler Excel:', error);
      toast.error('Erro ao ler arquivo Excel');
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit chamado!');
    console.log('📋 Nome da campanha:', campaignName);
    console.log('📋 Instâncias selecionadas:', selectedInstanceIds);
    console.log('📋 Templates selecionados:', selectedTemplateIds);
    console.log('📋 Contatos:', contacts.length);
    
    // ============================================
    // 🔍 VALIDAÇÕES COMPLETAS
    // ============================================
    
    // 1️⃣ VALIDAR NOME DA CAMPANHA
    if (!campaignName.trim()) {
      console.log('❌ VALIDAÇÃO FALHOU: Nome vazio');
      toast.error('❌ Digite o nome da campanha!');
      return;
    }
    
    if (campaignName.trim().length < 3) {
      toast.error('❌ O nome da campanha deve ter pelo menos 3 caracteres!');
      return;
    }

    // 2️⃣ VALIDAR INSTÂNCIAS
    if (selectedInstanceIds.length === 0) {
      toast.error('❌ Selecione pelo menos uma instância QR Connect!');
      toast.warning('💡 Você precisa selecionar uma instância para enviar as mensagens.');
      return;
    }

    // 3️⃣ VALIDAR TEMPLATES
    if (selectedTemplateIds.length === 0) {
      toast.error('❌ Selecione pelo menos um template!');
      toast.warning('💡 Adicione templates para definir o conteúdo das mensagens.');
      return;
    }

    // 4️⃣ VALIDAR CONTATOS
    if (contacts.length === 0) {
      toast.error('❌ Adicione pelo menos um contato!');
      toast.warning('💡 Faça upload de uma planilha ou cole os números manualmente.');
      return;
    }

    // 5️⃣ VALIDAR HORÁRIO DE TRABALHO
    if (workStartTime && workEndTime) {
      const [startHour, startMin] = workStartTime.split(':').map(Number);
      const [endHour, endMin] = workEndTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes >= endMinutes) {
        toast.error('❌ O horário de início deve ser ANTES do horário de término!');
        toast.warning(`💡 Atual: ${workStartTime} até ${workEndTime}`);
        return;
      }
      
      const workDuration = (endMinutes - startMinutes) / 60;
      if (workDuration < 1) {
        toast.error('❌ O período de trabalho deve ter pelo menos 1 hora!');
        return;
      }
    }

    // 6️⃣ VALIDAR INTERVALO ENTRE MENSAGENS
    const intervalValue = parseInt(intervalSeconds);
    if (isNaN(intervalValue) || intervalValue < 1) {
      toast.error('❌ O intervalo entre mensagens deve ser pelo menos 1 segundo!');
      toast.warning('💡 Recomendamos pelo menos 3-5 segundos para evitar bloqueios.');
      return;
    }
    
    if (intervalValue < 3) {
      toast.warning('⚠️ Intervalo muito curto pode causar bloqueios no WhatsApp!');
      toast.warning('💡 Recomendamos usar pelo menos 5 segundos.');
    }

    // 7️⃣ VALIDAR CONFIGURAÇÕES DE PAUSA
    const pauseAfterValue = parseInt(pauseAfter);
    const pauseDurationValue = parseInt(pauseDuration);
    
    if (pauseAfterValue > 0) {
      if (isNaN(pauseDurationValue) || pauseDurationValue < 1) {
        toast.error('❌ Se configurar pausa automática, defina o tempo de pausa (mínimo 1 minuto)!');
        return;
      }
      
      if (pauseAfterValue < 10) {
        toast.warning('⚠️ Pausar a cada poucas mensagens pode deixar a campanha muito lenta.');
      }
    }

    // 8️⃣ VALIDAR AGENDAMENTO (se configurado)
    if (scheduleDate && scheduleTime) {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      const now = new Date();
      
      if (scheduledDateTime <= now) {
        toast.error('❌ A data/hora agendada deve ser no FUTURO!');
        toast.warning('💡 Escolha uma data e hora posterior ao momento atual.');
        return;
      }
      
      // Verificar se não está agendando para muito longe
      const daysDifference = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 90) {
        toast.warning('⚠️ Você está agendando para mais de 90 dias no futuro.');
      }
    }

    // 9️⃣ VALIDAR NÚMEROS DE TELEFONE
    const invalidContacts = contacts.filter(c => {
      const cleanPhone = c.phone.replace(/\D/g, '');
      return cleanPhone.length < 10 || cleanPhone.length > 15;
    });
    
    if (invalidContacts.length > 0) {
      toast.error(`❌ Há ${invalidContacts.length} número(s) de telefone inválido(s)!`);
      toast.warning('💡 Os números devem ter entre 10 e 15 dígitos.');
      return;
    }

    // ✅ TODAS AS VALIDAÇÕES PASSARAM!
    toast.success('✅ Validações concluídas! Criando campanha...');
    
    setLoading(true);
    try {
      const scheduled_at = scheduleDate && scheduleTime 
        ? `${scheduleDate}T${scheduleTime}`
        : null;

      const data = {
        name: campaignName,
        instance_ids: selectedInstanceIds,
        template_ids: selectedTemplateIds,
        contacts: contacts.map(c => ({
          phone: c.phone,
          name: c.variables[0] || '',
          variables: c.variables
        })),
        scheduled_at,
        schedule_config: {
          work_start_time: workStartTime,
          work_end_time: workEndTime,
          interval_seconds: parseInt(intervalSeconds)
        },
        pause_config: {
          pause_after: parseInt(pauseAfter),
          pause_duration_minutes: parseInt(pauseDuration)
        }
      };

      await qrCampaignsAPI.create(data);
      toast.success('✅ Campanha QR criada com sucesso!');
      
      setTimeout(() => {
        router.push('/qr-campanhas');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao criar campanha:', error);
      toast.error('❌ Erro ao criar campanha: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-8">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">🚀 Criar Campanha QR Connect</h1>
          <p className="text-white/60">Configure sua campanha de envio em massa com rotatividade inteligente</p>
        </div>

        {/* NOME DA CAMPANHA */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-black text-white mb-4">📝 Nome da Campanha</h2>
          <input
            type="text"
            className="w-full px-6 py-4 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white text-lg focus:border-primary-500 focus:outline-none"
            placeholder="Ex: Promoção de Natal 2024"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
        </div>

        {/* INSTÂNCIAS QR */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-primary-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white">🔷 1. Selecionar Instâncias QR</h2>
            <button
              onClick={handleSelectAllInstances}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-lg transition-all"
            >
              {selectedInstanceIds.length === instances.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p className="text-lg">Nenhuma instância conectada</p>
              <p className="text-sm mt-2">Conecte instâncias QR primeiro</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {instances.map(instance => (
                  <label 
                    key={instance.id}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedInstanceIds.includes(instance.id)
                        ? 'bg-primary-500/20 border-primary-500/60'
                        : 'bg-dark-700/50 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedInstanceIds.includes(instance.id)}
                      onChange={() => handleToggleInstance(instance.id)}
                      className="w-5 h-5 accent-primary-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-white">{instance.instance_name}</div>
                      <div className="text-sm text-white/60">{instance.phone_number}</div>
                    </div>
                    {selectedInstanceIds.includes(instance.id) && (
                      <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        ✓ SELECIONADA
                      </div>
                    )}
                  </label>
                ))}
              </div>
              <div className="p-4 bg-primary-500/10 border-2 border-primary-500/30 rounded-xl">
                <p className="text-primary-300 font-bold">
                  ✓ {selectedInstanceIds.length} instância(s) selecionada(s)
                </p>
              </div>
            </>
          )}
        </div>

        {/* TEMPLATES QR */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white">📄 2. Selecionar Templates</h2>
            <button
              onClick={handleSelectAllTemplates}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all"
            >
              {selectedTemplateIds.length === templates.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <p className="text-lg">Nenhum template criado</p>
              <p className="text-sm mt-2">Crie templates QR primeiro</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {templates.map(template => (
                  <label 
                    key={template.id}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      selectedTemplateIds.includes(template.id)
                        ? 'bg-green-500/20 border-green-500/60'
                        : 'bg-dark-700/50 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.includes(template.id)}
                      onChange={() => handleToggleTemplate(template.id)}
                      className="w-5 h-5 accent-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-white">{template.name}</div>
                      <div className="text-sm text-white/60">{template.type}</div>
                      {template.description && (
                        <div className="text-xs text-white/40 mt-1">{template.description}</div>
                      )}
                    </div>
                    {selectedTemplateIds.includes(template.id) && (
                      <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        ✓ SELECIONADO
                      </div>
                    )}
                  </label>
                ))}
              </div>
              <div className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                <p className="text-green-300 font-bold">
                  ✓ {selectedTemplateIds.length} template(s) selecionado(s)
                </p>
              </div>
            </>
          )}
        </div>

        {/* COMBINAÇÕES */}
        {selectedInstanceIds.length > 0 && selectedTemplateIds.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-8 mb-6">
            <h3 className="text-2xl font-black text-white mb-4">🔄 Rotatividade Configurada</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-primary-400">{selectedInstanceIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Instâncias</div>
              </div>
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-green-400">{selectedTemplateIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Templates</div>
              </div>
              <div className="bg-dark-800/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-black text-purple-400">{selectedInstanceIds.length * selectedTemplateIds.length}</div>
                <div className="text-white/70 text-sm mt-2">Combinações</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-purple-500/10 border-2 border-purple-500/30 rounded-lg">
              <p className="text-purple-300 text-sm">
                <strong>💡 Como funciona:</strong> As instâncias rodiziam sempre, e os templates não repetem até acabarem todos. 
                Ex: Inst.A+Temp.1 → Inst.B+Temp.2 → Inst.C+Temp.3 → Inst.A+Temp.4...
              </p>
            </div>
          </div>
        )}

        {/* CONTATOS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-black text-white mb-4">👥 3. Contatos ({contacts.length})</h2>
          
          <div className="mb-4">
            <label className="block text-white/70 mb-2">
              Importar Excel (.xlsx, .xls):
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUploadExcel}
              className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
            />
          </div>

          <div className="mb-4">
            <label className="block text-white/70 mb-2">
              Ou cole aqui (formato: número, var1, var2...):
            </label>
            <textarea
              className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white h-48 font-mono text-sm"
              placeholder="5562999998888, João, São Paulo&#10;5511888887777, Maria, Rio de Janeiro"
              value={contactsInput}
              onChange={(e) => handleContactsChange(e.target.value)}
            />
          </div>

          {contacts.length > 0 && (
            <div className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
              <p className="text-green-300 font-bold">
                ✅ {contacts.length} contato(s) prontos para envio
              </p>
            </div>
          )}
        </div>

        {/* AGENDAMENTO */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-black text-white mb-4">📅 4. Agendamento (Opcional)</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-white/70 mb-2">Data:</label>
              <input
                type="date"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-white/70 mb-2">Hora:</label>
              <input
                type="time"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-white/70 mb-2">Horário Início:</label>
              <input
                type="time"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-white/70 mb-2">Horário Fim:</label>
              <input
                type="time"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-white/70 mb-2">Intervalo entre envios (segundos):</label>
            <input
              type="number"
              min="1"
              max="60"
              className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(e.target.value)}
            />
          </div>
        </div>

        {/* PAUSAS AUTOMÁTICAS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-black text-white mb-4">⏸️ 5. Pausas Automáticas (Opcional)</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 mb-2">Pausar após (mensagens):</label>
              <input
                type="number"
                min="0"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={pauseAfter}
                onChange={(e) => setPauseAfter(e.target.value)}
                placeholder="0 = desabilitado"
              />
            </div>
            <div>
              <label className="block text-white/70 mb-2">Duração da pausa (minutos):</label>
              <input
                type="number"
                min="1"
                className="w-full px-4 py-2 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white"
                value={pauseDuration}
                onChange={(e) => setPauseDuration(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 px-8 py-4 bg-dark-700 hover:bg-dark-600 text-white font-bold rounded-xl transition-all text-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>🔄 Criando...</>
            ) : (
              <>
                <FaRocket /> Criar Campanha
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


