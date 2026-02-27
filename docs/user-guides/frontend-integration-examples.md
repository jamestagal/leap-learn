# Frontend Integration Examples

This guide provides practical examples for integrating the Consultation Domain API with various frontend frameworks and technologies.

## React/TypeScript Integration

### 1. API Client Setup

Create a typed API client for type safety:

```typescript
// src/api/types.ts
export interface Consultation {
  id: string;
  user_id: string;
  status: 'draft' | 'completed' | 'archived';
  contact_info?: ContactInfo;
  business_context?: BusinessContext;
  pain_points?: PainPoints;
  goals_objectives?: GoalsObjectives;
  additional_context?: AdditionalContext;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ContactInfo {
  business_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface BusinessContext {
  industry?: string;
  company_size?: string;
  team_size?: number;
  years_in_business?: number;
  revenue_range?: string;
  digital_presence?: string[];
  current_tools?: string[];
}

export interface PainPoints {
  primary_challenges?: string[];
  specific_problems?: string;
  impact_assessment?: string;
  urgency_level?: 'low' | 'medium' | 'high';
  budget_impact?: string;
}

export interface GoalsObjectives {
  primary_goals?: string[];
  success_metrics?: string;
  timeline?: string;
  budget_range?: string;
  preferred_approach?: string;
}

export interface AdditionalContext {
  technical_requirements?: string;
  constraints?: string;
  preferred_approach?: string;
  additional_notes?: string;
}

export interface CreateConsultationRequest {
  contact_info?: ContactInfo;
  business_context?: BusinessContext;
  pain_points?: PainPoints;
  goals_objectives?: GoalsObjectives;
  additional_context?: AdditionalContext;
}

export interface ListConsultationsResponse {
  consultations: Consultation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

```typescript
// src/api/client.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Consultation, CreateConsultationRequest, ListConsultationsResponse } from './types';

export class ConsultationAPIClient {
  private client: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle token expiration
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async createConsultation(data: CreateConsultationRequest): Promise<Consultation> {
    const response: AxiosResponse<Consultation> = await this.client.post('/consultations', data);
    return response.data;
  }

  async getConsultation(id: string): Promise<Consultation> {
    const response: AxiosResponse<Consultation> = await this.client.get(`/consultations/${id}`);
    return response.data;
  }

  async updateConsultation(id: string, data: Partial<CreateConsultationRequest>): Promise<Consultation> {
    const response: AxiosResponse<Consultation> = await this.client.put(`/consultations/${id}`, data);
    return response.data;
  }

  async completeConsultation(id: string, additionalContext?: AdditionalContext): Promise<{ message: string }> {
    const response = await this.client.post(`/consultations/${id}/complete`, { additional_context: additionalContext });
    return response.data;
  }

