export interface Reservation {
  id: string;
  userId: string;
  serviceId?: string;
  quoteId?: string;
  scheduledDate: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyJantesClientOptions {
  baseUrl: string;
  accessToken: string;
}

export class MyJantesClient {
  private baseUrl: string;
  private accessToken: string;

  constructor({ baseUrl, accessToken }: MyJantesClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...(options.headers as Record<string, string> || {}),
      },
    });
    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      try {
        const data = await res.json();
        message = data.message || data.error || message;
      } catch {}
      throw new Error(message);
    }
    return res.json() as Promise<T>;
  }

  async downloadQuotePdf(quoteId: string): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/mobile/quotes/${quoteId}/pdf`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`PDF error: ${res.status}`);
    return res.blob();
  }

  async downloadInvoicePdf(invoiceId: string): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/mobile/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`PDF error: ${res.status}`);
    return res.blob();
  }

  async uploadFiles(formData: FormData): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/mobile/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    const data = await res.json();
    return data.urls || [];
  }

  async createReservation(data: {
    serviceId: string;
    scheduledDate: string;
    quoteId?: string;
    notes?: string;
    wheelCount?: number;
    diameter?: string;
  }): Promise<Reservation> {
    return this.request<Reservation>("/mobile/reservations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getQuotes(): Promise<any[]> {
    return this.request<any[]>("/mobile/quotes");
  }

  async getInvoices(): Promise<any[]> {
    return this.request<any[]>("/mobile/invoices");
  }

  async getReservations(): Promise<any[]> {
    return this.request<any[]>("/mobile/reservations");
  }

  async getProfile(): Promise<any> {
    return this.request<any>("/mobile/auth/user");
  }
}
