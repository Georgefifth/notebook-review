export class ReviewAPI {
  constructor(config, notify = () => {}) { this.config = config; this.notify = notify; this.session = null; try { const saved = JSON.parse(sessionStorage.getItem('nr-session')); if (saved?.access_token && saved?.refresh_token && saved?.user?.id) this.session = saved; } catch {} }
  saveSession(value) { this.session = value; try { if (value) sessionStorage.setItem('nr-session', JSON.stringify(value)); else sessionStorage.removeItem('nr-session'); } catch {} this.notify(); }
  async auth(path, body, authenticated = false) {
    const headers = { apikey: this.config.publicKey, 'Content-Type': 'application/json' };
    if (authenticated && this.session) headers.Authorization = 'Bearer ' + this.session.access_token;
    const response = await fetch(this.config.url + '/auth/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || data.error_description || data.message || '邮箱登录服务暂时不可用。');
    return data;
  }
  async sendOTP(email) { await this.auth('otp', { email, create_user: true }); }
  async verifyOTP(email, token) { const session = await this.auth('verify', { email, token, type: 'email' }); if (!session.access_token || !session.user?.id) throw new Error('登录响应不完整。'); this.saveSession({ ...session, expires_at: session.expires_at || Date.now() / 1000 + session.expires_in }); }
  async token() {
    if (!this.session) throw new Error('请先用邮箱登录。');
    if (this.session.expires_at < Date.now() / 1000 + 60) {
      try { const value = await this.auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token }); this.saveSession({ ...value, expires_at: value.expires_at || Date.now() / 1000 + value.expires_in }); }
      catch (error) { this.saveSession(null); throw new Error('登录已过期，请重新登录。'); }
    }
    return this.session.access_token;
  }
  async request(table, query = '', method = 'GET', body) {
    const token = await this.token();
    const response = await fetch(this.config.url + '/rest/v1/' + table + (query ? '?' + query : ''), { method, headers: { apikey: this.config.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    const data = response.status === 204 ? [] : await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.saveSession(null); throw new Error('登录已过期，请重新登录。'); }
      if (response.status === 403) throw new Error('没有此操作的权限，请确认受邀邮箱或联系审阅发起者。');
      if (response.status === 409) throw new Error('记录已存在或发生冲突，请刷新后重试。');
      if (data.code === '42P01') throw new Error('在线工作区尚未完成数据库配置，请联系部署者。');
      throw new Error('操作未保存，请刷新审阅后重试。');
    }
    return data;
  }
  async logout() { try { if (this.session) await this.auth('logout', {}, true); } finally { this.saveSession(null); } }
}
export function query(values) { return new URLSearchParams(values).toString(); }
