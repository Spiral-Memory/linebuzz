import { createClient, SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../core/platform/config";
import { VSCodeSupabaseStorage } from "./VSCodeSupabaseStorage";

export class SupabaseClient {
  private static instance: SupabaseClient;
  public readonly client: SupabaseJsClient;
  private lastSyncedToken: string | null = null;

  private constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: new VSCodeSupabaseStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  public static getInstance(): SupabaseClient {
    if (!SupabaseClient.instance) {
      SupabaseClient.instance = new SupabaseClient();
    }
    return SupabaseClient.instance;
  }

  public async syncRealtimeAuth(): Promise<void> {
    const { data: { session } } = await this.client.auth.getSession();
    
    if (session?.access_token && session.access_token !== this.lastSyncedToken) {
        await this.client.realtime.setAuth(session.access_token);
        this.lastSyncedToken = session.access_token;
    }
  }
}
