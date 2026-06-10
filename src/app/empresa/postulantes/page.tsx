'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, MessageSquare } from 'lucide-react'
import { PageHeader, Card, Badge, Loading, ErrorState, EmptyState } from '@/components/ui'
import { cargarPostulantesEmpresa, type PostulanteVista } from '@/lib/adapters'
import { postulacionesApi, apiErrorMessage, type EstadoPostulacionApi } from '@/lib/api'
import { formatFecha } from '@/lib/utils'
import { cn } from '@/lib/utils'

const ESTADO: Record<EstadoPostulacionApi, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
  postulado:   { label: 'Postulado',   tone: 'gray' },
  en_revision: { label: 'En revisión', tone: 'amber' },
  entrevista:  { label: 'Entrevista',  tone: 'blue' },
  aceptado:    { label: 'Aceptado',    tone: 'green' },
  rechazado:   { label: 'Rechazado',   tone: 'red' },
  retirado:    { label: 'Retirado',    tone: 'gray' },
}

// La empresa decide libremente: desde cualquier estado activo puede pasar a
// cualquier otro (revisión, entrevista, aceptar, rechazar), sin secuencia fija.
const TODAS: { estado: EstadoPostulacionApi; label: string; cls: string }[] = [
  { estado: 'en_revision', label: 'Revisar',    cls: 'bg-semantic-warning text-white' },
  { estado: 'entrevista',  label: 'Entrevista', cls: 'bg-brand-blue text-white' },
  { estado: 'aceptado',    label: 'Aceptar',    cls: 'bg-semantic-success text-white' },
  { estado: 'rechazado',   label: 'Rechazar',   cls: 'border border-semantic-error-border text-semantic-error' },
]
const TERMINALES = new Set<EstadoPostulacionApi>(['aceptado', 'rechazado', 'retirado'])

function NotaModal({ postulante, onClose, onSaved }: { postulante: PostulanteVista; onClose: () => void; onSaved: () => void }) {
  const [texto, setTexto] = useState(postulante.notaEmpresa)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      await postulacionesApi.agregarNota(postulante.id, texto.trim())
      onSaved()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la nota.'))
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-2 border border-default rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-default">
          <p className="text-base font-bold text-ink-primary">Nota para {postulante.nombre}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-3 flex items-center justify-center text-ink-tertiary"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-2xs text-ink-muted">Esta nota será visible para el estudiante en sus postulaciones.</p>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={1000}
            placeholder="Ej.: Nos gustó tu perfil. Te contactaremos para coordinar una entrevista la próxima semana."
            className="w-full h-28 px-3 py-2 bg-surface-2 border border-default rounded-lg text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 resize-none"
          />
          {error && <p className="text-xs text-semantic-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="h-9 px-4 border border-default rounded-lg text-sm font-medium text-ink-secondary hover:bg-surface-3">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="h-9 px-4 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {guardando ? 'Guardando...' : 'Guardar nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostulantesPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['postulantes-empresa'],
    queryFn: cargarPostulantesEmpresa,
  })

  const [pendiente, setPendiente] = useState<string | null>(null)
  const [accionError, setAccionError] = useState('')
  const [notaPara, setNotaPara] = useState<PostulanteVista | null>(null)

  async function cambiar(id: string, estado: EstadoPostulacionApi) {
    setAccionError('')
    setPendiente(id)
    try {
      await postulacionesApi.cambiarEstado(id, estado)
      await qc.invalidateQueries({ queryKey: ['postulantes-empresa'] })
    } catch (err) {
      setAccionError(apiErrorMessage(err, 'No se pudo actualizar el estado.'))
    } finally {
      setPendiente(null)
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Postulantes" subtitle="Candidatos que aplicaron a tus vacantes" />

      {accionError && <div className="mb-4"><ErrorState message={accionError} /></div>}

      {isLoading ? (
        <Loading label="Cargando postulantes..." />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error, 'No se pudieron cargar los postulantes.')} onRetry={() => refetch()} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState message="Todavía no hay postulantes a tus vacantes." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-1 border-b border-default text-left">
                <th className="px-5 py-3 text-2xs font-semibold text-ink-tertiary uppercase tracking-wide">Candidato</th>
                <th className="px-5 py-3 text-2xs font-semibold text-ink-tertiary uppercase tracking-wide">Vacante</th>
                <th className="px-5 py-3 text-2xs font-semibold text-ink-tertiary uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3 text-2xs font-semibold text-ink-tertiary uppercase tracking-wide text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data!.map(e => {
                const acciones = TERMINALES.has(e.estado) ? [] : TODAS.filter(a => a.estado !== e.estado)
                const enCurso = pendiente === e.id
                return (
                  <tr key={e.id} className="border-b border-subtle last:border-0 hover:bg-surface-1 align-top">
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-ink-primary">{e.nombre}</p>
                      <p className="text-2xs text-ink-muted">{e.programa ?? '—'} · {formatFecha(e.fecha)}</p>
                      {e.notaEmpresa && <p className="text-2xs text-ink-tertiary mt-1 italic">“{e.notaEmpresa}”</p>}
                    </td>
                    <td className="px-5 py-3 text-ink-secondary">{e.vacanteTitulo}</td>
                    <td className="px-5 py-3"><Badge tone={ESTADO[e.estado].tone}>{ESTADO[e.estado].label}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {acciones.map(a => (
                          <button
                            key={a.estado}
                            onClick={() => cambiar(e.id, a.estado)}
                            disabled={enCurso}
                            className={cn('h-7 px-2.5 rounded-lg text-2xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed', a.cls)}
                          >
                            {enCurso ? '...' : a.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setNotaPara(e)}
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold border border-default text-ink-secondary hover:bg-surface-3 flex items-center gap-1"
                        >
                          <MessageSquare size={11} /> {e.notaEmpresa ? 'Nota' : 'Nota'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {notaPara && (
        <NotaModal
          postulante={notaPara}
          onClose={() => setNotaPara(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['postulantes-empresa'] })}
        />
      )}
    </div>
  )
}
