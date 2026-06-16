/**
 * Cliente central de API.
 *
 * Aquí vive la URL base del API Gateway (leída de NEXT_PUBLIC_API_URL) y el helper
 * `apiFetch` que arma las rutas y maneja JWT/errores. Cada pantalla debe llamar
 * a las funciones de este archivo en lugar de usar `mock-data`.
 *
 * El API Gateway enruta automáticamente a cada microservicio según el path.
 * En producción, Amplify inyecta NEXT_PUBLIC_API_URL automáticamente.
 */

// ── URLs base por microservicio ─────────────────────────────────────────────
// URL base del API Gateway (en producción viene de Amplify, en local de .env.local)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

// En producción el API Gateway enruta:
//   /autenticacion/* → Microservicio de Autenticación
//   /empleos/* → Microservicio de Empleos
//   /postulaciones/* → Microservicio de Postulaciones
//   /seguimiento/* → Microservicio de Seguimiento
//   /notificaciones/* → Microservicio de Notificaciones
export const API = {
  auth:           `${API_BASE}/autenticacion`,
  empleos:        `${API_BASE}/empleos`,
  postulaciones:  `${API_BASE}/postulaciones`,
  seguimiento:    `${API_BASE}/seguimiento`,
  notificaciones: `${API_BASE}/notificaciones`,
} as const

// ── Manejo del token JWT (localStorage) ─────────────────────────────────────
const ACCESS_KEY  = 'eh_access_token'
const REFRESH_KEY = 'eh_refresh_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_KEY)
}

export function setTokens(access: string, refresh?: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// ── Helper de fetch ─────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & {
  /** Adjunta el JWT en Authorization. Por defecto true. */
  auth?: boolean
  /** Body como objeto JS; se serializa a JSON automáticamente. */
  body?: unknown
}

/**
 * Realiza una petición a `${base}${path}` y devuelve el JSON tipado.
 * Lanza `ApiError` si la respuesta no es 2xx.
 */
