const API_BASE = '/api';

export interface TechnicianStats {
  technicianId: string;
  technicianName?: string;
  totalSessions: number;
  completedSessions: number;
  passedSessions: number;
  failedSessions: number;
  passRate: number;
  avgTestsPerSession: number;
  avgDurationMinutes: number;
  categoryCounts: Record<string, number>;
  recentSessions: Array<{
    sessionNumber: string;
    qlid: string;
    category: string;
    overallResult?: string;
    startedAt: string;
    completedAt?: string;
  }>;
}

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

  // Auth - Token Verification (no auth header needed)
  async verifyToken(token: string, type?: string) {
    const params = new URLSearchParams({ token });
    if (type) params.append('type', type);
    return this.request<{ valid: boolean; email: string; name: string; type: string }>(`/auth/verify-token?${params}`);
  }

  async acceptInvite(token: string, password: string) {
    return this.request<{ success: boolean; message: string }>('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Admin - User Management
  async getUsers() {
    return this.request<any[]>('/admin/users');
  }

  async inviteUser(data: { email: string; name: string; role?: string }) {
    return this.request<any>('/auth/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: { name?: string; role?: string; is_active?: boolean }) {
    return this.request<any>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deactivateUser(id: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  async resendInvite(id: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${id}/resend-invite`, {
      method: 'POST',
    });
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

  async generateRfbPalletId() {
    return this.request<{ palletId: string }>('/pallets/generate-rfb-id', {
      method: 'POST',
    });
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

  // ==================== WORKFLOW API ====================

  // Jobs
  async createJob(data: { qlid: string; palletId?: string; category?: string; priority?: string }) {
    return this.request<any>('/workflow/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobs(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/workflow/jobs${query}`);
  }

  async getJob(qlid: string) {
    return this.request<any>(`/workflow/jobs/${qlid}`);
  }

  async getJobPrompt(qlid: string) {
    return this.request<any>(`/workflow/jobs/${qlid}/prompt`);
  }

  async completeStep(qlid: string, stepCode: string, data: any) {
    return this.request<any>(`/workflow/jobs/${qlid}/steps/${stepCode}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transitionJob(qlid: string, action: string, data?: any) {
    return this.request<any>(`/workflow/jobs/${qlid}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, ...data }),
    });
  }

  async assignJob(qlid: string, technicianId: string, technicianName?: string) {
    return this.request<any>(`/workflow/jobs/${qlid}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technicianId, technicianName }),
    });
  }

  async addDiagnosis(qlid: string, data: any) {
    return this.request<any>(`/workflow/jobs/${qlid}/diagnose`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobDiagnoses(qlid: string) {
    return this.request<any[]>(`/workflow/jobs/${qlid}/diagnoses`);
  }

  async certifyJob(qlid: string, data: { finalGrade: string; warrantyEligible: boolean; notes?: string }) {
    return this.request<any>(`/workflow/jobs/${qlid}/certify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobHistory(qlid: string) {
    return this.request<any>(`/workflow/jobs/${qlid}/history`);
  }

  // SOPs
  async getSOPs() {
    return this.request<any[]>('/workflow/sops');
  }

  async getSOP(category: string) {
    return this.request<any>(`/workflow/sops/${category}`);
  }

  // Defect Codes
  async getDefectCodes(category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.request<any[]>(`/workflow/defect-codes${query}`);
  }

  // Stats & Queue
  async getWorkflowStats() {
    return this.request<any>('/workflow/stats');
  }

  async getWorkflowQueue() {
    return this.request<Record<string, { count: number; jobs: any[] }>>('/workflow/queue');
  }

  // ==================== SETTINGS API ====================

  async getSettings() {
    return this.request<any>('/settings');
  }

  async updateSettings(settings: any) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ==================== DATA WIPE API ====================

  async getDataWipeReports(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/datawipe/reports${query}`);
  }

  async getDataWipeReport(qlid: string) {
    return this.request<any>(`/datawipe/reports/${qlid}`);
  }

  async startDataWipe(data: { qlid: string; jobId?: string; deviceInfo: any; wipeMethod: string }) {
    return this.request<any>('/datawipe/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeDataWipe(id: string, data: { verificationMethod: string; notes?: string }) {
    return this.request<any>(`/datawipe/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDataWipeCertificate(qlid: string) {
    return this.request<any>(`/datawipe/${qlid}/certificate`);
  }

  // ==================== PARTS INVENTORY API ====================

  async getPart(id: string) {
    return this.request<any>(`/parts/${id}`);
  }

  async updatePart(id: string, data: any) {
    return this.request<any>(`/parts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePart(id: string) {
    return this.request<any>(`/parts/${id}`, { method: 'DELETE' });
  }

  async getPartsCategories() {
    return this.request<string[]>('/parts/categories');
  }

  async importParts(data: { source: string; parts: any[] }) {
    return this.request<any>('/parts/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async syncPartsSupplier(supplierId: string) {
    return this.request<any>(`/parts/sync/${supplierId}`, {
      method: 'POST',
    });
  }

  async getPartsSuppliers() {
    return this.request<any[]>('/parts/suppliers');
  }

  async addPartsSupplier(data: { name: string; apiUrl?: string; apiKey?: string; syncType: string }) {
    return this.request<any>('/parts/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== WORK SESSION API ====================

  async getSession() {
    return this.request<{ session: any; requiresSession: boolean }>('/session');
  }

  async startSession(data: { employeeId: string; workstationId: string; warehouseId: string }) {
    return this.request<any>('/session/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endSession() {
    return this.request<any>('/session/end', {
      method: 'POST',
    });
  }

  // ==================== DIAGNOSTICS API (QuickDiagnosticz) ====================

  async getDiagnosticTests(category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.request<any>(`/workflow/diagnostics/tests${query}`);
  }

  async getTestSuite(category: string) {
    return this.request<any>(`/workflow/diagnostics/tests/${category}`);
  }

  async getAllTestSuites() {
    return this.request<any[]>('/workflow/diagnostics/tests/all');
  }

  async getDiagnosticSessions(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/workflow/diagnostics/sessions${query}`);
  }

  async getDiagnosticSession(identifier: string) {
    return this.request<any>(`/workflow/diagnostics/sessions/${identifier}`);
  }

  async startDiagnosticSession(data: { qlid: string; category: string; jobId?: string }) {
    return this.request<any>('/workflow/diagnostics/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordTestResult(sessionNumber: string, data: {
    testCode: string;
    result: 'PASS' | 'FAIL' | 'SKIP' | 'N/A';
    measurementValue?: number;
    measurementUnit?: string;
    notes?: string;
    photoUrls?: string[];
  }) {
    return this.request<any>(`/workflow/diagnostics/sessions/${sessionNumber}/tests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeDiagnosticSession(sessionNumber: string, notes?: string) {
    return this.request<any>(`/workflow/diagnostics/sessions/${sessionNumber}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async getTechnicianStats() {
    return this.request<{
      technicians: TechnicianStats[];
      summary: {
        technicianCount: number;
        totalSessions: number;
        totalCompleted: number;
        totalPassed: number;
        totalFailed: number;
        overallPassRate: number;
      };
    }>('/workflow/diagnostics/technicians/stats');
  }

  async getTechnicianStatsById(technicianId: string) {
    return this.request<TechnicianStats>(`/workflow/diagnostics/technicians/${technicianId}/stats`);
  }

  // ==================== CERTIFICATIONS API (QuickDiagnosticz) ====================

  async getCertifications(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/workflow/certifications${query}`);
  }

  async getCertification(certificationId: string) {
    return this.request<any>(`/workflow/certifications/${certificationId}`);
  }

  async issueCertification(data: {
    qlid: string;
    category: string;
    manufacturer: string;
    model: string;
    certificationLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NOT_CERTIFIED';
    serialNumber?: string;
    sessionId?: string;
    jobId?: string;
    notes?: string;
    warrantyType?: string;
    warrantyStatus?: string;
    warrantyProvider?: string;
    warrantyEndDate?: string;
  }) {
    return this.request<any>('/workflow/certifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeCertification(certificationId: string, reason: string) {
    return this.request<any>(`/workflow/certifications/${certificationId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getCertificationReport(certificationId: string, format: 'pdf' | 'json' = 'json') {
    return this.request<any>(`/workflow/certifications/${certificationId}/report?format=${format}`);
  }

  async getCertificationLabel(certificationId: string) {
    // Returns a blob URL for the label image
    const response = await fetch(`${API_BASE}/workflow/certifications/${certificationId}/label?format=buffer`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to get label');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async verifyCertification(certificationId: string) {
    return this.request<any>(`/workflow/certifications/verify/${certificationId}`);
  }

  async getCertificationStats() {
    return this.request<any>('/workflow/certifications/stats');
  }

  // ==================== EXTERNAL CHECKS API ====================

  async runExternalCheck(data: {
    qlid: string;
    checkType: 'IMEI' | 'SERIAL' | 'WARRANTY' | 'STOLEN' | 'RECALL';
    identifier: string;
    identifierType?: 'imei' | 'serial';
    provider?: string;
    certificationId?: string;
    sessionId?: string;
  }) {
    return this.request<any>('/workflow/checks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async runAllExternalChecks(data: {
    qlid: string;
    imei?: string;
    serial?: string;
    certificationId?: string;
    sessionId?: string;
  }) {
    return this.request<{
      checks: any[];
      flags: {
        hasFlags: boolean;
        isStolen: boolean;
        isBlacklisted: boolean;
        hasFinancialHold: boolean;
      };
      summary: {
        total: number;
        clear: number;
        flagged: number;
        error: number;
      };
    }>('/workflow/checks/all', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExternalChecks(qlid: string) {
    return this.request<{
      checks: any[];
      flags: {
        hasFlags: boolean;
        isStolen: boolean;
        isBlacklisted: boolean;
        hasFinancialHold: boolean;
      };
      summary: {
        total: number;
        clear: number;
        flagged: number;
        error: number;
      };
    }>(`/workflow/checks/${qlid}`);
  }

  async getExternalChecksForCertification(certificationId: string) {
    return this.request<{
      checks: any[];
      summary: {
        total: number;
        clear: number;
        flagged: number;
        error: number;
      };
    }>(`/workflow/checks/cert/${certificationId}`);
  }

  async getDeviceFlags(qlid: string) {
    return this.request<{
      hasFlags: boolean;
      isStolen: boolean;
      isBlacklisted: boolean;
      hasFinancialHold: boolean;
    }>(`/workflow/checks/${qlid}/flags`);
  }

  // ==================== PALLET LABELS API ====================

  async getPalletLabel(palletId: string, format: 'png' | 'zpl' = 'png'): Promise<string> {
    const response = await fetch(`${API_BASE}/labels/pallet/${palletId}?format=${format}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get pallet label' }));
      throw new Error(error.error || 'Failed to get pallet label');
    }

    if (format === 'zpl') {
      return response.text();
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async printZplLabel(printerIp: string, palletId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/labels/print-zpl', {
      method: 'POST',
      body: JSON.stringify({ printerIp, palletId }),
    });
  }

  // ==================== REFURB LABELS API (RFB-QLID format) ====================

  async getRefurbLabel(qlid: string, format: 'png' | 'zpl' = 'png'): Promise<string> {
    const response = await fetch(`${API_BASE}/labels/refurb/${qlid}?format=${format}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get refurb label' }));
      throw new Error(error.error || 'Failed to get refurb label');
    }

    if (format === 'zpl') {
      return response.text();
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async printRefurbLabel(printerIp: string, qlid: string): Promise<{ success: boolean; qsku: string }> {
    return this.request<{ success: boolean; qsku: string }>('/labels/refurb/print-zpl', {
      method: 'POST',
      body: JSON.stringify({ printerIp, qlid }),
    });
  }
}

export const api = new ApiClient();
