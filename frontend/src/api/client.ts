const API_BASE = import.meta.env.VITE_API_BASE || '/api';

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
  private _autoLoginPromise: Promise<void> | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
    this._autoLoginPromise = this.tryStationAutoLogin();
  }

  private async tryStationAutoLogin() {
    const electron = (window as any).electronAPI;
    if (!electron?.getStationCredentials || this.token) return;
    try {
      const creds = await electron.getStationCredentials();
      if (creds?.email && creds?.password) {
        await this.login(creds.email, creds.password);
      }
    } catch (err) {
      console.error('Station auto-login failed:', err);
    }
  }

  get autoLoginReady() {
    return this._autoLoginPromise;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        if (response.status === 401) {
          this.setToken(null);
        }
        throw new Error(error.error || (response.status === 401 ? 'Unauthorized' : 'Request failed'));
      }

      return response.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Auth
  async login(email: string, password: string) {
    // Clear any stale token before login — prevents 401 from old token being sent
    this.setToken(null);
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    // Persist credentials in Electron station config for auto-login on next launch
    try {
      const electron = (window as any).electronAPI;
      if (electron?.saveCredentials) {
        await electron.saveCredentials(email, password);
      }
    } catch (_) {
      // Non-critical — ignore if not running in Electron or save fails
    }
    return result;
  }

  async me() {
    return this.request<{ user: any }>('/auth/me');
  }

  async getCurrentUser() {
    const result = await this.me();
    return result.user;
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

  async createPalletFromSourcing(data: {
    sourcingPalletId: string;
    sourcingOrderId?: string;
    workstationId?: string;
  }) {
    return this.request<any>('/pallets/from-sourcing', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateRfbPalletId(retailer?: string) {
    return this.request<{ palletId: string }>('/pallets/generate-rfb-id', {
      method: 'POST',
      body: JSON.stringify({ retailer: retailer || 'OTHER' }),
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

  async reserveQlid(palletId: string): Promise<{ qlid: string; tick: number; barcodeValue: string }> {
    return this.request<{ qlid: string; tick: number; barcodeValue: string }>('/qlid/reserve', {
      method: 'POST',
      body: JSON.stringify({ palletId }),
    });
  }

  async updateItemByQlid(qlid: string, data: any): Promise<any> {
    return this.request<any>(`/items/${qlid}`, {
      method: 'PUT',
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

  async getCompatibleParts(category: string) {
    return this.request<Array<{
      id: string;
      partNumber: string;
      name: string;
      description?: string;
      category: string;
      quantityOnHand: number;
      quantityReserved: number;
      unitCost: number;
      location?: string;
    }>>(`/parts/compatible/${category}`);
  }

  async getPartsUsageForItem(qlid: string) {
    return this.request<Array<{
      id: string;
      qlid: string;
      partId: string;
      partNumber: string;
      partName: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      usedByTechnicianId: string;
      usedByTechnicianName?: string;
      notes?: string;
      createdAt: string;
    }>>(`/items/${qlid}/parts`);
  }

  async usePartsForItem(qlid: string, parts: Array<{ partId: string; quantity: number; notes?: string }>) {
    return this.request<{
      usage: Array<{
        id: string;
        qlid: string;
        partId: string;
        partNumber: string;
        partName: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }>;
      totalCost: number;
      partsCount: number;
    }>(`/items/${qlid}/parts`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
    });
  }

  async getPartsStats() {
    return this.request<{
      totalParts: number;
      totalValue: number;
      lowStockCount: number;
      byCategory: Record<string, number>;
      totalUsageCount: number;
      totalUsageCost: number;
    }>('/parts/stats');
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

  // ==================== UPC LOOKUP API ====================

  async lookupUPC(upc: string) {
    return this.request<{
      upc: string;
      brand: string | null;
      model: string | null;
      title: string | null;
      category: string | null;
      msrp: number | null;
      imageUrl: string | null;
      provider: 'rainforest' | 'cache' | 'manual';
      cached: boolean;
    }>(`/upc/${upc}`);
  }

  async addManualUPC(data: {
    upc: string;
    brand?: string;
    model?: string;
    title?: string;
    category?: string;
    msrp?: number;
    imageUrl?: string;
  }) {
    return this.request<{
      upc: string;
      brand: string | null;
      model: string | null;
      title: string | null;
      category: string | null;
      msrp: number | null;
      imageUrl: string | null;
      provider: 'manual';
      cached: boolean;
    }>('/upc/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchUPCs(query: string, limit?: number) {
    const params = new URLSearchParams({ query });
    if (limit) params.append('limit', limit.toString());
    return this.request<Array<{
      upc: string;
      brand: string | null;
      model: string | null;
      title: string | null;
      category: string | null;
      msrp: number | null;
      imageUrl: string | null;
      provider: string;
      cached: boolean;
    }>>(`/upc/search?${params}`);
  }

  async getUPCStats() {
    return this.request<{
      total: number;
      byProvider: Record<string, number>;
    }>('/upc/stats');
  }

  // ==================== SUPERVISOR ====================

  async supervisorPalletAction(data: {
    code: string;
    action: 'rename' | 'reprint';
    palletId: string;
    newPalletId?: string;
  }) {
    return this.request<any>('/supervisor/pallet-action', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== SOURCING LOOKUP ====================

  async lookupSourcingPallet(palletId: string) {
    return this.request<any>(`/sourcing/pallet/${encodeURIComponent(palletId)}`);
  }

  async lookupSourcingOrder(orderId: string) {
    return this.request<any>(`/sourcing/order/${encodeURIComponent(orderId)}`);
  }

  async checkSourcingHealth() {
    return this.request<any>('/health/sourcing');
  }

  // ==================== INTAKE IDENTIFICATION ====================

  async identifyByBarcode(barcode: string) {
    return this.request<any>('/intake/identify/barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode }),
    });
  }

  async identifyBySearch(query: string) {
    return this.request<any>('/intake/identify/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async identifyFromLabelPhoto(photo: File) {
    const formData = new FormData();
    formData.append('photo', photo);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/intake/identify/label-photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Label photo identification failed' }));
      throw new Error(err.error || 'Label photo identification failed');
    }

    return response.json();
  }

  async identifyFromProductPhoto(photo: File) {
    const formData = new FormData();
    formData.append('photo', photo);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/intake/identify/product-photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Product photo identification failed' }));
      throw new Error(err.error || 'Product photo identification failed');
    }

    return response.json();
  }

  // ==================== PHOTO API ====================

  async uploadPhotos(
    qlid: string,
    photos: File[],
    stage: string,
    photoType: string,
    caption?: string
  ): Promise<{
    photos: Array<{
      id: string;
      qlid: string;
      stage: string;
      photoType: string;
      filePath: string;
      capturedAt: string;
    }>;
    count: number;
  }> {
    const formData = new FormData();
    photos.forEach(photo => formData.append('photos', photo));
    formData.append('stage', stage);
    formData.append('photoType', photoType);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`${API_BASE}/photos/${qlid}`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async getPhotos(qlid: string, stage?: string) {
    const params = stage ? `?stage=${stage}` : '';
    return this.request<Array<{
      id: string;
      qlid: string;
      stage: string;
      photoType: string;
      filePath: string;
      thumbnailPath: string | null;
      originalFilename: string | null;
      mimeType: string | null;
      fileSize: number | null;
      caption: string | null;
      capturedBy: string | null;
      capturedAt: string;
    }>>(`/photos/${qlid}${params}`);
  }

  async getPhotoUrl(photoId: string): Promise<string> {
    const response = await fetch(`${API_BASE}/photos/file/${photoId}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to get photo');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async getPhotoCount(qlid: string) {
    return this.request<{
      total: number;
      byStage: Record<string, number>;
      byType: Record<string, number>;
    }>(`/photos/${qlid}/count`);
  }

  async updatePhotoCaption(photoId: string, caption: string) {
    return this.request<{
      id: string;
      caption: string;
    }>(`/photos/file/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ caption }),
    });
  }

  async deletePhoto(photoId: string) {
    return this.request<{ success: boolean }>(`/photos/file/${photoId}`, {
      method: 'DELETE',
    });
  }

  // ==================== GRADING API ====================

  async getGradingRubric(category: string) {
    return this.request<{
      id: string;
      category: string;
      criteria: Array<{
        code: string;
        name: string;
        description: string;
        type: 'cosmetic' | 'functional';
        weight: number;
        options: Array<{
          value: number;
          label: string;
          description?: string;
        }>;
      }>;
      gradeThresholds: {
        A: number;
        B: number;
        C: number;
        D: number;
      };
    }>(`/grading/rubric/${category}`);
  }

  async getAllGradingRubrics() {
    return this.request<Array<{
      id: string;
      category: string;
      criteria: any[];
      gradeThresholds: { A: number; B: number; C: number; D: number };
    }>>('/grading/rubrics');
  }

  async createGradingAssessment(data: {
    qlid: string;
    category: string;
    criteriaResults: Record<string, { score: number; notes?: string }>;
    gradeOverride?: 'A' | 'B' | 'C' | 'D' | 'F';
  }) {
    return this.request<{
      id: string;
      qlid: string;
      category: string;
      cosmeticScore: number;
      functionalScore: number;
      overallScore: number;
      calculatedGrade: string;
      finalGrade: string;
      criteriaResults: Record<string, { score: number; notes?: string }>;
      assessedBy: string;
      assessedAt: string;
    }>('/grading/assess', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGradingAssessment(qlid: string) {
    return this.request<{
      id: string;
      qlid: string;
      category: string;
      cosmeticScore: number;
      functionalScore: number;
      overallScore: number;
      calculatedGrade: string;
      finalGrade: string;
      criteriaResults: Record<string, { score: number; notes?: string }>;
      assessedBy: string;
      assessedAt: string;
    }>(`/grading/assessment/${qlid}`);
  }

  async getGradingHistory(qlid: string) {
    return this.request<Array<{
      id: string;
      qlid: string;
      category: string;
      cosmeticScore: number;
      functionalScore: number;
      overallScore: number;
      calculatedGrade: string;
      finalGrade: string;
      assessedBy: string;
      assessedAt: string;
    }>>(`/grading/history/${qlid}`);
  }

  async getGradingStats() {
    return this.request<{
      total: number;
      byGrade: Record<string, number>;
      byCategory: Record<string, Record<string, number>>;
      averageScore: number;
    }>('/grading/stats');
  }

  // ==================== COST TRACKING API ====================

  async recordLabor(data: {
    qlid: string;
    stage: string;
    durationMinutes: number;
    laborRate?: number;
    startedAt?: string;
    endedAt?: string;
  }) {
    return this.request<{
      id: string;
      qlid: string;
      technicianId: string;
      technicianName?: string;
      stage: string;
      durationMinutes: number;
      laborRate: number;
      laborCost: number;
      startedAt: string;
      endedAt: string;
      createdAt: string;
    }>('/costs/labor', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLaborForItem(qlid: string) {
    return this.request<Array<{
      id: string;
      qlid: string;
      technicianId: string;
      technicianName?: string;
      stage: string;
      durationMinutes: number;
      laborRate: number;
      laborCost: number;
      startedAt: string;
      endedAt: string;
      createdAt: string;
    }>>(`/costs/labor/${qlid}`);
  }

  async calculateCosts(qlid: string, unitCogs?: number) {
    return this.request<{
      id: string;
      qlid: string;
      unitCogs: number;
      partsCost: number;
      laborCost: number;
      overheadCost: number;
      totalCost: number;
      estimatedValue: number | null;
      profitMargin: number | null;
      calculatedAt: string;
    }>(`/costs/calculate/${qlid}`, {
      method: 'POST',
      body: JSON.stringify({ unitCogs }),
    });
  }

  async getCostBreakdown(qlid: string) {
    return this.request<{
      qlid: string;
      unitCogs: number;
      partsCost: number;
      partsCount: number;
      laborCost: number;
      laborMinutes: number;
      overheadCost: number;
      totalCost: number;
      estimatedValue: number | null;
      profitMargin: number | null;
      partsDetail: Array<{
        partName: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }>;
      laborDetail: Array<{
        stage: string;
        technicianName: string;
        durationMinutes: number;
        laborCost: number;
      }>;
    }>(`/costs/breakdown/${qlid}`);
  }

  async getCostSummary(qlid: string) {
    return this.request<{
      qlid: string;
      unitCogs: number;
      partsCost: number;
      laborCost: number;
      overheadCost: number;
      totalCost: number;
      estimatedValue: number | null;
      profitMargin: number | null;
      calculatedAt: string | null;
    }>(`/costs/summary/${qlid}`);
  }

  async setUnitCogs(qlid: string, unitCogs: number) {
    return this.request<{
      id: string;
      qlid: string;
      unitCogs: number;
      totalCost: number;
    }>(`/costs/cogs/${qlid}`, {
      method: 'POST',
      body: JSON.stringify({ unitCogs }),
    });
  }

  async setEstimatedValue(qlid: string, estimatedValue: number) {
    return this.request<{
      qlid: string;
      estimatedValue: number;
      profitMargin: number | null;
    }>(`/costs/value/${qlid}`, {
      method: 'POST',
      body: JSON.stringify({ estimatedValue }),
    });
  }

  async getCostStats() {
    return this.request<{
      totalItems: number;
      totalPartsCost: number;
      totalLaborCost: number;
      totalCost: number;
      averageCostPerItem: number;
      averageProfitMargin: number;
      totalLaborMinutes: number;
    }>('/costs/stats');
  }

  // ==================== PALLET LABELS API ====================

  /**
   * Get pallet label as PNG blob URL or ZPL text
   * @param labelSize - '4x6' (default, warehouse thermal) or '2x1' (small)
   */
  async getPalletLabel(
    palletId: string,
    format: 'png' | 'zpl' = 'png',
    labelSize: '4x6' | '2x1' = '4x6'
  ): Promise<string> {
    const params = new URLSearchParams({ format, labelSize });
    const response = await fetch(`${API_BASE}/labels/pallet/${palletId}?${params}`, {
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

  /**
   * Print pallet label via ZPL to a Zebra printer
   * @param labelSize - '4x6' (default, warehouse thermal) or '2x1' (small)
   */
  async printZplLabel(
    printerIp: string,
    palletId: string,
    labelSize: '4x6' | '2x1' = '4x6'
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/labels/print-zpl', {
      method: 'POST',
      body: JSON.stringify({ printerIp, palletId, labelSize }),
    });
  }

  // ==================== REFURB LABELS API (RFB-QLID format) ====================

  /**
   * Get refurb label as PNG blob URL or ZPL text
   * @param labelSize - '2x1.5' (default) or '4x6' (warehouse thermal)
   */
  async getRefurbLabel(
    qlid: string,
    format: 'png' | 'zpl' = 'png',
    labelSize: '2x1.5' | '4x6' = '2x1.5'
  ): Promise<string> {
    const params = new URLSearchParams({ format, labelSize });
    const response = await fetch(`${API_BASE}/labels/refurb/${qlid}?${params}`, {
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

  /**
   * Print refurb label via ZPL to a Zebra printer
   * @param labelSize - '2x1.5' (default) or '4x6' (warehouse thermal)
   */
  async printRefurbLabel(
    printerIp: string,
    qlid: string,
    labelSize: '2x1.5' | '4x6' = '2x1.5'
  ): Promise<{ success: boolean; qsku: string }> {
    return this.request<{ success: boolean; qsku: string }>('/labels/refurb/print-zpl', {
      method: 'POST',
      body: JSON.stringify({ printerIp, qlid, labelSize }),
    });
  }

  // ==================== DATA WIPE CERTIFICATES API ====================

  async createCertificate(data: {
    qlid: string;
    deviceInfo: {
      manufacturer: string;
      model: string;
      serialNumber?: string;
      imei?: string;
      storageType?: string;
      storageCapacity?: string;
    };
    wipeMethod: 'NIST_800_88' | 'DOD_5220_22M' | 'SECURE_ERASE' | 'CRYPTO_ERASE' | 'PHYSICAL_DESTROY';
    wipeStartedAt: string;
    wipeCompletedAt: string;
    verificationMethod: 'RANDOM_SAMPLE' | 'FULL_VERIFY' | 'VISUAL_INSPECT' | 'ATTESTATION';
    verificationPassed?: boolean;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      certificateNumber: string;
      qlid: string;
      deviceInfo: any;
      wipeMethod: string;
      wipeStartedAt: string;
      wipeCompletedAt: string;
      verificationMethod: string;
      verificationPassed: boolean;
      technicianId: string;
      technicianName?: string;
      verificationCode: string;
      notes?: string;
      createdAt: string;
    }>('/certificates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCertificate(identifier: string) {
    return this.request<{
      id: string;
      certificateNumber: string;
      qlid: string;
      deviceInfo: {
        manufacturer: string;
        model: string;
        serialNumber?: string;
        imei?: string;
        storageType?: string;
        storageCapacity?: string;
      };
      wipeMethod: string;
      wipeStartedAt: string;
      wipeCompletedAt: string;
      verificationMethod: string;
      verificationPassed: boolean;
      technicianId: string;
      technicianName?: string;
      verificationCode: string;
      notes?: string;
      createdAt: string;
    }>(`/certificates/${identifier}`);
  }

  async getCertificateForItem(qlid: string) {
    return this.request<{
      id: string;
      certificateNumber: string;
      qlid: string;
      deviceInfo: any;
      wipeMethod: string;
      wipeStartedAt: string;
      wipeCompletedAt: string;
      verificationMethod: string;
      verificationPassed: boolean;
      technicianId: string;
      technicianName?: string;
      verificationCode: string;
      notes?: string;
      createdAt: string;
    } | null>(`/certificates/item/${qlid}`);
  }

  async verifyCertificate(certificateNumber: string, verificationCode: string) {
    return this.request<{
      valid: boolean;
      certificate?: any;
      error?: string;
    }>('/certificates/verify', {
      method: 'POST',
      body: JSON.stringify({ certificateNumber, verificationCode }),
    });
  }

  async getCertificateText(identifier: string): Promise<string> {
    const response = await fetch(`${API_BASE}/certificates/${identifier}/text`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get certificate text' }));
      throw new Error(error.error || 'Failed to get certificate text');
    }
    return response.text();
  }

  async getCertificateContent(identifier: string) {
    return this.request<{
      certificate: any;
      content: {
        title: string;
        sections: Array<{ heading: string; content: string }>;
      };
    }>(`/certificates/${identifier}/content`);
  }

  async listCertificates(options?: { limit?: number; wipeMethod?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.wipeMethod) params.append('wipeMethod', options.wipeMethod);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<Array<{
      id: string;
      certificateNumber: string;
      qlid: string;
      deviceInfo: any;
      wipeMethod: string;
      wipeStartedAt: string;
      wipeCompletedAt: string;
      verificationMethod: string;
      verificationPassed: boolean;
      technicianId: string;
      technicianName?: string;
      verificationCode: string;
      notes?: string;
      createdAt: string;
    }>>(`/certificates${queryStr}`);
  }

  async getCertificateStats() {
    return this.request<{
      total: number;
      byMethod: Record<string, number>;
      passRate: number;
    }>('/certificates/stats/summary');
  }

  // ==================== BATCH EXPORT API ====================

  async createExport(options: {
    type: 'items' | 'pallets' | 'certificates' | 'grading' | 'parts_usage' | 'labor' | 'costs' | 'full_report';
    format: 'csv' | 'xlsx';
    batchSize?: number;
    filters?: {
      startDate?: string;
      endDate?: string;
      palletId?: string;
      stage?: string;
      grade?: string;
    };
  }) {
    return this.request<{
      id: string;
      type: string;
      format: string;
      totalRecords: number;
      batchCount: number;
      files: string[];
      exportedAt: string;
      duration: number;
    }>('/exports', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async listExports() {
    return this.request<Array<{
      name: string;
      path: string;
      createdAt: string;
    }>>('/exports');
  }

  async getExportFiles(exportName: string) {
    return this.request<string[]>(`/exports/${exportName}/files`);
  }

  async downloadExport(exportName: string, filename: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/exports/download/${exportName}/${filename}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Failed to download export');
    }
    return response.blob();
  }

  async deleteExport(exportName: string) {
    return this.request<{ success: boolean }>(`/exports/${exportName}`, {
      method: 'DELETE',
    });
  }

  async getExportStats() {
    return this.request<{
      totalExports: number;
      totalSize: number;
      byType: Record<string, number>;
    }>('/exports/stats/summary');
  }

  // ==================== WEBHOOK API ====================

  async createWebhook(data: {
    name: string;
    url: string;
    events: Array<'item.created' | 'item.updated' | 'item.completed' | 'item.graded' | 'item.certified' | 'pallet.created' | 'pallet.completed' | 'inventory.low'>;
    format?: 'json' | 'shopify' | 'ebay' | 'csv' | 'xml';
    headers?: Record<string, string>;
  }) {
    return this.request<{
      id: string;
      name: string;
      url: string;
      secret: string;
      events: string[];
      format: string;
      isActive: boolean;
      headers?: Record<string, string>;
      retryCount: number;
      createdAt: string;
      updatedAt: string;
    }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listWebhooks(activeOnly = false) {
    const params = activeOnly ? '?activeOnly=true' : '';
    return this.request<Array<{
      id: string;
      name: string;
      url: string;
      secret: string;
      events: string[];
      format: string;
      isActive: boolean;
      headers?: Record<string, string>;
      retryCount: number;
      lastTriggeredAt?: string;
      lastStatus?: number;
      createdAt: string;
      updatedAt: string;
    }>>(`/webhooks${params}`);
  }

  async getWebhook(id: string) {
    return this.request<{
      id: string;
      name: string;
      url: string;
      secret: string;
      events: string[];
      format: string;
      isActive: boolean;
      headers?: Record<string, string>;
      retryCount: number;
      lastTriggeredAt?: string;
      lastStatus?: number;
      createdAt: string;
      updatedAt: string;
    }>(`/webhooks/${id}`);
  }

  async updateWebhook(id: string, data: Partial<{
    name: string;
    url: string;
    events: string[];
    format: string;
    headers: Record<string, string>;
    isActive: boolean;
  }>) {
    return this.request<{
      id: string;
      name: string;
      url: string;
      secret: string;
      events: string[];
      format: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWebhook(id: string) {
    return this.request<{ success: boolean }>(`/webhooks/${id}`, {
      method: 'DELETE',
    });
  }

  async regenerateWebhookSecret(id: string) {
    return this.request<{ secret: string }>(`/webhooks/${id}/regenerate-secret`, {
      method: 'POST',
    });
  }

  async testWebhook(id: string) {
    return this.request<{ success: boolean; message: string }>(`/webhooks/${id}/test`, {
      method: 'POST',
    });
  }

  async processWebhookRetries() {
    return this.request<{ processed: number }>('/webhooks/process-retries', {
      method: 'POST',
    });
  }

  // ==================== PRODUCT FEED API ====================

  async getProductFeed(options?: {
    format?: 'json' | 'shopify' | 'ebay' | 'csv' | 'xml';
    since?: string;
    until?: string;
    status?: string;
    grade?: string;
    category?: string;
    palletId?: string;
    limit?: number;
    offset?: number;
    includeImages?: boolean;
  }) {
    const params = new URLSearchParams();
    if (options?.format) params.append('format', options.format);
    if (options?.since) params.append('since', options.since);
    if (options?.until) params.append('until', options.until);
    if (options?.status) params.append('status', options.status);
    if (options?.grade) params.append('grade', options.grade);
    if (options?.category) params.append('category', options.category);
    if (options?.palletId) params.append('palletId', options.palletId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.includeImages !== undefined) params.append('includeImages', options.includeImages.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      items: Array<{
        id: string;
        qlid: string;
        qsku: string;
        title: string;
        description: string;
        manufacturer: string;
        model: string;
        category: string;
        condition: string;
        grade: string;
        price: number | null;
        msrp: number | null;
        costBasis: number | null;
        quantity: number;
        upc: string | null;
        serialNumber: string | null;
        images: string[];
        specifications: Record<string, string>;
        certificationId: string | null;
        warrantyEligible: boolean;
        dataWiped: boolean;
        createdAt: string;
        updatedAt: string;
        completedAt: string | null;
      }>;
      count: number;
      generatedAt: string;
    }>(`/feed/products${queryStr}`);
  }

  async getShopifyFeed(options?: {
    since?: string;
    status?: string;
    grade?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.since) params.append('since', options.since);
    if (options?.status) params.append('status', options.status);
    if (options?.grade) params.append('grade', options.grade);
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      products: any[];
    }>(`/feed/shopify${queryStr}`);
  }

  async getEbayFeed(options?: {
    since?: string;
    status?: string;
    grade?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.since) params.append('since', options.since);
    if (options?.status) params.append('status', options.status);
    if (options?.grade) params.append('grade', options.grade);
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      items: any[];
    }>(`/feed/ebay${queryStr}`);
  }

  async downloadFeedCSV(options?: {
    since?: string;
    status?: string;
    grade?: string;
    category?: string;
    limit?: number;
  }): Promise<Blob> {
    const params = new URLSearchParams();
    if (options?.since) params.append('since', options.since);
    if (options?.status) params.append('status', options.status);
    if (options?.grade) params.append('grade', options.grade);
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE}/feed/csv${queryStr}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Failed to download CSV feed');
    }
    return response.blob();
  }

  async getFeedProduct(qlid: string) {
    return this.request<{
      id: string;
      qlid: string;
      qsku: string;
      title: string;
      description: string;
      manufacturer: string;
      model: string;
      category: string;
      condition: string;
      grade: string;
      price: number | null;
      quantity: number;
      upc: string | null;
      serialNumber: string | null;
      images: string[];
      certificationId: string | null;
      warrantyEligible: boolean;
      dataWiped: boolean;
      createdAt: string;
      completedAt: string | null;
    }>(`/feed/products/${qlid}`);
  }

  async getFeedStats() {
    return this.request<{
      totalItems: number;
      completedItems: number;
      byGrade: Record<string, number>;
      byCategory: Record<string, number>;
      recentUpdates: number;
      webhookSubscriptions: number;
      pendingDeliveries: number;
    }>('/feed/stats');
  }

  // ==================== MONITORING API ====================

  /**
   * Connect to real-time monitoring stream via Server-Sent Events
   * Returns an EventSource that emits updates
   */
  connectToMonitorStream(): EventSource {
    return new EventSource(`${API_BASE}/monitor/stream`);
  }

  async getDashboardStats() {
    return this.request<{
      overview: {
        totalItems: number;
        inProgress: number;
        completedToday: number;
        completedThisWeek: number;
        pendingItems: number;
        averageProcessingTime: number;
      };
      stages: Array<{
        stage: string;
        count: number;
        percentage: number;
        trend: 'up' | 'down' | 'stable';
      }>;
      throughput: {
        hourly: Array<{ timestamp: string; intake: number; completed: number }>;
        daily: Array<{ timestamp: string; intake: number; completed: number }>;
        weekly: Array<{ timestamp: string; intake: number; completed: number }>;
      };
      technicians: Array<{
        id: string;
        name: string;
        itemsProcessed: number;
        itemsInProgress: number;
        averageTime: number;
        currentStage: string | null;
        lastActivity: string;
      }>;
      grades: Array<{
        grade: string;
        count: number;
        percentage: number;
        averageValue: number;
      }>;
      alerts: Array<{
        id: string;
        type: 'warning' | 'error' | 'info';
        category: 'inventory' | 'performance' | 'quality' | 'system';
        message: string;
        timestamp: string;
        acknowledged: boolean;
      }>;
      recentActivity: Array<{
        id: string;
        type: 'intake' | 'stage_change' | 'graded' | 'completed' | 'certified' | 'part_used';
        qlid: string;
        description: string;
        technician: string | null;
        timestamp: string;
        metadata?: Record<string, any>;
      }>;
    }>('/monitor/dashboard');
  }

  async getMonitorOverview() {
    return this.request<{
      totalItems: number;
      inProgress: number;
      completedToday: number;
      completedThisWeek: number;
      pendingItems: number;
      averageProcessingTime: number;
    }>('/monitor/overview');
  }

  async getStageDistribution() {
    return this.request<Array<{
      stage: string;
      count: number;
      percentage: number;
      trend: 'up' | 'down' | 'stable';
    }>>('/monitor/stages');
  }

  async getThroughputData() {
    return this.request<{
      hourly: Array<{ timestamp: string; intake: number; completed: number }>;
      daily: Array<{ timestamp: string; intake: number; completed: number }>;
      weekly: Array<{ timestamp: string; intake: number; completed: number }>;
    }>('/monitor/throughput');
  }

  async getMonitorTechnicianStats() {
    return this.request<Array<{
      id: string;
      name: string;
      itemsProcessed: number;
      itemsInProgress: number;
      averageTime: number;
      currentStage: string | null;
      lastActivity: string;
    }>>('/monitor/technicians');
  }

  async getGradeDistribution() {
    return this.request<Array<{
      grade: string;
      count: number;
      percentage: number;
      averageValue: number;
    }>>('/monitor/grades');
  }

  async getMonitorAlerts() {
    return this.request<Array<{
      id: string;
      type: 'warning' | 'error' | 'info';
      category: 'inventory' | 'performance' | 'quality' | 'system';
      message: string;
      timestamp: string;
      acknowledged: boolean;
    }>>('/monitor/alerts');
  }

  async getRecentActivity(limit = 50) {
    return this.request<Array<{
      id: string;
      type: 'intake' | 'stage_change' | 'graded' | 'completed' | 'certified' | 'part_used';
      qlid: string;
      description: string;
      technician: string | null;
      timestamp: string;
      metadata?: Record<string, any>;
    }>>(`/monitor/activity?limit=${limit}`);
  }

  async getProductivityReport(startDate: string, endDate: string) {
    return this.request<{
      summary: {
        totalProcessed: number;
        avgProcessingTime: number;
        gradeARate: number;
        technicianCount: number;
      };
      byTechnician: Array<{
        id: string;
        name: string;
        itemsProcessed: number;
        itemsInProgress: number;
        averageTime: number;
        currentStage: string | null;
        lastActivity: string;
      }>;
      byDay: Array<{ date: string; processed: number; avgTime: number }>;
      byGrade: Array<{
        grade: string;
        count: number;
        percentage: number;
        averageValue: number;
      }>;
    }>(`/monitor/reports/productivity?startDate=${startDate}&endDate=${endDate}`);
  }

  async getInventoryHealth() {
    return this.request<{
      stages: Array<{ stage: string; count: number; avgAge: number }>;
      oldestItems: Array<{ qlid: string; stage: string; daysInStage: number }>;
      bottlenecks: Array<{ stage: string; backlog: number; throughput: number }>;
    }>('/monitor/reports/inventory');
  }

  async getMonitorClientCount() {
    return this.request<{ connectedClients: number }>('/monitor/clients');
  }

  // Station Management
  async seedStations() {
    return this.request<{
      created: { email: string; name: string; station_id: string }[];
      skipped: string[];
      total: number;
    }>('/admin/seed-stations', { method: 'POST' });
  }

  async stationHeartbeat(data: {
    station_id: string;
    current_page?: string;
    current_item?: string;
    uptime?: number;
  }) {
    return this.request<{ ok: boolean }>('/stations/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async stationSetupComplete(data: {
    station_id: string;
    workstation_id?: string;
    warehouse_id?: string;
  }) {
    return this.request<{ ok: boolean }>('/stations/setup-complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStations() {
    return this.request<Array<{
      station_id: string;
      user_id: string;
      name: string;
      email: string;
      status: 'online' | 'idle' | 'offline';
      last_heartbeat: string | null;
      current_page: string | null;
      current_item: string | null;
      setup_complete: boolean;
      setup_at: string | null;
      heartbeats_today: number;
    }>>('/admin/stations');
  }

  async getStationActivity(stationId: string, limit = 50) {
    return this.request<Array<{
      id: string;
      station_id: string;
      event: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>>(`/admin/stations/${stationId}/activity?limit=${limit}`);
  }

  // ==================== Printer Management ====================

  async discoverPrinters(subnet?: string) {
    const query = subnet ? `?subnet=${encodeURIComponent(subnet)}` : '';
    return this.request<{
      printers: Array<{
        ip: string;
        port: number;
        model: string;
        serial: string;
        firmware: string;
        status: 'online' | 'error';
        responseTime: number;
      }>;
    }>(`/printers/discover${query}`);
  }

  async getPrinterStatus(ip: string) {
    return this.request<{
      ip: string;
      online: boolean;
      model?: string;
      serial?: string;
      firmware?: string;
      labelWidthDots?: number;
      labelLengthDots?: number;
      paperOut?: boolean;
      headOpen?: boolean;
      paused?: boolean;
    }>(`/printers/status/${encodeURIComponent(ip)}`);
  }

  async getPrinterSettings() {
    return this.request<{
      printers: Array<{
        id: string;
        user_id: string;
        station_id: string | null;
        printer_ip: string;
        printer_name: string | null;
        printer_model: string | null;
        label_width_mm: number;
        label_height_mm: number;
        print_density_dpi: number;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }>;
    }>('/printers/settings');
  }

  async savePrinterSettings(data: {
    printer_ip: string;
    printer_name?: string;
    printer_model?: string;
    label_width_mm?: number;
    label_height_mm?: number;
    print_density_dpi?: number;
    station_id?: string;
    is_default?: boolean;
  }) {
    return this.request<{ printer: Record<string, unknown> }>('/printers/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePrinterSettings(id: string) {
    return this.request<{ ok: boolean }>(`/printers/settings/${id}`, {
      method: 'DELETE',
    });
  }

  async testPrint(printerIp: string, labelWidthMm?: number, labelHeightMm?: number) {
    return this.request<{ ok: boolean; message: string }>('/printers/test', {
      method: 'POST',
      body: JSON.stringify({
        printer_ip: printerIp,
        label_width_mm: labelWidthMm,
        label_height_mm: labelHeightMm,
      }),
    });
  }

  async getPrinterLabelSize(ip: string) {
    return this.request<{
      labelWidthDots: number;
      labelLengthDots: number;
      dpi: number;
      widthMm: number;
      heightMm: number;
    }>(`/printers/label-size/${encodeURIComponent(ip)}`);
  }

  async getLabelPresets() {
    return this.request<{
      presets: Record<string, { widthMm: number; heightMm: number; dpi: number; name: string }>;
    }>('/printers/label-presets');
  }

  // ==================== Photo Upload ====================

  async uploadRefurbPhotos(qlid: string, files: File[]) {
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/items/${qlid}/photos`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }

    return response.json() as Promise<{ photos: Array<{ id: string; url: string; filename: string }> }>;
  }

  async getItemPhotos(qlid: string) {
    return this.request<{
      photos: Array<{ id: string; url: string; filename: string; uploaded_at: string; uploaded_by: string }>;
    }>(`/items/${qlid}/photos`);
  }

  async deleteItemPhoto(qlid: string, photoId: string) {
    return this.request<{ ok: boolean }>(`/items/${qlid}/photos/${photoId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
