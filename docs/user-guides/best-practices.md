# Consultation Domain Best Practices

This guide outlines recommended patterns, practices, and conventions for effectively using the Consultation Domain API in production applications.

## Table of Contents

1. [API Integration Best Practices](#api-integration-best-practices)
2. [Frontend Development Guidelines](#frontend-development-guidelines)
3. [Data Management Best Practices](#data-management-best-practices)
4. [Performance Optimization](#performance-optimization)
5. [Security Considerations](#security-considerations)
6. [Error Handling Strategies](#error-handling-strategies)
7. [Testing Guidelines](#testing-guidelines)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Deployment Practices](#deployment-practices)
10. [Maintenance and Operations](#maintenance-and-operations)

## API Integration Best Practices

### 1. HTTP Client Configuration

**✅ Recommended Implementation:**

```typescript
// Configure HTTP client with proper defaults
const createAPIClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'YourApp/1.0.0',
    },
  });

  // Request interceptor for authentication
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await refreshAuthToken();
        return client.request(error.config);
      }
      return Promise.reject(error);
    }
  );

  return client;
};
```

**❌ Avoid:**
```typescript
// Don't create new HTTP clients for each request
const makeRequest = () => {
  return axios.post(url, data); // Creates new client each time
};

// Don't ignore timeout configurations
const client = axios.create(); // No timeout, can hang indefinitely
```

### 2. Request/Response Patterns

**✅ Recommended Implementation:**

```typescript
interface APIResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Consistent error handling
const handleAPICall = async <T>(
  apiCall: () => Promise<AxiosResponse<T>>
): Promise<T> => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      throw new APIError(
        error.response.data.message || 'API request failed',
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      // Request made but no response received
      throw new NetworkError('Network request failed');
    } else {
      // Something else happened
      throw new UnknownError('Request setup failed');
    }
  }
};
```

### 3. Retry Logic with Exponential Backoff

**✅ Recommended Implementation:**

```typescript
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        if (error.response.status !== 429) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Usage
const getConsultation = (id: string) =>
  retryWithBackoff(() => api.consultations.get(id));
```

## Frontend Development Guidelines

### 1. State Management Patterns

**✅ Recommended - Centralized State:**

```typescript
// Redux Toolkit example
interface ConsultationState {
  consultations: Record<string, Consultation>;
  currentConsultation: string | null;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  drafts: Record<string, ConsultationDraft>;
}

const consultationSlice = createSlice({
  name: 'consultation',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading[action.payload.id] = action.payload.loading;
    },
    setConsultation: (state, action) => {
      state.consultations[action.payload.id] = action.payload.consultation;
    },
    updateConsultationField: (state, action) => {
      const { id, field, value } = action.payload;
      if (state.consultations[id]) {
        state.consultations[id] = {
          ...state.consultations[id],
          [field]: value,
          updated_at: new Date().toISOString(),
        };
      }
    },
  },
});
```

**✅ Recommended - Component State for Local Data:**

```typescript
// React hook for local consultation editing
const useConsultationForm = (consultationId?: string) => {
  const [formData, setFormData] = useState<ConsultationFormData>({});
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validation logic
  const validateField = useCallback((field: string, value: any) => {
    const errors = { ...validationErrors };

    switch (field) {
      case 'contact_info.email':
        if (value && !isValidEmail(value)) {
          errors[field] = 'Invalid email format';
        } else {
          delete errors[field];
        }
        break;
      // ... other validation rules
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [validationErrors]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => setNestedValue(prev, field, value));
    setIsDirty(true);
    validateField(field, value);
  }, [validateField]);

  return {
    formData,
    isDirty,
    validationErrors,
    updateField,
    isValid: Object.keys(validationErrors).length === 0,
  };
};
```

### 2. Auto-save Implementation

**✅ Recommended Implementation:**

```typescript
const useAutoSave = <T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  options: {
    delay?: number;
    enabled?: boolean;
    dependencies?: React.DependencyList;
  } = {}
) => {
  const { delay = 30000, enabled = true, dependencies = [] } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isInitialRender = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const save = useCallback(async (dataToSave: T) => {
    if (!enabled) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveFunction(dataToSave);
      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-save failed');
      console.error('Auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [saveFunction, enabled]);

  const debouncedSave = useMemo(
    () => debounce(save, delay),
    [save, delay]
  );

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (enabled) {
      debouncedSave(data);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [data, debouncedSave, enabled, ...dependencies]);

  // Save immediately on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  return {
    isSaving,
    lastSaved,
    error,
    forceSave: () => save(data),
  };
};
```

### 3. Optimistic Updates

**✅ Recommended Pattern:**

```typescript
const useOptimisticUpdate = () => {
  const dispatch = useAppDispatch();

  const optimisticUpdate = async <T>(
    optimisticData: T,
    apiCall: () => Promise<T>,
    revertData: T,
    updateAction: (data: T) => Action
  ) => {
    // Apply optimistic update immediately
    dispatch(updateAction(optimisticData));

    try {
      // Make API call
      const result = await apiCall();
      // Update with actual result
      dispatch(updateAction(result));
      return result;
    } catch (error) {
      // Revert on error
      dispatch(updateAction(revertData));
      throw error;
    }
  };

  return optimisticUpdate;
};

// Usage
const updateConsultationOptimistic = async (id: string, updates: Partial<Consultation>) => {
  const currentConsultation = selectConsultationById(id);
  const optimisticConsultation = { ...currentConsultation, ...updates };

  return optimisticUpdate(
    optimisticConsultation,
    () => api.consultations.update(id, updates),
    currentConsultation,
    (data) => consultationSlice.actions.setConsultation({ id, consultation: data })
  );
};
```

## Data Management Best Practices

### 1. Input Validation

**✅ Comprehensive Validation Schema:**

```typescript
import { z } from 'zod';

// Define validation schemas
const ContactInfoSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(100),
  contact_person: z.string().max(100).optional(),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^[\+]?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
  website: z.string().url('Invalid website URL').optional(),
});

const BusinessContextSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  company_size: z.enum(['1-10', '11-50', '51-100', '101-500', '500+']).optional(),
  team_size: z.number().int().positive('Team size must be positive').optional(),
  years_in_business: z.number().int().min(0).max(200).optional(),
  revenue_range: z.string().optional(),
  digital_presence: z.array(z.string()).optional(),
  current_tools: z.array(z.string()).optional(),
});

const ConsultationSchema = z.object({
  contact_info: ContactInfoSchema.optional(),
  business_context: BusinessContextSchema.optional(),
  pain_points: PainPointsSchema.optional(),
  goals_objectives: GoalsObjectivesSchema.optional(),
  additional_context: AdditionalContextSchema.optional(),
});

// Validation helper
const validateConsultationData = (data: unknown): ConsultationFormData => {
  try {
    return ConsultationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        validationErrors[err.path.join('.')] = err.message;
      });
      throw new ValidationError('Validation failed', validationErrors);
    }
    throw error;
  }
};
```

### 2. Data Normalization

**✅ Normalize API Responses:**

```typescript
// Normalize consultation data for consistent handling
const normalizeConsultation = (consultation: Consultation): NormalizedConsultation => {
  return {
    ...consultation,
    // Ensure arrays are always arrays
    pain_points: {
      ...consultation.pain_points,
      primary_challenges: Array.isArray(consultation.pain_points?.primary_challenges)
        ? consultation.pain_points.primary_challenges
        : consultation.pain_points?.primary_challenges
        ? [consultation.pain_points.primary_challenges]
        : [],
    },
    goals_objectives: {
      ...consultation.goals_objectives,
      primary_goals: Array.isArray(consultation.goals_objectives?.primary_goals)
        ? consultation.goals_objectives.primary_goals
        : consultation.goals_objectives?.primary_goals
        ? [consultation.goals_objectives.primary_goals]
        : [],
    },
    // Ensure dates are Date objects
    created_at: new Date(consultation.created_at),
    updated_at: new Date(consultation.updated_at),
    completed_at: consultation.completed_at ? new Date(consultation.completed_at) : null,
  };
};
```

### 3. Caching Strategy

**✅ Multi-level Caching:**

```typescript
class ConsultationCache {
  private memoryCache = new Map<string, { data: Consultation; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async get(id: string): Promise<Consultation | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Check localStorage cache
    const localCached = this.getFromLocalStorage(id);
    if (localCached) {
      this.memoryCache.set(id, { data: localCached, timestamp: Date.now() });
      return localCached;
    }

    return null;
  }

  set(id: string, consultation: Consultation): void {
    // Store in memory cache
    this.memoryCache.set(id, { data: consultation, timestamp: Date.now() });

    // Store in localStorage for persistence
    this.setInLocalStorage(id, consultation);
  }

  private getFromLocalStorage(id: string): Consultation | null {
    try {
      const cached = localStorage.getItem(`consultation_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < this.CACHE_TTL) {
          return parsed.data;
        }
        localStorage.removeItem(`consultation_${id}`);
      }
    } catch (error) {
      console.warn('Failed to read from localStorage cache:', error);
    }
    return null;
  }

  private setInLocalStorage(id: string, consultation: Consultation): void {
    try {
      localStorage.setItem(`consultation_${id}`, JSON.stringify({
        data: consultation,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('Failed to write to localStorage cache:', error);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    // Clear localStorage cache
    Object.keys(localStorage)
      .filter(key => key.startsWith('consultation_'))
      .forEach(key => localStorage.removeItem(key));
  }
}
```

## Performance Optimization

### 1. Efficient List Rendering

**✅ Virtualized Lists for Large Datasets:**

```typescript
import { FixedSizeList as List } from 'react-window';

interface ConsultationListProps {
  consultations: Consultation[];
  onConsultationClick: (id: string) => void;
}

const ConsultationList: React.FC<ConsultationListProps> = ({
  consultations,
  onConsultationClick,
}) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const consultation = consultations[index];

    return (
      <div style={style} className="consultation-row">
        <ConsultationSummary
          consultation={consultation}
          onClick={() => onConsultationClick(consultation.id)}
        />
      </div>
    );
  };

  return (
    <List
      height={600}
      itemCount={consultations.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 2. Lazy Loading and Code Splitting

**✅ Component Lazy Loading:**

```typescript
// Lazy load consultation form components
const ContactInfoSection = lazy(() => import('./sections/ContactInfoSection'));
const BusinessContextSection = lazy(() => import('./sections/BusinessContextSection'));
const PainPointsSection = lazy(() => import('./sections/PainPointsSection'));

const ConsultationForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Suspense fallback={<SectionLoading />}>
            <ContactInfoSection />
          </Suspense>
        );
      case 1:
        return (
          <Suspense fallback={<SectionLoading />}>
            <BusinessContextSection />
          </Suspense>
        );
      // ... other steps
    }
  };

  return <div>{renderStep()}</div>;
};
```

### 3. Request Optimization

**✅ Batch Requests:**

```typescript
class BatchedAPIClient {
  private batchQueue: Array<{
    id: string;
    resolve: (data: Consultation) => void;
    reject: (error: Error) => void;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  async getConsultation(id: string): Promise<Consultation> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ id, resolve, reject });

      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, 50); // 50ms batch window
      }
    });
  }

  private async processBatch(): Promise<void> {
    const batch = [...this.batchQueue];
    this.batchQueue.length = 0;
    this.batchTimeout = null;

    if (batch.length === 0) return;

    try {
      const ids = batch.map(item => item.id);
      const consultations = await this.batchGetConsultations(ids);

      batch.forEach(({ id, resolve, reject }) => {
        const consultation = consultations.find(c => c.id === id);
        if (consultation) {
          resolve(consultation);
        } else {
          reject(new Error(`Consultation ${id} not found`));
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => {
        reject(error as Error);
      });
    }
  }

  private async batchGetConsultations(ids: string[]): Promise<Consultation[]> {
    const response = await this.httpClient.post('/consultations/batch', { ids });
    return response.data.consultations;
  }
}
```

## Security Considerations

### 1. Input Sanitization

**✅ Sanitize User Input:**

```typescript
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string, allowedTags: string[] = []): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [],
  });
};

// Use in form handlers
const handleTextInput = (field: string, value: string) => {
  const sanitizedValue = sanitizeInput(value);
  updateField(field, sanitizedValue);
};

// For rich text fields, allow specific tags
const handleRichTextInput = (field: string, value: string) => {
  const sanitizedValue = sanitizeInput(value, ['b', 'i', 'u', 'br', 'p']);
  updateField(field, sanitizedValue);
};
```

### 2. Secure Token Handling

**✅ Secure Token Storage:**

```typescript
class SecureTokenStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';

  static setTokens(accessToken: string, refreshToken: string): void {
    // Store access token in memory for security
    this.setAccessToken(accessToken);

    // Store refresh token in httpOnly cookie if possible
    // or secure localStorage with encryption
    this.setRefreshToken(refreshToken);
  }

  static getAccessToken(): string | null {
    // Get from memory or sessionStorage (not localStorage)
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  static setAccessToken(token: string): void {
    sessionStorage.setItem(this.TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    // Implement secure retrieval based on your storage method
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    // In production, use httpOnly cookies or encrypted storage
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static clearTokens(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }
}
```

### 3. Content Security Policy

**✅ Implement CSP Headers:**

```typescript
// Next.js example
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://api.yourapp.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

## Error Handling Strategies

### 1. Centralized Error Handling

**✅ Error Boundary Implementation:**

```typescript
interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send to error tracking service
    if (typeof window !== 'undefined') {
      // Example: Sentry, LogRocket, etc.
      window.errorTracker?.captureException(error, {
        extra: errorInfo,
        tags: { component: 'ConsultationDomain' },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

### 2. Graceful Degradation

**✅ Progressive Enhancement:**

```typescript
const ConsultationForm: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineChanges, setOfflineChanges] = useState<Partial<Consultation>>({});

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync offline changes when back online
  useEffect(() => {
    if (isOnline && Object.keys(offlineChanges).length > 0) {
      syncOfflineChanges(offlineChanges);
      setOfflineChanges({});
    }
  }, [isOnline, offlineChanges]);

  const handleFormChange = async (changes: Partial<Consultation>) => {
    if (isOnline) {
      try {
        await updateConsultation(changes);
      } catch (error) {
        // Store changes for offline sync
        setOfflineChanges(prev => ({ ...prev, ...changes }));
      }
    } else {
      // Store changes for offline sync
      setOfflineChanges(prev => ({ ...prev, ...changes }));
    }
  };

  return (
    <div>
      {!isOnline && (
        <OfflineBanner message="You're offline. Changes will be saved when connection is restored." />
      )}
      {/* Form components */}
    </div>
  );
};
```

## Testing Guidelines

### 1. Component Testing

**✅ Comprehensive Test Coverage:**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsultationForm } from './ConsultationForm';
import { mockConsultationAPI } from '../__mocks__/api';

describe('ConsultationForm', () => {
  beforeEach(() => {
    mockConsultationAPI.reset();
  });

  it('should auto-save form data after changes', async () => {
    const user = userEvent.setup();
    const mockUpdate = jest.fn().mockResolvedValue({});
    mockConsultationAPI.consultations.update = mockUpdate;

    render(<ConsultationForm consultationId="test-id" />);

    // Make a change
    const businessNameInput = screen.getByLabelText(/business name/i);
    await user.type(businessNameInput, 'Test Company');

    // Wait for auto-save (debounced)
    await waitFor(
      () => {
        expect(mockUpdate).toHaveBeenCalledWith('test-id', {
          contact_info: { business_name: 'Test Company' },
        });
      },
      { timeout: 31000 } // Auto-save timeout + buffer
    );
  });

  it('should handle validation errors gracefully', async () => {
    const user = userEvent.setup();
    render(<ConsultationForm />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Trigger blur

    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('should show offline indicator when network is unavailable', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<ConsultationForm />);

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});
```

### 2. Integration Testing

**✅ API Integration Tests:**

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { ConsultationAPIClient } from './ConsultationAPIClient';

const server = setupServer(
  rest.post('/consultations', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'new-consultation-id',
        status: 'draft',
        completion_percentage: 25,
        ...req.body,
      })
    );
  }),

  rest.put('/consultations/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.id,
        status: 'draft',
        completion_percentage: 50,
        ...req.body,
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ConsultationAPIClient', () => {
  const client = new ConsultationAPIClient('http://localhost:4001');

  it('should create consultation successfully', async () => {
    const consultationData = {
      contact_info: {
        business_name: 'Test Company',
        email: 'test@example.com',
      },
    };

    const result = await client.createConsultation(consultationData);

    expect(result.id).toBe('new-consultation-id');
    expect(result.status).toBe('draft');
    expect(result.contact_info.business_name).toBe('Test Company');
  });

  it('should handle API errors properly', async () => {
    server.use(
      rest.post('/consultations', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'validation_failed',
            details: { 'contact_info.email': 'Invalid email format' },
          })
        );
      })
    );

    await expect(
      client.createConsultation({ contact_info: { email: 'invalid' } })
    ).rejects.toThrow('validation_failed');
  });
});
```

## Monitoring and Observability

### 1. Frontend Monitoring

**✅ User Experience Monitoring:**

```typescript
// Performance monitoring
const trackPageLoad = () => {
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      analytics.track('Page Load Performance', {
        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      });
    });
  }
};

// Error tracking
const trackError = (error: Error, context?: Record<string, any>) => {
  analytics.track('JavaScript Error', {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// User interaction tracking
const trackConsultationInteraction = (action: string, consultationId: string, metadata?: any) => {
  analytics.track('Consultation Interaction', {
    action,
    consultationId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};
```

### 2. API Monitoring

**✅ Request/Response Monitoring:**

```typescript
const createMonitoredAPIClient = (baseURL: string) => {
  const client = axios.create({ baseURL });

  client.interceptors.request.use((config) => {
    const startTime = Date.now();
    config.metadata = { startTime };

    // Track request start
    analytics.track('API Request Started', {
      method: config.method?.toUpperCase(),
      url: config.url,
      timestamp: new Date().toISOString(),
    });

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const endTime = Date.now();
      const duration = endTime - (response.config.metadata?.startTime || endTime);

      // Track successful response
      analytics.track('API Request Completed', {
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
        duration,
        timestamp: new Date().toISOString(),
      });

      return response;
    },
    (error) => {
      const endTime = Date.now();
      const duration = endTime - (error.config?.metadata?.startTime || endTime);

      // Track error response
      analytics.track('API Request Failed', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        error: error.message,
        duration,
        timestamp: new Date().toISOString(),
      });

      return Promise.reject(error);
    }
  );

  return client;
};
```

## Deployment Practices

### 1. Environment Configuration

**✅ Configuration Management:**

```typescript
// Environment-specific configuration
interface AppConfig {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    autoSave: boolean;
    analytics: boolean;
    errorTracking: boolean;
  };
  thresholds: {
    autoSaveDelay: number;
    requestTimeout: number;
    retryAttempts: number;
  };
}

const getConfig = (): AppConfig => {
  const env = process.env.NODE_ENV || 'development';

  const baseConfig: AppConfig = {
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:4001',
    environment: env as any,
    features: {
      autoSave: true,
      analytics: env === 'production',
      errorTracking: env !== 'development',
    },
    thresholds: {
      autoSaveDelay: 30000, // 30 seconds
      requestTimeout: 30000, // 30 seconds
      retryAttempts: 3,
    },
  };

  // Environment-specific overrides
  if (env === 'production') {
    baseConfig.thresholds.autoSaveDelay = 15000; // 15 seconds in production
  }

  return baseConfig;
};

export const config = getConfig();
```

### 2. Feature Flags

**✅ Progressive Feature Rollout:**

```typescript
interface FeatureFlags {
  enableNewConsultationFlow: boolean;
  enableAdvancedValidation: boolean;
  enableBatchOperations: boolean;
  enableOfflineMode: boolean;
}

class FeatureFlagService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = this.loadFlags();
  }

  private loadFlags(): FeatureFlags {
    // Load from API, localStorage, or environment variables
    return {
      enableNewConsultationFlow: this.getFlag('enableNewConsultationFlow', false),
      enableAdvancedValidation: this.getFlag('enableAdvancedValidation', true),
      enableBatchOperations: this.getFlag('enableBatchOperations', false),
      enableOfflineMode: this.getFlag('enableOfflineMode', false),
    };
  }

  private getFlag(name: string, defaultValue: boolean): boolean {
    // Check environment variable first
    const envValue = process.env[`REACT_APP_FEATURE_${name.toUpperCase()}`];
    if (envValue !== undefined) {
      return envValue === 'true';
    }

    // Check localStorage for development
    if (process.env.NODE_ENV === 'development') {
      const localValue = localStorage.getItem(`feature_${name}`);
      if (localValue !== null) {
        return localValue === 'true';
      }
    }

    return defaultValue;
  }

  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  // Development helper
  setFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem(`feature_${feature}`, enabled.toString());
      this.flags[feature] = enabled;
    }
  }
}

export const featureFlags = new FeatureFlagService();
```

## Maintenance and Operations

### 1. Health Monitoring

**✅ Application Health Checks:**

```typescript
class HealthMonitor {
  private healthStatus: {
    api: boolean;
    cache: boolean;
    localStorage: boolean;
    performance: boolean;
  } = {
    api: false,
    cache: false,
    localStorage: false,
    performance: false,
  };

  async checkHealth(): Promise<typeof this.healthStatus> {
    const checks = await Promise.allSettled([
      this.checkAPIHealth(),
      this.checkCacheHealth(),
      this.checkLocalStorageHealth(),
      this.checkPerformanceHealth(),
    ]);

    this.healthStatus.api = checks[0].status === 'fulfilled';
    this.healthStatus.cache = checks[1].status === 'fulfilled';
    this.healthStatus.localStorage = checks[2].status === 'fulfilled';
    this.healthStatus.performance = checks[3].status === 'fulfilled';

    return this.healthStatus;
  }

  private async checkAPIHealth(): Promise<void> {
    const response = await fetch('/health', {
      method: 'HEAD',
      timeout: 5000
    });
    if (!response.ok) {
      throw new Error('API health check failed');
    }
  }

  private async checkCacheHealth(): Promise<void> {
    try {
      const testKey = 'health_check_test';
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (value !== 'test') {
        throw new Error('Cache health check failed');
      }
    } catch (error) {
      throw new Error('Cache health check failed');
    }
  }

  private async checkLocalStorageHealth(): Promise<void> {
    try {
      const testKey = 'storage_health_check';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      throw new Error('localStorage health check failed');
    }
  }

  private async checkPerformanceHealth(): Promise<void> {
    if ('performance' in window) {
      const now = performance.now();
      // Simple performance check
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      const elapsed = performance.now() - now;

      if (elapsed > 100) { // 100ms threshold
        throw new Error('Performance health check failed');
      }
    }
  }

  getHealthSummary(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.healthStatus.api) issues.push('API connectivity issues');
    if (!this.healthStatus.cache) issues.push('Cache system issues');
    if (!this.healthStatus.localStorage) issues.push('Local storage issues');
    if (!this.healthStatus.performance) issues.push('Performance issues');

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}

// Usage
const healthMonitor = new HealthMonitor();

// Check health on app startup
healthMonitor.checkHealth().then((status) => {
  console.log('Application health status:', status);
});

// Periodic health checks
setInterval(async () => {
  const health = await healthMonitor.checkHealth();
  const summary = healthMonitor.getHealthSummary();

  if (!summary.healthy) {
    console.warn('Health issues detected:', summary.issues);
    // Could trigger alerts or degraded mode
  }
}, 60000); // Check every minute
```

### 2. Performance Budgets

**✅ Performance Monitoring:**

```typescript
interface PerformanceBudget {
  maxBundleSize: number; // KB
  maxInitialLoadTime: number; // ms
  maxAPIResponseTime: number; // ms
  maxMemoryUsage: number; // MB
}

const PERFORMANCE_BUDGET: PerformanceBudget = {
  maxBundleSize: 1024, // 1MB
  maxInitialLoadTime: 3000, // 3 seconds
  maxAPIResponseTime: 2000, // 2 seconds
  maxMemoryUsage: 100, // 100MB
};

class PerformanceMonitor {
  checkBudget(): { passing: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check bundle size (would be set during build)
    const bundleSize = this.getBundleSize();
    if (bundleSize > PERFORMANCE_BUDGET.maxBundleSize) {
      violations.push(`Bundle size ${bundleSize}KB exceeds budget ${PERFORMANCE_BUDGET.maxBundleSize}KB`);
    }

    // Check initial load time
    const loadTime = this.getInitialLoadTime();
    if (loadTime > PERFORMANCE_BUDGET.maxInitialLoadTime) {
      violations.push(`Load time ${loadTime}ms exceeds budget ${PERFORMANCE_BUDGET.maxInitialLoadTime}ms`);
    }

    // Check memory usage
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > PERFORMANCE_BUDGET.maxMemoryUsage) {
      violations.push(`Memory usage ${memoryUsage}MB exceeds budget ${PERFORMANCE_BUDGET.maxMemoryUsage}MB`);
    }

    return {
      passing: violations.length === 0,
      violations,
    };
  }

  private getBundleSize(): number {
    // This would typically be measured during the build process
    // and stored in environment variables or build artifacts
    return parseInt(process.env.REACT_APP_BUNDLE_SIZE || '0', 10);
  }

  private getInitialLoadTime(): number {
    if ('performance' in window) {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return perfData.loadEventEnd - perfData.navigationStart;
    }
    return 0;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    return 0;
  }
}
```

This comprehensive best practices guide provides patterns and recommendations for building robust, performant, and maintainable applications using the Consultation Domain API. Following these practices will help ensure your application scales effectively and provides a great user experience.