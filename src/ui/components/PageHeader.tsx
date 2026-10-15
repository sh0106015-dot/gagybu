import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => navigate(-1)}>
          ←
        </button>
      )}
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  );
}
