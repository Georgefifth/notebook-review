export class ReviewAPI {
  constructor(config, notify = () => {}) { this.config = config; this.notify = notify; this.session = null; try { const saved = JSON.parse(sessionStorage.getItem('nr-session')); if (saved?.access_token && saved?.refresh_token && saved?.user?.id) this.session = saved; } catch {} }
  saveSession(value) { this.session = value; try { if (value) sessionStorage.setItem('nr-session', JSON.stringify(value)); else sessionStorage.removeItem('nr-session'); } catch {} this.notify(); }
  async auth(path, body, authenticated = false) {
    const headers = { apikey: this.config.publicKey, 'Content-Type': 'application/json' };
    if (authenticated && this.session) headers.Authorization = 'Bearer ' + this.session.access_token;
    const response = await fetch(this.config.url + '/auth/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.error_description || data.message || 'Email sign-in is temporarily unavailable.');
    return data;
  }
  async sendOTP(email) { await this.auth('otp', { email, create_user: true }); }
  async verifyOTP(email, token) { const session = await this.auth('verify', { email, token, type: 'email' }); if (!session.access_token || !session.user?.id) throw new Error('The sign-in response is incomplete.'); this.saveSession({ ...session, expires_at: session.expires_at || Date.now() / 1000 + session.expires_in }); }
  async token() {
    if (!this.session) throw new Error('Please sign in with email first.');
    if (this.session.expires_at < Date.now() / 1000 + 60) {
      if (!this.refreshing) {
        const session = this.session;
        this.refreshing = (async () => {
          try { const value = await this.auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }); if (this.session !== session) throw new Error('Your sign-in state changed. Please try again.'); if (!value.access_token || !value.user?.id) throw new Error('The session refresh response is incomplete.'); this.saveSession({ ...value, expires_at: value.expires_at || Date.now() / 1000 + value.expires_in }); }
          catch (error) { if (this.session === session) this.saveSession(null); throw new Error('Your session expired. Please sign in again.'); }
        })().finally(() => { this.refreshing = null; });
      }
      await this.refreshing;
    }
    if (!this.session) throw new Error('Please sign in with email first.');
    return this.session.access_token;
  }
  async request(table, query = '', method = 'GET', body) {
    const token = await this.token();
    const response = await fetch(this.config.url + '/rest/v1/' + table + (query ? '?' + query : ''), { method, headers: { apikey: this.config.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    const data = response.status === 204 ? [] : await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.saveSession(null); throw new Error('Your session expired. Please sign in again.'); }
      if (response.status === 403) throw new Error('Permission denied. Check your invited email or contact the review owner.');
      if (response.status === 409) throw new Error('The record already exists or conflicts with an update. Refresh and try again.');
      if (data.code === '42P01') throw new Error('The online database is not configured. Contact the deployer.');
      throw new Error('Your change was not saved. Refresh the review and try again.');
    }
    return data;
  }
  async logout() { try { if (this.session) await this.auth('logout', {}, true); } finally { this.saveSession(null); } }
}
export function query(values) { return new URLSearchParams(values).toString(); }
