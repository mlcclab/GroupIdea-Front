export class GroupIdeaService {
  constructor() {
    const configured = window.GROUPIDEA_CONFIG?.apiBase || '';
    this.base = configured.replace(/\/$/, '');
    // 令牌只保留在当前页面内存中；刷新页面后重新登录。
    this.accessToken = '';
  }
  async request(path,body) {
    let response;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
    const headers = body ? {'Content-Type':'application/json'} : {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    try {response=await fetch(this.base + path,{method:body ? 'POST' : 'GET',credentials:'include',cache:'no-store',redirect:'error',signal:controller.signal,headers,...(body ? {body:JSON.stringify(body)} : {})});}
    catch {throw new Error('暂时无法连接服务，请确认 服务地址正确且服务可用。');}
    finally {clearTimeout(timer);}
    let data;
    try { data=await response.json(); } catch { throw new Error('服务返回了无法识别的响应，请检查 Worker 配置。'); }
    if(!response.ok) {const error=new Error(data.error || '请求未完成，请稍后重试。');error.status=response.status;throw error;}
    return data;
  }
  async login(username,password) {
    const result=await this.request('/api/login',{username,password});
    this.accessToken=result.token || '';
    return result.user;
  }
  async logout() { try { return await this.request('/api/logout',{}); } finally { this.accessToken=''; } }
  async listReports() {return (await this.request('/api/reports')).sort((a,b)=>b.name.localeCompare(a.name));}
  async readReport(path) {return this.request('/api/report?path='+encodeURIComponent(path));}
  async published() {return this.request('/api/published');}
  async file(path) {return (await this.request('/api/published/content?path='+encodeURIComponent(path))).content;}
  async submit(report) {
    const {id,title,recordDate,week,filename,content}=report;
    return this.request('/api/reports',{id,title,recordDate,week,filename,content});
  }
}
