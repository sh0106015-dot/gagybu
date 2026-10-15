import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <div className="page-header-left">
        {back && (
          <button type="button" className="pill-btn" onClick={() => navigate(-1)}>
            뒤로
          </button>
        )}
      </div>
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  );
}
