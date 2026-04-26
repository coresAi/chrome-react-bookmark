import { createClient } from '@supabase/supabase-js';
import { chromeStorageAdapter, getStoredState, setStoredPartial } from './storage.js';

let cachedClient = null;
let cachedKey = '';

function sessionSummary(session) {
  if (!session?.user) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? ''
    },
    accessToken: session.access_token ?? null
  };
}

export async function getSupabaseClient() {
  const { settings } = await getStoredState();

  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    return null;
  }

  const nextKey = `${settings.supabaseUrl}::${settings.supabaseAnonKey}`;

  if (cachedClient && cachedKey === nextKey) {
    return cachedClient;
  }

  cachedKey = nextKey;
  cachedClient = createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
      autoRefreshToken: true,
      storage: chromeStorageAdapter('supabase-auth')
    }
  });

  return cachedClient;
}

export async function getSession() {
  const client = await getSupabaseClient();

  if (!client) {
    await setStoredPartial({ session: null });
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }

  const summary = sessionSummary(data.session);
  await setStoredPartial({ session: summary });
  return summary;
}

export async function signUp(email, password) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('请先填写 Supabase URL 和 anon key');
  }

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    throw error;
  }

  await setStoredPartial({ session: sessionSummary(data.session) });
  return data;
}

export async function signIn(email, password) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error('请先填写 Supabase URL 和 anon key');
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  await setStoredPartial({ session: sessionSummary(data.session) });
  return data;
}

export async function signOut() {
  const client = await getSupabaseClient();

  if (client) {
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  await setStoredPartial({ session: null });
}

function isSchemaCacheError(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('schema cache') || normalized.includes("could not find the table 'public.");
}

export async function assertLibrarySchema(client) {
  const [foldersProbe, bookmarksProbe] = await Promise.all([
    client.from('bookmark_folders').select('id', { head: true, count: 'exact' }).limit(1),
    client.from('bookmarks').select('id', { head: true, count: 'exact' }).limit(1)
  ]);

  const schemaError = foldersProbe.error || bookmarksProbe.error;
  if (!schemaError) {
    return;
  }

  if (isSchemaCacheError(schemaError.message)) {
    throw new Error(
      'Supabase 里还没有可用的 `bookmark_folders` / `bookmarks` 表。请先在 SQL Editor 执行 README 里的建表 SQL，然后在 Supabase 后台点一次 API schema reload。'
    );
  }

  throw schemaError;
}
