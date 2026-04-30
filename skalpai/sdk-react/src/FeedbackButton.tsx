import { useEffect, useRef } from 'react';
import '@digstack/skalpai-feedback-widget';

export type FeedbackTheme = 'light' | 'dark' | 'auto';

export type FeedbackLabels = {
  title?: string;
  send?: string;
  sending?: string;
  close?: string;
  bug?: string;
  idea?: string;
  other?: string;
  placeholder?: string;
  thanks?: string;
  capture?: string;
  capturing?: string;
  remove_screenshot?: string;
};

export interface FeedbackButtonProps {
  /** Skalpai backend URL, e.g. `https://api.skalpai.com` */
  endpoint: string;
  /** Project API key (creates a feedback scoped to that project) */
  apiKey: string;
  /** Project UUID (used in the URL: /api/projects/:projectId/feedback) */
  projectId: string;
  /** Optional user identifier (email, user id…) attached to the feedback */
  userIdentifier?: string;
  /** Override theme detection. Default: 'auto' (Tailwind/shadcn/Mantine/system) */
  theme?: FeedbackTheme;
  /** Localized labels — omitted keys fall back to the widget defaults (FR) */
  labels?: FeedbackLabels;
}

export function FeedbackButton({
  endpoint,
  apiKey,
  projectId,
  userIdentifier,
  theme,
  labels,
}: FeedbackButtonProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current && userIdentifier !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref.current as any).userIdentifier = userIdentifier;
    }
  }, [userIdentifier]);

  if (!endpoint || !apiKey || !projectId) return null;

  const labelsAttr = labels ? JSON.stringify(labels) : undefined;

  return (
    <skalpai-feedback
      ref={ref}
      endpoint={endpoint}
      api-key={apiKey}
      project-id={projectId}
      {...(theme && theme !== 'auto' ? { theme } : {})}
      {...(labelsAttr ? { labels: labelsAttr } : {})}
    />
  );
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'skalpai-feedback': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'api-key'?: string;
          endpoint?: string;
          'project-id'?: string;
          theme?: 'light' | 'dark';
          labels?: string;
        },
        HTMLElement
      >;
    }
  }
}
