import React from 'react';

const compactLabels = {
  operations: ['오늘의', '운영'],
  performance: ['실적'],
  customer: ['OB/', '고객관리'],
  settlement: ['평가·급여'],
  cost: ['비용·승인'],
  settings: ['관리', '설정'],
};

export default function AdminBottomNavigation({ sections, activeSection, onSelect }) {
  return <nav aria-label="관리자 주요 메뉴" className="app-bottom-nav admin-bottom-nav fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white">
    <div className="admin-bottom-nav-items max-w-5xl mx-auto" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}>
      {sections.map(({ key, label, icon: Icon }) => <button
        key={key} type="button" aria-label={label}
        aria-current={activeSection === key ? 'page' : undefined}
        onClick={() => onSelect(key)}
        className={`admin-bottom-nav-button ${activeSection === key ? 'text-brand-700' : 'text-gray-400'}`}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="admin-bottom-nav-compact" aria-hidden="true">{(compactLabels[key] || [label]).map((line, index) => <span key={index}>{line}</span>)}</span>
        <span className="admin-bottom-nav-wide" aria-hidden="true">{label}</span>
      </button>)}
    </div>
  </nav>;
}
