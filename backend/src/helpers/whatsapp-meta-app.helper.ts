import axios from 'axios';

const GRAPH_VERSION = 'v26.0';

function appToken(appId: string, appSecret: string) {
  return `${appId}|${appSecret}`;
}

function metaError(error: any): string {
  return String(error?.response?.data?.error?.message || error?.message || 'Erro na Meta');
}

export async function fetchMetaAppInfo(opts: { appId: string; appSecret: string }) {
  const appId = String(opts.appId || '').trim();
  const appSecret = String(opts.appSecret || '').trim();
  if (!appId || !appSecret) {
    return { success: false, message: 'App ID e App Secret são obrigatórios.', data: null as any };
  }

  try {
    const response = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(appId)}`, {
      params: {
        fields: 'id,name,app_name,link',
        access_token: appToken(appId, appSecret),
      },
      timeout: 20000,
    });
    const name = String(response.data?.name || response.data?.app_name || '').trim();
    return {
      success: true,
      message: name ? `App: ${name}` : 'App encontrado, sem nome na resposta.',
      data: {
        id: String(response.data?.id || appId),
        name,
        app_name: String(response.data?.app_name || name),
        link: response.data?.link || null,
      },
    };
  } catch (error: any) {
    const message = metaError(error);
    console.warn('⚠️ fetchMetaAppInfo:', message);
    return { success: false, message, data: null as any };
  }
}

export async function updateMetaAppName(opts: { appId: string; appSecret: string; appName: string }) {
  const appId = String(opts.appId || '').trim();
  const appSecret = String(opts.appSecret || '').trim();
  const appName = String(opts.appName || '').trim();
  if (!appId || !appSecret) {
    return { success: false, message: 'App ID e App Secret são obrigatórios.', data: null as any };
  }
  if (appName.length < 2 || appName.length > 32) {
    return { success: false, message: 'Nome do App deve ter entre 2 e 32 caracteres.', data: null as any };
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(appId)}`,
      null,
      {
        params: {
          app_name: appName,
          access_token: appToken(appId, appSecret),
        },
        timeout: 20000,
      }
    );
    const ok = response.data?.success === true || response.status < 300;
    const after = ok ? await fetchMetaAppInfo({ appId, appSecret }) : null;
    return {
      success: ok,
      message: ok
        ? `Nome do App atualizado na Meta: ${after?.data?.name || appName}`
        : 'A Meta não confirmou a alteração do nome.',
      data: after?.data || { id: appId, name: appName, app_name: appName, link: null },
    };
  } catch (error: any) {
    const message = metaError(error);
    console.warn('⚠️ updateMetaAppName:', message);
    return { success: false, message, data: null as any };
  }
}
