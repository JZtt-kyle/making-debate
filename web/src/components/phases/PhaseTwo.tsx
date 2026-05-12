import type { ModelName, ModelStream } from '../../hooks/useDebateSocket.ts'
import PhaseHeader from './PhaseHeader.tsx'
import ThreeColumns from './ThreeColumns.tsx'

export default function PhaseTwoView(props: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean
  isAborted: boolean
}) {
  return (
    <section className="fade-up">
      <PhaseHeader phase={2} isActive={props.isActivePhase} isAborted={props.isAborted} />
      <ThreeColumns panels={props.panels} isActivePhase={props.isActivePhase} />
    </section>
  )
}
