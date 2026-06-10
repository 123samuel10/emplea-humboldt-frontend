/**
 * Adaptadores backend → dominio del frontend.
 *
 * Los microservicios devuelven DTOs (snake_case, IDs en vez de nombres) que no
 * coinciden 1:1 con los tipos de dominio que consumen las pantallas (`types.ts`).
 * Aquí viven las funciones que traducen una forma en la otra, incluyendo:
 *  - Resolución del NOMBRE de empresa a partir de su `empresa_id` (el backend
 *    de vacantes/postulaciones/prácticas solo guarda el UUID), vía el endpoint
 *    público de auth, con caché en memoria para no repetir llamadas.
 *  - Cruce con el servicio de empleos para enriquecer postulaciones/prácticas
 *    (título de la vacante, cargo, sector, modalidad).
 *  - Mapeo de enums del backend a los del frontend.
 */
import {
  authApi,
  empleosApi,
  postulacionesApi,
  seguimientoApi,
  usuariosApi,
  type DisponibilidadHoraria,
  type EstadoPostulacionApi,
  type NotificacionApi,
  type PerfilMatching,
  type PostulacionResumen,
  type PracticaResumen,
  type VacanteDetalle,
  type VacanteResumen,
} from './api'
import type {
  EstadoPostulacion,
  EstadoPractica,
  Modalidad,
  NotificacionItem,
  Postulacion,
  Practica,
  TipoNotificacion,
  TipoVacante,
  Vacante,
} from './types'

// ── Caché de perfiles públicos (nombre de empresa/estudiante) ───────────────
interface PerfilResuelto {
  nombre: string
  sector: string | null
}

const perfilCache = new Map<string, Promise<PerfilResuelto>>()

/** Resuelve el nombre visible de un usuario por su id (con caché). */
export function resolverPerfil(usuarioId: string): Promise<PerfilResuelto> {
  let cached = perfilCache.get(usuarioId)
  if (!cached) {
    cached = usuariosApi
      .perfilPublico(usuarioId)
      .then((p) => ({ nombre: p.nombre, sector: p.sector }))
      .catch(() => ({ nombre: 'Empresa', sector: null }))
    perfilCache.set(usuarioId, cached)
  }
  return cached
}

// ── Mapeos de enums ─────────────────────────────────────────────────────────

/** La disponibilidad horaria del backend es lo más cercano al "tipo" del front. */
function mapTipoVacante(d: DisponibilidadHoraria): TipoVacante {
  if (d === 'tiempo_completo') return 'tiempo_completo'
  if (d === 'medio_tiempo') return 'medio_tiempo'
  return 'practica' // fines_de_semana | flexible
}

function mapEstadoPractica(e: PracticaResumen['estado']): EstadoPractica {
  if (e === 'en_curso') return 'activa'
  if (e === 'finalizada') return 'finalizada'
  return 'cancelada' // suspendida | reprobada
}

function mapTipoNotificacion(tipo: string): TipoNotificacion {
  if (/(aceptad|aprobad|finalizada|iniciada|bienvenida)/.test(tipo)) return 'success'
  if (/(rechaz|reprobada|suspendida|cerrada)/.test(tipo)) return 'error'
  if (/(pendiente|vencimiento)/.test(tipo)) return 'warning'
  return 'info'
}

/** % de avance de una práctica estimado por fechas. */
function avancePorFechas(inicio: string, fin: string): number {
  const i = new Date(inicio).getTime()
  const f = new Date(fin).getTime()
  const ahora = Date.now()
  if (!isFinite(i) || !isFinite(f) || f <= i) return 0
  return Math.max(0, Math.min(100, Math.round(((ahora - i) / (f - i)) * 100)))
}

// ── Mapeos de entidades ──────────────────────────────────────────────────────

/** Convierte una vacante del backend al modelo del front (resuelve el nombre de empresa). */
export async function mapVacante(v: VacanteResumen, score?: number): Promise<Vacante> {
  const perfil = await resolverPerfil(v.empresa_id)
  return {
    id: v.id,
    titulo: v.titulo,
    tipoOferta: v.tipo_oferta,
    empresa: perfil.nombre,
    empresaId: v.empresa_id,
    sector: v.area_conocimiento,
    ciudad: v.ciudad ?? 'No especificada',
    modalidad: v.modalidad as Modalidad,
    tipo: mapTipoVacante(v.disponibilidad_horaria),
    salario: { min: v.salario_min ?? 0, max: v.salario_max ?? 0 },
    descripcion: '',
    requisitos: [],
    habilidades: v.habilidades ?? [],
    fechaPublicacion: v.fecha_publicacion ?? '',
    fechaCierre: v.fecha_cierre ?? '',
    postulaciones: 0, // el listado público no expone el conteo
    compatibilidad: score != null ? Math.round(score * 100) : 0,
  }
}

/** Enriquece una postulación cruzando con la vacante (título/sector/modalidad) y el nombre de empresa. */
export async function mapPostulacion(p: PostulacionResumen): Promise<Postulacion> {
  const [vac, perfil] = await Promise.all([
    empleosApi.detalle(p.vacante_id).catch(() => null as VacanteDetalle | null),
    resolverPerfil(p.empresa_id),
  ])
  return {
    id: p.id,
    vacanteId: p.vacante_id,
    vacantetitulo: vac?.titulo ?? 'Vacante',
    empresa: perfil.nombre,
    sector: vac?.area_conocimiento ?? '—',
    fechaPostulacion: p.created_at,
    estado: p.estado as EstadoPostulacion,
    compatibilidad: 0,
    modalidad: (vac?.modalidad ?? 'presencial') as Modalidad,
    notaEmpresa: p.nota_empresa ?? undefined,
  }
}

