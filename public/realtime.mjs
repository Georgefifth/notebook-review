// Events are invalidation hints. Always fetch authorized rows through REST/RLS.
// Subscribe only to INSERT/UPDATE: DELETE events cannot be protected by row RLS.
export class ReviewRealtime {
  constructor(api, projectId, onChange, onStatus, factory) {
    Object.assign(this, { api, projectId, onChange, onStatus, factory });
    this.stopped = false; this.client = null; this.channel = null;
  }
  async start() {
    this.onStatus('connecting');
    try {
      const factory = this.factory || (({ RealtimeClient }) => (url, options) => new RealtimeClient(url, options))(await import('./realtime-sdk.mjs'));
      const token = await this.api.token();
      if (this.stopped) return;
      this.client = factory(this.api.config.url + '/realtime/v1', { params: { apikey: this.api.config.publicKey }, accessToken: () => this.api.token() });
      await this.client.setAuth(token);
      if (this.stopped) { await this.client.disconnect(); return; }
      this.channel = this.client.channel('review:' + this.projectId);
      const changed = () => { if (!this.stopped) this.onChange(); };
      for (const event of ['INSERT', 'UPDATE']) this.channel.on('postgres_changes', { event, schema: 'public', table: 'review_comments', filter: 'project_id=eq.' + this.projectId, select: ['id', 'project_id', 'version'] }, changed);
      this.channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'review_projects', filter: 'id=eq.' + this.projectId, select: ['id', 'version'] }, changed);
      this.channel.subscribe(status => {
        if (this.stopped) return;
        this.onStatus(status === 'SUBSCRIBED' ? 'live' : 'reconnecting');
        // Reconcile anything missed while disconnected, including revisions.
        if (status === 'SUBSCRIBED') changed();
      });
    } catch { if (!this.stopped) this.onStatus('reconnecting'); }
  }
  async refreshAuth() { if (this.client && !this.stopped) { try { await this.client.setAuth(); } catch { if (!this.stopped) this.onStatus('reconnecting'); } } }
  stop() { this.stopped = true; if (this.channel) Promise.resolve(this.channel.unsubscribe()).catch(() => {}); if (this.client) Promise.resolve(this.client.disconnect()).catch(() => {}); }
}
