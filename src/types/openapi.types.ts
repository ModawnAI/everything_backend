/**
 * OpenAPI Documentation Types
 * 
 * Comprehensive type definitions for OpenAPI/Swagger documentation
 * including schemas, paths, components, and configuration
 */

export interface OpenAPIInfo {
  title: string;
  description: string;
  version: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, {
    default: string;
    enum?: string[];
    description?: string;
  }>;
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: {
    description?: string;
    url: string;
  };
}

export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: {
    implicit?: OpenAPIOAuthFlow;
    password?: OpenAPIOAuthFlow;
    clientCredentials?: OpenAPIOAuthFlow;
    authorizationCode?: OpenAPIOAuthFlow;
  };
  openIdConnectUrl?: string;
}

export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'matrix' | 'label' | 'form' | 'simple' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
  encoding?: Record<string, OpenAPIEncoding>;
}

export interface OpenAPIEncoding {
  contentType?: string;
  headers?: Record<string, OpenAPIHeader>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
  links?: Record<string, OpenAPILink>;
}

export interface OpenAPILink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: OpenAPIServer;
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface OpenAPISchema {
  title?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  type?: 'null' | 'boolean' | 'object' | 'array' | 'number' | 'string' | 'integer';
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  additionalProperties?: boolean | OpenAPISchema;
  description?: string;
  format?: string;
  default?: any;
  nullable?: boolean;
  discriminator?: OpenAPIDiscriminator;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: OpenAPIXML;
  externalDocs?: OpenAPIExternalDocumentation;
  example?: any;
  deprecated?: boolean;
  $ref?: string;
}

export interface OpenAPIDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface OpenAPIXML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface OpenAPIExternalDocumentation {
  description?: string;
  url: string;
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentation;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  callbacks?: Record<string, OpenAPICallback>;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  servers?: OpenAPIServer[];
}

export interface OpenAPICallback {
  [expression: string]: OpenAPIPathItem;
}

export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

export interface OpenAPIPathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  servers?: OpenAPIServer[];
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  examples?: Record<string, OpenAPIExample>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  links?: Record<string, OpenAPILink>;
  callbacks?: Record<string, OpenAPICallback>;
}

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocumentation;
}

// Configuration for automatic OpenAPI generation
export interface OpenAPIGenerationConfig {
  enabled: boolean;
  autoGenerateSchemas: boolean;
  includeExamples: boolean;
  validateResponses: boolean;
  generateFromJSDoc: boolean;
  excludeEndpoints: string[];
  includePrivateRoutes: boolean;
  schemaValidation: boolean;
  sortTags: boolean;
  groupByTags: boolean;
}

// Route documentation metadata
export interface RouteDocumentation {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  examples?: Record<string, any>;
}

// Schema generation options
export interface SchemaGenerationOptions {
  includeOptional: boolean;
  useExamples: boolean;
  generateFormat: boolean;
  strictValidation: boolean;
  includeDescription: boolean;
}

// API documentation theme and customization
export interface OpenAPIUIConfig {
  theme: 'light' | 'dark' | 'auto';
  customCSS?: string;
  customJS?: string;
  title?: string;
  favicon?: string;
  logo?: {
    url: string;
    altText?: string;
    href?: string;
  };
  showExtensions: boolean;
  showCommonExtensions: boolean;
  showRequestHeaders: boolean;
  showResponseHeaders: boolean;
  enableCORS: boolean;
  enableFilter: boolean;
  enableExplorer: boolean;
  enableTryItOut: boolean;
  supportedSubmitMethods: string[];
  validatorUrl?: string;
  docExpansion: 'list' | 'full' | 'none';
  defaultModelExpandDepth: number;
  defaultModelsExpandDepth: number;
  displayOperationId: boolean;
  displayRequestDuration: boolean;
  maxDisplayedTags?: number;
  showMutatedRequest: boolean;
  tryItOutEnabled: boolean;
  requestInterceptor?: string;
  responseInterceptor?: string;
  persistAuthorization: boolean;
}

// Error response schemas
export interface OpenAPIErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    method: string;
  };
}

// Success response wrapper
export interface OpenAPISuccessResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
}

// Pagination schema
export interface OpenAPIPaginationSchema {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Common parameter schemas
export interface OpenAPICommonParameters {
  pageParam: OpenAPIParameter;
  limitParam: OpenAPIParameter;
  sortParam: OpenAPIParameter;
  orderParam: OpenAPIParameter;
  searchParam: OpenAPIParameter;
  filterParam: OpenAPIParameter;
} 