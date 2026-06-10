'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { PageHeader, Card, Loading, ErrorState } from '@/components/ui'
import { authApi, apiErrorMessage } from '@/lib/api'

const DISPONIBILIDAD_LABEL: Record<string, string> = {
  tiempo_completo: 'Tiempo completo',
  medio_tiempo: 'Medio tiempo',
  fines_de_semana: 'Fines de semana',
}

interface PerfilEstudiante {
  nombres?: string
  apellidos?: string
  universidad?: string
  programa?: string
  semestre?: number
  disponibilidad?: string
  habilidades?: string[]
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xs text-ink-muted uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink-primary mt-0.5">{value || '—'}</p>
    </div>
  )
}

function HabilidadesCard({ perfil }: { perfil: PerfilEstudiante }) {
  const qc = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [skills, setSkills] = useState<string[]>(perfil.habilidades ?? [])
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function agregar() {
    const v = nueva.trim()
    if (v && !skills.includes(v)) setSkills([...skills, v])
    setNueva('')
  }

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      await authApi.actualizarPerfilEstudiante({
        nombres: perfil.nombres ?? '',
        apellidos: perfil.apellidos ?? '',
        habilidades: skills,
      })
      qc.invalidateQueries({ queryKey: ['me'] })
      setEditando(false)
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron guardar las habilidades.'))
    } finally {
      setGuardando(false)
    }
  }

  const habilidades = perfil.habilidades ?? []

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-ink-primary">Habilidades</p>
        {!editando && (
          <button onClick={() => { setSkills(habilidades); setEditando(true) }} className="text-2xs text-brand-blue hover:underline">
            Editar
          </button>
        )}
      </div>

      {!editando ? (
        habilidades.length === 0 ? (
          <p className="text-xs text-ink-tertiary">Aún no has agregado habilidades.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {habilidades.map(h => (
              <span key={h} className="text-xs px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue font-medium">{h}</span>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {skills.map(h => (
              <span key={h} className="text-xs pl-3 pr-1.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue font-medium flex items-center gap-1">
                {h}
                <button onClick={() => setSkills(skills.filter(s => s !== h))} className="hover:text-brand-red"><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
              placeholder="Agregar habilidad..."
              className="flex-1 h-9 px-3 bg-surface-2 border border-default rounded-lg text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            />
            <button onClick={agregar} className="h-9 px-3 border border-default rounded-lg text-ink-secondary hover:bg-surface-3 flex items-center gap-1 text-sm">
              <Plus size={14} /> Añadir
            </button>
          </div>
          {error && <p className="text-xs text-semantic-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditando(false)} className="h-8 px-3 border border-default rounded-lg text-xs font-medium text-ink-secondary hover:bg-surface-3">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className="h-8 px-3 bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-semibold rounded-lg disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function PerfilPage() {
  const { data: me, isLoading, isError, error, refetch } = useQuery({ queryKey: ['me'], queryFn: authApi.me })

  if (isLoading) return <div className="max-w-3xl"><Loading label="Cargando perfil..." /></div>
  if (isError || !me) {
    return (
      <div className="max-w-3xl">
        <ErrorState message={apiErrorMessage(error, 'No se pudo cargar tu perfil.')} onRetry={() => refetch()} />
      </div>
    )
  }

  const e = (me.perfil_estudiante ?? {}) as PerfilEstudiante
  const nombre = `${e.nombres ?? ''} ${e.apellidos ?? ''}`.trim() || me.email
  const iniciales = nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-3xl">
      <PageHeader title="Mi perfil" subtitle="Información visible para las empresas" />

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-brand-blue text-white text-xl font-bold flex items-center justify-center">
            {iniciales}
          </span>
          <div>
            <p className="text-lg font-bold text-ink-primary">{nombre}</p>
            <p className="text-sm text-ink-tertiary">{me.email}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <p className="text-sm font-semibold text-ink-primary mb-4">Información académica</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Universidad" value={e.universidad ?? ''} />
          <Field label="Programa" value={e.programa ?? ''} />
          <Field label="Semestre" value={e.semestre ?? ''} />
          <Field label="Disponibilidad" value={e.disponibilidad ? (DISPONIBILIDAD_LABEL[e.disponibilidad] ?? e.disponibilidad) : ''} />
        </div>
      </Card>

      <HabilidadesCard perfil={e} />
    </div>
  )
}