/** Enriquece una práctica con cargo (vacante), nombre de empresa, informes pendientes y avance. */
export async function mapPractica(pr: PracticaResumen): Promise<Practica> {
  const [detalle, vac, perfil] = await Promise.all([
    seguimientoApi.detalle(pr.id).catch(() => null),
    empleosApi.detalle(pr.vacante_id).catch(() => null as VacanteDetalle | null),
    resolverPerfil(pr.empresa_id),
  ])
  const informesPendientes = detalle
    ? detalle.informes.filter((i) => !i.aprobado_por_empresa).length
    : 0
  return {
    id: pr.id,
    vacanteId: pr.vacante_id,
    estudianteId: pr.estudiante_id,
    empresa: perfil.nombre,
    cargo: vac?.titulo ?? 'Práctica',
    fechaInicio: pr.fecha_inicio,
    fechaFin: pr.fecha_fin_real ?? pr.fecha_fin_estimada,
    estado: mapEstadoPractica(pr.estado),
    calificacion: pr.calificacion_final ?? undefined,
    informesPendientes,
    proximaEvaluacion: pr.fecha_fin_estimada,
    avancePorcentaje:
      pr.estado === 'finalizada' ? 100 : avancePorFechas(pr.fecha_inicio, pr.fecha_fin_estimada),
  }
}

export function mapNotificacion(n: NotificacionApi): NotificacionItem {
  return {
    id: n.id,
    tipo: mapTipoNotificacion(n.tipo),
    titulo: n.titulo,
    descripcion: n.mensaje,
    tiempo: n.created_at,
    leida: n.leida,
  }
}

// ── Helpers de carga (componen varias llamadas) ──────────────────────────────

/** Lista de vacantes publicadas, ya mapeadas. */
export async function cargarVacantes(
  params: Record<string, string | number | undefined> = {},
): Promise<Vacante[]> {
  const vacantes = await empleosApi.listar(params)
  return Promise.all(vacantes.map((v) => mapVacante(v)))
}

/** Vacantes de la empresa autenticada, ya mapeadas. */
export async function cargarMisVacantes(): Promise<Vacante[]> {
  const vacantes = await empleosApi.misVacantes()
  return Promise.all(vacantes.map((v) => mapVacante(v)))
}

// ── Vista de postulantes para la empresa ─────────────────────────────────────
export interface PostulanteVista {
  id: string
  estudianteId: string
  vacanteId: string
  estado: EstadoPostulacionApi
  nombre: string
  programa: string | null
  vacanteTitulo: string
  fecha: string
  notaEmpresa: string
}

/** Postulaciones recibidas por la empresa, enriquecidas con nombre/programa del estudiante y título de la vacante. */
export async function cargarPostulantesEmpresa(): Promise<PostulanteVista[]> {
  const lista = await postulacionesApi.empresaTodas()
  return Promise.all(
    lista.map(async (p) => {
      const [perfil, vac] = await Promise.all([
        usuariosApi.perfilPublico(p.estudiante_id).catch(() => null),
        empleosApi.detalle(p.vacante_id).catch(() => null as VacanteDetalle | null),
      ])
      return {
        id: p.id,
        estudianteId: p.estudiante_id,
        vacanteId: p.vacante_id,
        estado: p.estado,
        nombre: perfil?.nombre ?? 'Estudiante',
        programa: perfil?.programa ?? null,
        vacanteTitulo: vac?.titulo ?? 'Vacante',
        fecha: p.created_at,
        notaEmpresa: p.nota_empresa ?? '',
      }
    }),
  )
}

/** Postulaciones del estudiante autenticado, enriquecidas. */
export async function cargarMisPostulaciones(): Promise<Postulacion[]> {
  const lista = await postulacionesApi.misPostulaciones()
  return Promise.all(lista.map(mapPostulacion))
}

/** Prácticas del estudiante autenticado, enriquecidas. */
export async function cargarMisPracticas(): Promise<Practica[]> {
  const lista = await seguimientoApi.misPracticas()
  return Promise.all(lista.map(mapPractica))
}

/**
 * Vacantes recomendadas para el estudiante (con % de compatibilidad real).
 * Usa el endpoint de matching construyendo el perfil desde `/me`; si algo
 * falla, cae al listado público sin score.
 */
export async function cargarRecomendadas(limit = 3): Promise<Vacante[]> {
  try {
    const me = await authApi.me()
    const pe = (me.perfil_estudiante ?? {}) as { programa?: string; disponibilidad?: string }
    const perfil: PerfilMatching = {
      programa: pe.programa || undefined,
      disponibilidad_horaria: (pe.disponibilidad as DisponibilidadHoraria) || undefined,
    }
    const matched = await empleosApi.matching(perfil)
    if (matched.length) {
      return Promise.all(matched.slice(0, limit).map((v) => mapVacante(v, v.score_matching)))
    }
  } catch {
    /* sin matching → fallback abajo */
  }
  return (await cargarVacantes()).slice(0, limit)
}