export async function apiFetch<T>(base: string, path: string, options: FetchOptions = {}): Promise<T> {
  const { auth = true, body, headers, ...rest } = options
  const token = auth ? getToken() : null

  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let detail: unknown
    try { detail = await res.json() } catch { /* respuesta sin cuerpo JSON */ }
    throw new ApiError(res.status, `HTTP ${res.status} en ${path}`, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/**
 * Convierte cualquier error de `apiFetch` en un mensaje legible para el usuario.
 *
 * Entiende los dos formatos que devuelve FastAPI:
 *  - HTTPException → `{ detail: "mensaje" }`
 *  - Validación Pydantic (422) → `{ detail: [{ loc, msg, type }, ...] }`
 *
 * Si el error no viene del backend (p. ej. fallo de red/CORS, que en `fetch`
 * se manifiesta como `TypeError`), devuelve un mensaje de conectividad.
 */
export function apiErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.'): string {
  if (err instanceof ApiError) {
    const body = err.detail as { detail?: unknown } | undefined
    const d = body?.detail

    // Caso 1: HTTPException → detail es un string.
    if (typeof d === 'string') return limpiarMensaje(d)

    // Caso 2: Validación 422 → detail es un array de errores por campo.
    if (Array.isArray(d)) {
      const msgs = d
        .map((e) =>
          e && typeof e === 'object' && 'msg' in e ? String((e as { msg: unknown }).msg) : null,
        )
        .filter((m): m is string => Boolean(m))
        .map(limpiarMensaje)
      if (msgs.length) return msgs.join('. ')
    }

    return `Error del servidor (HTTP ${err.status}).`
  }

  // fetch lanza TypeError cuando no logra contactar al servidor.
  if (err instanceof TypeError) {
    return 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.'
  }

  return fallback
}

/** Pydantic antepone "Value error, " a los mensajes de validadores personalizados. */
function limpiarMensaje(msg: string): string {
  return msg.replace(/^Value error,\s*/i, '')
}

// ── Tipos de respuesta del backend ──────────────────────────────────────────
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export type TipoUsuario = 'estudiante' | 'empresa' | 'administrador_institucional'

export interface UsuarioResponse {
  id: string
  email: string
  tipo_usuario: TipoUsuario
  activo: boolean
  email_verificado: boolean
  created_at: string
  perfil_estudiante?: unknown
  perfil_empresa?: unknown
}

// ── Endpoints: Autenticación y Usuarios (puerto 8000) ───────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<TokenResponse>(API.auth, '/api/v1/auth/login', {
      method: 'POST', auth: false, body: { email, password },
    }),

  me: () => apiFetch<UsuarioResponse>(API.auth, '/api/v1/usuarios/me'),

  registroEstudiante: (data: {
    email: string; password: string; nombres: string; apellidos: string
    universidad?: string; programa?: string
  }) =>
    apiFetch<UsuarioResponse>(API.auth, '/api/v1/usuarios/registro/estudiante', {
      method: 'POST', auth: false, body: data,
    }),

  registroEmpresa: (data: {
    email: string; password: string; nombre_empresa: string
    nit?: string; contacto_nombre?: string
  }) =>
    apiFetch<UsuarioResponse>(API.auth, '/api/v1/usuarios/registro/empresa', {
      method: 'POST', auth: false, body: data,
    }),

  // Completa el perfil del estudiante tras el registro (requiere JWT).
  // nombres/apellidos son obligatorios en el backend (PerfilEstudianteUpdate).
  actualizarPerfilEstudiante: (data: {
    nombres: string; apellidos: string
    universidad?: string; programa?: string
    semestre?: number; disponibilidad?: string; habilidades?: string[]
  }) =>
    apiFetch<UsuarioResponse>(API.auth, '/api/v1/usuarios/me/perfil/estudiante', {
      method: 'PUT', body: data,
    }),

  // Completa el perfil de la empresa tras el registro (requiere JWT).
  // nombre_empresa es obligatorio en el backend (PerfilEmpresaUpdate).
  actualizarPerfilEmpresa: (data: {
    nombre_empresa: string
    nit?: string; sector?: string; ciudad?: string; contacto_nombre?: string
  }) =>
    apiFetch<UsuarioResponse>(API.auth, '/api/v1/usuarios/me/perfil/empresa', {
      method: 'PUT', body: data,
    }),

  logout: () =>
    apiFetch<void>(API.auth, '/api/v1/auth/logout', { method: 'POST' }),
}

/** Perfil público de un usuario (auth · puerto 8000). */
export interface PerfilPublico {
  id: string
  tipo_usuario: TipoUsuario
  nombre: string
  sector: string | null
  ciudad: string | null
  programa: string | null
  universidad: string | null
}

export const usuariosApi = {
  // Resuelve el nombre visible (empresa o estudiante) a partir de su id. Público.
  perfilPublico: (usuarioId: string) =>
    apiFetch<PerfilPublico>(API.auth, `/api/v1/usuarios/publico/${usuarioId}`, { auth: false }),
}

// ── Endpoints: Empleos / Vacantes (puerto 8001) ─────────────────────────────
export type TipoOferta = 'empleo' | 'practica'
export type ModalidadApi = 'presencial' | 'remoto' | 'hibrido'
export type NivelFormacion = 'tecnico' | 'tecnologo' | 'universitario' | 'posgrado'
export type DisponibilidadHoraria = 'tiempo_completo' | 'medio_tiempo' | 'fines_de_semana' | 'flexible'
export type EstadoVacanteApi = 'borrador' | 'publicada' | 'cerrada' | 'cubierta'

export interface VacanteResumen {
  id: string
  empresa_id: string
  titulo: string
  tipo_oferta: TipoOferta
  area_conocimiento: string
  habilidades: string[]
  nivel_formacion: NivelFormacion
  modalidad: ModalidadApi
  disponibilidad_horaria: DisponibilidadHoraria
  ciudad: string | null
  salario_min: number | null
  salario_max: number | null
  estado: EstadoVacanteApi
  fecha_publicacion: string | null
  fecha_cierre: string | null
}

export interface VacanteMatching extends VacanteResumen {
  score_matching: number
}

export interface RequisitoVacante {
  id: string
  vacante_id: string
  descripcion: string
  obligatorio: boolean
}

