'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader, Card, Badge, Loading, ErrorState, EmptyState } from '@/components/ui'
import { cargarMisPostulaciones } from '@/lib/adapters'
import { apiErrorMessage } from '@/lib/api'
import { formatFecha } from '@/lib/utils'
import type { EstadoPostulacion } from '@/lib/types'

const ESTADO: Record<EstadoPostulacion, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
  postulado:   { label: 'Postulado',   tone: 'gray' },
  en_revision: { label: 'En revisión', tone: 'amber' },
  entrevista:  { label: 'Entrevista',  tone: 'blue' },
  aceptado:    { label: 'Aceptado',    tone: 'green' },
  rechazado:   { label: 'Rechazado',   tone: 'red' },
  retirado:    { label: 'Retirado',    tone: 'gray' },
}

export default function PostulacionesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['mis-postulaciones'],
    queryFn: cargarMisPostulaciones,
  })

  return (
    <div className="max-w-5xl">
      <PageHeader title="Mis postulaciones" subtitle={data ? `${data.length} postulaciones en total` : undefined} />

      {isLoading ? (
        <Loading label="Cargando postulaciones..." />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error, 'No se pudieron cargar tus postulaciones.')} onRetry={() => refetch()} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState message="Aún no te has postulado a ninguna vacante." />
      ) : (
        <div className="space-y-3">
          {data!.map(p => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">{p.vacantetitulo}</p>
                  <p className="text-xs text-ink-tertiary mt-0.5">{p.empresa} · {p.sector}</p>
                  <p className="text-2xs text-ink-muted mt-2">Postulado el {formatFecha(p.fechaPostulacion)}</p>
                  {p.notaEmpresa && (
                    <p className="text-2xs text-ink-secondary mt-2 bg-surface-3 rounded px-2 py-1.5 inline-block">
                      <span className="font-semibold text-ink-primary">Nota de la empresa:</span> {p.notaEmpresa}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge tone={ESTADO[p.estado].tone}>{ESTADO[p.estado].label}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
