'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader, Card, Badge, StatCard, Loading, ErrorState, EmptyState } from '@/components/ui'
import { cargarMisPracticas } from '@/lib/adapters'
import { apiErrorMessage } from '@/lib/api'
import { formatFecha } from '@/lib/utils'
import type { Practica } from '@/lib/types'

const ESTADO_LABEL: Record<Practica['estado'], { label: string; tone: 'green' | 'gray' | 'red' }> = {
  activa:     { label: 'Activa',     tone: 'green' },
  finalizada: { label: 'Finalizada', tone: 'gray' },
  cancelada:  { label: 'Cancelada',  tone: 'red' },
}

function PracticaCard({ p }: { p: Practica }) {
  return (
    <div className="mb-8">
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-ink-primary">{p.cargo}</p>
            <p className="text-sm text-ink-tertiary mt-0.5">{p.empresa}</p>
          </div>
          <Badge tone={ESTADO_LABEL[p.estado].tone}>{ESTADO_LABEL[p.estado].label}</Badge>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-2xs text-ink-tertiary mb-1.5">
            <span>Avance</span>
            <span>{p.avancePorcentaje}%</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue rounded-full" style={{ width: `${p.avancePorcentaje}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Inicio" value={formatFecha(p.fechaInicio)} />
        <StatCard label="Finaliza" value={formatFecha(p.fechaFin)} />
        <StatCard label="Próxima evaluación" value={formatFecha(p.proximaEvaluacion)} />
        <StatCard label="Informes pendientes" value={p.informesPendientes} hint={p.informesPendientes > 0 ? 'Entrega antes del cierre' : 'Al día'} />
        <StatCard label="Calificación" value={p.calificacion ?? '—'} />
      </div>
    </div>
  )
}

export default function PracticasPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['mis-practicas'],
    queryFn: cargarMisPracticas,
  })

  return (
    <div className="max-w-4xl">
      <PageHeader title="Mis prácticas" subtitle="Seguimiento de tus prácticas profesionales" />

      {isLoading ? (
        <Loading label="Cargando prácticas..." />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error, 'No se pudieron cargar tus prácticas.')} onRetry={() => refetch()} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState message="Aún no tienes prácticas registradas." />
      ) : (
        data!.map(p => <PracticaCard key={p.id} p={p} />)
      )}
    </div>
  )
}
