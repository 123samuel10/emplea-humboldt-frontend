'use client'

import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { PageHeader, Card, Loading } from '@/components/ui'
import { empleosApi, postulacionesApi } from '@/lib/api'

const ESTADO_LABEL: Record<string, string> = {
  postulado: 'Postulado',
  en_revision: 'En revisión',
  entrevista: 'Entrevista',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  retirado: 'Retirado',
}

function dictToData(dict: Record<string, number>, keyName: string, labels?: Record<string, string>) {
  return Object.entries(dict).map(([k, v]) => ({ [keyName]: labels?.[k] ?? k, valor: v }))
}

export default function ReportesPage() {
  const { data: vac, isLoading: l1 } = useQuery({ queryKey: ['metricas-empleos'], queryFn: empleosApi.metricas })
  const { data: post, isLoading: l2 } = useQuery({ queryKey: ['metricas-postulaciones'], queryFn: postulacionesApi.metricas })

  const porArea = dictToData(vac?.por_area ?? {}, 'area')
  const porEstado = dictToData(post?.por_estado ?? {}, 'estado', ESTADO_LABEL)

  return (
    <div className="max-w-6xl">
      <PageHeader title="Reportes" subtitle="Indicadores de empleabilidad y prácticas" />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <p className="text-sm font-semibold text-ink-primary mb-4">Vacantes por área de conocimiento</p>
          <div className="h-64">
            {l1 ? <Loading /> : porArea.length === 0 ? (
              <p className="text-sm text-ink-tertiary text-center py-12">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porArea} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="area" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="valor" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-ink-primary mb-4">Postulaciones por estado</p>
          <div className="h-64">
            {l2 ? <Loading /> : porEstado.length === 0 ? (
              <p className="text-sm text-ink-tertiary text-center py-12">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porEstado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="estado" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
