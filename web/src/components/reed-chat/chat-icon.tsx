import type { SVGProps } from 'react';

type IconName = 'arrow-down' | 'arrow-up' | 'check' | 'copy' | 'image' | 'mic' | 'refresh' | 'stop' | 'x';

export function ChatIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    'arrow-down': <><path d="M6 9l6 6 6-6" /></>,
    'arrow-up': <><path d="M12 19V5" /><path d="m6.5 10.5 5.5-5.5 5.5 5.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect height="12" rx="2" width="12" x="9" y="9" /><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" /></>,
    image: <><rect height="16" rx="2" width="18" x="3" y="4" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    mic: <><rect height="12" rx="4" width="8" x="8" y="2" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M9 22h6" /></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></>,
    stop: <rect height="10" rx="2" width="10" x="7" y="7" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}