export interface VacanteDetalle extends VacanteResumen {
  descripcion: string
  vacantes_disponibles: number
  created_at: string
  updated_at: string
  requisitos: RequisitoVacante[]
  documentos: unknown[]
}

export interface MetricasVacantes {
  total_publicadas: number
  total_cerradas: number
  total_cubiertas: number
  total_borradores: number
  por_area: Record<string, number>
  por_modalidad: Record<string, number>
  por_nivel_formacion: Record<string, number>
  por_disponibilidad: Record<string, number>
}

export interface PerfilMatching {
  programa?: string
  area_conocimiento?: string
  nivel_formacion?: NivelFormacion
  disponibilidad_horaria?: DisponibilidadHoraria
  ciudad?: string
}

export interface VacanteCreateBody {
  titulo: string
  descripcion: string
  tipo_oferta: TipoOferta
  area_conocimiento: string
  habilidades?: string[]
  nivel_formacion: NivelFormacion
  modalidad: ModalidadApi
  disponibilidad_horaria: DisponibilidadHoraria
  ciudad?: string
  salario_min?: number
  salario_max?: number
  vacantes_disponibles?: number
  fecha_cierre?: string
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export const empleosApi = {
  // Listado público de vacantes publicadas (con filtros opcionales).
  listar: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<VacanteResumen[]>(API.empleos, `/api/v1/vacantes/${qs(params)}`, { auth: false }),

  detalle: (id: string) =>
    apiFetch<VacanteDetalle>(API.empleos, `/api/v1/vacantes/${id}`, { auth: false }),

  // Recomendaciones personalizadas con score (requiere JWT de estudiante).
  matching: (perfil: PerfilMatching) =>
    apiFetch<VacanteMatching[]>(API.empleos, '/api/v1/vacantes/matching', { method: 'POST', body: perfil }),

  misVacantes: () =>
    apiFetch<VacanteResumen[]>(API.empleos, '/api/v1/vacantes/mis-vacantes'),

  // Crea una vacante en estado borrador (requiere JWT de empresa).
  crear: (data: VacanteCreateBody) =>
    apiFetch<VacanteDetalle>(API.empleos, '/api/v1/vacantes/', { method: 'POST', body: data }),

  // Cambia el estado de una vacante a "publicada".
  publicar: (id: string) =>
    apiFetch<VacanteDetalle>(API.empleos, `/api/v1/vacantes/${id}/publicar`, { method: 'POST' }),

  metricas: () =>
    apiFetch<MetricasVacantes>(API.empleos, '/api/v1/vacantes/metricas'),
}

// ── Endpoints: Postulaciones (puerto 8002) ──────────────────────────────────
export type EstadoPostulacionApi =
  | 'postulado' | 'en_revision' | 'entrevista' | 'aceptado' | 'rechazado' | 'retirado'

export interface PostulacionResumen {
  id: string
  vacante_id: string
  estudiante_id: string
  empresa_id: string
  estado: EstadoPostulacionApi
  nota_empresa: string | null
  created_at: string
  updated_at: string
}

export interface MetricasPostulaciones {
  total: number
  por_estado: Record<string, number>
  tasa_conversion_aceptado: number
  tasa_rechazo: number
  postulaciones_por_vacante: Record<string, number>
  postulaciones_por_estudiante: Record<string, number>
}

export const postulacionesApi = {
  misPostulaciones: () =>
    apiFetch<PostulacionResumen[]>(API.postulaciones, '/api/v1/postulaciones/mis-postulaciones'),

  empresaTodas: () =>
    apiFetch<PostulacionResumen[]>(API.postulaciones, '/api/v1/postulaciones/empresa/todas'),

  porVacante: (vacanteId: string) =>
    apiFetch<PostulacionResumen[]>(API.postulaciones, `/api/v1/postulaciones/vacante/${vacanteId}`),

  crear: (vacanteId: string, nota?: string) =>
    apiFetch<PostulacionResumen>(API.postulaciones, '/api/v1/postulaciones/', {
      method: 'POST', body: { vacante_id: vacanteId, nota_estudiante: nota },
    }),

  // La empresa avanza el estado de una postulación (en_revision → entrevista → aceptado/rechazado).
  cambiarEstado: (postulacionId: string, nuevoEstado: EstadoPostulacionApi, motivo?: string) =>
    apiFetch<PostulacionResumen>(API.postulaciones, `/api/v1/postulaciones/${postulacionId}/estado`, {
      method: 'PATCH', body: { nuevo_estado: nuevoEstado, motivo },
    }),

  // La empresa agrega/actualiza una nota sobre la postulación (visible para el estudiante).
  agregarNota: (postulacionId: string, nota: string) =>
    apiFetch<PostulacionResumen>(API.postulaciones, `/api/v1/postulaciones/${postulacionId}/nota`, {
      method: 'PATCH', body: { nota },
    }),

  retirar: (postulacionId: string) =>
    apiFetch<PostulacionResumen>(API.postulaciones, `/api/v1/postulaciones/${postulacionId}/retirar`, {
      method: 'POST',
    }),

  metricas: () =>
    apiFetch<MetricasPostulaciones>(API.postulaciones, '/api/v1/postulaciones/metricas'),
}

// ── Endpoints: Seguimiento de prácticas (puerto 8003) ───────────────────────
export type EstadoPracticaApi = 'en_curso' | 'suspendida' | 'finalizada' | 'reprobada'

export interface PracticaResumen {
  id: string
  vacante_id: string
  estudiante_id: string
  empresa_id: string
  estado: EstadoPracticaApi
  fecha_inicio: string
  fecha_fin_estimada: string
  fecha_fin_real: string | null
  calificacion_final: number | null
}

export interface InformePractica {
  id: string
  practica_id: string
  periodo_numero: number
  descripcion_actividades: string
  logros: string | null
  dificultades: string | null
  url_documento: string | null
  aprobado_por_empresa: boolean
  created_at: string
  updated_at: string
}

export interface PracticaDetalle extends PracticaResumen {
  postulacion_id: string
  programa_academico: string | null
  universidad: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
  documentos: unknown[]
  evaluaciones: unknown[]
  informes: InformePractica[]
}

export interface MetricasPracticas {
  total: number
  activas: number
  finalizadas: number
  reprobadas: number
  suspendidas: number
  tasa_aprobacion: number
  calificacion_promedio: number | null
  duracion_promedio_dias: number | null
  por_empresa: Record<string, number>
  por_programa: Record<string, number>
}

export const seguimientoApi = {
  misPracticas: () =>
    apiFetch<PracticaResumen[]>(API.seguimiento, '/api/v1/practicas/mis-practicas'),

  detalle: (id: string) =>
    apiFetch<PracticaDetalle>(API.seguimiento, `/api/v1/practicas/${id}`),

  empresaTodas: () =>
    apiFetch<PracticaResumen[]>(API.seguimiento, '/api/v1/practicas/empresa/todas'),

  metricas: () =>
    apiFetch<MetricasPracticas>(API.seguimiento, '/api/v1/practicas/metricas'),
}

// ── Endpoints: Notificaciones (puerto 8004) ─────────────────────────────────
export interface NotificacionApi {
  id: string
  usuario_id: string
  tipo: string
  canal: string
  titulo: string
  mensaje: string
  leida: boolean
  leida_at: string | null
  estado_envio: string
  datos_extra: unknown
  created_at: string
}

export const notificacionesApi = {
  listar: (soloNoLeidas = false) =>
    apiFetch<NotificacionApi[]>(API.notificaciones, `/api/v1/notificaciones/${qs({ solo_no_leidas: soloNoLeidas })}`),

  noLeidasCount: () =>
    apiFetch<{ no_leidas: number }>(API.notificaciones, '/api/v1/notificaciones/no-leidas/count'),

  marcarLeidas: (ids: string[]) =>
    apiFetch<{ actualizadas: number }>(API.notificaciones, '/api/v1/notificaciones/marcar-leidas', {
      method: 'PATCH', body: { ids },
    }),

  marcarTodasLeidas: () =>
    apiFetch<{ actualizadas: number }>(API.notificaciones, '/api/v1/notificaciones/marcar-todas-leidas', {
      method: 'PATCH',
    }),
}