  async listConsultations(params?: {
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<ListConsultationsResponse> {
    const response: AxiosResponse<ListConsultationsResponse> = await this.client.get('/consultations', { params });
    return response.data;
  }

  async archiveConsultation(id: string): Promise<{ message: string }> {
    const response = await this.client.post(`/consultations/${id}/archive`);
    return response.data;
  }

  async getVersionHistory(id: string, page = 1, limit = 10) {
    const response = await this.client.get(`/consultations/${id}/versions`, {
      params: { page, limit }
    });
    return response.data;
  }

  async rollbackToVersion(id: string, versionId: string): Promise<Consultation> {
    const response = await this.client.post(`/consultations/${id}/rollback`, {
      version_id: versionId
    });
    return response.data;
  }
}
```

### 2. React Hooks for State Management

```typescript
// src/hooks/useConsultationAPI.ts
import { useState, useEffect, useCallback } from 'react';
import { ConsultationAPIClient } from '../api/client';
import { Consultation, CreateConsultationRequest } from '../api/types';

export const useConsultationAPI = (consultationId?: string) => {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  const client = new ConsultationAPIClient(process.env.REACT_APP_API_URL || 'http://localhost:4001');

  const loadConsultation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getConsultation(id);
      setConsultation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultation');
    } finally {
      setLoading(false);
    }
  }, [client]);

  const createConsultation = useCallback(async (data: CreateConsultationRequest) => {
    setLoading(true);
    setError(null);
    try {
      const newConsultation = await client.createConsultation(data);
      setConsultation(newConsultation);
      return newConsultation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create consultation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const updateConsultation = useCallback(async (data: Partial<CreateConsultationRequest>, silent = false) => {
    if (!consultation?.id) return;

    if (!silent) setAutoSaving(true);
    setError(null);

    try {
      const updated = await client.updateConsultation(consultation.id, data);
      setConsultation(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update consultation');
      throw err;
    } finally {
      if (!silent) setAutoSaving(false);
    }
  }, [consultation?.id, client]);

  const completeConsultation = useCallback(async (additionalContext?: any) => {
    if (!consultation?.id) return;

    setLoading(true);
    setError(null);
    try {
      await client.completeConsultation(consultation.id, additionalContext);
      // Reload consultation to get updated status
      await loadConsultation(consultation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete consultation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [consultation?.id, client, loadConsultation]);

  // Load consultation on mount if ID provided
  useEffect(() => {
    if (consultationId) {
      loadConsultation(consultationId);
    }
  }, [consultationId, loadConsultation]);

  return {
    consultation,
    loading,
    error,
    autoSaving,
    createConsultation,
    updateConsultation,
    completeConsultation,
    loadConsultation,
  };
};
```

### 3. Auto-save Hook

```typescript
// src/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react';
import { debounce } from 'lodash';

export const useAutoSave = <T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay = 30000, // 30 seconds
  dependencies: React.DependencyList = []
) => {
  const initialRender = useRef(true);
  const lastSavedData = useRef<T>(data);

  const debouncedSave = useRef(
    debounce(async (dataToSave: T) => {
      try {
        await saveFunction(dataToSave);
        lastSavedData.current = dataToSave;
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, delay)
  ).current;

  useEffect(() => {
    // Skip auto-save on initial render
    if (initialRender.current) {
      initialRender.current = false;
      lastSavedData.current = data;
      return;
    }

    // Only save if data has actually changed
    if (JSON.stringify(data) !== JSON.stringify(lastSavedData.current)) {
      debouncedSave(data);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [data, debouncedSave, ...dependencies]);

  // Save immediately on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);
};
```

### 4. Complete React Component Example

```typescript
// src/components/ConsultationForm.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConsultationAPI } from '../hooks/useConsultationAPI';
import { useAutoSave } from '../hooks/useAutoSave';
import { CreateConsultationRequest } from '../api/types';

export const ConsultationForm: React.FC = () => {
  const { consultationId } = useParams<{ consultationId?: string }>();
  const navigate = useNavigate();

  const {
    consultation,
    loading,
    error,
    autoSaving,
    createConsultation,
    updateConsultation,
    completeConsultation,
  } = useConsultationAPI(consultationId);

  const [formData, setFormData] = useState<CreateConsultationRequest>({});
  const [currentStep, setCurrentStep] = useState(0);

  // Initialize form data when consultation loads
  useEffect(() => {
    if (consultation) {
      setFormData({
        contact_info: consultation.contact_info,
        business_context: consultation.business_context,
        pain_points: consultation.pain_points,
        goals_objectives: consultation.goals_objectives,
        additional_context: consultation.additional_context,
      });
    }
  }, [consultation]);

  // Auto-save functionality
  useAutoSave(
    formData,
    async (data) => {
      if (consultation?.id) {
        await updateConsultation(data, true); // silent update
      }
    },
    30000, // 30 seconds
    [consultation?.id]
  );

  const handleFieldChange = (section: keyof CreateConsultationRequest, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!consultation?.id) {
        // Create new consultation
        const newConsultation = await createConsultation(formData);
        navigate(`/consultations/${newConsultation.id}`);
      } else {
        // Complete existing consultation
        await completeConsultation(formData.additional_context);
        navigate('/consultations');
      }
    } catch (error) {
      console.error('Failed to submit consultation:', error);
    }
  };

  const steps = [
    { title: 'Contact Information', key: 'contact_info' },
    { title: 'Business Context', key: 'business_context' },
    { title: 'Pain Points', key: 'pain_points' },
    { title: 'Goals & Objectives', key: 'goals_objectives' },
    { title: 'Additional Context', key: 'additional_context' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Business Consultation</h1>
          <div className="flex items-center space-x-2">
            {autoSaving && (
              <span className="text-sm text-gray-500 flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                Auto-saving...
              </span>
            )}
            {consultation && (
              <span className="text-sm text-green-600">
                {Math.round(consultation.completion_percentage)}% Complete
              </span>
            )}
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${consultation?.completion_percentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Step navigation */}
      <div className="flex justify-between mb-8">
        {steps.map((step, index) => (
          <button
            key={step.key}
            onClick={() => setCurrentStep(index)}
            className={`px-4 py-2 text-sm rounded ${
              currentStep === index
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {step.title}
          </button>
        ))}
      </div>

      {/* Form sections */}
      <div className="bg-white shadow rounded-lg p-6">
        {currentStep === 0 && (
          <ContactInfoSection
            data={formData.contact_info || {}}
            onChange={(field, value) => handleFieldChange('contact_info', field, value)}
          />
        )}
        {currentStep === 1 && (
          <BusinessContextSection
            data={formData.business_context || {}}
            onChange={(field, value) => handleFieldChange('business_context', field, value)}
          />
        )}
        {currentStep === 2 && (
          <PainPointsSection
            data={formData.pain_points || {}}
            onChange={(field, value) => handleFieldChange('pain_points', field, value)}
          />
        )}
        {currentStep === 3 && (
          <GoalsObjectivesSection
            data={formData.goals_objectives || {}}
            onChange={(field, value) => handleFieldChange('goals_objectives', field, value)}
          />
        )}
        {currentStep === 4 && (
          <AdditionalContextSection
            data={formData.additional_context || {}}
            onChange={(field, value) => handleFieldChange('additional_context', field, value)}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-6 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
        >
          Previous
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {consultation?.id ? 'Complete Consultation' : 'Create Consultation'}
          </button>
        )}
      </div>
    </div>
  );
};
```

## Vue.js Integration

### 1. Vue Composition API Example

```typescript
// src/composables/useConsultation.ts
import { ref, reactive, computed } from 'vue';
import { ConsultationAPIClient } from '../api/client';
import type { Consultation, CreateConsultationRequest } from '../api/types';

export function useConsultation(consultationId?: string) {
  const client = new ConsultationAPIClient(import.meta.env.VITE_API_URL || 'http://localhost:4001');

  const consultation = ref<Consultation | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const autoSaving = ref(false);

  const formData = reactive<CreateConsultationRequest>({});

  const completionPercentage = computed(() => {
    return consultation.value?.completion_percentage || 0;
  });

  const isCompleted = computed(() => {
    return consultation.value?.status === 'completed';
  });

  const loadConsultation = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      consultation.value = await client.getConsultation(id);

      // Update form data
      Object.assign(formData, {
        contact_info: consultation.value.contact_info,
        business_context: consultation.value.business_context,
        pain_points: consultation.value.pain_points,
        goals_objectives: consultation.value.goals_objectives,
        additional_context: consultation.value.additional_context,
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load consultation';
    } finally {
      loading.value = false;
    }
  };

  const updateConsultation = async (silent = false) => {
    if (!consultation.value?.id) return;

    if (!silent) autoSaving.value = true;
    error.value = null;

    try {
      consultation.value = await client.updateConsultation(consultation.value.id, formData);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update consultation';
    } finally {
      if (!silent) autoSaving.value = false;
    }
  };

  const completeConsultation = async () => {
    if (!consultation.value?.id) return;

    loading.value = true;
    error.value = null;

    try {
      await client.completeConsultation(consultation.value.id, formData.additional_context);
      await loadConsultation(consultation.value.id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to complete consultation';
    } finally {
      loading.value = false;
    }
  };

  // Auto-load consultation if ID provided
  if (consultationId) {
    loadConsultation(consultationId);
  }

  return {
    consultation: readonly(consultation),
    formData,
    loading: readonly(loading),
    error: readonly(error),
    autoSaving: readonly(autoSaving),
    completionPercentage,
    isCompleted,
    loadConsultation,
    updateConsultation,
    completeConsultation,
  };
}
```

### 2. Vue Component Example

```vue
<!-- src/components/ConsultationForm.vue -->
<template>
  <div class="consultation-form">
    <!-- Loading state -->
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading consultation...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-message">
      <h3>Error</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Form -->
    <div v-else class="form-container">
      <!-- Progress bar -->
      <div class="progress-section">
        <h1>Business Consultation</h1>
        <div class="progress-info">
          <span v-if="autoSaving" class="auto-save-indicator">
            <div class="spinner-small"></div>
            Auto-saving...
          </span>
          <span class="completion-percentage">
            {{ Math.round(completionPercentage) }}% Complete
          </span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${completionPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Step navigation -->
      <div class="step-navigation">
        <button
          v-for="(step, index) in steps"
          :key="step.key"
          @click="currentStep = index"
          :class="{ active: currentStep === index }"
          class="step-button"
        >
          {{ step.title }}
        </button>
      </div>

      <!-- Form sections -->
      <div class="form-content">
        <ContactInfoSection
          v-if="currentStep === 0"
          v-model="formData.contact_info"
        />
        <BusinessContextSection
          v-else-if="currentStep === 1"
          v-model="formData.business_context"
        />
        <PainPointsSection
          v-else-if="currentStep === 2"
          v-model="formData.pain_points"
        />
        <GoalsObjectivesSection
          v-else-if="currentStep === 3"
          v-model="formData.goals_objectives"
        />
        <AdditionalContextSection
          v-else-if="currentStep === 4"
          v-model="formData.additional_context"
        />
      </div>

      <!-- Navigation buttons -->
      <div class="form-navigation">
        <button
          @click="currentStep--"
          :disabled="currentStep === 0"
          class="btn btn-secondary"
        >
          Previous
        </button>

        <button
          v-if="currentStep < steps.length - 1"
          @click="currentStep++"
          class="btn btn-primary"
        >
          Next
        </button>

        <button
          v-else
          @click="handleSubmit"
          :disabled="loading"
          class="btn btn-success"
        >
          {{ consultation?.id ? 'Complete Consultation' : 'Create Consultation' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConsultation } from '../composables/useConsultation';
import ContactInfoSection from './sections/ContactInfoSection.vue';
import BusinessContextSection from './sections/BusinessContextSection.vue';
import PainPointsSection from './sections/PainPointsSection.vue';
import GoalsObjectivesSection from './sections/GoalsObjectivesSection.vue';
import AdditionalContextSection from './sections/AdditionalContextSection.vue';

const route = useRoute();
const router = useRouter();

const consultationId = route.params.id as string;

const {
  consultation,
  formData,
  loading,
  error,
  autoSaving,
  completionPercentage,
  updateConsultation,
  completeConsultation,
} = useConsultation(consultationId);

const currentStep = ref(0);

const steps = [
  { title: 'Contact Information', key: 'contact_info' },
  { title: 'Business Context', key: 'business_context' },
  { title: 'Pain Points', key: 'pain_points' },
  { title: 'Goals & Objectives', key: 'goals_objectives' },
  { title: 'Additional Context', key: 'additional_context' },
];

// Auto-save functionality
let autoSaveTimeout: NodeJS.Timeout;

watch(
  formData,
  () => {
    if (consultation.value?.id) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        updateConsultation(true); // silent update
      }, 30000); // 30 seconds
    }
  },
  { deep: true }
);

const handleSubmit = async () => {
  try {
    if (consultation.value?.id) {
      await completeConsultation();
      router.push('/consultations');
    } else {
      // Handle new consultation creation
      // Implementation depends on your routing structure
    }
  } catch (error) {
    console.error('Failed to submit consultation:', error);
  }
};
</script>

<style scoped>
.consultation-form {
  max-width: 1024px;
  margin: 0 auto;
  padding: 1.5rem;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 16rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.progress-section {
  margin-bottom: 2rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.auto-save-indicator {
  display: flex;
  align-items: center;
  color: #6b7280;
  font-size: 0.875rem;
}

.spinner-small {
  width: 1rem;
  height: 1rem;
  border: 2px solid #f3f4f6;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  background-color: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.3s ease;
}

.step-navigation {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.step-button {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  border-radius: 0.25rem;
  border: none;
  background-color: #e5e7eb;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.step-button.active {
  background-color: #3b82f6;
  color: white;
}

.step-button:hover:not(.active) {
  background-color: #d1d5db;
}

.form-content {
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.form-navigation {
  display: flex;
  justify-content: space-between;
}

.btn {
  padding: 0.5rem 1.5rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #d1d5db;
  color: #374151;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-success {
  background-color: #10b981;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
```

## Angular Integration

### 1. Angular Service

```typescript
// src/app/services/consultation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Consultation, CreateConsultationRequest, ListConsultationsResponse } from '../models/consultation.model';

@Injectable({
  providedIn: 'root'
})
export class ConsultationService {
  private readonly apiUrl = `${environment.apiUrl}/consultations`;
  private consultationSubject = new BehaviorSubject<Consultation | null>(null);

  consultation$ = this.consultationSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    });
  }

  createConsultation(data: CreateConsultationRequest): Observable<Consultation> {
    return this.http.post<Consultation>(this.apiUrl, data, { headers: this.getHeaders() })
      .pipe(
        map(consultation => {
          this.consultationSubject.next(consultation);
          return consultation;
        })
      );
  }

  getConsultation(id: string): Observable<Consultation> {
    return this.http.get<Consultation>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(
        map(consultation => {
          this.consultationSubject.next(consultation);
          return consultation;
        })
      );
  }

  updateConsultation(id: string, data: Partial<CreateConsultationRequest>): Observable<Consultation> {
    return this.http.put<Consultation>(`${this.apiUrl}/${id}`, data, { headers: this.getHeaders() })
      .pipe(
        map(consultation => {
          this.consultationSubject.next(consultation);
          return consultation;
        })
      );
  }

  completeConsultation(id: string, additionalContext?: any): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/complete`,
      { additional_context: additionalContext },
      { headers: this.getHeaders() }
    );
  }

  listConsultations(params?: {
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Observable<ListConsultationsResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ListConsultationsResponse>(this.apiUrl, {
      headers: this.getHeaders(),
      params: httpParams
    });
  }

  getVersionHistory(id: string, page = 1, limit = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get(`${this.apiUrl}/${id}/versions`, {
      headers: this.getHeaders(),
      params
    });
  }

  rollbackToVersion(id: string, versionId: string): Observable<Consultation> {
    return this.http.post<Consultation>(`${this.apiUrl}/${id}/rollback`,
      { version_id: versionId },
      { headers: this.getHeaders() }
    ).pipe(
      map(consultation => {
        this.consultationSubject.next(consultation);
        return consultation;
      })
    );
  }
}
```

### 2. Angular Component

```typescript
// src/app/components/consultation-form/consultation-form.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, takeUntil, distinctUntilChanged } from 'rxjs';
import { ConsultationService } from '../../services/consultation.service';
import { Consultation, CreateConsultationRequest } from '../../models/consultation.model';

@Component({
  selector: 'app-consultation-form',
  templateUrl: './consultation-form.component.html',
  styleUrls: ['./consultation-form.component.scss']
})
export class ConsultationFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  consultation: Consultation | null = null;
  loading = false;
  error: string | null = null;
  autoSaving = false;
  currentStep = 0;

  private destroy$ = new Subject<void>();
  private consultationId: string | null = null;

  steps = [
    { title: 'Contact Information', key: 'contact_info' },
    { title: 'Business Context', key: 'business_context' },
    { title: 'Pain Points', key: 'pain_points' },
    { title: 'Goals & Objectives', key: 'goals_objectives' },
    { title: 'Additional Context', key: 'additional_context' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private consultationService: ConsultationService
  ) {
    this.form = this.createForm();
  }

  ngOnInit(): void {
    this.consultationId = this.route.snapshot.paramMap.get('id');

    if (this.consultationId) {
      this.loadConsultation(this.consultationId);
    }

    // Setup auto-save
    this.form.valueChanges
      .pipe(
        debounceTime(30000), // 30 seconds
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        if (this.consultationId && this.form.dirty) {
          this.autoSave(value);
        }
      });

    // Subscribe to consultation updates
    this.consultationService.consultation$
      .pipe(takeUntil(this.destroy$))
      .subscribe(consultation => {
        this.consultation = consultation;
        if (consultation) {
          this.updateFormFromConsultation(consultation);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      contact_info: this.fb.group({
        business_name: ['', Validators.required],
        contact_person: [''],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        website: ['']
      }),
      business_context: this.fb.group({
        industry: ['', Validators.required],
        company_size: [''],
        team_size: [null],
        years_in_business: [null],
        revenue_range: [''],
        digital_presence: [[]],
        current_tools: [[]]
      }),
      pain_points: this.fb.group({
        primary_challenges: [[]],
        specific_problems: [''],
        impact_assessment: [''],
        urgency_level: ['medium'],
        budget_impact: ['']
      }),
      goals_objectives: this.fb.group({
        primary_goals: [[]],
        success_metrics: [''],
        timeline: [''],
        budget_range: [''],
        preferred_approach: ['']
      }),
      additional_context: this.fb.group({
        technical_requirements: [''],
        constraints: [''],
        preferred_approach: [''],
        additional_notes: ['']
      })
    });
  }

  private loadConsultation(id: string): void {
    this.loading = true;
    this.consultationService.getConsultation(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (consultation) => {
          this.consultation = consultation;
          this.updateFormFromConsultation(consultation);
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load consultation';
          this.loading = false;
        }
      });
  }

  private updateFormFromConsultation(consultation: Consultation): void {
    this.form.patchValue({
      contact_info: consultation.contact_info || {},
      business_context: consultation.business_context || {},
      pain_points: consultation.pain_points || {},
      goals_objectives: consultation.goals_objectives || {},
      additional_context: consultation.additional_context || {}
    });
  }

  private autoSave(value: CreateConsultationRequest): void {
    if (!this.consultationId) return;

    this.autoSaving = true;
    this.consultationService.updateConsultation(this.consultationId, value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.autoSaving = false;
          this.form.markAsPristine();
        },
        error: () => {
          this.autoSaving = false;
        }
      });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      if (this.consultationId) {
        // Complete existing consultation
        this.consultationService.completeConsultation(
          this.consultationId,
          formValue.additional_context
        ).subscribe({
          next: () => {
            this.router.navigate(['/consultations']);
          },
          error: (error) => {
            this.error = 'Failed to complete consultation';
          }
        });
      } else {
        // Create new consultation
        this.consultationService.createConsultation(formValue)
          .subscribe({
            next: (consultation) => {
              this.router.navigate(['/consultations', consultation.id]);
            },
            error: (error) => {
              this.error = 'Failed to create consultation';
            }
          });
      }
    }
  }

  nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  get completionPercentage(): number {
    return this.consultation?.completion_percentage || 0;
  }

  get isCompleted(): boolean {
    return this.consultation?.status === 'completed';
  }
}
```

This comprehensive guide provides practical examples for integrating the Consultation Domain API with popular frontend frameworks. Each example includes type safety, error handling, auto-save functionality, and best practices for production applications.