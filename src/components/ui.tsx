import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-ink-primary">{title}</h1>
        {subtitle && <p className="text-sm text-ink-tertiary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-surface-2 border border-default rounded-xl p-5', className)}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs text-ink-tertiary">{label}</p>
      <p className="text-2xl font-bold text-ink-primary mt-1">{value}</p>
      {hint && <p className="text-2xs text-ink-muted mt-1">{hint}</p>}
    </Card>
  )
}

const BADGE_TONES: Record<string, string> = {
  blue: 'bg-brand-blue/10 text-brand-blue',
  green: 'bg-semantic-success-bg text-semantic-success',
  amber: 'bg-semantic-warning-bg text-semantic-warning',
  red: 'bg-semantic-error-bg text-semantic-error',
  gray: 'bg-surface-3 text-ink-tertiary',
}

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium', BADGE_TONES[tone])}>
      {children}
    </span>
  )
}

/** Estado de carga genérico. */
export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-tertiary">
      <span className="w-4 h-4 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  )
}

/** Estado de error con opción de reintentar. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-semantic-error-border bg-semantic-error-bg">
      <p className="text-sm text-semantic-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 h-8 px-3 bg-surface-2 border border-default rounded-lg text-xs font-medium text-ink-secondary hover:bg-surface-3"
        >
          Reintentar
        </button>
      )}
    </Card>
  )
}

/** Estado vacío (sin resultados). */
export function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-tertiary text-center py-6">{message}</p>
    </Card>
  )
}
