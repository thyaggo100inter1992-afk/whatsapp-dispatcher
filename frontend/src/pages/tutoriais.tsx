import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaVideo, FaPlayCircle, FaArrowLeft, FaTimes, FaFolder, FaHome } from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/services/api';

interface Tutorial {
  id: number;
  titulo: string;
  descricao: string | null;
  filename: string;
  categoria: string | null;
  ordem: number;
  created_at: string;
}

export default function Tutoriais() {
  const router = useRouter();
  const { origem } = router.query; // 'api' ou 'qr'
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Definir título baseado na origem
  const getTitulo = () => {
    if (origem === 'api') return 'Tutoriais - WhatsApp API Oficial';
    if (origem === 'qr') return 'Tutoriais - WhatsApp QR Connect';
    return 'Tutoriais da Plataforma';
  };

  const getSubtitulo = () => {
    if (origem === 'api') return 'Aprenda a usar a API Oficial do WhatsApp Business';
    if (origem === 'qr') return 'Aprenda a usar o WhatsApp QR Connect';
    return 'Aprenda a usar todas as funcionalidades do sistema';
  };

  useEffect(() => {
    loadTutorials();
  }, []);

  const loadTutorials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tutorials');
      setTutorials(response.data.data);
    } catch (err) {
      console.error('Erro ao carregar tutoriais:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVideoUrl = async (id: number) => {
    try {
      // Buscar o vídeo com autenticação usando a instância api configurada
      const response = await api.get(`/tutorials/stream/${id}`, {
        responseType: 'blob'
      });
      
      // Criar um blob URL
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error('Erro ao carregar vídeo:', error);
      alert('Erro ao carregar vídeo');
    }
  };

  const handleTutorialClick = async (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
    await loadVideoUrl(tutorial.id);
  };

  const handleCloseModal = () => {
    setSelectedTutorial(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl); // Limpar o blob URL
      setVideoUrl('');
    }
  };

  const categories: string[] = [
    'Todos',
    ...Array.from(new Set(tutorials.map(t => t.categoria || 'Sem Categoria')))
  ];

  const filteredTutorials = selectedCategory === 'Todos' 
    ? tutorials 
    : tutorials.filter(t => (t.categoria || 'Sem Categoria') === selectedCategory);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/')}
              className="mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
            >
              <FaHome /> Voltar ao Início
            </button>

            <div className="bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-2xl shadow-lg">
                  <FaVideo className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2">{getTitulo()}</h1>
                  <p className="text-xl text-white/80">{getSubtitulo()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtro de Categorias */}
          {categories.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                    selectedCategory === category
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <FaFolder /> {category || 'Sem Categoria'}
                </button>
              ))}
            </div>
          )}

          {/* Lista de Tutoriais */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando tutoriais...</p>
            </div>
          ) : filteredTutorials.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/50 rounded-xl border-2 border-gray-700">
              <FaVideo className="mx-auto text-gray-600 mb-4" size={64} />
              <p className="text-gray-400 text-xl">Nenhum tutorial disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTutorials.map((tutorial) => (
                <div
                  key={tutorial.id}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border-2 border-purple-500/30 hover:border-purple-400 transition-all cursor-pointer group"
                  onClick={() => handleTutorialClick(tutorial)}
                >
                  {/* Thumbnail com Play Button */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <FaPlayCircle className="text-white text-6xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>
                  </div>

                  {/* Informações */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
                      {tutorial.titulo}
                    </h3>
                    
                    {tutorial.categoria && (
                      <span className="inline-block text-xs px-2 py-1 bg-purple-600 text-white rounded-full mb-2">
                        {tutorial.categoria}
                      </span>
                    )}
                    
                    {tutorial.descricao && (
                      <p className="text-gray-400 text-sm line-clamp-3">
                        {tutorial.descricao}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de Vídeo */}
          {selectedTutorial && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="relative w-full max-w-5xl bg-gray-900 rounded-xl overflow-hidden">
                {/* Header do Modal */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedTutorial.titulo}</h2>
                    {selectedTutorial.categoria && (
                      <span className="text-sm text-white/80">📁 {selectedTutorial.categoria}</span>
                    )}
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-all"
                  >
                    <FaTimes size={24} />
                  </button>
                </div>

                {/* Vídeo */}
                <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      className="absolute inset-0 w-full h-full"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-white text-xl">⏳ Carregando vídeo...</p>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                {selectedTutorial.descricao && (
                  <div className="p-6 bg-gray-800">
                    <h3 className="text-lg font-bold text-white mb-2">Sobre este tutorial</h3>
                    <p className="text-gray-300">{selectedTutorial.descricao}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
