const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  async me() {
    return this.request<{ user: any }>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Dashboard
  async getDashboard() {
    return this.request<any>('/dashboard');
  }

  // Kanban
  async getKanban() {
    return this.request<Record<string, any[]>>('/kanban');
  }

  // Pallets
  async getPallets(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/pallets${query}`);
  }

  async getPallet(id: string) {
    return this.request<any>(`/pallets/${id}`);
  }

  async createPallet(data: any) {
    return this.request<any>('/pallets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePallet(id: string, data: any) {
    return this.request<any>(`/pallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePallet(id: string) {
    return this.request<any>(`/pallets/${id}`, { method: 'DELETE' });
  }

  // Items
  async getItems(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/items${query}`);
  }

  async getItem(id: string) {
    return this.request<any>(`/items/${id}`);
  }

  async scanItem(barcode: string, warehouseId?: string) {
    return this.request<any>('/items/scan', {
      method: 'POST',
      body: JSON.stringify({ barcode, warehouseId }),
    });
  }

  async createItem(data: any) {
    return this.request<any>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async advanceItem(id: string, data?: any) {
    return this.request<any>(`/items/${id}/advance`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async setItemStage(id: string, stage: string, data?: any) {
    return this.request<any>(`/items/${id}/stage`, {
      method: 'POST',
      body: JSON.stringify({ stage, ...data }),
    });
  }

  async assignItem(id: string, technicianId: string) {
    return this.request<any>(`/items/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technicianId }),
    });
  }

  async deleteItem(id: string) {
    return this.request<any>(`/items/${id}`, { method: 'DELETE' });
  }

  // Tickets
  async getTickets(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/tickets${query}`);
  }

  async getTicket(id: string) {
    return this.request<any>(`/tickets/${id}`);
  }

  async createTicket(data: any) {
    return this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveTicket(id: string, data: any) {
    return this.request<any>(`/tickets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Parts
  async getParts(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/parts${query}`);
  }

  async createPart(data: any) {
    return this.request<any>('/parts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adjustPartStock(id: string, quantity: number, reason: string) {
    return this.request<any>(`/parts/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ quantity, reason }),
    });
  }

  // Technicians
  async getTechnicians() {
    return this.request<any[]>('/technicians');
  }

  async createTechnician(data: any) {
    return this.request<any>('/technicians', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTechnicianWorkload(id: string) {
    return this.request<any>(`/technicians/${id}/workload`);
  }
}

export const api = new ApiClient();
