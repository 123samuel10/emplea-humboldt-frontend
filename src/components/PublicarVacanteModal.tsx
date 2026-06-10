'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { empleosApi, apiErrorMessage, type VacanteCreateBody } from '@/lib/api'
import { cn } from '@/lib/utils'

const NIVELES = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'tecnologo', label: 'Tecnólogo' },
  { value: 'universitario', label: 'Universitario' },
  { value: 'posgrado', label: 'Posgrado' },
] as const

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
] as const

const DISPONIBILIDADES = [
  { value: 'tiempo_completo', label: 'Tiempo completo' },
  { value: 'medio_tiempo', label: 'Medio tiempo' },
  { value: 'fines_de_semana', label: 'Fines de semana' },
  { value: 'flexible', label: 'Flexible' },
] as const

const inputCls =
  'w-full h-9 px-3 bg-surface-2 border border-default rounded-lg text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15'

function Campo({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-secondary">
        {label}{required && <span className="text-brand-red ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

export function PublicarVacanteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    tipo_oferta: 'empleo',
    area_conocimiento: '',
    habilidades: '',
    nivel_formacion: 'universitario',
    modalidad: 'hibrido',
    disponibilidad_horaria: 'medio_tiempo',
    ciudad: '',
    salario_min: '',
    salario_max: '',
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.titulo.trim().length < 3) return setError('El título debe tener al menos 3 caracteres.')
    if (form.descripcion.trim().length < 10) return setError('La descripción debe tener al menos 10 caracteres.')
    if (!form.area_conocimiento.trim()) return setError('Indica el área de conocimiento.')

    const body: VacanteCreateBody = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      tipo_oferta: form.tipo_oferta as VacanteCreateBody['tipo_oferta'],
      area_conocimiento: form.area_conocimiento.trim(),
      habilidades: form.habilidades.split(',').map(s => s.trim()).filter(Boolean),
      nivel_formacion: form.nivel_formacion as VacanteCreateBody['nivel_formacion'],
      modalidad: form.modalidad as VacanteCreateBody['modalidad'],
      disponibilidad_horaria: form.disponibilidad_horaria as VacanteCreateBody['disponibilidad_horaria'],
      ciudad: form.ciudad.trim() || undefined,
      salario_min: form.salario_min ? Number(form.salario_min) : undefined,
      salario_max: form.salario_max ? Number(form.salario_max) : undefined,
    }

    setLoading(true)
    try {
      const creada = await empleosApi.crear(body)
      await empleosApi.publicar(creada.id) // crear deja en borrador → publicamos
      qc.invalidateQueries({ queryKey: ['mis-vacantes'] })
      qc.invalidateQueries({ queryKey: ['vacantes'] })
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo publicar la vacante.'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-2 border border-default rounded-xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-default sticky top-0 bg-surface-2">
          <p className="text-base font-bold text-ink-primary">Publicar vacante</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-3 flex items-center justify-center text-ink-tertiary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Título del cargo" required>
              <input className={inputCls} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Desarrollador Frontend React" />
            </Campo>
            <Campo label="Tipo de oferta" required>
              <select className={inputCls} value={form.tipo_oferta} onChange={e => set('tipo_oferta', e.target.value)}>
                <option value="empleo">Empleo</option>
                <option value="practica">Práctica</option>
              </select>
            </Campo>
          </div>

          <Campo label="Descripción" required>
            <textarea
              className={cn(inputCls, 'h-24 py-2 resize-none')}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe las responsabilidades y el contexto del cargo (mín. 10 caracteres)"
            />
          </Campo>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Área de conocimiento" required>
              <input className={inputCls} value={form.area_conocimiento} onChange={e => set('area_conocimiento', e.target.value)} placeholder="Tecnología" />
            </Campo>
            <Campo label="Ciudad">
              <input className={inputCls} value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Armenia" />
            </Campo>
          </div>

          <Campo label="Habilidades (separadas por comas)">
            <input className={inputCls} value={form.habilidades} onChange={e => set('habilidades', e.target.value)} placeholder="React, TypeScript, CSS" />
          </Campo>

          <div className="grid sm:grid-cols-3 gap-4">
            <Campo label="Nivel">
              <select className={inputCls} value={form.nivel_formacion} onChange={e => set('nivel_formacion', e.target.value)}>
                {NIVELES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </Campo>
            <Campo label="Modalidad">
              <select className={inputCls} value={form.modalidad} onChange={e => set('modalidad', e.target.value)}>
                {MODALIDADES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Campo>
            <Campo label="Disponibilidad">
              <select className={inputCls} value={form.disponibilidad_horaria} onChange={e => set('disponibilidad_horaria', e.target.value)}>
                {DISPONIBILIDADES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Campo>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Salario mínimo (COP)">
              <input type="number" min={0} className={inputCls} value={form.salario_min} onChange={e => set('salario_min', e.target.value)} placeholder="1200000" />
            </Campo>
            <Campo label="Salario máximo (COP)">
              <input type="number" min={0} className={inputCls} value={form.salario_max} onChange={e => set('salario_max', e.target.value)} placeholder="1800000" />
            </Campo>
          </div>

          {error && (
            <p className="text-xs text-semantic-error bg-semantic-error-bg border border-semantic-error-border rounded px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 border border-default rounded-lg text-sm font-medium text-ink-secondary hover:bg-surface-3">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="h-9 px-4 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Publicando...' : 'Publicar vacante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
