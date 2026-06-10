'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Loading } from '@/components/ui'
import { authApi } from '@/lib/api'
import { cargarMisPostulaciones, cargarMisPracticas, cargarRecomendadas } from '@/lib/adapters'
import type { EstadoPostulacion, Postulacion } from '@/lib/types'
import { formatCOP } from '@/lib/utils'

const ESTADO: Record<EstadoPostulacion, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
  postulado:   { label: 'Postulado',   tone: 'gray' },
  en_revision: { label: 'En revisión', tone: 'amber' },
  entrevista:  { label: 'Entrevista',  tone: 'blue' },
  aceptado:    { label: 'Aceptado',    tone: 'green' },
  rechazado:   { label: 'Rechazado',   tone: 'red' },
  retirado:    { label: 'Retirado',    tone: 'gray' },
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function postulacionesPorMes(posts: Postulacion[]) {
  const map = new Map<string, { mes: string; postulaciones: number; aceptadas: number }>()
  for (const p of posts) {
    const d = new Date(p.fechaPostulacion)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    const entry = map.get(key) ?? { mes: MESES[d.getMonth()], postulaciones: 0, aceptadas: 0 }
    entry.postulaciones++
    if (p.estado === 'aceptado') entry.aceptadas++
    map.set(key, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
}

export default function EstudianteDashboard() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['mis-postulaciones'],
    queryFn: cargarMisPostulaciones,
  })
  const { data: practicas = [] } = useQuery({ queryKey: ['mis-practicas'], queryFn: cargarMisPracticas })
  const { data: recomendadas = [], isLoading: loadingReco } = useQuery({
    queryKey: ['recomendadas'],
    queryFn: () => cargarRecomendadas(3),
  })

  const perfil = (me?.perfil_estudiante ?? {}) as { nombres?: string; programa?: string; semestre?: number }
  const nombre = perfil.nombres?.split(' ')[0] ?? 'estudiante'

  const activas = posts.filter(p => p.estado !== 'rechazado' && p.estado !== 'retirado').length
  const entrevistas = posts.filter(p => p.estado === 'entrevista').length
  const practicaActiva = practicas.find(p => p.estado === 'activa')
  const chart = postulacionesPorMes(posts)

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={`Hola, ${nombre} 👋`}
        subtitle={perfil.programa ? `${perfil.programa}${perfil.semestre ? ` · Semestre ${perfil.semestre}` : ''}` : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Postulaciones activas" value={activas} />
        <StatCard label="Entrevistas" value={entrevistas} />
        <StatCard label="Práctica en curso" value={practicaActiva ? '1' : '0'} hint={practicaActiva?.empresa} />
        <StatCard label="Avance práctica" value={`${practicaActiva?.avancePorcentaje ?? 0}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <p className="text-sm font-semibold text-ink-primary mb-4">Tus postulaciones por mes</p>
          <div className="h-56">
            {chart.length === 0 ? (
              <p className="text-sm text-ink-tertiary text-center py-12">Aún no hay datos de postulaciones.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="postulaciones" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aceptadas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Postulaciones recientes */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-primary">Postulaciones recientes</p>
            <Link href="/estudiante/postulaciones" className="text-2xs text-brand-blue hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {loadingPosts ? (
              <Loading label="Cargando..." />
            ) : posts.length === 0 ? (
              <p className="text-xs text-ink-tertiary py-2">Sin postulaciones todavía.</p>
            ) : posts.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-primary truncate">{p.vacantetitulo}</p>
                  <p className="text-2xs text-ink-muted">{p.empresa}</p>
                </div>
                <Badge tone={ESTADO[p.estado].tone}>{ESTADO[p.estado].label}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recomendadas */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-ink-primary">Vacantes recomendadas para ti</p>
          <Link href="/estudiante/empleos" className="text-2xs text-brand-blue hover:underline">Ver todas</Link>
        </div>
        {loadingReco ? (
          <Loading label="Buscando vacantes..." />
        ) : recomendadas.length === 0 ? (
          <Card><p className="text-sm text-ink-tertiary text-center py-4">No hay vacantes disponibles por ahora.</p></Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {recomendadas.map(v => (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-primary">{v.titulo}</p>
                  {v.compatibilidad > 0 && <Badge tone="green">{v.compatibilidad}%</Badge>}
                </div>
                <p className="text-xs text-ink-tertiary mt-0.5">{v.empresa} · {v.ciudad}</p>
                {v.salario.max > 0 && (
                  <p className="text-xs text-ink-secondary mt-3">{formatCOP(v.salario.min)} – {formatCOP(v.salario.max)}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
