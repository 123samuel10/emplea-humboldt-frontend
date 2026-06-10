'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, Card, StatCard, Badge, Loading } from '@/components/ui'
import { authApi } from '@/lib/api'
import { cargarMisVacantes, cargarPostulantesEmpresa } from '@/lib/adapters'
import { PublicarVacanteModal } from '@/components/PublicarVacanteModal'

export default function EmpresaDashboard() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const { data: vacantes = [], isLoading: loadingVac } = useQuery({
    queryKey: ['mis-vacantes'],
    queryFn: cargarMisVacantes,
  })
  const { data: postulantes = [], isLoading: loadingPost } = useQuery({
    queryKey: ['postulantes-empresa'],
    queryFn: cargarPostulantesEmpresa,
  })

  const empresa = (me?.perfil_empresa ?? {}) as { nombre_empresa?: string }

  const activas = vacantes.filter(v => v.fechaPublicacion).length
  const enEntrevista = postulantes.filter(p => p.estado === 'entrevista').length
  const contratados = postulantes.filter(p => p.estado === 'aceptado').length
  const conteoPorVacante = postulantes.reduce<Record<string, number>>((acc, p) => {
    acc[p.vacanteId] = (acc[p.vacanteId] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Panel de empresa"
        subtitle={empresa.nombre_empresa}
        action={
          <button onClick={() => setModalAbierto(true)} className="h-9 px-4 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors">
            + Publicar vacante
          </button>
        }
      />

      {modalAbierto && <PublicarVacanteModal onClose={() => setModalAbierto(false)} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Vacantes activas" value={activas} />
        <StatCard label="Postulaciones" value={postulantes.length} />
        <StatCard label="En entrevista" value={enEntrevista} />
        <StatCard label="Contratados" value={contratados} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Vacantes publicadas */}
        <Card>
          <p className="text-sm font-semibold text-ink-primary mb-4">Tus vacantes</p>
          {loadingVac ? (
            <Loading label="Cargando..." />
          ) : vacantes.length === 0 ? (
            <p className="text-xs text-ink-tertiary py-2">Aún no has publicado vacantes.</p>
          ) : (
            <div className="space-y-3">
              {vacantes.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-primary truncate">{v.titulo}</p>
                    <p className="text-2xs text-ink-muted">{v.ciudad}</p>
                  </div>
                  <Badge tone="blue">{conteoPorVacante[v.id] ?? 0} postulantes</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos postulantes */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-primary">Últimos postulantes</p>
            <Link href="/empresa/postulantes" className="text-2xs text-brand-blue hover:underline">Ver todos</Link>
          </div>
          {loadingPost ? (
            <Loading label="Cargando..." />
          ) : postulantes.length === 0 ? (
            <p className="text-xs text-ink-tertiary py-2">Todavía no hay postulantes.</p>
          ) : (
            <div className="space-y-3">
              {postulantes.slice(0, 4).map(e => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue text-2xs font-bold flex items-center justify-center flex-shrink-0">
                    {e.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-primary truncate">{e.nombre}</p>
                    <p className="text-2xs text-ink-muted truncate">{e.programa ?? e.vacanteTitulo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
