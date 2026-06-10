'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Card, StatCard, Loading } from '@/components/ui'
import { empleosApi, postulacionesApi, seguimientoApi } from '@/lib/api'

const ESTADO_LABEL: Record<string, string> = {
  postulado: 'Postulado',
  en_revision: 'En revisión',
  entrevista: 'Entrevista',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  retirado: 'Retirado',
}

function Breakdown({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  return (
    <Card>
      <p className="text-sm font-semibold text-ink-primary mb-4">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-tertiary">Sin datos.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([k, v]) => (
            <div key={k}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-ink-secondary">{labels?.[k] ?? k}</span>
                <span className="text-ink-muted">{v}</span>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-brand-blue rounded-full" style={{ width: `${(v / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function AdminDashboard() {
  const { data: vac, isLoading: l1 } = useQuery({ queryKey: ['metricas-empleos'], queryFn: empleosApi.metricas })
  const { data: post, isLoading: l2 } = useQuery({ queryKey: ['metricas-postulaciones'], queryFn: postulacionesApi.metricas })
  const { data: prac, isLoading: l3 } = useQuery({ queryKey: ['metricas-practicas'], queryFn: seguimientoApi.metricas })

  const cargando = l1 || l2 || l3

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Administración"
        subtitle="Universidad Alexander Von Humboldt · Coordinación de Prácticas"
        action={
          <Link href="/admin/reportes" className="h-9 px-4 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center">
            Ver reportes
          </Link>
        }
      />

      {cargando ? (
        <Loading label="Cargando métricas..." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Vacantes publicadas" value={vac?.total_publicadas ?? 0} />
            <StatCard label="Postulaciones" value={post?.total ?? 0} />
            <StatCard label="Prácticas en curso" value={prac?.activas ?? 0} />
            <StatCard
              label="Tasa de aprobación"
              value={`${Math.round((prac?.tasa_aprobacion ?? 0) * 100)}%`}
              hint="Prácticas aprobadas"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Breakdown title="Postulaciones por estado" data={post?.por_estado ?? {}} labels={ESTADO_LABEL} />
            <Breakdown title="Vacantes por área de conocimiento" data={vac?.por_area ?? {}} />
          </div>
        </>
      )}
    </div>
  )
}
