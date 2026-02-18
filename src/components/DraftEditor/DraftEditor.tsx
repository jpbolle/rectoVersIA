'use client';

import type { DraftContent, DraftType } from '@/types/travail';
import type { DraftItemAnnotation } from '@/types/correction';
import CrcDraft from './CrcDraft';
import PlanDraft from './PlanDraft';
import SimpleDraft from './SimpleDraft';
import styles from './DraftEditor.module.css';

interface DraftEditorProps {
  draftType: DraftType;
  draft: DraftContent;
  onChange: (draft: DraftContent) => void;
  disabled?: boolean;
  // Props d'annotation prof (optionnelles)
  draftAnnotations?: Record<string, DraftItemAnnotation>;
  onAnnotationChange?: (itemId: string, annotation: DraftItemAnnotation) => void;
  isRecording?: boolean;
  recordingItemId?: string | null;
  recordingDuration?: number;
  onStartRecording?: (itemId: string) => void;
  onStopRecording?: () => void;
  // Mode lecture seule (élève)
  readOnlyAnnotations?: boolean;
}

export default function DraftEditor({
  draftType,
  draft,
  onChange,
  disabled = false,
  draftAnnotations,
  onAnnotationChange,
  isRecording,
  recordingItemId,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  readOnlyAnnotations = false,
}: DraftEditorProps) {
  const noop = () => {};
  const annotationProps = draftAnnotations && (onAnnotationChange || readOnlyAnnotations) ? {
    draftAnnotations,
    onAnnotationChange: onAnnotationChange ?? noop as (itemId: string, annotation: DraftItemAnnotation) => void,
    isRecording: isRecording ?? false,
    recordingItemId: recordingItemId ?? null,
    recordingDuration: recordingDuration ?? 0,
    onStartRecording: onStartRecording ?? noop as (itemId: string) => void,
    onStopRecording: onStopRecording ?? noop,
    readOnlyAnnotations,
  } : undefined;

  return (
    <div className={styles.container}>
      {draftType === 'crc' && (
        <CrcDraft draft={draft} onChange={onChange} disabled={disabled} {...annotationProps} />
      )}
      {draftType === 'plan' && (
        <PlanDraft draft={draft} onChange={onChange} disabled={disabled} {...annotationProps} />
      )}
      {draftType === 'brouillon' && (
        <SimpleDraft draft={draft} onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}
