import { createClient, SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../core/platform/config";
import { VSCodeSupabaseStorage } from "./VSCodeSupabaseStorage";
import { Storage } from "../../core/platform/storage";

export class SupabaseClient {
  private static instance: SupabaseClient;
  public readonly client: SupabaseJsClient;
  private lastSyncedToken: string | null = null;

  private constructor() {
    const url = Storage.getGlobal<string>("custom_supabase_url") || SUPABASE_URL;
    const publishableKey = Storage.getGlobal<string>("custom_supabase_publishable_key") || SUPABASE_PUBLISHABLE_KEY;
    this.client = createClient(url, publishableKey, {
      auth: {
        storage: new VSCodeSupabaseStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: 'linebuzz-auth-token',
      },
    });
  }

  public static getInstance(): SupabaseClient {
    if (!SupabaseClient.instance) {
      SupabaseClient.instance = new SupabaseClient();
    }
    return SupabaseClient.instance;
  }

  public static resetInstance(): void {
    SupabaseClient.instance = undefined as any;
  }

  public async syncRealtimeAuth(): Promise<void> {
    const { data: { session } } = await this.client.auth.getSession();
    
    if (session?.access_token && session.access_token !== this.lastSyncedToken) {
        await this.client.realtime.setAuth(session.access_token);
        this.lastSyncedToken = session.access_token;
    }
  }
}
